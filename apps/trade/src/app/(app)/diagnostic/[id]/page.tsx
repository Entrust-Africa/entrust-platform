import { AssessmentDetailPage } from "@/components/assessment/assessment-page";

export const metadata = { title: "Onboarding diagnostic" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AssessmentDetailPage kind="diagnostic" id={(await params).id} />;
}
