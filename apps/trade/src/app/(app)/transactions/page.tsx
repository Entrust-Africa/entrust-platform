import { redirect } from "next/navigation";
import { TransactionWorkspace, type TransactionData } from "@/components/transactions/transaction-workspace";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";

export const metadata = { title: "Export transactions" };

export default async function TransactionsPage({ searchParams }: { searchParams?: Promise<{ organizationId?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const { organizationId } = (await searchParams) ?? {};
  const activeOrg =
    (organizationId ? me.organizations?.find((o) => o.id === organizationId) : null) ??
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ??
    me.organizations?.[0];
  if (!activeOrg) redirect("/");
  const data = await tradeGet<TransactionData>(`/transactions?organizationId=${encodeURIComponent(activeOrg.id)}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Export transactions</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Keep one record for each export you plan or run, from the buyer's enquiry to closeout. This is your own record: it doesn't certify compliance or approve a shipment, so verify requirements with the relevant authorities.
        </p>
      </div>
      {data.data ? (
        <TransactionWorkspace initial={data.data} organizationId={activeOrg.id} readOnly={me.staffRole === "reviewer"} />
      ) : (
        <p className="text-sm text-ink-2">{data.error ?? "Your transactions aren't available yet."}</p>
      )}
    </div>
  );
}
