(function () {
'use strict';

// ── CONFIG ─────────────────────────────────────────────────────
var CONFIG = {
  partnerToken: 'u8xzkdpkgfc73uektn64',
  locationId:   '1357963',
  apiBase:      'https://api.alteg.io/api/v1',
  lang: 'de',
};

// ── Masters — описания и уровни ────────────────────────────────
var MASTERS_META = {
  3020185: {
    level:  'Top Master',
    levelColor:  '#8b6914',
    levelBg:     'rgba(139,105,20,0.13)',
    levelBorder: 'rgba(139,105,20,0.35)',
    tagline: 'Maniküre & Pediküre',
    bio: 'Unsere erfahrenste Meisterin — präzise, kreativ und immer ausgebucht.',
    skills: ['Maniküre', 'Pediküre', 'Nagelverlängerung', 'Designs'],
    cats: ['manikuere', 'pediküre', 'kombi'],
    avatar: 'https://static.tildacdn.com/tild3239-3933-4334-b362-386430646432/ChatGPT_Image_28__20.png',
  },
};

// ── Категории и маппинг услуг ──────────────────────────────────
var CATEGORIES = [
  {
    key: 'manikuere',
    label: 'Maniküre',
    img: 'https://static.tildacdn.net/tild3038-3034-4734-a332-616564343331/close-up-image-woman.jpg',
    desc: 'Gepflegte Hände, perfekter Gellack — vom Klassiker bis zur Verlängerung.',
    serviceIds: [13485752, 13485753, 13485754, 13485755],
  },
  {
    key: 'pediküre',
    label: 'Pediküre',
    img: 'https://static.tildacdn.net/tild3365-3762-4732-b839-623466663935/ChatGPT_Image_5__202.png',
    desc: 'Verwöhnprogramm für die Füße — hygienisch, gründlich, entspannend.',
    serviceIds: [13485760, 13485761],
  },
  {
    key: 'kombi',
    label: 'Kombi',
    img: 'https://static.tildacdn.net/tild3838-3839-4266-b532-353835363261/33.jpg',
    desc: 'Maniküre & Pediküre in einem Termin — Zeit sparen, doppelt strahlen.',
    serviceIds: [13485762],
  },
];

// Все возможные допы (French, Babyboomer, Stiletto, Design, Gel-Lack, Mandel, French Pediküre)
// Länge über 2 (13493659) и Länge über 3 (13493664) — отключены
var ADDON_IDS = [13485756, 13485757, 13485758, 13485759, 13502359, 13502360, 13502395, 13493666];

// Какие допы показывать для конкретной услуги (по service.id)
var ADDON_IDS_BY_SERVICE = {
  13485752: [],                                              // Hygienische Maniküre — нет допов
  13485753: [13485758, 13485757, 13485756, 13502359, 13502360], // Maniküre+Gel — Stiletto, Babyboomer, French, Gel-Lack, Design
  13485754: [13485756, 13485757, 13485758, 13502360, 13502395], // Nagelkorrektur — French, Babyboomer, Stiletto, Design, Mandel
  13485755: [13485758, 13485759, 13485757, 13485756, 13502360, 13502395], // Nagelverlängerung — Stiletto(Diana only), Nageldesign, Babyboomer, French, Design, Mandel
  13485760: [],                                              // Hygienische Pediküre — нет допов
  13485761: [13493666],                                      // Pediküre+Gel — только French Pediküre
  13485762: [13493666, 13485756, 13485759, 13485758, 13485757, 13502360], // Kombi — без Länge, без Mandel
};

// Mandel доступен только для этих мастеров
var MANDEL_STAFF_IDS   = []; // Morris: no mandel shape detection
var STILETTO_STAFF_IDS = [3020185];          // Diana only (Nagelverlängerung)

// ── API ────────────────────────────────────────────────────────
function apiGet(path, params) {
  var url = CONFIG.apiBase + path;
  if (params) {
    var qs = Object.keys(params).map(function(k) {
      var v = params[k];
      if (Array.isArray(v)) return v.map(function(i){ return encodeURIComponent(k+'[]')+'='+encodeURIComponent(i); }).join('&');
      return encodeURIComponent(k)+'='+encodeURIComponent(v);
    }).join('&');
    if (qs) url += '?' + qs;
  }
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, 10000);
  return fetch(url, {
    signal: ctrl.signal,
    headers: { 'Authorization': 'Bearer '+CONFIG.partnerToken, 'Accept': 'application/vnd.api.v2+json', 'Accept-Language': CONFIG.lang }
  }).then(function(r){ clearTimeout(timer); return r.json(); })
    .catch(function(e){ clearTimeout(timer); throw e; });
}

function apiPost(path, body) {
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, 10000);
  return fetch(CONFIG.apiBase + path, {
    method: 'POST',
    signal: ctrl.signal,
    headers: {
      'Authorization':    'Bearer '+CONFIG.partnerToken,
      'Accept':           'application/vnd.api.v2+json',
      'Content-Type':     'application/json',
      'Accept-Language':  CONFIG.lang,
    },
    body: JSON.stringify(body),
  }).then(function(r){ clearTimeout(timer); return r.json(); })
    .catch(function(e){ clearTimeout(timer); throw e; });
}

// ── CSS ────────────────────────────────────────────────────────
var css = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500;600&display=swap');
#morris-modal *{box-sizing:border-box;}

#morris-fab-wrap{position:fixed;bottom:32px;right:32px;z-index:2147483638;width:58px;height:58px;display:flex;align-items:center;justify-content:center}
#morris-fab{position:absolute;right:0;top:0;width:58px;height:58px;border-radius:50px;background:linear-gradient(145deg,#2a1c12 0%,#3d2b1f 100%);border:1px solid rgba(61,43,31,.13);cursor:pointer;box-shadow:0 4px 28px rgba(0,0,0,.5),inset 0 1px 0 rgba(61,43,31,.07);transition:width .5s cubic-bezier(.4,0,.2,1),border-color .3s,box-shadow .3s;animation:fabIn .7s cubic-bezier(.34,1.56,.64,1) both;overflow:hidden;display:flex;align-items:center;justify-content:flex-end;padding:0}
#morris-fab:hover{width:196px;border-color:rgba(139,105,20,.5);box-shadow:0 8px 36px rgba(61,43,31,.5),inset 0 1px 0 rgba(61,43,31,.09)}
#morris-fab:hover .morris-fab-text{opacity:1;transform:translateX(0)}
#morris-fab:hover + .morris-fab-rings .morris-fab-ring{animation-play-state:paused;opacity:0;transition:opacity .4s}
.morris-fab-icon{width:58px;height:58px;min-width:58px;flex-shrink:0;display:grid;place-items:center}
.morris-fab-icon svg{display:block}
.morris-fab-text{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;letter-spacing:.04em;color:#3d2b1f;opacity:0;transform:translateX(-8px);white-space:nowrap;transition:opacity .28s .15s,transform .28s .15s;padding-right:0;margin-right:18px;order:-1;flex-shrink:0}
#morris-fab::before{content:'';position:absolute;inset:0;border-radius:50px;background:radial-gradient(ellipse at 50% 110%,rgba(139,105,20,.12) 0%,transparent 65%);pointer-events:none}
.morris-fab-rings{position:absolute;top:50%;right:0;width:58px;height:58px;margin-top:-29px;pointer-events:none}
.morris-fab-ring{position:absolute;inset:0;border-radius:50%;animation:cwRing 3.6s ease-out infinite}
.morris-fab-ring:nth-child(1){border:1.5px solid rgba(61,43,31,.80);animation-delay:0s}
.morris-fab-ring:nth-child(2){border:1px solid rgba(61,43,31,.50);animation-delay:1.2s}
.morris-fab-ring:nth-child(3){border:1px solid rgba(139,105,20,.30);animation-delay:2.4s}
@keyframes cwRing{0%{transform:scale(1);opacity:.85}55%{opacity:.25}100%{transform:scale(2.5);opacity:0}}
@keyframes logoPulse{0%,100%{filter:drop-shadow(0 0 4px rgba(61,43,31,.55)) drop-shadow(0 0 10px rgba(61,43,31,.60))}50%{filter:drop-shadow(0 0 8px rgba(61,43,31,.90)) drop-shadow(0 0 20px rgba(61,43,31,.90))}}
@keyframes fabIn{from{opacity:0;transform:translateY(24px) scale(.78)}to{opacity:1;transform:translateY(0) scale(1)}}
#morris-fab-mobile{display:none!important}
@media(max-width:600px){
  #morris-fab-wrap{display:none!important}
  #morris-fab-mobile{display:flex!important;position:fixed;bottom:28px;right:14px;z-index:2147483638;width:52px;flex-direction:column;align-items:center;gap:4px}
  #morris-fab-mobile-btn{position:relative;z-index:1;width:38px;height:38px;min-width:38px;min-height:38px;border-radius:50%;background:linear-gradient(145deg,#2a1c12 0%,#3d2b1f 100%);border:1px solid rgba(61,43,31,.13);cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:fabIn .7s cubic-bezier(.34,1.56,.64,1) both;flex-shrink:0;padding:0;box-sizing:border-box;margin-top:6px}
  #morris-fab-mobile-btn svg{display:block}
  .cfm-ring{position:absolute;border-radius:50%;animation:cwRing 3.6s ease-out infinite}
  .cfm-ring:nth-child(1){inset:0;border:0.8px solid rgba(61,43,31,.80);animation-delay:0s}
  .cfm-ring:nth-child(2){inset:0;border:0.6px solid rgba(61,43,31,.50);animation-delay:1.2s}
  .cfm-ring:nth-child(3){inset:0;border:0.5px solid rgba(139,105,20,.30);animation-delay:2.4s}
}
#morris-backdrop{display:none;position:fixed;inset:0;z-index:2147483639;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);opacity:0;transition:opacity .25s}
#morris-backdrop.open{display:block}
#morris-backdrop.visible{opacity:1}
#morris-modal{position:fixed;top:0;right:0;z-index:2147483640;width:440px;max-width:100vw;height:100dvh;background:#f5f0e8;border-radius:20px 0 0 20px;box-shadow:-8px 0 60px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;transform:translateX(100%);transition:transform .32s cubic-bezier(.32,.72,0,1);visibility:hidden}
#morris-modal.open{visibility:visible}
#morris-modal.open{transform:translateX(0)}
@media(max-width:480px){#morris-modal{width:100vw;border-radius:20px 20px 0 0;height:100dvh;transform:translateY(100%)}#morris-modal.open{transform:translateY(0)}#morris-fab{bottom:20px;right:16px;padding:12px 18px 12px 14px;font-size:13px}}

/* Header */
#morris-modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 13px;background:rgba(61,43,31,.02);flex-shrink:0}
.morris-modal-brand{display:flex;align-items:center;gap:13px}
.morris-modal-logo{width:40px;height:40px;border-radius:10px;object-fit:contain;background:rgba(61,43,31,.15);border:1px solid rgba(61,43,31,.12);filter:drop-shadow(0 0 4px rgba(61,43,31,.55)) drop-shadow(0 0 10px rgba(61,43,31,.60));animation:logoPulse 2.8s ease-in-out infinite;padding:2px;box-sizing:border-box}
.morris-modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:400;color:#3d2b1f;letter-spacing:.02em;display:block}
.morris-modal-sub{font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:rgba(61,43,31,.35);letter-spacing:.08em;text-transform:uppercase;display:block}
#morris-close{width:32px;height:32px;border-radius:50%;border:1px solid rgba(61,43,31,.10);background:rgba(61,43,31,.05);color:rgba(61,43,31,.5);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
#morris-close:hover{background:rgba(61,43,31,.10);color:#3d2b1f}

/* Progress */
#morris-progress{display:flex;align-items:center;justify-content:center;padding:11px 20px 9px;gap:0;flex-shrink:0}
.cp-step{display:flex;flex-direction:column;align-items:center;gap:3px;position:relative;flex:1;cursor:default}.cp-step.done{cursor:pointer}.cp-step.done:hover .cp-dot{background:rgba(139,105,20,.25);border-color:#8b6914;box-shadow:0 0 10px rgba(139,105,20,.35)}.cp-step.done:hover .cp-label{color:rgba(61,43,31,.75)}
.cp-dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:600;background:rgba(61,43,31,.04);border:1px solid rgba(61,43,31,.09);color:rgba(61,43,31,.28);transition:all .25s}
.cp-step.active .cp-dot{background:#3d2b1f;border-color:#3d2b1f;color:#fff;box-shadow:0 0 12px rgba(61,43,31,.5)}
.cp-step.done .cp-dot{background:rgba(139,105,20,.13);border-color:#8b6914;color:#8b6914}
.cp-label{font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:rgba(61,43,31,.22);font-family:'DM Sans',sans-serif;white-space:nowrap}
.cp-step.active .cp-label,.cp-step.done .cp-label{color:rgba(61,43,31,.55)}
.cp-line{position:absolute;top:10px;left:calc(50% + 13px);right:calc(-50% + 13px);height:1px;background:rgba(61,43,31,.06);z-index:0;transition:background .3s}
.cp-line.filled{background:rgba(139,105,20,.28)}

/* Body */
#morris-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:18px 18px 28px;scrollbar-width:none;box-sizing:border-box}
#morris-body::-webkit-scrollbar{display:none}
.cw-step{display:none;animation:stepIn .2s ease-out both}
.cw-step.active{display:block}
@keyframes stepIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
.cw-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:23px;font-weight:300;color:#3d2b1f;letter-spacing:-.01em;margin:0 0 3px}
.cw-sub{font-family:'DM Sans',sans-serif;font-size:12px;color:rgba(61,43,31,.38);margin:0 0 14px;line-height:1.5}
.cw-sub strong{color:#8b6914;font-weight:500}
.cw-nav{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.cw-back{background:none;border:none;color:rgba(61,43,31,.35);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;padding:0;transition:color .15s;display:flex;align-items:center;gap:4px}
.cw-back:hover{color:#8b6914}

/* Loader / Error */
.cw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:10px}
.cw-spinner{width:28px;height:28px;border:2px solid rgba(61,43,31,.18);border-top-color:#3d2b1f;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.cw-loader-text{font-family:'DM Sans',sans-serif;font-size:11.5px;color:rgba(61,43,31,.28)}
.cw-error{background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.18);border-radius:11px;padding:13px;text-align:center;font-family:'DM Sans',sans-serif;font-size:12.5px;color:#fca5a5;margin-top:14px}

/* ── Step 1: Masters ── */
.cw-masters{display:flex;flex-direction:column;gap:7px}
.cw-master-card{width:100%;background:rgba(61,43,31,.03);border:1px solid rgba(61,43,31,.07);border-radius:13px;cursor:pointer;text-align:left;color:inherit;font-family:inherit;overflow:hidden;transition:all .22s;padding:0}
.cw-master-card:hover{border-color:rgba(139,105,20,.30);background:rgba(139,105,20,.04);transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.38)}
.cw-master-card.selected{border-color:rgba(61,43,31,.55);background:rgba(61,43,31,.06)}
.cw-master-top-row{display:flex;align-items:center;gap:10px;padding:10px 12px 0}
.cw-master-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(61,43,31,.08);background:#1a0f15}
.cw-master-info{flex:1;min-width:0}
.cw-master-name{font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:#3d2b1f;margin-bottom:2px}
.cw-master-tagline{font-family:'Cormorant Garamond',Georgia,serif;font-size:12.5px;font-style:italic;color:rgba(61,43,31,.50);line-height:1.3}
.cw-lvl-badge{display:inline-block;font-family:'DM Sans',sans-serif;font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 8px;border-radius:20px;margin-top:4px}
.cw-master-bio-wrap{padding:7px 12px 10px}
.cw-master-bio{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(61,43,31,.42);line-height:1.5;margin:0 0 6px}
.cw-master-skills{display:flex;flex-wrap:wrap;gap:4px}
.cw-skill-tag{font-family:'DM Sans',sans-serif;font-size:10px;color:rgba(61,43,31,.38);background:rgba(61,43,31,.05);border:1px solid rgba(61,43,31,.07);border-radius:20px;padding:2px 9px}

/* ── Step 2: Categories ── */
.cw-cats{display:flex;flex-direction:column;gap:10px}
.cw-cat-card{background:rgba(61,43,31,.03);border:1px solid rgba(61,43,31,.07);border-radius:16px;cursor:pointer;text-align:left;transition:all .2s;font-family:inherit;color:inherit;display:flex;align-items:center;gap:14px;padding:12px 14px;overflow:hidden;width:100%}
.cw-cat-card:hover{border-color:rgba(61,43,31,.40);background:rgba(61,43,31,.07);transform:translateY(-2px);box-shadow:0 6px 22px rgba(0,0,0,.32)}
.cw-cat-img{width:62px;height:62px;border-radius:11px;object-fit:cover;flex-shrink:0;border:1px solid rgba(61,43,31,.08)}
.cw-cat-text{flex:1;min-width:0}
.cw-cat-label{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:400;color:#3d2b1f;display:block;margin-bottom:3px}
.cw-cat-desc{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(61,43,31,.38);line-height:1.5;display:block}
.cw-cat-arrow{color:rgba(61,43,31,.20);font-size:16px;flex-shrink:0}

/* ── Step 3: Services ── */
.cw-services{display:flex;flex-direction:column;gap:8px}
.cw-svc-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(61,43,31,.03);border:1px solid rgba(61,43,31,.07);border-radius:13px;padding:13px 14px;cursor:pointer;text-align:left;color:inherit;width:100%;font-family:inherit;transition:all .2s;-webkit-tap-highlight-color:transparent;outline:none}
.cw-svc-btn:focus{outline:none;background:rgba(61,43,31,.03);border-color:rgba(61,43,31,.07)}
.cw-svc-btn:focus:not(:focus-visible){background:rgba(61,43,31,.03);border-color:rgba(61,43,31,.07)}
.cw-svc-btn:hover{border-color:rgba(61,43,31,.40);background:rgba(61,43,31,.06);transform:translateY(-1px)}
.cw-svc-left{flex:1;min-width:0}
.cw-svc-name{font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:500;color:#3d2b1f;margin-bottom:2px}
.cw-svc-dur{font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(61,43,31,.30)}
.cw-svc-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:300;color:#8b6914;white-space:nowrap;flex-shrink:0}

/* ── Step 4: Addons ── */
.cw-addons{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.cw-addon-btn{display:flex;align-items:center;gap:11px;background:rgba(61,43,31,.03);border:1px solid rgba(61,43,31,.07);border-radius:13px;padding:12px 14px;cursor:pointer;text-align:left;color:inherit;width:100%;font-family:inherit;transition:all .2s;box-sizing:border-box}
.cw-addon-btn:hover{border-color:rgba(139,105,20,.28);background:rgba(139,105,20,.04)}
.cw-addon-btn.sel{border-color:rgba(139,105,20,.55);background:rgba(139,105,20,.08)}
.cw-addon-check{width:20px;height:20px;border-radius:6px;border:1.5px solid rgba(61,43,31,.15);background:rgba(61,43,31,.04);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;transition:all .18s}
.cw-addon-btn.sel .cw-addon-check{background:#8b6914;border-color:#8b6914;color:#f5f0e8}
.cw-addon-info{flex:1}
.cw-addon-name{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#3d2b1f;margin-bottom:1px}
.cw-addon-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:rgba(139,105,20,.75)}
.cw-skip-btn{width:100%;padding:11px;background:none;border:1px dashed rgba(61,43,31,.28);border-radius:11px;color:rgba(61,43,31,.68);font-family:'DM Sans',sans-serif;font-size:12.5px;cursor:pointer;transition:all .18s;box-sizing:border-box}
.cw-skip-btn:hover{border-color:rgba(61,43,31,.50);color:#3d2b1f}

/* ── Step 5: Calendar ── */
.cw-calendar{background:rgba(61,43,31,.08);border:1px solid rgba(61,43,31,.14);border-radius:14px;overflow:hidden;margin-top:4px}
.cw-cal-nav{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border-bottom:1px solid rgba(61,43,31,.05)}
.cw-cal-nav span{font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:300;color:#3d2b1f}
.cw-cal-nav button{background:none;border:none;color:rgba(61,43,31,.40);font-size:17px;cursor:pointer;padding:3px 7px;border-radius:6px;transition:all .15s;line-height:1}
.cw-cal-nav button:hover{background:rgba(61,43,31,.06);color:#3d2b1f}
.cw-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:7px 7px 9px}
.cw-dow{text-align:center;font-family:'DM Sans',sans-serif;font-size:9px;font-weight:600;letter-spacing:.05em;color:rgba(61,43,31,.45);padding:2px 0;text-transform:uppercase}
.cw-day{aspect-ratio:1;border-radius:7px;border:none;background:none;color:rgba(61,43,31,.90);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center}
.cw-day.past,.cw-day.unavail{color:rgba(61,43,31,.25);cursor:default;pointer-events:none}
.cw-day.avail:hover{background:rgba(61,43,31,.22);color:#3d2b1f}
.cw-day.sel{background:#3d2b1f;color:#fff;box-shadow:0 0 13px rgba(61,43,31,.48)}
.cw-day.avail{position:relative}
.cw-day.avail::after{content:'';position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:#3d2b1f;opacity:.55}
.cw-day.sel::after{background:#fff}
.cw-times-title{font-family:'DM Sans',sans-serif;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(61,43,31,.60);margin:15px 0 8px}
.cw-time-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cw-time{padding:8px 4px;border-radius:9px;border:1px solid rgba(61,43,31,.20);background:rgba(61,43,31,.08);color:rgba(61,43,31,.90);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;transition:all .15s;text-align:center}
.cw-time.free:hover{border-color:rgba(61,43,31,.42);background:rgba(61,43,31,.14);color:#3d2b1f}
.cw-time.sel{background:#3d2b1f;border-color:#3d2b1f;color:#fff;box-shadow:0 0 11px rgba(61,43,31,.42)}

/* ── Step 6: Contact ── */
.cw-summary{background:rgba(61,43,31,.03);border:1px solid rgba(139,105,20,.12);border-radius:13px;padding:12px 14px;margin-bottom:16px;display:flex;flex-direction:column;gap:8px}
.cw-sum-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.cw-sum-row span{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(61,43,31,.32);white-space:nowrap}
.cw-sum-row strong{font-family:'DM Sans',sans-serif;font-size:12.5px;color:#3d2b1f;font-weight:500;text-align:right}
.cw-sum-price strong{font-family:'Cormorant Garamond',Georgia,serif;font-size:21px;font-weight:300;color:#8b6914}
.cw-form{display:flex;flex-direction:column;gap:12px}
.cw-field{display:flex;flex-direction:column;gap:4px}
.cw-field label{font-family:'DM Sans',sans-serif;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:rgba(61,43,31,.35)}
.cw-field input{background:rgba(61,43,31,.04);border:1px solid rgba(61,43,31,.09);border-radius:10px;padding:11px 13px;color:#3d2b1f;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color .15s;width:100%;box-sizing:border-box}
.cw-field input::placeholder{color:rgba(61,43,31,.18)}
.cw-field input:focus{border-color:rgba(61,43,31,.50);background:rgba(61,43,31,.04)}
.cw-btn-confirm{background:linear-gradient(135deg,#3d2b1f 0%,#5a1e37 100%);color:#fff;border:none;border-radius:11px;padding:15px 24px;width:100%;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;letter-spacing:.04em;cursor:pointer;transition:all .2s;box-shadow:0 6px 22px rgba(61,43,31,.38);margin-top:2px;box-sizing:border-box}
.cw-btn-confirm:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 30px rgba(61,43,31,.52)}
.cw-btn-confirm:disabled{opacity:.5;cursor:default}
.cw-form-note{font-family:'DM Sans',sans-serif;font-size:10px;color:rgba(61,43,31,.22);text-align:center;line-height:1.5;margin-top:-4px}
.cw-field input.invalid{border-color:rgba(252,100,100,.60)!important;background:rgba(252,100,100,.04)!important}
.cw-field-err{font-family:'DM Sans',sans-serif;font-size:10px;color:#fca5a5;margin-top:4px;display:none}
.cw-field-err.show{display:block}
.cw-consent{display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-top:2px}
.cw-consent input[type=checkbox]{width:16px;height:16px;min-width:16px;margin-top:2px;accent-color:#3d2b1f;cursor:pointer}
.cw-consent span{font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(61,43,31,.65);line-height:1.55}
.cw-consent span a{color:rgba(139,105,20,.75);text-decoration:underline}
.cw-consent span a:hover{color:#8b6914}
.cw-consent.invalid span{color:#fca5a5}

/* ── Return screen ── */
.cw-return-card{background:rgba(61,43,31,.04);border:1px solid rgba(139,105,20,.20);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.cw-return-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cw-return-row span{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(61,43,31,.35)}
.cw-return-row strong{font-family:'DM Sans',sans-serif;font-size:12.5px;color:#3d2b1f;font-weight:500;text-align:right}
.cw-return-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:300;color:#8b6914}

/* ── Success ── */
.cw-success{display:flex;flex-direction:column;align-items:center;text-align:center;padding:36px 16px;gap:12px}
.cw-success-icon{width:58px;height:58px;border-radius:50%;background:rgba(139,105,20,.09);border:1px solid rgba(139,105,20,.30);display:flex;align-items:center;justify-content:center;font-size:24px;color:#8b6914;margin-bottom:4px}
.cw-success h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:25px;font-weight:300;color:#3d2b1f;margin:0}
.cw-success p{font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(61,43,31,.50);line-height:1.65;margin:0}
.cw-success p strong{color:#3d2b1f;font-weight:500}
.cw-success-note{font-size:11px!important;color:rgba(61,43,31,.28)!important}
.cw-btn-new{background:rgba(61,43,31,.05);color:rgba(61,43,31,.60);border:1px solid rgba(61,43,31,.09);border-radius:10px;padding:10px 22px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;transition:all .15s;margin-top:4px}
.cw-btn-new:hover{background:rgba(61,43,31,.09);color:#3d2b1f}

body.morris-open .t-header,body.morris-open header{z-index:1!important;position:relative!important}
body.morris-open{overflow:hidden!important;touch-action:none;}


var styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);

// ── Months / Days ──────────────────────────────────────────────
var MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
var DAYS   = ['Mo','Di','Mi','Do','Fr','Sa','So'];

// ── HTML ───────────────────────────────────────────────────────
var wrap = document.createElement('div');
wrap.innerHTML =
  '<div id="morris-fab-wrap">'
  + '<button id="morris-fab"><span class="morris-fab-text">Termin buchen</span><div class="morris-fab-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:#f5f0e8"><path d="M7 3.5C7 2.67 7.67 2 8.5 2h7C16.33 2 17 2.67 17 3.5V6c0 5-2 9-5 10C9 15 7 11 7 6V3.5z"/><path d="M9 2.5C9 2.5 10 4 12 4s3-1.5 3-1.5"/></svg></div></button>'
  + '<div class="morris-fab-rings"><span class="morris-fab-ring"></span><span class="morris-fab-ring"></span><span class="morris-fab-ring"></span></div>'
  + '</div>'
  + '<div id="morris-backdrop"></div>'
  + '<div id="morris-modal">'
    + '<div id="morris-modal-header">'
      + '<div class="morris-modal-brand">'
        + '<div class="morris-modal-logo" style="display:flex;align-items:center;justify-content:center;background:#3d2b1f;border-radius:10px;width:40px;height:40px;flex-shrink:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#f5f0e8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5C7 2.67 7.67 2 8.5 2h7C16.33 2 17 2.67 17 3.5V6c0 5-2 9-5 10C9 15 7 11 7 6V3.5z"/><path d="M9 2.5C9 2.5 10 4 12 4s3-1.5 3-1.5"/></svg></div>'
        + '<div><span class="morris-modal-title">Morris Nails</span><span class="morris-modal-sub">Göppingen · Online-Buchung</span></div>'
      + '</div>'
      + '<button id="morris-close">✕</button>'
    + '</div>'
    + '<div id="morris-progress">'
      + '<div class="cp-step active" id="cp1"><div class="cp-dot">1</div><span class="cp-label">Meisterin</span></div>'
      + '<div class="cp-line" id="cpline1"></div>'
      + '<div class="cp-step" id="cp2"><div class="cp-dot">2</div><span class="cp-label">Kategorie</span></div>'
      + '<div class="cp-line" id="cpline2"></div>'
      + '<div class="cp-step" id="cp3"><div class="cp-dot">3</div><span class="cp-label">Dienst</span></div>'
      + '<div class="cp-line" id="cpline3"></div>'
      + '<div class="cp-step" id="cp4"><div class="cp-dot">4</div><span class="cp-label">Extra</span></div>'
      + '<div class="cp-line" id="cpline4"></div>'
      + '<div class="cp-step" id="cp5"><div class="cp-dot">5</div><span class="cp-label">Termin</span></div>'
      + '<div class="cp-line" id="cpline5"></div>'
      + '<div class="cp-step" id="cp6"><div class="cp-dot">6</div><span class="cp-label">Kontakt</span></div>'
    + '</div>'
    + '<div id="morris-body">'

      // Return screen — shown if previous booking exists in localStorage
      + '<div class="cw-step" id="cw-return">'
        + '<h2 class="cw-title">Willkommen zurück! 👋</h2>'
        + '<p class="cw-sub">Dein letzter Besuch:</p>'
        + '<div class="cw-return-card" id="cw-return-card"></div>'
        + '<button class="cw-btn-confirm" id="cw-btn-repeat" style="margin-top:14px">Gleichen Termin wiederholen →</button>'
        + '<button class="cw-skip-btn" id="cw-btn-newbook" style="margin-top:10px">Neue Buchung / anderer Master</button>'
      + '</div>'

      // Step 1 — Master
      + '<div class="cw-step active" id="cw-step1">'
        + '<h2 class="cw-title">Wähle deine Meisterin</h2>'
        + '<p class="cw-sub">Jede Meisterin hat ihre eigene Stärke — lies kurz rein und wähle die Richtige für dich.</p>'
        + '<div class="cw-masters" id="cw-masters-list"></div>'
      + '</div>'


      // Step 2 — Category
      + '<div class="cw-step" id="cw-step2">'
        + '<div class="cw-nav"><button class="cw-back" id="cw-back1">← Zurück</button></div>'
        + '<h2 class="cw-title">Was darf es sein?</h2>'
        + '<p class="cw-sub">Meisterin: <strong id="cw-sel-master-name"></strong></p>'
        + '<div class="cw-cats" id="cw-cats-list"></div>'
      + '</div>'

      // Step 3 — Service
      + '<div class="cw-step" id="cw-step3">'
        + '<div class="cw-nav"><button class="cw-back" id="cw-back2">← Zurück</button></div>'
        + '<h2 class="cw-title" id="cw-step3-title">Behandlung wählen</h2>'
        + '<p class="cw-sub" id="cw-step3-sub"></p>'
        + '<div class="cw-services" id="cw-services-list"></div>'
      + '</div>'

      // Step 4 — Addon
      + '<div class="cw-step" id="cw-step4">'
        + '<div class="cw-nav"><button class="cw-back" id="cw-back3">← Zurück</button></div>'
        + '<h2 class="cw-title">Möchtest du etwas dazu?</h2>'
        + '<p class="cw-sub">Optional — wähle einen Zusatz oder überspringe diesen Schritt.</p>'
        + '<div class="cw-addons" id="cw-addons-list"></div>'
        + '<button class="cw-skip-btn" id="cw-skip-addon">Ohne Zusatz weiter →</button>'
      + '</div>'

      // Step 5 — Date/Time
      + '<div class="cw-step" id="cw-step5">'
        + '<div class="cw-nav"><button class="cw-back" id="cw-back4">← Zurück</button></div>'
        + '<h2 class="cw-title">Datum &amp; Uhrzeit</h2>'
        + '<p class="cw-sub" id="cw-step5-sub"></p>'
        + '<div class="cw-calendar">'
          + '<div class="cw-cal-nav"><button id="cw-cal-prev">‹</button><span id="cw-cal-title"></span><button id="cw-cal-next">›</button></div>'
          + '<div class="cw-cal-grid" id="cw-cal-grid"></div>'
        + '</div>'
        + '<div id="cw-times-wrap" style="display:none">'
          + '<div class="cw-times-title">Verfügbare Zeiten</div>'
          + '<div class="cw-time-grid" id="cw-time-grid"></div>'
        + '</div>'
      + '</div>'

      // Step 6 — Contact
      + '<div class="cw-step" id="cw-step6">'
        + '<div class="cw-nav"><button class="cw-back" id="cw-back5">← Zurück</button></div>'
        + '<h2 class="cw-title">Deine Kontaktdaten</h2>'
        + '<div class="cw-summary" id="cw-summary"></div>'
        + '<form class="cw-form" id="cw-form">'
          + '<div class="cw-field"><label>Name</label><input type="text" id="cw-name" placeholder="Ihr Name" required autocomplete="name"></div>'
          + '<div class="cw-field"><label>Telefon / WhatsApp</label><input type="tel" id="cw-phone" placeholder="+49 172 …" required autocomplete="tel"></div>'
          + '<div class="cw-field"><label>E-Mail</label><input type="email" id="cw-email" placeholder="ihre@email.de" required autocomplete="email"></div>'
          + '<label class="cw-consent"><input type="checkbox" id="cw-consent" checked><span>Ich stimme den <a href="https://alteg.io/en/info/terms" target="_blank" rel="noopener">Nutzungsbedingungen</a> und der <a href="https://alteg.io/en/info/privacy" target="_blank" rel="noopener">Datenschutzerklärung</a> zu und willige in die Verarbeitung meiner Daten zur Terminbuchung ein.</span></label>'
          + '<label class="cw-consent" style="margin-top:6px"><input type="checkbox" id="cw-email-remind" checked><span>E-Mail-Erinnerung 1 Stunde vor dem Termin erhalten</span></label>'
          + '<button type="submit" class="cw-btn-confirm" id="cw-btn-submit">Termin bestätigen →</button>'
          + '<p class="cw-form-note">Keine Vorauszahlung · Kostenlose Stornierung bis 24h vorher</p>'
        + '</form>'
      + '</div>'

      // Success
      + '<div class="cw-step" id="cw-success">'
        + '<div class="cw-success">'
          + '<div class="cw-success-icon">✓</div>'
          + '<h2>Termin bestätigt!</h2>'
          + '<p id="cw-success-text"></p>'
          + '<p class="cw-success-note">Wir freuen uns auf Sie · Bestätigung per SMS/WhatsApp</p>'
          + '<button class="cw-btn-new" id="cw-btn-new">Neuen Termin buchen</button>'
        + '</div>'
      + '</div>'

    + '</div>'
  + '</div>';
function _morrisMount() {
document.body.appendChild(wrap);

// ── State ──────────────────────────────────────────────────────
var cw = {
  step: 1,
  master: null,       // object from MASTERS_META + API
  category: null,     // CATEGORIES item
  service: null,      // API service object
  addon: null,        // API service object | null
  date: null,
  time: null,
  datetime: null,
  calY: new Date().getFullYear(),
  calM: new Date().getMonth(),
  availDates: [],
};

var _allMasters  = null;
var _allServices = null;
var _addonObjs   = [];

// Gift state
var gift = {
  amount: null,       // 30 | 50 | 100
  goodId: null,
  certTypeId: null,
};

// ── Open/Close ─────────────────────────────────────────────────
var _scrollY = 0;
function morrisOpen() {
  document.getElementById('morris-backdrop').classList.add('open');
  // iOS scroll lock: save position, fix body
  _scrollY = window.scrollY || window.pageYOffset || 0;
  document.body.classList.add('morris-open');
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = '-' + _scrollY + 'px';
  document.body.style.width = '100%';
  requestAnimationFrame(function(){
    document.getElementById('morris-backdrop').classList.add('visible');
    document.getElementById('morris-modal').classList.add('open');
  });
  if (!_allMasters) loadInitialData();
  // Show return screen if previous booking exists
  tryShowReturnScreen();
  // Push history entry so Android back button is intercepted
  if (window.history && window.history.pushState) {
    window.history.pushState({ morrisOpen: true }, '');
  }
  // Tracking
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'open_booking_widget', page_location: window.location.href });
}

function morrisClose() {
  document.getElementById('morris-backdrop').classList.remove('visible');
  document.getElementById('morris-modal').classList.remove('open');
  document.body.classList.remove('morris-open');
  setTimeout(function(){
    document.getElementById('morris-backdrop').classList.remove('open');
    // iOS scroll lock: restore position
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, _scrollY);
    morrisReset();
  }, 320);
  // Clean up history entry if it's still there
  if (window.history && window.history.state && window.history.state.morrisOpen) {
    window.history.back();
  }
}

// ── Progress ───────────────────────────────────────────────────
function updateProgress(n) {
  var total = 6;
  for (var i = 1; i <= total; i++) {
    var el = document.getElementById('cp'+i);
    var line = document.getElementById('cpline'+i);
    el.classList.remove('active','done');
    var threshold = (n === 'success') ? total+1 : n;
    if (threshold > i) {
      el.classList.add('done');
      if (line) line.classList.add('filled');
    } else if (i === n) {
      el.classList.add('active');
      if (line) line.classList.remove('filled');
    } else {
      if (line) line.classList.remove('filled');
    }
    el.querySelector('.cp-dot').innerHTML = el.classList.contains('done') ? '✓' : i;
  }
  // Кликабельность done-шагов
  for (var j = 1; j <= total; j++) {
    (function(step){
      var stepEl = document.getElementById('cp'+step);
      stepEl.onclick = null;
      if (stepEl.classList.contains('done')) {
        stepEl.onclick = function(){ goStepBack(step); };
      }
    })(j);
  }
}

// Умный переход назад с учётом состояния
function goStepBack(target) {
  // Нельзя прыгнуть дальше текущего шага
  var current = (cw.step === 'success') ? 7 : cw.step;
  if (target >= current) return;
  // Если идём назад на шаг 4 (Extra) но для этой категории допы пропускались — пропускаем
  if (target === 4) {
    var skipBack = cw.category && false /* Morris: no wimpern */;
    if (!skipBack && cw.service) {
      var ids = ADDON_IDS_BY_SERVICE[cw.service.id];
      if (!ids || ids.length === 0) skipBack = true;
    }
    if (skipBack) { goStep(3); return; }
  }
  goStep(target);
  // Если возвращаемся на шаг 5 — перерисовываем календарь
  if (target === 5) { renderCalendar(); }
}

function goStep(n) {
  cw.step = n;
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  var id = n === 'success' ? 'cw-success' : 'cw-step'+n;
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
  document.getElementById('morris-body').scrollTop = 0;
  updateProgress(n);
}

// ── Loader ─────────────────────────────────────────────────────
function showLoader(id, text) {
  document.getElementById(id).innerHTML =
    '<div class="cw-loader"><div class="cw-spinner"></div><span class="cw-loader-text">'+(text||'Laden...')+'</span></div>';
}
function showError(id, msg) {
  document.getElementById(id).innerHTML = '<div class="cw-error">'+msg+'</div>';
}

// ── Load initial data ──────────────────────────────────────────
function loadInitialData(cb) {
  showLoader('cw-masters-list', 'Meisterinnen laden…');
  Promise.all([
    apiGet('/book_staff/'+CONFIG.locationId),
    apiGet('/book_services/'+CONFIG.locationId),
  ]).then(function(results) {
    var staffRes = results[0];
    var svcRes   = results[1];
    if (!staffRes.success || !svcRes.success) throw new Error('API error');
    _allMasters  = staffRes.data || [];
    _allServices = (svcRes.data && svcRes.data.services) ? svcRes.data.services : [];
    // cache addon objects
    _addonObjs = _allServices.filter(function(s){ return ADDON_IDS.indexOf(s.id) !== -1; });
    if (cb) { cb(); } else { renderMasters(); }
  }).catch(function(){
    showError('cw-masters-list', 'Fehler beim Laden. Bitte Seite neu laden.');
  });
}

// ── Step 1: Masters ────────────────────────────────────────────
function renderMasters() {
  var list = document.getElementById('cw-masters-list');
  list.innerHTML = '';

  _allMasters.forEach(function(m) {
    var meta = MASTERS_META[m.id] || {
      level: 'Master',
      levelColor: '#c9748e',
      levelBg: 'rgba(201,116,142,0.13)',
      levelBorder: 'rgba(201,116,142,0.32)',
      tagline: 'Erfahrene Meisterin',
      bio: 'Professionelle Behandlungen auf hohem Niveau.',
      skills: [],
    };

    var card = document.createElement('button');
    card.className = 'cw-master-card';
    card.innerHTML =
      '<div class="cw-master-top-row">'
        + '<img class="cw-master-avatar" src="'+(m.avatar||'https://be.cdn.alteg.io/images/no-master-sm.png')+'" alt="'+m.name+'" loading="lazy" onerror="this.src=\'https://be.cdn.alteg.io/images/no-master-sm.png\'">'
        + '<div class="cw-master-info">'
          + '<div class="cw-master-name">'+m.name+'</div>'
          + '<div class="cw-master-tagline">'+meta.tagline+'</div>'
          + '<span class="cw-lvl-badge" style="color:'+meta.levelColor+';background:'+meta.levelBg+';border:1px solid '+meta.levelBorder+'">'+meta.level+'</span>'
        + '</div>'
      + '</div>'
      + '<div class="cw-master-bio-wrap">'
        + '<div class="cw-master-bio">'+meta.bio+'</div>'
        + '<div class="cw-master-skills">'
          + meta.skills.map(function(s){ return '<span class="cw-skill-tag">'+s+'</span>'; }).join('')
        + '</div>'
      + '</div>';

    card.addEventListener('click', function(){ selectMaster(m, meta); });
    list.appendChild(card);
  });
}

function selectMaster(m, meta) {
  cw.master = m;
  cw.master._meta = meta;
  // Tracking
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'booking_master_selected', master_name: m.name, page_location: window.location.href });
  document.getElementById('cw-sel-master-name').textContent = m.name;
  goStep(2);
  // Загружаем услуги с ценами конкретного мастера
  var list = document.getElementById('cw-cats-list');
  list.innerHTML = '<div class="cw-loader"><div class="cw-spinner"></div><span class="cw-loader-text">Laden…</span></div>';
  apiGet('/book_services/'+CONFIG.locationId, { staff_id: m.id })
    .then(function(res) {
      if (res.success && res.data && res.data.services) {
        _allServices = res.data.services;
        _addonObjs = _allServices.filter(function(s){ return ADDON_IDS.indexOf(s.id) !== -1; });
      }
      renderCategories(m.id);
    })
    .catch(function(){ renderCategories(m.id); });
}

// ── Step 2: Categories ─────────────────────────────────────────
function renderCategories(masterId) {
  var list = document.getElementById('cw-cats-list');
  list.innerHTML = '';

  // Определяем id услуг доступных этому мастеру
  var masterServiceIds = _allServices
    .filter(function(s){ return s.staff && s.staff.some(function(st){ return st.id === masterId; }); })
    .map(function(s){ return s.id; });
  // Если API не возвращает staff в book_services — показываем все категории
  var hasStaffFilter = _allServices.length && _allServices[0].staff && _allServices[0].staff.length > 0;

  CATEGORIES.forEach(function(cat) {
    // Показываем только категории из meta.cats мастера
    var meta = MASTERS_META[cw.master.id];
    if (meta && meta.cats && meta.cats.indexOf(cat.key) === -1) return;

    var btn = document.createElement('button');
    btn.className = 'cw-cat-card';
    var imgHtml = cat.img
      ? '<img class="cw-cat-img" src="'+cat.img+'" alt="'+cat.label+'" loading="lazy">'
      : '<div class="cw-cat-img" style="background:rgba(61,43,31,.05);display:flex;align-items:center;justify-content:center;font-size:22px">👁</div>';
    btn.innerHTML =
      imgHtml
      + '<div class="cw-cat-text">'
        + '<span class="cw-cat-label">'+cat.label+'</span>'
        + '<span class="cw-cat-desc">'+cat.desc+'</span>'
      + '</div>'
      + '<span class="cw-cat-arrow">›</span>';
    btn.addEventListener('click', function(){ selectCategory(cat); });
    list.appendChild(btn);
  });
}

function selectCategory(cat) {
  cw.category = cat;
  cw.service = null;
  // Tracking
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'booking_category_selected', category: cat.label, master_name: cw.master ? cw.master.name : '', page_location: window.location.href });
  document.getElementById('cw-step3-title').textContent = cat.label;
  document.getElementById('cw-step3-sub').innerHTML = 'Meisterin: <strong style="color:#3d2b1f">'+cw.master.name+'</strong>';
  renderServices(cat);
  goStep(3);
}

// ── Step 3: Services ───────────────────────────────────────────
function renderServices(cat) {
  var list = document.getElementById('cw-services-list');
  list.innerHTML = '';
  var svcs = _allServices.filter(function(s){ return cat.serviceIds.indexOf(s.id) !== -1; });

  if (!svcs.length) {
    list.innerHTML = '<div class="cw-error">Keine Behandlungen verfügbar.</div>';
    return;
  }

  svcs.forEach(function(s) {
    // Цена конкретного мастера из staff[], иначе общий price_min/max
    var minP = s.price_min || 0;
    var maxP = s.price_max || 0;
    if (s.staff && s.staff.length) {
      var staffEntry = null;
      for (var si = 0; si < s.staff.length; si++) {
        if (s.staff[si].id === cw.master.id) { staffEntry = s.staff[si]; break; }
      }
      if (staffEntry) {
        minP = staffEntry.price_min != null ? staffEntry.price_min : minP;
        maxP = staffEntry.price_max != null ? staffEntry.price_max : maxP;
      }
    }
    var priceStr = minP === maxP ? (minP ? minP+' €' : '—') : 'ab '+minP+' €';
    // Длительность не показываем если 0 или null
    var durSec = s.seance_length || 0;
    var durStr = durSec > 0 ? (Math.round(durSec/60)+' Min') : '';

    var btn = document.createElement('button');
    btn.className = 'cw-svc-btn';
    btn.innerHTML =
      '<div class="cw-svc-left">'
        + '<div class="cw-svc-name">'+s.title+'</div>'
        + (durStr ? '<div class="cw-svc-dur">⏱ '+durStr+'</div>' : '')
      + '</div>'
      + '<div class="cw-svc-price">'+priceStr+'</div>';
    btn.addEventListener('click', function(){ selectService(s); });
    list.appendChild(btn);
  });
}

function selectService(s) {
  cw.service = s;
  cw.addon = null;
  // Tracking
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'booking_service_selected', service_name: s.title, category: cw.category ? cw.category.label : '', master_name: cw.master ? cw.master.name : '', page_location: window.location.href });
  // Для ресниц — всегда пропускаем допы
  if (false /* Morris: no wimpern */) {
    buildStep5Sub();
    goStep(5);
    renderCalendar();
    loadAvailDates();
    return;
  }
  // Для остальных — смотрим по конкретной услуге
  var allowedIds = ADDON_IDS_BY_SERVICE[s.id];
  // Addon filter
  var effectiveIds = (allowedIds || []).filter(function(id){
    if (id === 13502395 && cw.master && MANDEL_STAFF_IDS.indexOf(cw.master.id) === -1) return false;
    if (id === 13485758 && s.id === 13485755 && cw.master && STILETTO_STAFF_IDS.indexOf(cw.master.id) === -1) return false;
    return true;
  });
  if (!effectiveIds.length) {
    buildStep5Sub();
    goStep(5);
    renderCalendar();
    loadAvailDates();
  } else {
    renderAddons();
    goStep(4);
  }
}

// ── Step 4: Addons ─────────────────────────────────────────────
function renderAddons() {
  var list = document.getElementById('cw-addons-list');
  list.innerHTML = '';
  cw.addon = null;

  var allowedIds = (cw.service && ADDON_IDS_BY_SERVICE[cw.service.id]) || [];
  var filteredAddons = _addonObjs.filter(function(s){
    if (allowedIds.indexOf(s.id) === -1) return false;
    // Mandel logic: unused for Morris
    if (s.id === 13502395 && cw.master && MANDEL_STAFF_IDS.indexOf(cw.master.id) === -1) return false;
    // Stiletto в Nagelverlängerung — только для Diana
    if (s.id === 13485758 && cw.service && cw.service.id === 13485755 && cw.master && STILETTO_STAFF_IDS.indexOf(cw.master.id) === -1) return false;
    return true;
  });
  // Сохраняем порядок как в allowedIds
  filteredAddons.sort(function(a, b){ return allowedIds.indexOf(a.id) - allowedIds.indexOf(b.id); });

  if (!filteredAddons.length) {
    goStep(5);
    return;
  }

  filteredAddons.forEach(function(s) {
    var minP = s.price_min || 0;
    var priceStr = minP ? '+ '+minP+' €' : '';

    var btn = document.createElement('button');
    btn.className = 'cw-addon-btn';
    btn.dataset.id = s.id;
    btn.innerHTML =
      '<div class="cw-addon-check"></div>'
      + '<div class="cw-addon-info">'
        + '<div class="cw-addon-name">'+s.title+'</div>'
        + (priceStr ? '<div class="cw-addon-price">'+priceStr+'</div>' : '')
      + '</div>';
    btn.addEventListener('click', function(){
      var already = cw.addon && cw.addon.id === s.id;
      // Deselect all
      document.querySelectorAll('.cw-addon-btn').forEach(function(b){
        b.classList.remove('sel');
        b.querySelector('.cw-addon-check').textContent = '';
      });
      if (!already) {
        cw.addon = s;
        btn.classList.add('sel');
        btn.querySelector('.cw-addon-check').textContent = '✓';
      } else {
        cw.addon = null;
      }
    });
    list.appendChild(btn);
  });
}

function proceedFromAddon() {
  // Tracking — calendar step reached = booking started
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'booking_started',
    service_name: cw.service ? cw.service.title : '',
    category: cw.category ? cw.category.label : '',
    master_name: cw.master ? cw.master.name : '',
    addon_name: cw.addon ? cw.addon.title : '',
    page_location: window.location.href,
  });
  buildStep5Sub();
  goStep(5);
  renderCalendar();
  loadAvailDates();
}

function buildStep5Sub() {
  var parts = [cw.service.title];
  if (cw.addon) parts.push(cw.addon.title);
  document.getElementById('cw-step5-sub').innerHTML =
    parts.join(' + ') + ' · <strong style="color:#3d2b1f">'+cw.master.name+'</strong>';
}

// ── Step 5: Calendar ───────────────────────────────────────────
function loadAvailDates() {
  cw.availDates = [];
  var serviceIds = [cw.service.id];
  if (cw.addon) serviceIds.push(cw.addon.id);
  var params = { service_ids: serviceIds, staff_id: cw.master.id };
  var firstDay = new Date(cw.calY, cw.calM, 1).toISOString().split('T')[0];
  params.date = firstDay;

  apiGet('/book_dates/'+CONFIG.locationId, params)
    .then(function(res){
      if (res.success && res.data && res.data.booking_dates) {
        cw.availDates = res.data.booking_dates;
      }
      renderCalendar();
    })
    .catch(function(){ renderCalendar(); });
}

function renderCalendar() {
  document.getElementById('cw-cal-title').textContent = MONTHS[cw.calM]+' '+cw.calY;
  var grid = document.getElementById('cw-cal-grid');
  var today = new Date().toISOString().split('T')[0];
  var daysInMonth = new Date(cw.calY, cw.calM+1, 0).getDate();
  var firstWeekDay = (new Date(cw.calY, cw.calM, 1).getDay()+6) % 7;

  grid.innerHTML = '';
  DAYS.forEach(function(d){
    var el = document.createElement('div');
    el.className = 'cw-dow'; el.textContent = d;
    grid.appendChild(el);
  });
  for (var i = 0; i < firstWeekDay; i++) grid.appendChild(document.createElement('div'));

  for (var d = 1; d <= daysInMonth; d++) {
    var ds = cw.calY+'-'+String(cw.calM+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var isPast  = ds < today;
    var isAvail = cw.availDates.indexOf(ds) !== -1;
    var isSel   = cw.date === ds;
    var btn = document.createElement('button');
    btn.className = 'cw-day '+(isPast?'past':(isAvail?'avail':'unavail'))+(isSel?' sel':'');
    btn.textContent = d;
    btn.disabled = isPast || !isAvail;
    if (!isPast && isAvail) {
      (function(ds){ btn.addEventListener('click', function(){ selectDate(ds); }); })(ds);
    }
    grid.appendChild(btn);
  }
  document.getElementById('cw-times-wrap').style.display = cw.date ? 'block' : 'none';
  if (cw.date) renderTimesLoaded(null);
}

function selectDate(ds) {
  cw.date = ds; cw.time = null;
  document.getElementById('cw-times-wrap').style.display = 'block';
  renderCalendar();
  loadTimes();
}

function loadTimes() {
  var grid = document.getElementById('cw-time-grid');
  grid.innerHTML = '<div class="cw-loader" style="padding:16px 0"><div class="cw-spinner"></div></div>';
  var serviceIds = [cw.service.id];
  if (cw.addon) serviceIds.push(cw.addon.id);
  apiGet('/book_times/'+CONFIG.locationId+'/'+cw.master.id+'/'+cw.date, { service_ids: serviceIds })
    .then(function(res){
      if (!res.success) throw new Error();
      renderTimesLoaded(res.data || []);
    })
    .catch(function(){
      grid.innerHTML = '<div class="cw-error" style="grid-column:span 4">Keine Zeiten verfügbar.</div>';
    });
}

function renderTimesLoaded(slots) {
  var grid = document.getElementById('cw-time-grid');
  if (!slots) return;
  if (!slots.length) {
    grid.innerHTML = '<div class="cw-error" style="grid-column:span 4">Keine freien Zeiten.</div>';
    return;
  }
  grid.innerHTML = '';
  slots.forEach(function(slot){
    var isSel = cw.time === slot.time;
    var btn = document.createElement('button');
    btn.className = 'cw-time free'+(isSel?' sel':'');
    btn.textContent = slot.time;
    btn.addEventListener('click', function(){
      cw.time = slot.time;

      cw.datetime = slot.datetime;
      renderTimesLoaded(slots);
      setTimeout(function(){
        renderSummary();
        goStep(6);
        // Prefill from localStorage
        try {
          var saved = JSON.parse(localStorage.getItem('morris_client') || '{}');
          if (saved.name)  { var fn = document.getElementById('cw-name');  if (fn && !fn.value) fn.value = saved.name; }
          if (saved.phone) { var fp = document.getElementById('cw-phone'); if (fp && !fp.value) fp.value = saved.phone; }
          if (saved.email) { var fe = document.getElementById('cw-email'); if (fe && !fe.value) fe.value = saved.email; }
        } catch(ex) {}
      }, 180);
    });
    grid.appendChild(btn);
  });
  // Скролл до слотов после рендера
  requestAnimationFrame(function() {
    var timesWrap = document.getElementById('cw-times-wrap');
    var body = document.getElementById('morris-body');
    if (timesWrap && body) {
      var bodyRect = body.getBoundingClientRect();
      var wrapRect = timesWrap.getBoundingClientRect();
      var scrollTarget = body.scrollTop + (wrapRect.top - bodyRect.top) - 12;
      body.scrollTo({ top: scrollTarget, behavior: 'smooth' });
    }
  });
}

// ── Step 6: Summary + Submit ───────────────────────────────────
function renderSummary() {
  var meta = cw.master._meta || {};
  var dateStr = cw.date
    ? new Date(cw.date+'T12:00:00').toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'})
    : '';
  // Цена мастера из staff[], иначе общий price_min
  function getMasterPrice(svc) {
    if (svc.staff && svc.staff.length) {
      for (var i = 0; i < svc.staff.length; i++) {
        if (svc.staff[i].id === cw.master.id) return svc.staff[i].price_min || 0;
      }
    }
    return svc.price_min || 0;
  }
  var totalPrice = getMasterPrice(cw.service) + (cw.addon ? getMasterPrice(cw.addon) : 0);
  var priceStr = totalPrice ? totalPrice+' €' : '—';
  var svcStr = cw.addon ? cw.service.title+' + '+cw.addon.title : cw.service.title;

  document.getElementById('cw-summary').innerHTML =
    '<div class="cw-sum-row"><span>Meisterin</span><strong>'+cw.master.name
      +'&ensp;<span style="font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:1px 7px;border-radius:20px;color:'+(meta.levelColor||'#8b6914')+';background:'+(meta.levelBg||'rgba(139,105,20,.1)')+';border:1px solid '+(meta.levelBorder||'rgba(139,105,20,.3)')+'">'+((meta.level)||'Master')+'</span>'
      +'</strong></div>'
    +'<div class="cw-sum-row"><span>Behandlung</span><strong>'+svcStr+'</strong></div>'
    +'<div class="cw-sum-row"><span>Datum &amp; Zeit</span><strong>'+dateStr+', '+cw.time+' Uhr</strong></div>'
    +'<div class="cw-sum-row cw-sum-price"><span>Preis</span><strong>'+priceStr+'</strong></div>';
}

function submitBooking(e) {
  e.preventDefault();
  var name  = document.getElementById('cw-name').value.trim();
  var phone = document.getElementById('cw-phone').value.trim();
  var email = document.getElementById('cw-email').value.trim();
  var consent = document.getElementById('cw-consent').checked;
  var emailRemind = document.getElementById('cw-email-remind') ? document.getElementById('cw-email-remind').checked : true;

  // ── Helper: field validation state ──────────────────────────
  function setFieldState(id, ok, msg) {
    var inp = document.getElementById(id);
    var wrap = inp.parentElement;
    var err = wrap.querySelector('.cw-field-err');
    if (!err) {
      err = document.createElement('div');
      err.className = 'cw-field-err';
      wrap.appendChild(err);
    }
    if (ok) { inp.classList.remove('invalid'); err.classList.remove('show'); }
    else { inp.classList.add('invalid'); err.textContent = msg; err.classList.add('show'); }
  }

  // ── Validation ───────────────────────────────────────────────
  var valid = true;

  // Name — min 2 chars (allow any characters incl. numbers, punctuation)
  var nameOk = name.length >= 2;
  setFieldState('cw-name', nameOk, 'Bitte geben Sie Ihren Namen ein (mind. 2 Zeichen).');
  if (!nameOk) valid = false;

  // Phone — min 7 digits, allowed: +, digits, spaces, hyphens, brackets
  var phoneDigits = phone.replace(/\D/g,'');
  var phoneOk = phoneDigits.length >= 7 && phoneDigits.length <= 15;
  setFieldState('cw-phone', phoneOk, 'Bitte gültige Telefonnummer eingeben (mind. 7 Ziffern).');
  if (!phoneOk) valid = false;

  // Email — basic check
  var emailOk = email.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  setFieldState('cw-email', emailOk, 'Bitte gültige E-Mail-Adresse eingeben.');
  if (!emailOk) valid = false;

  // Consent
  var consentEl = document.getElementById('cw-consent').parentElement;
  if (!consent) { consentEl.classList.add('invalid'); valid = false; }
  else { consentEl.classList.remove('invalid'); }

  if (!valid) { console.warn('[Morris] Validation failed', {name, nameOk, phone, phoneOk, email, emailOk, consent}); return; }

  // ── Check booking state ──────────────────────────────────────
  if (!cw.service || !cw.master || !cw.datetime) {
    console.error('[Morris] Missing booking state', {service: cw.service, master: cw.master, datetime: cw.datetime});
    var errMsg = document.getElementById('cw-form').querySelector('.cw-err-msg');
    if (errMsg) errMsg.remove();
    var pErr = document.createElement('p');
    pErr.className = 'cw-err-msg';
    pErr.style.cssText = 'color:#fca5a5;font-size:12px;text-align:center;margin:4px 0 0;font-family:DM Sans,sans-serif';
    pErr.textContent = 'Bitte wählen Sie zuerst Datum und Uhrzeit aus.';
    document.getElementById('cw-form').appendChild(pErr);
    return;
  }

  var btn = document.getElementById('cw-btn-submit');
  btn.disabled = true; btn.textContent = 'Wird gesendet…';

  // Addon must be in the same appointment (not separate) — API requires combined services array
  var svcIds = cw.addon ? [cw.service.id, cw.addon.id] : [cw.service.id];
  var appointments = [{ id: cw.service.id, services: svcIds, staff_id: cw.master.id, datetime: cw.datetime }];

  console.log('[Morris] Booking →', { phone, name, email, appointments });

  apiPost('/book_record/'+CONFIG.locationId, { phone: phone, fullname: name, email: email, notify_by_email: emailRemind ? 1 : 0, lang: CONFIG.lang, lang_id: 3, bookform_id: 1427839, appointments: appointments })
    .then(function(res){
      console.log('[Morris] Booking response:', res);
      if (!res.success) throw new Error(res.message||'Buchungsfehler');
      var dateStr = cw.date
        ? new Date(cw.date+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})
        : '';
      var svcStr = cw.addon ? cw.service.title+' + '+cw.addon.title : cw.service.title;
      document.getElementById('cw-success-text').innerHTML =
        '<strong>'+svcStr+'</strong> bei <strong>'+cw.master.name+'</strong><br>'+dateStr+', '+cw.time+' Uhr';
      // Save client data + last booking for next visit
      try {
        localStorage.setItem('morris_client', JSON.stringify({ name: name, phone: phone, email: email }));
        localStorage.setItem('morris_last_booking', JSON.stringify({
          masterName:  cw.master.name,
          masterId:    cw.master.id,
          masterMeta:  cw.master._meta || {},
          catKey:      cw.category ? cw.category.key : null,
          service:     { id: cw.service.id, title: cw.service.title, price: cw.service.price_min || 0 },
          addon:       cw.addon ? { id: cw.addon.id, title: cw.addon.title, price: cw.addon.price_min || 0 } : null,
        }));
      } catch(ex) {}
      // Tracking — booking_success (Enhanced Conversions ready)
      window.dataLayer = window.dataLayer || [];
      // Hash email for Enhanced Conversions (SHA-256)
      var _ecEmail = email ? email.toLowerCase().trim() : '';
      var _ecPhone = phone ? phone.replace(/\s/g,'') : '';
      (window.crypto && window.crypto.subtle && _ecEmail
        ? window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(_ecEmail))
            .then(function(buf){
              return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
            })
        : Promise.resolve('')
      ).then(function(emailHash) {
        window.dataLayer.push({
          event: 'booking_success',
          service_name: cw.service ? cw.service.title : '',
          service_category: cw.category ? cw.category.key : '',
          category: cw.category ? cw.category.label : '',
          master_name: cw.master ? cw.master.name : '',
          addon_name: cw.addon ? cw.addon.title : '',
          booking_date: cw.date || '',
          booking_time: cw.time || '',
          source: 'widget',
          page_location: window.location.href,
          // Enhanced Conversions
          user_data: {
            email_address: _ecEmail || undefined,
            phone_number: _ecPhone || undefined,
            sha256_email_address: emailHash || undefined,
          },
        });
      });
      goStep('success');
      document.getElementById('morris-progress').style.display = 'none';
    })
    .catch(function(err){
      console.error('[Morris] Booking error:', err);
      btn.disabled = false; btn.textContent = 'Termin bestätigen →';
      var old = document.getElementById('cw-form').querySelector('.cw-err-msg');
      if (old) old.remove();
      var p = document.createElement('p');
      p.className = 'cw-err-msg cw-err-msg--visible';
      p.style.cssText = 'font-size:12px;text-align:center;margin:8px 0 0;font-family:DM Sans,sans-serif;padding:8px 12px;border-radius:8px;background:rgba(252,100,100,.10);border:1px solid rgba(252,100,100,.25)';
      var msg = (err && err.message) ? err.message : 'Fehler. Bitte erneut versuchen.';
      if (msg === 'AbortError' || msg.indexOf('abort') !== -1) msg = 'Verbindungsfehler. Bitte erneut versuchen.';
      p.textContent = msg;
      document.getElementById('cw-form').appendChild(p);
    });
}

// ── Calendar nav ───────────────────────────────────────────────
function calPrev() {
  if (cw.calM === 0){ cw.calM=11; cw.calY--; } else cw.calM--;
  cw.date=null; cw.time=null;
  renderCalendar(); loadAvailDates();
}
function calNext() {
  if (cw.calM === 11){ cw.calM=0; cw.calY++; } else cw.calM++;
  cw.date=null; cw.time=null;
  renderCalendar(); loadAvailDates();
}

// ── Reset ──────────────────────────────────────────────────────
function morrisReset() {
  cw = { step:1, master:null, category:null, service:null, addon:null,
         date:null, time:null, datetime:null,
         calY:new Date().getFullYear(), calM:new Date().getMonth(), availDates:[] };
  // Always re-enable submit button in case previous attempt left it disabled
  var submitBtn = document.getElementById('cw-btn-submit');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Termin bestätigen →'; }
  // Clear any leftover error messages in form
  var oldErr = document.getElementById('cw-form') && document.getElementById('cw-form').querySelector('.cw-err-msg');
  if (oldErr) oldErr.remove();
  // Clear form fields
  ['cw-name','cw-phone','cw-email'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('invalid'); }
  });
  var consentEl = document.getElementById('cw-consent');
  if (consentEl) { consentEl.checked = true; consentEl.parentElement.classList.remove('invalid'); }
  var remindEl = document.getElementById('cw-email-remind');
  if (remindEl) remindEl.checked = true;
  document.getElementById('morris-progress').style.display = 'flex';
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  // If there's a last booking, show return screen; otherwise step 1
  var hasLast = !!localStorage.getItem('morris_last_booking');
  if (hasLast) {
    tryShowReturnScreen();
    document.getElementById('morris-progress').style.display = 'none';
  } else {
    document.getElementById('cw-step1').classList.add('active');
    updateProgress(1);
    if (_allMasters) renderMasters();
  }
  document.getElementById('morris-body').scrollTop = 0;
}

// ── Return screen ──────────────────────────────────────────────
function tryShowReturnScreen() {
  try {
    var last = JSON.parse(localStorage.getItem('morris_last_booking') || 'null');
    if (!last) return;
    // Render card
    var svcStr = last.addon ? last.service.title + ' + ' + last.addon.title : last.service.title;
    var price = (last.service.price || 0) + (last.addon ? (last.addon.price || 0) : 0);
    var priceStr = price ? price + ' €' : '—';
    var meta = last.masterMeta || {};
    var avatarHtml = meta.avatar
      ? '<div style="display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid rgba(61,43,31,.07);margin-bottom:10px">' +
          '<div style="position:relative;flex-shrink:0">' +
            '<img src="' + meta.avatar + '" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid rgba(139,105,20,.35);display:block"/>' +
            '<div style="position:absolute;bottom:-1px;right:-1px;width:14px;height:14px;border-radius:50%;background:#2b6344;border:2px solid rgba(13,6,18,.9)"></div>' +
          '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;font-weight:600;color:#3d2b1f;display:flex;align-items:center;gap:7px;flex-wrap:wrap">' + last.masterName +
              (meta.level ? '<span style="font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:1px 7px;border-radius:20px;color:'+(meta.levelColor||'#8b6914')+';background:'+(meta.levelBg||'rgba(139,105,20,.1)')+';border:1px solid '+(meta.levelBorder||'rgba(139,105,20,.3)') + '">' + meta.level + '</span>' : '') +
            '</div>' +
            (meta.tagline ? '<div style="font-family:\'DM Sans\',sans-serif;font-size:11px;color:rgba(61,43,31,.38);margin-top:2px">' + meta.tagline + '</div>' : '') +
          '</div>' +
        '</div>'
      : '';
    document.getElementById('cw-return-card').innerHTML =
      avatarHtml +
      '<div class="cw-return-row"><span>Behandlung</span><strong>' + svcStr + '</strong></div>' +
      '<div class="cw-return-row" style="margin-top:4px"><span>Preis</span><strong class="cw-return-price">' + priceStr + '</strong></div>';
    // Switch to return screen (hide progress bar)
    document.getElementById('morris-progress').style.display = 'none';
    document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
    document.getElementById('cw-return').classList.add('active');
  } catch(ex) {}
}

function startRepeatBooking() {
  try {
    var last = JSON.parse(localStorage.getItem('morris_last_booking') || 'null');
    if (!last) { goStep(1); return; }
    // If data not loaded yet, wait for it then retry
    if (!_allMasters) {
      var repeatBtn = document.getElementById('cw-btn-repeat');
      if (repeatBtn) { repeatBtn.disabled = true; repeatBtn.textContent = '…'; }
      loadInitialData(function() {
        if (repeatBtn) { repeatBtn.disabled = false; repeatBtn.textContent = 'Gleichen Termin wiederholen →'; }
        startRepeatBooking();
      });
      return;
    }
    // Restore master
    var masterApi = _allMasters.filter(function(m){ return m.id === last.masterId; })[0];
    if (!masterApi) { goStep(1); return; }
    cw.master = masterApi;
    cw.master._meta = last.masterMeta || {};
    // Restore category
    cw.category = CATEGORIES.filter(function(c){ return c.key === last.catKey; })[0] || null;
    // Restore service & addon from cached _allServices
    if (_allServices) {
      cw.service = _allServices.filter(function(s){ return s.id === last.service.id; })[0] || null;
      cw.addon   = last.addon ? (_allServices.filter(function(s){ return s.id === last.addon.id; })[0] || null) : null;
    }
    if (!cw.service) { goStep(1); return; }
    // Skip to calendar
    goStep(5);
    renderCalendar();
    loadAvailDates();
  } catch(ex) { goStep(1); }
}

// ── Events ─────────────────────────────────────────────────────
document.getElementById('morris-fab').addEventListener('click', morrisOpen);
window.morrisOpen = morrisOpen;
window.morrisClose = morrisClose;

// Мобильная кнопка — отдельная верстка
(function(){
  var mwrap = document.createElement('div');
  mwrap.id = 'morris-fab-mobile';
  mwrap.innerHTML =
    '<span class="cfm-ring"></span>'
    + '<span class="cfm-ring"></span>'
    + '<span class="cfm-ring"></span>'
    + '<button id="morris-fab-mobile-btn"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:#f5f0e8"><path d="M7 3.5C7 2.67 7.67 2 8.5 2h7C16.33 2 17 2.67 17 3.5V6c0 5-2 9-5 10C9 15 7 11 7 6V3.5z"/><path d="M9 2.5C9 2.5 10 4 12 4s3-1.5 3-1.5"/></svg></button>'
    + '<span style="font-family:DM Sans,sans-serif;font-size:7.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#fff;text-align:center;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,1),0 0 8px rgba(0,0,0,.9)">Online · Termin</span>';
  document.body.appendChild(mwrap);
  document.getElementById('morris-fab-mobile-btn').addEventListener('click', morrisOpen);
})();
document.getElementById('morris-backdrop').addEventListener('click', morrisClose);

// ── WhatsApp / Phone click tracking ────────────────────────────
(function() {
  function trackExternalClick(e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.href || '';
    var loc = window.location.href;
    
    // WhatsApp
    if (href.includes('wa.me') || href.includes('whatsapp')) {
      // Определяем источник по ближайшему родителю
      var section = a.closest('[class*="crn1"], [class*="header"]') ? 'header'
        : a.closest('[class*="crf"], [class*="footer"]') ? 'footer'
        : a.closest('[class*="nrh1__g-mobile"], .nrh1') ? 'hero_mobile'
        : a.closest('#morris-modal') ? 'booking_widget'

        : 'page';
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'click_whatsapp',
        click_whatsapp_source: section,
        event_label: 'click_whatsapp_' + section,
        page_location: loc,
        cta_location: section,
      });
    }
    // Phone
    if (href.startsWith('tel:')) {
      var section2 = a.closest('[class*="crn1"], [class*="header"]') ? 'header'
        : a.closest('[class*="crf"], [class*="footer"]') ? 'footer'
        : 'page';
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'click_phone',
        cta_location: section2,
        page_location: loc,
      });
    }


// Gift flow events
document.getElementById('cw-btn-gift').addEventListener('click', openGiftMode);

document.getElementById('cw-gift-back1').addEventListener('click', function(){
  document.getElementById('morris-progress').style.display = 'flex';
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-step1').classList.add('active');
  updateProgress(1);
  document.getElementById('morris-body').scrollTop = 0;
});

document.getElementById('cw-gift-back2').addEventListener('click', function(){
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-gift1').classList.add('active');
  document.getElementById('morris-body').scrollTop = 0;
});

// Amount button clicks — direct listeners on each button
document.querySelectorAll('.cw-gift-amount-btn').forEach(function(amtBtn){
  amtBtn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.cw-gift-amount-btn').forEach(function(b){ b.classList.remove('sel'); });
    amtBtn.classList.add('sel');
    gift.amount     = parseInt(amtBtn.getAttribute('data-gift-amount'), 10);
    gift.goodId     = amtBtn.getAttribute('data-gift-id');
    gift.certTypeId = amtBtn.getAttribute('data-gift-cert');
    setTimeout(goGiftStep2, 220);
  });
});

document.getElementById('cw-gift-form').addEventListener('submit', submitGiftForm);

document.getElementById('cw-gift-btn-new').addEventListener('click', function(){
  morrisReset();
  document.getElementById('morris-progress').style.display = 'flex';
});

// Clear invalid state on input
['cw-gift-name','cw-gift-email'].forEach(function(id){
  document.getElementById(id).addEventListener('input', function(){
    this.classList.remove('invalid');
  });
});
document.addEventListener('keydown', function(e){ if(e.key==='Escape') morrisClose(); });

// ── Android back button / browser back ─────────────────────────
window.addEventListener('popstate', function(e) {
  var modal = document.getElementById('morris-modal');
  if (!modal || !modal.classList.contains('open')) return;

  // Modal is open — intercept back navigation
  e.preventDefault();

  var isGiftMode = document.getElementById('cw-gift1') && document.getElementById('cw-gift1').classList.contains('active');
  var isGiftStep2 = document.getElementById('cw-gift2') && document.getElementById('cw-gift2').classList.contains('active');
  var isGiftSuccess = document.getElementById('cw-gift-success') && document.getElementById('cw-gift-success').classList.contains('active');

  if (isGiftStep2) {
    // Gift step 2 → Gift step 1
    document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
    document.getElementById('cw-gift1').classList.add('active');
    document.getElementById('morris-body').scrollTop = 0;
    window.history.pushState({ morrisOpen: true }, '');
    return;
  }
  if (isGiftMode || isGiftSuccess) {
    // Gift step 1 or success → main step 1
    document.getElementById('morris-progress').style.display = 'flex';
    document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
    document.getElementById('cw-step1').classList.add('active');
    updateProgress(1);
    document.getElementById('morris-body').scrollTop = 0;
    window.history.pushState({ morrisOpen: true }, '');
    return;
  }

  // If return screen is active — close modal
  var returnScreen = document.getElementById('cw-return');
  if (returnScreen && returnScreen.classList.contains('active')) {
    morrisClose();
    return;
  }

  var step = cw.step;
  if (step === 'success' || step === 1) {
    // On step 1 or success — close the modal entirely, no new pushState
    morrisClose();
    return;
  }

  // Steps 2–6: go back one step
  window.history.pushState({ morrisOpen: true }, '');
  if (step === 2) { goStep(1); return; }
  if (step === 3) { goStep(2); return; }
  if (step === 4) { goStep(3); return; }
  if (step === 5) {
    var skipBack = cw.category && false /* Morris: no wimpern */;
    if (!skipBack && cw.service) {
      var ids = ADDON_IDS_BY_SERVICE[cw.service.id];
      if (!ids || ids.length === 0) skipBack = true;
    }
    goStep(skipBack ? 3 : 4);
    return;
  }
  if (step === 6) { goStep(5); return; }
});

// Кнопка "далее" после выбора допа (клик на карточку) — авто-переход с задержкой
// убран авто-переход, пользователь нажимает "Без допа" или выбирает и нажимает кнопку
// Добавим кнопку "Weiter" после выбора допа
(function(){
  var skipBtn = document.getElementById('cw-skip-addon');
  // Клонируем как "Weiter mit Zusatz"
  var nextBtn = document.createElement('button');
  nextBtn.className = 'cw-btn-confirm';
  nextBtn.style.marginTop = '8px';
  nextBtn.textContent = 'Weiter →';
  nextBtn.style.display = 'none';
  skipBtn.parentNode.insertBefore(nextBtn, skipBtn);

  // Показываем кнопку Weiter когда доп выбран
  document.getElementById('cw-addons-list').addEventListener('click', function(){
    setTimeout(function(){
      nextBtn.style.display = cw.addon ? 'block' : 'none';
    }, 50);
  });
  nextBtn.addEventListener('click', function(){ proceedFromAddon(); });
})();
} // end _morrisMount

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _morrisMount);
} else {
  _morrisMount();
}



})();
