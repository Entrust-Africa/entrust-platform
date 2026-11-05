"use client";

import { useRouter } from "next/navigation";
import type { SummitApplication } from "@/lib/summit";
import { DocumentsPanel } from "./documents-panel";

/** The documents panel on the status page, for when only documents can be added. The page reloads after each change. */
export function HubDocuments({ application }: { application: SummitApplication }) {
  const router = useRouter();
  return <DocumentsPanel application={application} onChange={() => router.refresh()} heading={false} />;
}
