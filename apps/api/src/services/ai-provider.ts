import Anthropic from "@anthropic-ai/sdk";

// The one place that talks to the AI provider (#76). It runs only on the server, so the browser never holds the key.

const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16000;
// Dollars per million tokens for the model above. The month's cost cap is counted from these.
const INPUT_PRICE = 4;
const OUTPUT_PRICE = 20;

export interface AiRequest {
  system: string;
  user: string;
}

export interface AiResult {
  text: string;
  /** The provider declined to answer. */
  refused: boolean;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type AiProvider = (request: AiRequest) => Promise<AiResult>;

/** The assistant is switched on by setting the key. */
export const aiAssistantEnabled = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

export const aiCostUsd = (inputTokens: number, outputTokens: number): number => (inputTokens * INPUT_PRICE + outputTokens * OUTPUT_PRICE) / 1_000_000;

export const callClaude: AiProvider = async ({ system, user }) => {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000 });
  const response = await client.beta.messages.create({
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: "medium" },
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("\n").trim();
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  return { text, refused: response.stop_reason === "refusal", model: response.model, inputTokens, outputTokens, costUsd: aiCostUsd(inputTokens, outputTokens) };
};
