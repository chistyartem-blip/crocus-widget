(function () {
'use strict';

// ── CONFIG — заменить на реальные после получения токенов ──────
var CONFIG = {
  partnerToken: 'gg4k5b7uhrgbthscyfwx',
  locationId:   '1357963',
  apiBase:      'https://crocus-booking-proxy.crocus-panel.workers.dev/api',
  lang: 'de',

  // Маппинг уровней мастеров (из специализации в Altegio → наш UI)
  levels: {
    'Junior':     { color:'#6B8CAE', bg:'rgba(107,140,174,0.12)', border:'rgba(107,140,174,0.28)', label:'Junior',     desc:'Sorgfältige Arbeit · Guter Einstieg' },
    'Master':     { color:'#c9748e', bg:'rgba(201,116,142,0.12)', border:'rgba(201,116,142,0.28)', label:'Master',     desc:'Erfahren · Zuverlässig' },
    'Top Master': { color:'#c9a87c', bg:'rgba(201,168,124,0.12)', border:'rgba(201,168,124,0.32)', label:'Top Master', desc:'Sehr erfahren · Kreative Designs' },
    'Premium':    { color:'#e8d5c4', bg:'rgba(232,213,196,0.09)', border:'rgba(232,213,196,0.28)', label:'Premium',    desc:'Highest Level · Exklusiv' },
  },
  defaultLevel: 'Master',
};

// ── API helpers ────────────────────────────────────────────────
function apiGet(path, params) {
  var url = CONFIG.apiBase + path;
  if (params) {
    var qs = Object.keys(params).map(function(k) {
      var v = params[k];
      if (Array.isArray(v)) {
        return v.map(function(i) { return encodeURIComponent(k+'[]')+'='+encodeURIComponent(i); }).join('&');
      }
      return encodeURIComponent(k)+'='+encodeURIComponent(v);
    }).join('&');
    if (qs) url += '?' + qs;
  }
  return fetch(url, {
    headers: { 'Authorization': 'Bearer ' + CONFIG.partnerToken, 'Accept': 'application/vnd.api.v2+json' }
  }).then(function(r) { return r.json(); });
}

function apiPost(path, body) {
  return fetch(CONFIG.apiBase + path, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.partnerToken,
      'Accept':        'application/vnd.api.v2+json',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  }).then(function(r) { return r.json(); });
}

// ── CSS ────────────────────────────────────────────────────────
var css = `
#crocus-fab{position:fixed;bottom:28px;right:28px;z-index:2147483638;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#7B2D4E 0%,#5a1e37 100%);color:#fff;border:none;border-radius:50px;padding:14px 22px 14px 18px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;letter-spacing:.03em;cursor:pointer;box-shadow:0 8px 32px rgba(123,45,78,.55),0 2px 8px rgba(0,0,0,.25);transition:transform .2s,box-shadow .2s;animation:fabIn .5s cubic-bezier(.34,1.56,.64,1) both}
#crocus-fab:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 14px 40px rgba(123,45,78,.65)}
#crocus-fab:active{transform:scale(.97)}
@keyframes fabIn{from{opacity:0;transform:translateY(20px) scale(.85)}to{opacity:1;transform:translateY(0) scale(1)}}
#crocus-backdrop{display:none;position:fixed;inset:0;z-index:2147483639;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);opacity:0;transition:opacity .25s}
#crocus-backdrop.open{display:block}
#crocus-backdrop.visible{opacity:1}
#crocus-modal{position:fixed;top:0;right:0;z-index:2147483640;width:420px;max-width:100vw;height:100dvh;background:#0f0a0d;border-radius:20px 0 0 20px;box-shadow:-8px 0 60px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;transform:translateX(100%);transition:transform .32s cubic-bezier(.32,.72,0,1)}
#crocus-modal.open{transform:translateX(0)}
@media(max-width:480px){#crocus-modal{width:100vw;border-radius:20px 20px 0 0;height:100dvh;transform:translateY(100%)}#crocus-modal.open{transform:translateY(0)}#crocus-fab{bottom:20px;right:16px}}
#crocus-modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;border-bottom:1px solid rgba(201,168,124,.12);background:rgba(255,255,255,.02);flex-shrink:0}
.crocus-modal-brand{display:flex;align-items:center;gap:10px}
.crocus-modal-logo{width:38px;height:38px;border-radius:9px;object-fit:cover;border:1px solid rgba(201,168,124,.22)}
.crocus-modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:400;color:#fdfaf8;letter-spacing:.02em;display:block}
.crocus-modal-sub{font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:rgba(253,250,248,.38);letter-spacing:.08em;text-transform:uppercase;display:block}
#crocus-close{width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:rgba(253,250,248,.55);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
#crocus-close:hover{background:rgba(255,255,255,.10);color:#fdfaf8}
#crocus-progress{display:flex;align-items:center;justify-content:center;padding:13px 20px 10px;gap:0;border-bottom:1px solid rgba(255,255,255,.04);flex-shrink:0}
.cp-step{display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;flex:1}
.cp-dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);color:rgba(253,250,248,.30);transition:all .25s}
.cp-step.active .cp-dot{background:#7B2D4E;border-color:#7B2D4E;color:#fff;box-shadow:0 0 14px rgba(123,45,78,.55)}
.cp-step.done .cp-dot{background:rgba(201,168,124,.15);border-color:#c9a87c;color:#c9a87c}
.cp-label{font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:rgba(253,250,248,.28);font-family:'DM Sans',sans-serif}
.cp-step.active .cp-label,.cp-step.done .cp-label{color:rgba(253,250,248,.65)}
.cp-step.done .cp-label{color:#c9a87c}
.cp-line{position:absolute;top:11px;left:calc(50% + 14px);right:calc(-50% + 14px);height:1px;background:rgba(255,255,255,.07);z-index:0;transition:background .3s}
.cp-line.filled{background:rgba(201,168,124,.30)}
#crocus-body{flex:1;overflow-y:auto;padding:18px 18px 24px;scrollbar-width:thin;scrollbar-color:rgba(123,45,78,.30) transparent}
#crocus-body::-webkit-scrollbar{width:4px}
#crocus-body::-webkit-scrollbar-thumb{background:rgba(123,45,78,.35);border-radius:4px}
.cw-step{display:none;animation:stepIn .22s ease-out both}
.cw-step.active{display:block}
@keyframes stepIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
.cw-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:300;color:#fdfaf8;letter-spacing:-.02em;margin:0 0 4px}
.cw-sub{font-family:'DM Sans',sans-serif;font-size:12.5px;color:rgba(253,250,248,.42);margin:0 0 16px}
.cw-sub strong{color:#c9a87c;font-weight:500}
.cw-nav{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.cw-back{background:none;border:none;color:rgba(253,250,248,.38);font-family:'DM Sans',sans-serif;font-size:12.5px;cursor:pointer;padding:0;transition:color .15s}
.cw-back:hover{color:#c9a87c}
/* Loading spinner */
.cw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 0;gap:12px}
.cw-spinner{width:32px;height:32px;border:2px solid rgba(123,45,78,.20);border-top-color:#7B2D4E;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.cw-loader-text{font-family:'DM Sans',sans-serif;font-size:12px;color:rgba(253,250,248,.30)}
.cw-error{background:rgba(248,113,113,.07);border:1px solid rgba(248,113,113,.20);border-radius:12px;padding:14px;text-align:center;font-family:'DM Sans',sans-serif;font-size:13px;color:#fca5a5;margin-top:16px}
/* Services */
.cw-services{display:flex;flex-direction:column;gap:10px;margin-top:14px}
.cw-service{display:flex;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;cursor:pointer;text-align:left;color:inherit;width:100%;transition:all .2s;font-family:inherit}
.cw-service:hover{border-color:rgba(123,45,78,.45);background:rgba(123,45,78,.07);transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.35)}
.cw-svc-img{width:90px;min-height:90px;flex-shrink:0;position:relative;overflow:hidden;background:#1a0f15}
.cw-svc-img img{width:100%;height:100%;object-fit:cover;filter:brightness(.72) saturate(.8)}
.cw-svc-badge{position:absolute;bottom:5px;left:5px;background:rgba(123,45,78,.85);color:#fdfaf8;font-size:8.5px;font-weight:600;letter-spacing:.05em;padding:2px 7px;border-radius:20px}
.cw-svc-body{padding:11px 13px;display:flex;flex-direction:column;gap:3px;flex:1}
.cw-svc-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-weight:400;color:#fdfaf8}
.cw-svc-desc{font-size:11px;color:rgba(253,250,248,.40);line-height:1.45}
.cw-svc-foot{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:5px}
.cw-svc-dur{font-size:10.5px;color:rgba(253,250,248,.32)}
.cw-svc-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-weight:300;color:#c9a87c}
/* Masters */
.cw-masters{display:flex;flex-direction:column;gap:9px}
.cw-master{display:flex;align-items:flex-start;gap:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:13px;cursor:pointer;text-align:left;color:inherit;width:100%;transition:all .2s;font-family:inherit}
.cw-master:hover{background:rgba(255,255,255,.05);border-color:rgba(201,168,124,.25);transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.40)}
.cw-master-any{border-color:rgba(201,168,124,.18);background:rgba(201,168,124,.05)}
.cw-master-any:hover{border-color:rgba(201,168,124,.38);background:rgba(201,168,124,.09)}
.cw-any-icon{width:42px;height:42px;border-radius:50%;background:rgba(201,168,124,.12);border:1px solid rgba(201,168,124,.25);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.cw-any-info{flex:1}
.cw-any-title{font-size:13.5px;font-weight:500;color:#c9a87c;margin-bottom:2px;font-family:'DM Sans',sans-serif}
.cw-any-sub{font-size:11px;color:rgba(253,250,248,.38);font-family:'DM Sans',sans-serif}
.cw-any-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;color:#c9a87c;align-self:center}
.cw-master-photo{width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.07);background:#1a0f15}
.cw-master-body{flex:1;display:flex;flex-direction:column;gap:3px}
.cw-master-top{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.cw-master-name{font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;color:#fdfaf8}
.cw-lvl-badge{font-family:'DM Sans',sans-serif;font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:20px}
.cw-master-bio{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(253,250,248,.36);line-height:1.4}
.cw-master-foot{display:flex;justify-content:space-between;align-items:center;margin-top:3px}
.cw-master-next{font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(253,250,248,.35)}
.cw-master-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:21px;font-weight:300}
/* Calendar */
.cw-calendar{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;margin-top:4px}
.cw-cal-nav{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05)}
.cw-cal-nav span{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:300;color:#fdfaf8}
.cw-cal-nav button{background:none;border:none;color:rgba(253,250,248,.45);font-size:18px;cursor:pointer;padding:3px 7px;border-radius:6px;transition:all .15s;line-height:1}
.cw-cal-nav button:hover{background:rgba(255,255,255,.06);color:#fdfaf8}
.cw-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:8px 8px 10px}
.cw-dow{text-align:center;font-family:'DM Sans',sans-serif;font-size:9.5px;font-weight:600;letter-spacing:.05em;color:rgba(253,250,248,.22);padding:3px 0;text-transform:uppercase}
.cw-day{aspect-ratio:1;border-radius:7px;border:none;background:none;color:rgba(253,250,248,.60);font-family:'DM Sans',sans-serif;font-size:12.5px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center}
.cw-day.past,.cw-day.unavail{color:rgba(253,250,248,.13);cursor:default;pointer-events:none}
.cw-day.avail:hover{background:rgba(123,45,78,.25);color:#fdfaf8}
.cw-day.sel{background:#7B2D4E;color:#fff;box-shadow:0 0 14px rgba(123,45,78,.50)}
.cw-day.avail{position:relative}
.cw-day.avail::after{content:'';position:absolute;bottom:3px;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:#7B2D4E;opacity:.6}
.cw-day.sel::after{background:#fff}
.cw-times-title{font-family:'DM Sans',sans-serif;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(253,250,248,.32);margin:16px 0 9px}
.cw-time-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cw-time{padding:8px 4px;border-radius:9px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);color:rgba(253,250,248,.65);font-family:'DM Sans',sans-serif;font-size:12.5px;cursor:pointer;transition:all .15s;text-align:center}
.cw-time.free:hover{border-color:rgba(123,45,78,.45);background:rgba(123,45,78,.15);color:#fdfaf8}
.cw-time.sel{background:#7B2D4E;border-color:#7B2D4E;color:#fff;box-shadow:0 0 12px rgba(123,45,78,.45)}
/* Summary + Form */
.cw-summary{background:rgba(255,255,255,.03);border:1px solid rgba(201,168,124,.13);border-radius:13px;padding:13px 15px;margin-bottom:18px;display:flex;flex-direction:column;gap:9px}
.cw-sum-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cw-sum-row span{font-family:'DM Sans',sans-serif;font-size:11.5px;color:rgba(253,250,248,.36)}
.cw-sum-row strong{font-family:'DM Sans',sans-serif;font-size:13px;color:#fdfaf8;font-weight:500}
.cw-sum-price strong{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:300}
.cw-sum-lvl{font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:20px;background:rgba(255,255,255,.06)}
.cw-form{display:flex;flex-direction:column;gap:13px}
.cw-field{display:flex;flex-direction:column;gap:5px}
.cw-field label{font-family:'DM Sans',sans-serif;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:rgba(253,250,248,.40)}
.cw-field input{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:11px 13px;color:#fdfaf8;font-family:'DM Sans',sans-serif;font-size:14.5px;outline:none;transition:border-color .15s;width:100%;box-sizing:border-box}
.cw-field input::placeholder{color:rgba(253,250,248,.20)}
.cw-field input:focus{border-color:rgba(123,45,78,.55);background:rgba(123,45,78,.05)}
.cw-btn-confirm{background:linear-gradient(135deg,#7B2D4E 0%,#5a1e37 100%);color:#fff;border:none;border-radius:11px;padding:15px 24px;width:100%;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;letter-spacing:.04em;cursor:pointer;transition:all .2s;box-shadow:0 6px 22px rgba(123,45,78,.40);margin-top:4px}
.cw-btn-confirm:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 30px rgba(123,45,78,.55)}
.cw-btn-confirm:disabled{opacity:.55;cursor:default}
.cw-form-note{font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(253,250,248,.25);text-align:center;line-height:1.5;margin-top:-4px}
.cw-consent{display:flex;align-items:flex-start;gap:9px;cursor:pointer}
.cw-consent input[type=checkbox]{margin-top:3px;flex-shrink:0;width:15px;height:15px;accent-color:#7B2D4E;cursor:pointer}
.cw-consent span{font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(253,250,248,.40);line-height:1.55}
.cw-consent a{color:rgba(201,168,124,.70);text-decoration:underline}
.cw-consent a:hover{color:#c9a87c}
/* Success */
.cw-success{display:flex;flex-direction:column;align-items:center;text-align:center;padding:36px 16px;gap:14px}
.cw-success-icon{width:60px;height:60px;border-radius:50%;background:rgba(201,168,124,.10);border:1px solid rgba(201,168,124,.32);display:flex;align-items:center;justify-content:center;font-size:26px;color:#c9a87c;margin-bottom:6px}
.cw-success h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:300;color:#fdfaf8;margin:0}
.cw-success p{font-family:'DM Sans',sans-serif;font-size:13.5px;color:rgba(253,250,248,.55);line-height:1.6;margin:0}
.cw-success p strong{color:#fdfaf8;font-weight:500}
.cw-success-note{font-size:11.5px!important;color:rgba(253,250,248,.30)!important}
.cw-btn-new{background:rgba(255,255,255,.05);color:rgba(253,250,248,.65);border:1px solid rgba(255,255,255,.10);border-radius:10px;padding:11px 22px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;transition:all .15s;margin-top:6px}
.cw-btn-new:hover{background:rgba(255,255,255,.09);color:#fdfaf8}
body.crocus-open .t-header,body.crocus-open header{z-index:1!important;position:relative!important}
`;

// ── Inject styles + fonts ──────────────────────────────────────
var styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);

var fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500;600&display=swap';
document.head.appendChild(fontLink);

// ── Inject HTML ────────────────────────────────────────────────
var MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
var DAYS   = ['Mo','Di','Mi','Do','Fr','Sa','So'];

var wrap = document.createElement('div');
wrap.innerHTML =
  '<button id="crocus-fab"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Termin buchen</button>'
  + '<div id="crocus-backdrop"></div>'
  + '<div id="crocus-modal">'
    + '<div id="crocus-modal-header">'
      + '<div class="crocus-modal-brand">'
        + '<img class="crocus-modal-logo" src="https://static.tildacdn.com/tild3466-6662-4234-b863-376638653730/ChatGPT_Image_16__20.png" alt="Crocus">'
        + '<div><span class="crocus-modal-title">Crocus Beauty Studio</span><span class="crocus-modal-sub">Göppingen · Online-Buchung</span></div>'
      + '</div>'
      + '<button id="crocus-close">✕</button>'
    + '</div>'
    + '<div id="crocus-progress">'
      + '<div class="cp-step active" id="cp1"><div class="cp-dot">1</div><span class="cp-label">Dienst</span></div>'
      + '<div class="cp-line" id="cpline1"></div>'
      + '<div class="cp-step" id="cp2"><div class="cp-dot">2</div><span class="cp-label">Meister</span></div>'
      + '<div class="cp-line" id="cpline2"></div>'
      + '<div class="cp-step" id="cp3"><div class="cp-dot">3</div><span class="cp-label">Termin</span></div>'
      + '<div class="cp-line" id="cpline3"></div>'
      + '<div class="cp-step" id="cp4"><div class="cp-dot">4</div><span class="cp-label">Kontakt</span></div>'
    + '</div>'
    + '<div id="crocus-body">'
      // Step 1 — Services
      + '<div class="cw-step active" id="cw-step1">'
        + '<h2 class="cw-title">Welche Behandlung?</h2>'
        + '<div id="cw-services-list"></div>'
      + '</div>'
      // Step 2 — Masters
      + '<div class="cw-step" id="cw-step2">'
        + '<div class="cw-nav"><button class="cw-back" id="cw-back1">← Zurück</button></div>'
        + '<h2 class="cw-title">Wähle deinen Meister</h2>'
        + '<p class="cw-sub">für <strong id="cw-selected-svc-name"></strong></p>'
        + '<div id="cw-masters-list"></div>'
      + '</div>'
      // Step 3 — Date/Time
      + '<div class="cw-step" id="cw-step3">'
        + '<div class="cw-nav"><button class="cw-back" id="cw-back2">← Zurück</button></div>'
        + '<h2 class="cw-title">Datum &amp; Uhrzeit</h2>'
        + '<p class="cw-sub" id="cw-step3-sub"></p>'
        + '<div class="cw-calendar">'
          + '<div class="cw-cal-nav"><button id="cw-cal-prev">‹</button><span id="cw-cal-title"></span><button id="cw-cal-next">›</button></div>'
          + '<div class="cw-cal-grid" id="cw-cal-grid"></div>'
        + '</div>'
        + '<div id="cw-times-wrap" style="display:none">'
          + '<div class="cw-times-title">Verfügbare Zeiten</div>'
          + '<div class="cw-time-grid" id="cw-time-grid"></div>'
        + '</div>'
      + '</div>'
      // Step 4 — Contact
      + '<div class="cw-step" id="cw-step4">'
        + '<div class="cw-nav"><button class="cw-back" id="cw-back3">← Zurück</button></div>'
        + '<h2 class="cw-title">Deine Kontaktdaten</h2>'
        + '<div class="cw-summary" id="cw-summary"></div>'
        + '<form class="cw-form" id="cw-form">'
          + '<div class="cw-field"><label>Name</label><input type="text" id="cw-name" placeholder="Ihr Name" required></div>'
          + '<div class="cw-field"><label>Telefon / WhatsApp</label><input type="tel" id="cw-phone" placeholder="+49 172 …" required></div>'
          + '<div class="cw-field"><label>E-Mail</label><input type="email" id="cw-email" placeholder="name@email.de" required></div>'
          + '<label class="cw-consent"><input type="checkbox" id="cw-consent" required> <span>Ich stimme der <a href="https://crocus-studio.de/datenschutz" target="_blank">Datenschutzerklärung</a> zu und bin einverstanden, dass meine Daten zur Terminverarbeitung gespeichert werden.</span></label>'
          + '<button type="submit" class="cw-btn-confirm" id="cw-btn-submit">Termin bestätigen →</button>'
          + '<p class="cw-form-note">Keine Vorauszahlung · Kostenlose Stornierung bis 24h vorher.</p>'
        + '</form>'
      + '</div>'
      // Success
      + '<div class="cw-step" id="cw-success">'
        + '<div class="cw-success">'
          + '<div class="cw-success-icon">✓</div>'
          + '<h2>Termin bestätigt!</h2>'
          + '<p id="cw-success-text"></p>'
          + '<p class="cw-success-note">Wir freuen uns auf Sie.<br>Bestätigung per SMS / WhatsApp.</p>'
          + '<button class="cw-btn-new" id="cw-btn-new">Neuen Termin buchen</button>'
        + '</div>'
      + '</div>'
    + '</div>'
  + '</div>';
document.body.appendChild(wrap);

// ── State ──────────────────────────────────────────────────────
var cw = {
  step: 1,
  service: null,       // { id, title, price_min, price_max, seance_length }
  master: null,        // { id, name, specialization, avatar } | 'any'
  date: null,          // 'YYYY-MM-DD'
  time: null,          // 'HH:MM'
  datetime: null,      // ISO string from Altegio
  calY: new Date().getFullYear(),
  calM: new Date().getMonth(),
  availDates: [],      // ['YYYY-MM-DD', ...]
  loadingDates: false,
  loadingTimes: false,
};

// Cache
var _servicesCache = null;
var _mastersCache  = {};  // keyed by service_id

// ── Open / Close ───────────────────────────────────────────────
function crocusOpen() {
  document.getElementById('crocus-backdrop').classList.add('open');
  document.body.classList.add('crocus-open');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(function () {
    document.getElementById('crocus-backdrop').classList.add('visible');
    document.getElementById('crocus-modal').classList.add('open');
  });
  if (!_servicesCache) loadServices();
}

function crocusClose() {
  document.getElementById('crocus-backdrop').classList.remove('visible');
  document.getElementById('crocus-modal').classList.remove('open');
  document.body.classList.remove('crocus-open');
  setTimeout(function () {
    document.getElementById('crocus-backdrop').classList.remove('open');
    document.body.style.overflow = '';
  }, 320);
}

// ── Progress ───────────────────────────────────────────────────
function updateProgress(n) {
  [1, 2, 3, 4].forEach(function (i) {
    var el = document.getElementById('cp' + i);
    var line = document.getElementById('cpline' + i);
    el.classList.remove('active', 'done');
    var threshold = (n === 'success') ? 5 : n;
    if (threshold > i) {
      el.classList.add('done');
      if (line) line.classList.add('filled');
    } else if (i === n) {
      el.classList.add('active');
    } else {
      if (line) line.classList.remove('filled');
    }
    el.querySelector('.cp-dot').innerHTML = el.classList.contains('done') ? '✓' : i;
  });
}

function goStep(n) {
  cw.step = n;
  document.querySelectorAll('.cw-step').forEach(function (el) { el.classList.remove('active'); });
  var id = n === 'success' ? 'cw-success' : 'cw-step' + n;
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
  document.getElementById('crocus-body').scrollTop = 0;
  updateProgress(n);
  if (n === 2) renderMasters();
  if (n === 3) { renderCalendar(); loadAvailDates(); }
  if (n === 4) renderSummary();
}

// ── Loader helpers ─────────────────────────────────────────────
function showLoader(containerId, text) {
  document.getElementById(containerId).innerHTML =
    '<div class="cw-loader"><div class="cw-spinner"></div><span class="cw-loader-text">'+(text||'Laden...')+'</span></div>';
}

function showError(containerId, msg) {
  document.getElementById(containerId).innerHTML =
    '<div class="cw-error">'+msg+'</div>';
}

// ── STEP 1: Services ───────────────────────────────────────────
function loadServices() {
  showLoader('cw-services-list', 'Behandlungen laden…');
  apiGet('/book_services/' + CONFIG.locationId)
    .then(function (res) {
      if (!res.success) throw new Error('API error');
      _servicesCache = res.data.services || [];
      renderServices();
    })
    .catch(function () {
      showError('cw-services-list', 'Fehler beim Laden. Bitte neu laden.');
    });
}

function renderServices() {
  var list = document.getElementById('cw-services-list');
  if (!_servicesCache || !_servicesCache.length) {
    list.innerHTML = '<div class="cw-error">Keine Behandlungen gefunden.</div>';
    return;
  }

  // Service images — можно добавить свои через DATA_IMAGES объект ниже
  var SVC_IMAGES = {
    // 'title keyword' : 'url'  — матчинг по подстроке в title
    'maniküre':   'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=75',
    'manikure':   'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=75',
    'pediküre':   'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=400&q=75',
    'pedikure':   'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=400&q=75',
    'wimper':     'https://images.unsplash.com/photo-1512207846876-bb54ef5056fe?w=400&q=75',
    'kombi':      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=75',
  };

  function getImg(title) {
    var t = (title || '').toLowerCase();
    for (var key in SVC_IMAGES) {
      if (t.indexOf(key) !== -1) return SVC_IMAGES[key];
    }
    return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=75';
  }

  list.innerHTML = '';
  _servicesCache.forEach(function (s) {
    var minP = s.price_min || 0;
    var maxP = s.price_max || 0;
    var priceStr = minP === maxP
      ? (minP ? minP + ' €' : 'ab Anfrage')
      : 'ab ' + minP + ' €';
    var durMin = Math.round((s.seance_length || 3600) / 60);
    var img = getImg(s.title);

    var btn = document.createElement('button');
    btn.className = 'cw-service';
    btn.innerHTML =
      '<div class="cw-svc-img"><img src="'+img+'" alt="'+s.title+'" loading="lazy"></div>'
      + '<div class="cw-svc-body">'
        + '<div class="cw-svc-name">'+s.title+'</div>'
        + '<div class="cw-svc-desc">'+(s.comment||'')+'</div>'
        + '<div class="cw-svc-foot">'
          + '<span class="cw-svc-dur">⏱ '+durMin+' Min</span>'
          + '<span class="cw-svc-price">'+priceStr+'</span>'
        + '</div>'
      + '</div>';
    btn.addEventListener('click', function () { selectService(s); });
    list.appendChild(btn);
  });
}

function selectService(s) {
  cw.service = s;
  cw.master = null; cw.date = null; cw.time = null;
  document.getElementById('cw-selected-svc-name').textContent = s.title;
  goStep(2);
}

// ── STEP 2: Masters ────────────────────────────────────────────
function renderMasters() {
  var listEl = document.getElementById('cw-masters-list');
  if (_mastersCache[cw.service.id]) {
    _renderMastersList(_mastersCache[cw.service.id]);
    return;
  }
  showLoader('cw-masters-list', 'Meister laden…');
  apiGet('/book_staff/' + CONFIG.locationId, { service_ids: [cw.service.id] })
    .then(function (res) {
      if (!res.success) throw new Error();
      _mastersCache[cw.service.id] = res.data || [];
      _renderMastersList(_mastersCache[cw.service.id]);
    })
    .catch(function () { showError('cw-masters-list', 'Fehler beim Laden der Meister.'); });
}

function _renderMastersList(masters) {
  var listEl = document.getElementById('cw-masters-list');
  listEl.innerHTML = '';

  // "Любой мастер" кнопка
  var anyBtn = document.createElement('button');
  anyBtn.className = 'cw-master cw-master-any';
  anyBtn.innerHTML =
    '<div class="cw-any-icon">⚡</div>'
    + '<div class="cw-any-info">'
      + '<div class="cw-any-title">Nächster freier Termin</div>'
      + '<div class="cw-any-sub">Automatische Zuweisung · Schnellster Termin</div>'
    + '</div>'
    + '<div class="cw-any-price">ab '+(cw.service.price_min||'?')+' €</div>';
  anyBtn.addEventListener('click', function () { selectMaster('any', null); });
  listEl.appendChild(anyBtn);

  masters.forEach(function (m) {
    // Специализация → уровень
    var spec = m.specialization || '';
    var lvlKey = null;
    Object.keys(CONFIG.levels).forEach(function(k) {
      if (spec.toLowerCase().indexOf(k.toLowerCase()) !== -1) lvlKey = k;
    });
    var lv = CONFIG.levels[lvlKey || CONFIG.defaultLevel];

    var btn = document.createElement('button');
    btn.className = 'cw-master';
    btn.innerHTML =
      '<img class="cw-master-photo" src="'+(m.avatar||'')+'" alt="'+m.name+'" loading="lazy" onerror="this.src=\'https://app.alteg.io/images/no-master.png\'">'
      + '<div class="cw-master-body">'
        + '<div class="cw-master-top">'
          + '<span class="cw-master-name">'+m.name+'</span>'
          + '<span class="cw-lvl-badge" style="color:'+lv.color+';background:'+lv.bg+';border:1px solid '+lv.border+'">'+(lvlKey||CONFIG.defaultLevel)+'</span>'
        + '</div>'
        + '<div style="font-size:10px;color:'+lv.color+';font-family:DM Sans,sans-serif">'+lv.desc+'</div>'
        + (m.information ? '<div class="cw-master-bio">'+m.information.replace(/<[^>]+>/g,'').slice(0,80)+'</div>' : '')
        + '<div class="cw-master-foot">'
          + (m.seance_date ? '<span class="cw-master-next">🕐 ab '+m.seance_date+'</span>' : '<span class="cw-master-next">Verfügbar</span>')
        + '</div>'
      + '</div>';
    btn.addEventListener('click', function () { selectMaster(m.id, m); });
    listEl.appendChild(btn);
  });

  if (!masters.length) {
    listEl.innerHTML += '<div class="cw-error">Keine Meister für diese Behandlung verfügbar.</div>';
  }
}

function selectMaster(id, masterObj) {
  cw.master = id === 'any' ? 'any' : masterObj;
  cw.date = null; cw.time = null;
  var name = id === 'any' ? 'Nächster freier' : masterObj.name;
  document.getElementById('cw-step3-sub').innerHTML =
    cw.service.title + ' · <strong style="color:#fdfaf8">' + name + '</strong>';
  goStep(3);
}

// ── STEP 3: Calendar + Times ───────────────────────────────────
function loadAvailDates() {
  cw.availDates = [];
  cw.loadingDates = true;
  var staffId = (cw.master && cw.master !== 'any') ? cw.master.id : null;
  var params = { service_ids: [cw.service.id] };
  if (staffId) params.staff_id = staffId;

  var firstDay = new Date(cw.calY, cw.calM, 1).toISOString().split('T')[0];
  params.date = firstDay;

  apiGet('/book_dates/' + CONFIG.locationId, params)
    .then(function (res) {
      cw.loadingDates = false;
      if (res.success && res.data && res.data.booking_dates) {
        cw.availDates = res.data.booking_dates;
      }
      renderCalendar();
    })
    .catch(function () { cw.loadingDates = false; renderCalendar(); });
}

function renderCalendar() {
  document.getElementById('cw-cal-title').textContent = MONTHS[cw.calM] + ' ' + cw.calY;
  var grid = document.getElementById('cw-cal-grid');
  var today = new Date().toISOString().split('T')[0];
  var daysInMonth = new Date(cw.calY, cw.calM + 1, 0).getDate();
  var firstWeekDay = (new Date(cw.calY, cw.calM, 1).getDay() + 6) % 7; // 0=Mon

  grid.innerHTML = '';
  DAYS.forEach(function (d) {
    var el = document.createElement('div');
    el.className = 'cw-dow'; el.textContent = d;
    grid.appendChild(el);
  });
  for (var i = 0; i < firstWeekDay; i++) grid.appendChild(document.createElement('div'));

  for (var d = 1; d <= daysInMonth; d++) {
    var ds = cw.calY + '-' + String(cw.calM + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var isPast = ds < today;
    var isAvail = cw.availDates.indexOf(ds) !== -1;
    var isSel = cw.date === ds;
    var btn = document.createElement('button');
    btn.className = 'cw-day ' + (isPast ? 'past' : (isAvail ? 'avail' : 'unavail')) + (isSel ? ' sel' : '');
    btn.textContent = d;
    btn.disabled = isPast || !isAvail;
    if (!isPast && isAvail) {
      (function (ds) { btn.addEventListener('click', function () { selectDate(ds); }); })(ds);
    }
    grid.appendChild(btn);
  }

  document.getElementById('cw-times-wrap').style.display = cw.date ? 'block' : 'none';
  if (cw.date) renderTimes();
}

function selectDate(ds) {
  cw.date = ds; cw.time = null;
  document.getElementById('cw-times-wrap').style.display = 'block';
  renderCalendar();
  loadTimes();
}

function loadTimes() {
  var timeGrid = document.getElementById('cw-time-grid');
  timeGrid.innerHTML = '<div class="cw-loader" style="padding:20px 0"><div class="cw-spinner"></div></div>';
  var staffId = (cw.master && cw.master !== 'any') ? cw.master.id : 0;
  apiGet('/book_times/' + CONFIG.locationId + '/' + staffId + '/' + cw.date, {
    service_ids: [cw.service.id]
  })
    .then(function (res) {
      if (!res.success) throw new Error();
      renderTimes(res.data || []);
    })
    .catch(function () {
      timeGrid.innerHTML = '<div class="cw-error">Keine Zeiten verfügbar.</div>';
    });
}

function renderTimes(slots) {
  var grid = document.getElementById('cw-time-grid');
  if (!slots || !slots.length) {
    grid.innerHTML = '<div class="cw-error" style="grid-column:span 4">Keine freien Zeiten.</div>';
    return;
  }
  grid.innerHTML = '';
  slots.forEach(function (slot) {
    var isSel = cw.time === slot.time;
    var btn = document.createElement('button');
    btn.className = 'cw-time free' + (isSel ? ' sel' : '');
    btn.textContent = slot.time;
    btn.addEventListener('click', function () {
      cw.time = slot.time;
      cw.datetime = slot.datetime;
      renderTimes(slots);
      setTimeout(function () { goStep(4); }, 180);
    });
    grid.appendChild(btn);
  });
}

// ── STEP 4: Summary + Submit ───────────────────────────────────
function renderSummary() {
  var m = cw.master;
  var lv = null;
  if (m && m !== 'any') {
    var spec = m.specialization || '';
    var lvlKey = null;
    Object.keys(CONFIG.levels).forEach(function(k) {
      if (spec.toLowerCase().indexOf(k.toLowerCase()) !== -1) lvlKey = k;
    });
    lv = CONFIG.levels[lvlKey || CONFIG.defaultLevel];
  }
  var dateStr = cw.date
    ? new Date(cw.date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })
    : '';
  var priceMin = cw.service.price_min || 0;
  var priceMax = cw.service.price_max || 0;
  var priceStr = priceMin === priceMax ? priceMin + ' €' : 'ab ' + priceMin + ' €';

  document.getElementById('cw-summary').innerHTML =
    '<div class="cw-sum-row"><span>Behandlung</span><strong>' + cw.service.title + '</strong></div>'
    + '<div class="cw-sum-row"><span>Meisterin</span><strong>' + (m === 'any' ? 'Nächste freie' : m.name) + '</strong>'
      + (lv ? '<span class="cw-sum-lvl" style="color:'+lv.color+'">'+( Object.keys(CONFIG.levels).find(function(k){return CONFIG.levels[k]===lv;})||'')+'</span>' : '')
    + '</div>'
    + '<div class="cw-sum-row"><span>Datum &amp; Zeit</span><strong>' + dateStr + ', ' + cw.time + ' Uhr</strong></div>'
    + '<div class="cw-sum-row cw-sum-price"><span>Preis</span><strong style="color:#c9a87c">' + priceStr + '</strong></div>';
}

function submitBooking(e) {
  e.preventDefault();
  var name  = document.getElementById('cw-name').value.trim();
  var phone = document.getElementById('cw-phone').value.trim();
  var email = document.getElementById('cw-email').value.trim();
  var consent = document.getElementById('cw-consent').checked;

  if (!name || !phone || !email || !consent) return;

  // Валидация телефона — только цифры/+/пробелы/дефисы, мин 7 цифр
  var digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    var errEl = document.createElement('p');
    errEl.style.cssText = 'color:#fca5a5;font-size:12px;text-align:center;margin:4px 0 0;font-family:DM Sans,sans-serif';
    errEl.textContent = 'Bitte gültige Telefonnummer eingeben (z.B. +49 172 123456)';
    errEl.className = 'cw-error-msg';
    var old = document.getElementById('cw-form').querySelector('.cw-error-msg');
    if (old) old.remove();
    document.getElementById('cw-form').appendChild(errEl);
    return;
  }

  var btn = document.getElementById('cw-btn-submit');
  btn.disabled = true;
  btn.textContent = 'Wird gesendet…';

  var staffId = (cw.master && cw.master !== 'any') ? cw.master.id : 0;
  var body = {
    phone:    phone,
    fullname: name,
    email:    email,
    appointments: [{
      id:       1,
      services: [cw.service.id],
      staff_id: staffId,
      datetime: cw.datetime,
    }]
  };

  apiPost('/book_record/' + CONFIG.locationId, body)
    .then(function (res) {
      if (!res.success) throw new Error(res.message || 'Buchungsfehler');
      var m = cw.master;
      var dateStr = cw.date
        ? new Date(cw.date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
        : '';
      document.getElementById('cw-success-text').innerHTML =
        '<strong>' + cw.service.title + '</strong> bei <strong>' + (m === 'any' ? 'nächster freier Meisterin' : m.name) + '</strong><br>'
        + dateStr + ', ' + cw.time + ' Uhr';
      goStep('success');
      document.getElementById('crocus-progress').style.display = 'none';
    })
    .catch(function (err) {
      btn.disabled = false;
      btn.textContent = 'Termin bestätigen →';
      var errEl = document.createElement('p');
      errEl.style.cssText = 'color:#fca5a5;font-size:12px;text-align:center;margin:4px 0 0;font-family:DM Sans,sans-serif';
      errEl.textContent = err.message || 'Fehler. Bitte erneut versuchen.';
      var old = document.getElementById('cw-form').querySelector('.cw-error-msg');
      if (old) old.remove();
      errEl.className = 'cw-error-msg';
      document.getElementById('cw-form').appendChild(errEl);
    });
}

// ── Calendar nav ───────────────────────────────────────────────
function calPrev() {
  if (cw.calM === 0) { cw.calM = 11; cw.calY--; } else cw.calM--;
  cw.date = null; cw.time = null;
  renderCalendar();
  loadAvailDates();
}
function calNext() {
  if (cw.calM === 11) { cw.calM = 0; cw.calY++; } else cw.calM++;
  cw.date = null; cw.time = null;
  renderCalendar();
  loadAvailDates();
}

// ── Reset ──────────────────────────────────────────────────────
function crocusReset() {
  cw = { step:1, service:null, master:null, date:null, time:null, datetime:null,
         calY: new Date().getFullYear(), calM: new Date().getMonth(),
         availDates: [], loadingDates: false, loadingTimes: false };
  document.getElementById('crocus-progress').style.display = 'flex';
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-step1').classList.add('active');
  updateProgress(1);
  if (_servicesCache) renderServices();
  else loadServices();
  document.getElementById('crocus-body').scrollTop = 0;
}

// ── Event listeners ────────────────────────────────────────────
document.getElementById('crocus-fab').addEventListener('click', crocusOpen);
document.getElementById('crocus-backdrop').addEventListener('click', crocusClose);
document.getElementById('crocus-close').addEventListener('click', crocusClose);
document.getElementById('cw-back1').addEventListener('click', function(){ goStep(1); });
document.getElementById('cw-back2').addEventListener('click', function(){ goStep(2); });
document.getElementById('cw-back3').addEventListener('click', function(){ goStep(3); });
document.getElementById('cw-cal-prev').addEventListener('click', calPrev);
document.getElementById('cw-cal-next').addEventListener('click', calNext);
document.getElementById('cw-btn-new').addEventListener('click', crocusReset);
document.getElementById('cw-form').addEventListener('submit', submitBooking);
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') crocusClose(); });

})();
