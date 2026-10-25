import { ResetPassword } from "./reset-password";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const params = await searchParams;
  return <ResetPassword token={params.token ?? ""} error={params.error} />;
}
