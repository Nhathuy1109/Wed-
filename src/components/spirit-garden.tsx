import { useEffect, useState } from "react";
import {
  GROUPS,
  SPIRIT_CARE_EVENT,
  SPIRIT_CHANGE_EVENT,
  SPIRIT_KEY,
  WORLD_CHANGE_EVENT,
  WORLD_PREFS_KEY,
  addSpiritCare,
  getSpiritProfile,
  readSpiritCareCount,
  spirits,
  type Spirit,
  type SpiritGroup,
} from "@/lib/spirits";

function Walker({
  spirit,
  sprite,
  dur,
  circle = false,
}: {
  spirit: Spirit;
  sprite: string;
  dur: string;
  circle?: boolean;
}) {
  return (
    <div
      className={`walker species-${spirit.id}${spirit.lift ? " lift" : ""}${circle ? " circle" : ""}`}
      style={{ ["--sprite" as string]: sprite, ["--dur" as string]: dur }}
    >
      <div className="face">
        <img src={spirit.src} alt="" className={`sprite gait-${spirit.gait}`} draggable={false} />
      </div>
    </div>
  );
}

function readSelectedId() {
  try {
    const saved = localStorage.getItem(SPIRIT_KEY);
    return saved && spirits.some((spirit) => spirit.id === saved) ? saved : spirits[0].id;
  } catch {
    return spirits[0].id;
  }
}

function readHabitat() {
  try {
    const value = JSON.parse(localStorage.getItem(WORLD_PREFS_KEY) ?? "{}") as { habitat?: unknown };
    return typeof value.habitat === "string" ? value.habitat : "forest";
  } catch {
    return "forest";
  }
}

export function SpiritGarden({ compact = false }: { compact?: boolean }) {
  const [group, setGroup] = useState<SpiritGroup | "all">("all");
  const [chosenId, setChosenId] = useState(spirits[0].id);
  const [habitat, setHabitat] = useState("forest");
  const [careCount, setCareCount] = useState(0);
  const [message, setMessage] = useState("Hãy chọn một linh thú để bắt đầu cuộc phiêu lưu.");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setChosenId(readSelectedId());
    setHabitat(readHabitat());
    setCareCount(readSpiritCareCount());
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(motionQuery.matches);
    const onMotionChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    motionQuery.addEventListener("change", onMotionChange);
    const onSpiritChange = () => setChosenId(readSelectedId());
    const onWorldChange = () => setHabitat(readHabitat());
    const onCare = (event: Event) => {
      const customEvent = event as CustomEvent<number>;
      setCareCount(Number.isFinite(customEvent.detail) ? customEvent.detail : readSpiritCareCount());
    };
    window.addEventListener(SPIRIT_CHANGE_EVENT, onSpiritChange);
    window.addEventListener(WORLD_CHANGE_EVENT, onWorldChange);
    window.addEventListener(SPIRIT_CARE_EVENT, onCare);
    window.addEventListener("storage", onSpiritChange);
    return () => {
      window.removeEventListener(SPIRIT_CHANGE_EVENT, onSpiritChange);
      window.removeEventListener(WORLD_CHANGE_EVENT, onWorldChange);
      window.removeEventListener(SPIRIT_CARE_EVENT, onCare);
      window.removeEventListener("storage", onSpiritChange);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  function choose(id: string) {
    const next = spirits.find((spirit) => spirit.id === id);
    if (!next) return;
    setChosenId(id);
    try {
      localStorage.setItem(SPIRIT_KEY, id);
    } catch {
      /* Keep the current selection available for this session. */
    }
    window.dispatchEvent(new Event(SPIRIT_CHANGE_EVENT));
    setMessage(`${next.name} đã được chọn làm bạn đồng hành!`);
  }

  function careForSpirit() {
    const nextCount = addSpiritCare();
    setCareCount(nextCount);
    setMessage(`${chosen.name} rất vui khi được bạn quan tâm. ♡`);
  }

  const chosen = spirits.find((spirit) => spirit.id === chosenId) ?? spirits[0];
  const profile = getSpiritProfile(chosen);
  const visible = spirits.filter((spirit) => group === "all" || spirit.group === group);

  return (
    <div className={compact ? "spirit-garden-compact" : "mx-auto max-w-3xl spirit-garden-full"}>
      {!compact ? (
        <header className="mb-5">
          <p className="text-sm font-semibold text-accent">Linh thú pixel</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Vườn linh thú</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Chọn một người bạn, tìm hiểu tính cách và chăm sóc linh thú trong khu vườn của bạn.
          </p>
        </header>
      ) : null}

      <section className={`stage hero garden-habitat-${habitat}${reducedMotion ? " garden-reduced-motion" : ""}`} aria-label={`Đang xem ${chosen.name}`}>
        <div className="ground" />
        <Walker spirit={reducedMotion ? { ...chosen, src: chosen.staticSrc ?? chosen.src } : chosen} sprite="112px" dur="10s" circle />
        <div className="hero-copy">
          <p className="text-sm font-semibold text-accent">Đang đồng hành</p>
          <h3 className="text-lg font-bold sm:text-xl">{chosen.name}</h3>
          <p className="text-sm leading-snug text-muted">{chosen.trait}</p>
          <div className="spirit-profile-chips">
            <span>{profile.element}</span>
            <span>{profile.rarity}</span>
            <span>{profile.habitat}</span>
          </div>
          <p className="mt-2 text-xs text-muted">Tính cách: {profile.personality}</p>
          <div className="spirit-care-row">
            <button type="button" onClick={careForSpirit} className="spirit-care-button">♡ Chăm sóc linh thú</button>
            <span>{careCount} lần tương tác</span>
          </div>
          <p className="spirit-feedback" role="status" aria-live="polite">{message}</p>
        </div>
      </section>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Nhóm linh thú">
        {GROUPS.map((item) => {
          const on = item.id === group;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setGroup(item.id)}
              className={`h-10 shrink-0 rounded-full border px-3.5 text-sm font-semibold ${on ? "border-accent bg-pink text-accent" : "border-line bg-surface text-ink"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((spirit) => {
          const on = spirit.id === chosen.id;
          const details = getSpiritProfile(spirit);
          return (
            <li key={spirit.id}>
              <button
                type="button"
                onClick={() => choose(spirit.id)}
                aria-pressed={on}
                className={`spirit-choice-card w-full rounded-2xl border p-2 text-left transition-colors ${on ? "is-selected border-accent bg-pink" : "border-line bg-surface"}`}
              >
                <div className={`stage card${reducedMotion ? " garden-reduced-motion" : ""}`}>
                  <div className="ground" />
                  <Walker spirit={reducedMotion ? { ...spirit, src: spirit.staticSrc ?? spirit.src } : spirit} sprite="72px" dur="5.5s" />
                </div>
                <p className="mt-2 px-1 text-sm font-bold leading-snug">{spirit.name}</p>
                <p className="px-1 pb-1 text-xs leading-snug text-muted">{details.personality}</p>
                <span className="spirit-card-meta">{details.element} · {details.rarity}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const COLLAPSE_KEY = "linh-thu-thu-gon";

/** Khu "Linh thú đồng hành" có nút thu gọn / mở rộng. */
export function SpiritSection() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "0" : "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="creature-gallery dashboard-section" aria-labelledby="creature-gallery-title">
      <div className="creature-gallery-heading mb-3">
        <div>
          <h2 id="creature-gallery-title" className="text-lg font-extrabold tracking-tight">Linh thú đồng hành</h2>
          {open ? <p className="text-xs text-muted">Mỗi linh thú có cá tính riêng. Chọn, tương tác và thay đổi vùng sinh sống ở khu thế giới phía trên.</p> : null}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="creature-gallery-body"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-accent"
        >
          <span aria-hidden="true">{open ? "▲" : "▼"}</span>
          {open ? "Thu gọn" : "Mở rộng"}
        </button>
      </div>
      {open ? <div id="creature-gallery-body"><SpiritGarden compact /></div> : null}
    </section>
  );
}
