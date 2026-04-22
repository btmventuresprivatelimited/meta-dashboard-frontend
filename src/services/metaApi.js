const API_BASE = "https://meta-dashboard-backend-2wmr.onrender.com/";

export async function fetchAdAccounts() {
  const response = await fetch(`${API_BASE}/accounts`);
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to fetch ad accounts");
  }

  return result.data || [];
}
