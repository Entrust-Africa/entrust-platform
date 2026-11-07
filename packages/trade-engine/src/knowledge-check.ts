export interface KnowledgeQuestionOption {
  id: string;
  text: string;
}

export interface KnowledgeQuestionForGrading {
  id: string;
  text: string;
  options: readonly KnowledgeQuestionOption[];
  correct: readonly string[];
  explanation?: string;
  lessonId?: string;
}

export interface QuestionGradingResult {
  questionId: string;
  questionText: string;
  submittedAnswers: string[];
  correctAnswers: string[];
  isCorrect: boolean;
  explanation?: string;
  lessonId?: string;
}

export interface KnowledgeCheckEvaluation {
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  results: QuestionGradingResult[];
}

/**
 * Checks whether the submitted options match the correct answers for a question.
 * Requires exact set equality (no missing answers, no extra answers).
 */
export function isQuestionAnswerCorrect(
  submitted: readonly string[] | undefined | null,
  correct: readonly string[]
): boolean {
  if (!submitted || submitted.length !== correct.length) return false;
  const submittedSet = new Set(submitted);
  if (submittedSet.size !== correct.length) return false;
  return correct.every((c) => submittedSet.has(c));
}

/**
 * Grades a learner's knowledge check attempt against the module question definitions.
 *
 * @param questions The official module questions including their correct answer keys.
 * @param answers The submitted options mapped by question ID.
 * @param passMark The percentage required to pass (default: 80).
 */
export function gradeKnowledgeCheck(
  questions: readonly KnowledgeQuestionForGrading[],
  answers: Readonly<Record<string, readonly string[] | string | undefined | null>>,
  passMark = 80
): KnowledgeCheckEvaluation {
  if (!questions.length) {
    return {
      score: 0,
      passed: false,
      totalQuestions: 0,
      correctCount: 0,
      results: [],
    };
  }

  let correctCount = 0;
  const results: QuestionGradingResult[] = [];

  for (const q of questions) {
    const rawAnswer = answers[q.id];
    const submitted: string[] = Array.isArray(rawAnswer)
      ? rawAnswer.filter((item): item is string => typeof item === "string")
      : typeof rawAnswer === "string"
        ? [rawAnswer]
        : [];

    const isCorrect = isQuestionAnswerCorrect(submitted, q.correct);
    if (isCorrect) correctCount += 1;

    results.push({
      questionId: q.id,
      questionText: q.text,
      submittedAnswers: submitted,
      correctAnswers: [...q.correct],
      isCorrect,
      explanation: q.explanation,
      lessonId: q.lessonId,
    });
  }

  const rawScore = (correctCount / questions.length) * 100;
  // Two-decimal rounded percentage
  const score = Math.round(rawScore * 100) / 100;
  const passed = score >= passMark;

  return {
    score,
    passed,
    totalQuestions: questions.length,
    correctCount,
    results,
  };
}

/**
 * Shuffles the options of each question for retakes without mutating original questions.
 */
export function shuffleQuestionOptions<
  T extends { id: string; text: string; options: readonly KnowledgeQuestionOption[]; [k: string]: any },
>(questions: readonly T[], randomFn: () => number = Math.random): T[] {
  return questions.map((q) => {
    const optionsCopy = [...q.options];
    for (let i = optionsCopy.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      const temp = optionsCopy[i]!;
      optionsCopy[i] = optionsCopy[j]!;
      optionsCopy[j] = temp;
    }
    return {
      ...q,
      options: optionsCopy,
    };
  });
}
