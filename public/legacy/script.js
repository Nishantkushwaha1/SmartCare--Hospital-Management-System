// ---------- state (loaded from the SmartCare API: see api.js) ----------
// Departments are managed from the "Departments" screen (staff only). Each item mirrors the server record:
// id, n=name, p=token code, room, st=OPD status, tm=timing, fee, cap=daily tokens (70% online / 30% counter),
// on/off=tokens already booked online / at the counter today, cur=now serving, w=patients waiting.
const DEPTS = [];
const DOC_STATUS = ["Available", "Busy", "Unavailable"];
// Queue rows deliberately hold NO personal data: only token, department, booking type, status and time.
const S = {
  user: "Patient", me: null, pay: [], admin: false, staff: null, stats: null, pre: null, lastOff: null, editDept: null, nf: "All",
  queue: [], notes: [], local: [], srv: [], readAt: 0, filter: "All", payMode: "razorpay"
};

// ---------- helpers ----------
const $ = s => document.querySelector(s), now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dep = n => DEPTS.find(d => d.n === n) || {}, dn = () => DEPTS.map(d => d.n);
const roomOf = n => "Room " + (dep(n).room || "–");
const pill = s => `<span class="pill ${s.toLowerCase()}">${s}</span>`;
function toast(m) {
  let c = $("#toasts"); if (!c) { c = document.createElement("div"); c.id = "toasts"; c.className = "toasts"; c.setAttribute("role", "status"); document.body.appendChild(c) }
  const e = document.createElement("div"); e.className = "toast"; e.textContent = m; c.appendChild(e); setTimeout(() => e.remove(), 3400)
}
const curTok = n => dep(n).cur || "–";
const waiting = n => dep(n).w || 0;
const mine = () => S.me ? { ...S.me } : { t: "–", n: S.user, d: (DEPTS[0] || {}).n || "–", s: "Waiting", src: "online", reg: "–", pay: null, ahead: 0, est: null };
const ahead = () => S.me && S.me.ahead != null ? S.me.ahead : 0;
const est = () => S.me && S.me.est ? S.me.est.text : "–";
const arriveBy = () => S.me && S.me.est ? "Please arrive by " + S.me.est.arriveBy : "Book a token to see your arrival time";

// ---------- notifications ----------
const KIND = { appointment: ["#7c5cd6", "Appointment"], token: ["#2a78d1", "Token"], queue: ["#d98a0b", "Queue"], doctor: ["#12a594", "Availability"], room: ["#0aa5b8", "Room"], emergency: ["#e5383b", "Emergency"], payment: ["#16a34a", "Payment"] };
const unread = () => S.notes.filter(n => !n.read).length;
const bellHtml = () => `Notifications${unread() ? ` <b class="bdg">${unread()}</b>` : ""}`;
function badge() { const b = $("#bell"); if (b) b.innerHTML = bellHtml(); const n = $("#navbell"); if (n) n.innerHTML = bellHtml() }
function notify(k, m) {
  S.local.unshift({ k, m, ts: Date.now(), t: now(), read: false }); if (S.local.length > 30) S.local.length = 30; SC.merge(); toast(m);
  try { if ("Notification" in window && Notification.permission === "granted") new Notification("SmartCare", { body: m }) } catch (e) { }
  if (location.hash === "#/alerts") route(); else badge()
}

// ---------- layout ----------
const NAV = [["register", "Token Booking"], ["queue", "My Queue"], ["parcha", "Token / Parcha"], ["genqr", "Generate QR"], ["scan", "Scan QR"], ["live", "Live Queue"], ["mobile", "Mobile View"], ["admin", "Admin Overview"], ["counter", "Counter Booking"], ["depts", "Departments"], ["doctors", "OPD Status"], ["analytics", "Analytics"], ["emergency", "Emergency"], ["alerts", "Notifications"]];
function shell(route, inner) {
  return `<div class="app"><aside class="side"><a class="logo" href="#/"><i>+</i>SmartCare</a>
 ${NAV.map(([r, l]) => `<a href="#/${r}" class="${r === route ? "on" : ""}"${r === "alerts" ? ' id="navbell"' : ""}>${r === "alerts" ? bellHtml() : l}</a>`).join("")}<div class="sp"></div><a href="#/">Home</a></aside>
 <main class="main"><div class="top"><a class="bellbtn" id="bell" href="#/alerts" aria-label="Notifications">${bellHtml()}</a><button id="th" aria-label="Toggle theme">Theme</button><div class="av">${esc(S.user[0])}</div><b>${esc(S.user)}</b></div>${inner}</main></div>`
}
const head = (t, s) => `<h2 class="t">${t}</h2><p class="sub">${s}</p>`;

// ---------- screens ----------
const V = {};
const go = id => { const e = document.getElementById(id); e && e.scrollIntoView({ behavior: "smooth" }) };
const fs = d => { const b = document.body; b.style.zoom = d ? Math.min(1.3, Math.max(.9, (parseFloat(b.style.zoom) || 1) + d * .1)) : 1 };
const NOTICES = [["04 Oct 2026", "OPD token counter opens at 7:30 AM. Online registration is available from 6:00 AM."], ["01 Oct 2026", "Child immunisation is held every Wednesday in the Pediatrics wing."], ["28 Sep 2026", "Essential medicines are free at the hospital pharmacy on showing the parcha."], ["20 Sep 2026", "Emergency and casualty services run 24 hours. Dial 108 for an ambulance."]];
const STEPS = [["Register", "Enter your name, age, phone, choose a department and pay the fee online."], ["Collect token", "You get a token number and a digital parcha with a QR code."], ["Track your queue", "See patients ahead and the estimated time."], ["Visit the doctor", "Reach your room when your token is called."]];
V[""] = () => {
  const info = DEPTS.map(d => ({ d: d.n, room: d.room, cur: curTok(d.n), w: waiting(d.n) }));
  return `<div class="u"><span>Helpline: 1800-000-0000 &nbsp;|&nbsp; Emergency: 108</span><span>Text size <button onclick="fs(-1)" aria-label="Smaller text">A-</button><button onclick="fs(0)" aria-label="Normal text">A</button><button onclick="fs(1)" aria-label="Larger text">A+</button></span></div>
<div class="brand"><a class="logo" href="#/"><i>+</i><div><b>SmartCare Government Hospital</b><small>OPD Token and Queue Management Portal</small></div></a><div class="links"><a href="#/register">Patient Login</a><a href="#/admin">Staff Login</a></div></div>
<nav class="mn" id="top"><a onclick="go('top')">Home</a><a onclick="go('dep')">Departments</a><a onclick="go('book')">Token booking</a><a onclick="go('how')">How to get a token</a><a onclick="go('notice')">Notices</a><a onclick="go('contact')">Contact</a></nav>
<div class="tick"><b>Latest</b><div>OPD token counter opens at 7:30 AM &nbsp;&bull;&nbsp; Emergency services are available 24 hours &nbsp;&bull;&nbsp; Child immunisation every Wednesday</div></div>
<section class="hr"><div class="in"><div><h2>Less Waiting.<br><em>More</em> Healing.</h2><p>Get a token before you reach the hospital, see how many patients are ahead of you and plan your visit around the estimated time.</p>
<div class="cta"><a class="btn" href="#/register">Register for token</a><a class="btn ghost" href="#/live">View live queue</a></div>
<form class="track" id="tf"><input id="tk" placeholder="Enter token number, e.g. GM-048" aria-label="Token number"><button class="btn">Track</button></form></div>
<div class="panel"><h3>Live OPD status <small>Updated ${now()}</small></h3><div class="pscroll"><table><tr><th>Department</th><th>Room</th><th>Now serving</th><th>Waiting</th></tr>${info.map(x => `<tr><td>${esc(x.d)}</td><td>${esc(x.room)}</td><td><b>${x.cur}</b></td><td>${x.w}</td></tr>`).join("")}</table></div></div></div></section>
<section class="sec2"><div class="in"><div class="ql"><a href="#/register">Get OPD token<small>Register online in a minute</small></a><a href="#/queue">Track my queue<small>Position and estimated time</small></a><a href="#/genqr">Generate QR<small>QR code for your token</small></a><a href="#/scan">Scan QR<small>Check in at the room</small></a><a class="em" href="#/emergency">Emergency priority<small>For critical patients</small></a></div></div></section>
<section class="sec2" id="book"><div class="in"><h2>Token booking</h2><p class="lead">Every department's daily tokens are split: 70% can be booked online, 30% are issued by the hospital admin at the counter.</p><div class="split"><div class="d1 bk on"><span class="tag">70% Online</span><h3>Book from home</h3><p>${totLeft("online")} online tokens left today across all departments.</p><a class="btn block" href="#/register">Book online token</a></div><div class="d1 bk off"><span class="tag">30% Offline</span><h3>Hospital counter</h3><p>${totLeft("offline")} counter tokens left today. Booked by the hospital admin: walk in, tell the counter your department and pay the fee.</p><a class="btn ghost block" href="#/register">See counter tokens</a></div></div></div></section>
<section class="sec2 alt" id="dep"><div class="in"><h2>Departments</h2><p class="lead">Current OPD position in each department.</p><div class="ds">${info.map((x, i) => `<div class="d1"><h3>${esc(x.d)}</h3><p>${esc(DEPTS[i].tm)}</p><div class="kv"><span>Room number</span><b>${esc(x.room)}</b></div><div class="kv"><span>Registration fee</span><b>${DEPTS[i].fee ? "₹" + DEPTS[i].fee : "Free"}</b></div><div class="kv"><span>Now serving</span><b>${x.cur}</b></div><div class="kv"><span>Patients waiting</span><b>${x.w}</b></div><div class="kv"><span>Tokens left (online / counter)</span><b>${left(DEPTS[i], "online")} / ${left(DEPTS[i], "offline")}</b></div><br><a class="btn block" href="#/register">Get token</a></div>`).join("")}</div></div></section>
<section class="sec2 alt" id="how"><div class="in"><h2>How to get a token</h2><p class="lead">Four simple steps, no need to stand in line.</p><div class="bam"></div><div class="bd">${STEPS.map((x, i) => `<div class="board ${i % 2 ? "p" : ""}"><small>Step 0${i + 1}</small><h3>${x[0]}</h3><p>${x[1]}</p></div>`).join("")}</div></div></section>
<section class="sec2" id="notice"><div class="in"><h2>Notices</h2><p class="lead">Announcements from the hospital administration.</p><div class="nb">${NOTICES.map(n => `<div class="pin"><time>${n[0]}</time><span>${n[1]}</span></div>`).join("")}</div></div></section>
<div class="pat"></div><footer class="ft2" id="contact"><div class="in"><div><h4>SmartCare Government Hospital</h4>Hospital Road, District Headquarters<br>Uttar Pradesh - 000000</div><div><h4>Contact</h4>Helpline: 1800-000-0000<br>Emergency: 108<br>help@smartcare.example</div><div><h4>OPD timings</h4>Mon to Sat: 8:00 AM - 4:00 PM<br>Emergency: 24 hours</div><div><h4>Quick links</h4><a href="#/register">Get token</a><a href="#/live">Live queue</a><a href="#/admin">Staff login</a></div></div><div class="in cp">&copy; 2026 SmartCare Government Hospital. All rights reserved.</div></footer>`};
V[""].after = () => $("#tf").onsubmit = async e => {
  e.preventDefault(); const v = $("#tk").value.trim().toUpperCase(); if (!v) return toast("Enter a token number");
  try { await SC.track(v); location.hash = "#/queue" } catch (err) { toast(err.status === 404 ? "Token not found" : err.message) }
};

// ---------- token quota: 70% online / 30% offline ----------
const QP = 0.7, quota = d => { const on = Math.round(d.cap * QP); return { on, off: d.cap - on } };
const left = (d, src) => { const q = quota(d); return Math.max(0, src === "online" ? q.on - d.on : q.off - d.off) };
const totLeft = src => DEPTS.reduce((a, d) => a + left(d, src), 0);
// ---------- payments ----------
// Online tokens are paid through Razorpay Checkout (UPI / card / net banking). Card and bank details are typed
// into Razorpay's secure window and never reach this app or the SmartCare server.
// Counter (offline) parchas are booked by the hospital admin, who collects the fee in cash / UPI / card.
const MODES = ["Cash", "UPI", "Card"];
const sumPay = src => S.pay.filter(p => p.src === src && p.st !== "refunded").reduce((a, p) => a + p.amt, 0),
  payTxt = p => p ? (p.amt ? `₹${p.amt} via ${esc(p.m)}` : "Free") : "–",
  feeTxt = d => d.fee ? "₹" + d.fee : "Free";
const radios = (name, list) => `<div class="pm">${list.map((m, i) => `<label class="pmo"><input type="radio" name="${name}" value="${m}"${i ? "" : " checked"}> ${m}</label>`).join("")}</div>`;
const picked = name => { const r = document.querySelector(`input[name=${name}]:checked`); return r ? r.value : "" };
const FULLMSG = n => `Online tokens for ${n} are full. Please take a counter (offline) token at the hospital.`;

V.register = () => {
  const opt = src => DEPTS.map(d => { const l = left(d, src); return `<option value="${esc(d.n)}"${l ? "" : " disabled"}${src === "online" && l && d.n === S.pre ? " selected" : ""}>${esc(d.n)} (${l ? l + " left" : "Full"})</option>` }).join("");
  return shell("register", head("Token Booking", "Daily tokens in every department are split: 70% for online booking (fee paid online) and 30% for the hospital counter (offline parcha booked by the admin).") + `<div class="split">
<form class="card bk on" id="rf" onsubmit="return false"><span class="tag">70% Online</span><h3>Book online</h3><small class="sub">${totLeft("online")} online tokens left today</small>
<label>Full name *</label><input id="fn" value="${esc(S.user === "Patient" ? "" : S.user)}" placeholder="Full name" required><label>Age *</label><input id="ag" type="number" placeholder="e.g. 28" min="0" max="120" required><label>Phone number *</label><input id="ph" type="tel" placeholder="+91 98765 43210" autocomplete="tel" required><label>Department *</label><select id="dp">${opt("online")}</select>
<div class="fee" id="fee"></div>
<div id="payw" class="note b">${S.payMode === "demo" ? "<b>Demo mode:</b> a practice payment window will open. No real money is charged." : "You will pay securely with Razorpay: UPI, debit/credit card or net banking. Card and bank details are entered in Razorpay's own window and never reach SmartCare."}</div>
<br><button class="btn block" id="gt">Get Online Token</button><p class="sub">Your token is reserved for a few minutes while you pay. Your phone number is used only for notifications and is never shown on queue screens.</p></form>
<div class="card bk off"><span class="tag">30% Offline</span><h3>Hospital counter</h3><small class="sub">${totLeft("offline")} counter tokens left today</small><p class="sub">The counter (offline) parcha is booked by the hospital admin. Patients cannot book it from this page.</p>
<ol class="how"><li>Walk in to the hospital counter.</li><li>Tell the admin your department.</li><li>Pay the fee at the counter: cash, UPI or card.</li><li>Collect your printed parcha with the QR code and room number.</li></ol><a class="btn ghost block" href="#/counter">Staff: open counter booking</a></div></div>
<div class="card" style="margin-top:18px"><b>Not sure which department?</b><p class="sub">Type the problem (for example "chest pain" or "skin rash") to see which department and room number to go to.</p><div class="finder"><input id="fp" placeholder="e.g. chest pain" aria-label="Problem"><button class="btn" id="fb">Find room</button></div><div id="fr"></div></div>
<div class="card wrap" style="margin-top:18px"><b>Today's token quota and fee by department</b><table class="tbl"><tr><th>Department</th><th>Room</th><th>Fee</th><th>Online (70%)</th><th>Offline (30%)</th></tr>${DEPTS.map(d => { const q = quota(d), pc = (u, t) => t ? Math.min(100, Math.round(u / t * 100)) : 100; return `<tr><td><b>${esc(d.n)}</b></td><td>${esc(d.room)}</td><td>${feeTxt(d)}</td><td>${Math.min(d.on, q.on)}/${q.on}<div class="bar"><i style="width:${pc(d.on, q.on)}%"></i></div></td><td>${Math.min(d.off, q.off)}/${q.off}<div class="bar"><i style="width:${pc(d.off, q.off)}%"></i></div></td></tr>` }).join("")}</table></div>`)
};
V.register.after = () => {
  S.pre = null;
  const sel = $("#dp"), btn = $("#gt");
  const upd = () => { const f = dep(sel.value).fee || 0; $("#fee").innerHTML = f ? `Registration fee: <b>₹${f}</b>` : `Registration fee: <b>Free</b> (no payment needed)`; $("#payw").hidden = !f; btn.textContent = f ? `Pay ₹${f} & Get Online Token` : "Get Online Token" };
  sel.onchange = upd; upd();
  btn.onclick = async () => {
    if (!$("#rf").reportValidity()) return; const dept = sel.value, d = dep(dept), f = d.fee || 0;
    if (!left(d, "online")) return toast(FULLMSG(dept));
    btn.disabled = true; btn.textContent = f ? "Opening secure payment…" : "Booking…";
    try { await SC.bookOnline({ name: $("#fn").value.trim(), age: $("#ag").value, phone: $("#ph").value.trim(), dept }); location.hash = "#/parcha" }
    catch (e) { btn.disabled = false; upd(); toast(e.message); SC.refresh().catch(() => { }) }
  };
  const find = () => { const v = $("#fp").value.trim(); if (!v) return; const d = deptFrom(nrm(v)) || DEPTS[0]; $("#fr").innerHTML = `<div class="note g">For "${esc(v)}", please consult <b>${esc(d.n)}</b> in <b>Room ${esc(d.room)}</b>.</div>` };
  $("#fb").onclick = find; $("#fp").onkeydown = e => { if (e.key === "Enter") find() }
};

// ---------- admin: counter (offline) parcha booking ----------
V.counter = () => {
  const o = S.lastOff, rows = S.pay.filter(p => p.src === "offline"),
    opt = DEPTS.map(d => { const l = left(d, "offline"); return `<option value="${esc(d.n)}"${l ? "" : " disabled"}>${esc(d.n)} · ${feeTxt(d)} (${l ? l + " left" : "Full"})</option>` }).join("");
  return shell("counter", head("Counter Booking", "The offline parcha is booked here by the admin. Collect the fee, then issue the parcha.") + `
<div class="stats"><div class="card stat"><span>Counter tokens left</span><b>${totLeft("offline")}</b></div><div class="card stat"><span>Counter collection</span><b>₹${sumPay("offline")}</b></div><div class="card stat"><span>Online collection</span><b>₹${sumPay("online")}</b></div><div class="card stat"><span>Total collected</span><b>₹${sumPay("online") + sumPay("offline")}</b></div></div>
<div class="grid2"><form class="card bk off" id="cf" onsubmit="return false"><span class="tag">Admin · 30% Offline</span><h3>Issue counter parcha</h3><p class="sub">Only the department is needed. No patient details are stored.</p>
<label>Department *</label><select id="cd">${opt}</select><div class="fee" id="cfee"></div><div id="cpw"><label>Fee received by *</label>${radios("cm", MODES)}</div>
<br><button class="btn block" id="cg">Issue Parcha</button><br><button type="button" class="btn ghost block" id="cl">Lock counter booking</button></form>
<div>${o ? `<div class="card printable" style="text-align:center"><b>Counter Parcha</b><div class="logo" style="justify-content:center;margin:10px 0"><i>+</i>SmartCare</div><small style="color:var(--mute)">Government Hospital · Offline (counter) token</small><div class="big" style="font-size:32px">${o.t}</div><div class="qrbox">${QR.svg(o.t, 150)}</div><div style="text-align:left;margin-top:10px"><div class="row"><span>Department</span><b>${esc(o.d)}</b></div><div class="row"><span>Room</span><b>${esc(dep(o.d).room || "–")}</b></div><div class="row"><span>Fee paid</span><b>${payTxt(o.pay)}</b></div><div class="row"><span>Receipt no.</span><b>${esc(o.pay.rc)}</b></div><div class="row"><span>Issued at</span><b>${esc(o.pay.at)}</b></div></div></div><button class="btn block" id="cp" style="margin-top:12px">Print parcha</button>` : `<div class="card"><b>Issued parcha</b><p class="sub">The parcha with its QR code appears here after you issue it.</p></div>`}</div></div>
<div class="card wrap" style="margin-top:18px"><b>Counter bookings today</b><table class="tbl"><tr><th>Token</th><th>Department</th><th>Room</th><th>Fee</th><th>Received by</th><th>Receipt</th><th>Time</th></tr>${rows.map(p => `<tr><td><b>${p.tok}</b></td><td>${esc(p.d)}</td><td>${esc(dep(p.d).room || "–")}</td><td>${p.amt ? "₹" + p.amt : "Free"}</td><td>${esc(p.m)}</td><td>${esc(p.rc)}</td><td>${p.at}</td></tr>`).join("") || `<tr><td colspan="7">No counter bookings yet.</td></tr>`}</table></div>`)
};
V.counter.after = () => {
  const sel = $("#cd"), btn = $("#cg"), upd = () => { const f = dep(sel.value).fee || 0; $("#cfee").innerHTML = f ? `Fee to collect: <b>₹${f}</b>` : `Fee: <b>Free</b> (no payment needed)`; $("#cpw").hidden = !f; btn.textContent = f ? `Collect ₹${f} & Issue Parcha` : "Issue Free Parcha" };
  sel.onchange = upd; upd();
  btn.onclick = async () => { btn.disabled = true; try { const o = await SC.issueCounter(sel.value, picked("cm") || "Cash"); toast("Counter parcha " + o.t + " issued"); route() } catch (e) { btn.disabled = false; SC.error(e) } };
  $("#cl").onclick = () => { SC.logout(); route() };
  const cp = $("#cp"); if (cp) cp.onclick = () => window.print()
};

V.parcha = () => {
  const m = mine(), a = ahead(); if (!S.me) return shell("parcha", head("Token / Parcha", "Your token and QR code appear here after booking") + `<div class="card"><p class="sub">You have not booked a token yet.</p><a class="btn" href="#/register">Book a token</a></div>`); return shell("parcha", head("Token Generated", "Show this parcha at your room") + `<div class="grid2"><div class="card"><div class="okbox">✓ Token generated successfully!<div style="font-weight:500;margin-top:6px">Your token number</div><div class="big">${m.t}</div></div>
<div style="margin:14px 0"><div class="row"><span>Department</span><b>${esc(m.d)}</b></div><div class="row"><span>Booking</span><b>${m.src === "offline" ? "Offline (counter)" : "Online"}</b></div><div class="row"><span>Room number</span><b>${esc(dep(m.d).room || "–")}</b></div><div class="row"><span>Registration time</span><b>${esc(m.reg)}</b></div><div class="row"><span>Fee paid</span><b>${payTxt(m.pay)}</b></div><div class="row"><span>Receipt no.</span><b>${m.pay ? esc(m.pay.rc) : "–"}</b></div></div>
<button class="btn block" onclick="window.print()">View Parcha / Download</button><br><a class="btn ghost block" href="#/queue">Go to My Queue</a></div>
<div class="card printable" style="text-align:center"><b>Your Parcha</b><div class="logo" style="justify-content:center;margin:10px 0"><i>+</i>SmartCare</div><small style="color:var(--mute)">Government Hospital</small>
<div class="big" style="font-size:32px">${m.t}</div><div class="qrbox">${QR.svg(m.t, 150)}</div><div style="text-align:left;margin-top:10px"><div class="row"><span>Room</span><b>${esc(dep(m.d).room || "–")}</b></div><div class="row"><span>Patients ahead</span><b>${a}</b></div><div class="row"><span>Est. consultation</span><b>${est()}</b></div><div class="row"><span>Fee paid</span><b>${payTxt(m.pay)}</b></div></div>
<div class="note b">${arriveBy()}</div></div></div>`)
};

V.queue = () => {
  const m = mine(), a = ahead(); if (!S.me) return shell("queue", head("My Queue", "Track your live queue status") + `<div class="card"><p class="sub">You have no active token. Book one, or enter a token number on the home page to track it.</p><a class="btn" href="#/register">Book a token</a></div>`); return shell("queue", head("My Queue", "Track your live queue status") + `<div class="card" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:16px"><div><small style="color:var(--pri)">Token no.</small><div class="big" style="font-size:30px">${m.t}</div></div><div><small>Room number</small><br><b>${esc(dep(m.d).room || "–")}</b></div><div><small>Department</small><br><b>${esc(m.d)}</b></div>${pill("Waiting").replace("Waiting", "In Queue").replace("waiting", "completed")}</div>
<div class="stats"><div class="card stat"><span>Current token</span><b>${curTok(m.d)}</b></div><div class="card stat"><span>Patients ahead</span><b>${a}</b></div><div class="card stat"><span>Estimated time</span><b style="font-size:24px">${est()}</b></div></div>
<div class="card"><div class="steps"><div class="on"><i></i>Waiting</div><div><i></i>Called</div><div><i></i>Consultation</div><div><i></i>Completed</div></div>
<div class="note g">${m.s === "Consultation" ? `Your token is called. Please go to Room ${esc(dep(m.d).room || "–")}.` : m.s === "Completed" ? "Your consultation is completed." : m.s === "Cancelled" ? "This token was cancelled." : `You are ${a + 1}th in queue. Please wait for your turn.`}</div><div class="note b">AI prediction: the estimated time may change based on real-time queue data.</div></div>`)
};

// Public queue view: only room number and department are shown (no names, phones, addresses or emails).
V.live = () => {
  const f = S.filter, rows = S.queue.filter(q => f === "All" || q.d === f), m = mine().t;
  return shell("live", head("Live Queue", "Current queue status for all departments") + `<div class="tabs">${["All", ...dn()].map(d => `<button class="${d === f ? "on" : ""}" data-f="${esc(d)}">${esc(d)}</button>`).join("")}</div>
<div class="card wrap"><table class="tbl"><tr><th>Token no.</th><th>Room number</th><th>Department</th><th>Booking</th><th>Status</th><th>Time</th></tr>${rows.map(q => `<tr class="${q.t === m ? "me" : ""}"><td>${q.t}</td><td>${esc(dep(q.d).room || "–")}</td><td>${esc(q.d)}</td><td>${q.src === "offline" ? "Offline" : "Online"}</td><td>${pill(q.s)}</td><td>${q.at}</td></tr>`).join("") || `<tr><td colspan="6">No patients in this department.</td></tr>`}</table></div>`)
};
V.live.after = () => document.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { S.filter = b.dataset.f; route() });

// ---------- QR: Generate + Scan ----------
V.genqr = () => { const m = mine(); return shell("genqr", head("Generate QR", "Create the QR code for a token. Staff scan it at the room.") + `<div class="grid2"><form class="card" id="gf" onsubmit="return false"><label>Token number</label><input id="gq" value="${m.t === "–" ? "" : m.t}" placeholder="e.g. GM-048" autocomplete="off"><br><button class="btn block" id="gg">Generate QR</button></form><div class="card" id="go" style="text-align:center"></div></div>`) };
V.genqr.after = () => {
  const show = () => {
    const v = $("#gq").value.trim().toUpperCase(), q = S.queue.find(x => x.t === v), m = mine();
    if (!v || v === "–") { $("#go").innerHTML = '<p class="sub">Enter your token number to generate its QR code.</p>'; return } if (!q && v !== m.t) return toast("Token not found"); const d = q ? q.d : m.d;
    $("#go").innerHTML = `<b>QR for ${v}</b><div class="qrbox">${QR.svg(v, 220)}</div><div style="text-align:left"><div class="row"><span>Room number</span><b>${esc(dep(d).room || "–")}</b></div><div class="row"><span>Department</span><b>${esc(d)}</b></div></div>`
  };
  $("#gg").onclick = show; $("#gq").onkeydown = e => { if (e.key === "Enter") show() }; show()
};

let camStream = null, camTimer = null;
function stopCam() { clearInterval(camTimer); camTimer = null; if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null } }
async function checkIn(raw) {
  const v = String(raw).trim().toUpperCase(); if (!v) { toast("Enter a token number"); return false }
  try {
    const n = await SC.checkIn(v);
    const r = $("#sr"); if (r) r.innerHTML = `<div class="okbox" style="text-align:left">Token ${esc(n.token)} checked in</div><div class="row"><span>Room number</span><b>${esc(n.room)}</b></div><div class="row"><span>Department</span><b>${esc(n.department)}</b></div><div class="row"><span>Status</span>${pill("Consultation")}</div>`;
    return true
  }
  catch (e) { SC.error(e); return false }
}
V.scan = () => shell("scan", head("Scan QR", "Scan a patient's QR code to check them in") + `<div class="grid2"><div class="card"><b>Scan with camera</b><div class="scanbox"><video id="cam" playsinline muted hidden></video></div><p class="sub" id="cs">Press the button and point the camera at the QR code.</p><button class="btn block" id="sc">Start scanning</button>
<label>Or type the token number</label><input id="ct" placeholder="e.g. GM-048" autocomplete="off"><br><button class="btn ghost block" id="sn">Check in</button></div><div class="card" id="sr"><b>Result</b><p class="sub">The scanned token's room number and department will appear here.</p></div></div>`);
V.scan.after = () => {
  $("#sn").onclick = () => checkIn($("#ct").value);
  $("#sc").onclick = async () => {
    const st = $("#cs"), v = $("#cam");
    if (camStream) { stopCam(); v.hidden = true; $("#sc").textContent = "Start scanning"; st.textContent = "Scanner stopped."; return }
    if (!("BarcodeDetector" in window)) { st.textContent = "Camera QR scanning needs a recent Chrome or Edge. Please type the token number below."; return }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { st.textContent = "Camera is not available here. Please type the token number below."; return }
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); v.srcObject = camStream; await v.play(); v.hidden = false;
      $("#sc").textContent = "Stop scanning"; st.textContent = "Looking for a QR code…"; const det = new BarcodeDetector({ formats: ["qr_code"] });
      camTimer = setInterval(async () => { try { const r = await det.detect(v); if (r.length) { const ok = await checkIn(r[0].rawValue); stopCam(); v.hidden = true; $("#sc").textContent = "Start scanning"; st.textContent = ok ? "QR scanned." : "QR scanned, but the token was not found." } } catch (e) { } }, 400)
    }
    catch (e) { stopCam(); st.textContent = "Camera permission denied or not available. Please type the token number below." }
  }
};

V.mobile = () => {
  const m = mine(); if (!S.me) return shell("mobile", head("Patient Dashboard", "Mobile view") + `<div class="card"><p class="sub">Book or track a token to see your live status here.</p><a class="btn" href="#/register">Book a token</a></div>`); return shell("mobile", head("Patient Dashboard", "Mobile view") + `<div class="phone"><div class="logo"><i>+</i>SmartCare</div><h3 style="margin:14px 0 0">Hello, ${esc(m.n)}</h3><small style="color:var(--mute)">Here's your current queue status</small>
<div class="two"><div>Token no.<b>${m.t}</b></div><div>Room number<b>${esc(dep(m.d).room || "–")}</b></div><div>Department<b>${esc(m.d)}</b></div><div>Booking<b>${m.src === "offline" ? "Offline" : "Online"}</b></div><div>Patients ahead<b>${ahead()}</b></div><div>Estimated time<b>${est()}</b></div></div>
<div class="steps" style="font-size:10px"><div class="on"><i></i>Waiting</div><div><i></i>Called</div><div><i></i>Visit</div><div><i></i>Done</div></div><div class="note g">${arriveBy()}</div></div>`)
};

V.admin = () => {
  const st = S.stats || { total: 0, waiting: 0, completed: 0, emergency: 0, collected: { total: 0 } };
  return shell("admin", head("Hospital Overview", "Real-time statistics and queue management") + `<div class="stats"><div class="card stat"><span>Total patients</span><b>${st.total}</b></div><div class="card stat"><span>Waiting</span><b style="color:var(--warn)">${st.waiting}</b></div><div class="card stat"><span>Completed</span><b style="color:var(--ok)">${st.completed}</b></div><div class="card stat"><span>Emergency</span><b style="color:var(--bad)">${st.emergency}</b></div><div class="card stat"><span>Fees collected</span><b>₹${st.collected.total}</b></div></div>
<div class="card"><b>Department queues</b>${DEPTS.map((d, i) => { const l = S.queue.filter(q => q.d === d.n), nx = l.find(q => q.s === "Waiting"); return `<div class="dept"><div class="av">${esc(d.p)}</div><div><b>${esc(d.n)}</b> <small>Room ${esc(d.room)}</small><br><small>Current: ${curTok(d.n)} &nbsp; Next: ${nx ? nx.t : "–"}</small></div><div>${waiting(d.n)} in queue</div><a class="btn" href="#/live" onclick="S.filter=DEPTS[${i}].n">View</a></div>` }).join("")}</div>`)
};

// ---------- department management ----------
V.depts = () => {
  const e = S.editDept != null ? DEPTS[S.editDept] : null;
  return shell("depts", head("Departments", "Add, edit and manage hospital departments and their daily tokens (70% online, 30% offline) and the registration fee") + `<div class="card" style="margin-bottom:18px"><b>${e ? "Edit department" : "Add department"}</b><form id="df" class="dform" onsubmit="return false"><div><label>Department name *</label><input id="dnm" value="${esc(e ? e.n : "")}" required></div><div><label>Token code</label><input id="dcd" maxlength="3" value="${esc(e ? e.p : "")}" ${e ? "readonly" : ""} placeholder="auto"></div><div><label>Room number *</label><input id="drm" value="${esc(e ? e.room : "")}" required></div><div><label>Daily tokens *</label><input id="dcp" type="number" min="10" max="500" value="${e ? e.cap : 50}" required></div><div><label>Fee (₹) *</label><input id="dfe" type="number" min="0" max="5000" value="${e ? e.fee : 10}" required></div><div class="act"><button class="btn" id="dsv">${e ? "Save changes" : "Add department"}</button>${e ? `<button type="button" class="btn ghost" id="dcn">Cancel</button>` : ""}</div></form></div>
<div class="card wrap"><table class="tbl"><tr><th>Department</th><th>Code</th><th>Room</th><th>Daily tokens (online / offline)</th><th>Fee</th><th>Waiting</th><th></th></tr>${DEPTS.map((d, i) => { const q = quota(d); return `<tr><td><b>${esc(d.n)}</b></td><td>${esc(d.p)}</td><td>${esc(d.room)}</td><td>${d.cap} (${q.on} / ${q.off})</td><td>${d.fee ? "₹" + d.fee : "Free"}</td><td>${waiting(d.n)}</td><td class="ra"><button class="mini" data-e="${i}">Edit</button> <button class="mini del" data-x="${i}">Remove</button></td></tr>` }).join("")}</table></div>`)
};
V.depts.after = () => {
  $("#dsv").onclick = async () => {
    if (!$("#df").reportValidity()) return;
    const n = $("#dnm").value.trim(), room = $("#drm").value.trim(), cap = Math.max(10, Math.min(500, +$("#dcp").value || 50)), fee = Math.max(0, Math.min(5000, Math.round(+$("#dfe").value || 0))), i = S.editDept, btn = $("#dsv");
    if (DEPTS.some((d, j) => j !== i && d.n.toLowerCase() === n.toLowerCase())) return toast("This department already exists");
    btn.disabled = true;
    try {
      if (i != null) { await SC.saveDept(DEPTS[i].id, { name: n, room, dailyCap: cap, fee }); S.editDept = null; toast("Department updated") }
      else { await SC.saveDept(null, { name: n, code: $("#dcd").value, room, dailyCap: cap, fee }); toast("Department added: " + n) }
      route()
    }
    catch (e) { btn.disabled = false; SC.error(e) }
  };
  const c = $("#dcn"); if (c) c.onclick = () => { S.editDept = null; route() };
  document.querySelectorAll("[data-e]").forEach(b => b.onclick = () => { S.editDept = +b.dataset.e; route() });
  document.querySelectorAll("[data-x]").forEach(b => b.onclick = async () => {
    const d = DEPTS[+b.dataset.x];
    if (!confirm("Remove department " + d.n + "?")) return;
    try { await SC.removeDept(d.id); S.editDept = null; toast("Department removed"); route() } catch (e) { SC.error(e) }
  })
};

V.doctors = () => shell("doctors", head("OPD Status", "Set whether each department's OPD is available. Patients are notified of changes.") + `<div class="card wrap"><table class="tbl"><tr><th>Department</th><th>Room</th><th>Timing</th><th>Status</th><th>Current token</th></tr>
${DEPTS.map((d, i) => `<tr><td><b>${esc(d.n)}</b></td><td>${esc(d.room)}</td><td>${esc(d.tm)}</td><td><select class="ss" data-s="${i}" aria-label="Status of ${esc(d.n)}">${DOC_STATUS.map(s => `<option${s === d.st ? " selected" : ""}>${s}</option>`).join("")}</select></td><td>${curTok(d.n)}</td></tr>`).join("")}</table></div>`);
V.doctors.after = () => document.querySelectorAll("[data-s]").forEach(s => s.onchange = async () => { const d = DEPTS[+s.dataset.s]; try { await SC.setStatus(d.id, s.value) } catch (e) { SC.error(e) } route() });

V.analytics = () => {
  const st = S.stats || { waitByHour: [], departments: [] }, wh = new Map(st.waitByHour.map(w => [w.hour, w.avgMinutes])), pts = [8, 9, 10, 11, 12, 13, 14, 15, 16].map(h => Math.min(60, wh.get(h) || 0)), P = pts.map((v, i) => [40 + i * 52, 170 - v * 2.6]); const col = ["#2a78d1", "#d98a0b", "#7c5cd6", "#e5383b", "#94a3b8"], tot = st.departments.reduce((a, d) => a + d.count, 0), top = st.departments.slice(0, 4), cnt = [...top.map(d => d.count), tot - top.reduce((a, d) => a + d.count, 0)], pc = cnt.map(c => tot ? Math.round(c / tot * 100) : 0), nm = [...top.map(d => d.name), "Others"]; let a = 0; const g = tot ? pc.map((p, i) => { const s = a; a += p; return `${col[i]} ${s}% ${a}%` }).join(",") : "#e2e8f0 0% 100%";
  return shell("analytics", head("Analytics & Reports", "Insights for better hospital management") + `<div class="tabs"><button class="on">Queue Trends</button><button>Waiting Time</button><button>No-Show Rate</button></div>
<div class="card"><b>Average waiting time (minutes)</b><svg viewBox="0 0 470 210" style="width:100%;max-width:640px"><g stroke="var(--line)">${[0, 1, 2, 3].map(i => `<line x1="40" x2="460" y1="${170 - i * 52}" y2="${170 - i * 52}"/>`).join("")}</g><polyline fill="none" stroke="#2a78d1" stroke-width="3" points="${P.map(p => p.join(",")).join(" ")}"/>${P.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#2a78d1"/>`).join("")}<g fill="var(--mute)" font-size="11">${["8 AM", "10 AM", "12 PM", "2 PM", "4 PM"].map((t, i) => `<text x="${30 + i * 104}" y="195">${t}</text>`).join("")}</g></svg></div><br>
<div class="card"><b>Queue by department</b><div class="donutw"><div class="donut" style="background:conic-gradient(${g})"><div><span>${tot}<small>Total</small></span></div></div><div class="leg">${nm.map((n, i) => `<div><i style="background:${col[i]}"></i>${esc(n)} <b style="margin-left:auto;padding-left:30px">${pc[i]}%</b></div>`).join("")}</div></div></div>`)
};

V.emergency = () => shell("emergency", head("Emergency Priority", "Mark a patient as emergency to give them priority in the queue") + `<form class="card emg" onsubmit="return false"><label>Token number (optional)</label><input id="et" placeholder="Leave blank to open a new emergency token" autocomplete="off"><label>Department *</label><select id="ed">${dn().map(d => `<option${d === "Emergency" ? " selected" : ""}>${esc(d)}</option>`).join("")}</select><br><button class="btn red block" id="eb">Set Emergency Priority</button></form>`);
V.emergency.after = () => $("#eb").onclick = async () => {
  const t = $("#et").value.trim().toUpperCase(), d = $("#ed").value, b = $("#eb"); b.disabled = true;
  try { const r = await SC.emergency(t ? { token: t } : { departmentId: dep(d).id }); toast(`Emergency priority: token ${r.token} (Room ${r.room})`); setTimeout(() => location.hash = "#/alerts", 700) }
  catch (e) { SC.error(e) } finally { b.disabled = false }
};

V.alerts = () => {
  const f = S.nf, list = S.notes.filter(n => f === "All" || n.k === f), can = "Notification" in window && Notification.permission === "default";
  return shell("alerts", head("Notifications", "Appointments, token updates, queue status, OPD availability and room changes") + `<div class="tabs">${["All", ...Object.keys(KIND)].map(k => `<button class="${k === f ? "on" : ""}" data-nf="${k}">${k === "All" ? "All" : KIND[k][1]}</button>`).join("")}<button id="mr" style="margin-left:auto">Mark all as read</button>${can ? `<button id="en">Enable browser alerts</button>` : ""}</div>
<div class="card"><ul class="nl">${list.map(n => `<li class="${n.read ? "" : "new"}"><i style="background:${KIND[n.k][0]}"></i><span><small class="kt" style="color:${KIND[n.k][0]}">${KIND[n.k][1]}</small><br>${esc(n.m)}</span><em>${n.t}</em></li>`).join("") || `<li>No notifications.</li>`}</ul></div>`)
};
V.alerts.after = () => {
  document.querySelectorAll("[data-nf]").forEach(b => b.onclick = () => { S.nf = b.dataset.nf; route() });
  $("#mr").onclick = () => { SC.markRead(); route() };
  const en = $("#en"); if (en) en.onclick = () => Notification.requestPermission().then(() => route());
  SC.markRead(); badge()
};

// ---------- router ----------
// ---------- staff login (all staff screens are also protected on the server) ----------
const STAFF = new Set(["admin", "counter", "depts", "doctors", "analytics", "emergency", "scan"]);
V.login = () => shell("login", head("Staff Login", "Hospital staff only. Sign in to issue counter parchas, scan QR codes, manage departments and view reports.") + `<form class="card" id="lf" style="max-width:380px" onsubmit="return false"><label>Username</label><input id="lu" autocomplete="username" required><label>Password</label><input id="lp" type="password" autocomplete="current-password" required><br><button class="btn block" id="lb">Sign in</button></form>`);
V.login.after = () => {
  const go = async () => {
    const u = $("#lu").value.trim(), p = $("#lp").value; if (!u || !p) return toast("Enter username and password");
    const b = $("#lb"); b.disabled = true; try { await SC.login(u, p); route() } catch (e) { b.disabled = false; toast(e.message) }
  };
  $("#lb").onclick = go; $("#lp").onkeydown = e => { if (e.key === "Enter") go() }; $("#lu").focus()
};

// ---------- router ----------
function route(keep) {
  stopCam(); const r = location.hash.replace(/^#\/?/, ""); const v = STAFF.has(r) && !S.admin ? V.login : (V[r] || V[""]); const mount = document.getElementById("smartcare-mount") || document.getElementById("root"); if (!mount) return; mount.innerHTML = v(); if (keep !== true) window.scrollTo(0, 0); v.after && v.after();
  const t = $("#th"); if (t) t.onclick = () => { const d = document.documentElement, dark = getComputedStyle(d).getPropertyValue("--bg").trim() === "#0c1b2b"; d.dataset.theme = dark ? "light" : "dark" }
}
addEventListener("hashchange", route);
{ const m = document.getElementById("smartcare-mount") || document.getElementById("root"); if (m) m.innerHTML = '<p style="padding:40px;text-align:center;font-family:sans-serif">Loading SmartCare…</p>' }
SC.init().then(() => route()).catch(SC.fail);
