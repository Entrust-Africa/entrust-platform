import { CheckInDesk } from "@/components/commerce/check-in-desk";
import { PageTitle } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS check-in" };

export default function CheckInPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageTitle title="Check-in" intro="Scan a delegate's badge, or type its reference. A badge is valid once the payment is verified." />
      <CheckInDesk />
    </div>
  );
}
