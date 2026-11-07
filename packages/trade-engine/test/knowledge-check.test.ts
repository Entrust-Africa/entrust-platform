import { describe, expect, it } from "vitest";
import {
  gradeKnowledgeCheck,
  isQuestionAnswerCorrect,
  shuffleQuestionOptions,
} from "../src/knowledge-check";
import type { KnowledgeQuestionForGrading } from "../src/knowledge-check";

const SAMPLE_QUESTIONS: KnowledgeQuestionForGrading[] = [
  {
    id: "q1",
    text: "Which of the following is a key component of export readiness?",
    options: [
      { id: "a", text: "Having a domestic monopoly" },
      { id: "b", text: "Production capacity and quality compliance" },
      { id: "c", text: "Avoiding digital payments" },
    ],
    correct: ["b"],
    explanation: "Production capacity and meeting destination standards are essential.",
    lessonId: "lesson-1",
  },
  {
    id: "q2",
    text: "Select ALL documents typically required for customs clearance (select 2):",
    options: [
      { id: "a", text: "Commercial Invoice" },
      { id: "b", text: "Bill of Lading / Airway Bill" },
      { id: "c", text: "Personal social media credentials" },
    ],
    correct: ["a", "b"],
    explanation: "Commercial invoice and transport documents are mandatory trade documents.",
    lessonId: "lesson-2",
  },
  {
    id: "q3",
    text: "What does FOB stand for in Incoterms?",
    options: [
      { id: "a", text: "Free On Board" },
      { id: "b", text: "Freight Paid Beyond" },
      { id: "c", text: "Forward Order Booking" },
    ],
    correct: ["a"],
    explanation: "FOB means Free On Board.",
    lessonId: "lesson-3",
  },
  {
    id: "q4",
    text: "What is an irrevocable Letter of Credit?",
    options: [
      { id: "a", text: "A payment guarantee that cannot be amended without all parties agreeing" },
      { id: "b", text: "A verbal promise from the buyer" },
    ],
    correct: ["a"],
    explanation: "An irrevocable LC guarantees payment once compliant documents are presented.",
    lessonId: "lesson-4",
  },
  {
    id: "q5",
    text: "Which payment term presents the lowest risk to the exporter?",
    options: [
      { id: "a", text: "Open Account" },
      { id: "b", text: "Cash in Advance" },
      { id: "c", text: "Net 90 Days" },
    ],
    correct: ["b"],
    explanation: "Cash in Advance guarantees payment before goods are manufactured or dispatched.",
    lessonId: "lesson-5",
  },
];

describe("Knowledge Check Grading Engine (#63)", () => {
  it("grades single-choice questions correctly", () => {
    expect(isQuestionAnswerCorrect(["b"], ["b"])).toBe(true);
    expect(isQuestionAnswerCorrect(["a"], ["b"])).toBe(false);
    expect(isQuestionAnswerCorrect([], ["b"])).toBe(false);
    expect(isQuestionAnswerCorrect(undefined, ["b"])).toBe(false);
  });

  it("grades multiple-choice questions correctly with exact set match", () => {
    expect(isQuestionAnswerCorrect(["a", "b"], ["a", "b"])).toBe(true);
    expect(isQuestionAnswerCorrect(["b", "a"], ["a", "b"])).toBe(true);
    // Missing one
    expect(isQuestionAnswerCorrect(["a"], ["a", "b"])).toBe(false);
    // Extra choice
    expect(isQuestionAnswerCorrect(["a", "b", "c"], ["a", "b"])).toBe(false);
  });

  it("passes at exactly 80% and fails at 79% or below (M01 AT-08, M03 AT-07)", () => {
    // 4 out of 5 = 80.00% -> PASS
    const passAnswers = {
      q1: ["b"],
      q2: ["a", "b"],
      q3: ["a"],
      q4: ["a"],
      q5: ["wrong"],
    };
    const passResult = gradeKnowledgeCheck(SAMPLE_QUESTIONS, passAnswers, 80);
    expect(passResult.correctCount).toBe(4);
    expect(passResult.totalQuestions).toBe(5);
    expect(passResult.score).toBe(80);
    expect(passResult.passed).toBe(true);

    // 3 out of 5 = 60.00% -> FAIL
    const failAnswers = {
      q1: ["b"],
      q2: ["a", "b"],
      q3: ["a"],
      q4: ["wrong"],
      q5: ["wrong"],
    };
    const failResult = gradeKnowledgeCheck(SAMPLE_QUESTIONS, failAnswers, 80);
    expect(failResult.correctCount).toBe(3);
    expect(failResult.score).toBe(60);
    expect(failResult.passed).toBe(false);

    // Explicit 79% vs 80% boundary test:
    // With 100 questions, 80 is 80%, 79 is 79%.
    const hundredQuestions: KnowledgeQuestionForGrading[] = Array.from({ length: 100 }, (_, i) => ({
      id: `q${i}`,
      text: `Question ${i}`,
      options: [{ id: "opt1", text: "1" }],
      correct: ["opt1"],
    }));

    const answers79: Record<string, string[]> = {};
    for (let i = 0; i < 79; i++) answers79[`q${i}`] = ["opt1"];
    expect(gradeKnowledgeCheck(hundredQuestions, answers79, 80).passed).toBe(false);
    expect(gradeKnowledgeCheck(hundredQuestions, answers79, 80).score).toBe(79);

    const answers80: Record<string, string[]> = { ...answers79, q79: ["opt1"] };
    expect(gradeKnowledgeCheck(hundredQuestions, answers80, 80).passed).toBe(true);
    expect(gradeKnowledgeCheck(hundredQuestions, answers80, 80).score).toBe(80);
  });

  it("returns question-by-question breakdown with explanations and lesson links", () => {
    const answers = {
      q1: ["b"],
      q2: ["a"], // incomplete
    };
    const evaluation = gradeKnowledgeCheck(SAMPLE_QUESTIONS, answers, 80);
    expect(evaluation.results).toHaveLength(5);

    const q1Res = evaluation.results.find((r) => r.questionId === "q1")!;
    expect(q1Res.isCorrect).toBe(true);
    expect(q1Res.submittedAnswers).toEqual(["b"]);
    expect(q1Res.correctAnswers).toEqual(["b"]);
    expect(q1Res.explanation).toBe("Production capacity and meeting destination standards are essential.");
    expect(q1Res.lessonId).toBe("lesson-1");

    const q2Res = evaluation.results.find((r) => r.questionId === "q2")!;
    expect(q2Res.isCorrect).toBe(false);
    expect(q2Res.submittedAnswers).toEqual(["a"]);
    expect(q2Res.correctAnswers).toEqual(["a", "b"]);
  });

  it("shuffles question options without mutating question IDs or option IDs", () => {
    const questions = [
      {
        id: "q1",
        text: "Sample",
        options: [
          { id: "a", text: "Alpha" },
          { id: "b", text: "Beta" },
          { id: "c", text: "Gamma" },
          { id: "d", text: "Delta" },
        ],
      },
    ];

    // Seeded reverse mock random
    let call = 0;
    const mockRandom = () => {
      call++;
      return (call % 3) / 3;
    };

    const shuffled = shuffleQuestionOptions(questions, mockRandom);
    expect(shuffled[0]!.id).toBe("q1");
    expect(shuffled[0]!.options).toHaveLength(4);
    // Original array intact
    expect(questions[0]!.options[0]!.id).toBe("a");
    // All original options present in shuffled
    const optionIds = shuffled[0]!.options.map((o) => o.id).sort();
    expect(optionIds).toEqual(["a", "b", "c", "d"]);
  });
});
