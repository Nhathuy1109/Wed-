import { useEffect, useRef, useState } from "react";
import { parseWordQuizHtml, type QuizQuestion } from "@/lib/library/word-quiz-parser";
import { loadPrivateQuizzes } from "@/lib/library/word-quiz-store";
import { answerRoom, closeRoom, createRoom, joinRoom, roomPoll, startRoom, type RoomState } from "@/lib/library/room-api";

const btn = "inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-50";
const card = "rounded-2xl border border-line bg-surface p-4";

export function StudyRoom({ username, owner, autoJoin }: { username: string; owner: boolean; autoJoin?: string }) {
  const [code, setCode] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [st, setSt] = useState<RoomState | null>(null);
  const [err, setErr] = useState("");
  const [qs, setQs] = useState<QuizQuestion[]>([]);
  const [title, setTitle] = useState("");
  const [secs, setSecs] = useState(15);
  const [count, setCount] = useState(20);
  const [shuf, setShuf] = useState(true);
  const [qr, setQr] = useState("");
  const [left, setLeft] = useState(0);
  const got = useRef(0);
  const saved = loadPrivateQuizzes(username);

  const apply = (r: { ok: boolean; data?: RoomState; message?: string }) => {
    if (r.ok && r.data) { setSt(r.data); setCode(r.data.code); got.current = Date.now(); setLeft(r.data.leftMs); setErr(""); }
    else setErr(r.message ?? "Có lỗi xảy ra.");
  };

  // Vào bằng link ?room=MÃ
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("room");
    const j = autoJoin || c;
    if (j && !owner) joinRoom({ data: { code: j } }).then(apply).catch(() => setErr("Không vào được phòng."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hỏi server ~1 giây/lần (không cần WebSocket)
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await roomPoll({ data: { code } }).catch(() => null);
      if (!r || !r.ok) return;
      setOpen(r.open);
      if (code && !r.state) { setSt(null); setCode(""); }
      if (r.state) { setSt(r.state); got.current = Date.now(); setLeft(r.state.leftMs); }
    }, 1000);
    return () => clearInterval(t);
  }, [code]);

  useEffect(() => {
    if (st?.status !== "question") return;
    const t = setInterval(() => setLeft(Math.max(0, (st?.leftMs ?? 0) - (Date.now() - got.current))), 200);
    return () => clearInterval(t);
  }, [st?.status, st?.idx, st?.leftMs]);

  useEffect(() => {
    if (st?.status !== "lobby") return;
    const link = `${window.location.origin}${window.location.pathname}?room=${st.code}`;
    import("qrcode").then((m) => m.toDataURL(link, { width: 220, margin: 1 })).then(setQr).catch(() => setQr(""));
  }, [st?.status, st?.code]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const mammoth = (await import("mammoth/mammoth.browser")).default;
      const res = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
      const p = parseWordQuizHtml(res.value, f.name);
      setQs(p.questions); setTitle(p.title); setCount(Math.min(20, p.questions.length));
      setErr(p.questions.length ? "" : p.warnings.join(" "));
    } catch { setErr("Không đọc được file Word."); }
  }

  if (!st) {
    return (
      <section className="space-y-4">
        {owner ? (
          <div className={card}>
            <p className="font-semibold">Mở phòng ôn bài chung</p>
            <label className="mt-3 block text-sm">Tạo đề từ file Word
              <input type="file" accept=".docx" className="mt-1 block w-full text-xs" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {saved.length ? (
              <select className="mt-3 h-10 w-full rounded-xl border border-line bg-surface px-2 text-sm" defaultValue=""
                onChange={(e) => { const q = saved.find((s) => s.id === e.target.value); if (q) { setQs(q.questions); setTitle(q.title); setCount(Math.min(20, q.questions.length)); } }}>
                <option value="">…hoặc chọn đề đã lưu</option>
                {saved.map((s) => <option key={s.id} value={s.id}>{s.title} ({s.questions.length} câu)</option>)}
              </select>
            ) : null}
            {qs.length ? (
              <div className="mt-3 space-y-3 text-sm">
                <p>Đề: <b>{title}</b> — {qs.length} câu</p>
                <div className="flex gap-2">{[10, 15, 20].map((s) => (
                  <button key={s} type="button" onClick={() => setSecs(s)} className={`h-10 flex-1 rounded-full border text-sm font-semibold ${secs === s ? "border-accent bg-accent text-on-accent" : "border-line"}`}>{s}s</button>
                ))}</div>
                <label className="flex items-center gap-2">Số câu chơi (ngẫu nhiên):
                  <input type="number" min={1} max={qs.length} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-9 w-20 rounded-lg border border-line bg-surface px-2" />
                </label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={shuf} onChange={(e) => setShuf(e.target.checked)} />Xáo cả thứ tự đáp án A–D</label>
                <button type="button" className={btn} onClick={async () => apply(await createRoom({ data: { questions: qs, seconds: secs, count, shuffleOptions: shuf } }))}>Mở phòng ôn bài</button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={card}>
          <p className="font-semibold">Tham gia phòng</p>
          <button type="button" disabled={!open} className={`${btn} mt-3 ${open ? "animate-pulse" : ""}`} onClick={async () => open && apply(await joinRoom({ data: { code: open } }))}>
            {open ? "Tham gia" : "Chưa có phòng đang mở"}
          </button>
        </div>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
      </section>
    );
  }

  const board = (
    <ol className="mt-2 space-y-1 text-sm">
      {st.players.map((p) => (
        <li key={p.id} className="flex justify-between rounded-xl bg-bg px-3 py-2">
          <span>#{p.rank} {p.name}</span><b>{p.score}{p.last ? <span className="ml-1 text-xs font-normal text-muted">+{p.last}</span> : null}</b>
        </li>
      ))}
    </ol>
  );

  return (
    <section className="space-y-4">
      {st.status === "lobby" ? (
        <div className={card}>
          <p className="font-semibold">Phòng {st.code} — {st.seconds}s/câu · {st.total} câu</p>
          {qr ? <img src={qr} alt="QR vào phòng" className="mx-auto mt-3 h-44 w-44" /> : null}
          <p className="mt-2 text-center text-xs text-muted">Quét QR hoặc nhập mã {st.code}</p>
          <p className="mt-3 text-sm font-semibold">Đã vào ({st.players.length})</p>
          {board}
          {st.isOwner ? <button type="button" className={`${btn} mt-3`} disabled={!st.players.length} onClick={async () => apply(await startRoom({ data: { code: st.code } }))}>Bắt đầu</button> : <p className="mt-3 text-sm text-muted">Đang chờ chủ phòng bắt đầu…</p>}
        </div>
      ) : null}

      {st.q && st.status !== "done" ? (
        <div className={card}>
          <div className="flex justify-between text-sm"><span>Câu {st.idx + 1}/{st.total}</span><b>{st.status === "question" ? `${Math.ceil(left / 1000)}s` : "Kết quả"}</b></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg"><div className="h-full bg-accent" style={{ width: st.status === "question" ? `${(left / (st.seconds * 1000)) * 100}%` : "0%" }} /></div>
          <p className="mt-3 font-semibold">{st.q.q}</p>
          <div className="mt-3 space-y-2">
            {st.q.o.map((t, i) => {
              const reveal = st.status === "reveal";
              const cls = reveal ? (i === st.correct ? "border-green-600 bg-green-100 text-green-900" : i === st.pick ? "border-red-500 bg-red-100 text-red-900" : "border-line") : i === st.pick ? "border-accent bg-bg" : "border-line";
              return (
                <button key={i} type="button" disabled={reveal || st.answered || st.isOwner || left <= 0} className={`w-full touch-manipulation rounded-xl border-2 px-3 py-3 text-left text-sm ${cls}`}
                  onClick={async () => {
                    setSt({ ...st, answered: true, pick: i });
                    try { apply(await answerRoom({ data: { code: st.code, pick: i } })); } catch { setErr("Không gửi được đáp án, thử lại."); }
                  }}>
                  <b>{"ABCD"[i]}.</b> {t}
                </button>
              );
            })}
          </div>
          {st.status === "question" && st.answered ? <p className="mt-2 text-xs text-muted">Đã chọn — chờ mọi người…</p> : null}
          {st.status === "reveal" && st.explain ? <p className="mt-3 rounded-xl bg-bg p-3 text-xs">💡 {st.explain}</p> : null}
          {st.status === "reveal" ? <><p className="mt-3 text-sm font-semibold">Bảng xếp hạng</p>{board}</> : null}
        </div>
      ) : null}

      {st.status === "done" ? (
        <div className={card}>
          <p className="text-center text-lg font-bold">🏆 Vinh danh top 3</p>
          <div className="mt-3 flex items-end justify-center gap-2">
            {[1, 0, 2].map((i) => st.players[i] ? (
              <div key={i} className="flex-1 text-center">
                <p className="text-2xl">{["🥇", "🥈", "🥉"][i]}</p>
                <p className="truncate text-sm font-semibold">{st.players[i].name}</p>
                <div className={`mt-1 rounded-t-xl bg-accent text-on-accent ${i === 0 ? "h-24" : i === 1 ? "h-16" : "h-12"} flex items-center justify-center text-sm font-bold`}>{st.players[i].score}</div>
              </div>
            ) : null)}
          </div>
          <p className="mt-4 text-sm font-semibold">Toàn bộ xếp hạng</p>{board}
        </div>
      ) : null}

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <button type="button" className={`${btn} bg-surface !text-ink border border-line`} onClick={async () => { if (st.isOwner) await closeRoom({ data: { code: st.code } }); setSt(null); setCode(""); setQs([]); }}>
        {st.isOwner ? "Đóng phòng" : "Rời phòng"}
      </button>
    </section>
  );
}
