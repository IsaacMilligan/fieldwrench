"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";

const LINE_OPS = new Set([
  "add_part",
  "update_part",
  "delete_part",
  "add_oil_part",
  "add_labor",
  "update_labor",
  "delete_labor",
  "add_job_discount",
  "delete_job_discount",
  "upload_photo",
  "delete_photo",
]);

export function KeepJobScroll({ children }: { children: ReactNode }) {
  const router = useRouter();

  async function onSubmit(e: FormEvent<HTMLDivElement>) {
    const form = e.target as HTMLFormElement;
    if (form.tagName !== "FORM") return;
    const action = form.getAttribute("action") || "";
    if (!action.startsWith("/api/shop")) return;
    const fd = new FormData(form);
    const op = String(fd.get("_op") || "");
    if (!LINE_OPS.has(op)) return;
    e.preventDefault();
    const y = window.scrollY;
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        body: fd,
        headers: { "x-fw-ajax": "1" },
        redirect: "manual",
      });
      if (!res.ok && res.status !== 204 && res.status !== 303 && res.status !== 302 && res.status !== 0) {
        form.submit();
        return;
      }
    } catch {
      form.submit();
      return;
    }
    router.refresh();
    const restore = () => window.scrollTo(0, y);
    restore();
    requestAnimationFrame(restore);
    window.setTimeout(restore, 50);
    window.setTimeout(restore, 200);
    window.setTimeout(restore, 500);
  }

  return <div onSubmit={onSubmit}>{children}</div>;
}
