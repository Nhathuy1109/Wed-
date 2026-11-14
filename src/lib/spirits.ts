export type SpiritGroup = "myth" | "cute" | "cool" | "fantasy";

export type Spirit = {
  id: string;
  name: string;
  trait: string;
  group: SpiritGroup;
  gait: string;
  lift: boolean;
  src: string;
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
  },
  {
    id: "huyen-vu",
    name: "Huyền Vũ",
    trait: "Rùa rắn phương Bắc — bình tĩnh, bền bỉ.",
    group: "myth",
    gait: "prowl",
    lift: false,
    src: "/mascots/pixel-huyen-vu.gif",
  },
  {
    id: "chu-tuoc",
    name: "Chu Tước",
    trait: "Phượng đỏ phương Nam — rực rỡ, tái sinh.",
    group: "myth",
    gait: "glide",
    lift: true,
    src: "/mascots/pixel-chu-tuoc.gif",
  },
  {
    id: "bach-ho",
    name: "Bạch Hổ",
    trait: "Hổ trắng phương Tây — dũng mãnh, bảo vệ.",
    group: "myth",
    gait: "prowl",
    lift: false,
    src: "/mascots/pixel-bach-ho.gif",
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
];

export const SPIRIT_KEY = "linh-thu-chon";
