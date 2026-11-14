import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  Download,
  Flag,
  LogOut,
  Pin,
  PinOff,
  Plus,
  Search,
  Share2,
  Shield,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useSyncExternalStore } from "react";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { LIBRARY_NOTICE_KEY } from "@/components/library/auth-screen";
import { OfficePreview, officeKind } from "@/components/library/office-preview";
import {
  ackNotices,
  addComment,
  addDocument,
  addSubject,
  changeOwnerPassword,
  deleteComment,
  deleteDocument,
  deleteSubject,
  listComments,
  listLeaderboard,
  listReports,
  listNotices,
  listParticipants,
  listPeople,
  listReview,
  loadLibrary,
  loadWrong,
  myHistory,
  quizStats,
  readDocument,
  readSubmission,
  resolveReport,
  resetUserPassword,
  reviewSubmission,
  setBlock,
  submitDocument,
  submitReport,
  submitScore,
  trackUse,
  userActivity,
} from "@/lib/library/api";
import {
  FRESH_VISIT_KEY,
  MAX_FILE_BYTES,
  NOTICE_CACHE_KEY,
  SECTIONS,
  sectionById,
  type CommentItem,
  type FileMeta,
  type HistoryItem,
  type LeaderboardChapter,
  type LibraryNotice,
  type Member,
  type MySubmission,
  type Participant,
  type Person,
  type QuizStat,
  type ReportItem,
  type ReviewItem,
  type SectionId,
  type Subject,
  type UserStats,
  type WrongQuestion,
} from "@/lib/library/ids";
import { REVIEW_CHAPTER, withQuizHook } from "@/lib/library/quiz-hook";
import { loadPins, loadRecent, loadSeen, saveRecent, savePins, saveSeen, type SeenState } from "@/lib/library/personal";

const subscribeNone = () => () => {};

function useGateSession(): boolean {
  return useSyncExternalStore(subscribeNone, hasGateSessionMarker, () => false);
}

type Viewer =
  | { kind: "practice"; id: string; name: string; html: string }
  | { kind: "file"; id: string; name: string; url: string; mime: string };

type FileEntry = { file: FileMeta; subject: Subject };

function countFiles(subject: Subject): number {
  return subject.files.theory.length + subject.files.quizfile.length + subject.files.practice.length;
}

function sectionLabel(id: SectionId): string {
  return sectionById(id)?.label ?? id;
}

function statusLabel(status: MySubmission["status"]): string {
  if (status === "pending") return "Đang chờ duyệt";
  if (status === "approved") return "Đã công khai";
  return "Không được duyệt";
}

function readCachedNotices(): LibraryNotice[] {
  try {
    const raw = sessionStorage.getItem(NOTICE_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LibraryNotice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readFile(file: File, asText: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("read"));
    if (asText) reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}

export function LibraryApp() {
  const gate = useGateSession();
  const [me, setMe] = useState<Member | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([]);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [resetRequests, setResetRequests] = useState(0);
  const [openReports, setOpenReports] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [pins, setPins] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [seen, setSeen] = useState<SeenState>({ baseline: Date.now(), subjects: {} });
  const [newSince, setNewSince] = useState(Number.POSITIVE_INFINITY);
  const [notices, setNotices] = useState<LibraryNotice[]>(readCachedNotices);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>("theory");
  const [usersOpen, setUsersOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  function remember(result: Awaited<ReturnType<typeof loadLibrary>>) {
    if (!result.ok) return;
    setMe(result.data.me);
    setSubjects(result.data.subjects);
    setMySubmissions(result.data.mySubmissions);
    setPendingReviews(result.data.pendingReviews);
    setResetRequests(result.data.resetRequests);
    setOpenReports(result.data.openReports);
  }

  async function reload() {
    const result = await loadLibrary();
    if (!result.ok) {
      if (result.blocked) {
        try {
          sessionStorage.setItem(LIBRARY_NOTICE_KEY, result.message);
        } catch {
          /* ignore */
        }
        if (!gate) await signOut("/login");
        setError(result.message);
        return;
      }
      setError(result.message);
      return;
    }
    remember(result);
    setError("");
  }

  useEffect(() => {
    let alive = true;
    loadLibrary()
      .then((result) => {
        if (!alive) return;
        if (!result.ok) {
          if (result.blocked && !gate) {
            try {
              sessionStorage.setItem(LIBRARY_NOTICE_KEY, result.message);
            } catch {
              /* ignore */
            }
            void signOut("/login");
          }
          setError(result.message);
          return;
        }
        setMe(result.data.me);
        setSubjects(result.data.subjects);
        setMySubmissions(result.data.mySubmissions);
        setPendingReviews(result.data.pendingReviews);
        setResetRequests(result.data.resetRequests);
        setOpenReports(result.data.openReports);
      })
      .catch(() => {
        if (alive) setError("Không tải được thư viện.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [gate]);

  useEffect(() => {
    let fresh = false;
    try {
      fresh = sessionStorage.getItem(FRESH_VISIT_KEY) === "1";
    } catch {
      fresh = false;
    }
    if (!fresh) return;
    let alive = true;
    listNotices()
      .then((result) => {
        if (!alive || !result.ok) return;
        try {
          sessionStorage.removeItem(FRESH_VISIT_KEY);
          if (result.data.length) sessionStorage.setItem(NOTICE_CACHE_KEY, JSON.stringify(result.data));
          else sessionStorage.removeItem(NOTICE_CACHE_KEY);
        } catch {
          /* ignore */
        }
        setNotices(result.data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  function goHome() {
    setSubjectId(null);
    setUsersOpen(false);
    setShareOpen(false);
    setReviewOpen(false);
    setInfoOpen(false);
    setQuizOpen(false);
    setViewer(null);
    setQuery("");
  }

  const panelOpen = usersOpen || shareOpen || reviewOpen || infoOpen || quizOpen;

  const username = me?.username ?? "";

  // Nạp dữ liệu cá nhân (ghim, xem gần đây, môn đã xem) khi biết tài khoản.
  useEffect(() => {
    if (!username) return;
    setPins(loadPins(username));
    setRecents(loadRecent(username));
    setSeen(loadSeen(username));
  }, [username]);

  // Mở môn: nhớ mốc cũ để gắn nhãn "Mới", rồi đánh dấu môn này đã xem.
  useEffect(() => {
    if (!username || !subjectId) return;
    const stored = loadSeen(username);
    setNewSince(stored.subjects[subjectId] ?? stored.baseline);
    const next = { ...stored, subjects: { ...stored.subjects, [subjectId]: Date.now() } };
    saveSeen(username, next);
    setSeen(next);
  }, [username, subjectId]);

  // Chủ web vừa tải file lên khi đang ở trong môn: không tự chấm đỏ file của mình.
  useEffect(() => {
    if (!username || !subjectId) return;
    const stored = loadSeen(username);
    const next = { ...stored, subjects: { ...stored.subjects, [subjectId]: Date.now() } };
    saveSeen(username, next);
    setSeen(next);
  }, [subjects, username, subjectId]);

  const fileIndex = useMemo(() => {
    const map = new Map<string, FileEntry>();
    for (const item of subjects) {
      for (const group of SECTIONS) {
        for (const file of item.files[group.id]) map.set(file.id, { file, subject: item });
      }
    }
    return map;
  }, [subjects]);
  const pinnedItems = useMemo(
    () => pins.map((id) => fileIndex.get(id)).filter((entry): entry is FileEntry => Boolean(entry)),
    [pins, fileIndex],
  );
  const recentItems = useMemo(
    () => recents.map((id) => fileIndex.get(id)).filter((entry): entry is FileEntry => Boolean(entry)).slice(0, 6),
    [recents, fileIndex],
  );

  function subjectHasNew(item: Subject): boolean {
    const since = seen.subjects[item.id] ?? seen.baseline;
    return SECTIONS.some((group) => item.files[group.id].some((file) => file.createdAt > since));
  }

  function togglePin(id: string) {
    const next = pins.includes(id) ? pins.filter((value) => value !== id) : [id, ...pins].slice(0, 30);
    setPins(next);
    if (username) savePins(username, next);
  }

  function rememberRecent(id: string) {
    const next = [id, ...recents.filter((value) => value !== id)].slice(0, 12);
    setRecents(next);
    if (username) saveRecent(username, next);
  }

  const subject = subjects.find((item) => item.id === subjectId) ?? null;
  const owner = me?.role === "owner";
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const hits: { key: string; title: string; meta: string; open: () => void }[] = [];
    for (const item of subjects) {
      if (item.name.toLowerCase().includes(needle)) {
        hits.push({
          key: `s-${item.id}`,
          title: item.name,
          meta: "Môn học",
          open: () => {
            setUsersOpen(false);
            setShareOpen(false);
            setReviewOpen(false);
            setInfoOpen(false);
    setQuizOpen(false);
            setViewer(null);
            setSubjectId(item.id);
            setQuery("");
          },
        });
      }
      for (const group of SECTIONS) {
        for (const file of item.files[group.id]) {
          if (!file.name.toLowerCase().includes(needle)) continue;
          hits.push({
            key: file.id,
            title: file.name,
            meta: `${item.name} · ${group.label}`,
            open: () => {
              setUsersOpen(false);
              setShareOpen(false);
              setReviewOpen(false);
              setInfoOpen(false);
    setQuizOpen(false);
              setViewer(null);
              setSubjectId(item.id);
              setSection(group.id);
              setQuery("");
            },
          });
        }
      }
    }
    return hits;
  }, [query, subjects]);

  function openFile(file: FileMeta) {
    return run(async () => {
      const result = await readDocument({ data: { id: file.id } });
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      rememberRecent(file.id);
      if (result.data.section === "practice") {
        setViewer({ kind: "practice", id: file.id, name: result.data.name, html: result.data.body });
        void trackUse({ data: { id: file.id, kind: "attempt" } });
        return;
      }
      const blob = await (await fetch(result.data.body)).blob();
      setViewer({
        kind: "file",
        id: file.id,
        name: result.data.name,
        mime: result.data.mime || blob.type,
        url: URL.createObjectURL(blob),
      });
    });
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch {
      setNotice("Thao tác thất bại. Thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-line bg-pink">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="flex items-center gap-3 text-left"
              onClick={goHome}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-accent">
                <BookOpen aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block text-lg font-semibold leading-tight text-accent">Thư viện tài liệu</span>
                <span className="block text-sm text-muted">{me ? me.displayName : "Đang tải"}</span>
              </span>
            </button>
            {gate ? null : (
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-pink-deep bg-surface px-4 text-sm font-semibold text-accent"
                onClick={() => {
                  try {
                    sessionStorage.removeItem(NOTICE_CACHE_KEY);
                    sessionStorage.removeItem(FRESH_VISIT_KEY);
                  } catch {
                    /* ignore */
                  }
                  void signOut("/login");
                }}
              >
                <LogOut aria-hidden="true" className="size-4" />
                Đăng xuất
              </button>
            )}
          </div>
          <label className="relative block">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Tìm tài liệu, môn học…"
              aria-label="Tìm tài liệu"
              className="h-12 w-full rounded-full border border-pink-deep bg-surface pr-4 pl-10"
            />
          </label>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-6 pb-16">
        {loading ? <p className="text-sm text-muted">Đang tải tài liệu…</p> : null}
        {error ? <p className="rounded-2xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</p> : null}
        {notice ? <p className="mb-4 rounded-2xl bg-blue px-4 py-3 text-sm text-fg">{notice}</p> : null}
        {!loading && !error && me?.legacyEnabled ? (
          <PasswordBanner
            busy={busy}
            onSave={(password) =>
              run(async () => {
                const result = await changeOwnerPassword({ data: { password } });
                if (!result.ok) {
                  setNotice(result.message);
                  return;
                }
                setNotice("Đã đổi mật khẩu. Từ giờ mật khẩu cũ không còn dùng được.");
                await reload();
              })
            }
          />
        ) : null}
        {!loading && !error && !query.trim() && !panelOpen && !viewer && !subject && notices.length ? (
          <div role="status" className="mb-4 rounded-2xl border border-pink-deep bg-pink px-4 py-3">
            <p className="font-semibold">Thông báo</p>
            <ul className="mt-2 space-y-1 text-sm">
              {notices.map((item) => (
                <li key={item.id}>{item.message}</li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
              onClick={() =>
                run(async () => {
                  const result = await ackNotices();
                  if (!result.ok) {
                    setNotice(result.message);
                    return;
                  }
                  try {
                    sessionStorage.removeItem(NOTICE_CACHE_KEY);
                  } catch {
                    /* ignore */
                  }
                  setNotices([]);
                })
              }
            >
              Đã xem
            </button>
          </div>
        ) : null}
        {!loading && !error && query.trim() ? <SearchResults hits={filtered} /> : null}
        {!loading && !error && !query.trim() && usersOpen && owner ? (
          <PeoplePanel busy={busy} onBack={() => setUsersOpen(false)} onChanged={reload} setNotice={setNotice} run={run} />
        ) : null}
        {!loading && !error && !query.trim() && shareOpen && !owner ? (
          <SharePanel
            subjects={subjects}
            submissions={mySubmissions}
            busy={busy}
            onBack={() => setShareOpen(false)}
            onSubmit={(payload) =>
              run(async () => {
                const result = await submitDocument({ data: payload });
                if (!result.ok) {
                  setNotice(result.message);
                  return;
                }
                setNotice("Đã gửi. Tài liệu đang chờ duyệt.");
                await reload();
              })
            }
          />
        ) : null}
        {!loading && !error && !query.trim() && reviewOpen && owner ? (
          <ReviewPanel
            busy={busy}
            onBack={() => setReviewOpen(false)}
            onChanged={reload}
            setNotice={setNotice}
            run={run}
          />
        ) : null}
        {!loading && !error && !query.trim() && quizOpen && owner ? (
          <QuizAdminPanel onBack={() => setQuizOpen(false)} onChanged={reload} />
        ) : null}
        {!loading && !error && !query.trim() && infoOpen && owner ? (
          <InfoPanel onBack={() => setInfoOpen(false)} setNotice={setNotice} />
        ) : null}
        {!loading && !error && !query.trim() && !panelOpen && viewer?.kind === "practice" ? (
          <section>
            <button type="button" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-2" onClick={() => setViewer(null)}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Quay lại
            </button>
            <h1 className="mb-3 text-2xl font-semibold break-words">{viewer.name}</h1>
            <PracticeRunner documentId={viewer.id} name={viewer.name} html={viewer.html} myUsername={me?.username ?? ""} />
            <PracticeComments documentId={viewer.id} />
          </section>
        ) : null}
        {!loading && !error && !query.trim() && !panelOpen && viewer?.kind === "file" ? (
          <FilePreview
            viewer={viewer}
            onBack={() => setViewer(null)}
            onDownload={() => {
              void trackUse({ data: { id: viewer.id, kind: "download" } });
            }}
          />
        ) : null}
        {!loading && !error && !query.trim() && !panelOpen && !viewer && subject ? (
          <SubjectView
            subject={subject}
            section={section}
            owner={Boolean(owner)}
            busy={busy}
            onBack={() => setSubjectId(null)}
            onSection={setSection}
            onOpen={openFile}
            newSince={newSince}
            pinned={pins}
            onTogglePin={togglePin}
            onDownload={(file) =>
              run(async () => {
                const result = await readDocument({ data: { id: file.id } });
                if (!result.ok) {
                  setNotice(result.message);
                  return;
                }
                const href =
                  result.data.section === "practice"
                    ? URL.createObjectURL(new Blob([result.data.body], { type: "text/html" }))
                    : result.data.body;
                const link = document.createElement("a");
                link.href = href;
                link.download = result.data.name;
                link.click();
                void trackUse({ data: { id: file.id, kind: "download" } });
              })
            }
            onDeleteSubject={() =>
              run(async () => {
                const result = await deleteSubject({ data: { id: subject.id } });
                if (!result.ok) {
                  setNotice(result.message);
                  return;
                }
                setSubjectId(null);
                await reload();
              })
            }
            onDeleteFile={(file) =>
              run(async () => {
                const result = await deleteDocument({ data: { id: file.id } });
                if (!result.ok) {
                  setNotice(result.message);
                  return;
                }
                await reload();
              })
            }
            onUpload={(file) =>
              run(async () => {
                if (file.size > MAX_FILE_BYTES) {
                  setNotice("File quá lớn (tối đa 3 MB).");
                  return;
                }
                const spec = sectionById(section);
                const asText = section === "practice";
                if (asText && !/\.html?$/i.test(file.name)) {
                  setNotice("Mục thực hành chỉ nhận file .html.");
                  return;
                }
                const body = await readFile(file, asText);
                const result = await addDocument({
                  data: {
                    subjectId: subject.id,
                    section,
                    name: file.name,
                    mime: file.type || (asText ? "text/html" : "application/octet-stream"),
                    body,
                    bytes: file.size,
                  },
                });
                if (!result.ok) {
                  setNotice(result.message);
                  return;
                }
                setNotice(spec ? `Đã thêm vào ${spec.label}. Mọi máy sẽ thấy file này.` : "Đã thêm tài liệu.");
                await reload();
              })
            }
          />
        ) : null}
        {!loading && !error && !query.trim() && !panelOpen && !viewer && !subject ? (
          <Home
            subjects={subjects}
            owner={Boolean(owner)}
            previewOwner={Boolean(me?.previewOwner)}
            busy={busy}
            pendingReviews={pendingReviews}
            resetRequests={resetRequests}
            openReports={openReports}
            submissions={mySubmissions}
            pinned={pinnedItems}
            recent={recentItems}
            isNew={subjectHasNew}
            onOpenFile={(file) => void openFile(file)}
            onQuiz={() => {
              goHome();
              setQuizOpen(true);
            }}
            onOpen={(id) => {
              setUsersOpen(false);
              setShareOpen(false);
              setReviewOpen(false);
              setInfoOpen(false);
    setQuizOpen(false);
              setSubjectId(id);
            }}
            onUsers={() => {
              goHome();
              setUsersOpen(true);
            }}
            onShare={() => {
              goHome();
              setShareOpen(true);
              void reload();
            }}
            onReview={() => {
              goHome();
              setReviewOpen(true);
            }}
            onInfo={() => {
              goHome();
              setInfoOpen(true);
            }}
            onAdd={(name) =>
              run(async () => {
                const result = await addSubject({ data: { name } });
                if (!result.ok) {
                  setNotice(result.message);
                  return;
                }
                await reload();
                setSubjectId(result.data.id);
              })
            }
          />
        ) : null}
      </main>
    </div>
  );
}

function Home({
  subjects,
  owner,
  previewOwner,
  busy,
  pendingReviews,
  resetRequests,
  openReports,
  submissions,
  pinned,
  recent,
  isNew,
  onOpenFile,
  onQuiz,
  onOpen,
  onUsers,
  onShare,
  onReview,
  onInfo,
  onAdd,
}: {
  subjects: Subject[];
  owner: boolean;
  previewOwner: boolean;
  busy: boolean;
  pendingReviews: number;
  resetRequests: number;
  openReports: number;
  submissions: MySubmission[];
  pinned: FileEntry[];
  recent: FileEntry[];
  isNew: (subject: Subject) => boolean;
  onOpenFile: (file: FileMeta) => void;
  onQuiz: () => void;
  onOpen: (id: string) => void;
  onUsers: () => void;
  onShare: () => void;
  onReview: () => void;
  onInfo: () => void;
  onAdd: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Môn học</h1>
        {owner ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
              onClick={() => setAdding((open) => !open)}
            >
              <Plus aria-hidden="true" className="size-4" />
              Thêm môn học
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-pink-deep bg-surface px-4 text-sm font-semibold text-accent"
              onClick={onReview}
            >
              <ClipboardCheck aria-hidden="true" className="size-4" />
              Xét duyệt tài liệu
              {pendingReviews > 0 ? (
                <span className="grid min-w-6 place-items-center rounded-full bg-pink px-1.5 text-xs">{pendingReviews}</span>
              ) : null}
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-pink-deep bg-surface px-4 text-sm font-semibold text-accent"
              onClick={onQuiz}
            >
              <Flag aria-hidden="true" className="size-4" />
              Đề trắc nghiệm
              {openReports > 0 ? (
                <span className="grid min-w-6 place-items-center rounded-full bg-pink px-1.5 text-xs">{openReports}</span>
              ) : null}
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-pink-deep bg-surface px-4 text-sm font-semibold text-accent"
              onClick={onInfo}
            >
              <Users aria-hidden="true" className="size-4" />
              Thông tin user
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-pink-deep bg-surface px-4 text-sm font-semibold text-accent"
              onClick={onUsers}
            >
              <Shield aria-hidden="true" className="size-4" />
              Người dùng
              {resetRequests > 0 ? (
                <span className="grid min-w-6 place-items-center rounded-full bg-pink px-1.5 text-xs">{resetRequests}</span>
              ) : null}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
            onClick={onShare}
          >
            <Share2 aria-hidden="true" className="size-4" />
            Chia sẻ tài liệu
          </button>
        )}
      </div>
      {previewOwner ? (
        <p className="mb-4 rounded-2xl bg-blue px-4 py-3 text-sm">
          Bạn đang xem trước với quyền chủ web. Sau khi xuất bản, vào link công khai và đăng nhập Owner — dữ liệu xem trước không chuyển sang bản đã xuất bản.
        </p>
      ) : null}
      {owner && !previewOwner ? (
        <p className="mb-4 rounded-2xl bg-blue px-4 py-3 text-sm">
          Tài liệu bạn tải lên có hiệu lực ngay. Tài liệu thành viên gửi chỉ công khai sau khi bạn duyệt.
        </p>
      ) : null}
      {adding ? (
        <form
          className="mb-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const next = name.trim();
            if (!next) return;
            onAdd(next);
            setName("");
            setAdding(false);
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tên môn học"
            aria-label="Tên môn học"
            className="h-12 min-w-0 flex-1 rounded-xl border border-pink-deep bg-surface px-3"
          />
          <button type="submit" disabled={busy} className="h-12 rounded-full bg-accent-2 px-5 font-semibold text-on-accent disabled:opacity-60">
            Lưu môn
          </button>
        </form>
      ) : null}
      {!owner && submissions.some((item) => item.status === "pending") ? (
        <div className="mb-4 rounded-2xl bg-pink px-4 py-3">
          <p className="font-semibold">Đang chờ duyệt</p>
          <ul className="mt-2 space-y-1 text-sm">
            {submissions
              .filter((item) => item.status === "pending")
              .map((item) => (
                <li key={item.id} className="break-words">
                  {item.name} · {item.subjectName} · {sectionLabel(item.section)}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {pinned.length ? <FileShortcuts title="Đã ghim" items={pinned} onOpen={onOpenFile} /> : null}
      {recent.length ? <FileShortcuts title="Xem gần đây" items={recent} onOpen={onOpenFile} /> : null}
      {subjects.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {subjects.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className={`min-h-24 rounded-2xl px-4 py-5 text-left ${index % 2 === 0 ? "bg-pink" : "bg-blue"}`}
            >
              <span className="block text-lg font-semibold">
                {item.name}
                {isNew(item) ? (
                  <span
                    role="img"
                    aria-label="Có tài liệu mới"
                    className="ml-2 inline-block size-2.5 rounded-full bg-accent align-middle"
                  />
                ) : null}
              </span>
              <span className="text-sm text-muted">
                {countFiles(item)} tài liệu{isNew(item) ? " · có tài liệu mới" : ""}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="py-8 text-muted">
          {owner ? "Chưa có môn học. Hãy thêm môn đầu tiên, rồi tải tài liệu lên." : "Chưa có môn học. Chủ web sẽ sớm cập nhật."}
        </p>
      )}
    </section>
  );
}

function SubjectView({
  subject,
  section,
  owner,
  busy,
  onBack,
  onSection,
  onOpen,
  onDownload,
  onDeleteSubject,
  onDeleteFile,
  onUpload,
  newSince,
  pinned,
  onTogglePin,
}: {
  subject: Subject;
  section: SectionId;
  owner: boolean;
  busy: boolean;
  onBack: () => void;
  onSection: (id: SectionId) => void;
  onOpen: (file: FileMeta) => void;
  onDownload: (file: FileMeta) => void;
  onDeleteSubject: () => void;
  onDeleteFile: (file: FileMeta) => void;
  onUpload: (file: File) => void;
  newSince: number;
  pinned: string[];
  onTogglePin: (id: string) => void;
}) {
  const spec = sectionById(section) ?? SECTIONS[0];
  const files = subject.files[section];
  const [confirmSubject, setConfirmSubject] = useState(false);
  const [confirmFile, setConfirmFile] = useState<string | null>(null);
  return (
    <section>
      <button type="button" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Tất cả môn học
      </button>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{subject.name}</h1>
        {owner ? (
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-pink-deep bg-surface px-4 text-sm font-semibold text-danger"
            onClick={() => {
              if (!confirmSubject) {
                setConfirmSubject(true);
                return;
              }
              onDeleteSubject();
            }}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {confirmSubject ? "Xóa môn này?" : "Xóa môn"}
          </button>
        ) : null}
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Mục tài liệu">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === section}
            className={`h-11 rounded-full border px-4 text-sm font-semibold ${item.id === section ? "border-accent bg-pink text-accent" : "border-pink-deep bg-surface"}`}
            onClick={() => onSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {owner ? (
        <div className="mb-4 rounded-2xl bg-blue px-4 py-3 text-sm">
          <p>{spec.hint}</p>
          <label className="mt-3 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-accent-2 px-4 font-semibold text-on-accent">
            <Upload aria-hidden="true" className="size-4" />
            Tải file lên
            <input
              type="file"
              accept={spec.accept}
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onUpload(file);
              }}
            />
          </label>
        </div>
      ) : null}
      {files.length ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line border-l-4 border-l-blue-deep bg-surface px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">
                  {file.name}
                  {file.createdAt > newSince ? (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 align-middle text-xs font-semibold text-on-accent">Mới</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted">{file.created}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-label={pinned.includes(file.id) ? "Bỏ ghim" : "Ghim tài liệu"}
                  aria-pressed={pinned.includes(file.id)}
                  className={`grid size-11 place-items-center rounded-full border ${pinned.includes(file.id) ? "border-accent bg-pink text-accent" : "border-pink-deep bg-surface"}`}
                  onClick={() => onTogglePin(file.id)}
                >
                  {pinned.includes(file.id) ? <PinOff aria-hidden="true" className="size-4" /> : <Pin aria-hidden="true" className="size-4" />}
                </button>
                <button type="button" className="h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent" onClick={() => onOpen(file)}>
                  {section === "practice" ? "Làm bài" : "Xem"}
                </button>
                <button type="button" className="inline-flex h-11 items-center gap-1 rounded-full border border-pink-deep bg-surface px-4 text-sm font-semibold" onClick={() => onDownload(file)}>
                  <Download aria-hidden="true" className="size-4" />
                  Tải về
                </button>
                {owner ? (
                  <button
                    type="button"
                    className="h-11 rounded-full border border-pink-deep px-4 text-sm font-semibold text-danger"
                    onClick={() => {
                      if (confirmFile !== file.id) {
                        setConfirmFile(file.id);
                        return;
                      }
                      onDeleteFile(file);
                    }}
                  >
                    {confirmFile === file.id ? "Xóa?" : "Xóa"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-muted">Chưa có tài liệu trong mục này.</p>
      )}
    </section>
  );
}

function FilePreview({
  viewer,
  onBack,
  onDownload,
}: {
  viewer: Extract<Viewer, { kind: "file" }>;
  onBack: () => void;
  onDownload: () => void;
}) {
  const office = officeKind(viewer.name, viewer.mime);
  const preview = viewer.mime.startsWith("image/") || viewer.mime === "application/pdf" || office !== null;
  return (
    <section>
      <button type="button" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Quay lại
      </button>
      <h1 className="mb-3 text-2xl font-semibold break-words">{viewer.name}</h1>
      {preview && viewer.mime.startsWith("image/") ? (
        <img src={viewer.url} alt="" className="max-h-[70vh] w-full rounded-2xl border border-line object-contain bg-surface" />
      ) : null}
      {preview && viewer.mime === "application/pdf" ? (
        <iframe title={viewer.name} src={viewer.url} className="h-[78vh] w-full rounded-2xl border border-line bg-surface" />
      ) : null}
      {office ? <OfficePreview url={viewer.url} name={viewer.name} kind={office} /> : null}
      {!preview ? <p className="text-muted">Trình duyệt không xem trực tiếp loại file này. Hãy tải về.</p> : null}
      <a
        href={viewer.url}
        download={viewer.name}
        onClick={onDownload}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
      >
        <Download aria-hidden="true" className="size-4" />
        Tải về
      </a>
    </section>
  );
}

function SearchResults({ hits }: { hits: { key: string; title: string; meta: string; open: () => void }[] }) {
  return (
    <section>
      <h1 className="mb-3 text-2xl font-semibold">Kết quả tìm kiếm ({hits.length})</h1>
      {hits.length ? (
        <ul className="space-y-2">
          {hits.map((hit) => (
            <li key={hit.key}>
              <button type="button" onClick={hit.open} className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left">
                <span className="block font-semibold break-words">{hit.title}</span>
                <span className="text-sm text-muted">{hit.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Không tìm thấy tài liệu phù hợp.</p>
      )}
    </section>
  );
}

function PasswordBanner({ busy, onSave }: { busy: boolean; onSave: (password: string) => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [local, setLocal] = useState("");
  return (
    <div className="mb-4 rounded-2xl border border-pink-deep bg-pink px-4 py-3 text-sm">
      <p className="font-semibold">Đặt mật khẩu mới cho Owner</p>
      <p className="mt-1 text-pretty">
        Mật khẩu cũ từng nằm trong mã trang, người rành kỹ thuật có thể dò được. Hãy đổi sang mật khẩu mới (ít nhất 8 ký tự) để khóa cửa đó.
      </p>
      {open ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (password !== again) {
              setLocal("Hai lần nhập chưa khớp.");
              return;
            }
            setLocal("");
            onSave(password);
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mật khẩu mới"
            aria-label="Mật khẩu mới"
            autoComplete="new-password"
            className="h-12 rounded-xl border border-pink-deep bg-surface px-3"
          />
          <input
            type="password"
            value={again}
            onChange={(event) => setAgain(event.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            aria-label="Nhập lại mật khẩu mới"
            autoComplete="new-password"
            className="h-12 rounded-xl border border-pink-deep bg-surface px-3"
          />
          {local ? <p className="text-danger">{local}</p> : null}
          <button type="submit" disabled={busy} className="h-11 rounded-full bg-accent px-4 font-semibold text-on-accent disabled:opacity-60">
            Lưu mật khẩu mới
          </button>
        </form>
      ) : (
        <button type="button" className="mt-3 h-11 rounded-full bg-accent px-4 font-semibold text-on-accent" onClick={() => setOpen(true)}>
          Đổi mật khẩu
        </button>
      )}
    </div>
  );
}

function PeoplePanel({
  busy,
  onBack,
  onChanged,
  setNotice,
  run,
}: {
  busy: boolean;
  onBack: () => void;
  onChanged: () => Promise<void>;
  setNotice: (value: string) => void;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [username, setUsername] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  useEffect(() => {
    let alive = true;
    listPeople()
      .then((result) => {
        if (!alive) return;
        if (!result.ok) setNotice(result.message);
        else setPeople(result.data);
      })
      .catch(() => {
        if (alive) setNotice("Không tải được danh sách.");
      });
    return () => {
      alive = false;
    };
  }, [setNotice]);

  return (
    <section>
      <button type="button" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Về trang chủ
      </button>
      <h1 className="mb-2 text-2xl font-semibold">Quản lý người dùng</h1>
      <p className="mb-4 text-sm text-pretty text-muted">
        Danh sách gồm mọi tài khoản đã đăng ký, trên mọi máy. Chặn có hiệu lực ngay — người đó không vào thư viện được nữa.
      </p>
      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const name = username.trim();
          if (!name) return;
          void run(async () => {
            const result = await setBlock({ data: { username: name, blocked: true } });
            if (!result.ok) {
              setNotice(result.message);
              return;
            }
            setUsername("");
            const next = await listPeople();
            if (next.ok) setPeople(next.data);
            await onChanged();
          });
        }}
      >
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Tên đăng nhập cần chặn"
          aria-label="Tên đăng nhập cần chặn"
          className="h-12 min-w-0 flex-1 rounded-xl border border-pink-deep bg-surface px-3"
        />
        <button type="submit" disabled={busy} className="h-12 rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-60">
          Chặn
        </button>
      </form>
      {people ? (
        <ul className="space-y-2">
          {[...people].sort((a, b) => Number(b.resetRequested) - Number(a.resetRequested)).map((person) => (
            <li key={person.username} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
              <div>
                <p className="font-semibold">
                  {person.displayName}{" "}
                  {person.role === "owner" ? <span className="text-sm font-medium text-accent">Chủ web</span> : null}
                </p>
                <p className="text-sm text-muted">
                  {person.username}
                  {person.registered ? ` · đăng ký ${person.created}` : " · chưa đăng ký"}
                  {person.blocked ? " · đã chặn" : ""}
                </p>
                {person.resetRequested ? (
                  <p className="mt-1 text-sm font-semibold text-accent">Đã yêu cầu đặt lại mật khẩu</p>
                ) : null}
              </div>
              {person.resetRequested && resetFor === person.username ? (
                <form
                  className="flex w-full flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      const result = await resetUserPassword({
                        data: { username: person.username, password: newPassword },
                      });
                      if (!result.ok) {
                        setNotice(result.message);
                        return;
                      }
                      setNotice(`Đã đặt lại mật khẩu cho ${person.username}. Hãy báo mật khẩu mới cho họ.`);
                      setResetFor(null);
                      setNewPassword("");
                      const next = await listPeople();
                      if (next.ok) setPeople(next.data);
                      await onChanged();
                    });
                  }}
                >
                  <input
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Mật khẩu mới (ít nhất 8 ký tự)"
                    aria-label={`Mật khẩu mới cho ${person.username}`}
                    autoComplete="off"
                    minLength={8}
                    required
                    className="h-11 min-w-0 flex-1 rounded-xl border border-pink-deep bg-surface px-3"
                  />
                  <button type="submit" disabled={busy} className="h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60">
                    Lưu mật khẩu
                  </button>
                  <button
                    type="button"
                    className="h-11 rounded-full border border-pink-deep px-4 text-sm font-semibold"
                    onClick={() => {
                      setResetFor(null);
                      setNewPassword("");
                    }}
                  >
                    Hủy
                  </button>
                </form>
              ) : null}
              {person.resetRequested && resetFor !== person.username ? (
                <button
                  type="button"
                  disabled={busy}
                  className="h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
                  onClick={() => {
                    setResetFor(person.username);
                    setNewPassword("");
                  }}
                >
                  Đặt lại mật khẩu
                </button>
              ) : null}
              {person.role === "owner" ? null : (
                <button
                  type="button"
                  disabled={busy}
                  className="h-11 rounded-full border border-pink-deep px-4 text-sm font-semibold"
                  onClick={() =>
                    void run(async () => {
                      const result = await setBlock({
                        data: { username: person.username, blocked: !person.blocked },
                      });
                      if (!result.ok) {
                        setNotice(result.message);
                        return;
                      }
                      const next = await listPeople();
                      if (next.ok) setPeople(next.data);
                    })
                  }
                >
                  {person.blocked ? "Bỏ chặn" : "Chặn"}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Đang tải danh sách…</p>
      )}
      {people && people.length === 0 ? <p className="text-muted">Chưa có người dùng nào.</p> : null}
    </section>
  );
}

function SharePanel({
  subjects,
  submissions,
  busy,
  onBack,
  onSubmit,
}: {
  subjects: Subject[];
  submissions: MySubmission[];
  busy: boolean;
  onBack: () => void;
  onSubmit: (payload: { subjectId: string; section: SectionId; name: string; mime: string; body: string; bytes: number }) => void;
}) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [section, setSection] = useState<SectionId>("theory");
  const [localError, setLocalError] = useState("");
  const spec = sectionById(section) ?? SECTIONS[0];
  return (
    <section>
      <button type="button" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Về trang chủ
      </button>
      <h1 className="mb-2 text-2xl font-semibold">Chia sẻ tài liệu</h1>
      <p className="mb-4 text-sm text-pretty text-muted">
        File gửi lên sẽ chờ chủ web duyệt. Khi được duyệt, tài liệu mới hiện công khai cho mọi người.
      </p>
      {subjects.length === 0 ? (
        <p className="rounded-2xl bg-blue px-4 py-3 text-sm">Chưa có môn học để chia sẻ. Nhờ chủ web thêm môn trước.</p>
      ) : (
        <form
          className="mb-6 space-y-3 rounded-2xl border border-line bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem("file");
            const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
            if (!file || !subjectId) return;
            if (file.size > MAX_FILE_BYTES) {
              setLocalError("File quá lớn (tối đa 3 MB).");
              return;
            }
            if (section === "practice" && !/\.html?$/i.test(file.name)) {
              setLocalError("Mục thực hành chỉ nhận file .html.");
              return;
            }
            setLocalError("");
            const asText = section === "practice";
            void readFile(file, asText)
              .then((body) => {
                onSubmit({
                  subjectId,
                  section,
                  name: file.name,
                  mime: file.type || (asText ? "text/html" : "application/octet-stream"),
                  body,
                  bytes: file.size,
                });
                if (input instanceof HTMLInputElement) input.value = "";
              })
              .catch(() => setLocalError("Không đọc được file."));
          }}
        >
          <label className="block text-sm font-medium">
            Môn học
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-pink-deep bg-surface px-3 font-normal"
            >
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Mục
            <select
              value={section}
              onChange={(event) => setSection(event.target.value as SectionId)}
              className="mt-1 h-12 w-full rounded-xl border border-pink-deep bg-surface px-3 font-normal"
            >
              {SECTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted">{spec.hint}</p>
          <label className="block text-sm font-medium">
            File
            <input
              name="file"
              type="file"
              required
              accept={spec.accept}
              className="mt-1 block w-full text-sm"
            />
          </label>
          <button type="submit" disabled={busy} className="h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60">
            Gửi duyệt
          </button>
          {localError ? <p className="text-sm text-danger">{localError}</p> : null}
        </form>
      )}
      <h2 className="mb-2 text-lg font-semibold">Tài liệu đã gửi</h2>
      {submissions.length ? (
        <ul className="space-y-2">
          {submissions.map((item) => (
            <li key={item.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="font-semibold break-words">{item.name}</p>
              <p className="text-sm text-muted">
                {item.subjectName} · {sectionLabel(item.section)} · {item.created}
              </p>
              <p className={`mt-1 text-sm font-semibold ${item.status === "rejected" ? "text-danger" : item.status === "approved" ? "text-accent-2" : "text-accent"}`}>
                {statusLabel(item.status)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Bạn chưa gửi tài liệu nào.</p>
      )}
    </section>
  );
}

function ReviewPanel({
  busy,
  onBack,
  onChanged,
  setNotice,
  run,
}: {
  busy: boolean;
  onBack: () => void;
  onChanged: () => Promise<void>;
  setNotice: (value: string) => void;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [preview, setPreview] = useState<{ id: string; name: string; mime: string; section: SectionId; url: string; html: string } | null>(null);

  async function refresh() {
    const result = await listReview();
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setItems(result.data);
  }

  useEffect(() => {
    let alive = true;
    listReview()
      .then((result) => {
        if (!alive) return;
        if (!result.ok) setNotice(result.message);
        else setItems(result.data);
      })
      .catch(() => {
        if (alive) setNotice("Không tải được hàng chờ.");
      });
    return () => {
      alive = false;
    };
  }, [setNotice]);

  return (
    <section>
      <button type="button" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Về trang chủ
      </button>
      <h1 className="mb-2 text-2xl font-semibold">Xét duyệt tài liệu</h1>
      <p className="mb-4 text-sm text-pretty text-muted">
        Chỉ những file bạn duyệt mới xuất hiện công khai. Người gửi sẽ thấy thông báo ở màn hình chính vào lần đăng nhập sau.
      </p>
      {preview ? (
        <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold break-words">{preview.name}</p>
            <button type="button" className="h-11 rounded-full border border-pink-deep px-4 text-sm font-semibold" onClick={() => setPreview(null)}>
              Đóng xem trước
            </button>
          </div>
          {preview.section === "practice" ? (
            <iframe title={preview.name} sandbox="allow-scripts allow-forms allow-modals" srcDoc={preview.html} className="h-[50vh] w-full rounded-2xl border border-line" />
          ) : null}
          {preview.section !== "practice" && preview.mime.startsWith("image/") ? (
            <img src={preview.url} alt="" className="max-h-[50vh] w-full rounded-2xl object-contain" />
          ) : null}
          {preview.section !== "practice" && preview.mime === "application/pdf" ? (
            <iframe title={preview.name} src={preview.url} className="h-[50vh] w-full rounded-2xl border border-line" />
          ) : null}
          {preview.section !== "practice" && officeKind(preview.name, preview.mime) ? (
            <OfficePreview url={preview.url} name={preview.name} kind={officeKind(preview.name, preview.mime)!} heightClass="h-[50vh]" />
          ) : null}
          {preview.section !== "practice" &&
          !preview.mime.startsWith("image/") &&
          preview.mime !== "application/pdf" &&
          !officeKind(preview.name, preview.mime) ? (
            <p className="text-sm text-muted">Trình duyệt không xem trực tiếp loại file này.</p>
          ) : null}
        </div>
      ) : null}
      {items ? (
        items.length ? (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
                <p className="font-semibold break-words">{item.name}</p>
                <p className="text-sm text-muted">
                  {item.authorName} ({item.authorUsername}) · {item.subjectName} · {sectionLabel(item.section)} · {item.created}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="h-11 rounded-full border border-pink-deep px-4 text-sm font-semibold"
                    onClick={() =>
                      void run(async () => {
                        const result = await readSubmission({ data: { id: item.id } });
                        if (!result.ok) {
                          setNotice(result.message);
                          return;
                        }
                        const url =
                          result.data.section === "practice"
                            ? ""
                            : URL.createObjectURL(await (await fetch(result.data.body)).blob());
                        setPreview({
                          id: item.id,
                          name: result.data.name,
                          mime: result.data.mime,
                          section: result.data.section,
                          url,
                          html: result.data.section === "practice" ? result.data.body : "",
                        });
                      })
                    }
                  >
                    Xem
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60"
                    onClick={() =>
                      void run(async () => {
                        const result = await reviewSubmission({ data: { id: item.id, approve: true } });
                        if (!result.ok) {
                          setNotice(result.message);
                          return;
                        }
                        if (preview?.id === item.id) setPreview(null);
                        setNotice("Đã duyệt. Tài liệu đã được công khai.");
                        await refresh();
                        await onChanged();
                      })
                    }
                  >
                    Duyệt
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="h-11 rounded-full border border-pink-deep px-4 text-sm font-semibold text-danger disabled:opacity-60"
                    onClick={() =>
                      void run(async () => {
                        const result = await reviewSubmission({ data: { id: item.id, approve: false } });
                        if (!result.ok) {
                          setNotice(result.message);
                          return;
                        }
                        if (preview?.id === item.id) setPreview(null);
                        setNotice("Đã từ chối tài liệu này.");
                        await refresh();
                        await onChanged();
                      })
                    }
                  >
                    Từ chối
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Không có tài liệu nào đang chờ duyệt.</p>
        )
      ) : (
        <p className="text-sm text-muted">Đang tải hàng chờ…</p>
      )}
    </section>
  );
}

function InfoPanel({ onBack, setNotice }: { onBack: () => void; setNotice: (value: string) => void }) {
  const [people, setPeople] = useState<Participant[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listParticipants()
      .then((result) => {
        if (!alive) return;
        if (!result.ok) setNotice(result.message);
        else setPeople(result.data);
      })
      .catch(() => {
        if (alive) setNotice("Không tải được danh sách.");
      });
    return () => {
      alive = false;
    };
  }, [setNotice]);

  return (
    <section>
      <button type="button" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Về trang chủ
      </button>
      <h1 className="mb-2 text-2xl font-semibold">Thông tin user</h1>
      <p className="mb-4 text-sm text-pretty text-muted">
        Họ và tên từng người tham gia. Bấm vào tên để xem số lần tải tài liệu, môn học và số lần làm từng đề.
      </p>
      {people ? (
        <ul className="space-y-2">
          {people.map((person) => (
            <li key={person.userId} className="rounded-2xl border border-line bg-surface px-4 py-3">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setOpenId((current) => (current === person.userId ? null : person.userId))}
              >
                <span className="block font-semibold">
                  {person.displayName}
                  {person.role === "owner" ? <span className="ml-2 text-sm font-medium text-accent">Chủ web</span> : null}
                  {person.blocked ? <span className="ml-2 text-sm font-medium text-danger">Đã chặn</span> : null}
                </span>
                <span className="text-sm text-muted">{person.username}</span>
              </button>
              {openId === person.userId ? <UserDetail userId={person.userId} setNotice={setNotice} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Đang tải danh sách…</p>
      )}
      {people && people.length === 0 ? <p className="text-muted">Chưa có người tham gia.</p> : null}
    </section>
  );
}

function UserDetail({ userId, setNotice }: { userId: string; setNotice: (value: string) => void }) {
  const [stats, setStats] = useState<UserStats | null>(null);
  useEffect(() => {
    let alive = true;
    userActivity({ data: { userId } })
      .then((result) => {
        if (!alive) return;
        if (!result.ok) setNotice(result.message);
        else setStats(result.data);
      })
      .catch(() => {
        if (alive) setNotice("Không tải được thông tin.");
      });
    return () => {
      alive = false;
    };
  }, [setNotice, userId]);
  if (!stats) return <p className="mt-3 text-sm text-muted">Đang tải…</p>;
  const quizCount = stats.quizzes.length;
  const attemptSum = stats.quizzes.reduce((sum, quiz) => sum + quiz.attempts, 0);
  return (
    <div className="mt-3 border-t border-line pt-3 text-sm">
      <p className="font-semibold">Số lần tải tài liệu</p>
      <p className="text-2xl font-semibold text-accent">{stats.downloads}</p>
      <p className="mt-3 font-semibold">Môn</p>
      {stats.subjects.length ? (
        <ul className="mt-1 space-y-1">
          {stats.subjects.map((item) => (
            <li key={item.name}>
              {item.name} — {item.downloads} lần tải
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Chưa tải tài liệu nào.</p>
      )}
      <p className="mt-3 font-semibold">Số lần làm đề</p>
      <p className="text-muted">
        {quizCount} đề, tổng {attemptSum} lần
      </p>
      {stats.quizzes.length ? (
        <ul className="mt-1 space-y-1">
          {stats.quizzes.map((quiz) => (
            <li key={`${quiz.subject}-${quiz.name}`} className="break-words">
              {quiz.subject} · {quiz.name} — {quiz.attempts} lần
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Chưa làm đề nào.</p>
      )}
    </div>
  );
}

function PracticeComments({ documentId }: { documentId: string }) {
  const [items, setItems] = useState<CommentItem[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const result = await listComments({ data: { documentId } });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setItems(result.data);
    setError("");
  }

  useEffect(() => {
    let alive = true;
    listComments({ data: { documentId } })
      .then((result) => {
        if (!alive) return;
        if (!result.ok) setError(result.message);
        else setItems(result.data);
      })
      .catch(() => {
        if (alive) setError("Không tải được bình luận.");
      });
    return () => {
      alive = false;
    };
  }, [documentId]);

  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-lg font-semibold">Bình luận</h2>
      <p className="mb-3 text-sm text-muted">Mọi người trong thư viện đều thấy bình luận của bài này.</p>
      {items ? (
        items.length ? (
          <ul className="mb-4 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl bg-pink px-3 py-2">
                <p className="text-sm">
                  <span className="font-semibold">{item.author}</span>
                  <span className="text-muted"> · {item.created}</span>
                </p>
                <p className="break-words">{item.body}</p>
                {item.canDelete ? (
                  <button
                    type="button"
                    className="mt-1 text-sm font-semibold text-danger"
                    onClick={() => {
                      if (busy) return;
                      setBusy(true);
                      void deleteComment({ data: { id: item.id } })
                        .then((result) => {
                          if (!result.ok) {
                            setError(result.message);
                            return;
                          }
                          return refresh();
                        })
                        .catch(() => setError("Không xóa được bình luận."))
                        .finally(() => setBusy(false));
                    }}
                  >
                    Xóa
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-muted">Chưa có bình luận. Hãy là người đầu tiên.</p>
        )
      ) : (
        <p className="mb-4 text-sm text-muted">Đang tải bình luận…</p>
      )}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const body = text.trim();
          if (!body || busy) return;
          setBusy(true);
          setError("");
          void addComment({ data: { documentId, body } })
            .then((result) => {
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setText("");
              return refresh();
            })
            .catch(() => setError("Không gửi được bình luận."))
            .finally(() => setBusy(false));
        }}
      >
        <label className="block text-sm font-medium">
          Viết bình luận
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Mọi người cùng xem được bình luận này"
            className="mt-1 w-full rounded-xl border border-pink-deep bg-surface px-3 py-2 font-normal"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" disabled={busy || !text.trim()} className="h-11 rounded-full bg-accent-2 px-4 text-sm font-semibold text-on-accent disabled:opacity-60">
          Gửi
        </button>
      </form>
    </section>
  );
}

function FileShortcuts({ title, items, onOpen }: { title: string; items: FileEntry[]; onOpen: (file: FileMeta) => void }) {
  return (
    <div className="mb-4">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <ul className="space-y-2">
        {items.map(({ file, subject }) => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => onOpen(file)}
              className="w-full rounded-2xl border border-line border-l-4 border-l-blue-deep bg-surface px-4 py-3 text-left"
            >
              <span className="block font-semibold break-words">{file.name}</span>
              <span className="block text-sm text-muted">
                {subject.name} · {sectionLabel(file.section)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ReportDraft = { chapter: string; qn: string; question: string };

function PracticeRunner({
  documentId,
  name,
  html,
  myUsername,
}: {
  documentId: string;
  name: string;
  html: string;
  myUsername: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastChapter, setLastChapter] = useState("");
  const [status, setStatus] = useState("");
  const [review, setReview] = useState<{ id: number; items: WrongQuestion[] } | null>(null);
  const [report, setReport] = useState<ReportDraft | null>(null);
  const srcDoc = useMemo(() => withQuizHook(html, review?.items ?? null), [html, review]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;
      if (data.__quizReport === 1) {
        setReport({
          chapter: typeof data.chapter === "string" ? data.chapter : "",
          qn: typeof data.qn === "string" ? data.qn : "",
          question: typeof data.question === "string" ? data.question : "",
        });
        return;
      }
      if (data.__quizResult !== 1) return;
      if (typeof data.chapter !== "string" || typeof data.score !== "number" || typeof data.total !== "number") return;
      const chapter = data.chapter;
      if (chapter === REVIEW_CHAPTER) {
        setStatus("Xong phần ôn tập. Lượt ôn không tính vào bảng xếp hạng.");
        return;
      }
      setStatus("Đang lưu điểm…");
      void submitScore({ data: { documentId, chapter, score: data.score, total: data.total, wrong: data.wrong } })
        .then((result) => {
          if (!result.ok) {
            setStatus(result.message);
            return;
          }
          setStatus("Đã lưu điểm vào bảng xếp hạng.");
          setLastChapter(chapter);
          setRefreshKey((key) => key + 1);
        })
        .catch(() => setStatus("Không lưu được điểm."));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [documentId]);

  return (
    <>
      {review ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-blue px-4 py-2 text-sm">
          <span>Đang ôn {review.items.length} câu làm sai.</span>
          <button
            type="button"
            className="h-10 rounded-full border border-pink-deep bg-surface px-4 font-semibold"
            onClick={() => {
              setReview(null);
              setStatus("");
            }}
          >
            Thoát ôn tập
          </button>
        </div>
      ) : null}
      <iframe
        key={review ? `review-${review.id}` : "main"}
        ref={frame}
        title={name}
        sandbox="allow-scripts allow-forms allow-modals"
        srcDoc={srcDoc}
        className="h-[70vh] w-full rounded-2xl border border-line bg-surface"
      />
      {status ? (
        <p className="mt-2 text-sm text-muted" role="status">
          {status}
        </p>
      ) : null}
      {report ? (
        <ReportDialog
          documentId={documentId}
          draft={report}
          onClose={() => setReport(null)}
          onSent={() => setStatus("Đã gửi báo lỗi cho chủ web. Cảm ơn bạn!")}
        />
      ) : null}
      <Leaderboard documentId={documentId} refreshKey={refreshKey} focusChapter={lastChapter} myUsername={myUsername} />
      <MyHistory
        documentId={documentId}
        refreshKey={refreshKey}
        onReview={(items) => {
          setReview({ id: Date.now(), items });
          setStatus("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </>
  );
}

function ReportDialog({
  documentId,
  draft,
  onClose,
  onSent,
}: {
  documentId: string;
  draft: ReportDraft;
  onClose: () => void;
  onSent: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-label="Báo lỗi câu hỏi">
      <form
        className="w-full max-w-md rounded-2xl bg-surface p-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setMessage("");
          void submitReport({
            data: { documentId, chapter: draft.chapter, question: `${draft.qn}: ${draft.question}`, note },
          })
            .then((result) => {
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              onSent();
              onClose();
            })
            .catch(() => setMessage("Không gửi được. Thử lại."))
            .finally(() => setBusy(false));
        }}
      >
        <h2 className="text-lg font-semibold">Báo lỗi câu hỏi</h2>
        <p className="mt-1 text-sm text-muted break-words">
          {draft.qn}: {draft.question}
        </p>
        <label className="mt-3 block text-sm font-semibold" htmlFor="report-note">
          Lỗi ở đâu?
        </label>
        <textarea
          id="report-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Ví dụ: đáp án đúng phải là B, hoặc câu hỏi bị thiếu chữ"
          className="mt-1 w-full rounded-xl border border-pink-deep bg-surface px-3 py-2"
        />
        {message ? <p className="mt-2 text-sm text-danger">{message}</p> : null}
        <div className="mt-3 flex gap-2">
          <button type="submit" disabled={busy} className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-60">
            Gửi báo lỗi
          </button>
          <button type="button" className="h-11 rounded-full border border-pink-deep px-5 text-sm font-semibold" onClick={onClose}>
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}

function MyHistory({
  documentId,
  refreshKey,
  onReview,
}: {
  documentId: string;
  refreshKey: number;
  onReview: (items: WrongQuestion[]) => void;
}) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    myHistory({ data: { documentId } })
      .then((result) => {
        if (!alive) return;
        if (result.ok) setItems(result.data);
        else setMessage(result.message);
      })
      .catch(() => {
        if (alive) setMessage("Không tải được lịch sử.");
      });
    return () => {
      alive = false;
    };
  }, [documentId, refreshKey]);

  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-lg font-semibold">Lịch sử làm bài của tôi</h2>
      {message ? <p className="mb-2 text-sm text-muted">{message}</p> : null}
      {items && !items.length ? <p className="text-sm text-muted">Bạn chưa nộp bài nào ở đề này.</p> : null}
      {items?.length ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-3">
              <div>
                <p className="font-semibold">
                  Chương {item.chapter} · {Math.round((item.score / Math.max(1, item.total)) * 100) / 10}/10
                </p>
                <p className="text-sm text-muted">
                  {item.score}/{item.total} câu đúng · {item.created}
                </p>
              </div>
              {item.wrongCount > 0 ? (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  className="h-11 rounded-full bg-accent-2 px-4 text-sm font-semibold text-on-accent disabled:opacity-60"
                  onClick={() => {
                    setBusyId(item.id);
                    setMessage("");
                    void loadWrong({ data: { id: item.id } })
                      .then((result) => {
                        if (!result.ok) setMessage(result.message);
                        else if (!result.data.length) setMessage("Lần làm này không còn dữ liệu câu sai.");
                        else onReview(result.data);
                      })
                      .catch(() => setMessage("Không tải được câu sai."))
                      .finally(() => setBusyId(""));
                  }}
                >
                  Ôn {item.wrongCount} câu sai
                </button>
              ) : (
                <span className="text-sm text-muted">Đúng hết</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function QuizAdminPanel({ onBack, onChanged }: { onBack: () => void; onChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<"stats" | "reports">("stats");
  const [stats, setStats] = useState<QuizStat[] | null>(null);
  const [reports, setReports] = useState<ReportItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    quizStats()
      .then((result) => {
        if (!alive) return;
        if (result.ok) setStats(result.data);
        else setError(result.message);
      })
      .catch(() => {
        if (alive) setError("Không tải được thống kê.");
      });
    listReports()
      .then((result) => {
        if (!alive) return;
        if (result.ok) setReports(result.data);
        else setError(result.message);
      })
      .catch(() => {
        if (alive) setError("Không tải được báo lỗi.");
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section>
      <button type="button" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Về trang chủ
      </button>
      <h1 className="mb-3 text-2xl font-semibold">Đề trắc nghiệm</h1>
      {error ? <p className="mb-3 rounded-2xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</p> : null}
      <div role="tablist" className="mb-4 flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stats"}
          onClick={() => setTab("stats")}
          className={`h-11 rounded-full border px-4 text-sm font-semibold ${tab === "stats" ? "border-accent bg-pink text-accent" : "border-pink-deep bg-surface"}`}
        >
          Thống kê
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "reports"}
          onClick={() => setTab("reports")}
          className={`h-11 rounded-full border px-4 text-sm font-semibold ${tab === "reports" ? "border-accent bg-pink text-accent" : "border-pink-deep bg-surface"}`}
        >
          Báo lỗi{reports?.length ? ` (${reports.length})` : ""}
        </button>
      </div>
      {tab === "stats" ? (
        stats ? (
          stats.length ? (
            <>
              <p className="mb-3 text-sm text-muted">Đề có điểm trung bình thấp nhất xếp trước, đề chưa ai làm xếp cuối.</p>
              <ul className="space-y-2">
                {stats.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
                    <p className="font-semibold break-words">{item.name}</p>
                    <p className="text-sm text-muted">{item.subjectName}</p>
                    {item.attempts ? (
                      <>
                        <p className="mt-1 text-sm">
                          {item.attempts} lượt · {item.people} người · điểm trung bình{" "}
                          <span className={`font-semibold ${item.average < 5 ? "text-danger" : "text-accent"}`}>{item.average}/10</span>
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                          {item.chapters.map((chapter) => (
                            <li key={chapter.chapter} className="rounded-full bg-pink px-3 py-1">
                              Chương {chapter.chapter}: {chapter.average}/10 ({chapter.attempts} lượt)
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted">Chưa ai làm.</p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-muted">Chưa có đề thực hành nào.</p>
          )
        ) : (
          <p className="text-sm text-muted">Đang tải…</p>
        )
      ) : null}
      {tab === "reports" ? (
        reports ? (
          reports.length ? (
            <ul className="space-y-2">
              {reports.map((item) => (
                <li key={item.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="font-semibold break-words">{item.documentName}</p>
                  <p className="text-sm text-muted">
                    {item.subjectName} · Chương {item.chapter} · {item.author} ({item.username}) · {item.created}
                  </p>
                  <p className="mt-2 text-sm break-words text-muted">{item.question}</p>
                  <p className="mt-1 break-words">{item.note}</p>
                  <button
                    type="button"
                    className="mt-3 h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
                    onClick={() => {
                      void resolveReport({ data: { id: item.id } })
                        .then((result) => {
                          if (!result.ok) {
                            setError(result.message);
                            return;
                          }
                          setReports((list) => (list ? list.filter((row) => row.id !== item.id) : list));
                          void onChanged();
                        })
                        .catch(() => setError("Không xử lý được. Thử lại."));
                    }}
                  >
                    Đã xử lý
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Chưa có báo lỗi nào.</p>
          )
        ) : (
          <p className="text-sm text-muted">Đang tải…</p>
        )
      ) : null}
    </section>
  );
}

function Leaderboard({
  documentId,
  refreshKey,
  focusChapter,
  myUsername,
}: {
  documentId: string;
  refreshKey: number;
  focusChapter: string;
  myUsername: string;
}) {
  const [chapters, setChapters] = useState<LeaderboardChapter[] | null>(null);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    listLeaderboard({ data: { documentId } })
      .then((result) => {
        if (!alive) return;
        if (!result.ok) setError(result.message);
        else {
          setError("");
          setChapters(result.data);
        }
      })
      .catch(() => {
        if (alive) setError("Không tải được bảng xếp hạng.");
      });
    return () => {
      alive = false;
    };
  }, [documentId, refreshKey]);

  useEffect(() => {
    if (focusChapter) setPicked(focusChapter);
  }, [focusChapter]);

  const current = chapters?.find((item) => item.chapter === picked) ?? chapters?.[0];
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-lg font-semibold">Bảng xếp hạng</h2>
      {error ? <p className="text-sm text-muted">{error}</p> : null}
      {!error && !chapters ? <p className="text-sm text-muted">Đang tải…</p> : null}
      {chapters && !chapters.length ? (
        <p className="text-sm text-muted">Chưa có ai nộp bài. Làm xong và bấm Nộp bài để lên bảng.</p>
      ) : null}
      {chapters && chapters.length > 1 ? (
        <div role="tablist" className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {chapters.map((item) => (
            <button
              key={item.chapter}
              type="button"
              role="tab"
              aria-selected={item.chapter === current?.chapter}
              onClick={() => setPicked(item.chapter)}
              className={`h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${item.chapter === current?.chapter ? "border-accent bg-pink text-accent" : "border-pink-deep bg-surface"}`}
            >
              Chương {item.chapter}
            </button>
          ))}
        </div>
      ) : null}
      {current && current.rows.length ? (
        <ol className="space-y-2">
          {current.rows.map((row, index) => (
            <li
              key={row.username}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${row.username === myUsername ? "border-accent bg-pink" : "border-line"}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-8 shrink-0 text-center font-semibold">{medals[index] ?? index + 1}</span>
                <span className="min-w-0">
                  <span className="block font-semibold break-words">
                    {row.name}
                    {row.username === myUsername ? " (bạn)" : ""}
                  </span>
                  <span className="block text-xs text-muted">{row.created}</span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold text-accent">{(Math.round((row.score / row.total) * 100) / 10).toString()}/10</span>
                <span className="block text-xs text-muted">
                  {row.score}/{row.total} câu
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
