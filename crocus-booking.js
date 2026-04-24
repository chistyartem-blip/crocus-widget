// ── Data ──────────────────────────────────────────────────────
const CW_SERVICES = [
  { id:'manikure', name:'Maniküre', desc:'Klassische oder Gel-Maniküre mit Nagelhautpflege und Formgebung.', dur:'45–90 Min', img:'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=75', price:35, badge:null },
  { id:'pedikure', name:'Pediküre', desc:'Pflegende Fußbehandlung inkl. kostenloser Fußmassage.', dur:'60–90 Min', img:'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=400&q=75', price:40, badge:'Gratis Massage' },
  { id:'wimpern', name:'Wimpernverlängerung', desc:'Klassisch, Volumen oder Mega-Volumen. Natürlicher Look.', dur:'90–150 Min', img:'https://images.unsplash.com/photo-1512207846876-bb54ef5056fe?w=400&q=75', price:79, badge:null },
  { id:'kombi', name:'Kombi Mani + Pedi', desc:'Hände und Füße in einem Termin. Günstiger als einzeln.', dur:'2–3 Std', img:'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=75', price:89, badge:'Spare bis 20€' },
];

const CW_LEVELS = {
  'Junior':     { color:'#6B8CAE', bg:'rgba(107,140,174,0.12)', border:'rgba(107,140,174,0.28)', desc:'Guter Einstieg · Sorgfältige Arbeit' },
  'Master':     { color:'#c9748e', bg:'rgba(201,116,142,0.12)', border:'rgba(201,116,142,0.28)', desc:'Erfahren · Zuverlässig' },
  'Top Master': { color:'#c9a87c', bg:'rgba(201,168,124,0.12)', border:'rgba(201,168,124,0.32)', desc:'Sehr erfahren · Kreative Designs' },
  'Premium':    { color:'#e8d5c4', bg:'rgba(232,213,196,0.09)', border:'rgba(232,213,196,0.28)', desc:'Highest Level · Exklusiv' },
};

const CW_MASTERS = [
  { id:'m1', name:'Anna K.',   level:'Junior',     photo:'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=200&q=75', bio:'Frisch zertifiziert, viel Liebe zum Detail.', next:'Heute, 15:00', svcs:['manikure','pedikure'],              prices:{manikure:35,pedikure:40,wimpern:null,kombi:89} },
  { id:'m2', name:'Maria S.',  level:'Master',     photo:'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=75', bio:'3 Jahre Erfahrung. Spezialisiert auf Gel.', next:'Heute, 17:30', svcs:['manikure','pedikure','kombi'],         prices:{manikure:45,pedikure:50,wimpern:null,kombi:100} },
  { id:'m3', name:'Sofia L.',  level:'Top Master', photo:'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&q=75', bio:'6 Jahre. Gewinnerin regionaler Nail Art Wettbewerbe.', next:'Morgen, 10:00', svcs:['manikure','pedikure','wimpern','kombi'], prices:{manikure:55,pedikure:65,wimpern:120,kombi:120} },
  { id:'m4', name:'Elena V.',  level:'Premium',    photo:'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=75', bio:'Top-Spezialistin für Wimpern & Premium Nail Art. 8+ Jahre.', next:'Fr, 14:00', svcs:['manikure','wimpern'],                prices:{manikure:65,pedikure:null,wimpern:160,kombi:null} },
];

const CW_TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];
const CW_TAKEN = { '2026-04-24':['09:00','10:00','14:00'], '2026-04-25':['09:30','11:30','15:00','17:00'] };
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYS_DE = ['Mo','Di','Mi','Do','Fr','Sa','So'];

// ── State ─────────────────────────────────────────────────────
let cw = { step:1, svcId:null, masterId:null, date:null, time:null, calY:2026, calM:3 };

// ── Open / Close ──────────────────────────────────────────────
function crocusOpen() {
  crocusRenderServices();
  const bd = document.getElementById('crocus-backdrop');
  const md = document.getElementById('crocus-modal');
  bd.classList.add('open');
  requestAnimationFrame(() => { bd.classList.add('visible'); md.classList.add('open'); });
  document.body.style.overflow = 'hidden';
}
function crocusClose() {
  const bd = document.getElementById('crocus-backdrop');
  const md = document.getElementById('crocus-modal');
  bd.classList.remove('visible'); md.classList.remove('open');
  setTimeout(() => { bd.classList.remove('open'); document.body.style.overflow = ''; }, 320);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') crocusClose(); });

// ── Steps ─────────────────────────────────────────────────────
function crocusGoStep(n) {
  cw.step = n;
  document.querySelectorAll('.cw-step').forEach(el => el.classList.remove('active'));
  const target = n === 'success' ? document.getElementById('cw-success') : document.getElementById('cw-step'+n);
  if (target) { target.classList.add('active'); }
  document.getElementById('crocus-body').scrollTop = 0;
  crocusUpdateProgress(n);
  if (n === 2) crocusRenderMasters();
  if (n === 3) crocusRenderCalendar();
  if (n === 4) crocusRenderSummary();
}

function crocusUpdateProgress(n) {
  [1,2,3,4].forEach(i => {
    const el = document.getElementById('cp'+i);
    const line = document.getElementById('cpline'+i);
    el.classList.remove('active','done');
    if (n === 'success' || (n === 'success' ? 5 : n) > i) { el.classList.add('done'); if (line) line.classList.add('filled'); }
    else if (i === n) { el.classList.add('active'); if (line) line.classList.remove('filled'); }
    else { if (line) line.classList.remove('filled'); }
    // dot content
    const dot = el.querySelector('.cp-dot');
    if (el.classList.contains('done')) dot.innerHTML = '✓';
    else dot.textContent = i;
  });
}

// ── Render Services ───────────────────────────────────────────
function crocusRenderServices() {
  const list = document.getElementById('cw-services-list');
  list.innerHTML = CW_SERVICES.map(s => `
    \x3cbutton class="cw-service" onclick="crocusSelectSvc('${s.id}')"\x3e
      \x3cdiv class="cw-svc-img"\x3e
        \x3cimg src="${s.img}" alt="${s.name}" loading="lazy"\x3e
        ${s.badge ? `\x3cspan class="cw-svc-badge"\x3e${s.badge}\x3c/span\x3e` : ''}
      \x3c/div\x3e
      \x3cdiv class="cw-svc-body"\x3e
        \x3cdiv class="cw-svc-name"\x3e${s.name}\x3c/div\x3e
        \x3cdiv class="cw-svc-desc"\x3e${s.desc}\x3c/div\x3e
        \x3cdiv class="cw-svc-foot"\x3e
          \x3cspan class="cw-svc-dur"\x3e⏱ ${s.dur}\x3c/span\x3e
          \x3cspan class="cw-svc-price"\x3eab ${s.price} €\x3c/span\x3e
        \x3c/div\x3e
      \x3c/div\x3e
    \x3c/button\x3e
  `).join('');
}

function crocusSelectSvc(id) {
  cw.svcId = id; cw.masterId = null; cw.date = null; cw.time = null;
  document.getElementById('cw-selected-svc-name').textContent = CW_SERVICES.find(s=>s.id===id).name;
  crocusGoStep(2);
}

// ── Render Masters ────────────────────────────────────────────
function crocusRenderMasters() {
  const svc = CW_SERVICES.find(s => s.id === cw.svcId);
  const filtered = CW_MASTERS.filter(m => m.svcs.includes(cw.svcId));
  const list = document.getElementById('cw-masters-list');
  list.innerHTML = `
    \x3cbutton class="cw-master cw-master-any" onclick="crocusSelectMaster('any')"\x3e
      \x3cdiv class="cw-any-icon"\x3e⚡\x3c/div\x3e
      \x3cdiv class="cw-any-info"\x3e
        \x3cdiv class="cw-any-title"\x3eNächster freier Termin\x3c/div\x3e
        \x3cdiv class="cw-any-sub"\x3eHeute, 15:00 · Automatische Zuweisung\x3c/div\x3e
      \x3c/div\x3e
      \x3cdiv class="cw-any-price"\x3eab ${svc.price} €\x3c/div\x3e
    \x3c/button\x3e
    ${filtered.map(m =\x3e {
      const lv = CW_LEVELS[m.level];
      const price = m.prices[cw.svcId];
      return `
      \x3cbutton class="cw-master" onclick="crocusSelectMaster('${m.id}')"\x3e
        \x3cimg class="cw-master-photo" src="${m.photo}" alt="${m.name}" loading="lazy"\x3e
        \x3cdiv class="cw-master-body"\x3e
          \x3cdiv class="cw-master-top"\x3e
            \x3cspan class="cw-master-name"\x3e${m.name}\x3c/span\x3e
            \x3cspan class="cw-lvl-badge" style="color:${lv.color};background:${lv.bg};border:1px solid ${lv.border}"\x3e${m.level}\x3c/span\x3e
          \x3c/div\x3e
          \x3cdiv class="cw-lvl-desc" style="color:${lv.color}"\x3e${lv.desc}\x3c/div\x3e
          \x3cdiv class="cw-master-bio"\x3e${m.bio}\x3c/div\x3e
          \x3cdiv class="cw-master-foot"\x3e
            \x3cspan class="cw-master-next"\x3e🕐 ${m.next}\x3c/span\x3e
            ${price ? `\x3cspan class="cw-master-price" style="color:${lv.color}"\x3e${price} €\x3c/span\x3e` : ''}
          \x3c/div\x3e
        \x3c/div\x3e
      \x3c/button\x3e`;
    }).join('')}
  `;
}

function crocusSelectMaster(id) {
  cw.masterId = id; cw.date = null; cw.time = null;
  const m = CW_MASTERS.find(m=>m.id===id);
  const svc = CW_SERVICES.find(s=>s.id===cw.svcId);
  document.getElementById('cw-step3-sub').innerHTML =
    `${svc.name} · \x3cstrong style="color:#fdfaf8"\x3e${id==='any'?'Nächster freier':m.name}\x3c/strong\x3e`;
  crocusGoStep(3);
}

// ── Calendar ──────────────────────────────────────────────────
function crocusRenderCalendar() {
  document.getElementById('cw-cal-title').textContent = `${MONTHS_DE[cw.calM]} ${cw.calY}`;
  const grid = document.getElementById('cw-cal-grid');
  const today = new Date().toISOString().split('T')[0];
  const daysInMonth = new Date(cw.calY, cw.calM+1, 0).getDate();
  const firstDay = (new Date(cw.calY, cw.calM, 1).getDay() + 6) % 7;
  let html = DAYS_DE.map(d=>`\x3cdiv class="cw-dow"\x3e${d}\x3c/div\x3e`).join('');
  for(let i=0;firstDay>i;i++) html += '\x3cdiv\x3e\x3c/div\x3e';
  for(let d=1;daysInMonth>=d;d++) {
    const ds = `${cw.calY}-${String(cw.calM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const past = today > ds;
    const sel = cw.date === ds;
    html += `\x3cbutton class="cw-day ${past?'past':'avail'} ${sel?'sel':''}" ${past?'disabled':''} onclick="crocusSelectDate('${ds}')"\x3e${d}\x3c/button\x3e`;
  }
  grid.innerHTML = html;
  document.getElementById('cw-times-wrap').style.display = cw.date ? 'block' : 'none';
  if (cw.date) crocusRenderTimes();
}

function crocusCalPrev() { if(cw.calM===0){cw.calM=11;cw.calY--;}else cw.calM--; crocusRenderCalendar(); }
function crocusCalNext() { if(cw.calM===11){cw.calM=0;cw.calY++;}else cw.calM++; crocusRenderCalendar(); }

function crocusSelectDate(ds) {
  cw.date = ds; cw.time = null;
  document.getElementById('cw-times-wrap').style.display = 'block';
  crocusRenderCalendar();
  crocusRenderTimes();
}

function crocusRenderTimes() {
  const taken = CW_TAKEN[cw.date] || [];
  document.getElementById('cw-time-grid').innerHTML = CW_TIMES.map(t => {
    const isTaken = taken.includes(t);
    const isSel = cw.time === t;
    return `\x3cbutton class="cw-time ${isTaken?'taken':'free'} ${isSel?'sel':''}" ${isTaken?'disabled':''} onclick="crocusSelectTime('${t}')"\x3e${t}\x3c/button\x3e`;
  }).join('');
}

function crocusSelectTime(t) {
  cw.time = t;
  crocusRenderTimes();
  setTimeout(() => crocusGoStep(4), 180);
}

// ── Summary ───────────────────────────────────────────────────
function crocusRenderSummary() {
  const svc = CW_SERVICES.find(s=>s.id===cw.svcId);
  const m = cw.masterId === 'any' ? null : CW_MASTERS.find(m=>m.id===cw.masterId);
  const lv = m ? CW_LEVELS[m.level] : null;
  const price = m ? m.prices[cw.svcId] : null;
  const dateStr = cw.date ? new Date(cw.date).toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'}) : '';
  document.getElementById('cw-summary').innerHTML = `
    \x3cdiv class="cw-sum-row"\x3e\x3cspan\x3eBehandlung\x3c/span\x3e\x3cstrong\x3e${svc.name}\x3c/strong\x3e\x3c/div\x3e
    \x3cdiv class="cw-sum-row"\x3e
      \x3cspan\x3eMeisterin\x3c/span\x3e
      \x3cstrong\x3e${m ? m.name : 'Nächste freie'}\x3c/strong\x3e
      ${lv ? `\x3cspan class="cw-sum-lvl" style="color:${lv.color}"\x3e${m.level}\x3c/span\x3e` : ''}
    \x3c/div\x3e
    \x3cdiv class="cw-sum-row"\x3e\x3cspan\x3eDatum & Zeit\x3c/span\x3e\x3cstrong\x3e${dateStr}, ${cw.time} Uhr\x3c/strong\x3e\x3c/div\x3e
    ${price ? `\x3cdiv class="cw-sum-row cw-sum-price"\x3e\x3cspan\x3ePreis\x3c/span\x3e\x3cstrong style="color:${lv.color}"\x3e${price} €\x3c/strong\x3e\x3c/div\x3e` : ''}
  `;
}

// ── Submit ────────────────────────────────────────────────────
function crocusSubmit(e) {
  e.preventDefault();
  const svc = CW_SERVICES.find(s=>s.id===cw.svcId);
  const m = cw.masterId === 'any' ? null : CW_MASTERS.find(m=>m.id===cw.masterId);
  const dateStr = cw.date ? new Date(cw.date).toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'}) : '';
  document.getElementById('cw-success-text').innerHTML =
    `\x3cstrong\x3e${svc.name}\x3c/strong\x3e bei \x3cstrong\x3e${m?m.name:'nächster freier Meisterin'}\x3c/strong\x3e\x3cbr\x3e${dateStr}, ${cw.time} Uhr`;
  crocusGoStep('success');
  document.getElementById('crocus-progress').style.display = 'none';
}

function crocusReset() {
  cw = { step:1, svcId:null, masterId:null, date:null, time:null, calY:2026, calM:3 };
  document.getElementById('crocus-progress').style.display = 'flex';
  document.querySelectorAll('.cw-step').forEach(el => el.classList.remove('active'));
  document.getElementById('cw-step1').classList.add('active');
  crocusUpdateProgress(1);
  crocusRenderServices();
  document.getElementById('crocus-body').scrollTop = 0;
}

// ── Event Listeners (Tilda-safe, no onclick attrs) ─────────────
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('crocus-fab').addEventListener('click', crocusOpen);
  document.getElementById('crocus-backdrop').addEventListener('click', crocusClose);
  document.getElementById('crocus-close').addEventListener('click', crocusClose);
  document.getElementById('cw-back1').addEventListener('click', function(){ crocusGoStep(1); });
  document.getElementById('cw-back2').addEventListener('click', function(){ crocusGoStep(2); });
  document.getElementById('cw-back3').addEventListener('click', function(){ crocusGoStep(3); });
  document.getElementById('cw-cal-prev').addEventListener('click', crocusCalPrev);
  document.getElementById('cw-cal-next').addEventListener('click', crocusCalNext);
  document.getElementById('cw-btn-new').addEventListener('click', crocusReset);
  document.getElementById('cw-form').addEventListener('submit', crocusSubmit);
});