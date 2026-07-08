import os
import io
import json
import math
import random
import pathlib
import traceback
from datetime import datetime, timedelta
from typing import List, Optional, Dict

from dotenv import load_dotenv

# Load .env from the project root (one level above backend/)
load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import cohere
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import torchvision.transforms as transforms

# ─────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────
app = FastAPI(title="Smart Factory Monitoring API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # Add your Vercel URL after deploying, e.g.:
        # "https://smart-factory.vercel.app",
        "*",  # remove this after adding your exact Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────
BASE_DIR = pathlib.Path(__file__).parent
XGB_PATH = BASE_DIR / "xgb_pipeline.joblib"
CNN_PATH = BASE_DIR / "best.pth"
FAQ_PATH = BASE_DIR.parent / "RAG" / "smart_factory_faq_v3.json"
DATA_PATH = BASE_DIR.parent / "Data" / "final_dataset.csv"

# ─────────────────────────────────────────────
# Load XGBoost pipeline at startup
# ─────────────────────────────────────────────
xgb_pipeline = None
try:
    xgb_pipeline = joblib.load(XGB_PATH)
    print(f"[OK] XGBoost pipeline loaded from {XGB_PATH}")
except Exception as exc:
    print(f"[WARN] Could not load XGBoost pipeline: {exc}")

# ─────────────────────────────────────────────
# Load PyTorch EfficientNet-B0 for image classification
# ─────────────────────────────────────────────
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE = 224

# Class order matches ImageFolder alphabetical sort:
# 0 = Defected, 1 = Non-Defected
CLASS_NAMES = ["Defected", "Non-Defected"]

cnn_model = None
try:
    import torchvision.models as tv_models

    # Rebuild the exact same architecture used in training
    _m = tv_models.efficientnet_b0(weights=None)
    in_f = _m.classifier[1].in_features
    _m.classifier[1] = nn.Linear(in_f, 2)

    state = torch.load(CNN_PATH, map_location=DEVICE, weights_only=True)
    # Support checkpoint dicts
    if isinstance(state, dict) and "model_state_dict" in state:
        state = state["model_state_dict"]
    elif isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]

    _m.load_state_dict(state, strict=True)
    _m.to(DEVICE)
    _m.eval()
    cnn_model = _m
    print(f"[OK] EfficientNet-B0 loaded from {CNN_PATH}")
except Exception as exc:
    print(f"[WARN] Could not load CNN model: {exc}")
    traceback.print_exc()

IMG_TRANSFORM = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# ─────────────────────────────────────────────
# Load FAQ knowledge base for RAG
# ─────────────────────────────────────────────
faq_documents: List[dict] = []
try:
    with open(FAQ_PATH, "r", encoding="utf-8") as f:
        faq_documents = json.load(f)
    print(f"[OK] FAQ knowledge base loaded — {len(faq_documents)} entries")
except Exception as exc:
    print(f"[WARN] Could not load FAQ: {exc}")

# ─────────────────────────────────────────────
# Cohere client
# ─────────────────────────────────────────────
COHERE_API_KEY = os.getenv("COHERE_API_KEY", "")
co_client = cohere.Client(COHERE_API_KEY) if COHERE_API_KEY else None
if co_client:
    print("[OK] Cohere client initialised")
else:
    print("[WARN] COHERE_API_KEY not set — /chat will use fallback keyword search")


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────
class SensorRow(BaseModel):
    """
    Accepts any subset of columns from final_dataset.csv.
    All fields are optional — missing ones become NaN and the
    pipeline handles them. The pipeline was trained with these exact column names.
    """
    # Identity
    machine_id: Optional[str] = None
    machineID:  Optional[float] = None

    # Core telemetry
    volt:      Optional[float] = None
    rotate:    Optional[float] = None
    pressure:  Optional[float] = None
    vibration: Optional[float] = None

    # Engineered features
    error_count:       Optional[float] = None
    maint_flag:        Optional[float] = None
    days_since_maint:  Optional[float] = None
    age:               Optional[float] = None
    hour:              Optional[float] = None
    dayofweek:         Optional[float] = None
    month:             Optional[float] = None
    is_weekend:        Optional[float] = None
    volt_lag1:         Optional[float] = None
    volt_lag3:         Optional[float] = None
    rotate_lag1:       Optional[float] = None
    rotate_lag3:       Optional[float] = None
    pressure_lag1:     Optional[float] = None
    pressure_lag3:     Optional[float] = None
    vibration_lag1:    Optional[float] = None
    vibration_lag3:    Optional[float] = None
    error_count_lag1:  Optional[float] = None
    error_count_lag3:  Optional[float] = None
    volt_mean_3:       Optional[float] = None
    volt_std_3:        Optional[float] = None
    volt_max_3:        Optional[float] = None
    rotate_mean_3:     Optional[float] = None
    rotate_std_3:      Optional[float] = None
    rotate_max_3:      Optional[float] = None
    pressure_mean_3:   Optional[float] = None
    pressure_std_3:    Optional[float] = None
    pressure_max_3:    Optional[float] = None
    vibration_mean_3:  Optional[float] = None
    vibration_std_3:   Optional[float] = None
    vibration_max_3:   Optional[float] = None
    error_count_mean_3:Optional[float] = None
    error_count_std_3: Optional[float] = None
    error_count_max_3: Optional[float] = None
    volt_diff:         Optional[float] = None
    rotate_diff:       Optional[float] = None
    pressure_diff:     Optional[float] = None
    vibration_diff:    Optional[float] = None
    error_count_diff:  Optional[float] = None
    recent_maint:         Optional[float] = None
    log_days_since_maint: Optional[float] = None
    error_rate:           Optional[float] = None
    error_trend:          Optional[float] = None
    stress_index:         Optional[float] = None
    power_stress:         Optional[float] = None
    machine_age:          Optional[float] = None
    model_encoded:        Optional[float] = None

    # Categorical columns used by OneHotEncoder in the pipeline
    comp:  Optional[str] = None
    model: Optional[str] = None

    # Simple-CSV aliases (sample data uses these names)
    temperature: Optional[float] = None  # maps to volt
    rpm:         Optional[float] = None  # maps to rotate
    load:        Optional[float] = None  # maps to stress_index

    def to_df_row(self) -> dict:
        """Return a dict with the pipeline's expected column names."""
        d = self.model_dump(exclude={"machine_id", "temperature", "rpm", "load"})
        # Apply simple-CSV aliases when real columns are missing
        if d.get("volt") is None and self.temperature is not None:
            d["volt"] = self.temperature
        if d.get("rotate") is None and self.rpm is not None:
            d["rotate"] = self.rpm
        if d.get("stress_index") is None and self.load is not None:
            d["stress_index"] = self.load
        if d.get("machineID") is None and self.machine_id is not None:
            try:
                d["machineID"] = float(self.machine_id)
            except (ValueError, TypeError):
                d["machineID"] = float("nan")
        return d

    # ── fallback helpers for heuristic when XGB unavailable ──
    @property
    def eff_volt(self) -> float:
        return self.volt or self.temperature or 175.0

    @property
    def eff_vibration(self) -> float:
        return self.vibration or 0.3

    @property
    def eff_pressure(self) -> float:
        return self.pressure or 35.0


class BatchPredictRequest(BaseModel):
    rows: List[SensorRow]
    threshold: float = 0.5


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []


# ─────────────────────────────────────────────
# Helper – fallback risk calculation when XGB unavailable
# ─────────────────────────────────────────────
def _fallback_risk(row: SensorRow) -> float:
    # Normalise volt (150-250 range) to a 0-1 risk contribution
    volt_risk = max(0, (200 - row.eff_volt) / 100)
    raw = (
        volt_risk * 0.34
        + row.eff_vibration * 100 * 0.42
        + row.eff_pressure / 100 * 0.12
        + (row.stress_index or 50) / 100 * 0.12
    )
    return float(np.clip(raw, 0.02, 0.99))


def _status_label(prob: float, threshold: float) -> str:
    if prob >= max(threshold + 0.2, 0.75):
        return "Critical"
    if prob >= threshold:
        return "Warning"
    return "Healthy"


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "Smart Factory Monitoring API is running", "version": "2.0.0"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "xgb_loaded": xgb_pipeline is not None,
        "cnn_loaded": cnn_model is not None,
        "faq_entries": len(faq_documents),
        "cohere_ready": co_client is not None,
    }


@app.post("/predict")
def predict_batch(request: BatchPredictRequest):
    """
    Accepts a list of sensor rows and returns per-machine risk scores,
    status labels, and summary statistics.
    Uses the real XGBoost pipeline when available, otherwise falls back
    to the weighted heuristic.
    """
    results = []

    for row in request.rows:
        if xgb_pipeline is not None:
            try:
                row_dict = row.to_df_row()
                df_row = pd.DataFrame([row_dict])
                prob = float(xgb_pipeline.predict_proba(df_row)[0][1])
            except Exception:
                prob = _fallback_risk(row)
        else:
            prob = _fallback_risk(row)

        status = _status_label(prob, request.threshold)
        failure_pct = round(prob * 100)

        if status == "Critical":
            lead_time = "6 - 12 hrs"
        elif status == "Warning":
            lead_time = "24 hrs"
        else:
            lead_time = "72 hrs"

        vib = row.eff_vibration
        volt = row.eff_volt
        pres = row.eff_pressure
        if vib > 0.42:
            cause = "Vibration anomaly"
        elif volt < 160:
            cause = "Low voltage"
        elif pres > 48:
            cause = "Over-pressure"
        else:
            cause = "Normal wear"

        results.append({
            "machine": row.machine_id or str(row.machineID or "Unknown"),
            "failureProbability": failure_pct,
            "normalized": round(prob, 4),
            "status": status,
            "leadTime": lead_time,
            "cause": cause,
        })

    total = len(results)
    critical = sum(1 for r in results if r["status"] == "Critical")
    healthy = sum(1 for r in results if r["status"] == "Healthy")
    avg_conf = round(sum(max(72, min(98, r["failureProbability"])) for r in results) / total) if total else 0

    # Risk trend for the first machine (6 forecast points)
    base_risk = results[0]["failureProbability"] if results else 50
    risk_series = [
        {"hour": h, "risk": round(base_risk * (0.86 + i * 0.05))}
        for i, h in enumerate(["Now", "+4h", "+8h", "+12h", "+18h", "+24h"])
    ]

    # Anomaly scores per sensor
    def _avg(getter):
        vals = [getter(r) for r in request.rows]
        return round(float(np.mean([v for v in vals if v is not None])), 3)

    anomaly_series = [
        {"sensor": "Volt",      "score": min(99, round(max(0, (200 - _avg(lambda r: r.eff_volt)) / 100 * 99)))},
        {"sensor": "Vibration", "score": min(99, round(_avg(lambda r: r.eff_vibration) * 150))},
        {"sensor": "Pressure",  "score": min(99, round(_avg(lambda r: r.eff_pressure) * 1.8))},
        {"sensor": "Errors",    "score": min(99, round(_avg(lambda r: r.error_count or 0) * 20))},
        {"sensor": "RPM",       "score": min(99, round(max(0, (_avg(lambda r: r.rotate or r.rpm or 1200) - 800) / 700 * 60)))},
    ]

    return {
        "summary": {
            "totalMachines": total,
            "criticalMachines": critical,
            "healthyMachines": healthy,
            "avgConfidence": avg_conf,
        },
        "riskSeries": risk_series,
        "anomalySeries": anomaly_series,
        "machineResults": results[:8],
        "model": "XGBoost" if xgb_pipeline is not None else "Heuristic",
    }


@app.post("/predict-image")
async def predict_image(file: UploadFile = File(...)):
    """
    Accepts an image upload and classifies it as Defected or Non-Defected
    using the trained PyTorch CNN.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (jpeg/png/etc.)")

    contents = await file.read()

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image file.")

    if cnn_model is None:
        raise HTTPException(status_code=503, detail="CNN model not loaded. Check server logs.")

    tensor = IMG_TRANSFORM(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        logits = cnn_model(tensor)
        probs = torch.softmax(logits, dim=1)[0].cpu().tolist()

    # Class order matches ImageFolder alphabetical sort:
    # 0 = Defected, 1 = Non-Defected
    defect_prob  = probs[0]
    healthy_prob = probs[1]
    pred_idx = int(torch.tensor(probs).argmax())
    label = CLASS_NAMES[pred_idx]

    return {
        "label": label,
        "defect_probability":  round(defect_prob  * 100, 1),
        "healthy_probability": round(healthy_prob * 100, 1),
        "confidence": round(max(probs) * 100, 1),
    }


@app.post("/chat")
def chat(request: ChatRequest):
    """
    RAG-powered bilingual chat endpoint.
    Uses Cohere rerank + generate when available, falls back to keyword
    search over the FAQ knowledge base when Cohere is not configured.
    """
    query = request.message.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # ── Retrieve top-k FAQ entries by keyword overlap ──────────────────
    query_lower = query.lower()
    scored = []
    for entry in faq_documents:
        q_words = set(entry.get("question", "").lower().split())
        a_words = set(entry.get("answer", "").lower().split())
        overlap = sum(1 for w in query_lower.split() if w in q_words | a_words)
        scored.append((overlap, entry))
    scored.sort(key=lambda x: x[0], reverse=True)
    top_docs = [e for _, e in scored[:5] if _ > 0]

    # Build context string from retrieved docs
    context_parts = []
    for doc in top_docs[:3]:
        context_parts.append(
            f"Q: {doc['question']}\nA: {doc['answer']}"
        )
    context = "\n\n".join(context_parts) if context_parts else "No specific FAQ matched."

    # ── Generate answer ────────────────────────────────────────────────
    if co_client:
        try:
            system_prompt = (
                "You are an expert smart factory maintenance assistant. "
                "Answer concisely using the provided context. "
                "If the question is in Arabic, respond in Arabic. "
                "If no context matches, use your general knowledge about industrial machinery."
            )
            full_prompt = (
                f"{system_prompt}\n\n"
                f"Context from knowledge base:\n{context}\n\n"
                f"User question: {query}\n\nAnswer:"
            )
            response = co_client.generate(
                model="command-r-plus",
                prompt=full_prompt,
                max_tokens=512,
                temperature=0.3,
            )
            answer = response.generations[0].text.strip()
            source = "Cohere RAG"
        except Exception as exc:
            # Fall through to keyword-based answer
            answer = context if context_parts else "I couldn't find a relevant answer."
            source = f"FAQ fallback (Cohere error: {exc})"
    else:
        # No API key — return best FAQ answer directly
        if top_docs:
            answer = top_docs[0]["answer"]
            source = "FAQ keyword match"
        else:
            answer = (
                "I don't have a specific answer for that in my knowledge base. "
                "Please consult your maintenance manual or contact a technician."
            )
            source = "No match"

    return {
        "answer": answer,
        "source": source,
        "retrieved_docs": len(top_docs),
    }


# ═══════════════════════════════════════════════════════════════════
# Dataset loader (lazy, cached in module-level variable)
# ═══════════════════════════════════════════════════════════════════
_df_cache: Optional[object] = None   # pd.DataFrame | None

def _load_df() -> "pd.DataFrame | None":
    global _df_cache
    if _df_cache is not None:
        return _df_cache
    try:
        df = pd.read_csv(DATA_PATH, low_memory=False)
        # Normalise column names to lowercase
        df.columns = [c.strip().lower() for c in df.columns]
        # Parse datetime if present
        for col in ("datetime", "date", "timestamp"):
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce")
                df = df.sort_values(col)
                break
        _df_cache = df
        print(f"[OK] Dataset loaded — {len(df):,} rows, {len(df.columns)} cols")
    except Exception as exc:
        print(f"[WARN] Could not load dataset: {exc}")
        _df_cache = None
    return _df_cache


# ═══════════════════════════════════════════════════════════════════
# /monitor  — live telemetry snapshot (simulated real-time)
# ═══════════════════════════════════════════════════════════════════
# We take the last known reading per machine from the dataset and
# add a small random jitter to simulate live sensor drift.
# ═══════════════════════════════════════════════════════════════════

TELEM_COLS = {
    "volt":      ("voltage",   "V",      150, 250),
    "rotate":    ("rpm",       "rpm",    800, 1500),
    "pressure":  ("pressure",  "bar",    20,  60),
    "vibration": ("vibration", "mm/s",   0,   1),
}

_rng = random.Random(42)


def _jitter(val: float, pct: float = 0.03) -> float:
    return round(val * (1 + _rng.uniform(-pct, pct)), 3)


def _risk_from_row(row: dict) -> float:
    v = row.get("vibration", 0.3)
    p = row.get("pressure", 35)
    vt = row.get("volt", 180)
    raw = v * 0.40 + (p / 60) * 0.30 + ((250 - vt) / 250) * 0.30
    return round(min(0.98, max(0.02, raw)), 3)


@app.get("/monitor")
def monitor():
    """
    Returns a snapshot of current telemetry for up to 12 machines.
    Uses real data from the dataset if available, otherwise generates
    plausible synthetic readings.
    """
    df = _load_df()
    machines = []
    fleet_summary = {"total": 0, "critical": 0, "warning": 0, "healthy": 0}

    if df is not None:
        # columns present in the dataset
        id_col = next((c for c in ("machineid", "machine_id", "machine") if c in df.columns), None)
        avail = {k: k in df.columns for k in TELEM_COLS}

        if id_col:
            last = df.groupby(id_col).last().reset_index()
            sample = last.head(12)
            for _, row in sample.iterrows():
                mid = str(row[id_col])
                telem = {}
                for col, (label, unit, lo, hi) in TELEM_COLS.items():
                    raw = float(row[col]) if avail[col] and not pd.isna(row.get(col, float("nan"))) else _rng.uniform(lo, hi)
                    telem[col] = {"value": _jitter(raw), "unit": unit, "label": label}

                risk = _risk_from_row({k: telem[k]["value"] for k in telem})
                status = "Critical" if risk >= 0.75 else "Warning" if risk >= 0.50 else "Healthy"
                failure_flag = int(row.get("failure_flag", 0)) if "failure_flag" in df.columns else 0

                machines.append({
                    "id": mid,
                    "risk": risk,
                    "status": status,
                    "failure_flag": failure_flag,
                    "telemetry": telem,
                    "last_updated": datetime.utcnow().isoformat() + "Z",
                })
                fleet_summary["total"] += 1
                fleet_summary[status.lower()] += 1
        else:
            df = None  # fall through to synthetic

    if not machines:
        # Synthetic fallback — 12 machines
        machine_ids = [f"M{i:03d}" for i in range(1, 13)]
        for mid in machine_ids:
            telem = {
                "volt":      {"value": _jitter(_rng.uniform(150, 250)),  "unit": "V",    "label": "Voltage"},
                "rotate":    {"value": _jitter(_rng.uniform(800, 1500)), "unit": "rpm",  "label": "RPM"},
                "pressure":  {"value": _jitter(_rng.uniform(20, 60)),    "unit": "bar",  "label": "Pressure"},
                "vibration": {"value": _jitter(_rng.uniform(0, 1)),      "unit": "mm/s", "label": "Vibration"},
            }
            risk = _risk_from_row({k: telem[k]["value"] for k in telem})
            status = "Critical" if risk >= 0.75 else "Warning" if risk >= 0.50 else "Healthy"
            machines.append({
                "id": mid,
                "risk": risk,
                "status": status,
                "failure_flag": 0,
                "telemetry": telem,
                "last_updated": datetime.utcnow().isoformat() + "Z",
            })
            fleet_summary["total"] += 1
            fleet_summary[status.lower()] += 1

    # Fleet-level uptime (% healthy + warning)
    uptime = round(
        (fleet_summary["healthy"] + fleet_summary["warning"])
        / max(fleet_summary["total"], 1) * 100, 1
    )

    # 24-point sparkline history per machine (simulated)
    for m in machines:
        base = m["risk"]
        m["sparkline"] = [
            round(min(0.99, max(0.01, base + _rng.uniform(-0.08, 0.08))), 3)
            for _ in range(24)
        ]
        m["sparkline"][-1] = base  # last point = current

    return {
        "fleet_summary": {**fleet_summary, "uptime_pct": uptime},
        "machines": machines,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


# ═══════════════════════════════════════════════════════════════════
# /eda  — exploratory data analysis statistics
# ═══════════════════════════════════════════════════════════════════

@app.get("/eda")
def eda():
    """
    Returns pre-computed EDA statistics for the Data Analysis tab:
    - Sensor distribution histograms
    - Failure rate per machine (top 15)
    - Monthly failure trend
    - Correlation matrix between key sensors
    - Basic dataset summary
    """
    df = _load_df()

    if df is None:
        raise HTTPException(status_code=503, detail="Dataset not available. Check server logs.")

    out: Dict = {}

    # ── 1. Dataset summary ────────────────────────────────────────
    out["summary"] = {
        "rows": int(len(df)),
        "machines": int(df["machineid"].nunique()) if "machineid" in df.columns else 0,
        "failures": int(df["failure_flag"].sum()) if "failure_flag" in df.columns else 0,
        "columns": int(len(df.columns)),
    }

    # ── 2. Sensor distributions (histogram buckets, 20 bins) ──────
    distributions = {}
    for col in ("volt", "rotate", "pressure", "vibration"):
        if col not in df.columns:
            continue
        series = df[col].dropna()
        counts, edges = np.histogram(series, bins=20)
        distributions[col] = [
            {"bin": round(float((edges[i] + edges[i + 1]) / 2), 2), "count": int(counts[i])}
            for i in range(len(counts))
        ]
    out["distributions"] = distributions

    # ── 3. Failure rate by machine (top 15) ───────────────────────
    failure_by_machine = []
    if "machineid" in df.columns and "failure_flag" in df.columns:
        grp = df.groupby("machineid")["failure_flag"].agg(["sum", "count"])
        grp["rate"] = (grp["sum"] / grp["count"] * 100).round(2)
        top = grp.nlargest(15, "sum").reset_index()
        failure_by_machine = [
            {"machine": str(r["machineid"]), "failures": int(r["sum"]), "rate": float(r["rate"])}
            for _, r in top.iterrows()
        ]
    out["failure_by_machine"] = failure_by_machine

    # ── 4. Monthly failure trend ───────────────────────────────────
    monthly_trend = []
    dt_col = next((c for c in ("datetime", "date", "timestamp") if c in df.columns), None)
    if dt_col and "failure_flag" in df.columns:
        tmp = df[[dt_col, "failure_flag"]].copy()
        tmp["month"] = tmp[dt_col].dt.to_period("M").astype(str)
        monthly = tmp.groupby("month")["failure_flag"].sum().reset_index()
        monthly_trend = [
            {"month": str(r["month"]), "failures": int(r["failure_flag"])}
            for _, r in monthly.iterrows()
        ]
    out["monthly_trend"] = monthly_trend

    # ── 5. Correlation matrix ─────────────────────────────────────
    corr_cols = [c for c in ("volt", "rotate", "pressure", "vibration", "failure_flag") if c in df.columns]
    corr_matrix = []
    if len(corr_cols) >= 2:
        corr = df[corr_cols].corr().round(3)
        for r in corr_cols:
            for c in corr_cols:
                corr_matrix.append({"x": r, "y": c, "value": float(corr.loc[r, c])})
    out["correlation"] = corr_matrix

    # ── 6. Error count distribution ───────────────────────────────
    error_dist = []
    if "error_count" in df.columns:
        vc = df["error_count"].value_counts().sort_index().head(10)
        error_dist = [{"errors": int(k), "machines": int(v)} for k, v in vc.items()]
    out["error_distribution"] = error_dist

    return out


# ═══════════════════════════════════════════════════════════════════
# /alerts — rule-based alert engine
# ═══════════════════════════════════════════════════════════════════
# Scans the latest reading per machine and fires alerts when sensors
# cross configurable thresholds.
# ═══════════════════════════════════════════════════════════════════

ALERT_RULES = [
    # (sensor_col, operator, threshold, severity, title, description_tpl)
    ("vibration", ">",  0.85, "Critical", "High Vibration",      "Vibration {val:.3f} mm/s exceeds critical limit 0.85"),
    ("vibration", ">",  0.60, "Warning",  "Elevated Vibration",  "Vibration {val:.3f} mm/s above warning level 0.60"),
    ("pressure",  ">",  55,   "Critical", "Over-pressure",       "Pressure {val:.1f} bar above critical ceiling 55"),
    ("pressure",  ">",  48,   "Warning",  "High Pressure",       "Pressure {val:.1f} bar above warning level 48"),
    ("volt",      "<",  160,  "Critical", "Low Voltage",         "Voltage {val:.1f} V below critical floor 160"),
    ("volt",      ">",  240,  "Warning",  "High Voltage",        "Voltage {val:.1f} V above safe limit 240"),
    ("rotate",    ">", 1450,  "Warning",  "Over-speed",          "Rotation {val:.0f} rpm above safe limit 1450"),
    ("rotate",    "<",  850,  "Warning",  "Under-speed",         "Rotation {val:.0f} rpm below minimum 850"),
]

_SEVERITY_ORDER = {"Critical": 0, "Warning": 1, "Info": 2}


def _check_rule(val: float, op: str, thr: float) -> bool:
    if op == ">":  return val > thr
    if op == "<":  return val < thr
    if op == ">=": return val >= thr
    if op == "<=": return val <= thr
    return False


@app.get("/alerts")
def alerts():
    """
    Returns a list of active alerts derived from current telemetry.
    Each alert carries id, machine_id, sensor, severity, title,
    description, value, threshold, and timestamp.
    """
    monitor_data = monitor()  # reuse monitor logic
    machines = monitor_data["machines"]

    active_alerts = []
    alert_id = 1

    for machine in machines:
        telem = machine["telemetry"]
        for col, op, thr, severity, title, desc_tpl in ALERT_RULES:
            if col not in telem:
                continue
            val = telem[col]["value"]
            if _check_rule(val, op, thr):
                active_alerts.append({
                    "id": alert_id,
                    "machine_id": machine["id"],
                    "sensor": col,
                    "severity": severity,
                    "title": title,
                    "description": desc_tpl.format(val=val),
                    "value": val,
                    "threshold": thr,
                    "unit": telem[col]["unit"],
                    "timestamp": machine["last_updated"],
                    "status": "active",
                })
                alert_id += 1

    # Sort: Critical first, then Warning, then by machine id
    active_alerts.sort(key=lambda a: (_SEVERITY_ORDER.get(a["severity"], 9), a["machine_id"]))

    summary = {
        "total": len(active_alerts),
        "critical": sum(1 for a in active_alerts if a["severity"] == "Critical"),
        "warning":  sum(1 for a in active_alerts if a["severity"] == "Warning"),
    }

    return {"alerts": active_alerts, "summary": summary, "generated_at": datetime.utcnow().isoformat() + "Z"}
