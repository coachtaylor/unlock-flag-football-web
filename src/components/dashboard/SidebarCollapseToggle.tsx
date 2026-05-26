"use client";

// Sidebar collapse / expand control. Rendered at the TOP of each sidebar
// (TeamSidebar / LeagueSidebar / UserSidebar) inside `.sidebar-head`, so
// it reads as window-chrome — not as nav. The icon is a panel-side
// glyph (rectangle + divider) rather than a chevron, so it doesn't
// compete with the "Back to league / All workspaces" back-arrow links.
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
import { Icon } from "@/components/uff/icons";

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

  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <button
      type="button"
      onClick={toggle}
      className="sidebar-toggle"
      title={label}
      aria-label={label}
      aria-pressed={collapsed}
    >
      <Icon.panelLeft size={16} />
    </button>
  );
}
