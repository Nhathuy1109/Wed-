import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  History,
  LoaderCircle,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { askStudyAssistant, listMyHistory, readDocument } from "@/lib/library/api";
import { extractPdfText } from "@/lib/library/pdf-text";
import type { ActivityHistory, FileMeta, Subject } from "@/lib/library/ids";

type Props = {
  subjects: Subject[];
  onOpenDocument: (id: string) => void;
  initialPane?: "assistant" | "history";
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type Pane = "assistant" | "history";

function historyLabel(kind: ActivityHistory["kind"]): string {
  if (kind === "view") return "Đã đọc tài liệu";
  if (kind === "download") return "Đã tải tài liệu";
  if (kind === "attempt") return "Đã mở đề thực hành";
  return "Đã hoàn thành bài trắc nghiệm";
}

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function readDocumentText(file: FileMeta): Promise<string> {
  const result = await readDocument({ data: { id: file.id } });
  if (!result.ok) throw new Error(result.message);
  const body = result.data.body;
  const blob = body.startsWith("data:")
    ? await (await fetch(body)).blob()
    : new Blob([body], { type: result.data.mime || file.mime });
  const buffer = await blob.arrayBuffer();
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || file.mime === "application/pdf") {
    const text = await extractPdfText(buffer);
    if (!text.trim()) throw new Error("PDF không có lớp văn bản. File có thể là bản scan ảnh; hiện trợ lý chưa đọc được ảnh scan.");
    return text;
  }
  if (lower.endsWith(".docx") || file.mime.includes("wordprocessingml")) {
    const mammoth = (await import("mammoth/mammoth.browser")).default;
    const converted = await mammoth.convertToHtml({ arrayBuffer: buffer });
    return new DOMParser().parseFromString(converted.value, "text/html").body.textContent ?? "";
  }
  const text = await blob.text();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return new DOMParser().parseFromString(text, "text/html").body.textContent ?? "";
  }
  return text;
}

export function StudyHub({ subjects, onOpenDocument, initialPane = "assistant" }: Props) {
  const [pane, setPane] = useState<Pane>(initialPane);
  const [history, setHistory] = useState<ActivityHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Chào bạn! Mình là Mochi AI. Mình có thể giải thích bài học, tóm tắt tài liệu, gợi ý cách ôn tập và tạo ví dụ dễ hiểu. Bạn có thể chọn tài liệu trong thư viện để mình đọc trước khi hỏi nhé. ✨",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [selectedDocument, setSelectedDocument] = useState("");
  const [documentContext, setDocumentContext] = useState("");
  const [contextName, setContextName] = useState("");
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [sending, setSending] = useState(false);
  const [assistantError, setAssistantError] = useState("");

  const documents = useMemo(
    () => subjects.flatMap((subject) =>
      [...subject.files.theory, ...subject.files.quizfile]
        .filter((file) => /\.(pdf|docx|txt|md|html?)$/i.test(file.name))
        .map((file) => ({
        ...file,
        subjectName: subject.name,
        })),
    ),
    [subjects],
  );

  async function refreshHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await listMyHistory();
      if (!result.ok) {
        setHistoryError(result.message);
        return;
      }
      setHistory(result.data);
    } catch {
      setHistoryError("Không tải được lịch sử. Hãy thử tải lại.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void refreshHistory();
  }, []);

  async function attachDocument() {
    const file = documents.find((item) => item.id === selectedDocument);
    if (!file) {
      setDocumentContext("");
      setContextName("");
      return;
    }
    setLoadingDocument(true);
    setAssistantError("");
    try {
      const text = (await readDocumentText(file)).replace(/\u0000/g, "").trim();
      if (!text) throw new Error("Không trích xuất được văn bản từ tài liệu này.");
      setDocumentContext(text.slice(0, 18000));
      setContextName(`${file.name} · ${file.subjectName}`);
      setAssistantError(text.length > 18000 ? "Đã đọc tài liệu; phần gửi cho AI được giới hạn ở 18.000 ký tự đầu tiên." : "");
    } catch (error) {
      setDocumentContext("");
      setContextName("");
      setAssistantError(error instanceof Error ? error.message : "Không đọc được tài liệu này.");
    } finally {
      setLoadingDocument(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || sending) return;
    const previous = messages.slice(-8);
    setMessages((current) => [...current, { role: "user", content: question }]);
    setPrompt("");
    setSending(true);
    setAssistantError("");
    try {
      const result = await askStudyAssistant({
        data: {
          message: question,
          context: documentContext,
          history: previous.slice(1).map((item) => ({ role: item.role, content: item.content })),
        },
      });
      if (!result.ok) {
        setAssistantError(result.message);
        return;
      }
      setMessages((current) => [...current, { role: "assistant", content: result.data.answer }]);
    } catch {
      setAssistantError("Không gửi được câu hỏi. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="study-hub space-y-5">
      <header className="rounded-3xl border border-pink-deep bg-gradient-to-br from-pink via-surface to-blue p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface text-accent shadow-sm"><Sparkles className="size-6" /></span>
          <div>
            <p className="text-xs font-black tracking-[.16em] text-accent">MOCHI STUDY SPACE</p>
            <h1 className="text-2xl font-black tracking-tight">Không gian học tập</h1>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">Hỏi Mochi AI khi cần giải thích bài học, hoặc xem lại tài liệu và kết quả học tập của bạn.</p>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-1.5" role="tablist" aria-label="Công cụ học tập">
        <button type="button" role="tab" aria-selected={pane === "assistant"} onClick={() => setPane("assistant")} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold ${pane === "assistant" ? "bg-pink text-accent shadow-sm" : "text-muted"}`}>
          <Bot className="size-4" /> Trợ lý AI
        </button>
        <button type="button" role="tab" aria-selected={pane === "history"} onClick={() => setPane("history")} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold ${pane === "history" ? "bg-pink text-accent shadow-sm" : "text-muted"}`}>
          <History className="size-4" /> Lịch sử học tập
        </button>
      </div>

      {pane === "assistant" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-sm font-bold" htmlFor="mochi-ai-document">Tài liệu tham khảo (không bắt buộc)
                <select id="mochi-ai-document" value={selectedDocument} onChange={(event) => setSelectedDocument(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-bg px-3 font-normal">
                  <option value="">Không chọn tài liệu</option>
                  {documents.map((file) => <option key={file.id} value={file.id}>{file.subjectName} · {file.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void attachDocument()} disabled={!selectedDocument || loadingDocument} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue px-4 text-sm font-bold text-fg disabled:opacity-50">
                {loadingDocument ? <LoaderCircle className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
                {loadingDocument ? "Đang đọc…" : "Đọc tài liệu"}
              </button>
            </div>
            {contextName ? <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="size-4" /> Đã đính kèm: {contextName}</p> : null}
            <p className="mt-2 text-xs text-muted">Hỗ trợ đọc PDF có văn bản, Word DOCX và văn bản/HTML. PDF scan ảnh chưa được OCR.</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-line bg-surface p-3 sm:p-5" aria-live="polite">
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${item.role === "user" ? "rounded-br-md bg-accent text-on-accent" : "rounded-bl-md bg-blue text-fg"}`}>
                  {item.role === "assistant" ? <p className="mb-1 flex items-center gap-1.5 text-xs font-black text-accent-2"><Sparkles className="size-3.5" /> Mochi AI</p> : null}
                  {item.content}
                </div>
              </div>
            ))}
            {sending ? <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted"><LoaderCircle className="size-4 animate-spin" /> Mochi đang suy nghĩ…</div> : null}
          </div>
          {assistantError ? <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{assistantError}</p> : null}
          <form onSubmit={(event) => void sendMessage(event)} className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
            <label htmlFor="mochi-ai-prompt" className="sr-only">Nhập câu hỏi cho Mochi AI</label>
            <textarea id="mochi-ai-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} rows={3} placeholder="Ví dụ: Giải thích định luật này bằng ví dụ đời thường…" className="w-full resize-y rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-accent" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted">AI có thể mắc lỗi; hãy đối chiếu đáp án quan trọng với tài liệu gốc.</span>
              <button type="submit" disabled={!prompt.trim() || sending} className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-on-accent disabled:opacity-50">
                <Send className="size-4" /> Gửi câu hỏi
              </button>
            </div>
          </form>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-xl font-extrabold">Hoạt động gần đây</h2><p className="text-sm text-muted">Tối đa 60 hoạt động mới nhất trên tài khoản của bạn.</p></div>
            <button type="button" onClick={() => void refreshHistory()} disabled={historyLoading} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-bold disabled:opacity-50">
              <RefreshCw className={`size-4 ${historyLoading ? "animate-spin" : ""}`} /> Làm mới
            </button>
          </div>
          {historyError ? <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{historyError}</p> : null}
          {historyLoading && !history.length ? <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">Đang tải lịch sử…</p> : null}
          {!historyLoading && !history.length && !historyError ? <div className="rounded-2xl border border-dashed border-line bg-surface px-5 py-10 text-center"><Clock3 className="mx-auto size-8 text-muted" /><p className="mt-2 font-bold">Chưa có hoạt động</p><p className="mt-1 text-sm text-muted">Khi bạn đọc tài liệu, tải file hoặc làm đề, lịch sử sẽ xuất hiện ở đây.</p></div> : null}
          <ol className="space-y-2">
            {history.map((item) => {
              const Icon = item.kind === "download" ? Download : item.kind === "quiz_result" ? CheckCircle2 : item.kind === "attempt" ? BookOpen : FileText;
              return <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue text-accent-2"><Icon className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.documentName}</p>
                  <p className="text-xs text-muted">{item.subjectName} · {historyLabel(item.kind)}</p>
                  {item.kind === "quiz_result" && item.score !== undefined && item.total ? <p className="mt-0.5 text-xs font-bold text-accent-2">Kết quả: {item.score}/{item.total} ({Math.round(item.score / item.total * 100)}%)</p> : null}
                  <p className="mt-1 text-[11px] text-muted">{dateLabel(item.createdAt)}</p>
                </div>
                <button type="button" onClick={() => onOpenDocument(item.documentId)} className="h-9 shrink-0 rounded-full border border-line px-3 text-xs font-bold text-accent-2">Mở lại</button>
              </li>;
            })}
          </ol>
        </section>
      )}
    </section>
  );
}
