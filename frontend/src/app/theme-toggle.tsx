"use client";

import { useEffect, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { applyTheme, type Theme } from "@/lib/theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const nextTheme: Theme = window.localStorage.getItem("customai-theme") === "light" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("customai-theme", nextTheme);
    applyTheme(nextTheme);
  }

  const isDark = theme === "dark";
  return (
    <button
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-semibold text-[var(--muted)] shadow-sm transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[#A78BFA]"
      onClick={toggleTheme}
      type="button"
    >
      <span aria-hidden="true">{isDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}</span>
      <span className="ml-2 hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
