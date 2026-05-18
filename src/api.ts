const API_BASE = "https://fantasybytissot.letour.fr/v1";
const GAME_IDENTITY = "630";
const GAME_VERSION = "16.17";

// X-Access-Key format: {identity}@{version}@{codeDemo}
const ACCESS_KEY = `${GAME_IDENTITY}@${GAME_VERSION}@`;

function getAuthToken(): string | undefined {
  return process.env.TDF_AUTH_TOKEN;
}

export function buildHeaders(requiresAuth = false): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Access-Key": ACCESS_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = getAuthToken();
  if (requiresAuth) {
    if (!token) {
      throw new Error(
        "TDF_AUTH_TOKEN environment variable is required for this endpoint. " +
          "Log in at https://fantasy.letour.fr and extract your JWT token."
      );
    }
    headers["Authorization"] = `Token ${token}`;
  } else if (token) {
    headers["Authorization"] = `Token ${token}`;
  }
  return headers;
}

export async function apiGet(
  path: string,
  requiresAuth = false
): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(requiresAuth),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API error ${response.status} for ${path}: ${text}`);
  }

  return response.json();
}

export async function apiPost(
  path: string,
  body: unknown,
  requiresAuth = false
): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(requiresAuth),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API error ${response.status} for ${path}: ${text}`);
  }

  return response.json();
}
