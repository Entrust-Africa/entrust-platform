// The ticket tiers a participant can register for. Prices and what each pass includes are marketing copy and live
// on the landing page (apps/summit/src/lib/content.ts); the platform only needs to know which passes exist, so a
// registration can name one.

export const PARTICIPANT_PASSES = [
  { id: "diaspora", name: "Diaspora Pass" },
  { id: "investor", name: "Investor Pass" },
  { id: "delegation", name: "Delegation Pass" },
] as const;

export type ParticipantPassId = (typeof PARTICIPANT_PASSES)[number]["id"];

export const PARTICIPANT_PASS_IDS = PARTICIPANT_PASSES.map((p) => p.id) as [ParticipantPassId, ...ParticipantPassId[]];
