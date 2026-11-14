import { useEffect, useMemo, useState } from "react";
import {
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
} from "@/lib/spirits";

type WorldTheme = "auto" | "day" | "night";
type WorldDecor = "crystal" | "lantern" | "mushroom" | "campfire" | "fountain";
type WorldHabitat = "forest" | "snow" | "volcano" | "coast" | "sky";
type WorldPalette = "meadow" | "ocean" | "ember";
type WorldPrefs = {
  theme: WorldTheme;
  decor: WorldDecor;
  habitat: WorldHabitat;
  palette: WorldPalette;
  animations: boolean;
};

const defaults: WorldPrefs = {
  theme: "auto",
  decor: "crystal",
  habitat: "forest",
  palette: "meadow",
  animations: true,
};

const habitats: { id: WorldHabitat; label: string; icon: string; note: string }[] = [
  { id: "forest", label: "Rừng cổ tích", icon: "🌲", note: "Tán cây xanh, nấm phát sáng và những lối mòn bí mật." },
  { id: "snow", label: "Núi tuyết", icon: "❄️", note: "Miền tuyết trong trẻo dành cho những linh thú bền bỉ." },
  { id: "volcano", label: "Thung lũng lửa", icon: "🌋", note: "Đá núi lửa ấm áp, tinh thể đỏ và bầu trời hoàng hôn." },
  { id: "coast", label: "Bờ biển mây", icon: "🌊", note: "Sóng xanh, gió nhẹ và những sinh vật thích bay lượn." },
  { id: "sky", label: "Quần đảo trên mây", icon: "☁️", note: "Những hòn đảo lơ lửng giữa tầng mây và ánh sao." },
];

const decorations: { id: WorldDecor; label: string; icon: string }[] = [
  { id: "crystal", label: "Pha lê", icon: "💎" },
  { id: "lantern", label: "Đèn lồng", icon: "🏮" },
  { id: "mushroom", label: "Nấm thần", icon: "🍄" },
  { id: "campfire", label: "Lửa trại", icon: "🔥" },
  { id: "fountain", label: "Đài nước", icon: "⛲" },
];

const palettes: { id: WorldPalette; label: string; colors: string[] }[] = [
  { id: "meadow", label: "Đồng cỏ", colors: ["#b9e2dc", "#e6e9c9", "#a9c88f"] },
  { id: "ocean", label: "Đại dương", colors: ["#9dd3e4", "#d1e8df", "#78b9bd"] },
  { id: "ember", label: "Hoàng hôn", colors: ["#edbd9b", "#e8c48c", "#a86f68"] },
];

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function readPrefs(): WorldPrefs {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(WORLD_PREFS_KEY) || "null");
    if (!raw || typeof raw !== "object") return defaults;
    const value = raw as Record<string, unknown>;
    return {
      theme: isOneOf(value.theme, ["auto", "day", "night"] as const) ? value.theme : defaults.theme,
      decor: isOneOf(value.decor, ["crystal", "lantern", "mushroom", "campfire", "fountain"] as const) ? value.decor : defaults.decor,
      habitat: isOneOf(value.habitat, ["forest", "snow", "volcano", "coast", "sky"] as const) ? value.habitat : defaults.habitat,
      palette: isOneOf(value.palette, ["meadow", "ocean", "ember"] as const) ? value.palette : defaults.palette,
      animations: typeof value.animations === "boolean" ? value.animations : defaults.animations,
    };
  } catch {
    return defaults;
  }
}

function getPhase(date: Date, theme: WorldTheme): "morning" | "day" | "dusk" | "night" {
  if (theme === "day") return "day";
  if (theme === "night") return "night";
  const hour = date.getHours();
  if (hour < 5 || hour >= 19) return "night";
  if (hour < 8) return "morning";
  if (hour >= 17) return "dusk";
  return "day";
}

function getActiveSpirit(): string {
  try {
    const id = localStorage.getItem(SPIRIT_KEY);
    return id && spirits.some((spirit) => spirit.id === id) ? id : spirits[0].id;
  } catch {
    return spirits[0].id;
  }
}

export function PixelWorld({ displayName }: { displayName: string }) {
  const [prefs, setPrefs] = useState<WorldPrefs>(defaults);
  const [selected, setSelected] = useState(spirits[0].id);
  const [pets, setPets] = useState(0);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [toast, setToast] = useState("Chào mừng trở lại, nhà thám hiểm!");

  useEffect(() => {
    setPrefs(readPrefs());
    setSelected(getActiveSpirit());
    setPets(readSpiritCareCount());
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    const onSpiritChange = () => setSelected(getActiveSpirit());
    const onCare = (event: Event) => {
      const customEvent = event as CustomEvent<number>;
      setPets(Number.isFinite(customEvent.detail) ? customEvent.detail : readSpiritCareCount());
    };
    const onWorldChange = () => setPrefs(readPrefs());
    window.addEventListener(SPIRIT_CHANGE_EVENT, onSpiritChange);
    window.addEventListener(SPIRIT_CARE_EVENT, onCare);
    window.addEventListener(WORLD_CHANGE_EVENT, onWorldChange);
    window.addEventListener("storage", onSpiritChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(SPIRIT_CHANGE_EVENT, onSpiritChange);
      window.removeEventListener(SPIRIT_CARE_EVENT, onCare);
      window.removeEventListener(WORLD_CHANGE_EVENT, onWorldChange);
      window.removeEventListener("storage", onSpiritChange);
    };
  }, []);

  const phase = getPhase(clock, prefs.theme);
  const isNight = phase === "night";
  const spirit = useMemo(() => spirits.find((item) => item.id === selected) ?? spirits[0], [selected]);
  const profile = getSpiritProfile(spirit);
  const habitat = habitats.find((item) => item.id === prefs.habitat) ?? habitats[0];
  const decor = decorations.find((item) => item.id === prefs.decor) ?? decorations[0];
  const timeLabel = clock.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const phaseLabel = phase === "morning" ? "Bình minh" : phase === "dusk" ? "Hoàng hôn" : isNight ? "Đêm yên bình" : "Ngày khám phá";

  function updatePrefs(next: Partial<WorldPrefs>) {
    const updated = { ...prefs, ...next };
    setPrefs(updated);
    try {
      localStorage.setItem(WORLD_PREFS_KEY, JSON.stringify(updated));
    } catch {
      /* The world remains usable when storage is unavailable. */
    }
    window.dispatchEvent(new Event(WORLD_CHANGE_EVENT));
  }

  function chooseSpirit(id: string) {
    const next = spirits.find((item) => item.id === id);
    if (!next) return;
    setSelected(id);
    try {
      localStorage.setItem(SPIRIT_KEY, id);
    } catch {
      /* The selected spirit remains active for this session. */
    }
    window.dispatchEvent(new Event(SPIRIT_CHANGE_EVENT));
    setToast(`${next.name} đã sẵn sàng đồng hành!`);
  }

  function petSpirit() {
    const next = addSpiritCare();
    setPets(next);
    setToast(`${spirit.name} vui vẻ đón nhận sự quan tâm của bạn ✦`);
  }

  return (
    <section
      className={`pixel-world world-phase-${phase} habitat-${prefs.habitat} palette-${prefs.palette}${prefs.animations ? " world-motion-on" : " world-motion-off"}`}
      aria-label="Thế giới pixel fantasy"
    >
      <div className="world-sky" aria-hidden="true">
        <span className="world-sun" />
        <span className="world-moon">☾</span>
        <i className="world-star star-a">✦</i>
        <i className="world-star star-b">✧</i>
        <i className="world-star star-c">·</i>
        <span className="world-cloud cloud-a" />
        <span className="world-cloud cloud-b" />
        <span className="world-cloud cloud-c" />
      </div>

      <div className="world-topline">
        <span className="world-tag">✦ MOCHI ADVENTURE WORLD</span>
        <span className="world-time"><span aria-hidden="true">◷</span> {timeLabel} · {phaseLabel}</span>
      </div>

      <div className="world-content">
        <div className="world-intro">
          <p className="world-eyebrow">VÙNG ĐẤT CỦA TRI THỨC</p>
          <h1>Xin chào, {displayName}!</h1>
          <p>Mỗi ngày là một chuyến phiêu lưu mới. Hãy chọn linh thú, chăm sóc người bạn nhỏ và khám phá vùng đất của bạn.</p>
          <div className="world-actions">
            <button type="button" onClick={() => setShowCollection((value) => !value)} aria-expanded={showCollection}>
              ✧ {showCollection ? "Ẩn bộ sưu tập" : "Bộ sưu tập linh thú"}
            </button>
            <button type="button" className="world-ghost" onClick={() => setShowCustomize((value) => !value)} aria-expanded={showCustomize}>
              ⚙ Tùy chỉnh thế giới
            </button>
          </div>
        </div>

        <div className="world-companion" aria-label={`Linh thú ${spirit.name}`}>
          <div className="companion-orbit" aria-hidden="true">✧</div>
          <div className="companion-ground-shadow" aria-hidden="true" />
          <img src={spirit.src} alt={spirit.name} />
          <span className="companion-name">{spirit.name}</span>
          <span className="companion-element">{profile.element} · {profile.rarity}</span>
          <button type="button" className="pet-button" onClick={petSpirit}>♡ Chạm tương tác</button>
        </div>
      </div>

      <div className={`world-ground decor-${prefs.decor}`} aria-hidden="true">
        <span className="world-tree tree-one">♣</span>
        <span className="world-tree tree-two">♠</span>
        <span className="world-rock">◆</span>
        <span className="world-decor">{decor.icon}</span>
        <span className="world-path" />
      </div>

      <div className="world-footer">
        <div>
          <strong>{habitat.icon} {habitat.label}</strong>
          <span>{habitat.note}</span>
        </div>
        <div className="world-stats">
          <span>♡ {pets} lần tương tác</span>
          <span>✦ {spirits.length} linh thú</span>
        </div>
      </div>
      <p className="world-toast" role="status" aria-live="polite">{toast}</p>

      {showCustomize ? (
        <div className="world-panel" aria-label="Tùy chỉnh thế giới">
          <div className="world-panel-head">
            <strong>Trang trí thế giới</strong>
            <button type="button" onClick={() => setShowCustomize(false)} aria-label="Đóng tùy chỉnh">×</button>
          </div>
          <div className="world-setting">
            <span>Thời gian trong thế giới</span>
            <div className="world-options">
              {([ ["auto", "◷ Tự động"], ["day", "☀ Ban ngày"], ["night", "☾ Ban đêm"] ] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={prefs.theme === id} onClick={() => updatePrefs({ theme: id })}>{label}</button>
              ))}
            </div>
          </div>
          <div className="world-setting">
            <span>Bảng màu</span>
            <div className="world-options world-palette-options">
              {palettes.map((item) => (
                <button key={item.id} type="button" aria-pressed={prefs.palette === item.id} onClick={() => updatePrefs({ palette: item.id })}>
                  <span className="palette-swatch" aria-hidden="true">{item.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="world-setting">
            <span>Vật trang trí</span>
            <div className="world-options">
              {decorations.map((item) => <button key={item.id} type="button" aria-pressed={prefs.decor === item.id} onClick={() => updatePrefs({ decor: item.id })}>{item.icon} {item.label}</button>)}
            </div>
          </div>
          <div className="world-setting">
            <span>Môi trường sống</span>
            <div className="world-options">
              {habitats.map((item) => <button key={item.id} type="button" aria-pressed={prefs.habitat === item.id} onClick={() => updatePrefs({ habitat: item.id })}>{item.icon} {item.label}</button>)}
            </div>
          </div>
          <label className="world-motion-toggle">
            <input type="checkbox" checked={prefs.animations} onChange={(event) => updatePrefs({ animations: event.target.checked })} />
            <span>Cho phép hoạt ảnh trang trí</span>
          </label>
        </div>
      ) : null}

      {showCollection ? (
        <div className="world-collection" aria-label="Bộ sưu tập linh thú">
          <div className="world-panel-head">
            <strong>Chọn linh thú đồng hành</strong>
            <span>{spirits.length} sinh vật</span>
          </div>
          <p className="world-collection-hint">Mỗi linh thú có tính cách, nguyên tố và môi trường yêu thích riêng.</p>
          <div className="world-spirit-grid">
            {spirits.map((item: Spirit) => {
              const itemProfile = getSpiritProfile(item);
              return (
                <button type="button" key={item.id} className={selected === item.id ? "is-selected" : ""} onClick={() => chooseSpirit(item.id)} aria-pressed={selected === item.id}>
                  <img src={item.src} alt="" loading="lazy" />
                  <span>{item.name}</span>
                  <small>{itemProfile.personality}</small>
                  <em>{itemProfile.element} · {itemProfile.rarity}</em>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function PixelLoadingScreen() {
  return (
    <section className="pixel-loading" role="status" aria-live="polite" aria-label="Đang mở thế giới Mochi Library">
      <div className="pixel-loading-scene" aria-hidden="true">
        <span className="loading-star star-left">✦</span>
        <span className="loading-star star-right">✧</span>
        <img src="/mascots/pixel-thanh-long.svg" alt="" />
        <span className="loading-orbit" />
      </div>
      <p className="pixel-loading-title">Đang mở cánh cổng tri thức</p>
      <p className="pixel-loading-subtitle">Các linh thú đang chuẩn bị khu vườn của bạn…</p>
      <div className="pixel-loading-bar" aria-hidden="true"><span /></div>
    </section>
  );
}
