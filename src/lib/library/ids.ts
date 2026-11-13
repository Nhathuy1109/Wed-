export const OWNER_USERNAME = "Nhuy110927";

export const MAX_FILE_BYTES = 3 * 1024 * 1024;

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

export const SECTIONS = [
  {
    id: "theory",
    label: "Lý thuyết",
    hint: "PDF, Word, ảnh và các file để xem hoặc tải về.",
    accept: undefined,
  },
  {
    id: "quizfile",
    label: "File trắc nghiệm",
    hint: "File đề để mọi người tải về.",
    accept: undefined,
  },
  {
    id: "practice",
    label: "Thực hành trắc nghiệm",
    hint: "File .html để làm bài ngay trên trang.",
    accept: ".html,.htm",
  },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export type FileMeta = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  created: string;
  section: SectionId;
};

export type Subject = {
  id: string;
  name: string;
  files: Record<SectionId, FileMeta[]>;
};

export type Member = {
  username: string;
  displayName: string;
  role: "owner" | "user";
  legacyEnabled: boolean;
  previewOwner: boolean;
};

export type Person = {
  username: string;
  displayName: string;
  created: string;
  blocked: boolean;
  registered: boolean;
  role: "owner" | "user" | "unknown";
};

export type MySubmission = {
  id: string;
  subjectName: string;
  section: SectionId;
  name: string;
  status: "pending" | "approved" | "rejected";
  created: string;
};

export type ReviewItem = {
  id: string;
  subjectName: string;
  section: SectionId;
  name: string;
  bytes: number;
  created: string;
  authorName: string;
  authorUsername: string;
};

export type CommentItem = {
  id: string;
  author: string;
  body: string;
  created: string;
  canDelete: boolean;
};

export type LibraryNotice = {
  id: string;
  message: string;
};

export type Participant = {
  userId: string;
  username: string;
  displayName: string;
  role: "owner" | "user";
  blocked: boolean;
};

export type UserStats = {
  displayName: string;
  username: string;
  downloads: number;
  subjects: { name: string; downloads: number }[];
  quizzes: { subject: string; name: string; attempts: number }[];
};

export const FRESH_VISIT_KEY = "library-fresh-visit";
export const NOTICE_CACHE_KEY = "library-notices";

export function normalizeUsername(raw: string): string | null {
  const username = raw.trim();
  if (!USERNAME.test(username)) return null;
  return username;
}

export function memberEmail(username: string): string {
  return `${username.toLowerCase()}@members.thuvien.app`;
}

export function isOwnerUsername(username: string): boolean {
  return username.toLowerCase() === OWNER_USERNAME.toLowerCase();
}

export function sectionById(id: string): (typeof SECTIONS)[number] | undefined {
  return SECTIONS.find((section) => section.id === id);
}

export function emptyFiles(): Record<SectionId, FileMeta[]> {
  return { theory: [], quizfile: [], practice: [] };
}
