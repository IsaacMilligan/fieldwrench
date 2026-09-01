"use client";

import { useState } from "react";

export function ThemeToggle({ value }: { value: "light" | "dark" }) {
  const [theme, setTheme] = useState<"light" | "dark">(value === "dark" ? "dark" : "light");

  function pick(next: "light" | "dark") {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    const fd = new FormData();
    fd.set("_op", "save_theme");
    fd.set("theme", next);
    void fetch("/api/shop", { method: "POST", body: fd, redirect: "manual" });
  }

  return (
    <div className="mt-4">
      <p className="lbl">Theme</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          className={`tap min-h-14 ${theme === "light" ? "" : "tap-steel"}`}
          type="button"
          onClick={() => pick("light")}
        >
          Light
        </button>
        <button
          className={`tap min-h-14 ${theme === "dark" ? "" : "tap-steel"}`}
          type="button"
          onClick={() => pick("dark")}
        >
          Dark
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Applies to the shop, public booking, and customer login.</p>
    </div>
  );
}
