export type SpiritGroup = "myth" | "cute" | "cool" | "fantasy";

export type Spirit = {
  id: string;
  name: string;
  trait: string;
  group: SpiritGroup;
  gait: string;
  lift: boolean;
  src: string;
  staticSrc?: string;
};

export const GROUPS: { id: SpiritGroup | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "myth", label: "Tứ Linh" },
  { id: "cute", label: "Dễ thương" },
  { id: "cool", label: "Ngầu" },
  { id: "fantasy", label: "Fantasy" },
];

export const spirits: Spirit[] = [
  // —— Tứ Linh (vẽ lại theo nét pixel file 2) ——
  {
    id: "thanh-long",
    name: "Thanh Long",
    trait: "Rồng lam phương Đông — can đảm, dẫn lối tri thức.",
    group: "myth",
    gait: "undulate",
    lift: false,
    src: "/mascots/pixel-thanh-long.gif",
    staticSrc: "/mascots/pixel-thanh-long.png",
  },
  {
    id: "huyen-vu",
    name: "Huyền Vũ",
    trait: "Rùa rắn phương Bắc — bình tĩnh, bền bỉ.",
    group: "myth",
    gait: "prowl",
    lift: false,
    src: "/mascots/pixel-huyen-vu.gif",
    staticSrc: "/mascots/pixel-huyen-vu.png",
  },
  {
    id: "chu-tuoc",
    name: "Chu Tước",
    trait: "Phượng đỏ phương Nam — rực rỡ, tái sinh.",
    group: "myth",
    gait: "glide",
    lift: true,
    src: "/mascots/pixel-chu-tuoc.gif",
    staticSrc: "/mascots/pixel-chu-tuoc.png",
  },
  {
    id: "bach-ho",
    name: "Bạch Hổ",
    trait: "Hổ trắng phương Tây — dũng mãnh, bảo vệ.",
    group: "myth",
    gait: "prowl",
    lift: false,
    src: "/mascots/pixel-bach-ho.gif",
    staticSrc: "/mascots/pixel-bach-ho.png",
  },
  // —— Bộ pixel mới từ file bổ sung ——
  {
    id: "owl",
    name: "Cú mèo đội kính",
    trait: "Đi từng bước ngắn, như đang đọc bài.",
    group: "cute",
    gait: "step",
    lift: false,
    src: "/mascots/spirit-owl.svg",
  },
  {
    id: "fox",
    name: "Cáo tuyết",
    trait: "Lông trắng, đuôi dày, nhảy nhẹ trên trang.",
    group: "cute",
    gait: "hop",
    lift: false,
    src: "/mascots/spirit-fox.svg",
  },
  {
    id: "penguin",
    name: "Cánh cụt khăn đỏ",
    trait: "Lạch bạch, dừng một nhịp rồi đi tiếp.",
    group: "cute",
    gait: "waddle",
    lift: false,
    src: "/mascots/spirit-penguin.svg",
  },
  {
    id: "jelly",
    name: "Sứa đèn",
    trait: "Trôi chậm, chấm sáng nhỏ theo thân.",
    group: "cute",
    gait: "float",
    lift: true,
    src: "/mascots/spirit-jelly.svg",
  },
  {
    id: "sheep",
    name: "Cừu mây",
    trait: "Tròn xốp, lăn hơn là bước.",
    group: "cute",
    gait: "roll",
    lift: false,
    src: "/mascots/spirit-sheep.svg",
  },
  {
    id: "tiger",
    name: "Hổ trắng (pixel)",
    trait: "Sọc vàng nhạt, bước dài và chậm.",
    group: "cool",
    gait: "prowl",
    lift: false,
    src: "/mascots/spirit-tiger.svg",
  },
  {
    id: "panther",
    name: "Báo đêm",
    trait: "Mắt vàng, thấp sát mép màn hình.",
    group: "cool",
    gait: "slink",
    lift: false,
    src: "/mascots/spirit-panther.svg",
  },
  {
    id: "wolf",
    name: "Sói sao",
    trait: "Xám xanh, đốm sao, đi vòng ổn định.",
    group: "cool",
    gait: "pace",
    lift: false,
    src: "/mascots/spirit-wolf.svg",
  },
  {
    id: "crane",
    name: "Hạc giấy",
    trait: "Cao, thẳng, lướt như tờ giấy gấp.",
    group: "cool",
    gait: "glide",
    lift: false,
    src: "/mascots/spirit-crane.svg",
  },
  {
    id: "huli",
    name: "Hồ ly mini",
    trait: "Ba đuôi, dễ thương nhưng hơi kiêu.",
    group: "fantasy",
    gait: "swish",
    lift: false,
    src: "/mascots/spirit-huli.svg",
  },
  {
    id: "koi",
    name: "Cá koi mây",
    trait: "Bơi trong không khí, để lại một vệt mây.",
    group: "fantasy",
    gait: "swim",
    lift: true,
    src: "/mascots/spirit-koi.svg",
  },
  {
    id: "seadragon",
    name: "Sâu nhỏ",
    trait: "Uốn mình chậm, bò nhẹ trên trang.",
    group: "fantasy",
    gait: "undulate",
    lift: true,
    src: "/mascots/spirit-seadragon.svg",
  },
  {
    id: "deer",
    name: "Nai sừng sao",
    trait: "Sừng phát sáng nhẹ, bước êm.",
    group: "fantasy",
    gait: "soft",
    lift: false,
    src: "/mascots/spirit-deer.svg",
  },
  {
    id: "qilin",
    name: "Lân con",
    trait: "Đầu lân nhỏ, đi kiểu múa.",
    group: "fantasy",
    gait: "dance",
    lift: false,
    src: "/mascots/spirit-qilin.svg",
  },
  // —— Bổ sung thêm pixel ——
  {
    id: "pig",
    name: "Heo hồng Mochi",
    trait: "Heo con hồng hào, nhún nhảy vui vẻ và lắc chiếc đuôi xoăn.",
    group: "cute",
    gait: "pig",
    lift: false,
    src: "/mascots/pixel-pig.gif",
    staticSrc: "/mascots/pixel-pig.png",
  },
  {
    id: "bunny",
    name: "Thỏ bông",
    trait: "Tai dài, nhảy từng nhịp nhỏ.",
    group: "cute",
    gait: "hop",
    lift: false,
    src: "/mascots/pixel-bunny.svg",
  },
  {
    id: "cat",
    name: "Mèo con",
    trait: "Bước nhẹ, thỉnh thoảng dừng nhìn quanh.",
    group: "cute",
    gait: "soft",
    lift: false,
    src: "/mascots/pixel-cat.svg",
  },
  {
    id: "panda",
    name: "Gấu trúc",
    trait: "Chậm rãi, lăn tròn khi vui.",
    group: "cute",
    gait: "roll",
    lift: false,
    src: "/mascots/pixel-panda.svg",
  },
  {
    id: "slime",
    name: "Slime xanh",
    trait: "Nảy nhún nhún, mềm như thạch.",
    group: "cute",
    gait: "hop",
    lift: false,
    src: "/mascots/pixel-slime.svg",
  },
  {
    id: "night-cat",
    name: "Mèo đêm",
    trait: "Lông tím than, đi sát mép trang.",
    group: "cool",
    gait: "slink",
    lift: false,
    src: "/mascots/pixel-night-cat.svg",
  },
  {
    id: "lion",
    name: "Sư tử con",
    trait: "Bờm vàng nâu, bước đĩnh đạc.",
    group: "cool",
    gait: "prowl",
    lift: false,
    src: "/mascots/pixel-lion.svg",
  },
  {
    id: "dragon",
    name: "Rồng nhỏ",
    trait: "Cánh nhỏ, uốn mình khi bò.",
    group: "fantasy",
    gait: "undulate",
    lift: false,
    src: "/mascots/pixel-dragon.svg",
  },
  {
    id: "triceratops",
    name: "Triceratops",
    trait: "Khủng long ba sừng — điềm tĩnh, kiên định và thích khám phá rừng cổ đại.",
    group: "cool",
    gait: "prowl",
    lift: false,
    src: "/mascots/pixel-triceratops.svg",
  },
  {
    id: "t-rex",
    name: "T-Rex",
    trait: "Khủng long bạo chúa — mạnh mẽ, tò mò và luôn tràn đầy năng lượng.",
    group: "cool",
    gait: "prowl",
    lift: false,
    src: "/mascots/pixel-t-rex.svg",
  },
  {
    id: "stegosaurus",
    name: "Stegosaurus",
    trait: "Khủng long lưng gai — hiền hòa, chậm rãi và thích những nơi yên tĩnh.",
    group: "cool",
    gait: "waddle",
    lift: false,
    src: "/mascots/pixel-stegosaurus.svg",
  },
  {
    id: "western-dragon",
    name: "Rồng phương Tây",
    trait: "Rồng cánh lớn — độc lập, gan dạ và thích ngắm thế giới từ trên cao.",
    group: "cool",
    gait: "glide",
    lift: true,
    src: "/mascots/pixel-dragon-west.svg",
  },
  {
    id: "phoenix",
    name: "Phượng lửa",
    trait: "Sải cánh lướt nhẹ trên trang.",
    group: "fantasy",
    gait: "glide",
    lift: true,
    src: "/mascots/pixel-phoenix.svg",
  },
  {
    id: "unicorn",
    name: "Kỳ lân",
    trait: "Sừng lấp lánh, bước như múa.",
    group: "fantasy",
    gait: "dance",
    lift: false,
    src: "/mascots/pixel-unicorn.svg",
  },
  {
    id: "moon",
    name: "Trăng khuyết",
    trait: "Trôi lơ lửng, sáng dịu.",
    group: "fantasy",
    gait: "float",
    lift: true,
    src: "/mascots/pixel-moon.svg",
  },
  {
    id: "crystal",
    name: "Tinh thể",
    trait: "Phát sáng nhẹ, lơ lửng chậm.",
    group: "fantasy",
    gait: "float",
    lift: true,
    src: "/mascots/pixel-crystal.svg",
  },
  {
    id: "mushroom",
    name: "Nấm thần",
    trait: "Tròn nhỏ, lắc lư khi đi.",
    group: "fantasy",
    gait: "waddle",
    lift: false,
    src: "/mascots/pixel-mushroom.svg",
  },
  {
    id: "capybara",
    name: "Capybara lá non",
    trait: "Điềm nhiên, chậm rãi và thích nằm sưởi nắng bên bờ suối.",
    group: "cute",
    gait: "soft",
    lift: false,
    src: "/mascots/pixel-capybara.svg",
  },
  {
    id: "axolotl",
    name: "Axolotl san hô",
    trait: "Bơi lơ lửng, mang chiếc mào hồng mềm mại như san hô.",
    group: "fantasy",
    gait: "swim",
    lift: true,
    src: "/mascots/pixel-axolotl.svg",
  },
  {
    id: "corgi",
    name: "Corgi bánh mật",
    trait: "Chân ngắn đáng yêu, chạy lon ton và luôn vẫy đuôi chào bạn.",
    group: "cute",
    gait: "hop",
    lift: false,
    src: "/mascots/pixel-corgi.svg",
  },
];

export const SPIRIT_KEY = "linh-thu-chon";


export type SpiritProfile = {
  personality: string;
  element: string;
  habitat: string;
  rarity: string;
};

const SPIRIT_PROFILES: Record<string, SpiritProfile> = {
  "thanh-long": { personality: "Điềm tĩnh, can đảm, thích dẫn đường.", element: "Mộc · Gió", habitat: "Rừng cổ", rarity: "Huyền thoại" },
  "huyen-vu": { personality: "Kiên nhẫn, trầm ổn, luôn bảo vệ bạn bè.", element: "Thủy · Đất", habitat: "Hồ băng", rarity: "Huyền thoại" },
  "chu-tuoc": { personality: "Nhiệt thành, lạc quan, không ngại bắt đầu lại.", element: "Hỏa", habitat: "Đỉnh núi lửa", rarity: "Huyền thoại" },
  "bach-ho": { personality: "Quyết đoán, trung thành, thích thử thách.", element: "Kim", habitat: "Núi đá", rarity: "Huyền thoại" },
  owl: { personality: "Thông thái, quan sát kỹ, thích yên tĩnh.", element: "Phong", habitat: "Tháp thư viện", rarity: "Hiếm" },
  fox: { personality: "Nhanh trí, tinh nghịch, thích khám phá.", element: "Băng", habitat: "Rừng tuyết", rarity: "Thường" },
  penguin: { personality: "Thân thiện, vui vẻ, thích đi theo nhóm.", element: "Băng · Thủy", habitat: "Bờ biển lạnh", rarity: "Thường" },
  jelly: { personality: "Dịu dàng, tò mò, thích ánh sáng dịu.", element: "Thủy", habitat: "Vịnh phát quang", rarity: "Hiếm" },
  sheep: { personality: "Hiền lành, ấm áp, thích nghỉ ngơi.", element: "Mây", habitat: "Đồng cỏ", rarity: "Thường" },
  tiger: { personality: "Mạnh mẽ, thẳng thắn, luôn cảnh giác.", element: "Lôi", habitat: "Rừng sâu", rarity: "Hiếm" },
  panther: { personality: "Bí ẩn, độc lập, di chuyển rất khẽ.", element: "Bóng tối", habitat: "Rừng đêm", rarity: "Sử thi" },
  wolf: { personality: "Trung thành, bền bỉ, coi trọng đồng đội.", element: "Băng · Phong", habitat: "Thung lũng sao", rarity: "Hiếm" },
  crane: { personality: "Thanh nhã, điềm đạm, thích tự do.", element: "Phong", habitat: "Đầm mây", rarity: "Hiếm" },
  huli: { personality: "Lém lỉnh, duyên dáng, hơi kiêu kỳ.", element: "Linh hỏa", habitat: "Rừng trăng", rarity: "Sử thi" },
  koi: { personality: "Lạc quan, mềm mại, thích dòng chảy mới.", element: "Thủy", habitat: "Hồ mây", rarity: "Hiếm" },
  seadragon: { personality: "Tò mò, bền bỉ, thích len lỏi khám phá.", element: "Thủy · Mộc", habitat: "Rạn san hô", rarity: "Hiếm" },
  deer: { personality: "Nhẹ nhàng, cảnh giác, yêu thiên nhiên.", element: "Mộc", habitat: "Rừng sao", rarity: "Sử thi" },
  qilin: { personality: "Nhân hậu, công bằng, mang lại may mắn.", element: "Đất · Lửa", habitat: "Thung lũng linh khí", rarity: "Sử thi" },
  bunny: { personality: "Năng động, nhút nhát, thích những trò nhỏ.", element: "Mộc", habitat: "Vườn hoa", rarity: "Thường" },
  cat: { personality: "Độc lập, tò mò, thích chọn nhịp riêng.", element: "Nguyệt", habitat: "Mái nhà ấm", rarity: "Thường" },
  panda: { personality: "Điềm đạm, thân thiện, yêu sự thoải mái.", element: "Đất", habitat: "Rừng trúc", rarity: "Thường" },
  slime: { personality: "Hồn nhiên, vui tính, dễ kết bạn.", element: "Thạch", habitat: "Suối phép", rarity: "Thường" },
  "night-cat": { personality: "Lặng lẽ, tinh ý, thích màn đêm.", element: "Bóng tối", habitat: "Rừng đêm", rarity: "Hiếm" },
  lion: { personality: "Đĩnh đạc, quả cảm, có tinh thần thủ lĩnh.", element: "Nắng", habitat: "Thảo nguyên", rarity: "Hiếm" },
  dragon: { personality: "Hiếu kỳ, tự tin, thích thử sức đôi cánh.", element: "Hỏa · Phong", habitat: "Hang pha lê", rarity: "Sử thi" },
  triceratops: { personality: "Điềm tĩnh, kiên định, luôn bảo vệ bạn bè.", element: "Đất", habitat: "Rừng cổ đại", rarity: "Hiếm" },
  "t-rex": { personality: "Gan dạ, hiếu động, thích dẫn đầu chuyến đi.", element: "Hỏa · Đất", habitat: "Thung lũng cổ", rarity: "Sử thi" },
  stegosaurus: { personality: "Hiền hòa, chậm rãi, yêu nhịp sống bình yên.", element: "Mộc · Đất", habitat: "Đồng dương xỉ", rarity: "Hiếm" },
  "western-dragon": { personality: "Độc lập, kiêu hãnh, thích bay thật cao.", element: "Hỏa · Phong", habitat: "Đỉnh núi mây", rarity: "Huyền thoại" },
  phoenix: { personality: "Rực rỡ, lạc quan, luôn truyền cảm hứng.", element: "Hỏa", habitat: "Đỉnh bình minh", rarity: "Huyền thoại" },
  unicorn: { personality: "Tinh tế, dịu dàng, tin vào điều tốt đẹp.", element: "Ánh sáng", habitat: "Đồng cỏ cầu vồng", rarity: "Sử thi" },
  moon: { personality: "Trầm lặng, mộng mơ, thích ngắm trời đêm.", element: "Nguyệt", habitat: "Bầu trời đêm", rarity: "Hiếm" },
  crystal: { personality: "Tĩnh tại, trong sáng, thích lưu giữ ký ức.", element: "Pha lê", habitat: "Hang tinh thể", rarity: "Hiếm" },
  mushroom: { personality: "Vui vẻ, hiếu khách, thích nơi ẩm mát.", element: "Mộc", habitat: "Rừng nấm", rarity: "Thường" },
  pig: { personality: "Hồn nhiên, ấm áp, mang đến niềm vui và may mắn.", element: "Đất · Ánh sáng", habitat: "Vườn hồng", rarity: "Hiếm" },
  capybara: { personality: "Điềm đạm, dễ gần, luôn giữ tinh thần thư thái.", element: "Mộc · Thủy", habitat: "Suối nắng", rarity: "Thường" },
  axolotl: { personality: "Dịu dàng, tò mò, thích khám phá thế giới dưới nước.", element: "Thủy", habitat: "Hồ san hô", rarity: "Hiếm" },
  corgi: { personality: "Trung thành, tinh nghịch, luôn tràn đầy năng lượng.", element: "Nắng", habitat: "Đồng cỏ mật ong", rarity: "Thường" },
};

export function getSpiritProfile(spirit: Spirit): SpiritProfile {
  return SPIRIT_PROFILES[spirit.id] ?? {
    personality: "Thân thiện, tò mò và thích khám phá.",
    element: "Tự nhiên",
    habitat: "Vùng đất Mochi",
    rarity: spirit.group === "myth" ? "Huyền thoại" : "Thường",
  };
}

export const WORLD_PREFS_KEY = "mochi-pixel-world-v1";
export const SPIRIT_CARE_KEY = "mochi-spirit-pets";
export const SPIRIT_CHANGE_EVENT = "mochi-spirit-change";
export const SPIRIT_CARE_EVENT = "mochi-spirit-care";
export const WORLD_CHANGE_EVENT = "mochi-world-change";

export function readSpiritCareCount(): number {
  try {
    const value = Number(localStorage.getItem(SPIRIT_CARE_KEY) ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function addSpiritCare(): number {
  const next = readSpiritCareCount() + 1;
  try {
    localStorage.setItem(SPIRIT_CARE_KEY, String(next));
  } catch {
    /* Keep the interaction available for this session. */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<number>(SPIRIT_CARE_EVENT, { detail: next }));
  return next;
}
