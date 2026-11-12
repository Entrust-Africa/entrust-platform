import { ResetPasswordView } from "@entrust/account";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordView token={params.token ?? ""} error={params.error} />;
}
