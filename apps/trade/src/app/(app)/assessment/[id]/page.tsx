import { AssessmentDetailPage } from "@/components/assessment/assessment-page";

export const metadata = { title: "Placement assessment" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AssessmentDetailPage kind="placement" id={(await params).id} />;
}
