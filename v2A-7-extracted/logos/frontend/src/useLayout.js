/**
 * useLayout.js — Responsive layout detection
 *
 * Layout types:
 *   "mobile"  — portrait phones  (width < 480px)
 *   "tablet"  — tablets/square   (480px–900px)
 *   "desktop" — landscape/wide   (width > 900px)
 *
 * isElectron — true when running in Electron desktop app
 */

import { useState, useEffect } from "react";

export function useLayout() {
  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  function classify(w, h) {
    if (isElectron) return "desktop";
    if (w < 480) return "mobile";
    if (w < 900 || (w < 1100 && h > w)) return "tablet";
    return "desktop";
  }

  const [layout, setLayout] = useState(() =>
    classify(window.innerWidth, window.innerHeight)
  );

  useEffect(() => {
    function update() {
      setLayout(classify(window.innerWidth, window.innerHeight));
    }
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return {
    layout,
    isMobile:  layout === "mobile",
    isTablet:  layout === "tablet",
    isDesktop: layout === "desktop",
    isElectron,
    isNarrow:  layout !== "desktop",
  };
}
