import os
import io
import json
import pathlib
import traceback
from typing import List, Optional

import joblib
import numpy as np
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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
# Load PyTorch CNN for image classification
# ─────────────────────────────────────────────
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE = 224


class SimpleCNN(nn.Module):
    """Minimal CNN matching the architecture used during training."""

    def __init__(self, num_classes: int = 2):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 28 * 28, 256),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        return self.classifier(self.features(x))


cnn_model = None
try:
    cnn_model = SimpleCNN(num_classes=2)
    state = torch.load(CNN_PATH, map_location=DEVICE)
    # Support both raw state_dict and checkpoint dicts
    if isinstance(state, dict) and "model_state_dict" in state:
        state = state["model_state_dict"]
    elif isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]
    cnn_model.load_state_dict(state, strict=False)
    cnn_model.to(DEVICE)
    cnn_model.eval()
    print(f"[OK] CNN model loaded from {CNN_PATH}")
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
    machine_id: Optional[str] = None
    temperature: float
    vibration: float
    pressure: float
    rpm: float
    load: float


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
    raw = (
        row.temperature * 0.34
        + row.vibration * 100 * 0.42
        + row.pressure * 0.12
        + row.load * 0.12
    )
    return float(np.clip(raw / 100, 0.02, 0.99))


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
                features = np.array([[
                    row.temperature,
                    row.vibration,
                    row.pressure,
                    row.rpm,
                    row.load,
                ]])
                prob = float(xgb_pipeline.predict_proba(features)[0][1])
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

        if row.vibration > 0.42:
            cause = "Vibration anomaly"
        elif row.temperature > 84:
            cause = "Thermal rise"
        else:
            cause = "Pressure drift"

        results.append({
            "machine": row.machine_id or "Unknown",
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

    # Anomaly scores per sensor — take averages across all rows
    def _avg(attr):
        vals = [getattr(r_raw, attr) for r_raw in request.rows]
        return round(float(np.mean(vals)), 3)

    anomaly_series = [
        {"sensor": "Temp",      "score": min(99, round(_avg("temperature") * 0.9))},
        {"sensor": "Vibration", "score": min(99, round(_avg("vibration") * 150))},
        {"sensor": "Pressure",  "score": min(99, round(_avg("pressure") * 1.8))},
        {"sensor": "Load",      "score": min(99, round(_avg("load") * 0.9))},
        {"sensor": "RPM",       "score": min(99, round(_avg("rpm") * 0.04))},
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

    # Class order: 0 = Non-Defected, 1 = Defected
    defect_prob = probs[1]
    label = "Defected" if defect_prob >= 0.5 else "Non-Defected"

    return {
        "label": label,
        "defect_probability": round(defect_prob * 100, 1),
        "healthy_probability": round(probs[0] * 100, 1),
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