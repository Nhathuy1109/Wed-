import { useEffect, useState } from "react";
import { GROUPS, SPIRIT_KEY, spirits, type Spirit, type SpiritGroup } from "@/lib/spirits";

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
      className={`walker${spirit.lift ? " lift" : ""}${circle ? " circle" : ""}`}
      style={{ ["--sprite" as string]: sprite, ["--dur" as string]: dur }}
    >
      <div className="face">
        <img
          src={spirit.src}
          alt=""
          className={`sprite gait-${spirit.gait}`}
          draggable={false}
        />
      </div>
    </div>
  );
}

export function SpiritGarden({ compact = false }: { compact?: boolean }) {
  const [group, setGroup] = useState<SpiritGroup | "all">("all");
  const [chosenId, setChosenId] = useState(spirits[0].id);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SPIRIT_KEY);
      if (saved && spirits.some((s) => s.id === saved)) setChosenId(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function choose(id: string) {
    setChosenId(id);
    try {
      localStorage.setItem(SPIRIT_KEY, id);
    } catch {
      /* ignore */
    }
  }

  const chosen = spirits.find((s) => s.id === chosenId) ?? spirits[0];
  const visible = spirits.filter((s) => group === "all" || s.group === group);

  return (
    <div className={compact ? "" : "mx-auto max-w-3xl"}>
      {!compact ? (
        <header className="mb-5">
          <p className="text-sm font-semibold text-accent">Linh thú pixel</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Vườn linh thú</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Chọn một linh thú — nó sẽ đi vòng trên sân. Tứ Linh đã được vẽ lại; thêm bộ pixel mới từ file bổ sung.
          </p>
        </header>
      ) : null}

      <section className="stage hero" aria-label={`Đang xem ${chosen.name}`}>
        <div className="ground" />
        <Walker spirit={chosen} sprite="112px" dur="10s" circle />
        <div className="hero-copy">
          <p className="text-sm font-semibold text-accent">Đang chọn</p>
          <h3 className="text-lg font-bold sm:text-xl">{chosen.name}</h3>
          <p className="text-sm leading-snug text-muted">{chosen.trait}</p>
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
              className={`h-10 shrink-0 rounded-full border px-3.5 text-sm font-semibold ${
                on ? "border-accent bg-pink text-accent" : "border-line bg-surface text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((spirit) => {
          const on = spirit.id === chosen.id;
          return (
            <li key={spirit.id}>
              <button
                type="button"
                onClick={() => choose(spirit.id)}
                aria-pressed={on}
                className={`w-full rounded-2xl border p-2 text-left transition-colors ${
                  on ? "border-accent bg-pink" : "border-line bg-surface"
                }`}
              >
                <div className="stage card">
                  <div className="ground" />
                  <Walker spirit={spirit} sprite="72px" dur="5.5s" />
                </div>
                <p className="mt-2 px-1 text-sm font-bold leading-snug">{spirit.name}</p>
                <p className="px-1 pb-1 text-xs leading-snug text-muted">{spirit.trait}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
