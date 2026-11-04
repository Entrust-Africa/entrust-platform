"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "./auth-client";

export function useSignOut(defaultRedirect: string = "/sign-in") {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function signOut(onSuccess?: () => void, redirectTo: string = defaultRedirect) {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const res = await authClient.signOut();
      if (res?.error) {
        setSignOutError(res.error.message ?? "Could not sign out. Please try again.");
        return false;
      }
      onSuccess?.();
      router.replace(redirectTo);
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
