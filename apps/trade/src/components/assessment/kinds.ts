export type AssessmentKind = "diagnostic" | "placement" | "exit";

export interface KindInfo {
  kind: AssessmentKind;
  /** The address of its pages: /diagnostic and /assessment. */
  route: string;
  title: string;
  intro: string[];
  startButton: string;
  submit: { button: string; confirmTitle: string; confirmBody: string; confirmButton: string };
}

export const KINDS: Record<AssessmentKind, KindInfo> = {
  diagnostic: {
    kind: "diagnostic",
    route: "/diagnostic",
    title: "Onboarding diagnostic",
    intro: [
      "Tell us about your business so Entrust can place you on the right learning path before the training starts.",
      "Questions that don't apply to you stay hidden, so most businesses answer far fewer than the full list. Your answers save as you go. You can stop at any time and come back to the same place.",
    ],
    startButton: "Start the diagnostic",
    submit: {
      button: "Review and submit",
      confirmTitle: "Submit your diagnostic?",
      confirmBody: "You won't be able to change your answers after this. You will see which learning path you start on.",
      confirmButton: "Submit diagnostic",
    },
  },
  placement: {
    kind: "placement",
    route: "/assessment",
    title: "Placement assessment",
    intro: [
      "A check of where your business stands today, in seven short sections. It decides which modules you start with.",
      "Be honest. It is there to plan your learning, not to judge you. Your answers save as you go, so you can stop and come back.",
    ],
    startButton: "Start the assessment",
    submit: {
      button: "Review and submit",
      confirmTitle: "Submit your assessment?",
      confirmBody: "You won't be able to change your answers after this. If you want to answer again later, ask your facilitator.",
      confirmButton: "Submit assessment",
    },
  },
  exit: {
    kind: "exit",
    route: "/assessment/exit",
    title: "Exit assessment",
    intro: [
      "Now that you have completed your modules, answer sections B to G again to measure how much your capabilities have grown.",
      "Your answers generate your comparative capability report against your placement baseline. It does not alter your learning plan.",
    ],
    startButton: "Start the exit assessment",
    submit: {
      button: "Review and submit",
      confirmTitle: "Submit your exit assessment?",
      confirmBody: "You won't be able to change your answers after this. Your comparative report will be generated immediately.",
      confirmButton: "Submit exit assessment",
    },
  },
};

export const isKind = (value: string): value is AssessmentKind => value === "diagnostic" || value === "placement" || value === "exit";

/**
 * The diagnostic offers no "I don't know" box: where a person doesn't know, they say so in their own words. The three
 * kinds of answer that can't take words, a number, an amount and a date, keep it, so nobody is stuck on one.
 */
export const diagnosticAllowsNotKnown = (question: { type: string }): boolean => question.type === "number" || question.type === "money" || question.type === "date";
