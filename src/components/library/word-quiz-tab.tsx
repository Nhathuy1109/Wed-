import { useMemo, useState, type FormEvent } from "react";
import { FileUp, Play, Send, Trash2, Sparkles } from "lucide-react";
import {
  buildPracticeHtml,
  parsePlainQuizText,
  parseWordQuizHtml,
  type QuizQuestion,
} from "@/lib/library/word-quiz-parser";
import { extractPdfText } from "@/lib/library/pdf-text";
import {
  loadPrivateQuizzes,
  removePrivateQuiz,
  upsertPrivateQuiz,
  type PrivateQuiz,
} from "@/lib/library/word-quiz-store";
import type { Subject } from "@/lib/library/ids";
import { MAX_FILE_BYTES } from "@/lib/library/ids";

type Props = {
  username: string;
  owner: boolean;
  subjects: Subject[];
  busy: boolean;
  onSubmitToOwner: (payload: {
    subjectId: string;
    name: string;
    body: string;
    bytes: number;
  }) => void;
};

type Draft = {
  title: string;
  sourceName: string;
  questions: QuizQuestion[];
  warnings: string[];
};

export function WordQuizTab({ username, owner, subjects, busy, onSubmitToOwner }: Props) {
  const [list, setList] = useState<PrivateQuiz[]>(() => loadPrivateQuizzes(username));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [playing, setPlaying] = useState<PrivateQuiz | null>(null);
  const [playIdx, setPlayIdx] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [parsing, setParsing] = useState(false);

  const practiceSubjects = useMemo(() => subjects, [subjects]);

  async function onFile(file: File | null) {
    setErr("");
    setDraft(null);
    if (!file) return;
    const isDocx = /\.docx$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name);
    if (!isDocx && !isPdf) {
      setErr("Chỉ nhận file Word .docx hoặc PDF .pdf");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErr("File tối đa 3 MB");
      return;
    }
    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      let parsed;
      if (isPdf) {
        const text = await extractPdfText(buffer);
        if (!text.trim()) {
          setErr("PDF không có chữ (có thể là bản scan ảnh). Hãy dùng file PDF có text hoặc .docx.");
          return;
        }
        parsed = parsePlainQuizText(text, file.name);
      } else {
        const mammoth = (await import("mammoth/mammoth.browser")).default;
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        parsed = parseWordQuizHtml(result.value, file.name);
      }
      if (!parsed.questions.length) {
        setErr(parsed.warnings.join(" ") || "Không tách được câu hỏi từ file.");
        return;
      }
      const unresolvedCount = parsed.questions.filter((question) => !question.answerKnown).length;
      const warnings = parsed.warnings.filter((warning) => !warning.startsWith("Câu chưa xác định đáp án đúng"));
      if (unresolvedCount) {
        warnings.push(`Có ${unresolvedCount} câu chưa nhận dạng được đáp án; hãy chọn đáp án ở phần xem trước.`);
      }
      if (isPdf) {
        warnings.unshift(
          "PDF: đáp án tô vàng/in đậm thường mất khi trích chữ — nên ghi rõ dòng “Đáp án: B”.",
        );
      }
      setDraft({
        title: parsed.title,
        sourceName: file.name,
        questions: parsed.questions,
        warnings,
      });
    } catch {
      setErr(isPdf ? "Không đọc được PDF. Thử file khác hoặc xuất lại PDF dạng text." : "Không đọc được file Word. Thử file .docx khác.");
    } finally {
      setParsing(false);
    }
  }

  function setDraftAnswer(questionIndex: number, optionIndex: number) {
    setDraft((current) => {
      if (!current) return current;
      const questions = current.questions.map((question, index) => ({
        ...question,
        answerKnown: index === questionIndex ? true : question.answerKnown,
        options: question.options.map((option, oi) => ({
          ...option,
          correct: index === questionIndex ? oi === optionIndex : option.correct,
        })),
      }));
      const unresolvedCount = questions.filter((question) => !question.answerKnown).length;
      const warnings = current.warnings.filter((warning) => !warning.includes("câu chưa nhận dạng được đáp án"));
      if (unresolvedCount) warnings.push(`Còn ${unresolvedCount} câu chưa nhận dạng được đáp án; hãy chọn đáp án ở phần xem trước.`);
      return { ...current, questions, warnings };
    });
  }

  function saveDraft() {
    if (!draft) return;
    if (draft.questions.some((question) => !question.answerKnown)) {
      setErr("Vui lòng chọn đáp án đúng cho tất cả câu chưa xác định trước khi lưu.");
      return;
    }
    const quiz: PrivateQuiz = {
      id: crypto.randomUUID(),
      title: draft.title,
      questions: draft.questions,
      created: new Date().toISOString().slice(0, 10),
      sourceName: draft.sourceName,
    };
    upsertPrivateQuiz(username, quiz);
    setList(loadPrivateQuizzes(username));
    setDraft(null);
  }

  function startPlay(quiz: PrivateQuiz) {
    setPlaying(quiz);
    setPlayIdx(0);
    setPick(null);
    setRevealed(false);
    setScore({ ok: 0, total: 0 });
    setDone(false);
  }

  function confirmAnswer() {
    if (!playing || pick === null || revealed) return;
    const q = playing.questions[playIdx];
    const correctIdx = q.options.findIndex((o) => o.correct);
    const ok = pick === correctIdx;
    setRevealed(true);
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
  }

  function nextQuestion() {
    if (!playing) return;
    if (playIdx + 1 >= playing.questions.length) {
      setDone(true);
      return;
    }
    setPlayIdx((i) => i + 1);
    setPick(null);
    setRevealed(false);
  }

  function sendToOwner(quiz: PrivateQuiz) {
    if (!subjectId) {
      setErr("Chọn môn học để gửi chủ web lưu.");
      return;
    }
    const html = buildPracticeHtml(quiz.title, quiz.questions);
    const name = `${quiz.title}.html`.replace(/[\\/]/g, "-");
    onSubmitToOwner({
      subjectId,
      name,
      body: html,
      bytes: new TextEncoder().encode(html).length,
    });
    const next = { ...quiz, submitted: true };
    upsertPrivateQuiz(username, next);
    setList(loadPrivateQuizzes(username));
  }

  function remove(id: string) {
    removePrivateQuiz(username, id);
    setList(loadPrivateQuizzes(username));
    if (playing?.id === id) setPlaying(null);
  }

  if (playing) {
    const q = playing.questions[playIdx];
    const correctIdx = q.options.findIndex((o) => o.correct);
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="text-sm font-semibold text-accent" onClick={() => setPlaying(null)}>
            ← Danh sách đề của tôi
          </button>
          <p className="text-sm text-muted">
            Câu {playIdx + 1}/{playing.questions.length}
            {score.total ? ` · Đúng ${score.ok}/${score.total}` : ""}
          </p>
        </div>
        <h1 className="text-xl font-bold">{playing.title}</h1>
        {done ? (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-lg font-bold">Hoàn thành</p>
            <p className="mt-1 text-muted">
              Đúng {score.ok}/{score.total} (
              {score.total ? Math.round((score.ok / score.total) * 100) : 0}%)
            </p>
            <button
              type="button"
              className="mt-4 h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent"
              onClick={() => setPlaying(null)}
            >
              Đóng
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm font-bold text-accent">Câu {playIdx + 1}</p>
            <p className="mt-2 font-semibold leading-relaxed">{q.question}</p>
            <ul className="mt-3 space-y-2">
              {q.options.map((opt, oi) => {
                let cls = "w-full rounded-xl border px-3 py-2.5 text-left text-sm";
                if (!revealed) {
                  cls += pick === oi ? " border-accent bg-pink" : " border-line bg-bg";
                } else if (oi === correctIdx) {
                  cls += " border-green-600 bg-green-50";
                } else if (pick === oi) {
                  cls += " border-accent bg-pink";
                } else {
                  cls += " border-line opacity-70";
                }
                return (
                  <li key={oi}>
                    <button
                      type="button"
                      disabled={revealed}
                      className={cls}
                      onClick={() => setPick(oi)}
                    >
                      <span className="font-bold">{String.fromCharCode(65 + oi)}.</span> {opt.text}
                    </button>
                  </li>
                );
              })}
            </ul>
            {revealed && q.explanation ? (
              <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm leading-relaxed text-ink">
                <strong>Giải thích:</strong> {q.explanation}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {!revealed ? (
                <button
                  type="button"
                  disabled={pick === null}
                  className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-50"
                  onClick={confirmAnswer}
                >
                  Chọn đáp án
                </button>
              ) : (
                <button
                  type="button"
                  className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent"
                  onClick={nextQuestion}
                >
                  {playIdx + 1 >= playing.questions.length ? "Xem kết quả" : "Câu tiếp"}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <header>
        <p className="text-sm font-semibold text-accent">Mục mới</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Word/PDF → Trắc nghiệm</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Tải file .docx hoặc .pdf có câu hỏi và lựa chọn A–D. Hệ thống nhận diện đáp án ghi thành dòng, đáp án in đậm/tô vàng trong Word, cùng nhiều cách viết phần giải thích. Với PDF, nên ghi rõ đáp án vì định dạng tô màu/in đậm có thể bị mất. Câu chưa rõ đáp án sẽ được yêu cầu xác nhận trước khi lưu.
          Giải thích (nếu có) chỉ hiện sau khi bạn chọn đáp án. Đề chỉ lưu trên máy bạn — user khác không thấy. Có thể gửi chủ web để duyệt vào mục Thực hành.
        </p>
      </header>

      <div className="rounded-2xl border border-dashed border-accent/40 bg-pink/40 p-4">
        <label className="flex cursor-pointer flex-col items-start gap-2 sm:flex-row sm:items-center">
          <span className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent">
            <FileUp className="size-4" aria-hidden />
            {parsing ? "Đang đọc…" : "Chọn file .docx / .pdf"}
          </span>
          <input
            type="file"
            accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
            className="sr-only"
            disabled={parsing || busy}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          <span className="text-xs text-muted">Tối đa 3 MB · .docx hoặc .pdf</span>
        </label>
        {err ? <p className="mt-2 text-sm font-medium text-accent">{err}</p> : null}
      </div>

      {draft ? (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-accent">Xem trước</p>
              <h2 className="text-lg font-bold">{draft.title}</h2>
              <p className="text-sm text-muted">
                {draft.questions.length} câu · nguồn {draft.sourceName}
              </p>
            </div>
            <button
              type="button"
              disabled={draft.questions.some((question) => !question.answerKnown)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:cursor-not-allowed disabled:opacity-40"
              onClick={saveDraft}
              title={draft.questions.some((question) => !question.answerKnown) ? "Hãy xác nhận đáp án còn thiếu" : "Lưu đề"}
            >
              <Sparkles className="size-4" aria-hidden />
              Lưu vào máy tôi
            </button>
          </div>
          {draft.warnings.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
              {draft.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            Kiểm tra đáp án từng câu bên dưới. Những câu chưa được nhận dạng sẽ có nhãn “Cần chọn đáp án”.
          </p>
          <ol className="mt-2 max-h-[28rem] space-y-3 overflow-y-auto text-sm">
            {draft.questions.map((q, i) => (
              <li key={i} className="rounded-xl border border-line p-3">
                <p className="font-semibold">{i + 1}. {q.question}</p>
                <label className="mt-2 block text-xs font-semibold text-muted">
                  {q.answerKnown ? "Đáp án đúng" : "Cần chọn đáp án đúng"}
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-line bg-bg px-2 text-sm text-ink"
                    value={q.options.findIndex((option) => option.correct) >= 0 ? String(q.options.findIndex((option) => option.correct)) : ""}
                    onChange={(event) => setDraftAnswer(i, Number(event.target.value))}
                  >
                    <option value="">— Chọn đáp án —</option>
                    {q.options.map((option, oi) => (
                      <option key={oi} value={oi}>{String.fromCharCode(65 + oi)}. {option.text}</option>
                    ))}
                  </select>
                </label>
                {q.explanation ? <p className="mt-1 text-xs text-muted">Có phần giải thích</p> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-lg font-bold">Đề của tôi (riêng tư)</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted">Chưa có đề nào. Tải Word để tạo.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((quiz) => (
              <li
                key={quiz.id}
                className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{quiz.title}</p>
                  <p className="text-xs text-muted">
                    {quiz.questions.length} câu · {quiz.created}
                    {quiz.submitted ? " · đã gửi chủ web" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-1 rounded-full border border-line px-3 text-sm font-semibold"
                    onClick={() => startPlay(quiz)}
                  >
                    <Play className="size-3.5" aria-hidden />
                    Làm bài
                  </button>
                  <button
                    type="button"
                    disabled={busy || !practiceSubjects.length}
                    className="inline-flex h-10 items-center gap-1 rounded-full border border-line px-3 text-sm font-semibold disabled:opacity-50"
                    onClick={() => sendToOwner(quiz)}
                    title="Gửi để owner duyệt vào Thực hành"
                  >
                    <Send className="size-3.5" aria-hidden />
                    Gửi owner
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-1 rounded-full border border-line px-3 text-sm font-semibold text-accent"
                    onClick={() => remove(quiz.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Xóa
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {practiceSubjects.length ? (
        <form
          className="rounded-2xl border border-line bg-surface p-3"
          onSubmit={(e: FormEvent) => e.preventDefault()}
        >
          <label className="block text-sm font-semibold">
            Môn học khi gửi owner
            <select
              className="mt-1 h-11 w-full rounded-xl border border-line bg-bg px-3"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {practiceSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {owner ? (
            <p className="mt-2 text-xs text-muted">
              Bạn là owner: đề user gửi sẽ vào mục duyệt bài (submission) → duyệt để vào Thực hành.
            </p>
          ) : null}
        </form>
      ) : (
        <p className="text-sm text-muted">Chưa có môn học — owner cần tạo môn trước khi gửi đề.</p>
      )}

      <div className="rounded-2xl border border-line bg-surface p-3 text-sm">
        <p className="font-semibold">File Word mẫu</p>
        <p className="mt-1 text-xs text-muted">Tải mẫu .docx, thay nội dung câu hỏi và đáp án rồi tải lên. Có thể thêm hoặc xóa câu tùy ý.</p>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <a
              href={`${import.meta.env.BASE_URL}templates/mau-trac-nghiem.docx`}
              download="Mau-soan-trac-nghiem.docx"
              className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
            >
              Mẫu 1: đáp án ghi dưới câu (.docx)
            </a>
            <p className="mt-1 text-xs text-muted">Dòng “Đáp án: B” và “Giải thích: …” ngay dưới mỗi câu, hoặc tô vàng/in đậm đáp án đúng.</p>
          </div>
          <div>
            <a
              href={`${import.meta.env.BASE_URL}templates/mau-trac-nghiem-2.docx`}
              download="Mau-trac-nghiem-2-dap-an-trong-khung.docx"
              className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
            >
              Mẫu 2: đáp án trong khung (.docx)
            </a>
            <p className="mt-1 text-xs text-muted">Đề ôn 30 câu (Marketing chương 1 &amp; 2.1): “Câu N: …”, 4 lựa chọn A–D, rồi khung “Đáp án đúng: X” kèm giải thích lý thuyết.</p>
          </div>
        </div>
      </div>

      <details className="rounded-2xl border border-line bg-surface p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Mẫu soạn nhanh ngay trong Word</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-muted">{`Câu 1. Thủ đô Việt Nam là?
A. Hải Phòng
B. Hà Nội
C. Đà Nẵng
D. Huế
Đáp án: B
Giải thích: Hà Nội là thủ đô từ năm 1945.

Câu 2. ...
(A tô vàng hoặc in đậm cũng được, không cần dòng Đáp án)

Kiểu khung (Mẫu 2) cũng đọc được:
Câu 1: Nội dung câu hỏi?
A. ...  B. ...  C. ...  D. ...
[Khung] Đáp án đúng: A
        Giải thích lý thuyết: ...`}</pre>
      </details>
    </section>
  );
}
