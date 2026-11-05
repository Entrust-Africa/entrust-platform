import Link from "next/link";
import { ok } from "@/lib/summit-api";
import { load } from "@/lib/summit-server";
import { ProfileEditor } from "@/components/commerce/profile-editor";
import { PageTitle } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS directory profile" };

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await load(`/summit/commerce/directory/${id}`, (api) => ok(api.v1.summit.commerce.directory.profiles[":id"].$get({ param: { id } })));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/summit/commerce/directory" className="text-sm font-semibold text-brand-700 underline underline-offset-2">
        All profiles
      </Link>
      <PageTitle title={profile.displayName} intro={`Application ${profile.application.number}. Only what is on this page is shown to the public: no score, finding or financial detail is ever copied here.`} />
      <ProfileEditor profile={profile} />
    </div>
  );
}
