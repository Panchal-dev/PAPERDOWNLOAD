// Client-side captcha service: status checks and token verification.
// The widget itself only produces tokens; this module talks to the API.

import { API_CONFIG } from "@/config/api.config";

export const VERIFICATION_ERROR_CODE = "verification_required";

// Asks the server whether the HttpOnly verification cookie is still valid.
export async function fetchVerificationStatus(): Promise<boolean> {
  try {
    const response = await fetch(API_CONFIG.verifyPath, {
      method: "GET",
      credentials: "same-origin",
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { verified?: boolean };
    return body.verified === true;
  } catch {
    return false;
  }
}

// Sends a fresh Turnstile token for server-side validation + cookie issue.
export async function submitTurnstileToken(token: string): Promise<boolean> {
  const response = await fetch(API_CONFIG.verifyPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ token }),
  });
  if (!response.ok) return false;
  const body = (await response.json()) as { verified?: boolean };
  return body.verified === true;
}
