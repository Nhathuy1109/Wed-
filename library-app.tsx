import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Download,
  FolderOpen,
  LogOut,
  Plus,
  Search,
  SearchX,
  Share2,
  Shield,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { LIBRARY_NOTICE_KEY } from "@/components/library/auth-screen";
import { LeaderboardList } from "@/components/library/leaderboard";
import {
  Avatar,
  BottomNav,
  EmptyState,
  FileIcon,
  Skeleton,
  SkeletonGrid,
  SkeletonList,
  Switch,
  ThemePicker,
  kindLabel,
  type TabId,
} from "@/components/library/ui";
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
  listNotices,
  listParticipants,
  listPeople,
  listReview,
  loadLibrary,
  myStats,
  readDocument,
  readSubmission,
  resetUserPassword,
  reviewSubmission,
  setAnonymous,
  setBlock,
  submitDocument,
  trackUse,
  userActivity,
} from "@/lib/library/api";
import {
  FRESH_VISIT_KEY,
  fileKind,
  formatBytes,
  MAX_FILE_BYTES,
  NOTICE_CACHE_KEY,
  SECTIONS,
  sectionById,
  type CommentItem,
  type FileMeta,
  type LibraryNotice,
  type Member,
  type MySubmission,
  type MyStats,
  type Participant,
  type Person,
  type ReviewItem,
  type SectionId,
  type Subject,
  type UserStats,
} from "@/lib/library/ids";

const subscribeNone = () => () => {};

function useGateSession(): boolean {
  return useSyncExternalStore(subscribeNone, hasGateSessionMarker, () => false);
}

type Viewer =
  | { kind: "practice"; id: string; name: string; html: string }
  | { kind: "file"; id: string; name: string; url: string; mime: string };

type Panel = "users" | "share" | "review" | "info";

type SearchHit = { key: string; title: string; meta: string; icon: ReactNode; open: () => void };

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

function dateValue(created: string): number {
  const [d, m, y] = created.split("/").map(Number);
  return Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y) ? Date.UTC(y, m - 1, d) : 0;
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
  const [notices, setNotices] = useState<LibraryNotice[]>(readCachedNotices);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabId>("home");
  const [practiceView, setPracticeView] = useState<"quizzes" | "rank">("quizzes");
  const [rankVersion, setRankVersion] = useState(0);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>("theory");
  const [panel, setPanel] = useState<Panel | null>(null);
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
        remember(result);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function scrollTop() {
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  /** Chạm vào tab: về màn gốc của tab đó (đóng môn, đề đang mở, bảng quản lý). */
  function selectTab(next: TabId) {
    setTab(next);
    setPanel(null);
    setViewer(null);
    setQuery("");
    setNotice("");
    setSubjectId(null);
    scrollTop();
  }

  function openSubject(id: string, nextSection?: SectionId) {
    setTab("subjects");
    setPanel(null);
    setViewer(null);
    setQuery("");
    setSubjectId(id);
    if (nextSection) setSection(nextSection);
    scrollTop();
  }

  function openPanel(next: Panel) {
    setTab("me");
    setViewer(null);
    setQuery("");
    setSubjectId(null);
    setPanel(next);
    if (next === "share") void reload();
    scrollTop();
  }

  const subject = subjects.find((item) => item.id === subjectId) ?? null;
  const owner = me?.role === "owner";

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const hits: SearchHit[] = [];
    for (const item of subjects) {
      if (item.name.toLowerCase().includes(needle)) {
        hits.push({
          key: `s-${item.id}`,
          title: item.name,
          meta: "Môn học",
          icon: (
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue text-accent-2">
              <BookOpen aria-hidden="true" className="size-5" />
            </span>
          ),
          open: () => openSubject(item.id),
        });
      }
      for (const group of SECTIONS) {
        for (const file of item.files[group.id]) {
          if (!file.name.toLowerCase().includes(needle)) continue;
          hits.push({
            key: file.id,
            title: file.name,
            meta: `${item.name} · ${group.label}`,
            icon: <FileIcon name={file.name} mime={file.mime} section={file.section} />,
            open: () => openSubject(item.id, group.id),
          });
        }
      }
    }
    return hits;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, subjects]);

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

  function openFile(file: FileMeta) {
    return run(async () => {
      const result = await readDocument({ data: { id: file.id } });
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      if (result.data.section === "practice") {
        setViewer({ kind: "practice", id: file.id, name: result.data.name, html: result.data.body });
        void trackUse({ data: { id: file.id, kind: "attempt" } });
        scrollTop();
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
      scrollTop();
    });
  }

  function downloadFile(file: FileMeta) {
    return run(async () => {
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
    });
  }

  function toggleAnonymous(next: boolean) {
    void run(async () => {
      const result = await setAnonymous({ data: { anonymous: next } });
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      setMe((current) => (current ? { ...current, anonymous: result.data.anonymous } : current));
      setRankVersion((value) => value + 1);
      setNotice(
        next
          ? "Đã bật ẩn danh. Người khác chỉ thấy “Ẩn danh” trên bảng xếp hạng."
          : "Đã tắt ẩn danh. Tên bạn hiện lại trên bảng xếp hạng.",
      );
    });
  }

  const idle = !loading && !error && !query.trim() && !panel && !viewer;
  const badges: Partial<Record<TabId, number>> = owner ? { me: pendingReviews + resetRequests } : {};

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-line bg-pink">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 pt-3 pb-3">
          <button type="button" className="flex items-center gap-3 text-left" onClick={() => selectTab("home")}>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-accent">
              <BookOpen aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-lg leading-tight font-semibold text-accent">Thư viện tài liệu</span>
              <span className="block text-sm text-muted">{me ? me.displayName : "Đang tải"}</span>
            </span>
          </button>
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
      <main className="has-bottom-nav mx-auto w-full max-w-4xl px-4 py-5">
        {loading ? <SkeletonGrid items={4} /> : null}
        {error ? <p className="rounded-2xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</p> : null}
        {notice ? (
          <p role="status" className="mb-4 rounded-2xl bg-blue px-4 py-3 text-sm text-fg">
            {notice}
          </p>
        ) : null}
        {!loading && !error && !query.trim() && !panel && !viewer && me?.legacyEnabled && tab === "me" ? (
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
        {!loading && !error && query.trim() ? <SearchResults hits={filtered} /> : null}
        {!loading && !error && !query.trim() && panel === "users" && owner ? (
          <PeoplePanel busy={busy} onBack={() => setPanel(null)} onChanged={reload} setNotice={setNotice} run={run} />
        ) : null}
        {!loading && !error && !query.trim() && panel === "share" && !owner ? (
          <SharePanel
            subjects={subjects}
            submissions={mySubmissions}
            busy={busy}
            onBack={() => setPanel(null)}
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
        {!loading && !error && !query.trim() && panel === "review" && owner ? (
          <ReviewPanel busy={busy} onBack={() => setPanel(null)} onChanged={reload} setNotice={setNotice} run={run} />
        ) : null}
        {!loading && !error && !query.trim() && panel === "info" && owner ? (
          <InfoPanel onBack={() => setPanel(null)} setNotice={setNotice} />
        ) : null}
        {!loading && !error && !query.trim() && !panel && viewer?.kind === "practice" ? (
          <section>
            <button type="button" className="mb-3 inline-flex h-11 items-center gap-1 text-sm font-semibold text-accent-2" onClick={() => setViewer(null)}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Quay lại
            </button>
            <h1 className="mb-3 text-2xl font-semibold break-words">{viewer.name}</h1>
            <iframe
              title={viewer.name}
              sandbox="allow-scripts allow-forms allow-modals"
              srcDoc={viewer.html}
              className="h-[70vh] w-full rounded-2xl border border-line bg-white"
            />
            <PracticeComments documentId={viewer.id} />
          </section>
        ) : null}
        {!loading && !error && !query.trim() && !panel && viewer?.kind === "file" ? (
          <FilePreview
            viewer={viewer}
            onBack={() => setViewer(null)}
            onDownload={() => {
              void trackUse({ data: { id: viewer.id, kind: "download" } });
            }}
          />
        ) : null}
        {idle && tab === "home" ? (
          <HomeTab
            me={me}
            subjects={subjects}
            notices={notices}
            busy={busy}
            rankVersion={rankVersion}
            onOpenSubject={openSubject}
            onSeeRanking={() => {
              setPracticeView("rank");
              selectTab("practice");
            }}
            onSeeSubjects={() => selectTab("subjects")}
            onAck={() =>
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
          />
        ) : null}
        {idle && tab === "subjects" && subject ? (
          <SubjectView
            subject={subject}
            section={section}
            owner={Boolean(owner)}
            busy={busy}
            onBack={() => setSubjectId(null)}
            onSection={setSection}
            onOpen={openFile}
            onDownload={downloadFile}
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
        {idle && tab === "subjects" && !subject ? (
          <SubjectsTab
            subjects={subjects}
            owner={Boolean(owner)}
            busy={busy}
            onOpen={(id) => openSubject(id)}
            onAdd={(name) =>
              run(async () => {
                const result = await addSubject({ data: { name } });
                if (!result.ok) {
                  setNotice(result.message);
                  return;
                }
                await reload();
                openSubject(result.data.id);
              })
            }
          />
        ) : null}
        {idle && tab === "practice" ? (
          <PracticeTab
            subjects={subjects}
            view={practiceView}
            onView={setPracticeView}
            me={me}
            busy={busy}
            rankVersion={rankVersion}
            onOpenQuiz={openFile}
            onToggleAnonymous={toggleAnonymous}
          />
        ) : null}
        {idle && tab === "me" ? (
          <MeTab
            me={me}
            gate={gate}
            busy={busy}
            pendingReviews={pendingReviews}
            resetRequests={resetRequests}
            submissions={mySubmissions}
            onOpenPanel={openPanel}
            onToggleAnonymous={toggleAnonymous}
          />
        ) : null}
      </main>
      <BottomNav active={tab} badges={badges} onChange={selectTab} />
    </div>
  );
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

function StatTile({ value, label, tone }: { value: number | string; label: string; tone: "pink" | "blue" }) {
  return (
    <div className={`rounded-2xl px-3 py-3 text-center ${tone === "pink" ? "bg-pink" : "bg-blue"}`}>
      <p className="text-2xl leading-none font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function HomeTab({
  me,
  subjects,
  notices,
  busy,
  rankVersion,
  onOpenSubject,
  onSeeRanking,
  onSeeSubjects,
  onAck,
}: {
  me: Member | null;
  subjects: Subject[];
  notices: LibraryNotice[];
  busy: boolean;
  rankVersion: number;
  onOpenSubject: (id: string, section?: SectionId) => void;
  onSeeRanking: () => void;
  onSeeSubjects: () => void;
  onAck: () => void;
}) {
  const totalDocs = subjects.reduce((sum, item) => sum + countFiles(item), 0);
  const totalQuizzes = subjects.reduce((sum, item) => sum + item.files.practice.length, 0);
  const recent = useMemo(() => {
    const items = subjects.flatMap((item) =>
      SECTIONS.flatMap((group) =>
        item.files[group.id].map((file, index) => ({ file, subject: item, index })),
      ),
    );
    return items
      .sort((a, b) => dateValue(b.file.created) - dateValue(a.file.created) || b.index - a.index)
      .slice(0, 5);
  }, [subjects]);

  return (
    <section className="space-y-6">
      {notices.length ? (
        <div role="status" className="rounded-2xl border border-pink-deep bg-pink px-4 py-3">
          <p className="font-semibold">Thông báo</p>
          <ul className="mt-2 space-y-1 text-sm">
            {notices.map((item) => (
              <li key={item.id}>{item.message}</li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            className="mt-3 h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-60"
            onClick={onAck}
          >
            Đã xem
          </button>
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold">Xin chào{me ? `, ${me.displayName}` : ""}</h1>
        <p className="text-sm text-muted">Chọn môn để xem tài liệu, hoặc vào Ôn tập để làm đề.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatTile value={subjects.length} label="môn học" tone="pink" />
        <StatTile value={totalDocs} label="tài liệu" tone="blue" />
        <StatTile value={totalQuizzes} label="đề thực hành" tone="pink" />
      </div>
      <div>
        <SectionTitle>Mới thêm</SectionTitle>
        {recent.length ? (
          <ul className="space-y-2">
            {recent.map(({ file, subject }) => (
              <li key={file.id}>
                <button
                  type="button"
                  onClick={() => onOpenSubject(subject.id, file.section)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2 text-left"
                >
                  <FileIcon name={file.name} mime={file.mime} section={file.section} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{file.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {subject.name} · {sectionLabel(file.section)} · {file.created}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="Chưa có tài liệu nào"
            hint="Khi chủ web thêm tài liệu, chúng sẽ hiện ở đây."
            action={
              subjects.length ? null : (
                <button type="button" onClick={onSeeSubjects} className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent">
                  Xem môn học
                </button>
              )
            }
          />
        )}
      </div>
      <div>
        <SectionTitle
          action={
            <button type="button" onClick={onSeeRanking} className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-accent-2">
              Xem tất cả
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          }
        >
          Xếp hạng ôn tập
        </SectionTitle>
        <LeaderboardList limit={3} version={rankVersion} />
      </div>
    </section>
  );
}

function SubjectsTab({
  subjects,
  owner,
  busy,
  onOpen,
  onAdd,
}: {
  subjects: Subject[];
  owner: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onAdd: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Môn học</h1>
        {owner ? (
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
            onClick={() => setAdding((open) => !open)}
          >
            <Plus aria-hidden="true" className="size-4" />
            Thêm môn học
          </button>
        ) : null}
      </div>
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
            autoFocus
            className="h-12 min-w-0 flex-1 rounded-xl border border-pink-deep bg-surface px-3"
          />
          <button type="submit" disabled={busy} className="h-12 rounded-full bg-accent-2 px-5 font-semibold text-on-accent disabled:opacity-60">
            Lưu môn
          </button>
        </form>
      ) : null}
      {subjects.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {subjects.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className={`flex min-h-24 items-center gap-3 rounded-2xl px-4 py-4 text-left ${index % 2 === 0 ? "bg-pink" : "bg-blue"}`}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface text-accent">
                <BookOpen aria-hidden="true" className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold break-words">{item.name}</span>
                <span className="text-sm text-muted">{countFiles(item)} tài liệu</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Chưa có môn học"
          hint={owner ? "Thêm môn đầu tiên, rồi tải tài liệu lên." : "Chủ web sẽ sớm cập nhật."}
          action={
            owner ? (
              <button type="button" onClick={() => setAdding(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent">
                <Plus aria-hidden="true" className="size-4" />
                Thêm môn học
              </button>
            ) : null
          }
        />
      )}
    </section>
  );
}

function AnonymousCard({ anonymous, busy, onChange }: { anonymous: boolean; busy: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4">
      <Switch
        checked={anonymous}
        disabled={busy}
        onChange={onChange}
        label="Ẩn danh trên bảng xếp hạng"
        hint={
          anonymous
            ? "Mọi người chỉ thấy “Ẩn danh”. Chủ web vẫn xem được tên thật của bạn."
            : "Tên bạn đang hiện trên bảng xếp hạng. Bật để đổi thành “Ẩn danh”."
        }
      />
    </div>
  );
}

function PracticeTab({
  subjects,
  view,
  onView,
  me,
  busy,
  rankVersion,
  onOpenQuiz,
  onToggleAnonymous,
}: {
  subjects: Subject[];
  view: "quizzes" | "rank";
  onView: (view: "quizzes" | "rank") => void;
  me: Member | null;
  busy: boolean;
  rankVersion: number;
  onOpenQuiz: (file: FileMeta) => void;
  onToggleAnonymous: (next: boolean) => void;
}) {
  const withQuizzes = subjects.filter((item) => item.files.practice.length > 0);
  return (
    <section>
      <h1 className="mb-3 text-2xl font-semibold">Ôn tập</h1>
      <div role="tablist" aria-label="Ôn tập" className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-line bg-surface p-1">
        {(
          [
            ["quizzes", "Đề thực hành"],
            ["rank", "Xếp hạng"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => onView(id)}
            className={`h-11 rounded-full text-sm font-semibold ${view === id ? "bg-pink text-accent" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "quizzes" ? (
        withQuizzes.length ? (
          <div className="space-y-5">
            {withQuizzes.map((item) => (
              <div key={item.id}>
                <h2 className="mb-2 font-semibold text-muted">{item.name}</h2>
                <ul className="space-y-2">
                  {item.files.practice.map((file) => (
                    <li key={file.id} className="flex items-center gap-3 rounded-2xl border border-line border-l-4 border-l-blue-deep bg-surface px-3 py-3">
                      <FileIcon name={file.name} mime={file.mime} section={file.section} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold break-words">{file.name}</p>
                        <p className="text-sm text-muted">{file.created}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onOpenQuiz(file)}
                        className="h-11 shrink-0 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60"
                      >
                        Làm bài
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="Chưa có đề thực hành"
            hint="Đề ở mục “Thực hành trắc nghiệm” của từng môn sẽ hiện ở đây."
          />
        )
      ) : (
        <div className="space-y-4">
          {me && me.role !== "owner" ? (
            <AnonymousCard anonymous={me.anonymous} busy={busy} onChange={onToggleAnonymous} />
          ) : null}
          <LeaderboardList version={rankVersion} onEmptyAction={() => onView("quizzes")} />
        </div>
      )}
    </section>
  );
}

function MeTab({
  me,
  gate,
  busy,
  pendingReviews,
  resetRequests,
  submissions,
  onOpenPanel,
  onToggleAnonymous,
}: {
  me: Member | null;
  gate: boolean;
  busy: boolean;
  pendingReviews: number;
  resetRequests: number;
  submissions: MySubmission[];
  onOpenPanel: (panel: Panel) => void;
  onToggleAnonymous: (next: boolean) => void;
}) {
  const [stats, setStats] = useState<MyStats | null>(null);
  useEffect(() => {
    let alive = true;
    myStats()
      .then((result) => {
        if (alive && result.ok) setStats(result.data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!me) return <SkeletonList rows={3} />;
  const owner = me.role === "owner";
  const pendingMine = submissions.filter((item) => item.status === "pending").length;

  const rowClass =
    "flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left font-semibold";
  const badge = (count: number) =>
    count > 0 ? <span className="grid min-w-6 place-items-center rounded-full bg-pink px-1.5 text-xs text-accent">{count}</span> : null;

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl bg-pink px-4 py-4">
        <Avatar name={me.displayName} className="size-16 bg-surface text-2xl" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{me.displayName}</h1>
          <p className="truncate text-sm text-muted">
            {me.username}
            {owner ? " · Chủ web" : ""}
          </p>
        </div>
      </div>

      {me.previewOwner ? (
        <p className="rounded-2xl bg-blue px-4 py-3 text-sm text-pretty">
          Bạn đang xem trước với quyền chủ web. Sau khi xuất bản, vào link công khai và đăng nhập Owner — dữ liệu xem trước không chuyển sang bản đã xuất bản.
        </p>
      ) : null}
      {owner && !me.previewOwner ? (
        <p className="rounded-2xl bg-blue px-4 py-3 text-sm text-pretty">
          Tài liệu bạn tải lên có hiệu lực ngay. Tài liệu thành viên gửi chỉ công khai sau khi bạn duyệt.
        </p>
      ) : null}

      {!owner ? (
        <div className="grid grid-cols-3 gap-3">
          {stats ? (
            <>
              <StatTile value={stats.attempts} label="lần làm đề" tone="pink" />
              <StatTile value={stats.quizzes} label="đề đã làm" tone="blue" />
              <StatTile value={stats.downloads} label="lần tải" tone="pink" />
            </>
          ) : (
            <>
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </>
          )}
        </div>
      ) : null}

      {!owner ? <AnonymousCard anonymous={me.anonymous} busy={busy} onChange={onToggleAnonymous} /> : null}

      <div>
        <h2 className="mb-2 font-semibold">Giao diện</h2>
        <ThemePicker />
      </div>

      <div className="space-y-2">
        {owner ? (
          <>
            <h2 className="font-semibold">Quản lý</h2>
            <button type="button" className={rowClass} onClick={() => onOpenPanel("review")}>
              <ClipboardCheck aria-hidden="true" className="size-5 text-accent" />
              <span className="flex-1">Xét duyệt tài liệu</span>
              {badge(pendingReviews)}
            </button>
            <button type="button" className={rowClass} onClick={() => onOpenPanel("info")}>
              <Users aria-hidden="true" className="size-5 text-accent" />
              <span className="flex-1">Thông tin user</span>
            </button>
            <button type="button" className={rowClass} onClick={() => onOpenPanel("users")}>
              <Shield aria-hidden="true" className="size-5 text-accent" />
              <span className="flex-1">Người dùng</span>
              {badge(resetRequests)}
            </button>
          </>
        ) : (
          <button type="button" className={rowClass} onClick={() => onOpenPanel("share")}>
            <Share2 aria-hidden="true" className="size-5 text-accent" />
            <span className="flex-1">Chia sẻ tài liệu</span>
            {badge(pendingMine)}
          </button>
        )}
      </div>

      {gate ? null : (
        <button
          type="button"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-pink-deep bg-surface font-semibold text-accent"
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
}) {
  const spec = sectionById(section) ?? SECTIONS[0];
  const files = subject.files[section];
  const [confirmSubject, setConfirmSubject] = useState(false);
  const [confirmFile, setConfirmFile] = useState<string | null>(null);
  return (
    <section>
      <button type="button" className="mb-3 inline-flex h-11 items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
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
            <span className="ml-1.5 text-xs font-medium text-muted">{subject.files[item.id].length}</span>
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
            <li key={file.id} className="rounded-2xl border border-line border-l-4 border-l-blue-deep bg-surface px-3 py-3">
              <div className="flex items-center gap-3">
                <FileIcon name={file.name} mime={file.mime} section={file.section} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">{file.name}</p>
                  <p className="text-sm text-muted">
                    {kindLabel(fileKind(file.name, file.mime, file.section))}
                    {formatBytes(file.bytes) ? ` · ${formatBytes(file.bytes)}` : ""} · {file.created}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
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
        <EmptyState
          icon={FolderOpen}
          title="Chưa có tài liệu trong mục này"
          hint={owner ? "Bấm “Tải file lên” ở trên để thêm tài liệu đầu tiên." : "Chủ web sẽ sớm bổ sung tài liệu."}
        />
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
  const preview = viewer.mime.startsWith("image/") || viewer.mime === "application/pdf";
  return (
    <section>
      <button type="button" className="mb-3 inline-flex h-11 items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Quay lại
      </button>
      <h1 className="mb-3 text-2xl font-semibold break-words">{viewer.name}</h1>
      {preview && viewer.mime.startsWith("image/") ? (
        <img src={viewer.url} alt="" className="max-h-[70vh] w-full rounded-2xl border border-line object-contain bg-surface" />
      ) : null}
      {preview && viewer.mime === "application/pdf" ? (
        <iframe title={viewer.name} src={viewer.url} className="h-[78vh] w-full rounded-2xl border border-line bg-white" />
      ) : null}
      {!preview ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4">
          <FileIcon name={viewer.name} mime={viewer.mime} className="size-14" />
          <p className="text-pretty text-muted">Trình duyệt không xem trực tiếp loại file này. Hãy tải về để mở.</p>
        </div>
      ) : null}
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

function SearchResults({ hits }: { hits: SearchHit[] }) {
  return (
    <section>
      <h1 className="mb-3 text-2xl font-semibold">Kết quả tìm kiếm ({hits.length})</h1>
      {hits.length ? (
        <ul className="space-y-2">
          {hits.map((hit) => (
            <li key={hit.key}>
              <button type="button" onClick={hit.open} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2 text-left">
                {hit.icon}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">{hit.title}</span>
                  <span className="text-sm text-muted">{hit.meta}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={SearchX} title="Không tìm thấy kết quả" hint="Thử từ khóa ngắn hơn hoặc tên môn học." />
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
      <button type="button" className="mb-3 inline-flex h-11 items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Quay lại
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
        <SkeletonList rows={4} label="Đang tải danh sách" />
      )}
      {people && people.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có người dùng nào" hint="Tài khoản đăng ký mới sẽ hiện ở đây." />
      ) : null}
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
      <button type="button" className="mb-3 inline-flex h-11 items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Quay lại
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
        <EmptyState icon={Share2} title="Bạn chưa gửi tài liệu nào" hint="Chọn môn, chọn file ở trên rồi bấm Gửi duyệt." />
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
      <button type="button" className="mb-3 inline-flex h-11 items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Quay lại
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
            <iframe title={preview.name} sandbox="allow-scripts allow-forms allow-modals" srcDoc={preview.html} className="h-[50vh] w-full rounded-2xl border border-line bg-white" />
          ) : null}
          {preview.section !== "practice" && preview.mime.startsWith("image/") ? (
            <img src={preview.url} alt="" className="max-h-[50vh] w-full rounded-2xl object-contain" />
          ) : null}
          {preview.section !== "practice" && preview.mime === "application/pdf" ? (
            <iframe title={preview.name} src={preview.url} className="h-[50vh] w-full rounded-2xl border border-line bg-white" />
          ) : null}
          {preview.section !== "practice" && !preview.mime.startsWith("image/") && preview.mime !== "application/pdf" ? (
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
          <EmptyState icon={ClipboardCheck} title="Không có tài liệu chờ duyệt" hint="Tài liệu thành viên gửi sẽ hiện ở đây." />
        )
      ) : (
        <SkeletonList rows={3} label="Đang tải hàng chờ" />
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
      <button type="button" className="mb-3 inline-flex h-11 items-center gap-1 text-sm font-semibold text-accent-2" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Quay lại
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
        <SkeletonList rows={4} label="Đang tải danh sách" />
      )}
      {people && people.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có người tham gia" hint="Khi có người đăng ký, họ sẽ hiện ở đây." />
      ) : null}
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
  if (!stats) {
    return (
      <div role="status" className="mt-3 space-y-2 border-t border-line pt-3">
        <span className="sr-only">Đang tải…</span>
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
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
          <p className="mb-4 rounded-xl border border-dashed border-pink-deep px-3 py-4 text-center text-sm text-muted">
            Chưa có bình luận. Hãy là người đầu tiên.
          </p>
        )
      ) : (
        <div className="mb-4">
          <SkeletonList rows={2} label="Đang tải bình luận" />
        </div>
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
