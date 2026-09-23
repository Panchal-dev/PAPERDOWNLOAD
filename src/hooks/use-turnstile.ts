// Tracks Cloudflare Turnstile verification for the current session.
// The server owns the truth (HttpOnly cookie); this hook mirrors it for UX.

"use client";

import { useCallback, useEffect, useState } from "react";
import { CAPTCHA_CONFIG } from "@/config/captcha.config";
import {
  fetchVerificationStatus,
  submitTurnstileToken,
} from "@/services/captcha-service";

const SITE_KEY = CAPTCHA_CONFIG.siteKey;

export function useTurnstile() {
  // Null = not checked yet; keeps the UI from flashing the widget early.
  const [verified, setVerified] = useState<boolean | null>(
    SITE_KEY.length === 0 ? true : null,
  );
  const [checking, setChecking] = useState<boolean>(SITE_KEY.length > 0);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Asks the server whether a valid verification cookie already exists.
  const refresh = useCallback(async () => {
    if (SITE_KEY.length === 0) {
      setVerified(true);
      setChecking(false);
      return true;
    }
    setChecking(true);
    const ok = await fetchVerificationStatus();
    setVerified(ok);
    setChecking(false);
    return ok;
  }, []);

  useEffect(() => {
    if (SITE_KEY.length === 0) return;
    let cancelled = false;
    // One-time session check; state lands in the promise callback,
    // which is the sanctioned effect-to-state handoff for async data.
    fetchVerificationStatus().then((ok) => {
      if (cancelled) return;
      setVerified(ok);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sends the widget token to the server; the cookie is set on success.
  const verify = useCallback(async (token: string): Promise<boolean> => {
    setVerifying(true);
    setError(null);
    try {
      const ok = await submitTurnstileToken(token);
      setVerified(ok);
      if (!ok) setError("Verification failed. Please try again.");
      return ok;
    } catch {
      setError("Verification failed. Check your connection and retry.");
      return false;
    } finally {
      setVerifying(false);
    }
  }, []);

  // Lets the download flow force the widget open after a 403 response.
  const requireVerification = useCallback(() => {
    setVerified(false);
  }, []);

  return {
    enabled: SITE_KEY.length > 0,
    verified: verified === true,
    unknown: verified === null,
    checking,
    verifying,
    error,
    verify,
    refresh,
    requireVerification,
  };
}
