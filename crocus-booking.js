(function() {
// ── CSS ───────────────────────────────────────────────────────
var css = `
#crocus-fab{position:fixed;bottom:28px;right:28px;z-index:9998;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#7B2D4E 0%,#5a1e37 100%);color:#fff;border:none;border-radius:50px;padding:14px 22px 14px 18px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;letter-spacing:.03em;cursor:pointer;box-shadow:0 8px 32px rgba(123,45,78,.55),0 2px 8px rgba(0,0,0,.25);transition:transform .2s,box-shadow .2s;animation:fabIn .5s cubic-bezier(.34,1.56,.64,1) both}
#crocus-fab:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 14px 40px rgba(123,45,78,.65),0 4px 12px rgba(0,0,0,.30)}
#crocus-fab:active{transform:scale(.97)}
#crocus-fab svg{flex-shrink:0}
@keyframes fabIn{from{opacity:0;transform:translateY(20px) scale(.85)}to{opacity:1;transform:translateY(0) scale(1)}}
#crocus-backdrop{display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transition:opacity .25s}
#crocus-backdrop.open{display:block}
#crocus-backdrop.visible{opacity:1}
#crocus-modal{position:fixed;top:0;right:0;z-index:2147483640;width:420px;max-width:100vw;height:100dvh;max-height:100dvh;background:#0f0a0d;border-radius:20px 0 0 20px;box-shadow:-8px 0 60px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;transform:translateX(100%);transition:transform .32s cubic-bezier(.32,.72,0,1)}
#crocus-modal.open{transform:translateX(0)}
#crocus-backdrop{z-index:2147483639!important}
#crocus-fab{z-index:2147483638!important}
@media(max-width:480px){#crocus-modal{width:100vw;border-radius:20px 20px 0 0;height:100dvh;bottom:0;top:0;transform:translateY(100%)}#crocus-modal.open{transform:translateY(0)}#crocus-fab{bottom:20px;right:16px}}
#crocus-modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;border-bottom:1px solid rgba(201,168,124,.12);background:rgba(255,255,255,.02);flex-shrink:0}
.crocus-modal-brand{display:flex;align-items:center;gap:10px}
.crocus-modal-logo{width:38px;height:38px;border-radius:9px;object-fit:cover;border:1px solid rgba(201,168,124,.22)}
.crocus-modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:400;color:#fdfaf8;letter-spacing:.02em;display:block}
.crocus-modal-sub{font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:rgba(253,250,248,.38);letter-spacing:.08em;text-transform:uppercase;display:block}
#crocus-close{width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:rgba(253,250,248,.55);font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
#crocus-close:hover{background:rgba(255,255,255,.10);color:#fdfaf8}
#crocus-progress{display:flex;align-items:center;justify-content:center;padding:13px 20px 10px;gap:0;background:rgba(255,255,255,.01);border-bottom:1px solid rgba(255,255,255,.04);flex-shrink:0}
.cp-step{display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;flex:1}
.cp-dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',Arial,sans-serif;font-size:10px;font-weight:600;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);color:rgba(253,250,248,.30);z-index:1;transition:all .25s}
.cp-step.active .cp-dot{background:#7B2D4E;border-color:#7B2D4E;color:#fff;box-shadow:0 0 14px rgba(123,45,78,.55)}
.cp-step.done .cp-dot{background:rgba(201,168,124,.15);border-color:#c9a87c;color:#c9a87c}
.cp-label{font-family:'DM Sans',Arial,sans-serif;font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:rgba(253,250,248,.28)}
.cp-step.active .cp-label{color:rgba(253,250,248,.65)}
.cp-step.done .cp-label{color:#c9a87c}
.cp-line{position:absolute;top:11px;left:calc(50% + 14px);right:calc(-50% + 14px);height:1px;background:rgba(255,255,255,.07);z-index:0;transition:background .3s}
.cp-line.filled{background:rgba(201,168,124,.30)}
#crocus-body{flex:1;overflow-y:auto;padding:18px 18px 24px;scrollbar-width:thin;scrollbar-color:rgba(123,45,78,.30) transparent}
#crocus-body::-webkit-scrollbar{width:4px}
#crocus-body::-webkit-scrollbar-thumb{background:rgba(123,45,78,.35);border-radius:4px}
.cw-step{display:none;animation:stepIn .22s ease-out both}
.cw-step.active{display:block}
@keyframes stepIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
.cw-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:300;color:#fdfaf8;letter-spacing:-.02em;margin:0 0 4px}
.cw-sub{font-family:'DM Sans',Arial,sans-serif;font-size:12.5px;color:rgba(253,250,248,.42);margin:0 0 16px}
.cw-sub strong{color:#c9a87c;font-weight:500}
.cw-nav{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.cw-back{background:none;border:none;color:rgba(253,250,248,.38);font-family:'DM Sans',Arial,sans-serif;font-size:12.5px;cursor:pointer;padding:0;transition:color .15s;white-space:nowrap}
.cw-back:hover{color:#c9a87c}
.cw-services{display:flex;flex-direction:column;gap:10px;margin-top:14px}
.cw-service{display:flex;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;cursor:pointer;text-align:left;color:inherit;width:100%;transition:all .2s;font-family:inherit}
.cw-service:hover{border-color:rgba(123,45,78,.45);background:rgba(123,45,78,.07);transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.35)}
.cw-svc-img{width:90px;min-height:90px;flex-shrink:0;position:relative;overflow:hidden}
.cw-svc-img img{width:100%;height:100%;object-fit:cover;filter:brightness(.72) saturate(.8);display:block}
.cw-svc-badge{position:absolute;bottom:5px;left:5px;background:rgba(123,45,78,.85);color:#fdfaf8;font-size:8.5px;font-weight:600;letter-spacing:.05em;padding:2px 7px;border-radius:20px}
.cw-svc-body{padding:11px 13px;display:flex;flex-direction:column;gap:3px;flex:1}
.cw-svc-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-weight:400;color:#fdfaf8}
.cw-svc-desc{font-size:11px;color:rgba(253,250,248,.40);line-height:1.45}
.cw-svc-foot{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:5px}
.cw-svc-dur{font-size:10.5px;color:rgba(253,250,248,.32)}
.cw-svc-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-weight:300;color:#c9a87c}
.cw-masters{display:flex;flex-direction:column;gap:9px}
.cw-master{display:flex;align-items:flex-start;gap:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:13px;cursor:pointer;text-align:left;color:inherit;width:100%;transition:all .2s;font-family:inherit}
.cw-master:hover{background:rgba(255,255,255,.05);border-color:rgba(201,168,124,.25);transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.40)}
.cw-master-any{border-color:rgba(201,168,124,.18);background:rgba(201,168,124,.05)}
.cw-master-any:hover{border-color:rgba(201,168,124,.38);background:rgba(201,168,124,.09)}
.cw-any-icon{width:42px;height:42px;border-radius:50%;background:rgba(201,168,124,.12);border:1px solid rgba(201,168,124,.25);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.cw-any-info{flex:1}
.cw-any-title{font-size:13.5px;font-weight:500;color:#c9a87c;margin-bottom:2px;font-family:'DM Sans',Arial,sans-serif}
.cw-any-sub{font-size:11px;color:rgba(253,250,248,.38);font-family:'DM Sans',Arial,sans-serif}
.cw-any-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;color:#c9a87c;align-self:center}
.cw-master-photo{width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.07)}
.cw-master-body{flex:1;display:flex;flex-direction:column;gap:3px}
.cw-master-top{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.cw-master-name{font-family:'DM Sans',Arial,sans-serif;font-size:14px;font-weight:500;color:#fdfaf8}
.cw-lvl-badge{font-family:'DM Sans',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:20px}
.cw-lvl-desc{font-family:'DM Sans',Arial,sans-serif;font-size:10px;font-weight:300}
.cw-master-bio{font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:rgba(253,250,248,.36);line-height:1.4}
.cw-master-foot{display:flex;justify-content:space-between;align-items:center;margin-top:3px}
.cw-master-next{font-family:'DM Sans',Arial,sans-serif;font-size:10.5px;color:rgba(253,250,248,.35)}
.cw-master-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:21px;font-weight:300}
.cw-calendar{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;margin-top:4px}
.cw-cal-nav{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05)}
.cw-cal-nav span{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:300;color:#fdfaf8}
.cw-cal-nav button{background:none;border:none;color:rgba(253,250,248,.45);font-size:18px;cursor:pointer;padding:3px 7px;border-radius:6px;transition:all .15s;line-height:1}
.cw-cal-nav button:hover{background:rgba(255,255,255,.06);color:#fdfaf8}
.cw-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:8px 8px 10px}
.cw-dow{text-align:center;font-family:'DM Sans',Arial,sans-serif;font-size:9.5px;font-weight:600;letter-spacing:.05em;color:rgba(253,250,248,.22);padding:3px 0;text-transform:uppercase}
.cw-day{aspect-ratio:1;border-radius:7px;border:none;background:none;color:rgba(253,250,248,.60);font-family:'DM Sans',Arial,sans-serif;font-size:12.5px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center}
.cw-day.past{color:rgba(253,250,248,.13);cursor:default;pointer-events:none}
.cw-day.avail:hover{background:rgba(123,45,78,.25);color:#fdfaf8}
.cw-day.sel{background:#7B2D4E;color:#fff;box-shadow:0 0 14px rgba(123,45,78,.50)}
.cw-times-title{font-family:'DM Sans',Arial,sans-serif;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(253,250,248,.32);margin:16px 0 9px}
.cw-time-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cw-time{padding:8px 4px;border-radius:9px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);color:rgba(253,250,248,.65);font-family:'DM Sans',Arial,sans-serif;font-size:12.5px;cursor:pointer;transition:all .15s;text-align:center}
.cw-time.taken{opacity:.20;cursor:default;text-decoration:line-through;pointer-events:none}
.cw-time.free:hover{border-color:rgba(123,45,78,.45);background:rgba(123,45,78,.15);color:#fdfaf8}
.cw-time.sel{background:#7B2D4E;border-color:#7B2D4E;color:#fff;box-shadow:0 0 12px rgba(123,45,78,.45)}
.cw-summary{background:rgba(255,255,255,.03);border:1px solid rgba(201,168,124,.13);border-radius:13px;padding:13px 15px;margin-bottom:18px;display:flex;flex-direction:column;gap:9px}
.cw-sum-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cw-sum-row span{font-family:'DM Sans',Arial,sans-serif;font-size:11.5px;color:rgba(253,250,248,.36)}
.cw-sum-row strong{font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#fdfaf8;font-weight:500}
.cw-sum-price strong{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:300}
.cw-sum-lvl{font-family:'DM Sans',Arial,sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:20px;background:rgba(255,255,255,.06)}
.cw-form{display:flex;flex-direction:column;gap:13px}
.cw-field{display:flex;flex-direction:column;gap:5px}
.cw-field label{font-family:'DM Sans',Arial,sans-serif;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:rgba(253,250,248,.40)}
.cw-field input{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:11px 13px;color:#fdfaf8;font-family:'DM Sans',Arial,sans-serif;font-size:14.5px;outline:none;transition:border-color .15s;width:100%;box-sizing:border-box}
.cw-field input::placeholder{color:rgba(253,250,248,.20)}
.cw-field input:focus{border-color:rgba(123,45,78,.55);background:rgba(123,45,78,.05)}
.cw-btn-confirm{background:linear-gradient(135deg,#7B2D4E 0%,#5a1e37 100%);color:#fff;border:none;border-radius:11px;padding:15px 24px;width:100%;font-family:'DM Sans',Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:.04em;cursor:pointer;transition:all .2s;box-shadow:0 6px 22px rgba(123,45,78,.40);margin-top:4px}
.cw-btn-confirm:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(123,45,78,.55)}
.cw-form-note{font-family:'DM Sans',Arial,sans-serif;font-size:10.5px;color:rgba(253,250,248,.25);text-align:center;line-height:1.5;margin-top:-4px}
.cw-success{display:flex;flex-direction:column;align-items:center;text-align:center;padding:36px 16px;gap:14px}
.cw-success-icon{width:60px;height:60px;border-radius:50%;background:rgba(201,168,124,.10);border:1px solid rgba(201,168,124,.32);display:flex;align-items:center;justify-content:center;font-size:26px;color:#c9a87c;margin-bottom:6px}
.cw-success h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:300;color:#fdfaf8;margin:0}
.cw-success p{font-family:'DM Sans',Arial,sans-serif;font-size:13.5px;color:rgba(253,250,248,.55);line-height:1.6;margin:0}
.cw-success p strong{color:#fdfaf8;font-weight:500}
.cw-success-note{font-size:11.5px!important;color:rgba(253,250,248,.30)!important}
.cw-btn-new{background:rgba(255,255,255,.05);color:rgba(253,250,248,.65);border:1px solid rgba(255,255,255,.10);border-radius:10px;padding:11px 22px;cursor:pointer;font-family:'DM Sans',Arial,sans-serif;font-size:13px;transition:all .15s;margin-top:6px}
.cw-btn-new:hover{background:rgba(255,255,255,.09);color:#fdfaf8}
`;

// ── Inject CSS ────────────────────────────────────────────────
var styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);

// Стиль для подавления хедера Tilda когда модал открыт
var tildeHeaderStyle = document.createElement('style');
tildeHeaderStyle.id = 'crocus-tilda-fix';
tildeHeaderStyle.textContent = 'body.crocus-open .t-header,body.crocus-open .t396,body.crocus-open [class*="t-header"],body.crocus-open header,body.crocus-open .tilda-logo{z-index:1!important;position:relative!important}';
document.head.appendChild(tildeHeaderStyle);

// ── Inject Fonts ──────────────────────────────────────────────
var fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500;600&display=swap';
document.head.appendChild(fontLink);

// ── Inject HTML ───────────────────────────────────────────────
var html = '<button id="crocus-fab"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Termin buchen</button>'
  + '<div id="crocus-backdrop"></div>'
  + '<div id="crocus-modal">'
  + '<div id="crocus-modal-header"><div class="crocus-modal-brand"><img class="crocus-modal-logo" src="https://static.tildacdn.com/tild3466-6662-4234-b863-376638653730/ChatGPT_Image_16__20.png" alt="Crocus"><div><span class="crocus-modal-title">Crocus Beauty Studio</span><span class="crocus-modal-sub">Göppingen · Online-Buchung</span></div></div><button id="crocus-close">✕</button></div>'
  + '<div id="crocus-progress"><div class="cp-step active" id="cp1"><div class="cp-dot">1</div><span class="cp-label">Dienst</span></div><div class="cp-line" id="cpline1"></div><div class="cp-step" id="cp2"><div class="cp-dot">2</div><span class="cp-label">Meister</span></div><div class="cp-line" id="cpline2"></div><div class="cp-step" id="cp3"><div class="cp-dot">3</div><span class="cp-label">Termin</span></div><div class="cp-line" id="cpline3"></div><div class="cp-step" id="cp4"><div class="cp-dot">4</div><span class="cp-label">Kontakt</span></div></div>'
  + '<div id="crocus-body">'
  + '<div class="cw-step active" id="cw-step1"><h2 class="cw-title">Welche Behandlung?</h2><div class="cw-services" id="cw-services-list"></div></div>'
  + '<div class="cw-step" id="cw-step2"><div class="cw-nav"><button class="cw-back" id="cw-back1">\u2190 Zur\xfcck</button><h2 class="cw-title">W\xe4hle deinen Meister</h2></div><p class="cw-sub">f\xfcr <strong id="cw-selected-svc-name"></strong></p><div class="cw-masters" id="cw-masters-list"></div></div>'
  + '<div class="cw-step" id="cw-step3"><div class="cw-nav"><button class="cw-back" id="cw-back2">\u2190 Zur\xfcck</button><h2 class="cw-title">Datum &amp; Uhrzeit</h2></div><p class="cw-sub" id="cw-step3-sub"></p><div class="cw-calendar"><div class="cw-cal-nav"><button id="cw-cal-prev">\u2039</button><span id="cw-cal-title"></span><button id="cw-cal-next">\u203a</button></div><div class="cw-cal-grid" id="cw-cal-grid"></div></div><div id="cw-times-wrap" style="display:none"><div class="cw-times-title">Verf\xfcgbare Zeiten</div><div class="cw-time-grid" id="cw-time-grid"></div></div></div>'
  + '<div class="cw-step" id="cw-step4"><div class="cw-nav"><button class="cw-back" id="cw-back3">\u2190 Zur\xfcck</button><h2 class="cw-title">Deine Kontaktdaten</h2></div><div class="cw-summary" id="cw-summary"></div><form class="cw-form" id="cw-form"><div class="cw-field"><label>Name</label><input type="text" id="cw-name" placeholder="Ihr Name" required></div><div class="cw-field"><label>Telefon / WhatsApp</label><input type="tel" id="cw-phone" placeholder="+49 172 \u2026" required></div><button type="submit" class="cw-btn-confirm">Termin best\xe4tigen \u2192</button><p class="cw-form-note">Keine Vorauszahlung. Kostenlose Stornierung bis 24h vorher.</p></form></div>'
  + '<div class="cw-step" id="cw-success"><div class="cw-success"><div class="cw-success-icon">\u2713</div><h2>Termin best\xe4tigt!</h2><p id="cw-success-text"></p><p class="cw-success-note">Wir freuen uns auf Sie.<br>Best\xe4tigung per SMS / WhatsApp.</p><button class="cw-btn-new" id="cw-btn-new">Neuen Termin buchen</button></div></div>'
  + '</div></div>';

var wrap = document.createElement('div');
wrap.innerHTML = html;
document.body.appendChild(wrap);

// ── Data ──────────────────────────────────────────────────────
var CW_SERVICES = [
  { id:'manikure', name:'Manik\xfcre', desc:'Klassische oder Gel-Manik\xfcre mit Nagelhautpflege und Formgebung.', dur:'45\u201390 Min', img:'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=75', price:35, badge:null },
  { id:'pedikure', name:'Pedik\xfcre', desc:'Pflegende Fu\xdfbehandlung inkl. kostenloser Fu\xdfmassage.', dur:'60\u201390 Min', img:'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=400&q=75', price:40, badge:'Gratis Massage' },
  { id:'wimpern', name:'Wimpernverl\xe4ngerung', desc:'Klassisch, Volumen oder Mega-Volumen. Nat\xfcrlicher Look.', dur:'90\u2013150 Min', img:'https://images.unsplash.com/photo-1512207846876-bb54ef5056fe?w=400&q=75', price:79, badge:null },
  { id:'kombi', name:'Kombi Mani + Pedi', desc:'H\xe4nde und F\xfc\xdfe in einem Termin. G\xfcnstiger als einzeln.', dur:'2\u20133 Std', img:'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=75', price:89, badge:'Spare bis 20\u20ac' },
];

var CW_LEVELS = {
  'Junior':     { color:'#6B8CAE', bg:'rgba(107,140,174,0.12)', border:'rgba(107,140,174,0.28)', desc:'Guter Einstieg \xb7 Sorgf\xe4ltige Arbeit' },
  'Master':     { color:'#c9748e', bg:'rgba(201,116,142,0.12)', border:'rgba(201,116,142,0.28)', desc:'Erfahren \xb7 Zuverl\xe4ssig' },
  'Top Master': { color:'#c9a87c', bg:'rgba(201,168,124,0.12)', border:'rgba(201,168,124,0.32)', desc:'Sehr erfahren \xb7 Kreative Designs' },
  'Premium':    { color:'#e8d5c4', bg:'rgba(232,213,196,0.09)', border:'rgba(232,213,196,0.28)', desc:'Highest Level \xb7 Exklusiv' },
};

var CW_MASTERS = [
  { id:'m1', name:'Anna K.',   level:'Junior',     photo:'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=200&q=75', bio:'Frisch zertifiziert, viel Liebe zum Detail.', next:'Heute, 15:00', svcs:['manikure','pedikure'],              prices:{manikure:35,pedikure:40,wimpern:null,kombi:89} },
  { id:'m2', name:'Maria S.',  level:'Master',     photo:'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=75', bio:'3 Jahre Erfahrung. Spezialisiert auf Gel.', next:'Heute, 17:30', svcs:['manikure','pedikure','kombi'],         prices:{manikure:45,pedikure:50,wimpern:null,kombi:100} },
  { id:'m3', name:'Sofia L.',  level:'Top Master', photo:'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&q=75', bio:'6 Jahre. Gewinnerin regionaler Nail Art Wettbewerbe.', next:'Morgen, 10:00', svcs:['manikure','pedikure','wimpern','kombi'], prices:{manikure:55,pedikure:65,wimpern:120,kombi:120} },
  { id:'m4', name:'Elena V.',  level:'Premium',    photo:'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=75', bio:'Top-Spezialistin f\xfcr Wimpern & Premium Nail Art. 8+ Jahre.', next:'Fr, 14:00', svcs:['manikure','wimpern'],                prices:{manikure:65,pedikure:null,wimpern:160,kombi:null} },
];

var CW_TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];
var CW_TAKEN = { '2026-04-24':['09:00','10:00','14:00'], '2026-04-25':['09:30','11:30','15:00','17:00'] };
var MONTHS_DE = ['Januar','Februar','M\xe4rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
var DAYS_DE = ['Mo','Di','Mi','Do','Fr','Sa','So'];

// ── State ─────────────────────────────────────────────────────
var cw = { step:1, svcId:null, masterId:null, date:null, time:null, calY:new Date().getFullYear(), calM:new Date().getMonth() };

// ── Open / Close ──────────────────────────────────────────────
function crocusOpen() {
  crocusRenderServices();
  var bd = document.getElementById('crocus-backdrop');
  var md = document.getElementById('crocus-modal');
  bd.classList.add('open');
  document.body.classList.add('crocus-open');
  requestAnimationFrame(function(){ bd.classList.add('visible'); md.classList.add('open'); });
  document.body.style.overflow = 'hidden';
}
function crocusClose() {
  var bd = document.getElementById('crocus-backdrop');
  var md = document.getElementById('crocus-modal');
  bd.classList.remove('visible'); md.classList.remove('open');
  document.body.classList.remove('crocus-open');
  setTimeout(function(){ bd.classList.remove('open'); document.body.style.overflow = ''; }, 320);
}
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') crocusClose(); });

// ── Steps ─────────────────────────────────────────────────────
function crocusGoStep(n) {
  cw.step = n;
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  var target = n === 'success' ? document.getElementById('cw-success') : document.getElementById('cw-step'+n);
  if(target) target.classList.add('active');
  document.getElementById('crocus-body').scrollTop = 0;
  crocusUpdateProgress(n);
  if(n === 2) crocusRenderMasters();
  if(n === 3) crocusRenderCalendar();
  if(n === 4) crocusRenderSummary();
}

function crocusUpdateProgress(n) {
  [1,2,3,4].forEach(function(i){
    var el = document.getElementById('cp'+i);
    var line = document.getElementById('cpline'+i);
    el.classList.remove('active','done');
    var threshold = (n === 'success') ? 5 : n;
    if(threshold > i) { el.classList.add('done'); if(line) line.classList.add('filled'); }
    else if(i === n) { el.classList.add('active'); if(line) line.classList.remove('filled'); }
    else { if(line) line.classList.remove('filled'); }
    var dot = el.querySelector('.cp-dot');
    if(el.classList.contains('done')) dot.innerHTML = '\u2713';
    else dot.textContent = i;
  });
}

// ── Render Services ───────────────────────────────────────────
function crocusRenderServices() {
  var list = document.getElementById('cw-services-list');
  list.innerHTML = '';
  CW_SERVICES.forEach(function(s){
    var btn = document.createElement('button');
    btn.className = 'cw-service';
    btn.innerHTML = '<div class="cw-svc-img"><img src="'+s.img+'" alt="'+s.name+'" loading="lazy">'+(s.badge ? '<span class="cw-svc-badge">'+s.badge+'</span>' : '')+'</div><div class="cw-svc-body"><div class="cw-svc-name">'+s.name+'</div><div class="cw-svc-desc">'+s.desc+'</div><div class="cw-svc-foot"><span class="cw-svc-dur">\u23f1 '+s.dur+'</span><span class="cw-svc-price">ab '+s.price+' \u20ac</span></div></div>';
    btn.addEventListener('click', function(){ crocusSelectSvc(s.id); });
    list.appendChild(btn);
  });
}

function crocusSelectSvc(id) {
  cw.svcId = id; cw.masterId = null; cw.date = null; cw.time = null;
  document.getElementById('cw-selected-svc-name').textContent = CW_SERVICES.filter(function(s){ return s.id===id; })[0].name;
  crocusGoStep(2);
}

// ── Render Masters ────────────────────────────────────────────
function crocusRenderMasters() {
  var svc = CW_SERVICES.filter(function(s){ return s.id===cw.svcId; })[0];
  var filtered = CW_MASTERS.filter(function(m){ return m.svcs.indexOf(cw.svcId) !== -1; });
  var list = document.getElementById('cw-masters-list');
  list.innerHTML = '';

  var anyBtn = document.createElement('button');
  anyBtn.className = 'cw-master cw-master-any';
  anyBtn.innerHTML = '<div class="cw-any-icon">\u26a1</div><div class="cw-any-info"><div class="cw-any-title">N\xe4chster freier Termin</div><div class="cw-any-sub">Heute, 15:00 \xb7 Automatische Zuweisung</div></div><div class="cw-any-price">ab '+svc.price+' \u20ac</div>';
  anyBtn.addEventListener('click', function(){ crocusSelectMaster('any'); });
  list.appendChild(anyBtn);

  filtered.forEach(function(m){
    var lv = CW_LEVELS[m.level];
    var price = m.prices[cw.svcId];
    var btn = document.createElement('button');
    btn.className = 'cw-master';
    btn.innerHTML = '<img class="cw-master-photo" src="'+m.photo+'" alt="'+m.name+'" loading="lazy"><div class="cw-master-body"><div class="cw-master-top"><span class="cw-master-name">'+m.name+'</span><span class="cw-lvl-badge" style="color:'+lv.color+';background:'+lv.bg+';border:1px solid '+lv.border+'">'+m.level+'</span></div><div class="cw-lvl-desc" style="color:'+lv.color+'">'+lv.desc+'</div><div class="cw-master-bio">'+m.bio+'</div><div class="cw-master-foot"><span class="cw-master-next">\ud83d\udd50 '+m.next+'</span>'+(price ? '<span class="cw-master-price" style="color:'+lv.color+'">'+price+' \u20ac</span>' : '')+'</div></div>';
    btn.addEventListener('click', function(){ crocusSelectMaster(m.id); });
    list.appendChild(btn);
  });
}

function crocusSelectMaster(id) {
  cw.masterId = id; cw.date = null; cw.time = null;
  var m = CW_MASTERS.filter(function(m){ return m.id===id; })[0];
  var svc = CW_SERVICES.filter(function(s){ return s.id===cw.svcId; })[0];
  var name = id==='any' ? 'N\xe4chster freier' : m.name;
  document.getElementById('cw-step3-sub').innerHTML = svc.name+' \xb7 <strong style="color:#fdfaf8">'+name+'</strong>';
  crocusGoStep(3);
}

// ── Calendar ──────────────────────────────────────────────────
function crocusRenderCalendar() {
  document.getElementById('cw-cal-title').textContent = MONTHS_DE[cw.calM]+' '+cw.calY;
  var grid = document.getElementById('cw-cal-grid');
  var today = new Date().toISOString().split('T')[0];
  var daysInMonth = new Date(cw.calY, cw.calM+1, 0).getDate();
  var firstDay = (new Date(cw.calY, cw.calM, 1).getDay() + 6) % 7;
  grid.innerHTML = '';
  DAYS_DE.forEach(function(d){ var el=document.createElement('div'); el.className='cw-dow'; el.textContent=d; grid.appendChild(el); });
  for(var i=0; firstDay>i; i++){ grid.appendChild(document.createElement('div')); }
  for(var d=1; daysInMonth>=d; d++){
    var ds = cw.calY+'-'+String(cw.calM+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var past = today > ds;
    var sel = cw.date === ds;
    var btn = document.createElement('button');
    btn.className = 'cw-day '+(past?'past':'avail')+(sel?' sel':'');
    btn.textContent = d;
    if(past) btn.disabled = true;
    else (function(ds){ btn.addEventListener('click', function(){ crocusSelectDate(ds); }); })(ds);
    grid.appendChild(btn);
  }
  document.getElementById('cw-times-wrap').style.display = cw.date ? 'block' : 'none';
  if(cw.date) crocusRenderTimes();
}

function crocusCalPrev(){ if(cw.calM===0){cw.calM=11;cw.calY--;}else cw.calM--; crocusRenderCalendar(); }
function crocusCalNext(){ if(cw.calM===11){cw.calM=0;cw.calY++;}else cw.calM++; crocusRenderCalendar(); }

function crocusSelectDate(ds){
  cw.date=ds; cw.time=null;
  document.getElementById('cw-times-wrap').style.display='block';
  crocusRenderCalendar();
  crocusRenderTimes();
}

function crocusRenderTimes(){
  var taken = CW_TAKEN[cw.date] || [];
  var grid = document.getElementById('cw-time-grid');
  grid.innerHTML = '';
  CW_TIMES.forEach(function(t){
    var isTaken = taken.indexOf(t) !== -1;
    var isSel = cw.time === t;
    var btn = document.createElement('button');
    btn.className = 'cw-time '+(isTaken?'taken':'free')+(isSel?' sel':'');
    btn.textContent = t;
    if(isTaken) btn.disabled = true;
    else (function(t){ btn.addEventListener('click', function(){ crocusSelectTime(t); }); })(t);
    grid.appendChild(btn);
  });
}

function crocusSelectTime(t){
  cw.time=t;
  crocusRenderTimes();
  setTimeout(function(){ crocusGoStep(4); }, 180);
}

// ── Summary ───────────────────────────────────────────────────
function crocusRenderSummary(){
  var svc = CW_SERVICES.filter(function(s){ return s.id===cw.svcId; })[0];
  var m = cw.masterId==='any' ? null : CW_MASTERS.filter(function(m){ return m.id===cw.masterId; })[0];
  var lv = m ? CW_LEVELS[m.level] : null;
  var price = m ? m.prices[cw.svcId] : null;
  var dateStr = cw.date ? new Date(cw.date).toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'}) : '';
  var el = document.getElementById('cw-summary');
  el.innerHTML = '<div class="cw-sum-row"><span>Behandlung</span><strong>'+svc.name+'</strong></div>'
    +'<div class="cw-sum-row"><span>Meisterin</span><strong>'+(m?m.name:'N\xe4chste freie')+'</strong>'+(lv?'<span class="cw-sum-lvl" style="color:'+lv.color+'">'+m.level+'</span>':'')+'</div>'
    +'<div class="cw-sum-row"><span>Datum & Zeit</span><strong>'+dateStr+', '+cw.time+' Uhr</strong></div>'
    +(price?'<div class="cw-sum-row cw-sum-price"><span>Preis</span><strong style="color:'+lv.color+'">'+price+' \u20ac</strong></div>':'');
}

// ── Submit ────────────────────────────────────────────────────
function crocusSubmit(e){
  e.preventDefault();
  var svc = CW_SERVICES.filter(function(s){ return s.id===cw.svcId; })[0];
  var m = cw.masterId==='any' ? null : CW_MASTERS.filter(function(m){ return m.id===cw.masterId; })[0];
  var dateStr = cw.date ? new Date(cw.date).toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'}) : '';
  document.getElementById('cw-success-text').innerHTML = '<strong>'+svc.name+'</strong> bei <strong>'+(m?m.name:'n\xe4chster freier Meisterin')+'</strong><br>'+dateStr+', '+cw.time+' Uhr';
  crocusGoStep('success');
  document.getElementById('crocus-progress').style.display='none';
}

function crocusReset(){
  cw = { step:1, svcId:null, masterId:null, date:null, time:null, calY:new Date().getFullYear(), calM:new Date().getMonth() };
  document.getElementById('crocus-progress').style.display='flex';
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-step1').classList.add('active');
  crocusUpdateProgress(1);
  crocusRenderServices();
  document.getElementById('crocus-body').scrollTop=0;
}

// ── Event Listeners ───────────────────────────────────────────
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

})();
