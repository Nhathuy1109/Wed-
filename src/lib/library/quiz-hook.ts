import type { WrongQuestion } from "@/lib/library/ids";

/** Chương "ảo" dùng cho chế độ ôn câu sai. Không tính điểm vào bảng xếp hạng. */
export const REVIEW_CHAPTER = "★";

/**
 * Đoạn script gắn vào cuối file đề trắc nghiệm (chạy trong khung sandbox):
 * - báo điểm + danh sách câu sai ra trang ngoài khi hàm finish() của đề chạy xong;
 * - thêm nút "Báo lỗi câu này" vào từng câu;
 * - nếu có `review`: mở sẵn chế độ ôn riêng các câu sai.
 * Đề nào khác mẫu (không có finish()/st/DATA) thì từng phần tự bỏ qua, không gây lỗi.
 */
export function buildQuizHook(review: WrongQuestion[] | null): string {
  const reviewJson = JSON.stringify(review && review.length ? review : null)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return String.raw`<script>(function(){try{
var REVIEW=${reviewJson};
function post(m){try{parent.postMessage(m,"*")}catch(e){}}
if(typeof finish==="function"&&typeof st!=="undefined"){
  var f=finish;
  window.finish=function(){
    var s=st,r=f.apply(this,arguments);
    try{if(s&&s.qs){
      var wrong=[];
      s.qs.forEach(function(q){
        var ci=q.o.findIndex(function(o){return o.ok});
        if(q.pick!==ci)wrong.push({q:q.q,o:q.o.map(function(o){return o.t}),a:ci,e:q.e||""});
      });
      post({__quizResult:1,chapter:String(s.k),score:s.score,total:s.qs.length,wrong:wrong});
    }}catch(e){}
    return r;
  };
}
function decorate(){
  try{
    document.querySelectorAll(".qc").forEach(function(c){
      if(c.querySelector(".rp-btn"))return;
      var b=document.createElement("button");
      b.type="button";b.className="rp-btn";b.textContent="⚠ Báo lỗi câu này";
      b.style.cssText="margin-top:8px;background:none;border:0;color:#999;font-size:12px;cursor:pointer;text-decoration:underline;padding:4px 0";
      b.onclick=function(){
        var p=c.querySelector(".q"),n=c.querySelector(".qn");
        post({__quizReport:1,chapter:String(typeof st!=="undefined"&&st?st.k:""),qn:n?n.textContent:"",question:p?p.textContent.slice(0,400):""});
      };
      c.appendChild(b);
    });
    document.querySelectorAll(".ttl").forEach(function(t){
      if(t.textContent.indexOf("Chương ★")===0)t.textContent=t.textContent.replace("Chương ★","Ôn câu sai");
    });
  }catch(e){}
}
new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
decorate();
if(REVIEW&&typeof DATA!=="undefined"&&typeof start==="function"){
  DATA["★"]=REVIEW.map(function(w){return{q:w.q,o:w.o,a:"ABCD"[w.a],e:w.e}});
  try{NAMES["★"]="Ôn câu sai"}catch(e){}
  start("★");
}
}catch(e){}})();</script>`;
}

export function withQuizHook(html: string, review: WrongQuestion[] | null): string {
  const hook = buildQuizHook(review);
  const at = html.toLowerCase().lastIndexOf("</body>");
  return at === -1 ? html + hook : html.slice(0, at) + hook + html.slice(at);
}
