import React, { useState, useRef, useEffect } from "react";

// ============================================================
// ✏️  CAMPAY CONFIGURATION — Fill in your real values here
// Your Anthropic API key is NOT here — it lives safely on
// the Vercel server (see the DEPLOYMENT GUIDE below).
// ============================================================
const CONFIG = {
  CAMPAY_USERNAME: "NGWAEPHRAIM4@GMAIL.COM",        // 👈 REPLACE
  CAMPAY_PASSWORD: "Eski5096@",        // 👈 REPLACE
  CAMPAY_BASE_URL: "https://demo.campay.net/api", // 👈 remove "demo." when live
  WHATSAPP_SUPPORT: "237682613235",               // 👈 your WhatsApp e.g. "237677123456"
};

// ============================================================
// PLANS
// ============================================================
const PLANS = [
  {
    id: "session", label: "Single Session", icon: "⚡", price: 500,
    duration: 24 * 60 * 60 * 1000, maxUses: 1, color: "#4CAF50",
    badge: null, desc: "One session · Valid 24 hours", prefix: "EDU",
    detail: "Perfect for quick revision or solving specific questions before an exam.",
  },
  {
    id: "weekly", label: "Weekly Plan", icon: "📅", price: 2500,
    duration: 7 * 24 * 60 * 60 * 1000, maxUses: 999, color: "#2196F3",
    badge: "POPULAR", desc: "Unlimited sessions · Valid 7 days", prefix: "WEK",
    detail: "Best value for regular students. Study every day for a full week.",
  },
  {
    id: "monthly", label: "Monthly Plan", icon: "🗓️", price: 5000,
    duration: 30 * 24 * 60 * 60 * 1000, maxUses: 999, color: "#FF9800",
    badge: "BEST VALUE", desc: "Unlimited sessions · Valid 30 days", prefix: "MON",
    detail: "Ideal for full exam preparation. One month of unlimited AI tutoring.",
  },
  {
    id: "school", label: "School Package", icon: "🏫", price: 50000,
    duration: 30 * 24 * 60 * 60 * 1000, maxUses: 99999, color: "#9C27B0",
    badge: "FOR SCHOOLS", desc: "Unlimited students · Valid 30 days", prefix: "SCH",
    detail: "One code shared with ALL students. Unlimited access for a full month.",
  },
];

// ============================================================
// SUBJECTS & EXAMS
// ============================================================
const SUBJECTS = [
  { id: "math",        label: "Mathematics",        icon: "📐" },
  { id: "english",     label: "English",             icon: "📝" },
  { id: "french",      label: "Français",            icon: "🗣️" },
  { id: "physics",     label: "Physics",             icon: "⚡" },
  { id: "chemistry",   label: "Chemistry",           icon: "🧪" },
  { id: "biology",     label: "Biology",             icon: "🌿" },
  { id: "history",     label: "History",             icon: "🏛️" },
  { id: "geography",   label: "Geography",           icon: "🌍" },
  { id: "economics",   label: "Economics",           icon: "📈" },
  { id: "commerce",    label: "Commerce",            icon: "🏪" },
  { id: "furthermath", label: "Further Mathematics", icon: "🔢" },
  { id: "geology",     label: "Geology",             icon: "🪨" },
];

const EXAMS = ["GCE O/L", "BEPC", "GCE A/L", "BAC", "CAP", "PROBATOIRE"];

const SYSTEM_PROMPT =
  "You are EduCam AI, a warm and brilliant tutor for Cameroonian students preparing for GCE, BEPC, BAC, CAP, and Probatoire exams. " +
  "You are bilingual (English/French), know the MINESEC curriculum deeply, and give step-by-step explanations with examples from Cameroonian daily life. " +
  "Always end with an encouraging sentence and optionally a quick practice question.";

// ============================================================
// CODE HELPERS
// ============================================================
function generateCode(prefix) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = prefix + "-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function saveCode(code, planId, phone) {
  const plan = PLANS.find(p => p.id === planId);
  const store = JSON.parse(localStorage.getItem("educam_codes") || "{}");
  store[code] = { planId, phone, createdAt: Date.now(), expiresAt: Date.now() + plan.duration, maxUses: plan.maxUses, usedCount: 0 };
  localStorage.setItem("educam_codes", JSON.stringify(store));
}

function validateCode(code) {
  const store = JSON.parse(localStorage.getItem("educam_codes") || "{}");
  const entry = store[code.toUpperCase().trim()];
  if (!entry) return { valid: false, reason: "Code not found. Check your code and try again." };
  if (Date.now() > entry.expiresAt) return { valid: false, reason: "This code has expired." };
  if (entry.usedCount >= entry.maxUses) return { valid: false, reason: "This code has already been fully used." };
  return { valid: true, entry };
}

function consumeCode(code) {
  const store = JSON.parse(localStorage.getItem("educam_codes") || "{}");
  const key = code.toUpperCase().trim();
  if (store[key]) store[key].usedCount += 1;
  localStorage.setItem("educam_codes", JSON.stringify(store));
}

function daysLeft(expiresAt) {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ============================================================
// PAYMENT HELPERS (Campay)
// ============================================================
async function getCampayToken() {
  const res = await fetch(CONFIG.CAMPAY_BASE_URL + "/token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.CAMPAY_USERNAME, password: CONFIG.CAMPAY_PASSWORD }),
  });
  const data = await res.json();
  return data.token;
}

async function initiatePayment(phone, plan, token) {
  const code = generateCode(plan.prefix);
  const res = await fetch(CONFIG.CAMPAY_BASE_URL + "/collect/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Token " + token },
    body: JSON.stringify({
      amount: String(plan.price),
      currency: "XAF",
      from: phone.replace(/\s/g, ""),
      description: "EduCam " + plan.label + " - " + code,
      external_reference: code,
    }),
  });
  const data = await res.json();
  return { ...data, code };
}

async function checkPaymentStatus(ref, token) {
  const res = await fetch(CONFIG.CAMPAY_BASE_URL + "/transaction/" + ref + "/", {
    headers: { Authorization: "Token " + token },
  });
  return res.json();
}

function detectNetwork(num) {
  const clean = num.replace(/\D/g, "").slice(-9);
  const prefix = clean.slice(0, 3);
  const mtn = ["650","651","652","653","654","670","671","672","673","674","675","676","677","678","679","680","681","682","683","690","691","692","693","694","695","696","697","698","699"];
  const orange = ["655","656","657","658","659","685","686","687","688","689"];
  if (mtn.includes(prefix)) return "MTN";
  if (orange.includes(prefix)) return "Orange";
  return "";
}

// ============================================================
// AI CHAT — calls our secure /api/chat serverless function
// The Anthropic API key never touches the browser
// ============================================================
async function askAI(messages, system) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.reply;
}

// ============================================================
// STYLES
// ============================================================
const S = {
  page: { minHeight: "100vh", background: "linear-gradient(135deg,#0a0a1a 0%,#0d1f0d 50%,#1a0a0a 100%)", fontFamily: "Georgia,'Times New Roman',serif", color: "#f0ead6", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" },
  grid: { position: "fixed", inset: 0, opacity: 0.03, backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 40px,#4CAF50 40px,#4CAF50 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,#4CAF50 40px,#4CAF50 41px)", pointerEvents: "none" },
  header: { width: "100%", maxWidth: 680, padding: "14px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" },
  centered: { width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 24px 40px" },
  logoCircle: { width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#4CAF50,#1B5E20)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
  hero: { fontSize: "clamp(24px,5vw,36px)", fontWeight: "bold", textAlign: "center", lineHeight: 1.25, margin: "0 0 10px", background: "linear-gradient(135deg,#f0ead6,#4CAF50)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  heroSub: { color: "#999", fontSize: 14, textAlign: "center", lineHeight: 1.7, marginBottom: 24 },
  btnPrimary: { width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: "bold", fontFamily: "inherit", cursor: "pointer", border: "none", background: "linear-gradient(135deg,#2E7D32,#4CAF50)", color: "#fff", marginBottom: 10, boxShadow: "0 4px 20px rgba(76,175,80,0.3)", transition: "all 0.2s" },
  btnSecondary: { width: "100%", padding: "12px", borderRadius: 12, fontSize: 14, fontFamily: "inherit", cursor: "pointer", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#aaa", marginBottom: 10 },
  btnDisabled: { width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: "bold", fontFamily: "inherit", cursor: "not-allowed", border: "none", background: "rgba(255,255,255,0.08)", color: "#555", marginBottom: 10 },
  backBtn: { alignSelf: "flex-start", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "5px 14px", color: "#777", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginBottom: 18 },
  sectionTitle: { fontSize: 21, fontWeight: "bold", color: "#f0ead6", textAlign: "center", marginBottom: 6 },
  inputLabel: { fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 2, display: "block", marginBottom: 7 },
  input: { width: "100%", padding: "13px 16px", borderRadius: 10, fontSize: 15, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#f0ead6", fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  codeBox: { background: "rgba(76,175,80,0.15)", border: "2px solid #4CAF50", borderRadius: 12, padding: "14px 28px", fontSize: 26, fontWeight: "bold", letterSpacing: 5, color: "#4CAF50", marginBottom: 10, fontFamily: "monospace" },
  tagBtn: { padding: "7px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer", border: "2px solid", fontFamily: "inherit", transition: "all 0.2s" },
  waitingBar: { width: "100%", height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" },
  waitingFill: { height: "100%", background: "linear-gradient(90deg,#2E7D32,#4CAF50)", borderRadius: 3, transition: "width 1s linear" },
  momoTag: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#777" },
};

// ============================================================
// LANDING
// ============================================================
function LandingScreen({ onSelectPlan, onHaveCode }) {
  return (
    <div style={S.centered}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#4CAF50,#1B5E20)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 0 20px rgba(76,175,80,0.4)" }}>🎓</div>
        <div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#4CAF50", letterSpacing: 1 }}>EduCam</div>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: 3, textTransform: "uppercase" }}>AI TUTOR · CAMEROON</div>
        </div>
      </div>
      <h1 style={S.hero}>Pass Your Exams.<br />Own Your Future.</h1>
      <p style={S.heroSub}>Expert AI tutoring for GCE, BEPC, BAC and more.<br />Bilingual · 24/7 · Affordable for every student.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", marginBottom: 28 }}>
        {[{ icon: "🧠", t: "AI-Powered", d: "Step-by-step help" }, { icon: "📋", t: "Past Papers", d: "Real exam questions" }, { icon: "🌍", t: "Bilingual", d: "English and French" }, { icon: "⏰", t: "24/7 Access", d: "Study anytime" }].map(f => (
          <div key={f.t} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{f.icon}</div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#4CAF50", marginBottom: 2 }}>{f.t}</div>
            <div style={{ fontSize: 11, color: "#666" }}>{f.d}</div>
          </div>
        ))}
      </div>
      <button onClick={onSelectPlan} style={S.btnPrimary}>💳 Choose a Plan and Pay</button>
      <button onClick={onHaveCode} style={S.btnSecondary}>🔑 I Already Have a Code</button>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <span style={S.momoTag}>🟡 MTN MoMo</span>
        <span style={S.momoTag}>🟠 Orange Money</span>
      </div>
    </div>
  );
}

// ============================================================
// PLAN SCREEN
// ============================================================
function PlanScreen({ onSelect, onBack }) {
  return (
    <div style={{ ...S.centered, maxWidth: 560 }}>
      <button onClick={onBack} style={S.backBtn}>← Back</button>
      <h2 style={S.sectionTitle}>Choose Your Plan</h2>
      <p style={{ color: "#888", fontSize: 14, textAlign: "center", marginBottom: 24 }}>Pick the plan that fits your study needs.</p>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        {PLANS.map(plan => (
          <button key={plan.id} onClick={() => onSelect(plan)} style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "2px solid " + plan.color + "33", borderRadius: 14, padding: "16px 18px", cursor: "pointer", fontFamily: "inherit", color: "#f0ead6", textAlign: "left", transition: "all 0.2s", position: "relative" }}>
            {plan.badge && <span style={{ position: "absolute", top: 10, right: 12, background: plan.color, color: "#fff", fontSize: 9, fontWeight: "bold", letterSpacing: 1, padding: "2px 8px", borderRadius: 10 }}>{plan.badge}</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: plan.color + "20", border: "2px solid " + plan.color + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{plan.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: "bold" }}>{plan.label}</span>
                  <span style={{ fontSize: 17, fontWeight: "bold", color: plan.color }}>{plan.price.toLocaleString()} FCFA</span>
                </div>
                <div style={{ fontSize: 12, color: "#777", marginBottom: 3 }}>{plan.desc}</div>
                <div style={{ fontSize: 11, color: "#555", lineHeight: 1.4 }}>{plan.detail}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PAYMENT SCREEN
// ============================================================
function PaymentScreen({ plan, onSuccess, onBack }) {
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("");
  const [step, setStep] = useState("form");
  const [generatedCode, setGeneratedCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(90);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(timerRef.current); }, []);

  const handlePhoneChange = val => { setPhone(val); setNetwork(detectNetwork(val)); };

  const startPayment = async () => {
    if (phone.replace(/\D/g, "").length < 9) { setErrorMsg("Enter a valid Cameroonian phone number."); return; }
    setErrorMsg(""); setStep("waiting"); setCountdown(90);
    try {
      const token = await getCampayToken();
      const result = await initiatePayment(phone, plan, token);
      if (!result.reference) { setStep("error"); setErrorMsg("Could not start payment. Please try again."); return; }
      const { reference, code } = result;
      setGeneratedCode(code);
      let ticks = 0;
      timerRef.current = setInterval(() => { setCountdown(c => c - 1); if (++ticks >= 90) { clearInterval(timerRef.current); clearInterval(pollRef.current); setStep("error"); setErrorMsg("Payment timed out. Please try again."); } }, 1000);
      pollRef.current = setInterval(async () => {
        try {
          const status = await checkPaymentStatus(reference, token);
          if (status.status === "SUCCESSFUL") { clearInterval(pollRef.current); clearInterval(timerRef.current); saveCode(code, plan.id, phone); setStep("success"); }
          else if (status.status === "FAILED") { clearInterval(pollRef.current); clearInterval(timerRef.current); setStep("error"); setErrorMsg("Payment failed or rejected. Please try again."); }
        } catch (_) {}
      }, 4000);
    } catch (_) { setStep("error"); setErrorMsg("Network error. Check your connection and try again."); }
  };

  const copyCode = () => { navigator.clipboard && navigator.clipboard.writeText(generatedCode); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const shareWhatsApp = () => { const msg = encodeURIComponent("🎓 *EduCam School Access Code*\n\nDear Students,\n\nYour school has purchased EduCam AI tutoring for you!\n\n🔑 Your code: *" + generatedCode + "*\n\n✅ Valid 30 days · Unlimited sessions · All subjects\n\nEnter this code in the EduCam app to start studying.\n\nBonne chance! 🇨🇲"); window.open("https://wa.me/?text=" + msg, "_blank"); };

  if (step === "waiting") return (
    <div style={S.centered}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid #4CAF50", animation: "pulse 1.5s infinite", marginBottom: 16 }} />
      <div style={{ fontSize: 44, marginBottom: 12 }}>📱</div>
      <h2 style={S.sectionTitle}>Check Your Phone!</h2>
      <p style={{ color: "#aaa", textAlign: "center", lineHeight: 1.7, marginBottom: 6 }}>A prompt of <strong style={{ color: plan.color }}>{plan.price.toLocaleString()} FCFA</strong> was sent to <strong style={{ color: "#fff" }}>{phone}</strong> via <strong style={{ color: network === "MTN" ? "#FFD700" : "#FF6600" }}>{network || "Mobile Money"}</strong></p>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Enter your PIN to confirm. ({countdown}s remaining)</p>
      <div style={S.waitingBar}><div style={{ ...S.waitingFill, width: (countdown / 90 * 100) + "%" }} /></div>
    </div>
  );

  if (step === "success") return (
    <div style={S.centered}>
      <div style={{ fontSize: 54, marginBottom: 12 }}>🎉</div>
      <h2 style={{ ...S.sectionTitle, color: plan.color }}>Payment Confirmed!</h2>
      <p style={{ color: "#aaa", textAlign: "center", marginBottom: 8 }}>Your access code is:</p>
      <div style={{ ...S.codeBox, borderColor: plan.color, color: plan.color }}>{generatedCode}</div>
      {plan.id === "school" ? (
        <>
          <p style={{ color: "#777", fontSize: 12, textAlign: "center", marginBottom: 14 }}>Share this one code with ALL your students. Valid 30 days · Unlimited students.</p>
          <div style={{ display: "flex", gap: 8, width: "100%", marginBottom: 10 }}>
            <button onClick={copyCode} style={{ ...S.btnSecondary, flex: 1, marginBottom: 0 }}>{copied ? "✅ Copied!" : "📋 Copy Code"}</button>
            <button onClick={shareWhatsApp} style={{ ...S.btnSecondary, flex: 1, marginBottom: 0, borderColor: "rgba(37,211,102,0.4)", color: "#25D366" }}>📲 WhatsApp</button>
          </div>
        </>
      ) : (
        <p style={{ color: "#777", fontSize: 12, textAlign: "center", marginBottom: 16 }}>
          {plan.id === "session" ? "Valid 24 hours · Single use" : plan.id === "weekly" ? "Valid 7 days · Unlimited sessions" : "Valid 30 days · Unlimited sessions"}
        </p>
      )}
      <button onClick={() => onSuccess(generatedCode, plan.id)} style={{ ...S.btnPrimary, background: "linear-gradient(135deg," + plan.color + "99," + plan.color + ")" }}>🚀 Start My Session</button>
    </div>
  );

  if (step === "error") return (
    <div style={S.centered}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
      <h2 style={S.sectionTitle}>Payment Issue</h2>
      <p style={{ color: "#f87171", textAlign: "center", marginBottom: 20 }}>{errorMsg}</p>
      <button onClick={() => setStep("form")} style={S.btnPrimary}>Try Again</button>
      <button onClick={onBack} style={S.btnSecondary}>← Back</button>
    </div>
  );

  return (
    <div style={S.centered}>
      <button onClick={onBack} style={S.backBtn}>← Back</button>
      <div style={{ width: "100%", background: plan.color + "12", border: "1px solid " + plan.color + "40", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>{plan.icon}</span>
          <div><div style={{ fontSize: 15, fontWeight: "bold" }}>{plan.label}</div><div style={{ fontSize: 12, color: "#888" }}>{plan.desc}</div></div>
          <div style={{ marginLeft: "auto", fontSize: 18, fontWeight: "bold", color: plan.color }}>{plan.price.toLocaleString()} FCFA</div>
        </div>
      </div>
      <h2 style={S.sectionTitle}>Pay with Mobile Money</h2>
      <p style={{ color: "#888", textAlign: "center", marginBottom: 20, fontSize: 13 }}>Enter your MTN or Orange Money number below.</p>
      <div style={{ width: "100%", marginBottom: 14 }}>
        <label style={S.inputLabel}>📱 Your MoMo Phone Number</label>
        <div style={{ position: "relative" }}>
          <input type="tel" placeholder="e.g. 677 123 456" value={phone} onChange={e => handlePhoneChange(e.target.value)} style={S.input} />
          {network && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: "bold", color: network === "MTN" ? "#FFD700" : "#FF6600", background: "rgba(0,0,0,0.5)", padding: "2px 8px", borderRadius: 10 }}>{network === "MTN" ? "🟡 MTN" : "🟠 Orange"}</span>}
        </div>
      </div>
      {errorMsg && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 10 }}>{errorMsg}</p>}
      <div style={{ width: "100%", background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#888" }}>{plan.label}</span><span>{plan.price.toLocaleString()} FCFA</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}><span style={{ color: plan.color, fontWeight: "bold" }}>Total</span><span style={{ color: plan.color, fontWeight: "bold" }}>{plan.price.toLocaleString()} FCFA</span></div>
      </div>
      <button onClick={startPayment} style={{ ...S.btnPrimary, background: "linear-gradient(135deg," + plan.color + "99," + plan.color + ")" }}>
        {network === "MTN" ? "🟡" : network === "Orange" ? "🟠" : "💳"} Send Payment Prompt
      </button>
      <p style={{ color: "#555", fontSize: 11, textAlign: "center", marginTop: 8 }}>You will receive a prompt on your phone. Enter your PIN to confirm.</p>
    </div>
  );
}

// ============================================================
// CODE ENTRY SCREEN
// ============================================================
function CodeEntryScreen({ onSuccess, onBack }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(null);

  const previewCode = val => {
    const upper = val.toUpperCase();
    setCode(upper); setError(""); setInfo(null);
    if (upper.length >= 9) { const r = validateCode(upper); if (r.valid) setInfo({ plan: PLANS.find(p => p.id === r.entry.planId), entry: r.entry }); }
  };

  const handleValidate = () => {
    const r = validateCode(code.trim());
    if (r.valid) { consumeCode(code.trim()); onSuccess(code.trim().toUpperCase(), r.entry); }
    else setError(r.reason);
  };

  return (
    <div style={S.centered}>
      <button onClick={onBack} style={S.backBtn}>← Back</button>
      <div style={{ fontSize: 44, marginBottom: 10 }}>🔑</div>
      <h2 style={S.sectionTitle}>Enter Your Code</h2>
      <p style={{ color: "#888", textAlign: "center", marginBottom: 20, fontSize: 13 }}>Enter the code from your payment, or the code shared by your school.</p>
      <input type="text" placeholder="e.g. SCH-AB3K7P" value={code} onChange={e => previewCode(e.target.value)} style={{ ...S.input, textAlign: "center", fontSize: 20, letterSpacing: 4, fontWeight: "bold", marginBottom: 8 }} maxLength={10} />
      {info && (
        <div style={{ width: "100%", background: info.plan.color + "15", border: "1px solid " + info.plan.color + "40", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{info.plan.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: "bold", color: info.plan.color }}>{info.plan.label} ✅</div>
              <div style={{ fontSize: 11, color: "#888" }}>{daysLeft(info.entry.expiresAt)} day(s) remaining{info.plan.id === "school" ? " · " + info.entry.usedCount + " student(s) used so far" : ""}</div>
            </div>
          </div>
        </div>
      )}
      {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>{error}</p>}
      {code.length >= 9
        ? <button onClick={handleValidate} style={S.btnPrimary}>Unlock Session →</button>
        : <button disabled style={S.btnDisabled}>Unlock Session →</button>
      }
      <p style={{ color: "#555", fontSize: 12, textAlign: "center", marginTop: 8 }}>No code yet? <span onClick={onBack} style={{ color: "#4CAF50", cursor: "pointer" }}>Buy a plan</span></p>
    </div>
  );
}

// ============================================================
// SELECTOR SCREEN
// ============================================================
function SelectorScreen({ planId, onStart, onBack }) {
  const [subject, setSubject] = useState(null);
  const [exam, setExam] = useState(null);
  const plan = PLANS.find(p => p.id === planId) || PLANS[0];

  return (
    <div style={{ width: "100%", maxWidth: 680, padding: "20px 24px 40px" }}>
      <button onClick={onBack} style={S.backBtn}>← Back</button>
      <div style={{ background: plan.color + "12", border: "1px solid " + plan.color + "30", borderRadius: 10, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{plan.icon}</span>
        <span style={{ fontSize: 13, color: plan.color, fontWeight: "bold" }}>{plan.label} Active</span>
        <span style={{ fontSize: 12, color: "#666", marginLeft: "auto" }}>{plan.desc}</span>
      </div>
      <h2 style={{ ...S.sectionTitle, textAlign: "left", marginBottom: 4 }}>🎉 Access Verified!</h2>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>Choose your exam and subject to begin.</p>
      <label style={S.inputLabel}>1. Choose Your Exam</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        {EXAMS.map(e => (
          <button key={e} onClick={() => setExam(e)} style={{ ...S.tagBtn, borderColor: exam === e ? "#4CAF50" : "rgba(255,255,255,0.12)", background: exam === e ? "rgba(76,175,80,0.2)" : "rgba(255,255,255,0.04)", color: exam === e ? "#4CAF50" : "#ccc", fontWeight: exam === e ? "bold" : "normal" }}>{e}</button>
        ))}
      </div>
      <label style={S.inputLabel}>2. Choose Your Subject</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10, marginBottom: 28 }}>
        {SUBJECTS.map(s => (
          <button key={s.id} onClick={() => setSubject(s.id)} style={{ padding: "12px 10px", borderRadius: 12, cursor: "pointer", textAlign: "left", border: subject === s.id ? "2px solid #4CAF50" : "2px solid rgba(255,255,255,0.08)", background: subject === s.id ? "rgba(76,175,80,0.15)" : "rgba(255,255,255,0.03)", color: "#f0ead6", fontFamily: "inherit", transition: "all 0.2s" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: subject === s.id ? "#4CAF50" : "#f0ead6" }}>{s.label}</div>
          </button>
        ))}
      </div>
      {subject && exam
        ? <button onClick={() => onStart(subject, exam)} style={S.btnPrimary}>🚀 Start Tutoring Session</button>
        : <button disabled style={S.btnDisabled}>Select Exam and Subject to Begin</button>
      }
    </div>
  );
}

// ============================================================
// CHAT SCREEN
// ============================================================
function ChatScreen({ subject, exam, planId, onEnd }) {
  const subj = SUBJECTS.find(s => s.id === subject);
  const plan = PLANS.find(p => p.id === planId) || PLANS[0];
  const [messages, setMessages] = useState([{ role: "assistant", content: "🎓 Welcome! I am your EduCam AI tutor for **" + (subj ? subj.label : "") + "** — " + exam + " level.\n\nAsk me anything in English or French. Let us pass this exam together! 🇨🇲" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current && endRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMsgs = [...messages, { role: "user", content: text }];
    setMessages(newMsgs); setInput(""); setLoading(true);
    try {
      const reply = await askAI(newMsgs.map(m => ({ role: m.role, content: m.content })), SYSTEM_PROMPT + " Subject: " + (subj ? subj.label : "") + ". Exam: " + exam + ".");
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (_) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Network error. Check your connection and try again." }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 100);
  };

  const fmt = t => t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");

  return (
    <div style={{ width: "100%", maxWidth: 680, flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>{subj ? subj.icon : "🎓"}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: "bold" }}>{subj ? subj.label : ""}</div>
            <div style={{ fontSize: 11, color: plan.color }}>{exam} · {plan.label}</div>
          </div>
        </div>
        <button onClick={onEnd} style={S.backBtn}>End Session</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14, maxHeight: "calc(100vh - 240px)" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 8, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: m.role === "user" ? "linear-gradient(135deg,#1565C0,#42A5F5)" : "linear-gradient(135deg,#2E7D32,#4CAF50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
              {m.role === "user" ? "👤" : "🎓"}
            </div>
            <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px", background: m.role === "user" ? "rgba(21,101,192,0.25)" : "rgba(255,255,255,0.06)", border: m.role === "user" ? "1px solid rgba(66,165,245,0.2)" : "1px solid rgba(76,175,80,0.15)", fontSize: 14, lineHeight: 1.65, color: "#f0ead6" }} dangerouslySetInnerHTML={{ __html: fmt(m.content) }} />
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#2E7D32,#4CAF50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🎓</div>
            <div style={{ padding: "12px 16px", borderRadius: "4px 16px 16px 16px", background: "rgba(255,255,255,0.06)", display: "flex", gap: 4, alignItems: "center" }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50", animation: "bounce 1.2s " + (i*0.2) + "s infinite" }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {messages.length <= 1 && (
        <div style={{ padding: "0 20px 10px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Explain a key topic", "Give me a past paper question", "What should I revise?", "Help me with an essay"].map(p => (
            <button key={p} onClick={() => { setInput(p); setTimeout(() => inputRef.current && inputRef.current.focus(), 50); }} style={{ background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "#4CAF50", cursor: "pointer", fontFamily: "inherit" }}>{p}</button>
          ))}
        </div>
      )}
      <div style={{ padding: "10px 20px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything… or type in French" rows={2} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#f0ead6", fontFamily: "inherit", resize: "none", outline: "none", lineHeight: 1.5 }} />
        <button onClick={send} disabled={!input.trim() || loading} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: input.trim() && !loading ? "linear-gradient(135deg,#2E7D32,#4CAF50)" : "rgba(255,255,255,0.08)", color: "#fff", fontSize: 18, cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>→</button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [screen, setScreen] = useState("landing");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [activePlanId, setActivePlanId] = useState(null);
  const [subject, setSubject] = useState(null);
  const [exam, setExam] = useState(null);

  return (
    <div style={S.page}>
      <div style={S.grid} />
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={S.logoCircle}>🎓</div>
          <span style={{ fontSize: 17, fontWeight: "bold", color: "#4CAF50", letterSpacing: 1 }}>EduCam</span>
        </div>
        <span style={{ background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 20, padding: "3px 12px", fontSize: 11, color: "#4CAF50" }}>🇨🇲 from 500 FCFA</span>
      </header>

      {screen === "landing"   && <LandingScreen onSelectPlan={() => setScreen("plans")} onHaveCode={() => setScreen("codeEntry")} />}
      {screen === "plans"     && <PlanScreen onSelect={p => { setSelectedPlan(p); setScreen("payment"); }} onBack={() => setScreen("landing")} />}
      {screen === "payment"   && <PaymentScreen plan={selectedPlan} onSuccess={(code, pid) => { setActivePlanId(pid); setScreen("selector"); }} onBack={() => setScreen("plans")} />}
      {screen === "codeEntry" && <CodeEntryScreen onSuccess={(code, entry) => { setActivePlanId(entry.planId); setScreen("selector"); }} onBack={() => setScreen("landing")} />}
      {screen === "selector"  && <SelectorScreen planId={activePlanId} onStart={(s, e) => { setSubject(s); setExam(e); setScreen("chat"); }} onBack={() => setScreen("landing")} />}
      {screen === "chat"      && <ChatScreen subject={subject} exam={exam} planId={activePlanId} onEnd={() => setScreen("landing")} />}

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:0.5} }
        input::placeholder,textarea::placeholder { color:#444 }
        input:focus,textarea:focus { border-color:rgba(76,175,80,0.4)!important }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-thumb { background:rgba(76,175,80,0.3);border-radius:2px }
        button:hover { opacity:0.88 }
      `}</style>
    </div>
  );
}
