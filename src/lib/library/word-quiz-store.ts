import type { QuizQuestion } from "@/lib/library/word-quiz-parser";

export type PrivateQuiz = {
  id: string;
  title: string;
  questions: QuizQuestion[];
  created: string;
  sourceName: string;
  /** đã gửi owner duyệt */
  submitted?: boolean;
};

function key(user: string): string {
  return `library:word-quiz:${user.toLowerCase()}`;
}

export function loadPrivateQuizzes(user: string): PrivateQuiz[] {
  try {
    const raw = localStorage.getItem(key(user));
    if (!raw) return [];
    const list = JSON.parse(raw) as PrivateQuiz[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function savePrivateQuizzes(user: string, list: PrivateQuiz[]): void {
  try {
    localStorage.setItem(key(user), JSON.stringify(list));
  } catch {
    /* quota */
  }
}

export function upsertPrivateQuiz(user: string, quiz: PrivateQuiz): void {
  const list = loadPrivateQuizzes(user).filter((q) => q.id !== quiz.id);
  list.unshift(quiz);
  savePrivateQuizzes(user, list.slice(0, 40));
}

export function removePrivateQuiz(user: string, id: string): void {
  savePrivateQuizzes(
    user,
    loadPrivateQuizzes(user).filter((q) => q.id !== id),
  );
}
