const API_URL = import.meta.env.VITE_API_URL;

export async function predictMaintenance(payload) {
  const response = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Prediction request failed");
  }

  return response.json();
}