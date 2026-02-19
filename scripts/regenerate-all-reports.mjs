/**
 * 모든 분석 결과의 report_html을 재생성하는 스크립트
 * 실행: node scripts/regenerate-all-reports.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE URL/KEY가 없습니다.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- 유틸리티 ---

const factorLabels = {
  attitude: "수업태도",
  self_directed: "자기주도성",
  assignment: "과제수행력",
  willingness: "학업의지",
  social: "사회성",
  management: "관리선호도",
  emotion: "심리·자신감",
};
const BASE_FACTOR_KEYS = ["attitude", "self_directed", "assignment", "willingness", "social", "management"];

function ratingLabel(score) {
  if (score >= 4) return "우수";
  if (score >= 3) return "양호";
  if (score >= 2) return "보통";
  return "주의";
}

function parseParadoxValue(raw) {
  if (raw == null) return { num: 0, str: "-" };
  const s = String(raw).trim();
  const n = Number(s);
  if (!isNaN(n) && s !== "") return { num: n, str: s };
  const m = s.match(/(\d+\.?\d*)/);
  if (m) return { num: Number(m[1]), str: s };
  const tm = { "매우 높음":5,"매우높음":5,"높음":4,"높은":4,"강함":4,"많음":4,"적극적":4,"보통":3,"중간":3,"평균":3,"낮음":2,"낮은":2,"약함":2,"적음":2,"소극적":2,"매우 낮음":1,"매우낮음":1,"부족":1 };
  for (const [k,v] of Object.entries(tm)) { if (s.includes(k)) return { num: v, str: s }; }
  return { num: 0, str: s };
}

function buildHTML(a) {
  const name = a.name;
  const school = a.school || "";
  const grade = a.grade || "";
  const schoolInfo = `${school} ${grade}`.trim();
  const createdDate = new Date(a.created_at).toISOString().split("T")[0].replace(/-/g, ".");

  const hasEmotion = a.score_emotion != null;
  const factorKeys = hasEmotion ? [...BASE_FACTOR_KEYS, "emotion"] : [...BASE_FACTOR_KEYS];

  const scores = {};
  const comments = {};
  for (const k of factorKeys) {
    scores[k] = a[`score_${k}`] ?? 0;
    comments[k] = a[`comment_${k}`] || "";
  }

  // Nav items (dynamic based on data)
  const navItems = [
    { id: "summary", label: "성향 요약" },
    { id: "factors", label: `${hasEmotion ? "7" : "6"}대 성향` },
    { id: "strengths", label: "주요 강점" },
    { id: "weaknesses", label: "개선 영역" },
  ];
  if (a.paradox && a.paradox.length > 0) {
    navItems.push({ id: "gap", label: "간극 분석" });
  }
  if (a.solutions && a.solutions.length > 0) {
    navItems.push({ id: "solution", label: "맞춤 솔루션" });
  }
  if (a.final_assessment) {
    navItems.push({ id: "final", label: "맞춤 지도" });
  }

  const navHTML = navItems.map((n, i) =>
    `<li><a href="#${n.id}"${i === 0 ? ' class="active"' : ''}>${n.label}</a></li>`
  ).join("");

  // Factor items
  const factorItemsHTML = factorKeys.map((key) => {
    const s = scores[key];
    const c = comments[key];
    const pct = Math.min((s / 5) * 100, 100);
    return `<div class="factor-item">
          <div class="factor-header">
            <span class="title">${factorLabels[key]}</span>
            <div class="score-wrap">
              <span class="score">${s.toFixed(1)}</span>
              <span class="badge">${ratingLabel(s)}</span>
            </div>
          </div>
          <div class="progress-bg"><div class="progress-fill" style="width:${pct}%"></div></div>
          ${c ? `<div class="factor-desc">${c}</div>` : ""}
        </div>`;
  }).join("");

  // Strengths
  const strengthsHTML = (a.strengths || []).map((item, idx) =>
    `<div class="list-item">
            <div class="list-num">${idx + 1}</div>
            <div class="list-text">
              <h3>${item.title}</h3>
              <p>${item.description}</p>
            </div>
          </div>`
  ).join("") || '<p style="font-size:13px;color:var(--text-sub)">데이터 없음</p>';

  // Weaknesses
  const weaknessesHTML = (a.weaknesses || []).map((item, idx) =>
    `<div class="list-item">
            <div class="list-num">${idx + 1}</div>
            <div class="list-text">
              <h3>${item.title}</h3>
              <p>${item.description}</p>
            </div>
          </div>`
  ).join("") || '<p style="font-size:13px;color:var(--text-sub)">데이터 없음</p>';

  // Paradox / Gap
  const gapHTML = (a.paradox || []).map((item, idx) => {
    const title = String(item.title || "");
    const desc = String(item.description || "");
    let lbl1 = "", lbl2 = "";
    let p1 = { num: 0, str: "-" }, p2 = { num: 0, str: "-" };

    if ("label1" in item && "label2" in item) {
      lbl1 = String(item.label1); lbl2 = String(item.label2);
      p1 = parseParadoxValue(item.value1);
      p2 = parseParadoxValue(item.value2);
    } else if ("studentView" in item && "nkView" in item) {
      lbl1 = "학생 인식"; lbl2 = "NK 평가";
      p1 = parseParadoxValue(item.studentView);
      p2 = parseParadoxValue(item.nkView);
    }

    const barsHTML = (p1.num > 0 || p2.num > 0)
      ? `<div class="gap-bars">
            <div class="gap-row">
              <span class="gap-label">${lbl1}</span>
              <div class="gap-bar-bg"><div class="gap-bar-fill" style="width:${Math.min((p1.num / 5) * 100, 100)}%;background:var(--primary-dark)"></div></div>
              <span class="gap-score">${p1.num > 0 ? p1.num.toFixed(1) : p1.str}</span>
            </div>
            <div class="gap-row">
              <span class="gap-label">${lbl2}</span>
              <div class="gap-bar-bg"><div class="gap-bar-fill" style="width:${Math.min((p2.num / 5) * 100, 100)}%;background:var(--accent-burgundy)"></div></div>
              <span class="gap-score">${p2.num > 0 ? p2.num.toFixed(1) : p2.str}</span>
            </div>
          </div>`
      : `<div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:600;color:var(--primary-dark);background:#F1F3F5;padding:4px 12px;border-radius:4px">${lbl1}: ${p1.str}</span>
            <span style="font-size:12px;font-weight:600;color:var(--accent-burgundy);background:var(--accent-burgundy-light);padding:4px 12px;border-radius:4px">${lbl2}: ${p2.str}</span>
          </div>`;

    return `<div class="gap-card">
          <div class="gap-header">
            <span class="badge">분석 ${idx + 1}</span>
            <h3>${title}</h3>
          </div>
          ${barsHTML}
          <p class="gap-desc">${desc}</p>
        </div>`;
  }).join("");

  // Solutions
  const solutionHTML = (a.solutions || []).map((sol) => {
    const actionsHTML = (sol.actions || []).map((act) =>
      `<li>${act}</li>`
    ).join("");
    return `<div class="step-card">
          <div class="step-header">
            <span class="step-title">${sol.step}단계 과정</span>
            <span class="step-period">${sol.weeks}</span>
          </div>
          <div class="step-body">
            <h4>${sol.goal}</h4>
            <ul class="step-list">${actionsHTML}</ul>
          </div>
        </div>`;
  }).join("");

  // Average score
  const avgScore = factorKeys.reduce((sum, k) => sum + scores[k], 0) / factorKeys.length;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>NK 성향분석 - ${name}</title>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    *{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth;scroll-padding-top:64px}
    body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',serif;background:#f8f9fa;color:#212529;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
    :root{--primary-dark:#1A1D24;--primary-gold:#C6A87C;--gold-light:#F2EDE4;--text-main:#2C3038;--text-sub:#6C727D;--border-light:#E9ECEF;--accent-burgundy:#7A3B3B;--accent-burgundy-light:#F8EFEF}
    .wrap{max-width:480px;margin:0 auto;padding:0 0 60px;background:#fff;min-height:100vh;box-shadow:0 0 40px rgba(0,0,0,0.05)}
    .hdr{background:linear-gradient(145deg,var(--primary-dark),#2B303B);padding:40px 24px 32px;color:#fff;position:relative;overflow:hidden}
    .hdr::after{content:'';position:absolute;top:-30%;right:-20%;width:250px;height:250px;background:radial-gradient(circle,rgba(198,168,124,0.15),transparent 70%);border-radius:50%}
    .hdr .brand{display:flex;align-items:center;gap:8px;margin-bottom:24px;position:relative;z-index:1}
    .hdr .brand .logo{width:28px;height:28px;border-radius:4px;background:var(--primary-gold);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;letter-spacing:0.05em}
    .hdr .brand span{font-size:12px;font-weight:500;color:rgba(255,255,255,0.7);letter-spacing:0.02em}
    .hdr .sub{font-size:11px;color:var(--primary-gold);letter-spacing:0.05em;font-weight:600;margin-bottom:6px}
    .hdr h1{font-size:24px;font-weight:800;letter-spacing:-0.02em;margin-bottom:32px;line-height:1.3}
    .hdr .info-card{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;backdrop-filter:blur(10px);position:relative;z-index:1}
    .hdr .info-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .hdr .name{font-size:20px;font-weight:700;color:#fff}
    .hdr .avg{display:inline-flex;align-items:center;background:rgba(198,168,124,0.15);border:1px solid rgba(198,168,124,0.3);padding:4px 12px;border-radius:4px;font-size:12px;font-weight:700;color:var(--primary-gold)}
    .hdr .info-bottom{display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.1);padding-top:12px}
    .hdr .meta{font-size:12px;color:rgba(255,255,255,0.6)}
    .nav-wrap{position:sticky;top:0;z-index:100;background:rgba(255,255,255,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(198,168,124,0.2);box-shadow:0 4px 20px rgba(0,0,0,0.03);overflow-x:auto;white-space:nowrap;-ms-overflow-style:none;scrollbar-width:none}
    .nav-wrap::-webkit-scrollbar{display:none}
    .nav-menu{display:flex;padding:0 24px;list-style:none;gap:24px}
    .nav-menu li{display:inline-block}
    .nav-menu a{display:block;padding:16px 0;font-size:14px;font-weight:700;color:var(--text-sub);text-decoration:none;position:relative;transition:color 0.3s ease}
    .nav-menu a:hover,.nav-menu a.active{color:var(--primary-dark)}
    .nav-menu a::after{content:'';position:absolute;bottom:0;left:0;width:0;height:2px;background:var(--primary-gold);transition:width 0.3s ease}
    .nav-menu a:hover::after,.nav-menu a.active::after{width:100%}
    .content-body{padding:0 24px}
    .sec{margin-top:40px}
    .sec-title{display:flex;align-items:center;gap:10px;margin-bottom:20px}
    .sec-title::before{content:'';display:block;width:3px;height:16px;background:var(--primary-gold)}
    .sec-title h2{font-size:17px;font-weight:800;color:var(--text-main);letter-spacing:-0.02em}
    .summary-box{background:var(--gold-light);border-radius:12px;padding:24px;border:1px solid rgba(198,168,124,0.3);box-shadow:0 8px 24px rgba(198,168,124,0.08)}
    .summary-box .type-tag{display:inline-block;font-size:12px;font-weight:700;padding:6px 14px;border-radius:4px;background:var(--primary-gold);color:#fff;margin-bottom:16px;letter-spacing:-0.01em}
    .summary-box p{font-size:14px;line-height:1.75;color:var(--text-main);word-break:keep-all}
    .factor-item{padding:20px 0;border-bottom:1px solid var(--border-light)}
    .factor-item:last-child{border-bottom:none;padding-bottom:0}
    .factor-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .factor-header .title{font-size:15px;font-weight:700;color:var(--text-main)}
    .factor-header .score-wrap{display:flex;align-items:center;gap:8px}
    .factor-header .score{font-size:18px;font-weight:800;color:var(--primary-dark)}
    .factor-header .badge{font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;background:#F1F3F5;color:var(--text-sub)}
    .progress-bg{height:4px;background:#E9ECEF;border-radius:4px;overflow:hidden;margin-bottom:16px}
    .progress-fill{height:100%;background:var(--primary-dark);border-radius:4px}
    .factor-desc{font-size:13.5px;color:var(--text-sub);line-height:1.65;word-break:keep-all;background:#F8F9FA;padding:14px 16px;border-radius:8px}
    .list-card{border:1px solid var(--border-light);border-radius:12px;padding:24px 20px;box-shadow:0 8px 24px rgba(0,0,0,0.02)}
    .list-item{display:flex;align-items:flex-start;gap:14px;margin-bottom:24px}
    .list-item:last-child{margin-bottom:0}
    .list-num{width:24px;height:24px;border-radius:50%;background:#F1F3F5;color:var(--text-sub);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
    .list-text h3{font-size:15px;font-weight:700;color:var(--text-main);margin-bottom:6px}
    .list-text p{font-size:13.5px;line-height:1.65;color:var(--text-sub);word-break:keep-all}
    .weakness-card .list-num{background:var(--accent-burgundy-light);color:var(--accent-burgundy)}
    .weakness-card .list-text h3{color:var(--accent-burgundy)}
    .gap-card{background:#fff;border:1px solid var(--border-light);border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,0,0,0.02)}
    .gap-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
    .gap-header .badge{background:var(--gold-light);color:#A68B61;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px}
    .gap-header h3{font-size:14px;font-weight:700;color:var(--text-main)}
    .gap-bars{display:flex;flex-direction:column;gap:12px;margin-bottom:16px;padding:16px;background:#F8F9FA;border-radius:8px}
    .gap-row{display:flex;align-items:center;gap:12px}
    .gap-label{font-size:12px;font-weight:600;color:var(--text-sub);width:55px;flex-shrink:0}
    .gap-bar-bg{flex:1;height:6px;background:#E9ECEF;border-radius:4px;overflow:hidden}
    .gap-bar-fill{height:100%;border-radius:4px}
    .gap-score{font-size:12px;font-weight:700;color:var(--text-main);width:24px;text-align:right}
    .gap-desc{font-size:13px;color:var(--text-sub);line-height:1.65;margin:0}
    .step-card{border:1px solid var(--border-light);border-radius:12px;overflow:hidden;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,0,0,0.02)}
    .step-header{background:#F8F9FA;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-light)}
    .step-header .step-title{font-size:14px;font-weight:800;color:var(--primary-dark)}
    .step-header .step-period{font-size:12px;font-weight:600;color:var(--text-sub)}
    .step-body{padding:20px}
    .step-body h4{font-size:14.5px;font-weight:700;color:var(--text-main);margin-bottom:14px}
    .step-list{list-style:none}
    .step-list li{display:flex;align-items:flex-start;gap:8px;font-size:13.5px;color:var(--text-sub);line-height:1.6;margin-bottom:8px}
    .step-list li::before{content:'\\2022';color:var(--primary-gold);font-size:14px;font-weight:bold}
    .step-list li:last-child{margin-bottom:0}
    .final-box{background:var(--primary-dark);border-radius:12px;padding:32px 24px;color:#fff;text-align:center}
    .final-box h3{font-size:18px;font-weight:700;color:var(--primary-gold);margin-bottom:16px}
    .final-box p{font-size:14px;line-height:1.8;color:rgba(255,255,255,0.85);word-break:keep-all;text-align:left}
    .footer{text-align:center;padding:40px 0 20px;font-size:12px;color:var(--text-sub);font-weight:500;letter-spacing:0.05em}
    .footer span{color:var(--primary-gold);font-weight:700}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <div class="brand">
        <div class="logo">NK</div>
        <span>NK EDUCATION</span>
      </div>
      <div class="sub">맞춤형 심층 분석 보고서</div>
      <h1>NK 성향 검사 결과지</h1>
      <div class="info-card">
        <div class="info-top">
          <div class="name">${name} 학생</div>
          <div class="avg">종합 ${avgScore.toFixed(1)}점</div>
        </div>
        <div class="info-bottom">
          <div class="meta">${schoolInfo}</div>
          <div class="meta">${createdDate}</div>
        </div>
      </div>
    </div>
    <nav class="nav-wrap">
      <ul class="nav-menu">${navHTML}</ul>
    </nav>
    <div class="content-body">
      <div class="sec" id="summary">
        <div class="sec-title"><h2>학생 성향 요약</h2></div>
        <div class="summary-box">
          ${a.student_type ? `<span class="type-tag">${a.student_type}</span>` : ""}
          <p>${a.summary || ""}</p>
        </div>
      </div>
      <div class="sec" id="factors">
        <div class="sec-title"><h2>${hasEmotion ? "7" : "6"}대 핵심 학습 성향</h2></div>
        ${factorItemsHTML}
      </div>
      <div class="sec" id="strengths">
        <div class="sec-title"><h2>주요 강점</h2></div>
        <div class="list-card">${strengthsHTML}</div>
      </div>
      <div class="sec" id="weaknesses">
        <div class="sec-title"><h2>보완 및 개선 영역</h2></div>
        <div class="list-card weakness-card">${weaknessesHTML}</div>
      </div>
      ${(a.paradox && a.paradox.length > 0) ? `
      <div class="sec" id="gap">
        <div class="sec-title"><h2>심리적 간극 분석</h2></div>
        ${gapHTML}
      </div>` : ""}
      ${(a.solutions && a.solutions.length > 0) ? `
      <div class="sec" id="solution">
        <div class="sec-title"><h2>12주 맞춤 솔루션</h2></div>
        ${solutionHTML}
      </div>` : ""}
      ${a.final_assessment ? `
      <div class="sec" id="final">
        <div class="final-box">
          <h3>NK 학습 맞춤 지도</h3>
          <p>${a.final_assessment}</p>
        </div>
      </div>` : ""}
    </div>
    <div class="footer"><span>NK</span> EDUCATION</div>
  </div>
  <script>
    document.addEventListener("DOMContentLoaded",()=>{const s=document.querySelectorAll(".sec"),n=document.querySelectorAll(".nav-menu a");window.addEventListener("scroll",()=>{let c="";s.forEach(e=>{if(scrollY>=e.offsetTop-120)c=e.getAttribute("id")});n.forEach(l=>{l.classList.remove("active");if(c&&l.getAttribute("href").includes(c)){l.classList.add("active");const w=document.querySelector(".nav-wrap"),a=l.parentElement;if(a){w.scrollTo({left:a.offsetLeft-(w.offsetWidth/2)+(a.offsetWidth/2),behavior:"smooth"})}}})});n.forEach(l=>{l.addEventListener("click",function(e){e.preventDefault();const t=document.getElementById(this.getAttribute("href").substring(1));if(t)window.scrollTo({top:t.offsetTop-60,behavior:"smooth"})})})});
  </script>
</body>
</html>`;
}

// --- 메인 ---
async function main() {
  console.log("분석 결과 전체 조회 중...");
  const { data: analyses, error } = await supabase
    .from("analyses").select("*").order("created_at", { ascending: false });
  if (error) { console.error("조회 실패:", error.message); process.exit(1); }
  console.log(`총 ${analyses.length}건 발견. 재생성 시작...\n`);

  let success = 0, fail = 0;
  for (const a of analyses) {
    try {
      const html = buildHTML(a);
      const { error: ue } = await supabase.from("analyses").update({ report_html: html }).eq("id", a.id);
      if (ue) { console.error(`  X ${a.name}: ${ue.message}`); fail++; }
      else { console.log(`  O ${a.name} (${a.school || ""} ${a.grade || ""})`); success++; }
    } catch (e) { console.error(`  X ${a.name}: ${e.message}`); fail++; }
  }
  console.log(`\n완료: 성공 ${success}건, 실패 ${fail}건`);
}
main();
