// SmartCare Assistant: floating chatbot (English + Hinglish).
// It is an on-device, rule-based assistant that reads the live app state (queue, departments, rooms),
// so it needs no server or API key. It never reveals other patients' personal details.
const BOT={open:false,flow:null,msgs:[]};
const nrm=s=>s.toLowerCase().replace(/[^a-z0-9\s\-]/g," ").replace(/\s+/g," ").trim();

// symptom / alias -> department (checked after exact department names)
const SYM=[
 [/accident|ambulance|unconscious|bleeding|casualty|critical|emergency/,"Emergency"],
 [/chest|heart|cardio|blood pressure|\bbp\b|palpitation|seene/,"Cardiology"],
 [/neuro|migraine|headache|head ache|sir dard|seizure|fits|stroke|paralysis|nerve|dizz|chakkar/,"Neurology"],
 [/ortho|bone|fracture|joint|knee|ghutna|haddi|shoulder|sprain/,"Orthopedics"],
 [/pediatric|paediatric|child|kid|baby|infant|bachcha|baccha|bachche|newborn/,"Pediatrics"],
 [/derma|skin|rash|itch|khujli|pimple|acne|allerg|chamdi|hair fall/,"Dermatology"],
 [/\bent\b|ear|kaan|nose|naak|throat|gala|sinus|tonsil/,"ENT"],
 [/gyn|pregnan|garbh|period|maternity|antenatal|women/,"Gynecology"],
 [/ophthal|eye|aankh|vision|cataract|glasses|chashma/,"Ophthalmology"],
 [/dental|dentist|tooth|teeth|daant|gum|cavity/,"Dental"],
 [/radiolog|x-?ray|\bmri\b|\bct\b|scan|ultrasound|sonograph/,"Radiology"],
 [/patholog|blood test|urine|\blab\b|sample|sugar test/,"Pathology"],
 [/surg|operation|hernia|appendix|gallbladder|piles/,"Surgery"],
 [/physio|rehab|exercise|back pain|kamar|spine|neck pain|therapy/,"Physiotherapy"],
 [/fever|bukhar|cold|cough|khansi|sardi|stomach|pet dard|body ache|weakness|vomit|diarrh|general|physician|medicine/,"General Medicine"]];
function deptFrom(t){
 for(const d of DEPTS){if(t.includes(d.n.toLowerCase()))return d}
 for(const [re,n] of SYM){if(re.test(t)){const d=dep(n);if(d.n)return d}}
 return null}

const link=(h,l)=>`<a class="blink" href="${h}">${l}</a>`;
const stat=d=>d.st==="Available"?"available now":d.st==="Busy"?"currently busy":"not available right now";
function deptInfo(d){return `<b>${esc(d.n)}</b> (OPD ${stat(d)})<br>Room number: <b>${esc(d.room)}</b><br>Timing: ${esc(d.tm)}<br>Now serving: ${curTok(d.n)} &middot; Waiting: ${waiting(d.n)}<br>Registration fee: ${d.fee?"₹"+d.fee:"Free"}<br>Tokens left: ${left(d,"online")} online, ${left(d,"offline")} at counter`}
function status(){if(!S.me)return `You have not booked a token yet.<br>${link("#/register","Book a token")}`;const m=mine(),a=ahead();
 return `Your token: <b>${m.t}</b><br>Department: ${esc(m.d)}<br>Room number: <b>${esc(dep(m.d).room||"–")}</b><br>Now serving: ${curTok(m.d)}<br>Patients ahead: ${a}<br>Estimated time: ${est()}<br>${link("#/queue","Open My Queue")}`}

const CHIPS=["Book appointment","My token status","Departments","Which department?","OPD timings","Which room?"];
function reply(raw){
 const t=nrm(raw);
 // ---- booking flow ----
 if(BOT.flow){
  if(/^(cancel|stop|exit|quit|back|nahi|no)$/.test(t)){BOT.flow=null;return["Okay, booking cancelled. How else can I help?",CHIPS]}
  const f=BOT.flow;
  if(f.step==="dept"){const d=deptFrom(t);if(!d)return["I could not find that department. Please pick one from the list or tell me the problem (for example \"chest pain\").",dn()];
   BOT.flow=null;
   if(left(d,"online")){S.pre=d.n;return[`Online tokens are booked on the booking page. <b>${esc(d.n)}</b>: fee <b>${d.fee?"₹"+d.fee:"Free"}</b>, Room ${esc(d.room)}. ${d.fee?"You can pay by UPI, card or net banking there.":"No payment is needed."}<br>${link("#/register",d.fee?"Pay &amp; book token":"Book token")}`,["Departments"]]}
   return[`Online tokens for <b>${esc(d.n)}</b> are full. Please take a counter (offline) token at the hospital: ${esc(d.n)}, Room ${esc(d.room)}.`,["Departments"]]}}
 // ---- smalltalk ----
 if(/^(hi|hii+|hello|hey|namaste|namaskar|good (morning|afternoon|evening))\b/.test(t))return["Hello! I'm the SmartCare Assistant. I can book an online appointment, check your token and queue, and tell you the department and room number for your problem.",CHIPS];
 if(/\b(thanks|thank you|shukriya|dhanyavad|ok thanks)\b/.test(t))return["You're welcome. Get well soon!"];
 if(/^(bye|goodbye|ok bye|alvida)\b/.test(t))return["Take care. Goodbye!"];
 // ---- another token (shows only status + room, never personal data) ----
 const tk=t.match(/\b([a-z]{2,3})-?(\d{3})\b/);
 if(tk){const id=(tk[1]+"-"+tk[2]).toUpperCase(),q=S.queue.find(x=>x.t===id);
  if(id===mine().t)return[status()];
  return q?[`Token <b>${id}</b><br>Status: ${pill(q.s)}<br>Room number: ${esc(dep(q.d).room||"–")}<br>Department: ${esc(q.d)}`]:[`I could not find token ${id}. Please check the number.`]}
 // ---- payment / fees / offline ----
 if(/\b(pay|payment|fee|fees|charge|charges|cost|price|upi|cash|paisa|paise|rupee|rupees|offline|counter)\b/.test(t)){
  const d=deptFrom(t);
  if(d)return[`Registration fee for <b>${esc(d.n)}</b>: <b>${d.fee?"₹"+d.fee:"Free"}</b>. Online tokens are paid by UPI, card or net banking while booking. Counter tokens are paid at the counter.<br>${link("#/register","Open Token Booking")}`];
  return[`<b>Online tokens (70%):</b> pay the registration fee by UPI, card or net banking while booking.<br><b>Counter / offline parcha (30%):</b> booked by the hospital admin at the counter. Tell your department and pay in cash, UPI or card.<br>Fees: ${DEPTS.map(x=>`${esc(x.n)} ${x.fee?"₹"+x.fee:"Free"}`).join(", ")}.`,["Book appointment"]]}
 // ---- my token / queue status ----
 if(/(my|mera|meri|mere).*(token|appointment|turn|number|queue)|queue|ahead|position|kitne log|kab.*(number|turn|aayega)|my turn|waiting time|how long|\beta\b|estimated|status|wait/.test(t))return[status()];
 // ---- book ----
 if(/book|appointment|apointment|register|registration|new token|get token|token (le|lena|chahiye|nikal)|token/.test(t)){
  BOT.flow={step:"dept"};
  return["Sure, let's book your online appointment. Which department do you need? You can also describe the problem (for example \"skin rash\") and I will pick the department.",dn()]}
 // ---- doctor / which department ----
 if(/doctor|\bdr\b|specialist|physician|which department|konsa|kaun.*(vibhag|department)/.test(t)){
  const d=deptFrom(t);if(d)return[`For this, please consult <b>${esc(d.n)}</b> in <b>Room ${esc(d.room)}</b>.<br>${deptInfo(d)}`];
  return["Tell me the problem (for example \"chest pain\" or \"skin rash\") and I will tell you the department and the room number to consult.",["chest pain","skin rash","tooth pain","fever"]]}
 // ---- room ----
 if(/room|cabin|kahan|kaha|where|location|floor/.test(t)){
  const d=deptFrom(t);if(d)return[`${esc(d.n)} is in <b>Room ${esc(d.room)}</b>.`];
  const m=mine();return[`Your department (${esc(m.d)}) is in <b>${roomOf(m.d)}</b>. Ask me about any other department, for example "Cardiology room".`]}
 // ---- departments ----
 const d=deptFrom(t);
 if(d){const named=DEPTS.some(x=>t.includes(x.n.toLowerCase()));return[(named?"":`For this problem, please consult <b>${esc(d.n)}</b> in <b>Room ${esc(d.room)}</b>.<br>`)+deptInfo(d),["Book "+d.n]]}
 if(/department|dept|specialit|opd|vibhag/.test(t)&&!/timing|hours|time/.test(t))return[`We have ${DEPTS.length} departments:<br>${DEPTS.map(x=>`${esc(x.n)} (Room ${esc(x.room)})`).join("<br>")}<br>Ask me about any one of them.`,dn().slice(0,6)];
 // ---- info ----
 if(/notif|alert|sms|message|update/.test(t)){const u=S.notes.slice(0,3).map(n=>`&bull; ${esc(n.m)}`).join("<br>");return[`You get notifications for appointment confirmation, token updates, queue status, OPD availability and room changes.<br>${u}<br>${link("#/alerts","Open Notifications")}`]}
 if(/\bqr\b|scan|barcode/.test(t))return[`Use <b>Generate QR</b> to create the QR code for your token, and <b>Scan QR</b> at the room to check in.<br>${link("#/genqr","Generate QR")} ${link("#/scan","Scan QR")}`];
 if(/timing|hours|open|close|khulta|time/.test(t))return["OPD: Mon to Sat, 8:00 AM to 4:00 PM. Token counter opens at 7:30 AM; online registration from 6:00 AM. Emergency: 24 hours."];
 if(/ambulance|108|helpline|contact|phone|call|address/.test(t))return["Helpline: 1800-000-0000. Emergency / ambulance: 108. Email: help@smartcare.example."];
 if(/privacy|personal|data|secure/.test(t))return["Your privacy is protected. Queue screens show only the token, room number and department. Name, phone, address and email are never shown."];
 if(/pharmacy|medicine free|dawai/.test(t))return["Essential medicines are free at the hospital pharmacy on showing the parcha."];
 if(/help|what can you|kya kar/.test(t))return["I can: book an online appointment, show your token and queue status, tell you the department and room number for your problem, and explain notifications and QR.",CHIPS];
 return["Sorry, I did not understand that. I can help with appointments, tokens, queue status, departments and room numbers.",CHIPS]}

// ---------- UI ----------
function botRender(){
 const box=$("#botmsgs");if(!box)return;
 box.innerHTML=BOT.msgs.map(m=>`<div class="bm ${m.me?"me":"bot"}">${m.me?esc(m.h):m.h}</div>${m.chips?`<div class="bchips">${m.chips.map(c=>`<button data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>`:""}`).join("");
 box.scrollTop=box.scrollHeight;
 box.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>botSend(b.dataset.c));
 box.querySelectorAll("a.blink").forEach(a=>a.addEventListener("click",()=>{if(matchMedia("(max-width:820px)").matches)botToggle(false)}))}
function botSend(text){text=text.trim();if(!text)return;
 BOT.msgs.forEach(m=>delete m.chips);BOT.msgs.push({me:true,h:text});botRender();
 let r;try{r=reply(text.replace(/^Book (?=[A-Z])/,"book "))}catch(e){r=["Something went wrong. Please try again."]}
 setTimeout(()=>{BOT.msgs.push({h:r[0],chips:r[1]});botRender()},350)}
function botToggle(o){BOT.open=o===undefined?!BOT.open:o;const p=$("#botpanel");p.hidden=!BOT.open;$("#botfab").setAttribute("aria-expanded",BOT.open);
 if(BOT.open){if(!BOT.msgs.length)BOT.msgs.push({h:"Hello! I'm the <b>SmartCare Assistant</b>. Ask me about appointments, tokens, queue status, departments or room numbers.",chips:CHIPS});botRender();$("#botin").focus()}}
(function mountBot(){
 const w=document.createElement("div");w.id="bot";
 w.innerHTML=`<button id="botfab" class="botfab" aria-label="Open chatbot" aria-expanded="false" aria-controls="botpanel"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/></svg></button>
 <section id="botpanel" class="botpanel" hidden aria-label="SmartCare Assistant"><header><div><b>SmartCare Assistant</b><small>Appointments, tokens &amp; queue help</small></div><button id="botx" aria-label="Close chatbot">&times;</button></header>
 <div id="botmsgs" class="botmsgs" aria-live="polite"></div>
 <form id="botf" class="botf" autocomplete="off"><input id="botin" placeholder="Type your question…" aria-label="Message"><button class="btn" aria-label="Send">Send</button></form></section>`;
 document.body.appendChild(w);
 $("#botfab").onclick=()=>botToggle();$("#botx").onclick=()=>botToggle(false);
 $("#botf").onsubmit=e=>{e.preventDefault();const i=$("#botin");const v=i.value;i.value="";botSend(v)};
 addEventListener("keydown",e=>{if(e.key==="Escape"&&BOT.open)botToggle(false)})})();
