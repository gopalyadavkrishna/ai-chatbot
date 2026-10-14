export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function requestApi<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(getErrorDetail(payload), response.status);
  }
  return payload as T;
}

export async function uploadFile<T>(path: string, token: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  return requestApi<T>(path, token, { method: "POST", body: formData });
}

export function getErrorDetail(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "detail" in payload &&
    typeof payload.detail === "string"
  ) {
    return payload.detail;
  }
  return "Something went wrong. Please try again.";
}

export function getMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return "Could not reach the API. Make sure the backend is running.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
