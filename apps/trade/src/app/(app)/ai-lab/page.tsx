import { redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import { PromptCard } from "@/components/tools/prompt-card";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";

export const metadata = { title: "AI Practice Lab" };

interface LabPrompt {
  module: string;
  moduleTitle: string;
  id: string;
  title: string;
  prompt: string;
  verification: string[];
}

export default async function AiLabPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const prompts = await tradeGet<{ items: LabPrompt[] }>("/ai-prompts");
  const items = prompts.data?.items ?? [];
  const modules = [...new Set(items.map((p) => p.module))];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">AI Practice Lab</h1>
        <p className="mt-1 text-sm text-ink-2">
          Approved prompts for everyday business tasks. Copy one into whichever approved AI tool you use: TRADE doesn't tie you to a provider. Don't paste in passwords or confidential information, and check what comes back before you use it.
        </p>
      </div>
      {modules.map((module) => (
        <section key={module} className="space-y-3" aria-label={module}>
          <h2 className="font-display text-lg font-bold text-ink">
            {module}: {items.find((p) => p.module === module)?.moduleTitle}
          </h2>
          {items
            .filter((p) => p.module === module)
            .map((p) => (
              <PromptCard key={`${p.module}-${p.id}`} title={p.title} prompt={p.prompt} verification={p.verification} />
            ))}
        </section>
      ))}
      {items.length === 0 && <Card className="p-5 text-sm text-ink-2">{prompts.error ?? "No prompts are available yet."}</Card>}
    </div>
  );
}
