"use client";

// Small client toggle that collapses the .uff-web sidebar to an icon rail.
//
// State persistence: writes/reads `uff_sidebar_collapsed` in localStorage
// so the choice survives navigation and page reloads. Applies the
// `.sidebar-collapsed` class to the nearest `.uff-web` ancestor on mount
// so the CSS rules (in globals.css) take over the layout.
//
// To prevent a flash of expanded sidebar when the page loads collapsed,
// we synchronously apply the class from localStorage in a useLayoutEffect
// during the very first render, before paint.

import { useEffect, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "uff_sidebar_collapsed";

// SSR-safe layout effect — useLayoutEffect on the client, useEffect on the
// server so React doesn't warn during hydration.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function SidebarCollapseToggle() {
  const [collapsed, setCollapsed] = useState(false);

  // First-paint sync — read localStorage and apply the class before the
  // browser composites, to avoid a flash of expanded layout.
  useIsoLayoutEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      const start = v === "1";
      setCollapsed(start);
      const root = document.querySelector(".uff-web");
      if (root) root.classList.toggle("sidebar-collapsed", start);
    } catch {
      // localStorage unavailable (private mode, etc.) — just leave expanded.
    }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    const root = document.querySelector(".uff-web");
    if (root) root.classList.toggle("sidebar-collapsed", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="sidebar-toggle"
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-pressed={collapsed}
    >
      {/* Chevron rotates 180° when collapsed so the affordance matches the
          direction the sidebar will expand toward. */}
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: collapsed ? "rotate(180deg)" : "none",
          transition: "transform 0.18s",
        }}
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );
}
