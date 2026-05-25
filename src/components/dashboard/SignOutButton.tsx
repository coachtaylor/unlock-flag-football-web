"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { type ReactNode } from "react";

type Props = {
  className?: string;
  children: ReactNode;
  style?: React.CSSProperties;
};

export default function SignOutButton({ className, children, style }: Props) {
  const router = useRouter();
  async function handle() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={handle} className={className} style={style}>
      {children}
    </button>
  );
}
