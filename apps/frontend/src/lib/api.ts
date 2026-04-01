import { clearTokens, getStoredTokens, storeTokens, type TokenPair } from "@/lib/auth";

export function getApiBaseUrl() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    // Dev convenience: keep the app usable even if .env.local isn't loaded for some reason.
    // In production we still hard-fail because the deployment must be configured explicitly.
    if (process.env.NODE_ENV !== "production") {
      return "http://127.0.0.1:8000";
    }
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return base.replace(/\/$/, "");
}

type ApiError = Error & { status?: number; detail?: unknown };

function networkError(baseUrl: string, cause: unknown): ApiError {
  const err: ApiError = new Error(
    `Can’t connect right now (API: ${baseUrl}). Please try again in a moment.`
  );
  err.status = 0;
  err.detail = {
    kind: "network_error",
    message: cause instanceof Error ? cause.message : String(cause)
  };
  return err;
}

async function parseError(res: Response): Promise<ApiError> {
  const status = res.status;
  let detail: unknown = "";
  try {
    detail = await res.json();
  } catch {
    detail = await res.text().catch(() => "");
  }

  // FastAPI commonly returns { detail: "..." } or { detail: [{loc, msg, type}] }
  let message = `Request failed: ${status}`;
  if (detail && typeof detail === "object") {
    const d = detail as { detail?: unknown; message?: unknown };
    const inner = d.detail ?? d.message;
    if (typeof inner === "string" && inner.trim()) message = inner;
    if (Array.isArray(inner) && inner.length) {
      const first = inner[0] as { msg?: unknown };
      if (typeof first?.msg === "string" && first.msg.trim()) message = first.msg;
    }
  } else if (typeof detail === "string" && detail.trim()) {
    message = detail;
  }

  const err: ApiError = new Error(message);
  err.status = status;
  err.detail = detail;
  return err;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean }
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init?.headers ?? {});
  headers.set("Accept", "application/json");

  const auth = init?.auth ?? true;
  if (auth) {
    const tokens = getStoredTokens();
    if (tokens?.access_token) {
      headers.set("Authorization", `Bearer ${tokens.access_token}`);
    }
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    throw networkError(baseUrl, e);
  }
  if (!res.ok) throw await parseError(res);

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function loginWithPassword(email: string, password: string) {
  const baseUrl = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: new URLSearchParams({
        username: email,
        password
      }).toString()
    });
  } catch (e) {
    throw networkError(baseUrl, e);
  }

  if (!res.ok) throw await parseError(res);
  const data = (await res.json()) as TokenPair;
  storeTokens(data);
  return data;
}

export async function registerStudent(body: {
  email: string;
  full_name: string;
  password: string;
}) {
  return apiFetch<{ id: string; email: string; full_name: string; role: string }>(
    "/auth/register",
    {
      method: "POST",
      auth: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}

export async function refreshTokens(): Promise<TokenPair> {
  const baseUrl = getApiBaseUrl();
  const existing = getStoredTokens();
  if (!existing?.refresh_token) {
    throw new Error("No refresh token available");
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: existing.refresh_token })
    });
  } catch (e) {
    throw networkError(baseUrl, e);
  }

  if (!res.ok) {
    clearTokens();
    throw await parseError(res);
  }

  const data = (await res.json()) as TokenPair;
  storeTokens(data);
  return data;
}

export async function apiFetchWithRefresh<T>(
  path: string,
  init?: RequestInit & { auth?: boolean }
): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (e) {
    const err = e as { status?: number };
    if (err?.status !== 401) throw e;

    await refreshTokens();
    return await apiFetch<T>(path, init);
  }
}

export async function logout(): Promise<void> {
  const tokens = getStoredTokens();
  if (!tokens?.refresh_token) {
    clearTokens();
    return;
  }

  try {
    await apiFetch<void>("/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tokens.refresh_token })
    });
  } finally {
    clearTokens();
  }
}
