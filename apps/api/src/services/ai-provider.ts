// The one place that talks to the AI provider (#76). It runs only on the server, so the browser never holds the key.
// The provider is Morph (OpenAI-compatible chat completions); the key is MORPH_API_KEY and never leaves the server.

const DEFAULT_BASE_URL = "https://api.morphllm.com/v1";
const DEFAULT_MODEL = "morph-dsv41flash";
const MAX_TOKENS = 16000;
const TIMEOUT_MS = 90_000;
// Dollars per million tokens for morph-dsv41flash (Morph's price list, 12 Nov 2026). The month's cost cap is counted
// from these, so change them with the model if MORPH_MODEL points elsewhere.
const INPUT_PRICE = 0.12;
const OUTPUT_PRICE = 0.8;

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
export const aiAssistantEnabled = (): boolean => Boolean(process.env.MORPH_API_KEY);

export const aiCostUsd = (inputTokens: number, outputTokens: number): number => (inputTokens * INPUT_PRICE + outputTokens * OUTPUT_PRICE) / 1_000_000;

interface ChatCompletion {
  model?: string;
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// Kept under its old name so the callers and tests that replace it don't change.
export const callClaude: AiProvider = async ({ system, user }) => {
  const baseUrl = (process.env.MORPH_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.MORPH_MODEL || DEFAULT_MODEL;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.MORPH_API_KEY}` },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`AI provider returned ${res.status}`);
  const response = (await res.json()) as ChatCompletion;
  const choice = response.choices?.[0];
  const text = (choice?.message?.content ?? "").trim();
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const refused = Boolean(choice?.message?.refusal) || choice?.finish_reason === "content_filter";
  return { text, refused, model: response.model ?? model, inputTokens, outputTokens, costUsd: aiCostUsd(inputTokens, outputTokens) };
};
