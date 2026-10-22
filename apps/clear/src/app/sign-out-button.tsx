"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@entrust/auth/client";
import { Button } from "@entrust/ui";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
