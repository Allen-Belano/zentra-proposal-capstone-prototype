import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

let fadeTimer: ReturnType<typeof setTimeout> | undefined;

function apply(theme: Theme) {
  const root = document.documentElement;
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  if (root.classList.contains("dark") === dark) return;
  // Crossfade colors for a moment so switching themes feels smooth rather than a hard cut.
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("theme-transition");
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => root.classList.remove("theme-transition"), 400);
  }
  root.classList.toggle("dark", dark);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem("zentra-theme") as Theme) || "system"; } catch { return "system"; }
  });
  useEffect(() => {
    apply(theme);
    try { localStorage.setItem("zentra-theme", theme); } catch { /* storage unavailable */ }
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);
  return { theme, setTheme };
}
