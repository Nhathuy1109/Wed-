import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type RoomQ = { q: string; o: string[]; a: number; e: string };
export type RoomState = {
  code: string;
  status: "lobby" | "question" | "reveal" | "done";
  isOwner: boolean;
  seconds: number;
  idx: number;
  total: number;
  leftMs: number;
  players: { id: string; name: string; score: number; rank: number; last: number }[];
  q?: { q: string; o: string[] };
  answered: boolean;
  pick: number | null;
  correct?: number;
  explain?: string;
};
type R = { ok: true; data: RoomState } | { ok: false; message: string };
type Room = { code: string; owner_id: string; status: string; seconds: number; quiz: string; idx: number; phase_ms: number };

const REVEAL_MS = 6000;
const shuffle = <T,>(a: T[]) => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const num = (v: unknown) => Number(v);

async function me(sql: Sql, userId: string) {
  const r = await sql<{ role: string; display_name: string; nickname: string | null }>`
    select role, display_name, nickname from profiles where user_id = ${userId}`;
  return r[0] ? { owner: r[0].role === "owner", name: r[0].nickname || r[0].display_name } : null;
}

/** Tự chuyển pha theo giờ server (không cần WebSocket). */
async function tick(sql: Sql, room: Room): Promise<Room> {
  const now = Date.now();
  const total = (JSON.parse(room.quiz) as RoomQ[]).length;
  if (room.status === "question") {
    const [{ c }] = await sql<{ c: string }>`select count(*)::text c from room_answers where code=${room.code} and idx=${room.idx}`;
    const [{ p }] = await sql<{ p: string }>`select count(*)::text p from room_players where code=${room.code}`;
    if (now >= num(room.phase_ms) + room.seconds * 1000 || num(c) >= num(p)) {
      await sql`update rooms set status='reveal', phase_ms=${now} where code=${room.code} and status='question' and idx=${room.idx}`;
      room = { ...room, status: "reveal", phase_ms: now };
    }
  } else if (room.status === "reveal" && now >= num(room.phase_ms) + REVEAL_MS) {
    if (room.idx + 1 >= total) {
      await sql`update rooms set status='done' where code=${room.code} and status='reveal' and idx=${room.idx}`;
      room = { ...room, status: "done" };
    } else {
      await sql`update rooms set status='question', idx=idx+1, phase_ms=${now} where code=${room.code} and status='reveal' and idx=${room.idx}`;
      room = { ...room, status: "question", idx: room.idx + 1, phase_ms: now };
    }
  }
  return room;
}

async function stateFor(sql: Sql, code: string, userId: string): Promise<R> {
  const rows = await sql<Room>`select * from rooms where code=${code}`;
  if (!rows[0]) return { ok: false, message: "Phòng không tồn tại hoặc đã đóng." };
  const room = await tick(sql, rows[0]);
  const quiz = JSON.parse(room.quiz) as RoomQ[];
  const pl = await sql<{ user_id: string; name: string; score: number }>`
    select user_id, name, score from room_players where code=${code} order by score desc, name`;
  if (!pl.some((p) => p.user_id === userId) && room.owner_id !== userId) return { ok: false, message: "Bạn chưa tham gia phòng này." };
  const ans = await sql<{ idx: number; user_id: string; pick: number; pts: number }>`
    select idx, user_id, pick, pts from room_answers where code=${code} and idx=${room.idx}`;
  const mine = ans.find((a) => a.user_id === userId);
  const shown = room.status === "reveal" || room.status === "done";
  const cur = quiz[room.idx];
  const st: RoomState = {
    code, status: room.status as RoomState["status"], isOwner: room.owner_id === userId,
    seconds: room.seconds, idx: room.idx, total: quiz.length,
    leftMs: room.status === "question" ? Math.max(0, num(room.phase_ms) + room.seconds * 1000 - Date.now()) : 0,
    players: pl.map((p, i) => ({
      id: p.user_id, name: p.name, score: p.score, rank: i + 1,
      last: room.status === "reveal" ? ans.find((a) => a.user_id === p.user_id)?.pts ?? 0 : 0,
    })),
    answered: Boolean(mine), pick: mine ? mine.pick : null,
  };
  if (room.status === "question" || room.status === "reveal") {
    st.q = { q: cur.q, o: cur.o };
    if (shown) { st.correct = cur.a; st.explain = cur.e; }
  }
  return { ok: true, data: st };
}

export const createRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((i: unknown) => i as { questions: { question: string; options: { text: string; correct: boolean }[]; explanation: string }[]; seconds: number; count: number; shuffleOptions: boolean })
  .handler(async ({ context, data }): Promise<R> => {
    const sql = await getSql();
    const m = await me(sql, context.userId);
    if (!m?.owner) return { ok: false, message: "Chỉ chủ web mới mở phòng ôn bài." };
    const secs = [10, 15, 20].includes(data.seconds) ? data.seconds : 15;
    const valid = (data.questions ?? []).filter((q) => q.options?.length >= 2 && q.options.some((o) => o.correct));
    if (!valid.length) return { ok: false, message: "Đề chưa có câu nào có đáp án đúng." };
    const picked = shuffle(valid).slice(0, Math.max(1, Math.min(data.count || valid.length, valid.length)));
    const quiz: RoomQ[] = picked.map((q) => {
      const opts = data.shuffleOptions ? shuffle(q.options) : q.options;
      return { q: q.question, o: opts.map((o) => o.text), a: opts.findIndex((o) => o.correct), e: q.explanation || "" };
    });
    await sql`delete from rooms where owner_id=${context.userId}`;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await sql`insert into rooms (code, owner_id, seconds, quiz, created_ms) values (${code}, ${context.userId}, ${secs}, ${JSON.stringify(quiz)}, ${Date.now()})`;
    return stateFor(sql, code, context.userId);
  });

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((i: unknown) => ({ code: String((i as { code?: unknown })?.code ?? "").trim() }))
  .handler(async ({ context, data }): Promise<R> => {
    const sql = await getSql();
    const m = await me(sql, context.userId);
    if (!m) return { ok: false, message: "Cần đăng nhập để tham gia." };
    const r = await sql<Room>`select * from rooms where code=${data.code}`;
    if (!r[0]) return { ok: false, message: "Mã phòng không đúng hoặc phòng đã đóng." };
    if (r[0].owner_id !== context.userId) {
      if (r[0].status !== "lobby") return { ok: false, message: "Phòng đã bắt đầu, không thể vào thêm." };
      await sql`insert into room_players (code, user_id, name) values (${data.code}, ${context.userId}, ${m.name}) on conflict (code, user_id) do nothing`;
    }
    return stateFor(sql, data.code, context.userId);
  });

/** Polling: user thấy phòng đang mở (nút "Tham gia" sáng) khi activeRoom trả về mã. */
export const roomPoll = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((i: unknown) => ({ code: String((i as { code?: unknown })?.code ?? "") }))
  .handler(async ({ context, data }): Promise<{ ok: true; state: RoomState | null; open: string | null } | { ok: false; message: string }> => {
    const sql = await getSql();
    if (data.code) {
      const s = await stateFor(sql, data.code, context.userId);
      return s.ok ? { ok: true, state: s.data, open: null } : { ok: true, state: null, open: null };
    }
    const o = await sql<{ code: string }>`select code from rooms where status='lobby' and created_ms > ${Date.now() - 3 * 3600_000} order by created_ms desc limit 1`;
    return { ok: true, state: null, open: o[0]?.code ?? null };
  });

export const startRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((i: unknown) => ({ code: String((i as { code?: unknown })?.code ?? "") }))
  .handler(async ({ context, data }): Promise<R> => {
    const sql = await getSql();
    await sql`update rooms set status='question', idx=0, phase_ms=${Date.now()} where code=${data.code} and owner_id=${context.userId} and status='lobby'`;
    return stateFor(sql, data.code, context.userId);
  });

export const answerRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((i: unknown) => i as { code: string; pick: number })
  .handler(async ({ context, data }): Promise<R> => {
    const sql = await getSql();
    const r = await sql<Room>`select * from rooms where code=${data.code}`;
    const room = r[0];
    const now = Date.now();
    if (room && room.status === "question" && now <= num(room.phase_ms) + room.seconds * 1000) {
      const q = (JSON.parse(room.quiz) as RoomQ[])[room.idx];
      const ok = data.pick === q.a;
      const frac = Math.max(0, 1 - (now - num(room.phase_ms)) / (room.seconds * 1000));
      const pts = ok ? Math.round(500 + 500 * frac) : 0;
      const ins = await sql<{ idx: number }>`
        insert into room_answers (code, idx, user_id, pick, pts)
        select ${data.code}::text, ${room.idx}::int, ${context.userId}::text, ${data.pick}::int, ${pts}::int
        where exists (select 1 from room_players where code=${data.code}::text and user_id=${context.userId}::text)
        on conflict do nothing returning idx`;
      if (ins[0]) await sql`update room_players set score=score+${pts} where code=${data.code} and user_id=${context.userId}`;
    }
    return stateFor(sql, data.code, context.userId);
  });

export const closeRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((i: unknown) => ({ code: String((i as { code?: unknown })?.code ?? "") }))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`delete from rooms where code=${data.code} and owner_id=${context.userId}`;
    return { ok: true };
  });
