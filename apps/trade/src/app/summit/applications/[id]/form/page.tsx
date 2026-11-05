import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { ApplicationForm } from "@/components/summit/application-form";

export const metadata = { title: "Summit application form" };

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { section } = await searchParams;
  const path = `/summit/applications/${id}/form`;
  await requireUser(path);
  const { application, form } = await load(path, async (api) => {
    const application = await ok(api.v1.summit.applications[":id"].$get({ param: { id } }));
    const form = await ok(api.v1.summit.forms[":version"].$get({ param: { version: application.templateVersion } }));
    return { application, form };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <ApplicationForm initial={application} form={form} initialSection={section} />
    </div>
  );
}
