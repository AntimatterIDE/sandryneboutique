"use client";

import { useEffect, useRef, useState } from "react";

const SLAT_COUNT = 3;
/** Fallback cleanup if animationend never fires (reduced motion, hidden tab). */
const CLEANUP_FALLBACK_MS = 2600;

/**
 * Full-screen curtain reveal shown once per session.
 *
 * The overlay is server-rendered so it paints with the initial HTML, but it is
 * hidden by default via CSS and only displayed when the inline <head> script
 * sets `data-preloader="show"` on <html> (first visit this session, JS
 * enabled). The gate runs before first paint, so no-JS visitors and returning
 * visitors never see it and there is no flash either way.
 *
 * The staggered slat exit is pure CSS (see globals.css) with a fixed delay
 * from first paint — it never waits on React hydration, so the reveal is just
 * as fast on slow devices. This component only records the session flag and
 * removes the overlay from the DOM once the exit animation finishes.
 */
export default function CurtainPreloader() {
  const [done, setDone] = useState(false);
  const lastSlatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const showing =
      document.documentElement.getAttribute("data-preloader") === "show";

    const finish = () => {
      document.documentElement.removeAttribute("data-preloader");
      setDone(true);
    };

    if (!showing) {
      // Overlay is display:none (returning visitor); unmount it next tick.
      const timer = setTimeout(finish, 0);
      return () => clearTimeout(timer);
    }

    try {
      sessionStorage.setItem("sandryne_seen", "1");
    } catch {
      // Storage unavailable (private mode etc.) — curtain still exits normally.
    }

    const lastSlat = lastSlatRef.current;
    lastSlat?.addEventListener("animationend", finish, { once: true });
    // If hydration happened after the CSS animation already completed,
    // animationend never fires for us — the timer covers that case.
    const fallback = setTimeout(finish, CLEANUP_FALLBACK_MS);

    return () => {
      lastSlat?.removeEventListener("animationend", finish);
      clearTimeout(fallback);
    };
  }, []);

  if (done) return null;

  return (
    <div
      id="sandryne-preloader"
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] hidden"
    >
      {Array.from({ length: SLAT_COUNT }, (_, i) => (
        <div
          key={i}
          ref={i === SLAT_COUNT - 1 ? lastSlatRef : undefined}
          className="preloader-slat absolute inset-y-0 bg-foreground will-change-transform"
          style={{
            left: `${(i / SLAT_COUNT) * 100}%`,
            // Slight overlap so no hairline gaps show between slats.
            width: `calc(${100 / SLAT_COUNT}% + 1px)`,
            animationDelay: `${0.65 + i * 0.08}s`,
          }}
        />
      ))}

      <div className="absolute inset-0 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/sandryne-white.png"
          alt=""
          width={1303}
          height={419}
          className="preloader-wordmark h-16 w-auto sm:h-20"
        />
      </div>
    </div>
  );
}
