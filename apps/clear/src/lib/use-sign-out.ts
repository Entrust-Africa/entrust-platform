"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function useSignOut() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function signOut(onSuccess?: () => void) {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const res = await authClient.signOut();
      if (res?.error) {
        setSignOutError(res.error.message ?? "Could not sign out. Please try again.");
        return false;
      }
      onSuccess?.();
      router.replace("/sign-in");
      router.refresh();
      return true;
    } catch {
      setSignOutError("Network error while signing out. Please try again.");
      return false;
    } finally {
      setSigningOut(false);
    }
  }

  return { signOut, signingOut, signOutError };
}
