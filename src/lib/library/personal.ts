// Dữ liệu cá nhân lưu ngay trên thiết bị (localStorage): môn đã xem, tài liệu ghim, xem gần đây.
// Mỗi tài khoản một bộ riêng. Lỗi lưu trữ (chế độ riêng tư...) thì bỏ qua, web vẫn chạy.

export type SeenState = { baseline: number; subjects: Record<string, number> };

function k(user: string, what: string): string {
  return `library:${what}:${user.toLowerCase()}`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Lần đầu vào: lấy mốc "bây giờ" làm chuẩn, nên không môn nào bị chấm đỏ oan. */
export function loadSeen(user: string): SeenState {
  const stored = read<SeenState | null>(k(user, "seen"), null);
  if (stored && typeof stored.baseline === "number" && stored.subjects) return stored;
  const fresh: SeenState = { baseline: Date.now(), subjects: {} };
  write(k(user, "seen"), fresh);
  return fresh;
}

export function saveSeen(user: string, value: SeenState): void {
  write(k(user, "seen"), value);
}

export function loadPins(user: string): string[] {
  const list = read<unknown>(k(user, "pins"), []);
  return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
}

export function savePins(user: string, ids: string[]): void {
  write(k(user, "pins"), ids);
}

export function loadRecent(user: string): string[] {
  const list = read<unknown>(k(user, "recent"), []);
  return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
}

export function saveRecent(user: string, ids: string[]): void {
  write(k(user, "recent"), ids);
}
