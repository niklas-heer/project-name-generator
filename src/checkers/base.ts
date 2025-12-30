import { USER_AGENT, DEFAULT_TIMEOUT, type CheckResult } from "../types";

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        ...options.headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createErrorResult(
  platform: string,
  name: string,
  error: string
): CheckResult {
  return {
    name,
    platform,
    available: false,
    error,
  };
}
