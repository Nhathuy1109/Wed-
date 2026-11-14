/** Parse HTML (từ mammoth / Word) thành danh sách câu trắc nghiệm. */

export type QuizOption = { text: string; correct: boolean };
export type QuizQuestion = {
  question: string;
  options: QuizOption[];
  explanation: string;
};

export type ParseResult = {
  title: string;
  questions: QuizQuestion[];
  warnings: string[];
};

const YELLOW_RE =
  /background(-color)?:\s*(#fff[2-9a-f]{0,3}|#ff0|#ffff00|#ffeb3b|#ffe082|#fdd835|#ffd54f|yellow|rgb\(\s*255\s*,\s*2[0-5]{2}\s*,\s*[0-9]{1,3}\s*\))/i;

const ANSWER_LINE_RE =
  /^(?:đáp\s*án|dap\s*an|answer|correct)\s*[:：.\-]?\s*([A-Da-d1-4])\b/i;

const EXPLAIN_RE =
  /^(?:giải\s*thích|giai\s*thich|explain|explanation|lý\s*do|ly\s*do)\s*[:：.\-]?\s*(.*)$/i;

const Q_START_RE =
  /^(?:câu\s*(\d+)|question\s*(\d+)|(\d+)\s*[.)、]|[Qq]\s*(\d+)\s*[.)])\s*(.*)$/;

const OPT_RE = /^([A-Da-d])\s*[.)、:：\-]\s*(.+)$/;

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isYellowHtml(chunk: string): boolean {
  return YELLOW_RE.test(chunk);
}

function isBoldHtml(chunk: string): boolean {
  return /<(strong|b)[\s>]/i.test(chunk) || /font-weight:\s*(bold|[6-9]00)/i.test(chunk);
}

/** Tách HTML thành các khối dòng, giữ HTML gốc để nhận bold/vàng. */
function htmlToBlocks(html: string): { html: string; text: string }[] {
  const normalized = html
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "</$1>\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return normalized
    .split(/\n+/)
    .map((line) => {
      const text = stripTags(line).replace(/\s+/g, " ").trim();
      return { html: line, text };
    })
    .filter((b) => b.text.length > 0);
}

function optionIndexFromLetter(ch: string): number {
  const c = ch.toUpperCase();
  if (c >= "A" && c <= "D") return c.charCodeAt(0) - 65;
  const n = Number(c);
  if (n >= 1 && n <= 4) return n - 1;
  return -1;
}


/** Parse văn bản thuần (PDF extract / plain text) thành câu hỏi. */
export function parsePlainQuizText(text: string, fileName = "Đề trắc nghiệm"): ParseResult {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const html = lines.map((l) => `<p>${escapeHtmlLite(l)}</p>`).join("\n");
  return parseWordQuizHtml(html, fileName);
}

function escapeHtmlLite(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function parseWordQuizHtml(html: string, fileName = "Đề trắc nghiệm"): ParseResult {
  const warnings: string[] = [];
  const blocks = htmlToBlocks(html);
  const questions: QuizQuestion[] = [];

  let i = 0;
  while (i < blocks.length) {
    const m = blocks[i].text.match(Q_START_RE);
    if (!m) {
      i += 1;
      continue;
    }
    let questionText = (m[5] || "").trim();
    i += 1;
    // gom dòng tiếp nếu chưa có option
    while (i < blocks.length && !OPT_RE.test(blocks[i].text) && !Q_START_RE.test(blocks[i].text) && !ANSWER_LINE_RE.test(blocks[i].text)) {
      if (EXPLAIN_RE.test(blocks[i].text)) break;
      questionText = `${questionText} ${blocks[i].text}`.trim();
      i += 1;
    }

    const options: QuizOption[] = [];
    let markedCorrect = -1;

    while (i < blocks.length) {
      const t = blocks[i].text;
      const om = t.match(OPT_RE);
      if (om) {
        const letter = om[1];
        const body = om[2].trim();
        const idx = optionIndexFromLetter(letter);
        const yellow = isYellowHtml(blocks[i].html);
        const bold = isBoldHtml(blocks[i].html);
        if (yellow || bold) markedCorrect = idx;
        options.push({ text: body, correct: false });
        i += 1;
        continue;
      }
      break;
    }

    let answerLetter = "";
    let explanation = "";

    while (i < blocks.length) {
      const t = blocks[i].text;
      if (Q_START_RE.test(t)) break;
      const am = t.match(ANSWER_LINE_RE);
      if (am) {
        answerLetter = am[1];
        i += 1;
        continue;
      }
      const em = t.match(EXPLAIN_RE);
      if (em) {
        explanation = (em[1] || "").trim();
        i += 1;
        // gom thêm dòng giải thích
        while (
          i < blocks.length &&
          !Q_START_RE.test(blocks[i].text) &&
          !OPT_RE.test(blocks[i].text) &&
          !ANSWER_LINE_RE.test(blocks[i].text)
        ) {
          explanation = `${explanation} ${blocks[i].text}`.trim();
          i += 1;
        }
        continue;
      }
      // dòng lạ trong khối câu → bỏ
      i += 1;
      break;
    }

    if (options.length < 2) {
      warnings.push(`Bỏ qua một câu (không đủ lựa chọn): ${questionText.slice(0, 40)}…`);
      continue;
    }

    let correctIdx = markedCorrect;
    if (correctIdx < 0 && answerLetter) {
      correctIdx = optionIndexFromLetter(answerLetter);
    }
    if (correctIdx < 0 || correctIdx >= options.length) {
      warnings.push(`Câu chưa rõ đáp án đúng (mặc định A): ${questionText.slice(0, 40)}…`);
      correctIdx = 0;
    }
    options.forEach((o, idx) => {
      o.correct = idx === correctIdx;
    });

    questions.push({
      question: questionText || `Câu ${questions.length + 1}`,
      options,
      explanation,
    });
  }

  if (!questions.length) {
    warnings.push("Không tìm thấy câu hỏi. Hãy đánh số: Câu 1. … và A. B. C. D.");
  }

  const title = fileName.replace(/\.[^.]+$/, "") || "Đề trắc nghiệm";
  return { title, questions, warnings };
}

/** Sinh HTML đề thực hành theo mẫu quiz-mau (tiến độ, phản hồi ngay, thống kê, làm lại câu sai). */
export function buildPracticeHtml(title: string, questions: QuizQuestion[]): string {
  const data = questions.map((q) => {
    const opts = q.options.map((o) => o.text);
    const a = Math.max(0, q.options.findIndex((o) => o.correct));
    return { q: q.question, o: opts, a, e: q.explanation || "" };
  });
  const payload = JSON.stringify([data])
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  const safeTitle = escapeHtml(title);
  const storageKey =
    "quiz_" +
    title
      .toLowerCase()
      .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+/gi, "_")
      .replace(/_+/g, "_")
      .slice(0, 48);

  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${safeTitle}</title>
<style>
:root{--bg:#f3f9ff;--card:#fff;--ink:#1f2a44;--mute:#6b7a99;--blue:#cfe9ff;--blue2:#4a9fe0;--pink:#ffe0ec;--pink2:#f0709f;--ok:#1f9d6a;--okbg:#e0f8ee;--bad:#e5484d;--badbg:#ffe6e9;--line:#e2ebf7;--hd:#f3f9ff;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141a2a;--card:#1d2540;--ink:#e8eefc;--mute:#9aa8c9;--blue:#27406b;--blue2:#7cc0f5;--pink:#4a2a40;--pink2:#ff9cc2;--ok:#4fd6a0;--okbg:#17382d;--bad:#ff7075;--badbg:#472126;--line:#2c3758;--hd:#141a2a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#141a2a;--card:#1d2540;--ink:#e8eefc;--mute:#9aa8c9;--blue:#27406b;--blue2:#7cc0f5;--pink:#4a2a40;--pink2:#ff9cc2;--ok:#4fd6a0;--okbg:#17382d;--bad:#ff7075;--badbg:#472126;--line:#2c3758;--hd:#141a2a;color-scheme:dark}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{scroll-padding-top:env(safe-area-inset-top,0px)}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:720px;margin-inline:auto;padding:0 12px 80px;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);background:var(--hd);z-index:30}
h1{font-size:22px;margin:16px 0 2px;text-align:center}
.sub{text-align:center;color:var(--mute);font-size:13px;margin:0 0 12px}
#tabs{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px}
.tab{flex:none;border:2px solid var(--blue);background:var(--card);color:var(--ink);border-radius:999px;padding:10px 18px;font:600 15px inherit;cursor:pointer;min-height:44px}
.tab.on{background:var(--blue2);border-color:var(--blue2);color:#fff}
#weak{background:var(--pink);border-radius:18px;padding:12px 14px;margin:2px 0 10px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;font-size:14px}
#bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;background:var(--hd);padding:8px 0 6px;border-bottom:1px solid var(--line)}
.r1{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
#cnt{font-weight:700;font-size:14px}
.btn{border:0;border-radius:14px;padding:11px 16px;font:700 14px inherit;cursor:pointer;min-height:44px;background:var(--blue);color:var(--ink)}
.btn.p{background:var(--pink2);color:#fff}.btn.b{background:var(--blue2);color:#fff}.btn.s{min-height:38px;padding:8px 12px}
.prog{height:10px;border-radius:99px;background:var(--line);overflow:hidden}
#fill{height:100%;width:0;background:linear-gradient(90deg,var(--blue2),var(--pink2));border-radius:99px;transition:width .4s}
#nav{display:flex;gap:6px;overflow-x:auto;padding:8px 0 2px}
.nb{flex:none;width:36px;height:36px;border-radius:12px;border:2px solid var(--blue);background:var(--card);color:var(--ink);font:700 13px inherit;cursor:pointer}
.nb.ok{background:var(--ok);border-color:var(--ok);color:#fff}.nb.bad{background:var(--bad);border-color:var(--bad);color:#fff}
.card{background:var(--card);border:2px solid var(--line);border-radius:22px;padding:16px;margin:14px 0;scroll-margin-top:170px;box-shadow:0 4px 14px rgba(74,159,224,.08)}
.card.ok{border-color:var(--ok)}.card.bad{border-color:var(--bad)}
.qn{display:inline-block;background:var(--pink);color:var(--pink2);font-weight:800;font-size:13px;border-radius:99px;padding:2px 12px;margin-bottom:8px}
.qt{font-weight:650;margin-bottom:12px}
.opts{display:grid;gap:9px}
.opt{display:flex;gap:10px;align-items:flex-start;text-align:left;width:100%;border:2px solid var(--blue);background:var(--card);color:var(--ink);border-radius:16px;padding:12px;font:inherit;cursor:pointer;min-height:48px}
.opt:disabled{cursor:default;opacity:1}
.ltr{flex:none;width:28px;height:28px;border-radius:50%;background:var(--blue);display:grid;place-items:center;font-weight:800;font-size:13px}
.otx{padding-top:2px;overflow-wrap:anywhere}
.opt.right{background:var(--okbg);border-color:var(--ok)}.opt.right .ltr{background:var(--ok);color:#fff}
.opt.wrong{background:var(--badbg);border-color:var(--bad)}.opt.wrong .ltr{background:var(--bad);color:#fff}
.ex{margin-top:12px;background:var(--bg);border-radius:14px;padding:10px 12px;font-size:14px}
#res{background:var(--card);border:2px solid var(--pink2);border-radius:24px;padding:18px;margin:18px 0;text-align:center}
#res h2{margin:0 0 4px}.big{font-size:40px;font-weight:800;color:var(--blue2)}
.rv{text-align:left;background:var(--bg);border-radius:14px;padding:10px 12px;margin:8px 0;font-size:14px}
.acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px}
details{background:var(--card);border:2px solid var(--line);border-radius:18px;padding:10px 14px;margin:18px 0;font-size:14px}
summary{font-weight:700;cursor:pointer}
details li{margin:6px 0}
.fx{position:fixed;pointer-events:none;z-index:45}
.star{color:#f7b500;text-shadow:0 0 6px #ffe27a,0 0 12px #ffd23f;animation:st .9s ease-out forwards}
@keyframes st{0%{transform:translate(0,0) scale(.4) rotate(0);opacity:1}70%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1.1) rotate(var(--r));opacity:0}}
#flash{position:fixed;inset:0;z-index:40;pointer-events:none;background:rgba(229,72,77,.4);opacity:0}
#flash.go{animation:fl .7s steps(1) forwards}
@keyframes fl{0%{opacity:1}15%{opacity:0}30%{opacity:1}45%{opacity:0}60%{opacity:.9}80%{opacity:0}100%{opacity:0}}
#crack{position:fixed;inset:0;width:100%;height:100%;z-index:42;pointer-events:none}
#crack polyline{fill:none;stroke:#fff;stroke-width:2;stroke-linejoin:round;filter:drop-shadow(0 0 2px #e5484d);animation:ck 1.3s ease-out forwards}
@keyframes ck{0%{opacity:1}70%{opacity:1}100%{opacity:0}}
.conf{top:-20px;animation:cf var(--t) linear forwards}
@keyframes cf{to{transform:translate(var(--dx),110vh) rotate(var(--r))}}
.big2{font-size:42px}
@media (prefers-reduced-motion:reduce){.star,.conf{animation-duration:.01s}}
</style>
</head><body>
<h1>🌸 ${safeTitle}</h1>
<p class="sub">Làm câu nào trước cũng được · chọn đáp án để xem ngay kết quả</p>
<div id="tabs"></div>
<div id="weak" hidden></div>
<div id="bar">
 <div class="r1"><span id="cnt"></span><span><button class="btn s" id="bRe">Làm lại</button> <button class="btn s p" id="bSub">Nộp bài</button></span></div>
 <div class="prog"><div id="fill"></div></div>
 <div id="nav"></div>
</div>
<div id="list"></div>
<div id="res" hidden></div>
<details id="st"><summary>📊 Thống kê của bạn</summary><div id="stb"></div></details>
<div id="flash"></div>
<script>
/* Dữ liệu đề (1 đề từ file Word/PDF) */
const D=${payload};
const KEY=${JSON.stringify(storageKey)};
const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const sh=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
let mem={wrong:{},hist:[]},S={},cur="0";
try{const m=JSON.parse(localStorage.getItem(KEY));if(m&&m.wrong&&m.hist)mem=m}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(mem))}catch(e){}};
function mk(ids){return{ids,done:false,saved:false,items:sh(ids).map(id=>{const[e,i]=id.split(":"),q=D[e][i];return{id,q:q.q,e:q.e,pick:-1,o:sh(q.o.map((t,k)=>({t,ok:k===q.a})))}})}}
const weakIds=()=>Object.keys(mem.wrong).filter(id=>mem.wrong[id]>=3&&D[id.split(":")[0]]&&D[id.split(":")[0]][id.split(":")[1]]);
const qtext=id=>{const[e,i]=id.split(":");return D[e][i].q};
for(let e=0;e<D.length;e++)S[e]=mk(D[e].map((_,i)=>e+":"+i));

function tabs(){const t=$("#tabs");t.textContent="";const ks=D.map((_,i)=>""+i);if(S.retry)ks.push("retry");if(S.weak)ks.push("weak");
 ks.forEach(k=>{const b=el("button","tab"+(k===cur?" on":""),k==="retry"?"Câu sai":k==="weak"?"Hay sai":"Đề "+(+k+1));b.onclick=()=>{cur=k;renderAll();window.scrollTo(0,0)};t.append(b)})}
function weakBanner(){const w=weakIds(),b=$("#weak");b.hidden=!w.length;if(!w.length)return;b.textContent="";
 b.append(el("span",null,\`💡 Có \${w.length} câu bạn đã sai từ 3 lần trở lên. Nên luyện lại nha!\`));const x=el("button","btn p s","Luyện các câu hay sai");x.onclick=()=>{S.weak=mk(w);cur="weak";renderAll();window.scrollTo(0,0)};b.append(x)}
function stats(){const b=$("#stb");b.textContent="";const n=mem.hist.length;b.append(el("p",null,\`Số lượt làm xong: \${n}\`+(n?\` · điểm trung bình \${Math.round(mem.hist.reduce((a,h)=>a+h.r/h.n,0)/n*100)}%\`:"")));
 const top=Object.entries(mem.wrong).filter(([id])=>D[id.split(":")[0]]).sort((a,b)=>b[1]-a[1]).slice(0,5);
 if(top.length){b.append(el("b",null,"Các câu sai nhiều nhất:"));const ul=el("ul");top.forEach(([id,c])=>ul.append(el("li",null,\`Sai \${c} lần — \${qtext(id).slice(0,90)}\${qtext(id).length>90?"…":""}\`)));b.append(ul)}else b.append(el("p",null,"Chưa có câu nào sai. Giỏi quá! 🎉"));
 const r=el("button","btn s","Xóa thống kê");r.onclick=()=>{if(confirm("Xóa toàn bộ thống kê?")){mem={wrong:{},hist:[]};save();delete S.weak;if(cur==="weak")cur="0";renderAll()}};b.append(r)}
function renderAll(){tabs();weakBanner();stats();const s=S[cur],L=$("#list"),N=$("#nav");L.textContent="";N.textContent="";$("#res").hidden=true;
 s.items.forEach((it,i)=>{const c=el("div","card");c.id="q"+i;c.append(el("div","qn","Câu "+(i+1)),el("div","qt",it.q));
  const ol=el("div","opts");it.o.forEach((o,k)=>{const b=el("button","opt");b.append(el("span","ltr","ABCD"[k]),el("span","otx",o.t));b.onclick=ev=>pick(i,k,ev);ol.append(b)});
  const ex=el("div","ex");ex.hidden=true;c.append(ol,ex);L.append(c);
  const nb=el("button","nb",i+1);nb.onclick=()=>c.scrollIntoView({behavior:"smooth",block:"start"});N.append(nb);apply(i)});
 updBar();if(s.items.every(x=>x.pick>=0))result()}
function apply(i){const it=S[cur].items[i];if(it.pick<0)return;const c=$("#q"+i),ok=it.o[it.pick].ok;c.classList.add(ok?"ok":"bad");
 c.querySelectorAll(".opt").forEach((b,k)=>{b.disabled=true;if(it.o[k].ok)b.classList.add("right");else if(k===it.pick)b.classList.add("wrong")});
 const ex=c.querySelector(".ex");ex.hidden=false;ex.textContent="";ex.append(el("b",null,(ok?"✅ Chính xác! ":"❌ Chưa đúng. ")+"Đáp án đúng: "+"ABCD"[it.o.findIndex(o=>o.ok)]+". "),document.createTextNode(it.e))}
function updBar(){const s=S[cur],n=s.items.length,d=s.items.filter(x=>x.pick>=0),r=d.filter(x=>x.o[x.pick].ok).length;
 $("#cnt").textContent=\`Đã làm \${d.length}/\${n} · Đúng \${r}\`;$("#fill").style.width=d.length/n*100+"%";
 [...$("#nav").children].forEach((b,i)=>{const x=s.items[i];b.className="nb"+(x.pick<0?"":x.o[x.pick].ok?" ok":" bad")})}
function pick(i,k,ev){const s=S[cur],it=s.items[i];if(it.pick>=0)return;it.pick=k;const ok=it.o[k].ok;
 const x=ev&&ev.clientX||innerWidth/2,y=ev&&ev.clientY||innerHeight/2;
 if(!ok){mem.wrong[it.id]=(mem.wrong[it.id]||0)+1;save()}
 apply(i);updBar();ok?burst(x,y):crack(x,y);
 if(s.items.every(z=>z.pick>=0))setTimeout(()=>{if(S[cur]===s)result(true)},1500)}
function fx(txt,x,y,cls,css,ms){const e=el("div","fx "+cls,txt);e.style.cssText=\`left:\${x}px;top:\${y}px;\`+css;document.body.append(e);setTimeout(()=>e.remove(),ms)}
function burst(x,y){for(let i=0;i<14;i++){const a=Math.random()*6.283,d=40+Math.random()*80;fx(Math.random()<.7?"★":"✦",x,y,"star",\`--dx:\${Math.cos(a)*d}px;--dy:\${Math.sin(a)*d-30}px;--r:\${Math.random()*360}deg;font-size:\${12+Math.random()*12}px\`,1000)}}
function crack(x,y){$("#flash").className="";void $("#flash").offsetWidth;$("#flash").className="go";
 const old=$("#crack");if(old)old.remove();const NS="http://www.w3.org/2000/svg",s=document.createElementNS(NS,"svg");s.id="crack";s.setAttribute("viewBox",\`0 0 \${innerWidth} \${innerHeight}\`);
 for(let a=0;a<9;a++){let ang=a*40*Math.PI/180+Math.random()*.5,px=x,py=y,pts=[[x,y]],n=4+Math.floor(Math.random()*5);
  for(let j=0;j<n;j++){ang+=(Math.random()-.5)*.7;const l=25+Math.random()*50;px+=Math.cos(ang)*l;py+=Math.sin(ang)*l;pts.push([px,py])}
  const pl=document.createElementNS(NS,"polyline");pl.setAttribute("points",pts.map(p=>p.join(",")).join(" "));s.append(pl)}
 document.body.append(s);setTimeout(()=>s.remove(),1400)}
function confetti(){const cs=["#ffb3d1","#9fd4ff","#fff","#ffd23f","#c8b6ff","#b5ead7"];for(let i=0;i<80;i++){const st=Math.random()<.2;
 fx(st?"★":"",Math.random()*innerWidth,0,"conf"+(st?" star":""),\`--dx:\${(Math.random()-.5)*160}px;--r:\${Math.random()*900}deg;--t:\${2.4+Math.random()*2}s;\`+(st?"font-size:20px;animation-name:cf":\`width:9px;height:14px;background:\${cs[i%6]}\`),4600)}}
function result(auto){const s=S[cur],n=s.items.length,d=s.items.filter(x=>x.pick>=0),r=d.filter(x=>x.o[x.pick].ok).length,w=d.length-r,all=d.length===n,pct=Math.round(r/n*100),B=$("#res");
 B.hidden=false;B.textContent="";
 const msg=pct>=90?"Quá đỉnh luôn! Bạn xứng đáng top đầu 🏆":pct>=80?"Giỏi lắm! Chúc mừng bạn nha 🎉":pct>=50?"Khá ổn, cố thêm chút nữa nha 💪":"Đừng buồn, làm lại sẽ tốt hơn 🌱";
 B.append(el("h2",null,all?"Kết quả":"Kết quả tạm thời"),el("div","big",\`\${r}/\${n}\`),el("div",null,\`\${pct}% · Sai \${w}\`+(all?"":\` · Chưa làm \${n-d.length}\`)),el("p",null,msg));
 if(all&&!s.saved){s.saved=true;mem.hist.push({k:cur,r,n,t:Date.now()});save();stats();if(pct>=80){confetti();for(let i=0;i<5;i++)setTimeout(()=>burst(innerWidth*(.15+Math.random()*.7),innerHeight*(.2+Math.random()*.4)),i*250)}}
 const bad=d.filter(x=>!x.o[x.pick].ok);
 if(bad.length){B.append(el("b",null,"Xem lại các câu sai:"));bad.forEach(x=>{const v=el("div","rv");v.append(el("b",null,x.q),el("div",null,"❌ Bạn chọn: "+x.o[x.pick].t),el("div",null,"✅ Đúng: "+x.o.find(o=>o.ok).t),el("div",null,"💡 "+x.e));B.append(v)})}
 const a=el("div","acts");if(bad.length){const b=el("button","btn p","Làm lại các câu sai");b.onclick=()=>{S.retry=mk(bad.map(x=>x.id));cur="retry";renderAll();window.scrollTo(0,0)};a.append(b)}
 const b2=el("button","btn b","Làm lại");b2.onclick=redo;a.append(b2);B.append(a);if(auto)setTimeout(()=>B.scrollIntoView({behavior:"smooth",block:"start"}),100)}
function redo(){const s=S[cur];S[cur]=mk(cur==="weak"&&weakIds().length?weakIds():s.ids);renderAll();window.scrollTo(0,0)}
$("#bRe").onclick=redo;$("#bSub").onclick=()=>result(true);
renderAll();

</script></body></html>`;
}


function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
