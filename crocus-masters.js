(function(){
var EXTRAS = [
{name:'French',price:'+ 5 €'},
{name:'Babyboomer',price:'+ 10 €'},
{name:'Stiletto-Form',price:'+ 10 €'},
{name:'Nail-Art Design',price:'ab + 10 €'},
{name:'Länge +1',price:'+ 5 €'},
{name:'Länge +2',price:'+ 10 €'}
];
var POPUPS = {
n_basis:{badge:'Nelia · Basis',title:'Hygienische <em>Maniküre</em>',sub:'Russische Technik mit Fräse — präzise Nagelhautpflege, kein Einweichen.',sections:[{title:'Leistungen',rows:[{name:'Hygienische Maniküre · 30 Min.',old:'30 €',price:'25 €'}]},{title:'Enthalten',rows:[{name:'Behandlung der Nagelhaut',price:'✓'},{name:'Korrektur der Nagelform',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'Premiummaterialien inklusive. Sterilisierte Instrumente.'},
n_gel:{badge:'Nelia · Beliebt',title:'Maniküre + <em>Gel-Lack</em>',sub:'Russische Maniküre mit Gel-Verstärkung — bis zu 4 Wochen Haltbarkeit.',sections:[{title:'Leistungen',rows:[{name:'Verstärkung & Gel-Lack · 1,5 Std.',old:'40 €',price:'35 €'}]},{title:'Enthalten',rows:[{name:'Nagelhautbehandlung',price:'✓'},{name:'Verstärkung mit Gel',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'3–4 Wochen Haltbarkeit. HEMA-freie Materialien.'},
n_korrektur:{badge:'Nelia · Korrektur',title:'Nagel<em>korrektur</em>',sub:'Entfernung des alten Materials, Neuaufbau und Gel-Lack.',sections:[{title:'Leistungen',rows:[{name:'Nagelkorrektur · 2 Std.',old:'50 €',price:'40 €'}]},{title:'Enthalten',rows:[{name:'Entfernung des alten Materials',price:'✓'},{name:'Nagelhautbehandlung',price:'✓'},{name:'Verstärkung / Modellierung',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'Sterilisierte Instrumente. Premiummaterialien inklusive.'},
n_pedi:{badge:'Nelia · Pediküre',title:'<em>Pediküre</em>',sub:'Hygienische Fußpflege mit Creme und leichter Massage.',sections:[{title:'Leistungen',rows:[{name:'Hygienische Pediküre · 30 Min.',old:'35 €',price:'30 €'},{name:'Pediküre + Gel-Lack · 1,5 Std.',old:'50 €',price:'40 €'}]},{title:'Enthalten',rows:[{name:'Nagelhautbehandlung & Formkorrektur',price:'✓'},{name:'Reinigung der Füße',price:'✓'},{name:'Pflege mit Creme',price:'✓'},{name:'Leichte Massage',price:'✓'}]}],note:''},
n_kombi:{badge:'Nelia · Kombi',title:'<em>Kombi</em>behandlung',sub:'Maniküre + Pediküre in einem Termin — bequem und komplett.',sections:[{title:'Leistungen',rows:[{name:'Maniküre + Pediküre · 3 Std.',old:'100 €',price:'80 €'}]},{title:'Enthalten',rows:[{name:'Nagelhaut Hände & Füße',price:'✓'},{name:'Gel-Lack auf Hände & Füße',price:'✓'},{name:'Creme & Massage Füße',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]}],note:'Idealerweise mit Voranmeldung.'},
,
s_basis:{badge:'Sofia · Basis',title:'Hygienische <em>Maniküre</em>',sub:'Russische Technik mit Fräse — präzise Nagelhautpflege, kein Einweichen.',sections:[{title:'Leistungen',rows:[{name:'Hygienische Maniküre · 30 Min.',old:'30 €',price:'25 €'}]},{title:'Enthalten',rows:[{name:'Behandlung der Nagelhaut',price:'✓'},{name:'Korrektur der Nagelform',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'Premiummaterialien inklusive. Sterilisierte Instrumente.'},
s_gel:{badge:'Sofia · Beliebt',title:'Maniküre + <em>Gel</em>',sub:'Russische Maniküre mit Gel-Verstärkung — bis zu 4 Wochen Haltbarkeit.',sections:[{title:'Leistungen',rows:[{name:'Verstärkung & Gel-Lack · 1,5 Std.',old:'40 €',price:'35 €'}]},{title:'Enthalten',rows:[{name:'Nagelhautbehandlung',price:'✓'},{name:'Verstärkung mit Gel',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'3–4 Wochen Haltbarkeit. HEMA-freie Materialien.'},
s_korrektur:{badge:'Sofia · Korrektur',title:'Nagel<em>korrektur</em>',sub:'Entfernung des alten Materials, Neuaufbau und Gel-Lack.',sections:[{title:'Leistungen',rows:[{name:'Nagelkorrektur · 2 Std.',old:'50 €',price:'40 €'}]},{title:'Enthalten',rows:[{name:'Entfernung des alten Materials',price:'✓'},{name:'Nagelhautbehandlung',price:'✓'},{name:'Verstärkung / Modellierung',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'Sterilisierte Instrumente. Premiummaterialien inklusive.'},
s_pedi:{badge:'Sofia · Pediküre',title:'<em>Pediküre</em>',sub:'Hygienische Fußpflege mit Creme und leichter Massage.',sections:[{title:'Leistungen',rows:[{name:'Hygienische Pediküre · 30 Min.',old:'35 €',price:'30 €'},{name:'Pediküre + Gel-Lack · 1,5 Std.',old:'50 €',price:'40 €'}]},{title:'Enthalten',rows:[{name:'Nagelhautbehandlung & Formkorrektur',price:'✓'},{name:'Reinigung der Füße',price:'✓'},{name:'Pflege mit Creme',price:'✓'},{name:'Leichte Massage',price:'✓'}]}],note:''},
s_kombi:{badge:'Sofia · Kombi',title:'<em>Kombi</em>behandlung',sub:'Maniküre + Pediküre in einem Termin — bequem und komplett.',sections:[{title:'Leistungen',rows:[{name:'Maniküre + Pediküre · 3 Std.',old:'100 €',price:'80 €'}]},{title:'Enthalten',rows:[{name:'Nagelhaut Hände & Füße',price:'✓'},{name:'Gel-Lack auf Hände & Füße',price:'✓'},{name:'Creme & Massage Füße',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]}],note:'Idealerweise mit Voranmeldung.',
n_verlaengerung:{badge:'Nelia · Verlänger.',title:'Nagel<em>verlängerung</em>',sub:'Verlängerung mit Gel, Modellierung und Gel-Lack. Preis nach Länge.',sections:[{title:'Leistungen',rows:[{name:'Nagelverlängerung · 2,5 Std.',price:'ab 65 €'}]},{title:'Enthalten',rows:[{name:'Entfernung altes Material (falls vorhanden)',price:'✓'},{name:'Nagelhautbehandlung',price:'✓'},{name:'Verlänger. mit Gel',price:'✓'},{name:'Modellierung der Form',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'Endpreis nach Länge und Design.'},
d_basis:{badge:'Meisterin Diana · Basis',title:'Hygienische <em>Maniküre</em>',sub:'Sanfte, saubere Maniküre für ein gepflegtes Nagelbild.',sections:[{title:'Leistungen',rows:[{name:'Hygienische Maniküre · 30 Min.',price:'35 €'}]},{title:'Enthalten',rows:[{name:'Behandlung der Nagelhaut',price:'✓'},{name:'Korrektur der Nagelform',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'Premiummaterialien inklusive.'},
d_gel:{badge:'Meisterin Diana · Beliebt',title:'Maniküre + <em>Gel-Lack</em>',sub:'Erstbehandlung ohne vorhandenes Material — Verstärkung, Gel-Lack, bis 4 Wochen.',sections:[{title:'Leistungen',rows:[{name:'Maniküre + Verstärkung + Gel-Lack · 1,5 Std.',price:'45 €'}]},{title:'Enthalten',rows:[{name:'Nagelhautbehandlung',price:'✓'},{name:'Verstärkung mit Gel',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'HEMA-freie Materialien. 3–4 Wochen Haltbarkeit.'},
d_korrektur:{badge:'Meisterin Diana · Korrektur',title:'Nagel<em>korrektur</em>',sub:'Mit vorhandenem Material — Entfernung, Neuaufbau, Gel-Lack.',sections:[{title:'Leistungen',rows:[{name:'Nagelkorrektur · 2 Std.',price:'55 €'}]},{title:'Enthalten',rows:[{name:'Entfernung des alten Materials',price:'✓'},{name:'Nagelhautbehandlung',price:'✓'},{name:'Verstärkung / Modellierung',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'Premiummaterialien inklusive.'},
d_verlaengerung:{badge:'Meisterin Diana · Verlänger.',title:'Nagel<em>verlängerung</em>',sub:'Preis abhängig von Länge und Form. Beratung kostenlos.',sections:[{title:'Leistungen',rows:[{name:'Nagelverlängerung · 2,5 Std.',price:'ab 75 €'}]},{title:'Enthalten',rows:[{name:'Entfernung altes Material (falls vorhanden)',price:'✓'},{name:'Nagelhautbehandlung',price:'✓'},{name:'Verlänger. mit Gel',price:'✓'},{name:'Modellierung der Form',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},{title:'Extras & Aufpreise',rows:EXTRAS}],note:'Endpreis nach Länge und Design.'},
d_pedi:{badge:'Meisterin Diana · Pediküre',title:'<em>Pediküre</em>',sub:'Gründliche Fußpflege mit Creme und leichter Massage.',sections:[{title:'Leistungen',rows:[{name:'Hygienische Pediküre · 30 Min.',price:'40 €'},{name:'Pediküre + Gel-Lack · 1,5 Std.',price:'55 €'}]},{title:'Enthalten',rows:[{name:'Nagelhaut & Formkorrektur',price:'✓'},{name:'Reinigung der Füße',price:'✓'},{name:'Pflege mit Creme',price:'✓'},{name:'Leichte Massage',price:'✓'}]}],note:''},
d_kombi:{badge:'Meisterin Diana · Kombi',title:'<em>Kombi</em>behandlung',sub:'Maniküre + Pediküre komplett in einem Termin.',sections:[{title:'Leistungen',rows:[{name:'Maniküre + Pediküre · 3 Std.',price:'100 €'}]},{title:'Enthalten',rows:[{name:'Nagelhaut Hände & Füße',price:'✓'},{name:'Verstärkung & Gel-Lack Hände & Füße',price:'✓'},{name:'Creme & Massage Füße',price:'✓'},{name:'Leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]}],note:'Bitte beim Buchen "Kombi" als Kategorie wählen.'}
};
function buildPopup(key){
var d = POPUPS[key]; if(!d) return '';
var h = '';
h += '<span class="crl2-popup__badge">'+d.badge+'</span>';
h += '<div class="crl2-popup__title">'+d.title+'</div>';
h += '<p class="crl2-popup__sub">'+d.sub+'</p>';
d.sections.forEach(function(sec){
h += '<div class="crl2-popup__section"><div class="crl2-popup__section-title">'+sec.title+'</div>';
sec.rows.forEach(function(row){
h += '<div class="crl2-popup__row"><span class="crl2-popup__row-name">'+row.name+'</span><span class="crl2-popup__row-price">';
if(row.old) h += '<span class="crl2-popup__price-old">'+row.old+'</span><span class="crl2-popup__price-new">'+row.price+'</span>';
else h += '<span class="crl2-popup__price-only">'+row.price+'</span>';
h += '</span></div>';
});
h += '</div>';
});
if(d.note) h += '<p class="crl2-popup__note">'+d.note+'</p>';
h += '<button class="crl2-popup__cta-btn" onclick="this.closest(\'.crl2-overlay\').classList.remove(\'crl2-open\');document.body.style.overflow=\'\';crocusOpen();"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Jetzt Termin buchen</button>';
return h;
}
var overlay = document.getElementById('crl2-overlay');
var content = document.getElementById('crl2-popup-content');
document.getElementById('crl2-close').addEventListener('click', function(){ overlay.classList.remove('crl2-open'); document.body.style.overflow=''; });
overlay.addEventListener('click', function(e){ if(e.target===overlay){ overlay.classList.remove('crl2-open'); document.body.style.overflow=''; }});
document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ overlay.classList.remove('crl2-open'); document.body.style.overflow=''; }});
document.querySelectorAll('[data-crl2-popup]').forEach(function(btn){
btn.addEventListener('click', function(e){
e.stopPropagation();
content.innerHTML = buildPopup(btn.getAttribute('data-crl2-popup'));
overlay.classList.add('crl2-open');
document.body.style.overflow = 'hidden';
document.getElementById('crl2-popup').scrollTop = 0;
});
});
function crl2SwitchToWimpern() {
document.querySelectorAll('[data-crl2-main]').forEach(function(t){
var isW = t.getAttribute('data-crl2-main') === 'wimpern';
t.classList.toggle('crl2__main-tab--active', isW);
t.setAttribute('aria-selected', isW ? 'true' : 'false');
});
document.querySelectorAll('.crl2__main-panel').forEach(function(p){
p.classList.toggle('crl2__main-panel--active', p.id === 'crl2-panel-wimpern');
});
document.querySelectorAll('.crl2__mc-card--mani').forEach(function(c){ c.style.display = 'none'; });
document.querySelectorAll('.crl2__mc-card--wimpern').forEach(function(c){ c.style.display = ''; });
document.querySelectorAll('.crl2__mc-grid').forEach(function(g){ g.classList.add('crl2__mc-grid--single'); });
setTimeout(function(){
var panel = document.getElementById('crl2-panel-wimpern');
if(panel){ var y = panel.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({top:y,behavior:'smooth'}); }
}, 60);
}
function crl2UpdateTippenBadge() {
var badge = document.getElementById('crl2-tippen-badge');
if(!badge) return;
var inactive = document.querySelector('[data-crl2-main]:not(.crl2__main-tab--active)');
if(!inactive) { badge.style.opacity='0'; return; }
var tabsRect = inactive.parentElement.getBoundingClientRect();
var tabRect = inactive.getBoundingClientRect();
var leftCenter = (tabRect.left - tabsRect.left) + tabRect.width/2;
badge.style.left = leftCenter + 'px';
badge.style.opacity = '1';
}
crl2UpdateTippenBadge();
window.addEventListener('resize', crl2UpdateTippenBadge);
var crl2Badge = document.getElementById('crl2-tippen-badge');
if(crl2Badge) {
crl2Badge.addEventListener('click', function(){
var inactive = document.querySelector('[data-crl2-main]:not(.crl2__main-tab--active)');
if(inactive) inactive.click();
});
}
document.querySelectorAll('[data-crl2-main]').forEach(function(tab){
tab.addEventListener('click', function(){
var key = tab.getAttribute('data-crl2-main');
var isWimpern = (key === 'wimpern');
var isMani = !isWimpern;
document.querySelectorAll('.crl2__mc-card--mani').forEach(function(c){ c.style.display = isMani ? '' : 'none'; });
document.querySelectorAll('.crl2__mc-card--wimpern').forEach(function(c){ c.style.display = isWimpern ? '' : 'none'; });
document.querySelectorAll('.crl2__mc-grid').forEach(function(g){
g.classList.toggle('crl2__mc-grid--single', isWimpern);
});
setTimeout(crl2UpdateTippenBadge, 50);
});
});
var karinaCard = document.querySelector('[data-crl2-master="karina"]');
if(karinaCard){
karinaCard.addEventListener('click', function(e){
if(e.target.closest('[data-crl2-hint],[data-crl2-about]')) return;
crl2SwitchToWimpern();
});
}
var karinaHintBtn = document.querySelector('[data-crl2-hint="karina"]');
if(karinaHintBtn){
karinaHintBtn.addEventListener('click', function(e){
e.stopPropagation();
crl2SwitchToWimpern();
});
}
if('IntersectionObserver' in window){
var io = new IntersectionObserver(function(entries){
entries.forEach(function(entry){
if(entry.isIntersecting){
var cards = entry.target.querySelectorAll('.crl2__card,.crl2__wt-card');
cards.forEach(function(c,i){ setTimeout(function(){ c.classList.add('crl2--visible'); }, i*80); });
io.unobserve(entry.target);
}
});
},{threshold:0.08});
document.querySelectorAll('.crl2--observe').forEach(function(el){ io.observe(el); });
} else {
document.querySelectorAll('.crl2__card,.crl2__wt-card').forEach(function(c){ c.classList.add('crl2--visible'); });
}
function crl2DismissHint(hintId, storageKey) {
var el = document.getElementById(hintId);
if(!el || el.classList.contains('crl2--gone')) return;
el.classList.add('crl2--gone');
setTimeout(function(){ el.style.display='none'; }, 450);
if(storageKey) sessionStorage.setItem(storageKey,'1');
}
var hintMaster = document.getElementById('crl2-tap-hint');
if(sessionStorage.getItem('crl2_hint_master')){
if(hintMaster) hintMaster.style.display='none';
} else {
setTimeout(function(){
document.querySelectorAll('.crl2__mc-prices-btn').forEach(function(b){ b.classList.add('crl2--attention'); });
}, 900);
document.querySelectorAll('.crl2__mc-btn,[data-crl2-hint],[data-crl2-about]').forEach(function(el){
el.addEventListener('click', function(){
crl2DismissHint('crl2-tap-hint','crl2_hint_master');
document.querySelectorAll('.crl2__mc-prices-btn').forEach(function(b){ b.classList.remove('crl2--attention'); });
}, {once:true});
});
}
function crl2ShowSvcHint(masterId) {
var hintId = 'crl2-svc-hint-' + masterId;
var el = document.getElementById(hintId);
if(!el) return;
if(sessionStorage.getItem('crl2_hint_svc_' + masterId)){
el.style.display='none'; return;
}
el.style.display='';
el.classList.remove('crl2--gone');
var panel = document.getElementById('crl2-sub-' + masterId);
if(panel) panel.querySelectorAll('.crl2__btn-primary').forEach(function(b){
b.classList.remove('crl2--attention');
void b.offsetWidth;
b.classList.add('crl2--attention');
});
if(panel) panel.querySelectorAll('[data-crl2-popup],.crl2__btn-primary,.crl2__btn-secondary').forEach(function(b){
b.addEventListener('click', function(){
crl2DismissHint(hintId,'crl2_hint_svc_' + masterId);
if(panel) panel.querySelectorAll('.crl2__btn-primary').forEach(function(x){ x.classList.remove('crl2--attention'); });
}, {once:true});
});
}
var origRevealOpen = window.crl2RevealOpen;
document.addEventListener('crl2:reveal', function(e){
if(e.detail && e.detail.master) crl2ShowSvcHint(e.detail.master);
});
document.querySelectorAll('[data-crl2-hint]').forEach(function(btn){
btn.addEventListener('click', function(){
var master = btn.getAttribute('data-crl2-hint');
if(master) setTimeout(function(){ crl2ShowSvcHint(master); }, 400);
});
});
})();
(function(){
var _scrollY=0;
function lockScroll(){
_scrollY=window.scrollY||window.pageYOffset;
document.body.style.overflow='hidden';
document.documentElement.style.overflow='hidden';
}
function unlockScroll(){
if(!document.querySelector('.crl2-overlay.crl2-open')){
document.body.style.overflow='';
document.documentElement.style.overflow='';
}
}
var mo = new MutationObserver(function(mutations){
mutations.forEach(function(m){
if(m.attributeName==='class'){
if(m.target.classList.contains('crl2-open')) lockScroll();
else unlockScroll();
}
});
});
document.querySelectorAll('.crl2-overlay').forEach(function(el){
mo.observe(el,{attributes:true});
});
document.querySelectorAll('[data-crl2-minfo-close]').forEach(function(btn){
btn.addEventListener('click',function(){
var ov=document.getElementById('crl2-minfo-overlay');
if(ov) ov.classList.remove('crl2-open');
unlockScroll();
});
});
var minfoOv=document.getElementById('crl2-minfo-overlay');
if(minfoOv){
minfoOv.addEventListener('click',function(e){
if(e.target===minfoOv){minfoOv.classList.remove('crl2-open');unlockScroll();}
});
}
document.addEventListener('keydown',function(e){
if(e.key==='Escape'){
document.querySelectorAll('.crl2-overlay.crl2-open').forEach(function(ov){
ov.classList.remove('crl2-open');
});
unlockScroll();
}
});
})();