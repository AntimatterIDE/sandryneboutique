"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render(
        container: HTMLElement | string,
        params: { sitekey: string; callback?: (token: string) => void }
      ): string;
      reset(widgetId?: string): void;
      getResponse(widgetId?: string): string;
    };
  }
}

export function HCaptchaField({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.hcaptcha) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    if (!scriptReady || !window.hcaptcha || !containerRef.current || widgetIdRef.current) {
      return;
    }
    widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token) => onTokenRef.current(token),
    });
    return () => {
      if (widgetIdRef.current && window.hcaptcha) {
        try {
          window.hcaptcha.reset(widgetIdRef.current);
        } catch {
          // widget already gone
        }
      }
      widgetIdRef.current = null;
    };
  }, [scriptReady, siteKey]);

  return (
    <>
      <Script
        src="https://js.hcaptcha.com/1/api.js?render=explicit"
        onLoad={() => setScriptReady(true)}
      />
      <div ref={containerRef} className="min-h-20" />
    </>
  );
}
