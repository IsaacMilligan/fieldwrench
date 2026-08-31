"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function CustomerSignOut() {
  const router = useRouter();
  async function out() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/customer/login");
    router.refresh();
  }
  return (
    <button className="tap tap-red mt-8" type="button" onClick={out}>
      Sign out
    </button>
  );
}
