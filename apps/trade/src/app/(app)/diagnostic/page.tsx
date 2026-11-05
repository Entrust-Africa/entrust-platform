import { AssessmentIndexPage } from "@/components/assessment/assessment-page";

export const metadata = { title: "Onboarding diagnostic" };

export default function Page() {
  return <AssessmentIndexPage kind="diagnostic" />;
}
