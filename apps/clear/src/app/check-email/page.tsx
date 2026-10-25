import { CheckEmail } from "./check-email";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <CheckEmail email={email ?? ""} />;
}
