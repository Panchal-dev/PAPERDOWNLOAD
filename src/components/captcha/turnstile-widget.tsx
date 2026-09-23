// Cloudflare Turnstile widget: rendered only when verification is needed.
// Loads the official script once, mounts one widget, and forwards the token.

"use client";

import { useEffect, useRef } from "react";
import { CAPTCHA_CONFIG } from "@/config/captcha.config";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_ID = "cf-turnstile-script";

export function TurnstileWidget({
  onVerified,
  verifying,
  error,
}: {
  onVerified: (token: string) => void;
  verifying: boolean;
  error: string | null;
}) {
  const siteKey = CAPTCHA_CONFIG.siteKey;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callbackRef = useRef(onVerified);

  // Keeps the latest callback without re-rendering the widget.
  // Ref writes belong in effects, never in the render body.
  useEffect(() => {
    callbackRef.current = onVerified;
  }, [onVerified]);

  // Renders one widget for this container's lifetime.
  // StrictMode mounts, unmounts, then remounts: the cleanup removes the
  // widget so the second mount renders fresh instead of resetting a
  // stale id (which logs "Cannot find Widget" in the console).
  function renderWidget(): void {
    if (!containerRef.current || !window.turnstile) return;
    if (widgetId.current) {
      window.turnstile.reset(widgetId.current);
      return;
    }
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => callbackRef.current(token),
      "expired-callback": () => {
        if (widgetId.current) window.turnstile?.reset(widgetId.current);
      },
    });
  }

  // Loads the Turnstile script once per page, then renders the widget.
  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    function renderWhenReady(): void {
      if (!cancelled) renderWidget();
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (window.turnstile) {
      renderWhenReady();
    } else if (existing) {
      existing.addEventListener("load", renderWhenReady, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = `${CAPTCHA_CONFIG.scriptUrl}?onload=onTurnstileLoad&render=explicit`;
      script.async = true;
      script.defer = true;
      window.onTurnstileLoad = renderWhenReady;
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      // Tears down the widget tied to the outgoing DOM node.
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // Already gone — a fresh render will replace it.
        }
        widgetId.current = null;
      }
    };
    // renderWidget reads only refs + the site key, so it stays out of deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  // Misconfiguration guard: verification cannot run without a site key.
  if (!siteKey) {
    return (
      <Alert tone="warning">
        Bot protection is not configured. Downloads proceed without
        verification in this environment.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--gtu-border)] bg-[var(--gtu-surface)] px-4 py-3">
      <p className="text-[13px] font-semibold">
        Quick human check
        <span className="ml-2 font-normal text-[var(--gtu-text-muted)]">
          One-time — you won&apos;t see this again for a while.
        </span>
      </p>
      <div ref={containerRef} aria-label="Cloudflare security check" />
      {verifying && <Skeleton className="h-4 w-40" label="Verifying" />}
      {error && (
        <p role="alert" className="text-xs text-[var(--gtu-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
