const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/**
 * Generic fetch wrapper — throws an Error with the server message on non-2xx.
 */
async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch (_) {}
    throw new Error(detail)
  }
  return res.json()
}

// ─────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────

/** Returns { status, xgb_loaded, cnn_loaded, faq_entries, cohere_ready } */
export async function healthCheck() {
  return apiFetch('/health')
}

// ─────────────────────────────────────────────────────────────
// Sensor-based batch prediction  →  POST /predict
// ─────────────────────────────────────────────────────────────

/**
 * @param {Array<{machine_id?: string, temperature: number, vibration: number,
 *                pressure: number, rpm: number, load: number}>} rows
 * @param {number} threshold  0.0 – 1.0 failure threshold
 * @returns {Promise<{summary, riskSeries, anomalySeries, machineResults, model}>}
 */
export async function predictBatch(rows, threshold = 0.5) {
  return apiFetch('/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, threshold }),
  })
}

// ─────────────────────────────────────────────────────────────
// Image classification  →  POST /predict-image
// ─────────────────────────────────────────────────────────────

/**
 * @param {File} file  An image File object from a file-input or drag-drop
 * @returns {Promise<{label: string, defect_probability: number,
 *                    healthy_probability: number, confidence: number}>}
 */
export async function predictImage(file) {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch('/predict-image', { method: 'POST', body: formData })
}

// ─────────────────────────────────────────────────────────────
// RAG chat  →  POST /chat
// ─────────────────────────────────────────────────────────────

/**
 * @param {string} message
 * @param {Array<{role: string, text: string}>} history  Previous turns
 * @returns {Promise<{answer: string, source: string, retrieved_docs: number}>}
 */
export async function sendChatMessage(message, history = []) {
  return apiFetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  })
}

// ─────────────────────────────────────────────────────────────
// Live Monitor  →  GET /monitor
// ─────────────────────────────────────────────────────────────

/**
 * @returns {Promise<{fleet_summary, machines, generated_at}>}
 */
export async function fetchMonitor() {
  return apiFetch('/monitor')
}

// ─────────────────────────────────────────────────────────────
// EDA  →  GET /eda
// ─────────────────────────────────────────────────────────────

/**
 * @returns {Promise<{summary, distributions, failure_by_machine,
 *                    monthly_trend, correlation, error_distribution}>}
 */
export async function fetchEda() {
  return apiFetch('/eda')
}

// ─────────────────────────────────────────────────────────────
// Alerts  →  GET /alerts
// ─────────────────────────────────────────────────────────────

/**
 * @returns {Promise<{alerts, summary, generated_at}>}
 */
export async function fetchAlerts() {
  return apiFetch('/alerts')
}
