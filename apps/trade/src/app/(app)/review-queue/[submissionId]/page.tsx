import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type { ModuleItemSummary, ModuleSubmissionView } from "@/lib/types";
import { AssessorWorkspace } from "@/components/assessor/assessor-workspace";
import type { LearnerModuleData } from "@/components/modules/module-viewer";

interface SubmissionDetailPageProps {
  params: Promise<{ submissionId: string }>;
}

interface ApiModuleDetail extends ModuleItemSummary {
  content: LearnerModuleData | null;
}

export async function generateMetadata({ params }: SubmissionDetailPageProps) {
  const { submissionId } = await params;
  return { title: `Evaluate Submission ${submissionId.slice(0, 8)}` };
}

export default async function SubmissionDetailPage({ params }: SubmissionDetailPageProps) {
  const { submissionId } = await params;
  const me = await getMe();
  if (!me) redirect("/sign-in");

  // Fetch submission details
  const subRes = await tradeGet<ModuleSubmissionView>(`/module-submissions/${submissionId}`);
  if (subRes.status === 404 || !subRes.data) {
    notFound();
  }

  const submission = subRes.data;

  // Fetch module content with rubric
  const modRes = await tradeGet<ApiModuleDetail>(
    `/modules/${submission.moduleId}?version=${encodeURIComponent(submission.contentVersion)}`
  );

  if (!modRes.data?.content) {
    notFound();
  }

  const moduleData = modRes.data.content;
  const isAdmin = me.staffRole === "admin";

  return (
    <div className="py-2">
      <AssessorWorkspace
        submission={submission}
        module={moduleData}
        isAdmin={isAdmin}
      />
    </div>
  );
}
