const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---------- tabs & mode ---------- */
document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
  document.querySelectorAll(".tab,.panel").forEach(e => e.classList.remove("active"));
  t.classList.add("active"); $(t.dataset.tab).classList.add("active");
});
$("apiKey").oninput = () => {
  const live = $("apiKey").value.trim() !== "";
  $("mode").textContent = live ? "Live AI" : "Demo mode";
  $("mode").classList.toggle("live", live);
};

/* ---------- Gemini helpers ---------- */
const DEMO_PPE = {safety_score:68,overall_status:"Needs Improvement",
  ppe_detection:{helmet:true,high_vis_vest:true,steel_toe_boots:false,safety_harness:false},
  hazards:[{hazard:"Worker at height without harness",severity:"Critical",remedy:"Stop work; provide an anchored full-body harness (OSHA 1926.501)."},
           {hazard:"Loose materials near edge",severity:"Medium",remedy:"Fit toe boards and stack materials away from edges."}]};
const DEMO_CRACK = {defect_type:"Settlement",crack_width_mm:3.5,severity_score:6,
  root_causes:["Differential foundation settlement","Poor soil compaction"],
  repairs:["Epoxy injection","Structural re-grouting after settlement stabilises"],urgency:"High"};
const PPE_PROMPT = `You are a construction safety auditor. Analyse this site photo for PPE compliance (helmet, high-vis vest, steel-toe boots, safety harness) under OSHA and IS 456 / Indian site practice. Reply ONLY with JSON: {"safety_score":0-100,"overall_status":"Compliant|Needs Improvement|Non-Compliant","ppe_detection":{"helmet":bool,"high_vis_vest":bool,"steel_toe_boots":bool,"safety_harness":bool},"hazards":[{"hazard":str,"severity":"Low|Medium|High|Critical","remedy":str}]}`;
const CRACK_PROMPT = `You are a structural engineer. Classify the defect in this concrete/wall photo as one of: Hairline, Settlement, Structural Shear, Thermal Expansion, Spalling. Reply ONLY with JSON: {"defect_type":str,"crack_width_mm":number,"severity_score":1-10,"root_causes":[str],"repairs":[str],"urgency":"Low|Medium|High|Critical"}`;
const SYSTEM = "You are a concise, practical construction engineering assistant for Indian sites. Reference IS codes and OSHA where relevant.";

const endpoint = () => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent($("model").value.trim())}:generateContent?key=${encodeURIComponent($("apiKey").value.trim())}`;
async function callGemini(body) {
  const r = await fetch(endpoint(), {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || r.statusText);
  return j.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
}
const toBase64 = file => new Promise((res, rej) => {
  const fr = new FileReader(); fr.onload = () => res(fr.result.split(",")[1]); fr.onerror = rej; fr.readAsDataURL(file);
});

/* ---------- image analysis (tabs 1 & 2) ---------- */
function setupAnalyzer(prefix, prompt, demo, render) {
  const file = $(prefix + "File"), out = $(prefix + "Out"), btn = $(prefix + "Run");
  file.onchange = () => { const f = file.files[0]; if (!f) return;
    const p = $(prefix + "Preview"); p.src = URL.createObjectURL(f); p.hidden = false; };
  btn.onclick = async () => {
    if (!file.files[0]) { out.innerHTML = "<p>Choose a JPG or PNG photo first.</p>"; return; }
    btn.disabled = true; out.innerHTML = "<p>Analysing…</p>";
    let data = demo, isDemo = true;
    if ($("apiKey").value.trim()) {
      try {
        const f = file.files[0];
        const text = await callGemini({contents:[{parts:[{text:prompt},{inline_data:{mime_type:f.type,data:await toBase64(f)}}]}],
                                       generationConfig:{responseMimeType:"application/json"}});
        data = JSON.parse(text.replace(/^```(?:json)?|```$/gm, "").trim()); isDemo = false;
      } catch (e) { out.innerHTML = `<p class="alert bad">AI call failed: ${esc(e.message)}. Showing demo output.</p>`; }
    }
    out.innerHTML += render(data, isDemo) + `<button class="btn" id="${prefix}Dl">Download JSON report</button>`;
    $(prefix + "Dl").onclick = () => { const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:"application/json"}));
      a.download = prefix + "_report.json"; a.click(); };
    btn.disabled = false;
  };
}
const level = v => v >= 80 ? "green" : v >= 50 ? "amber" : "red";
const card = (l, v) => `<div class="card"><small>${esc(l)}</small><b>${esc(v)}</b></div>`;

setupAnalyzer("ppe", PPE_PROMPT, DEMO_PPE, (r, demo) => {
  const checks = Object.entries(r.ppe_detection || {}).map(([k, v]) => card(k.replace(/_/g, " "), v ? "✅ Yes" : "❌ No")).join("");
  const hz = (r.hazards || []).map(h => `<div class="hz"><b>${esc(h.severity)}</b> — ${esc(h.hazard)}<br><small>Remedy: ${esc(h.remedy)}</small></div>`).join("");
  return `${demo ? '<p class="demo">Demonstration data</p>' : ""}
    <div class="cards">${card("Safety score", r.safety_score + "/100")}${card("Status", r.overall_status)}</div>
    <span class="pill ${level(r.safety_score)}">${esc(r.overall_status)}</span>
    <h3>PPE checklist</h3><div class="cards">${checks}</div><h3>Hazards</h3>${hz}`;
});
setupAnalyzer("crack", CRACK_PROMPT, DEMO_CRACK, (r, demo) => {
  const li = a => "<ul>" + (a || []).map(x => `<li>${esc(x)}</li>`).join("") + "</ul>";
  const u = r.urgency, c = u === "Low" ? "green" : u === "Medium" ? "amber" : "red";
  return `${demo ? '<p class="demo">Demonstration data</p>' : ""}
    <div class="cards">${card("Defect type", r.defect_type)}${card("Crack width", r.crack_width_mm + " mm")}${card("Severity", r.severity_score + "/10")}</div>
    <span class="pill ${c}">Urgency: ${esc(u)}</span>
    <h3>Root causes</h3>${li(r.root_causes)}<h3>Recommended repairs</h3>${li(r.repairs)}`;
});

/* ---------- planning & valuation (tab 3) ---------- */
const COST = {"Residential Villa":2200,"Apartment Building":1900,"Commercial Complex":2600,"Industrial Shed":1500};
const TIER_COST = {"Tier 1":1.25,"Tier 2":1,"Tier 3":.85};
const MARKET = {"Tier 1":9000,"Tier 2":5500,"Tier 3":3200};
const inr = x => x >= 1e7 ? `₹${(x/1e7).toFixed(2)} Cr` : `₹${(x/1e5).toFixed(2)} Lakhs`;
function plan() {
  const sqft = Math.max(200, +$("sqft").value || 0), pct = +$("pct").value, tier = $("tier").value;
  const budget = COST[$("stype").value] * TIER_COST[tier] * sqft;
  const value = MARKET[tier] * sqft * (0.3 + 0.7 * pct / 100);
  $("pctLabel").textContent = pct + "%"; $("bar").style.width = pct + "%";
  $("planOut").innerHTML = card("Total budget", inr(budget)) + card("Spent so far", inr(budget * pct / 100)) +
    card("Market valuation", inr(value)) + card("Steel required", (sqft * 4 / 1000).toFixed(1) + " tonnes") +
    card("Cement required", Math.round(sqft * .4).toLocaleString("en-IN") + " bags");
}
["stype","tier","sqft","pct"].forEach(id => $(id).oninput = plan); plan();
$("renderBtn").onclick = () => {
  const p = `architectural 3D render of a modern ${$("stype").value} in an Indian ${$("tier").value} city, ${$("pct").value}% constructed, photorealistic`;
  const img = $("render"); img.src = "https://image.pollinations.ai/prompt/" + encodeURIComponent(p) + "?width=768&height=512"; img.hidden = false;
};

/* ---------- weather & chatbot (tab 4) ---------- */
const ALERTS = {
  "Normal":["ok","Normal operations. Keep up the routine toolbox talk and housekeeping."],
  "High Wind":["bad","Suspend crane and lifting operations. Secure scaffold sheeting and loose materials. Stop work at height."],
  "Heavy Rain":["warn","Cover live electrical points, use GFCI protection, avoid pouring concrete, and check excavation shoring."],
  "Extreme Heat":["warn","Enforce water breaks, rotate workers into shade, and wet-cure concrete (cover and water 3x daily) to prevent shrinkage cracks."]};
function weather() { const [c, m] = ALERTS[$("weather").value]; $("alert").className = "alert " + c; $("alert").textContent = m; }
$("weather").onchange = weather; weather();

const history = [];
const bubble = (t, who) => { const d = document.createElement("div"); d.className = "msg " + who; d.textContent = t; $("chat").append(d); $("chat").scrollTop = 1e9; };
async function send() {
  const q = $("chatIn").value.trim(); if (!q) return;
  $("chatIn").value = ""; bubble(q, "user"); history.push({role:"user", parts:[{text:q}]});
  let reply;
  if (!$("apiKey").value.trim()) reply = "Demo mode: add a Gemini API key at the top for real answers.";
  else try { reply = await callGemini({systemInstruction:{parts:[{text:SYSTEM}]}, contents:history}); }
  catch (e) { reply = "Error: " + e.message; }
  bubble(reply, "bot"); history.push({role:"model", parts:[{text:reply}]});
}
$("chatBtn").onclick = send; $("chatIn").onkeydown = e => { if (e.key === "Enter") send(); };
