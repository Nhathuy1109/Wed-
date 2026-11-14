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

/** Sinh HTML đề thực hành — giao diện kiểu quiz-mau, vẫn tương thích finish()/st của web. */
export function buildPracticeHtml(title: string, questions: QuizQuestion[]): string {
  const data = questions.map((q) => ({
    q: q.question,
    o: q.options.map((o) => ({ t: o.text, ok: o.correct })),
    e: q.explanation || "",
  }));
  const payload = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<style>
:root{--bg:#f3f9ff;--card:#fff;--ink:#1f2a44;--mute:#6b7a99;--blue:#cfe9ff;--blue2:#4a9fe0;--pink:#ffe0ec;--pink2:#f0709f;--ok:#1f9d6a;--okbg:#e0f8ee;--bad:#e5484d;--badbg:#ffe6e9;--line:#e2ebf7;--hd:#f3f9ff;box-sizing:border-box;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#141a2a;--card:#1d2540;--ink:#e8eefc;--mute:#9aa8c9;--blue:#27406b;--blue2:#7cc0f5;--pink:#4a2a40;--pink2:#ff9cc2;--ok:#4fd6a0;--okbg:#17382d;--bad:#ff7075;--badbg:#472126;--line:#2c3758;--hd:#141a2a;color-scheme:dark}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:720px;margin-inline:auto;padding:12px 12px 80px}
h1.ttl{font-size:22px;margin:8px 0 4px;text-align:center}
.sub{text-align:center;color:var(--mute);font-size:13px;margin:0 0 12px}
#bar{position:sticky;top:0;z-index:20;background:var(--hd);padding:8px 0 6px;border-bottom:1px solid var(--line);margin:0 -12px;padding-left:12px;padding-right:12px}
.r1{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
#cnt{font-weight:700;font-size:14px}
.btn{border:0;border-radius:14px;padding:11px 16px;font:700 14px inherit;cursor:pointer;min-height:44px;background:var(--blue);color:var(--ink)}
.btn.p{background:var(--pink2);color:#fff}.btn.b{background:var(--blue2);color:#fff}.btn.s{min-height:38px;padding:8px 12px}
.btn:disabled{opacity:.5;cursor:default}
.prog{height:10px;border-radius:99px;background:var(--line);overflow:hidden}
#fill{height:100%;width:0;background:linear-gradient(90deg,var(--blue2),var(--pink2));border-radius:99px;transition:width .35s}
#nav{display:flex;gap:6px;overflow-x:auto;padding:8px 0 2px}
.nb{flex:none;width:36px;height:36px;border-radius:12px;border:2px solid var(--blue);background:var(--card);color:var(--ink);font:700 13px inherit;cursor:pointer}
.nb.ok{background:var(--ok);border-color:var(--ok);color:#fff}.nb.bad{background:var(--bad);border-color:var(--bad);color:#fff}.nb.pick{border-color:var(--blue2)}
.qc{background:var(--card);border:2px solid var(--line);border-radius:22px;padding:16px;margin:14px 0;scroll-margin-top:120px;box-shadow:0 4px 14px rgba(74,159,224,.08)}
.qc.ok{border-color:var(--ok)}.qc.bad{border-color:var(--bad)}
.qn{display:inline-block;background:var(--pink);color:var(--pink2);font-weight:800;font-size:13px;border-radius:99px;padding:2px 12px;margin-bottom:8px}
.q{font-weight:650;margin-bottom:12px}
.opt{display:flex;gap:10px;align-items:flex-start;text-align:left;width:100%;border:2px solid var(--blue);background:var(--card);color:var(--ink);border-radius:16px;padding:12px;font:inherit;cursor:pointer;min-height:48px;margin:0 0 9px}
.opt:disabled{cursor:default}
.ltr{flex:none;width:28px;height:28px;border-radius:50%;background:var(--blue);display:grid;place-items:center;font-weight:800;font-size:13px}
.otx{padding-top:2px;overflow-wrap:anywhere}
.opt.pick{border-color:var(--blue2);background:var(--blue)}
.opt.ok,.opt.right{background:var(--okbg);border-color:var(--ok)}.opt.ok .ltr,.opt.right .ltr{background:var(--ok);color:#fff}
.opt.bad,.opt.wrong{background:var(--badbg);border-color:var(--bad)}.opt.bad .ltr,.opt.wrong .ltr{background:var(--bad);color:#fff}
.exp{display:none;margin-top:12px;background:var(--bg);border-radius:14px;padding:10px 12px;font-size:14px}
.exp.show{display:block}
#score{font-weight:700;margin-left:8px}
.acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
</style></head><body>
<h1 id="ttl" class="ttl">🌸 ${escapeHtml(title)}</h1>
<p class="sub">Chọn đáp án rồi bấm Nộp bài · làm câu nào trước cũng được</p>
<div id="bar">
 <div class="r1"><span id="cnt">Đã chọn 0/0</span><span class="acts"><button class="btn s" type="button" id="bRe">Làm lại</button><button class="btn s p" type="button" id="btnFinish">Nộp bài</button><span id="score"></span></span></div>
 <div class="prog"><div id="fill"></div></div>
 <div id="nav"></div>
</div>
<div id="app"></div>
<script>
var DATA = ${payload};
var st = { k: ${JSON.stringify(title)}, qs: DATA.map(function(q){ return { q:q.q, o:q.o.map(function(o){return {t:o.t,ok:!!o.ok}}), e:q.e||"", pick:-1 }; }), score: 0 };
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
function updBar(){
  var n=st.qs.length,d=st.qs.filter(function(q){return q.pick>=0}).length;
  document.getElementById("cnt").textContent="Đã chọn "+d+"/"+n+(st._done?" · Đúng "+st.score:"");
  document.getElementById("fill").style.width=(n?d/n*100:0)+"%";
  var nav=document.getElementById("nav");
  if(nav)[...nav.children].forEach(function(b,i){
    var q=st.qs[i],cls="nb";
    if(st._done){var ci=q.o.findIndex(function(o){return o.ok});cls+=q.pick===ci?" ok":" bad"}
    else if(q.pick>=0)cls+=" pick";
    b.className=cls;
  });
}
function render(){
  var app=document.getElementById("app"),nav=document.getElementById("nav");
  app.innerHTML="";nav.innerHTML="";
  st.qs.forEach(function(q,qi){
    // xáo đáp án mỗi lần render (giữ mapping ok)
    if(!q._shuffled){q.o=shuffle(q.o);q._shuffled=true;q.pick=-1}
    var box=document.createElement("div");
    box.className="qc";box.id="q"+qi;
    box.innerHTML='<div class="qn">Câu '+(qi+1)+'</div><div class="q"></div>';
    box.querySelector(".q").textContent=q.q;
    q.o.forEach(function(o,oi){
      var b=document.createElement("button");
      b.type="button";b.className="opt";
      var ltr=document.createElement("span");ltr.className="ltr";ltr.textContent=String.fromCharCode(65+oi);
      var otx=document.createElement("span");otx.className="otx";otx.textContent=o.t;
      b.appendChild(ltr);b.appendChild(otx);
      b.onclick=function(){
        if(st._done)return;
        q.pick=oi;
        box.querySelectorAll(".opt").forEach(function(el){el.classList.remove("pick")});
        b.classList.add("pick");
        updBar();
      };
      box.appendChild(b);
    });
    var exp=document.createElement("div");
    exp.className="exp";
    exp.textContent=q.e?("💡 "+q.e):"";
    box.appendChild(exp);
    app.appendChild(box);
    var nb=document.createElement("button");
    nb.type="button";nb.className="nb";nb.textContent=String(qi+1);
    nb.onclick=function(){box.scrollIntoView({behavior:"smooth",block:"start"})};
    nav.appendChild(nb);
  });
  updBar();
}
function finish(){
  st._done=true;
  var score=0;
  st.qs.forEach(function(q,qi){
    var box=document.querySelectorAll(".qc")[qi];
    var opts=box.querySelectorAll(".opt");
    var ci=q.o.findIndex(function(o){return o.ok});
    opts.forEach(function(el,oi){
      el.disabled=true;
      el.classList.remove("pick");
      if(oi===ci)el.classList.add("ok");
      if(q.pick===oi&&oi!==ci)el.classList.add("bad");
    });
    if(q.pick===ci){score++;box.classList.add("ok")}else{box.classList.add("bad")}
    var exp=box.querySelector(".exp");
    if(exp&&q.e)exp.classList.add("show");
  });
  st.score=score;
  document.getElementById("score").textContent="Đúng "+score+"/"+st.qs.length;
  var btn=document.getElementById("btnFinish");
  if(btn)btn.disabled=true;
  updBar();
  return score;
}
function redo(){
  st._done=false;st.score=0;
  st.qs.forEach(function(q){q.pick=-1;q._shuffled=false});
  document.getElementById("score").textContent="";
  var btn=document.getElementById("btnFinish");
  if(btn)btn.disabled=false;
  render();
  window.scrollTo(0,0);
}
document.getElementById("btnFinish").onclick=function(){finish()};
document.getElementById("bRe").onclick=function(){redo()};
render();
</script>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
