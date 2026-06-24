(function () {
'use strict';

// Prevent browser from restoring scroll position on history.back()
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ── CONFIG ─────────────────────────────────────────────────────
var CONFIG = {
  locationId:   '1357963',
  apiBase:      'https://crocus-proxy.crocusbeautystudio.workers.dev/api/proxy',
  lang: 'de',
};

function trackingAttribution() {
  var keys = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var out = {};
  try {
    var params = new URLSearchParams(window.location.search || '');
    keys.forEach(function(key) {
      var value = params.get(key);
      if (value) {
        out[key] = value;
        localStorage.setItem('crocus_attr_' + key, value);
      } else {
        value = localStorage.getItem('crocus_attr_' + key);
        if (value) out[key] = value;
      }
    });
    if (Object.keys(out).length) localStorage.setItem('crocus_attr_last_touch', JSON.stringify(out));
  } catch (ex) {}
  return out;
}

var CRO_ATTR = trackingAttribution();

function servicePriceForTracking(svc) {
  if (!svc) return 0;
  if (svc.staff && svc.staff.length && cw.master) {
    for (var i = 0; i < svc.staff.length; i++) {
      if (Number(svc.staff[i].id) === Number(cw.master.id)) return Number(svc.staff[i].price_min || svc.price_min || 0) || 0;
    }
  }
  return Number(svc.price_min || svc.price_max || 0) || 0;
}

function bookingValueForTracking() {
  if (!cw.service) return 0;
  if (cw.service.id === KOMBI_SERVICE_ID && cw.comboRoute) return Number(routeTotalPrice(cw.comboRoute) || 0) || 0;
  return servicePriceForTracking(cw.service) + cw.addons.reduce(function(sum, addon) {
    return sum + servicePriceForTracking(addon);
  }, 0);
}

function extractAltegioRecordId(res) {
  var data = res && res.data;
  var record = Array.isArray(data) ? data[0] : data;
  return record && (record.record_id || record.id) ? String(record.record_id || record.id) : '';
}

function makeBookingEventId(res) {
  var recordId = extractAltegioRecordId(res);
  if (recordId) return 'crocus_booking_' + recordId;
  return [
    'crocus_booking',
    cw.service ? cw.service.id : 'service',
    cw.master ? cw.master.id : 'master',
    cw.date || 'date',
    (cw.time || 'time').replace(/\D/g, '')
  ].join('_');
}

// ── Masters — описания и уровни ────────────────────────────────
var MASTERS_META = {
  3020185: {
    level:  'Top Master',
    levelColor:  '#c9a87c',
    levelBg:     'rgba(201,168,124,0.13)',
    levelBorder: 'rgba(201,168,124,0.35)',
    tagline: 'Maniküre & Pediküre',
    bio: 'Unsere erfahrenste Meisterin — präzise, kreativ und immer ausgebucht.',
    skills: ['Maniküre', 'Pediküre', 'Nagelverlängerung', 'Designs'],
    cats: ['manikuere', 'pediküre', 'kombi'],
    avatar: 'https://static.tildacdn.com/tild3239-3933-4334-b362-386430646432/ChatGPT_Image_28__20.png',
  },
  3020186: {
    level:  'Master',
    levelColor:  '#c9748e',
    levelBg:     'rgba(201,116,142,0.13)',
    levelBorder: 'rgba(201,116,142,0.32)',
    tagline: 'Maniküre & Pediküre',
    bio: 'Sorgfältige Arbeit, bei der jeder Gellack sitzt wie am ersten Tag.',
    skills: ['Maniküre', 'Pediküre', 'Nagelverlängerung', 'Gellack'],
    cats: ['manikuere', 'pediküre', 'kombi'],
    avatar: 'https://static.tildacdn.com/tild6566-3434-4635-b363-656462633738/__2026-04-28_175455.png',
  },
  3020187: {
    level:  'Master',
    levelColor:  '#c9748e',
    levelBg:     'rgba(201,116,142,0.13)',
    levelBorder: 'rgba(201,116,142,0.32)',
    tagline: 'Maniküre & Pediküre',
    bio: 'Herzlich und präzise — man geht mit perfekten Nägeln und guter Laune raus.',
    skills: ['Maniküre', 'Pediküre', 'Gellack', 'Nagelverlängerung'],
    cats: ['manikuere', 'pediküre', 'kombi'],
  },
  3047989: {
    level:  'Lash Artistin',
    levelColor:  '#c9a87c',
    levelBg:     'rgba(201,168,124,0.13)',
    levelBorder: 'rgba(201,168,124,0.35)',
    tagline: 'Wimpernverlängerung & Lifting',
    bio: 'Albina ist spezialisiert auf individuelle Lash-Looks — von natürlich bis ausdrucksstark.',
    skills: ['Classic Lashes', '3D–6D Volumen', 'Wispy', 'Wet-Look'],
    cats: ['wimpern'],
    avatar: 'https://cdn.jsdelivr.net/gh/chistyartem-blip/crocus-widget@0df00f6/assets/albina.webp',
  },
};

var HIDDEN_STAFF_IDS = [Number(['3020', '188'].join('')), 3020006, 3047641];
var ALWAYS_SHOW_STAFF_IDS = [3047989];
var MASTER_ORDER = { 3020185: 10, 3020186: 20, 3020187: 30, 3047989: 999 };
function isHiddenStaffId(staffId) {
  return HIDDEN_STAFF_IDS.indexOf(Number(staffId)) !== -1;
}

function sortMasters(list) {
  return (list || []).slice().sort(function(a, b) {
    var ao = MASTER_ORDER[Number(a && a.id)] || 500;
    var bo = MASTER_ORDER[Number(b && b.id)] || 500;
    if (ao !== bo) return ao - bo;
    return String((a && a.name) || '').localeCompare(String((b && b.name) || ''));
  });
}

// ── Категории и маппинг услуг ──────────────────────────────────
var HIDDEN_STAFF_NAME_RE = /(^|[\s._-])(art|artem|artyom|artur|artsiom|арт|артем|артём)([\s._-]|$)/i;
var STATIC_MASTER_NAMES = {
  3020185: 'Diana',
  3020186: 'Nelia',
  3020187: 'Sofia',
  3047989: 'Albina',
};

function isHiddenStaff(staff) {
  if (!staff) return false;
  var id = Number(staff.id || staff.staff_id || staff.master_id || 0);
  if (HIDDEN_STAFF_IDS.indexOf(id) !== -1) return true;
  var name = [
    staff.name,
    staff.fullname,
    staff.firstname,
    staff.lastname,
    staff.title,
    staff.login,
    staff.email,
  ].filter(Boolean).join(' ');
  return HIDDEN_STAFF_NAME_RE.test(name);
}

function visibleMasters(list) {
  return (list || []).filter(function(master) {
    if (!master) return false;
    if (isHiddenStaff(master)) return false;
    if (master.bookable === false && ALWAYS_SHOW_STAFF_IDS.indexOf(Number(master.id)) === -1) return false;
    return true;
  });
}

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
  {
    key: 'wimpern',
    label: 'Wimpern',
    img: 'https://cdn.jsdelivr.net/gh/chistyartem-blip/crocus-widget@a2499dd/assets/lash.webp',
    fallbackImg: 'https://cdn.jsdelivr.net/gh/chistyartem-blip/crocus-widget@a2499dd/assets/lashes.webp',
    desc: 'Classic · 2D · 3D · Volume · Lifting — natürlich oder dramatisch.',
    serviceIds: [13485763,13485764,13485765,13485766,13485767,13485768,13485769,13622817,13485770,13485771,13485772,13485773],
  },
];

// Все возможные допы (French, Babyboomer, Stiletto, Design, Gel-Lack, Mandel, Lange Nägel)
// Länge über 2 (13493659) — отключён (inactive), Lange Nägel (13493664) — активен
// Nageldesign (13485759) — исключён (дубль дороже), оставлен только Design 5€ (13502360)
var ADDON_IDS = [13485756, 13485757, 13485758, 13502359, 13502360, 13502395, 13493664];

// Услуги БЕЗ допов совсем
// 13485752 = Гигиенический маникюр
// 13485760 = Гигиенический педикюр
var NO_ADDON_SERVICE_IDS = [13485752, 13485760];

// Допы по услугам (null = все доступные допы для этого мастера)
// Педикюр+шеллак (13485761) — только French
// Маникюр+укрепление (13485753) — French, Stiletto, Design, Gel-Lack, Lange Nägel (без Babyboomer, без Mandel)
// Коррекция (13485754) — French, Stiletto, Design, Gel-Lack, Lange Nägel (без Babyboomer, без Mandel)
// Наращивание (13485755) — French, Stiletto, Design, Gel-Lack, Lange Nägel (без Babyboomer, без Mandel)
var ADDON_IDS_BY_SERVICE = {
  13485761: [13485756],                                       // Педикюр+шеллак: только French
  13485753: [13485756, 13485758, 13502359, 13502360, 13493664], // Маникюр+укрепление
  13485754: [13485756, 13485758, 13502359, 13502360, 13493664], // Коррекция
  13485755: [13485756, 13485758, 13502359, 13502360, 13493664], // Наращивание
  13485762: [13485756], // Комби: French (Hände + Füße) — обрабатывается через KOMBI_VIRTUAL_ADDONS
};

// Для Комби — виртуальные аддоны (French дважды с разными метками)
var KOMBI_VIRTUAL_ADDONS = [
  { _variantKey: 'french_hands', id: 13485756, title: 'French (Hände)', _kombiLabel: 'French (Hände)' },
  { _variantKey: 'french_feet',  id: 13485756, title: 'French (Füße)',  _kombiLabel: 'French (Füße)' },
];
var WIMPER_SERVICE_GROUPS = [
  { key: 'neuset', title: 'Neuset', note: '90 Min', ids: [13485763, 13485764, 13485765, 13485766, 13485767] },
  { key: 'korrektur', title: 'Korrektur', note: '60 Min', ids: [13485768, 13485769] },
  { key: 'lifting', title: 'Lifting', note: '40 Min', ids: [13622817] },
  { key: 'extras', title: 'Extras', note: 'optional', ids: [13485770, 13485771, 13485772, 13485773] },
];
var KOMBI_SERVICE_ID = 13485762;
var KOMBI_MANI_SERVICE_ID = 13485753;
var KOMBI_PEDI_SERVICE_ID = 13485761;
var KOMBI_STAFF_IDS = [3020185, 3020186, 3020187];

// Stale test reservations are not hard-coded here. Only proven 409 slots
// from real book_record checks are blocked below.
var TEMP_BLOCKED_RECORDS = [];
var TEMP_BLOCK_GUARD_MS = 15 * 60 * 1000;
var TEMP_UNBOOKABLE_SINGLE_SLOTS = [
  '3020187|13485753|2026-06-24T13:45:00+02:00',
  '3020187|13485753|2026-06-24T14:00:00+02:00',
  '3020187|13485753|2026-06-24T14:15:00+02:00',
  '3020187|13485754|2026-06-24T13:45:00+02:00',
  '3020187|13485754|2026-06-24T14:00:00+02:00',
  '3020187|13485754|2026-06-24T14:15:00+02:00',
  '3020187|13485755|2026-06-24T13:45:00+02:00',
  '3020187|13485755|2026-06-24T14:00:00+02:00',
  '3020187|13485755|2026-06-24T14:15:00+02:00',
  '3020187|13485753|2026-06-25T14:30:00+02:00',
  '3020187|13485753|2026-06-25T14:45:00+02:00',
  '3020187|13485753|2026-06-25T15:00:00+02:00',
  '3020187|13485753|2026-06-25T15:15:00+02:00',
  '3020187|13485753|2026-06-25T15:30:00+02:00',
  '3020187|13485754|2026-06-25T14:30:00+02:00',
  '3020187|13485754|2026-06-25T14:45:00+02:00',
  '3020187|13485754|2026-06-25T15:00:00+02:00',
  '3020187|13485754|2026-06-25T15:15:00+02:00',
  '3020187|13485754|2026-06-25T15:30:00+02:00',
  '3020187|13485755|2026-06-25T14:30:00+02:00',
  '3020187|13485755|2026-06-25T14:45:00+02:00',
  '3020187|13485755|2026-06-25T15:00:00+02:00',
  '3020187|13485755|2026-06-25T15:15:00+02:00',
];

// Mandel-Form (13502395) — только для Nelia и Sofia
var MANDEL_STAFF_IDS = [3020186, 3020187];
// Stiletto (13485758) — Diana, Nelia, Sofia (все мастера маникюра)
var STILETTO_STAFF_IDS = [3020185, 3020186, 3020187];
// Babyboomer (13485757) — только Diana
var BABYBOOMER_STAFF_IDS = [3020185];

// Допы показываются одинаково для всех разрешённых услуг — доступность и цены из Altegio API (_addonObjs)

// Override-названия аддонов по ID (заменяют API title если совпадает)
var ADDON_NAME_OVERRIDE = {
  13485756: 'French',
  13485757: 'Babyboomer',
  13485758: 'Stiletto-Form',
  13485759: 'Nageldesign',
  13502359: 'Gel-Lack (Farbe)',
  13502360: 'Design',
  13502395: 'Mandel-Form',
  13493664: 'Lange Nagel',
};

// Статические данные аддонов — используются как немедленный fallback если API пуст
var ADDON_STATIC_DATA = [
  { id: 13485756, title: 'French',           price_min: 5  },
  { id: 13485757, title: 'Babyboomer',        price_min: 10 },
  { id: 13485758, title: 'Stiletto-Form',     price_min: 10 },
  { id: 13502359, title: 'Gel-Lack (Farbe)',  price_min: 5  },
  { id: 13502360, title: 'Design',            price_min: 5  },
  { id: 13502395, title: 'Mandel-Form',       price_min: 5  },
  { id: 13493664, title: 'Lange Nagel',       price_min: 10 },
];
function addonDisplayName(addon) {
  if (addon._kombiLabel) return addon._kombiLabel;
  return ADDON_NAME_OVERRIDE[addon.id] || addon.title;
}

// ── API ────────────────────────────────────────────────────────
function apiGet(path, params) {
  // Proxy URL: /api/proxy?path=<endpoint>&<other params>
  var cleanPath = path.replace(/^\//, '');
  var url = CONFIG.apiBase + '?path=' + encodeURIComponent(cleanPath);
  if (params) {
    var qs = Object.keys(params).map(function(k) {
      var v = params[k];
      if (Array.isArray(v)) return v.map(function(i){ return encodeURIComponent(k+'[]')+'='+encodeURIComponent(i); }).join('&');
      return encodeURIComponent(k)+'='+encodeURIComponent(v);
    }).join('&');
    if (qs) url += '&' + qs;
  }
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, 10000);
  return fetch(url, {
    signal: ctrl.signal,
    headers: { 'Accept': 'application/vnd.api.v2+json', 'Accept-Language': CONFIG.lang }
  }).then(function(r){ clearTimeout(timer); return r.json(); })
    .catch(function(e){ clearTimeout(timer); throw e; });
}

function apiPost(path, body) {
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, 10000);
  return fetch(CONFIG.apiBase + '?path=' + encodeURIComponent(path.replace(/^\//, '')), {
    method: 'POST',
    signal: ctrl.signal,
    headers: {
      'Accept':           'application/vnd.api.v2+json',
      'Content-Type':     'application/json',
      'Accept-Language':  CONFIG.lang,
    },
    body: JSON.stringify(body),
  }).then(function(r){ clearTimeout(timer); return r.json(); })
    .catch(function(e){ clearTimeout(timer); throw e; });
}

// ── Phone dial countries ───────────────────────────────────────
var PHONE_COUNTRIES = [
  // ── По умолчанию ──────────────────────────────────────────────
  { code: '+49',  flag: '\u{1F1E9}\u{1F1EA}', name: 'Deutschland',             short: 'DE' },
  // ── Остальные по алфавиту ─────────────────────────────────────
  { code: '+20',  flag: '\u{1F1EA}\u{1F1EC}', name: 'Ägypten',                 short: 'EG' },
  { code: '+54',  flag: '\u{1F1E6}\u{1F1F7}', name: 'Argentinien',             short: 'AR' },
  { code: '+374', flag: '\u{1F1E6}\u{1F1F2}', name: 'Armenien',                short: 'AM' },
  { code: '+994', flag: '\u{1F1E6}\u{1F1FF}', name: 'Aserbaidschan',           short: 'AZ' },
  { code: '+61',  flag: '\u{1F1E6}\u{1F1FA}', name: 'Australien',              short: 'AU' },
  { code: '+32',  flag: '\u{1F1E7}\u{1F1EA}', name: 'Belgien',                 short: 'BE' },
  { code: '+375', flag: '\u{1F1E7}\u{1F1FE}', name: 'Belarus',                 short: 'BY' },
  { code: '+387', flag: '\u{1F1E7}\u{1F1E6}', name: 'Bosnien',                 short: 'BA' },
  { code: '+55',  flag: '\u{1F1E7}\u{1F1F7}', name: 'Brasilien',               short: 'BR' },
  { code: '+86',  flag: '\u{1F1E8}\u{1F1F3}', name: 'China',                   short: 'CN' },
  { code: '+45',  flag: '\u{1F1E9}\u{1F1F0}', name: 'Dänemark',                short: 'DK' },
  { code: '+372', flag: '\u{1F1EA}\u{1F1EA}', name: 'Estland',                 short: 'EE' },
  { code: '+358', flag: '\u{1F1EB}\u{1F1EE}', name: 'Finnland',                short: 'FI' },
  { code: '+33',  flag: '\u{1F1EB}\u{1F1F7}', name: 'Frankreich',              short: 'FR' },
  { code: '+995', flag: '\u{1F1EC}\u{1F1EA}', name: 'Georgien',                short: 'GE' },
  { code: '+30',  flag: '\u{1F1EC}\u{1F1F7}', name: 'Griechenland',            short: 'GR' },
  { code: '+44',  flag: '\u{1F1EC}\u{1F1E7}', name: 'Großbritannien',          short: 'GB' },
  { code: '+91',  flag: '\u{1F1EE}\u{1F1F3}', name: 'Indien',                  short: 'IN' },
  { code: '+62',  flag: '\u{1F1EE}\u{1F1E9}', name: 'Indonesien',              short: 'ID' },
  { code: '+353', flag: '\u{1F1EE}\u{1F1EA}', name: 'Irland',                  short: 'IE' },
  { code: '+354', flag: '\u{1F1EE}\u{1F1F8}', name: 'Island',                  short: 'IS' },
  { code: '+972', flag: '\u{1F1EE}\u{1F1F1}', name: 'Israel',                  short: 'IL' },
  { code: '+39',  flag: '\u{1F1EE}\u{1F1F9}', name: 'Italien',                 short: 'IT' },
  { code: '+81',  flag: '\u{1F1EF}\u{1F1F5}', name: 'Japan',                   short: 'JP' },
  { code: '+1',   flag: '\u{1F1E8}\u{1F1E6}', name: 'Kanada',                  short: 'CA' },
  { code: '+7',   flag: '\u{1F1F0}\u{1F1FF}', name: 'Kasachstan',              short: 'KZ' },
  { code: '+996', flag: '\u{1F1F0}\u{1F1EC}', name: 'Kirgisistan',             short: 'KG' },
  { code: '+385', flag: '\u{1F1ED}\u{1F1F7}', name: 'Kroatien',                short: 'HR' },
  { code: '+371', flag: '\u{1F1F1}\u{1F1FB}', name: 'Lettland',                short: 'LV' },
  { code: '+370', flag: '\u{1F1F1}\u{1F1F9}', name: 'Litauen',                 short: 'LT' },
  { code: '+352', flag: '\u{1F1F1}\u{1F1FA}', name: 'Luxemburg',               short: 'LU' },
  { code: '+212', flag: '\u{1F1F2}\u{1F1E6}', name: 'Marokko',                 short: 'MA' },
  { code: '+52',  flag: '\u{1F1F2}\u{1F1FD}', name: 'Mexiko',                  short: 'MX' },
  { code: '+373', flag: '\u{1F1F2}\u{1F1E9}', name: 'Moldau',                  short: 'MD' },
  { code: '+64',  flag: '\u{1F1F3}\u{1F1FF}', name: 'Neuseeland',              short: 'NZ' },
  { code: '+31',  flag: '\u{1F1F3}\u{1F1F1}', name: 'Niederlande',             short: 'NL' },
  { code: '+47',  flag: '\u{1F1F3}\u{1F1F4}', name: 'Norwegen',                short: 'NO' },
  { code: '+43',  flag: '\u{1F1E6}\u{1F1F9}', name: 'Österreich',              short: 'AT' },
  { code: '+92',  flag: '\u{1F1F5}\u{1F1F0}', name: 'Pakistan',                short: 'PK' },
  { code: '+63',  flag: '\u{1F1F5}\u{1F1ED}', name: 'Philippinen',             short: 'PH' },
  { code: '+48',  flag: '\u{1F1F5}\u{1F1F1}', name: 'Polen',                   short: 'PL' },
  { code: '+351', flag: '\u{1F1F5}\u{1F1F9}', name: 'Portugal',                short: 'PT' },
  { code: '+40',  flag: '\u{1F1F7}\u{1F1F4}', name: 'Rumänien',                short: 'RO' },
  { code: '+7',   flag: '\u{1F1F7}\u{1F1FA}', name: 'Russland',                short: 'RU' },
  { code: '+966', flag: '\u{1F1F8}\u{1F1E6}', name: 'Saudi-Arabien',           short: 'SA' },
  { code: '+46',  flag: '\u{1F1F8}\u{1F1EA}', name: 'Schweden',                short: 'SE' },
  { code: '+41',  flag: '\u{1F1E8}\u{1F1ED}', name: 'Schweiz',                 short: 'CH' },
  { code: '+381', flag: '\u{1F1F7}\u{1F1F8}', name: 'Serbien',                 short: 'RS' },
  { code: '+65',  flag: '\u{1F1F8}\u{1F1EC}', name: 'Singapur',                short: 'SG' },
  { code: '+421', flag: '\u{1F1F8}\u{1F1F0}', name: 'Slowakei',                short: 'SK' },
  { code: '+386', flag: '\u{1F1F8}\u{1F1EE}', name: 'Slowenien',               short: 'SI' },
  { code: '+34',  flag: '\u{1F1EA}\u{1F1F8}', name: 'Spanien',                 short: 'ES' },
  { code: '+27',  flag: '\u{1F1FF}\u{1F1E6}', name: 'Südafrika',               short: 'ZA' },
  { code: '+82',  flag: '\u{1F1F0}\u{1F1F7}', name: 'Südkorea',                short: 'KR' },
  { code: '+992', flag: '\u{1F1F9}\u{1F1EF}', name: 'Tadschikistan',           short: 'TJ' },
  { code: '+66',  flag: '\u{1F1F9}\u{1F1ED}', name: 'Thailand',                short: 'TH' },
  { code: '+420', flag: '\u{1F1E8}\u{1F1FF}', name: 'Tschechien',              short: 'CZ' },
  { code: '+90',  flag: '\u{1F1F9}\u{1F1F7}', name: 'Türkei',                  short: 'TR' },
  { code: '+993', flag: '\u{1F1F9}\u{1F1F2}', name: 'Turkmenistan',            short: 'TM' },
  { code: '+380', flag: '\u{1F1FA}\u{1F1E6}', name: 'Ukraine',                 short: 'UA' },
  { code: '+36',  flag: '\u{1F1ED}\u{1F1FA}', name: 'Ungarn',                  short: 'HU' },
  { code: '+998', flag: '\u{1F1FA}\u{1F1FF}', name: 'Usbekistan',              short: 'UZ' },
  { code: '+971', flag: '\u{1F1E6}\u{1F1EA}', name: 'Vereinigte Arab. Emirate', short: 'AE' },
  { code: '+84',  flag: '\u{1F1FB}\u{1F1F3}', name: 'Vietnam',                 short: 'VN' },
  { code: '+1',   flag: '\u{1F1FA}\u{1F1F8}', name: 'USA',                     short: 'US' },
];
// Mobile select options: flag + code + full name (readable in native picker)
var PHONE_DIAL_OPTIONS = PHONE_COUNTRIES.map(function(c){
  var sel = c.code === '+49' ? ' selected' : '';
  return '<option value="'+c.code+'"'+sel+'>'+c.flag+' '+c.code+' '+c.short+'</option>';
}).join('');

// Вернуть выбранный код страны из select (по id) или '+49' по умолчанию
function getDialCode(selectId) {
  var el = document.getElementById(selectId);
  return el ? el.value : '+49';
}

// Разобрать сохранённый номер вида +49172... → { dial: '+49', local: '172...' }
function parseStoredPhone(phone) {
  if (!phone) return { dial: '+49', local: '' };
  // Сортируем коды по убыванию длины чтобы +380 матчился раньше +38
  var codes = PHONE_COUNTRIES.map(function(c){ return c.code; }).sort(function(a,b){ return b.length - a.length; });
  for (var i = 0; i < codes.length; i++) {
    if (phone.indexOf(codes[i]) === 0) {
      return { dial: codes[i], local: phone.slice(codes[i].length) };
    }
  }
  return { dial: '+49', local: phone.replace(/^\+49/, '') };
}

// ── CSS ────────────────────────────────────────────────────────
var css = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500;600&display=swap');
#crocus-modal *{box-sizing:border-box;}

#crocus-fab-wrap{position:fixed;bottom:32px;right:32px;z-index:2147483638;width:58px;height:58px;display:flex;align-items:center;justify-content:center}
#crocus-fab{position:absolute;right:0;top:0;width:58px;height:58px;border-radius:50px;background:linear-gradient(145deg,#1c0d16 0%,#2e1222 100%);border:1px solid rgba(255,255,255,.13);cursor:pointer;box-shadow:0 4px 28px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.07);transition:width .5s cubic-bezier(.4,0,.2,1),border-color .3s,box-shadow .3s;animation:fabIn .7s cubic-bezier(.34,1.56,.64,1) both;overflow:hidden;display:flex;align-items:center;justify-content:flex-end;padding:0}
#crocus-fab:hover{width:196px;border-color:rgba(201,168,124,.5);box-shadow:0 8px 36px rgba(123,45,78,.5),inset 0 1px 0 rgba(255,255,255,.09)}
#crocus-fab:hover .crocus-fab-text{opacity:1;transform:translateX(0)}
#crocus-fab:hover + .crocus-fab-rings .crocus-fab-ring{animation-play-state:paused;opacity:0;transition:opacity .4s}
.crocus-fab-icon{width:58px;height:58px;min-width:58px;flex-shrink:0;display:grid;place-items:center}
.crocus-fab-icon img{width:26px;height:26px;object-fit:contain;filter:brightness(0) invert(1) drop-shadow(0 0 8px rgba(255,255,255,.8)) drop-shadow(0 0 18px rgba(255,255,255,.35));display:block}
.crocus-fab-text{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;letter-spacing:.04em;color:#fdfaf8;opacity:0;transform:translateX(-8px);white-space:nowrap;transition:opacity .28s .15s,transform .28s .15s;padding-right:0;margin-right:18px;order:-1;flex-shrink:0}
#crocus-fab::before{content:'';position:absolute;inset:0;border-radius:50px;background:radial-gradient(ellipse at 50% 110%,rgba(201,168,124,.12) 0%,transparent 65%);pointer-events:none}
.crocus-fab-rings{position:absolute;top:50%;right:0;width:58px;height:58px;margin-top:-29px;pointer-events:none}
.crocus-fab-ring{position:absolute;inset:0;border-radius:50%;animation:cwRing 3.6s ease-out infinite}
.crocus-fab-ring:nth-child(1){border:1.5px solid rgba(123,45,78,.80);animation-delay:0s}
.crocus-fab-ring:nth-child(2){border:1px solid rgba(123,45,78,.50);animation-delay:1.2s}
.crocus-fab-ring:nth-child(3){border:1px solid rgba(201,168,124,.30);animation-delay:2.4s}
@keyframes cwRing{0%{transform:scale(1);opacity:.85}55%{opacity:.25}100%{transform:scale(2.5);opacity:0}}
/* ── Phone wrap ── */
.cw-phone-wrap{display:flex;align-items:center;background:rgba(61,43,31,.04);border:1px solid rgba(61,43,31,.09);border-radius:10px;overflow:visible;transition:border-color .15s;position:relative}
.cw-phone-wrap:focus-within{border-color:rgba(61,43,31,.45)}
.cw-phone-wrap input{background:transparent;border:none;border-radius:0;padding:11px 13px;color:#fdfaf8;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;width:100%;box-sizing:border-box;align-self:stretch}
.cw-phone-wrap input::placeholder{color:rgba(253,250,248,.22)}
/* Native select — visible on mobile only */
.cw-phone-dial{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;color:#fdfaf8;padding:0 8px 0 10px;background:rgba(255,255,255,.08);border:none;border-right:1px solid rgba(255,255,255,.10);white-space:nowrap;flex-shrink:0;cursor:pointer;outline:none;appearance:none;-webkit-appearance:none;align-self:stretch;min-width:80px;letter-spacing:.01em;display:none}
/* Custom dropdown trigger — desktop only */
.cw-dial-btn{display:flex;align-items:center;gap:5px;padding:0 10px 0 11px;background:rgba(255,255,255,.08);border:none;border-right:1px solid rgba(255,255,255,.10);border-radius:0;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;color:#fdfaf8;white-space:nowrap;flex-shrink:0;align-self:stretch;min-width:76px;transition:background .15s;outline:none;-webkit-tap-highlight-color:transparent}
.cw-dial-btn:hover,.cw-dial-btn.open{background:rgba(255,255,255,.13)}
.cw-dial-btn__flag{font-size:16px;line-height:1;flex-shrink:0}
.cw-dial-btn__code{font-size:13px;font-weight:600;letter-spacing:.01em}
.cw-dial-btn__arrow{font-size:9px;opacity:.5;margin-left:1px;transition:transform .15s}
.cw-dial-btn.open .cw-dial-btn__arrow{transform:rotate(180deg)}
/* Dropdown panel */
.cw-dial-drop{position:absolute;left:0;top:calc(100% + 4px);z-index:9999;background:#1e1018;border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.55);overflow:hidden;min-width:200px;display:none}
.cw-dial-drop.open{display:block}
.cw-dial-search{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.07)}
.cw-dial-search input{background:transparent;border:none;outline:none;font-family:'DM Sans',sans-serif;font-size:13px;color:#fdfaf8;width:100%;placeholder-color:rgba(253,250,248,.35)}
.cw-dial-search input::placeholder{color:rgba(253,250,248,.35)}
.cw-dial-search-icon{font-size:13px;opacity:.4;flex-shrink:0}
.cw-dial-list{max-height:200px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.15) transparent}
.cw-dial-list::-webkit-scrollbar{width:4px}
.cw-dial-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:2px}
.cw-dial-item{display:flex;align-items:center;gap:9px;padding:8px 12px;cursor:pointer;transition:background .12s;font-family:'DM Sans',sans-serif;font-size:13px}
.cw-dial-item:hover{background:rgba(255,255,255,.07)}
.cw-dial-item.sel{background:rgba(255,255,255,.10)}
.cw-dial-item__flag{font-size:16px;flex-shrink:0;line-height:1}
.cw-dial-item__code{font-weight:600;color:#fdfaf8;flex-shrink:0;min-width:34px}
.cw-dial-item__name{color:rgba(253,250,248,.55);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Mobile: show native select, hide custom */
@media(max-width:600px){
  .cw-phone-dial{display:flex!important;align-items:center}
  .cw-dial-btn,.cw-dial-drop{display:none!important}
  .cw-phone-wrap{overflow:hidden}
}@keyframes logoPulse{0%,100%{filter:drop-shadow(0 0 4px rgba(255,255,255,.55)) drop-shadow(0 0 10px rgba(123,45,78,.60))}50%{filter:drop-shadow(0 0 8px rgba(255,255,255,.90)) drop-shadow(0 0 20px rgba(123,45,78,.90))}}
@keyframes fabIn{from{opacity:0;transform:translateY(24px) scale(.78)}to{opacity:1;transform:translateY(0) scale(1)}}
#crocus-fab-mobile{display:none!important}
@media(max-width:600px){
  #crocus-fab-wrap{display:none!important}
  #crocus-fab-mobile{display:flex!important;position:fixed;bottom:28px;right:14px;z-index:2147483638;width:52px;flex-direction:column;align-items:center;gap:4px}
  #crocus-fab-mobile-btn{position:relative;z-index:1;width:38px;height:38px;min-width:38px;min-height:38px;border-radius:50%;background:linear-gradient(145deg,#1c0d16 0%,#2e1222 100%);border:1px solid rgba(255,255,255,.13);cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:fabIn .7s cubic-bezier(.34,1.56,.64,1) both;flex-shrink:0;padding:0;box-sizing:border-box;margin-top:6px}
  #crocus-fab-mobile-btn img{width:28px;height:28px;object-fit:contain;filter:brightness(0) invert(1) drop-shadow(0 0 8px rgba(255,255,255,.8)) drop-shadow(0 0 18px rgba(255,255,255,.35));display:block}
  .cfm-ring{position:absolute;border-radius:50%;animation:cwRing 3.6s ease-out infinite}
  .cfm-ring:nth-child(1){inset:0;border:0.8px solid rgba(123,45,78,.80);animation-delay:0s}
  .cfm-ring:nth-child(2){inset:0;border:0.6px solid rgba(123,45,78,.50);animation-delay:1.2s}
  .cfm-ring:nth-child(3){inset:0;border:0.5px solid rgba(201,168,124,.30);animation-delay:2.4s}
}
#crocus-backdrop{display:none;position:fixed;inset:0;z-index:2147483639;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);opacity:0;transition:opacity .25s}
#crocus-backdrop.open{display:block}
#crocus-backdrop.visible{opacity:1}
#crocus-modal{position:fixed;top:0;right:0;z-index:2147483640;width:440px;max-width:100vw;height:100dvh;background:#0f0a0d;border-radius:20px 0 0 20px;box-shadow:-8px 0 60px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;transform:translateX(100%);transition:transform .32s cubic-bezier(.32,.72,0,1);visibility:hidden;padding-bottom:env(safe-area-inset-bottom)}
#crocus-modal.open{visibility:visible}
#crocus-modal.open{transform:translateX(0)}
@media(max-width:480px){
  /* Modal — bottom sheet */
  #crocus-modal{width:100vw;border-radius:20px 20px 0 0;height:100dvh;transform:translateY(100%)}
  #crocus-modal.open{transform:translateY(0)}
  #crocus-fab{bottom:20px;right:16px;padding:12px 18px 12px 14px;font-size:13px}

  /* Header compact */
  #crocus-modal-header{padding:12px 14px 10px}
  .crocus-modal-logo{width:34px;height:34px}
  .crocus-modal-title{font-size:13.5px}

  /* Progress — smaller dots, hide long labels */
  #crocus-progress{padding:8px 10px 7px;gap:0}
  .cp-dot{width:20px;height:20px;font-size:9px}
  .cp-label{font-size:7.5px;letter-spacing:.03em}

  /* Body padding */
  #crocus-body{padding:14px 14px 32px}

  /* Titles */
  .cw-title{font-size:20px}
  .cw-sub{font-size:11.5px;margin-bottom:10px}

  /* Calendar — bigger touch targets */
  .cw-cal-grid{gap:3px;padding:6px 6px 8px}
  .cw-day{font-size:13px;border-radius:8px;min-height:38px;min-width:0}

  /* Times — 3 columns on very small screens */
  .cw-time-grid{grid-template-columns:repeat(3,1fr);gap:7px}
  .cw-time{padding:10px 4px;font-size:13px;min-height:42px;display:flex;align-items:center;justify-content:center}

  /* Service buttons */
  .cw-svc-btn{padding:12px 12px}
  .cw-svc-name{font-size:13px}
  .cw-svc-price{font-size:18px}

  /* Master cards */
  .cw-master-card{border-radius:11px}

  /* Addon buttons */
  .cw-addon-btn{padding:11px 12px}

  /* Summary */
  .cw-summary{padding:11px 12px}

  /* Confirm button */
  .cw-btn-confirm{padding:14px 20px;font-size:13.5px}

  /* Input fields — 16px prevents iOS auto-zoom */
  .cw-field input{font-size:16px}
  .cw-phone-wrap input{font-size:16px}

  /* Phone select (native, mobile only) */
  .cw-phone-dial{min-height:44px;font-size:16px;display:flex!important;align-items:center;padding:0 6px 0 10px;min-width:72px}

  /* Cat cards */
  .cw-cat-card{padding:11px 12px;gap:11px}
  .cw-cat-label{font-size:16px}

  /* Calendar days — enforce square with minimum tap size */
  .cw-day{min-height:36px;aspect-ratio:1}

  /* Confirm button full tap area */
  .cw-btn-confirm{min-height:50px}

  /* Skip button tap area */
  .cw-skip-btn{min-height:44px}
}

/* Header */
#crocus-modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 13px;background:rgba(255,255,255,.02);flex-shrink:0}
.crocus-modal-brand{display:flex;align-items:center;gap:13px}
.crocus-modal-logo{width:40px;height:40px;border-radius:10px;object-fit:contain;background:rgba(123,45,78,.15);border:1px solid rgba(255,255,255,.12);filter:drop-shadow(0 0 4px rgba(255,255,255,.55)) drop-shadow(0 0 10px rgba(123,45,78,.60));animation:logoPulse 2.8s ease-in-out infinite;padding:2px;box-sizing:border-box}
.crocus-modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:400;color:#fdfaf8;letter-spacing:.02em;display:block}
.crocus-modal-sub{font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:rgba(253,250,248,.35);letter-spacing:.08em;text-transform:uppercase;display:block}
#crocus-close{width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:rgba(253,250,248,.5);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
#crocus-close:hover{background:rgba(255,255,255,.10);color:#fdfaf8}

/* Progress */
#crocus-progress{display:flex;align-items:center;justify-content:center;padding:11px 20px 9px;gap:0;flex-shrink:0}
.cp-step{display:flex;flex-direction:column;align-items:center;gap:3px;position:relative;flex:1;cursor:default}.cp-step.done{cursor:pointer}.cp-step.done:hover .cp-dot{background:rgba(201,168,124,.25);border-color:#c9a87c;box-shadow:0 0 10px rgba(201,168,124,.35)}.cp-step.done:hover .cp-label{color:rgba(253,250,248,.75)}
.cp-dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:600;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);color:rgba(253,250,248,.28);transition:all .25s}
.cp-step.active .cp-dot{background:#7B2D4E;border-color:#7B2D4E;color:#fff;box-shadow:0 0 12px rgba(123,45,78,.5)}
.cp-step.done .cp-dot{background:rgba(201,168,124,.13);border-color:#c9a87c;color:#c9a87c}
.cp-label{font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:rgba(253,250,248,.22);font-family:'DM Sans',sans-serif;white-space:nowrap}
.cp-step.active .cp-label,.cp-step.done .cp-label{color:rgba(253,250,248,.55)}
.cp-line{position:absolute;top:10px;left:calc(50% + 13px);right:calc(-50% + 13px);height:1px;background:transparent;z-index:0;transition:background .3s}
.cp-line.filled{background:transparent}

/* Body */
#crocus-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:18px 18px 28px;scrollbar-width:none;box-sizing:border-box;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}
#crocus-body::-webkit-scrollbar{display:none}
.cw-step{display:none;animation:stepIn .2s ease-out both}
.cw-step.active{display:block}
@keyframes stepIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
.cw-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:23px;font-weight:300;color:#fdfaf8;letter-spacing:-.01em;margin:0 0 3px}
.cw-sub{font-family:'DM Sans',sans-serif;font-size:12px;color:rgba(253,250,248,.38);margin:0 0 14px;line-height:1.5}
.cw-sub strong{color:#c9a87c;font-weight:500}
.cw-nav{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.cw-back{background:none;border:none;color:rgba(253,250,248,.35);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;padding:0;transition:color .15s;display:flex;align-items:center;gap:4px}
.cw-back:hover{color:#c9a87c}

/* Loader / Error */
.cw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:10px}
.cw-spinner{width:28px;height:28px;border:2px solid rgba(123,45,78,.18);border-top-color:#7B2D4E;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.cw-loader-text{font-family:'DM Sans',sans-serif;font-size:11.5px;color:rgba(253,250,248,.28)}
.cw-error{background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.18);border-radius:11px;padding:13px;text-align:center;font-family:'DM Sans',sans-serif;font-size:12.5px;color:#fca5a5;margin-top:14px}

/* ── Step 1: Masters ── */
.cw-masters{display:flex;flex-direction:column;gap:7px}
.cw-master-card{width:100%;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:13px;cursor:pointer;text-align:left;color:inherit;font-family:inherit;overflow:hidden;transition:all .22s;padding:0;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.cw-master-card:hover{border-color:rgba(201,168,124,.30);background:rgba(201,168,124,.04);transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.38)}
.cw-master-card.selected{border-color:rgba(123,45,78,.55);background:rgba(123,45,78,.06)}
.cw-master-top-row{display:flex;align-items:center;gap:10px;padding:10px 12px 0}
.cw-master-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.08);background:#1a0f15}
.cw-master-info{flex:1;min-width:0}
.cw-master-name{font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:#fdfaf8;margin-bottom:2px}
.cw-master-tagline{font-family:'Cormorant Garamond',Georgia,serif;font-size:12.5px;font-style:italic;color:rgba(253,250,248,.50);line-height:1.3}
.cw-lvl-badge{display:inline-block;font-family:'DM Sans',sans-serif;font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 8px;border-radius:20px;margin-top:4px}
.cw-master-bio-wrap{padding:7px 12px 10px}
.cw-master-bio{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(253,250,248,.42);line-height:1.5;margin:0 0 6px}
.cw-master-skills{display:flex;flex-wrap:wrap;gap:4px}
.cw-master-slot{display:flex;align-items:center;gap:5px;margin-top:7px;font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(253,250,248,0.55);min-height:16px}
.cw-master-slot-dot{width:6px;height:6px;border-radius:50%;background:#2ecc71;flex-shrink:0}
.cw-master-slot-dot.orange{background:#e67e22}
.cw-master-slot-dot.grey{background:rgba(255,255,255,0.25)}
.cw-skill-tag{font-family:'DM Sans',sans-serif;font-size:10px;color:rgba(253,250,248,.38);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:2px 9px}

/* ── Step 2: Categories ── */
.cw-cats{display:flex;flex-direction:column;gap:10px}
.cw-cat-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;cursor:pointer;text-align:left;transition:all .2s;font-family:inherit;color:inherit;display:flex;align-items:center;gap:14px;padding:12px 14px;overflow:hidden;width:100%;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.cw-cat-card:hover{border-color:rgba(123,45,78,.40);background:rgba(123,45,78,.07);transform:translateY(-2px);box-shadow:0 6px 22px rgba(0,0,0,.32)}
.cw-cat-img{width:62px;height:62px;border-radius:11px;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,.08)}
.cw-cat-text{flex:1;min-width:0}
.cw-cat-label{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:400;color:#fdfaf8;display:block;margin-bottom:3px}
.cw-cat-desc{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(253,250,248,.38);line-height:1.5;display:block}
.cw-cat-price{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#c9a87c;display:block;margin-top:5px}
.cw-cat-arrow{color:rgba(253,250,248,.20);font-size:16px;flex-shrink:0}

/* ── Step 3: Services ── */
.cw-services{display:flex;flex-direction:column;gap:8px}
.cw-wimp-visual{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(184,200,216,.08),rgba(201,168,124,.06));border:1px solid rgba(184,200,216,.14);border-radius:14px;padding:10px 12px;margin:0 0 4px;overflow:hidden}
.cw-wimp-visual img{width:54px;height:54px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,.12)}
.cw-wimp-visual-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:300;color:#fdfaf8;line-height:1.1}
.cw-wimp-visual-sub{font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(253,250,248,.45);line-height:1.45;margin-top:3px}
.cw-svc-group{display:flex;align-items:center;gap:9px;margin:8px 2px 0}
.cw-svc-group::after{content:'';height:1px;flex:1;background:linear-gradient(to right,rgba(201,168,124,.18),transparent)}
.cw-svc-group-title{font-family:'DM Sans',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(201,168,124,.70)}
.cw-svc-group-note{font-family:'DM Sans',sans-serif;font-size:9px;color:rgba(253,250,248,.32)}
.cw-svc-btn--extra .cw-svc-price::before{content:'+ '}
.cw-svc-btn--extra .cw-svc-name{color:rgba(253,250,248,.86)}
.cw-svc-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:13px 14px;cursor:pointer;text-align:left;color:inherit;width:100%;font-family:inherit;transition:all .2s;-webkit-tap-highlight-color:transparent;outline:none}
.cw-svc-btn:focus{outline:none;background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.07)}
.cw-svc-btn:focus:not(:focus-visible){background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.07)}
.cw-svc-btn:hover{border-color:rgba(123,45,78,.40);background:rgba(123,45,78,.06);transform:translateY(-1px)}
.cw-svc-btn[disabled]{cursor:not-allowed;opacity:.62;transform:none!important;background:rgba(255,255,255,.025)}
.cw-svc-btn[disabled] .cw-svc-name{color:rgba(253,250,248,.62)}
.cw-svc-left{flex:1;min-width:0}
.cw-svc-name{font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:500;color:#fdfaf8;margin-bottom:2px}
.cw-svc-dur{font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(253,250,248,.30)}
.cw-svc-status{display:inline-flex;align-items:center;gap:5px;margin-top:6px;font-family:'DM Sans',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.045em;text-transform:uppercase;border-radius:999px;padding:3px 7px;border:1px solid rgba(255,255,255,.10);color:rgba(253,250,248,.50);background:rgba(255,255,255,.035)}
.cw-svc-status::before{content:'';width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.25)}
.cw-svc-status.good{color:#a8f0c0;border-color:rgba(46,204,113,.30);background:rgba(46,204,113,.10)}
.cw-svc-status.good::before{background:#2ecc71;box-shadow:0 0 7px rgba(46,204,113,.45)}
.cw-svc-status.warn{color:#ffd99a;border-color:rgba(230,166,60,.34);background:rgba(230,166,60,.10)}
.cw-svc-status.warn::before{background:#e6a63c;box-shadow:0 0 7px rgba(230,166,60,.45)}
.cw-svc-status.bad{color:rgba(253,250,248,.43);border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.03)}
.cw-svc-status.bad::before{background:rgba(255,255,255,.28)}
.cw-svc-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:300;color:#c9a87c;white-space:nowrap;flex-shrink:0}

/* ── Step 4: Addons ── */
.cw-addons{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.cw-addon-btn{display:flex;align-items:center;gap:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:12px 14px;cursor:pointer;text-align:left;color:inherit;width:100%;font-family:inherit;transition:all .2s;box-sizing:border-box}
.cw-addon-btn:hover{border-color:rgba(201,168,124,.28);background:rgba(201,168,124,.04)}
.cw-addon-btn.sel{border-color:rgba(201,168,124,.55);background:rgba(201,168,124,.08)}
.cw-addon-check{width:20px;height:20px;border-radius:6px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;transition:all .18s}
.cw-addon-btn.sel .cw-addon-check{background:#c9a87c;border-color:#c9a87c;color:#0f0a0d}
.cw-addon-info{flex:1}
.cw-addon-name{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#fdfaf8;margin-bottom:1px}
.cw-addon-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:rgba(201,168,124,.75)}
.cw-skip-btn{width:100%;padding:11px;background:none;border:1px dashed rgba(255,255,255,.28);border-radius:11px;color:rgba(253,250,248,.68);font-family:'DM Sans',sans-serif;font-size:12.5px;cursor:pointer;transition:all .18s;box-sizing:border-box}
.cw-skip-btn:hover{border-color:rgba(255,255,255,.50);color:#fdfaf8}

/* ── Step 5: Calendar ── */
.cw-calendar{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:14px;overflow:hidden;margin-top:4px}
.cw-cal-nav{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.05)}
.cw-cal-nav span{font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:300;color:#fdfaf8}
.cw-cal-nav button{background:none;border:none;color:rgba(253,250,248,.40);font-size:17px;cursor:pointer;padding:3px 7px;border-radius:6px;transition:all .15s;line-height:1}
.cw-cal-nav button:hover{background:rgba(255,255,255,.06);color:#fdfaf8}
.cw-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:7px 7px 9px}
.cw-dow{text-align:center;font-family:'DM Sans',sans-serif;font-size:9px;font-weight:600;letter-spacing:.05em;color:rgba(253,250,248,.45);padding:2px 0;text-transform:uppercase}
.cw-day{aspect-ratio:1;border-radius:7px;border:none;background:none;color:rgba(253,250,248,.90);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.cw-day.past,.cw-day.unavail{color:rgba(253,250,248,.25);cursor:default;pointer-events:none}
.cw-day.avail:hover{background:rgba(123,45,78,.22);color:#fdfaf8}
.cw-day.sel{background:#7B2D4E;color:#fff;box-shadow:0 0 13px rgba(123,45,78,.48)}
.cw-day.avail{position:relative}
.cw-day.avail::after{content:'';position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:#7B2D4E;opacity:.55}
.cw-day.sel::after{background:#fff}
.cw-times-title{font-family:'DM Sans',sans-serif;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(253,250,248,.60);margin:15px 0 8px}
.cw-time-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cw-time{padding:8px 4px;border-radius:9px;border:1px solid rgba(255,255,255,.20);background:rgba(255,255,255,.08);color:rgba(253,250,248,.90);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;transition:all .15s;text-align:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.cw-time.free:hover{border-color:rgba(123,45,78,.42);background:rgba(123,45,78,.14);color:#fdfaf8}
.cw-time.sel{background:#7B2D4E;border-color:#7B2D4E;color:#fff;box-shadow:0 0 11px rgba(123,45,78,.42)}

/* ── Step 6: Contact ── */
.cw-summary{background:rgba(255,255,255,.03);border:1px solid rgba(201,168,124,.12);border-radius:13px;padding:12px 14px;margin-bottom:16px;display:flex;flex-direction:column;gap:8px}
.cw-sum-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.cw-sum-row span{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(253,250,248,.32);white-space:nowrap}
.cw-sum-row strong{font-family:'DM Sans',sans-serif;font-size:12.5px;color:#fdfaf8;font-weight:500;text-align:right}
.cw-sum-price strong{font-family:'Cormorant Garamond',Georgia,serif;font-size:21px;font-weight:300;color:#c9a87c}
.cw-form{display:flex;flex-direction:column;gap:12px}
.cw-field{display:flex;flex-direction:column;gap:4px}
.cw-field label{font-family:'DM Sans',sans-serif;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:rgba(253,250,248,.35)}
.cw-field input{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:11px 13px;color:#fdfaf8;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color .15s;width:100%;box-sizing:border-box}
.cw-field input::placeholder{color:rgba(253,250,248,.18)}
.cw-field input:focus{border-color:rgba(123,45,78,.50);background:rgba(123,45,78,.04)}
.cw-btn-confirm{background:linear-gradient(135deg,#7B2D4E 0%,#5a1e37 100%);color:#fff;border:none;border-radius:11px;padding:15px 24px;width:100%;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;letter-spacing:.04em;cursor:pointer;transition:all .2s;box-shadow:0 6px 22px rgba(123,45,78,.38);margin-top:2px;box-sizing:border-box}
.cw-btn-confirm:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 30px rgba(123,45,78,.52)}
.cw-btn-confirm:disabled{opacity:.5;cursor:default}
.cw-form-note{font-family:'DM Sans',sans-serif;font-size:10px;color:rgba(253,250,248,.22);text-align:center;line-height:1.5;margin-top:-4px}
.cw-field input.invalid{border-color:rgba(252,100,100,.60)!important;background:rgba(252,100,100,.04)!important}
.cw-field-err{font-family:'DM Sans',sans-serif;font-size:10px;color:#fca5a5;margin-top:4px;display:none}
.cw-field-err.show{display:block}
.cw-consent{display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-top:2px}
.cw-consent input[type=checkbox]{width:16px;height:16px;min-width:16px;margin-top:2px;accent-color:#7B2D4E;cursor:pointer}
.cw-consent span{font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(253,250,248,.65);line-height:1.55}
.cw-consent span a{color:rgba(201,168,124,.75);text-decoration:underline}
.cw-consent span a:hover{color:#c9a87c}
.cw-consent.invalid span{color:#fca5a5}

/* ── Success ── */
.cw-success{display:flex;flex-direction:column;align-items:center;text-align:center;padding:36px 16px;gap:12px}
.cw-success-icon{width:58px;height:58px;border-radius:50%;background:rgba(201,168,124,.09);border:1px solid rgba(201,168,124,.30);display:flex;align-items:center;justify-content:center;font-size:24px;color:#c9a87c;margin-bottom:4px}
.cw-success h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:25px;font-weight:300;color:#fdfaf8;margin:0}
.cw-success p{font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(253,250,248,.50);line-height:1.65;margin:0}
.cw-success p strong{color:#fdfaf8;font-weight:500}
.cw-success-note{font-size:11px!important;color:rgba(253,250,248,.28)!important}
.cw-btn-new{background:rgba(255,255,255,.05);color:rgba(253,250,248,.60);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:10px 22px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;transition:all .15s;margin-top:4px}
.cw-btn-new:hover{background:rgba(255,255,255,.09);color:#fdfaf8}

body.crocus-open .t-header,body.crocus-open header{z-index:1!important}
body.crocus-open{overflow:hidden!important;overscroll-behavior:none;}

/* ── Gift CTA button (Step 1 bottom) ── */
.cw-gift-divider{display:flex;align-items:center;gap:10px;margin:18px 0 12px}
.cw-gift-divider::before,.cw-gift-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.07)}
.cw-gift-divider span{font-family:'DM Sans',sans-serif;font-size:10px;letter-spacing:.06em;color:rgba(253,250,248,.25);text-transform:uppercase}
.cw-gift-cta{background:linear-gradient(135deg,rgba(201,168,124,.08) 0%,rgba(201,168,124,.04) 100%);border:1px solid rgba(201,168,124,.22);border-radius:14px;padding:12px 14px;cursor:pointer;text-align:left;color:inherit;font-family:inherit;display:inline-flex;align-items:center;gap:13px;transition:all .22s;-webkit-tap-highlight-color:transparent;max-width:320px;width:auto}
.cw-gift-cta:hover{border-color:rgba(201,168,124,.45);background:linear-gradient(135deg,rgba(201,168,124,.13) 0%,rgba(201,168,124,.07) 100%);transform:translateY(-1px);box-shadow:0 6px 22px rgba(201,168,124,.12)}
.cw-gift-cta-icon{font-size:22px;flex-shrink:0;line-height:1}
.cw-gift-cta-text{flex:1;min-width:0}
.cw-gift-cta-title{display:block;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:#fdfaf8;margin-bottom:2px}
.cw-gift-cta-sub{display:block;font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(253,250,248,.38)}
.cw-gift-cta-arrow{color:rgba(201,168,124,.55);font-size:20px;flex-shrink:0}
.cw-express-cta{position:relative;width:100%;margin:4px 0 14px;background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(201,168,124,.10) 46%,rgba(123,45,78,.16));border:1px solid rgba(201,168,124,.34);border-radius:17px;padding:10px 42px 10px 12px;display:flex;align-items:center;gap:11px;text-align:left;color:#fff;font-family:'DM Sans',sans-serif;cursor:pointer;box-shadow:0 12px 30px rgba(0,0,0,.23),0 0 0 1px rgba(255,255,255,.035) inset,0 1px 0 rgba(255,255,255,.08) inset;overflow:hidden;transition:transform .18s cubic-bezier(.2,.8,.2,1),border-color .18s,background .18s,box-shadow .18s}
.cw-express-cta::before{content:'';position:absolute;inset:1px;border-radius:16px;background:radial-gradient(circle at 18% 0%,rgba(255,255,255,.18),transparent 34%),linear-gradient(90deg,rgba(201,168,124,.13),transparent 40%,rgba(255,255,255,.04));pointer-events:none;opacity:.82}
.cw-express-cta::after{content:'›';position:absolute;right:13px;top:50%;width:22px;height:22px;margin-top:-11px;border-radius:999px;display:grid;place-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(201,168,124,.26);color:#e8c894;font-size:18px;line-height:18px;font-family:Georgia,serif;transition:transform .18s,background .18s,border-color .18s}
.cw-express-glow{position:absolute;inset:-1px;border-radius:18px;background:linear-gradient(115deg,transparent 0%,transparent 35%,rgba(255,238,198,.20) 48%,transparent 62%,transparent 100%);transform:translateX(-115%);opacity:.55;pointer-events:none;animation:cwExpressSweep 4.8s ease-in-out infinite}
.cw-express-cta{animation:cwExpressPulse 5.6s ease-in-out infinite}
.cw-express-cta:hover{transform:translateY(-1px);border-color:rgba(232,200,148,.62);background:linear-gradient(135deg,rgba(255,255,255,.09),rgba(201,168,124,.14) 48%,rgba(123,45,78,.20));box-shadow:0 14px 34px rgba(0,0,0,.28),0 0 22px rgba(201,168,124,.13),0 1px 0 rgba(255,255,255,.10) inset}
.cw-express-cta:hover::after{transform:translateX(2px);background:rgba(201,168,124,.15);border-color:rgba(232,200,148,.44)}
.cw-express-cta:active{transform:translateY(0) scale(.995)}
.cw-express-ico{position:relative;z-index:1;height:24px;border-radius:999px;background:linear-gradient(135deg,rgba(201,168,124,.20),rgba(201,116,142,.13));border:1px solid rgba(201,168,124,.36);display:grid;place-items:center;font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;line-height:1;padding:0 9px;flex-shrink:0;color:#e8c894;box-shadow:0 4px 12px rgba(0,0,0,.14)}
.cw-express-title{position:relative;z-index:1;display:block;font-weight:850;font-size:12.4px;letter-spacing:.065em;text-transform:uppercase;color:#fff9f1;line-height:1.1}
.cw-express-sub{position:relative;z-index:1;display:block;font-size:10.4px;line-height:1.32;color:rgba(253,250,248,.64);margin-top:3px;white-space:normal}
@keyframes cwExpressPulse{0%,100%{box-shadow:0 12px 30px rgba(0,0,0,.23),0 0 0 1px rgba(255,255,255,.035) inset,0 1px 0 rgba(255,255,255,.08) inset}50%{box-shadow:0 12px 30px rgba(0,0,0,.23),0 0 18px rgba(201,168,124,.13),0 0 0 1px rgba(255,255,255,.045) inset,0 1px 0 rgba(255,255,255,.10) inset}}
@keyframes cwExpressSweep{0%,58%{transform:translateX(-115%);opacity:0}66%{opacity:.55}82%,100%{transform:translateX(115%);opacity:0}}
@media (prefers-reduced-motion:reduce){.cw-express-cta,.cw-express-glow{animation:none!important}}
.cw-express-status{display:inline-flex;align-items:center;gap:5px;margin-top:6px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:4px 8px;border:1px solid rgba(255,255,255,.10);color:rgba(253,250,248,.55);background:rgba(255,255,255,.04)}
.cw-express-status::before{content:'';width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.25)}
.cw-express-status.good{color:#a8f0c0;border-color:rgba(46,204,113,.30);background:rgba(46,204,113,.10)}
.cw-express-status.good::before{background:#2ecc71;box-shadow:0 0 8px rgba(46,204,113,.45)}
.cw-express-status.warn{color:#ffd99a;border-color:rgba(230,166,60,.34);background:rgba(230,166,60,.10)}
.cw-express-status.warn::before{background:#e6a63c;box-shadow:0 0 8px rgba(230,166,60,.45)}
.cw-express-status.bad{color:rgba(253,250,248,.46);border-color:rgba(255,255,255,.10);background:rgba(255,255,255,.035)}
.cw-express-status.bad::before{background:rgba(255,255,255,.28)}
.cw-calendar.express{background:transparent;border:none;margin-top:10px}
.cw-calendar.express .cw-cal-nav{display:none}
.cw-calendar.express .cw-cal-grid{display:flex;flex-direction:column;gap:11px}
.cw-express-day-card{position:relative;width:100%;border-radius:16px;border:1px solid rgba(255,255,255,.10);background:linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.025));padding:13px;text-align:left;overflow:hidden}
.cw-express-day-card.good{border-color:rgba(46,204,113,.32);background:linear-gradient(135deg,rgba(46,204,113,.105),rgba(255,255,255,.025))}
.cw-express-day-card.warn{border-color:rgba(230,166,60,.34);background:linear-gradient(135deg,rgba(230,166,60,.10),rgba(255,255,255,.025))}
.cw-express-day-card.bad{opacity:.72}
.cw-express-day-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
.cw-express-day-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#fdfaf8;line-height:1}
.cw-express-day-date{display:block;font-family:'DM Sans',sans-serif;font-size:10px;color:rgba(253,250,248,.45);margin-top:3px}
.cw-express-day-times{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cw-express-day-note{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(253,250,248,.48);line-height:1.45;margin-top:2px}
.cw-express-more-btn{width:100%;margin-top:2px;padding:11px 13px;border-radius:14px;border:1px solid rgba(201,168,124,.26);background:linear-gradient(135deg,rgba(201,168,124,.09),rgba(255,255,255,.035));color:rgba(253,250,248,.82);font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:.035em;cursor:pointer;transition:all .18s;text-align:center}
.cw-express-more-btn:hover{border-color:rgba(201,168,124,.48);background:linear-gradient(135deg,rgba(201,168,124,.14),rgba(255,255,255,.055));color:#fdfaf8;transform:translateY(-1px)}
.cw-express-more-btn span{display:block;font-size:10px;font-weight:500;letter-spacing:0;color:rgba(253,250,248,.45);margin-top:2px}

/* ── Gift Progress bar ── */
.cw-gift-progress{display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:18px}
.cw-gp-step{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;position:relative}
.cw-gp-step.done{cursor:pointer}
.cw-gp-dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:600;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);color:rgba(253,250,248,.28);transition:all .25s}
.cw-gp-step.active .cw-gp-dot{background:#c9a87c;border-color:#c9a87c;color:#0f0a0d;box-shadow:0 0 12px rgba(201,168,124,.45)}
.cw-gp-step.done .cw-gp-dot{background:rgba(201,168,124,.13);border-color:#c9a87c;color:#c9a87c}
.cw-gp-step.done:hover .cw-gp-dot{box-shadow:0 0 8px rgba(201,168,124,.35)}
.cw-gp-label{font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;color:rgba(253,250,248,.22);font-family:'DM Sans',sans-serif;white-space:nowrap}
.cw-gp-step.active .cw-gp-label,.cw-gp-step.done .cw-gp-label{color:rgba(253,250,248,.55)}
.cw-gp-line{position:absolute;top:10px;left:calc(50% + 13px);right:calc(-50% + 13px);height:1px;background:rgba(255,255,255,.06);z-index:0;transition:background .3s}
.cgpline-filled,.cw-gp-line.filled{background:rgba(201,168,124,.28)!important}

/* ── Gift amount selection ── */
.cw-gift-amounts{display:flex;flex-direction:column;gap:12px;margin-top:4px}
.cw-gift-amount-btn{width:100%;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:0;cursor:pointer;text-align:left;color:inherit;font-family:inherit;display:flex;flex-direction:column;overflow:hidden;transition:all .22s;-webkit-tap-highlight-color:transparent;box-sizing:border-box}
.cw-gift-amount-btn *{pointer-events:none}
.cw-gift-amount-btn:hover{border-color:rgba(201,168,124,.45);background:rgba(201,168,124,.04);transform:translateY(-2px);box-shadow:0 8px 28px rgba(201,168,124,.12)}
.cw-gift-amount-btn.sel{border-color:rgba(201,168,124,.70);background:rgba(201,168,124,.07);box-shadow:0 0 0 1px rgba(201,168,124,.30),0 8px 28px rgba(201,168,124,.18)}
.cw-gift-amount-img{width:100%;height:160px;object-fit:cover;object-position:center 55%;display:block;border-radius:14px 14px 0 0}
.cw-gift-amount-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;pointer-events:none}
.cw-gift-amount-meta{display:flex;flex-direction:column}
.cw-gift-amount-value{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:300;color:#c9a87c;display:block;line-height:1}
.cw-gift-amount-desc{font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(253,250,248,.38);display:block;margin-top:3px}

/* ── Gift info box ── */
.cw-gift-info-box{display:flex;align-items:flex-start;gap:10px;background:rgba(201,168,124,.06);border:1px solid rgba(201,168,124,.15);border-radius:11px;padding:12px 13px;margin-bottom:2px}
.cw-gift-info-icon{font-size:14px;flex-shrink:0;opacity:.55;margin-top:1px}
.cw-gift-info-box p{font-family:'DM Sans',sans-serif;font-size:11.5px;color:rgba(253,250,248,.45);line-height:1.6;margin:0}
/* ── Gift step 1 info banner ── */
.cw-gift1-info{background:linear-gradient(135deg,rgba(201,168,124,.07) 0%,rgba(123,45,78,.07) 100%);border:1px solid rgba(201,168,124,.18);border-radius:12px;padding:10px 14px;margin:14px 0 16px}
.cw-gift1-info-text{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(253,250,248,.55);line-height:1.7;display:block}
.cw-gift1-info-accent{color:#c9a87c}
.cw-gift1-info-italic{font-family:'DM Sans',sans-serif;font-size:10.5px;color:rgba(201,168,124,.65);line-height:1.6;display:block;margin-top:5px;font-style:italic}
`;

var styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);

// ── Months / Days ──────────────────────────────────────────────
var MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
var DAYS   = ['Mo','Di','Mi','Do','Fr','Sa','So'];

// ── HTML ───────────────────────────────────────────────────────
var wrap = document.createElement('div');
wrap.innerHTML =
  '<div id="crocus-fab-wrap">'
  + '<button id="crocus-fab"><span class="crocus-fab-text">Termin buchen</span><div class="crocus-fab-icon"><img src="https://static.tildacdn.com/tild3830-6165-4233-b735-633433643031/crocus-logo-white.png" alt="Crocus"></div></button>'
  + '<div class="crocus-fab-rings"><span class="crocus-fab-ring"></span><span class="crocus-fab-ring"></span><span class="crocus-fab-ring"></span></div>'
  + '</div>'
  + '<div id="crocus-backdrop"></div>'
  + '<div id="crocus-modal">'
    + '<div id="crocus-modal-header">'
      + '<div class="crocus-modal-brand">'
        + '<img class="crocus-modal-logo" src="https://static.tildacdn.com/tild3830-6165-4233-b735-633433643031/crocus-logo-white.png" alt="Crocus">'
        + '<div><span class="crocus-modal-title">Crocus Beauty Studio</span><span class="crocus-modal-sub">Göppingen · Online-Buchung</span></div>'
      + '</div>'
      + '<button id="crocus-close">✕</button>'
    + '</div>'
    + '<div id="crocus-progress">'
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
    + '<div id="crocus-body">'


      // Step 1 — Master
      + '<div class="cw-step active" id="cw-step1">'
        + '<h2 class="cw-title">Wähle deine Meisterin</h2>'
        + '<p class="cw-sub">Jede Meisterin hat ihre eigene Stärke — lies kurz rein und wähle die Richtige für dich.</p>'
        + '<button class="cw-express-cta" id="cw-btn-express" type="button">'
          + '<span class="cw-express-glow" aria-hidden="true"></span>'
          + '<span class="cw-express-ico">Spontan</span>'
          + '<span><span class="cw-express-title">Kurzfristig zum Nageltermin</span><span class="cw-express-sub">Freie Zeiten für heute und die nächsten Tage.</span></span>'
        + '</button>'
        + '<div class="cw-masters" id="cw-masters-list"></div>'
        + '<div class="cw-gift-divider"><span>oder</span></div>'
        + '<button class="cw-gift-cta" id="cw-btn-gift">'
          + '<div class="cw-gift-cta-icon">🎁</div>'
          + '<div class="cw-gift-cta-text">'
            + '<span class="cw-gift-cta-title">Geschenkgutschein kaufen</span>'
            + '<span class="cw-gift-cta-sub">30 € · 50 € · 100 € — per E-Mail zugeschickt</span>'
          + '</div>'
          + '<span class="cw-gift-cta-arrow">›</span>'
        + '</button>'
      + '</div>'

      // Gift Step 1 — Nominale
      + '<div class="cw-step" id="cw-gift1">'
        + '<div class="cw-nav"><button class="cw-back" id="cw-gift-back1">← Zurück</button></div>'
        + '<div class="cw-gift-progress">'
          + '<div class="cw-gp-step active" id="cgp1"><div class="cw-gp-dot">1</div><span class="cw-gp-label">Betrag</span></div>'
          + '<div class="cw-gp-line" id="cgpline1"></div>'
          + '<div class="cw-gp-step" id="cgp2"><div class="cw-gp-dot">2</div><span class="cw-gp-label">Daten</span></div>'
          + '<div class="cw-gp-line" id="cgpline2"></div>'
          + '<div class="cw-gp-step" id="cgp3"><div class="cw-gp-dot">3</div><span class="cw-gp-label">Fertig</span></div>'
        + '</div>'
        + '<div style="text-align:center;margin-bottom:6px">'
          + '<h2 class="cw-title" style="margin-bottom:4px">Verschenke echte Schönheit</h2>'
          + '<p class="cw-sub" style="margin-bottom:0">Ein Gutschein von Crocus — das schönste Geschenk,<br>das man machen kann.</p>'
        + '</div>'
        + '<div id="cw-gift1-info" class="cw-gift1-info">'
          + '<span class="cw-gift1-info-text">Wird per <strong class="cw-gift1-info-accent">E-Mail</strong> zugeschickt · 12 Monate gültig · unkompliziert &amp; persönlich</span>'
          + '<span class="cw-gift1-info-italic">Wir sorgen dafür, dass Ihr Geschenk unvergesslich wird.</span>'
        + '</div>'
        + '<div class="cw-gift-amounts" id="cw-gift-amounts">'
          + '<button type="button" class="cw-gift-amount-btn" data-gift-amount="30">'
            + '<img class="cw-gift-amount-img" src="https://raw.githubusercontent.com/chistyartem-blip/crocus-widget/main/gift-30-opt.webp" alt="Geschenkgutschein 30 €" loading="lazy">'
            + '<div class="cw-gift-amount-inner"><div class="cw-gift-amount-meta"><span class="cw-gift-amount-value">30 €</span><span class="cw-gift-amount-desc">Perfekt für den ersten Besuch — Maniküre oder Behandlung nach Wahl</span></div><span style="font-size:18px;color:rgba(201,168,124,.55)">›</span></div>'
          + '</button>'
          + '<button type="button" class="cw-gift-amount-btn" data-gift-amount="50">'
            + '<img class="cw-gift-amount-img" src="https://raw.githubusercontent.com/chistyartem-blip/crocus-widget/main/gift-50-opt.webp" alt="Geschenkgutschein 50 €" loading="lazy">'
            + '<div class="cw-gift-amount-inner"><div class="cw-gift-amount-meta"><span class="cw-gift-amount-value">50 €</span><span class="cw-gift-amount-desc">Maniküre, Pediküre oder Kombi — unsere meistgekaufte Wahl</span></div><span style="font-size:18px;color:rgba(201,168,124,.55)">›</span></div>'
          + '</button>'
          + '<button type="button" class="cw-gift-amount-btn" data-gift-amount="100">'
            + '<img class="cw-gift-amount-img" src="https://raw.githubusercontent.com/chistyartem-blip/crocus-widget/main/gift-100-opt.webp" alt="Geschenkgutschein 100 €" loading="lazy">'
            + '<div class="cw-gift-amount-inner"><div class="cw-gift-amount-meta"><span class="cw-gift-amount-value">100 €</span><span class="cw-gift-amount-desc">Das komplette Verwöhnprogramm — für Menschen, die es wert sind</span></div><span style="font-size:18px;color:rgba(201,168,124,.55)">›</span></div>'
          + '</button>'
          + '<button type="button" class="cw-gift-amount-btn" data-gift-flexible="true">'
            + '<img class="cw-gift-amount-img" src="https://raw.githubusercontent.com/chistyartem-blip/crocus-widget/main/gift-flex-opt.webp" alt="Flexible Gutschein" loading="lazy">'
            + '<div class="cw-gift-amount-inner"><div class="cw-gift-amount-meta"><span class="cw-gift-amount-value">Flexible</span><span class="cw-gift-amount-desc">Betrag oder Behandlung nach Wunsch — wir klären alles gemeinsam</span></div><span style="font-size:18px;color:rgba(201,168,124,.55)">›</span></div>'
          + '</button>'

        + '</div>'
      + '</div>'

      // Gift Step 2 — Form
      + '<div class="cw-step" id="cw-gift2">'
        + '<div class="cw-nav"><button class="cw-back" id="cw-gift-back2">← Zurück</button></div>'
        + '<div class="cw-gift-progress">'
          + '<div class="cw-gp-step done" id="cgp1b"><div class="cw-gp-dot">✓</div><span class="cw-gp-label">Betrag</span></div>'
          + '<div class="cw-gp-line cgpline-filled" id="cgpline1b"></div>'
          + '<div class="cw-gp-step active" id="cgp2b"><div class="cw-gp-dot">2</div><span class="cw-gp-label">Daten</span></div>'
          + '<div class="cw-gp-line" id="cgpline2b"></div>'
          + '<div class="cw-gp-step" id="cgp3b"><div class="cw-gp-dot">3</div><span class="cw-gp-label">Fertig</span></div>'
        + '</div>'
        + '<h2 class="cw-title">Ihre Kontaktdaten</h2>'
        + '<p class="cw-sub" id="cw-gift-step2-sub">Gutschein: <strong id="cw-gift-selected-label">50 €</strong> — wird per E-Mail bestätigt</p>'
        + '<form class="cw-form" id="cw-gift-form">'
          + '<div class="cw-field"><label>Ihr Name</label><input type="text" id="cw-gift-name" placeholder="Ihr Name" required autocomplete="name"></div>'
          + '<div class="cw-field"><label>Ihre E-Mail</label><input type="email" id="cw-gift-email" placeholder="ihre@email.de" required autocomplete="email"></div>'
          + '<div class="cw-field"><label>Telefon / WhatsApp</label><div class="cw-phone-wrap"><select class="cw-phone-dial" id="cw-gift-dial" aria-label="Ländervorwahl">'+PHONE_DIAL_OPTIONS+'</select><button type="button" class="cw-dial-btn" id="cw-gift-dial-btn" aria-label="Ländervorwahl"><span class="cw-dial-btn__code">+49</span><span class="cw-dial-btn__arrow">▼</span></button><div class="cw-dial-drop" id="cw-gift-dial-drop"><div class="cw-dial-search"><span class="cw-dial-search-icon">🔍</span><input type="text" placeholder="Land suchen…" id="cw-gift-dial-search" autocomplete="off"></div><div class="cw-dial-list" id="cw-gift-dial-list"></div></div><input type="tel" id="cw-gift-phone" placeholder="172 1234567" autocomplete="tel" inputmode="numeric"></div></div>'
          + '<div class="cw-field"><label>Für wen ist der Gutschein? <span style="opacity:.45;font-size:9px">(optional)</span></label><input type="text" id="cw-gift-recipient" placeholder="z.B. für Maria zum Geburtstag"></div>'
          + '<div class="cw-field" id="cw-gift-wish-wrap" style="display:none"><label>Gewünschte Behandlung oder Wunschbetrag <span style="opacity:.45;font-size:9px">(optional)</span></label><input type="text" id="cw-gift-wish" placeholder="z.B. Maniküre + Gellack, ca. 40 €"></div>'
          + '<div class="cw-gift-info-box">'
            + '<div class="cw-gift-info-icon">ℹ</div>'
            + '<p>Nach Ihrer Anfrage melden wir uns per E-Mail oder WhatsApp und besprechen gemeinsam alle Details.</p>'
          + '</div>'
          + '<button type="submit" class="cw-btn-confirm" id="cw-gift-submit">Gutschein anfragen →</button>'
          + '<p class="cw-form-note">Wir melden uns innerhalb einer Stunde</p>'
        + '</form>'
      + '</div>'

      // Gift Success
      + '<div class="cw-step" id="cw-gift-success">'
        + '<div class="cw-success">'
          + '<div class="cw-success-icon">🎁</div>'
          + '<h2>Anfrage eingegangen!</h2>'
          + '<p id="cw-gift-success-text">Wir melden uns in Kürze per E-Mail mit den Zahlungsdetails.</p>'
          + '<p class="cw-success-note">Nach Zahlungseingang erhalten Sie Ihren Gutschein per E-Mail.</p>'
          + '<button class="cw-btn-new" id="cw-gift-btn-new">Termin buchen</button>'
        + '</div>'
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
          + '<div class="cw-field"><label>Telefon / WhatsApp</label><div class="cw-phone-wrap"><select class="cw-phone-dial" id="cw-dial" aria-label="Ländervorwahl">'+PHONE_DIAL_OPTIONS+'</select><button type="button" class="cw-dial-btn" id="cw-dial-btn" aria-label="Ländervorwahl"><span class="cw-dial-btn__code">+49</span><span class="cw-dial-btn__arrow">▼</span></button><div class="cw-dial-drop" id="cw-dial-drop"><div class="cw-dial-search"><span class="cw-dial-search-icon">🔍</span><input type="text" placeholder="Land suchen…" id="cw-dial-search" autocomplete="off"></div><div class="cw-dial-list" id="cw-dial-list"></div></div><input type="tel" id="cw-phone" placeholder="172 1234567" required autocomplete="tel" inputmode="numeric"></div></div>'
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
function _crocusMount() {
document.body.appendChild(wrap);

// ── State ──────────────────────────────────────────────────────
var cw = {
  step: 1,
  master: null,       // object from MASTERS_META + API
  category: null,     // CATEGORIES item
  service: null,      // API service object
  addons: [],       // API service objects array (multi-select)
  date: null,
  time: null,
  datetime: null,
  comboAppointments: null,
  comboRoute: null,
  express: false,
  calY: new Date().getFullYear(),
  calM: new Date().getMonth(),
  availDates: [],
};

var _allMasters  = null;
var _allServices = null;
var _addonObjs   = [];
var _globalAddonObjs = []; // кэш аддонов без staff_id — никогда не обнуляется
var _seanceCache = {}; // кэш seance_length: ключ = staffId+'_'+serviceId → секунды
var _serviceCacheByStaff = {};
var _expressPreviewCache = {};
var _comboSlotsCache = {};

// Gift state
var gift = {
  amount: null,       // 30 | 50 | 100 | null (flexible)
  isFlexible: false,
};

// ── Open/Close ─────────────────────────────────────────────────
var _scrollY = 0;
var _suppressNextHashClick = false;
var _scrollLocked = false;
var _fixedScrollLock = false;
var _crocusHistoryActive = false;
var _crocusApplyingHistory = false;
var _closingFromPopstate = false;
var _pendingOpenScrollY = 0;

function preservePageScroll(fn) {
  var y = window.scrollY || window.pageYOffset || 0;
  fn();
  requestAnimationFrame(function() {
    if (Math.abs((window.scrollY || window.pageYOffset || 0) - y) > 2) window.scrollTo(0, y);
  });
}

function lockPageScroll() {
  if (_scrollLocked) return;
  _scrollY = _pendingOpenScrollY || window.scrollY || window.pageYOffset || 0;
  _pendingOpenScrollY = 0;
  _scrollLocked = true;
  _fixedScrollLock = window.matchMedia && (
    window.matchMedia('(max-width: 768px)').matches ||
    window.matchMedia('(pointer: coarse)').matches
  );
  document.documentElement.style.overflow = 'hidden';
  document.body.classList.add('crocus-open');
  document.body.style.overflow = 'hidden';
  if (_fixedScrollLock) {
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + _scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
}

function unlockPageScroll() {
  if (!_scrollLocked) return;
  var savedY = _scrollY || 0;
  var shouldRestore = _fixedScrollLock;
  _scrollLocked = false;
  _fixedScrollLock = false;
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  document.body.classList.remove('crocus-open');
  if (!shouldRestore) return;
  window.scrollTo(0, savedY);
  requestAnimationFrame(function() {
    if (Math.abs((window.scrollY || window.pageYOffset || 0) - savedY) <= 2) return;
    window.scrollTo(0, savedY);
  });
}

function resetWidgetScroll() {
  var body = document.getElementById('crocus-body');
  if (!body) return;
  requestAnimationFrame(function() {
    body.scrollTop = 0;
  });
}

function ensureCrocusHistory() {
  if (!window.history || !window.history.pushState) return;
  var state = window.history.state || {};
  if (_crocusHistoryActive && state.crocusWidget && state.crocusOpen) {
    if (window.history.replaceState && state.crocusStep !== (cw.step || 1)) {
      window.history.replaceState({ crocusWidget: true, crocusOpen: true, crocusStep: cw.step || 1 }, '', window.location.href);
    }
    return;
  }
  if (state.crocusWidget && state.crocusOpen) {
    if (window.history.replaceState && state.crocusStep !== (cw.step || 1)) {
      window.history.replaceState({ crocusWidget: true, crocusOpen: true, crocusStep: cw.step || 1 }, '', window.location.href);
    }
    _crocusHistoryActive = true;
    return;
  }
  if (!(state.crocusWidget && state.crocusOpen === false)) {
    window.history.pushState({ crocusWidget: true, crocusOpen: false }, '', window.location.href);
  }
  window.history.pushState({ crocusWidget: true, crocusOpen: true, crocusStep: cw.step || 1 }, '', window.location.href);
  _crocusHistoryActive = true;
}

function pushCrocusStepHistory() {
  if (_crocusApplyingHistory || !isCrocusModalActive()) return;
  if (!window.history || !window.history.pushState) return;
  var state = window.history.state || {};
  if (!(state.crocusWidget && state.crocusOpen)) {
    ensureCrocusHistory();
    return;
  }
  if (state.crocusStep === (cw.step || 1)) return;
  window.history.pushState({ crocusWidget: true, crocusOpen: true, crocusStep: cw.step || 1 }, '', window.location.href);
  _crocusHistoryActive = true;
}

function keepCrocusHistory() {
  if (!window.history || !window.history.pushState) return;
  var y = _scrollLocked ? _scrollY : (window.scrollY || window.pageYOffset || 0);
  setTimeout(function() {
    if (!isCrocusModalActive()) return;
    var state = window.history.state || {};
    if (!(state.crocusWidget && state.crocusOpen)) {
      window.history.pushState({ crocusWidget: true, crocusOpen: true, crocusStep: cw.step || 1 }, '', window.location.href);
    }
    _crocusHistoryActive = true;
    requestAnimationFrame(function(){
      if (!_scrollLocked && Math.abs((window.scrollY || window.pageYOffset || 0) - y) > 2) window.scrollTo(0, y);
    });
  }, 0);
}

function isCrocusModalActive() {
  var modal = document.getElementById('crocus-modal');
  var backdrop = document.getElementById('crocus-backdrop');
  return !!(
    (modal && modal.classList.contains('open')) ||
    (backdrop && backdrop.classList.contains('open')) ||
    document.body.classList.contains('crocus-open')
  );
}

function isCrocusOpenTrigger(el) {
  if (!el) return false;
  var attr = (el.getAttribute && (el.getAttribute('onclick') || '')) || '';
  if (attr.indexOf('crocusOpen') !== -1) return true;
  if (el.closest && el.closest('[data-crocus-open]')) return true;
  var href = (el.getAttribute && el.getAttribute('href')) || '';
  var text = (el.textContent || '').toLowerCase();
  return href === '#' && (
    text.indexOf('termin') !== -1 ||
    text.indexOf('buchen') !== -1 ||
    text.indexOf('book') !== -1 ||
    text.indexOf('gutschein') !== -1
  );
}

document.addEventListener('click', function(ev) {
  var trigger = ev.target && ev.target.closest && ev.target.closest('a[href="#"],button,[onclick]');
  if (!trigger || !isCrocusOpenTrigger(trigger)) return;
  _pendingOpenScrollY = window.scrollY || window.pageYOffset || 0;
  if (trigger.tagName === 'A' && trigger.getAttribute('href') === '#') {
    ev.preventDefault();
    _suppressNextHashClick = true;
    setTimeout(function(){ _suppressNextHashClick = false; }, 0);
  }
}, true);

['pointerdown','mousedown','touchstart'].forEach(function(evtName) {
  document.addEventListener(evtName, function(ev) {
    var trigger = ev.target && ev.target.closest && ev.target.closest('a[href="#"],button,[onclick]');
    if (!trigger || !isCrocusOpenTrigger(trigger)) return;
    _pendingOpenScrollY = window.scrollY || window.pageYOffset || 0;
    if (trigger.tagName === 'A' && trigger.getAttribute('href') === '#') ev.preventDefault();
  }, true);
});

function crocusOpen() {
  if (_pendingOpenScrollY) _scrollY = _pendingOpenScrollY;
  document.getElementById('crocus-backdrop').classList.add('open');
  lockPageScroll();
  _crocusHistoryActive = false;
  ensureCrocusHistory();
  requestAnimationFrame(function(){
    document.getElementById('crocus-backdrop').classList.add('visible');
    document.getElementById('crocus-modal').classList.add('open');
  });
  if (!_allMasters) loadInitialData();
  // Tracking
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'open_booking_widget', page_location: window.location.href });
  // Meta Pixel — ViewContent при открытии виджета
  if (typeof fbq === 'function') {
    fbq('track', 'ViewContent', {
      content_name: 'Booking Widget',
      content_category: 'Beauty',
      currency: 'EUR',
    });
  }
}

function crocusClose() {
  document.getElementById('crocus-backdrop').classList.remove('visible');
  document.getElementById('crocus-modal').classList.remove('open');
  unlockPageScroll();
  _crocusHistoryActive = false;
  if (window.history && window.history.replaceState) {
    var state = window.history.state || {};
    if (state.crocusWidget && state.crocusOpen) {
      window.history.replaceState({ crocusWidget: true, crocusOpen: false }, '', window.location.href);
    }
  }

  setTimeout(function(){
    document.getElementById('crocus-backdrop').classList.remove('open');
    crocusReset();
  }, 320);
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
    var skipBack = cw.category && cw.category.key === 'wimpern';
    if (!skipBack) skipBack = !!(cw.service && NO_ADDON_SERVICE_IDS.indexOf(cw.service.id) !== -1);
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
  resetWidgetScroll();
  updateProgress(n);
  pushCrocusStepHistory();
}

// ── Loader ─────────────────────────────────────────────────────
function showLoader(id, text) {
  document.getElementById(id).innerHTML =
    '<div class="cw-loader"><div class="cw-spinner"></div><span class="cw-loader-text">'+(text||'Laden...')+'</span></div>';
}
function showError(id, msg) {
  document.getElementById(id).innerHTML = '<div class="cw-error">'+msg+'</div>';
}

function masterById(staffId) {
  staffId = Number(staffId);
  if (HIDDEN_STAFF_IDS.indexOf(staffId) !== -1) return null;
  return visibleMasters(_allMasters || []).filter(function(m){ return Number(m.id) === staffId; })[0]
    || (MASTERS_META[staffId] ? { id: staffId, name: STATIC_MASTER_NAMES[staffId] || 'Master' } : null);
}

function masterName(staffId) {
  var master = masterById(staffId);
  return (master && master.name) || STATIC_MASTER_NAMES[Number(staffId)] || 'Master';
}

function fetchStaffServices(staffId) {
  staffId = Number(staffId);
  if (_serviceCacheByStaff[staffId]) return Promise.resolve(_serviceCacheByStaff[staffId]);
  return apiGet('/book_services/'+CONFIG.locationId, { staff_id: staffId })
    .then(function(res) {
      var list = res && res.success && res.data && res.data.services ? res.data.services : [];
      var map = {};
      list.forEach(function(svc) {
        map[svc.id] = svc;
        if (svc.seance_length) _seanceCache[staffId + '_' + svc.id] = svc.seance_length;
      });
      _serviceCacheByStaff[staffId] = map;
      return map;
    })
    .catch(function() {
      _serviceCacheByStaff[staffId] = {};
      return _serviceCacheByStaff[staffId];
    });
}

function serviceForStaff(staffId, serviceId) {
  var map = _serviceCacheByStaff[Number(staffId)] || {};
  return map[serviceId] || (_allServices || []).filter(function(s){ return s.id === serviceId; })[0] || {};
}

function servicePriceForStaff(staffId, serviceId) {
  var svc = serviceForStaff(staffId, serviceId);
  if (svc.price_min != null) return Number(svc.price_min) || 0;
  if (svc.staff && svc.staff.length) {
    for (var i = 0; i < svc.staff.length; i++) {
      if (Number(svc.staff[i].id) === Number(staffId)) return Number(svc.staff[i].price_min) || 0;
    }
  }
  return Number(svc.price_max || 0) || 0;
}

function serviceDurationForStaff(staffId, serviceId, slot, fallback) {
  return (slot && (slot.seance_length || slot.sum_length))
    || _seanceCache[Number(staffId) + '_' + serviceId]
    || (serviceForStaff(staffId, serviceId).seance_length || 0)
    || fallback
    || 0;
}

function fallbackMasters() {
  return visibleMasters(Object.keys(MASTERS_META).map(function(id) {
    return {
      id: Number(id),
      name: STATIC_MASTER_NAMES[Number(id)] || masterName(Number(id)),
      specialization: MASTERS_META[id].tagline || '',
      avatar: MASTERS_META[id].avatar || '',
      bookable: true,
    };
  }));
}

function visibleMasters(list) {
  return (list || []).filter(function(m) {
    if (!m) return false;
    if (isHiddenStaff(m)) return false;
    if (m.bookable === false && ALWAYS_SHOW_STAFF_IDS.indexOf(Number(m.id)) === -1) return false;
    return true;
  });
}

// ── Load initial data ──────────────────────────────────────────
function loadInitialData(cb) {
  // Предзаполняем статическими данными — API обновит если вернёт данные
  if (!_addonObjs.length) { _addonObjs = ADDON_STATIC_DATA.slice(); }
  if (!_globalAddonObjs.length) { _globalAddonObjs = ADDON_STATIC_DATA.slice(); }
  showLoader('cw-masters-list', 'Meisterinnen laden…');
  Promise.all([
    apiGet('/book_staff/'+CONFIG.locationId),
    apiGet('/book_services/'+CONFIG.locationId),
  ]).then(function(results) {
    var staffRes = results[0];
    var svcRes   = results[1];
    if (!staffRes.success || !svcRes.success) throw new Error('API error');
    _allMasters = Array.isArray(staffRes.data)
      ? staffRes.data
      : (staffRes.data && Array.isArray(staffRes.data.staff) ? staffRes.data.staff : []);
    _allMasters = sortMasters(visibleMasters(_allMasters));
    if (!_allMasters.length) _allMasters = fallbackMasters();
    _allServices = (svcRes.data && svcRes.data.services) ? svcRes.data.services : [];
    // cache addon objects — глобальный кэш без staff_id, используется всегда
    var apiAddons = _allServices.filter(function(s){ return ADDON_IDS.indexOf(s.id) !== -1; });
    // Мержим: берём API данные если есть, иначе оставляем статику
    if (apiAddons.length) {
      _addonObjs = apiAddons;
      _globalAddonObjs = apiAddons.slice();
    }
    // Иначе оставляем предзаполненные из ADDON_STATIC_DATA
    if (cb) { cb(); } else { renderMasters(); }
  }).catch(function(err){
    var msg = err && err.message ? err.message : String(err);
    console.error('[crocus] loadInitialData failed:', msg);
    var el = document.getElementById('cw-masters-list');
    if (el) el.innerHTML = '<div class="cw-error" style="display:flex;flex-direction:column;gap:10px;align-items:center;padding:20px;text-align:center"><div>Fehler beim Laden. Bitte erneut versuchen.</div><button onclick="_crocusRetry()" style="background:rgba(201,168,124,0.15);border:1px solid rgba(201,168,124,0.35);color:#c9a87c;padding:8px 18px;border-radius:8px;cursor:pointer;font-family:DM Sans,sans-serif;font-size:12px">↺ Erneut versuchen</button></div>';
  });
}
window._crocusRetry = function(){ _allMasters = null; loadInitialData(); };

// ── Step 1: Masters ────────────────────────────────────────────
function renderMasters() {
  var list = document.getElementById('cw-masters-list');
  list.innerHTML = '';

  _allMasters = sortMasters(visibleMasters(_allMasters));
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
        + '<img class="cw-master-avatar" src="'+(meta.avatar||m.avatar||'https://be.cdn.alteg.io/images/no-master-sm.png')+'" alt="'+m.name+'" loading="lazy" onerror="this.src=\'https://be.cdn.alteg.io/images/no-master-sm.png\'">'
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
        + '<div class="cw-master-slot" id="cw-slot-'+m.id+'"><span style="opacity:0.35;font-size:10px;">lädt…</span></div>'
      + '</div>'
    + '</div>';

    card.addEventListener('click', function(){ selectMaster(m, meta); });
    list.appendChild(card);
  });

  // Загружаем слоты для каждого мастера
  _allMasters.forEach(function(m) {
    loadMasterSlot(m.id);
  });
}

function openExpressNails() {
  cw.express = true;
  cw.master = null;
  cw.category = null;
  cw.service = null;
  cw.addons = [];
  cw.date = null;
  cw.time = null;
  cw.datetime = null;
  cw.comboAppointments = null;
  cw.comboRoute = null;
  document.getElementById('cw-sel-master-name').textContent = 'Spontan-Termin sichern';
  var list = document.getElementById('cw-cats-list');
  list.innerHTML = '<div class="cw-loader"><div class="cw-spinner"></div><span class="cw-loader-text">Schnellste Termine werden geladen…</span></div>';
  goStep(2);
  apiGet('/book_services/'+CONFIG.locationId)
    .then(function(res) {
      if (res.success && res.data && res.data.services) _allServices = res.data.services;
      renderCategories(KOMBI_STAFF_IDS[0]);
    })
    .catch(function(){ renderCategories(KOMBI_STAFF_IDS[0]); });
}

var _SLOT_SERVICE = { 3020185: 13485754, 3020186: 13485753, 3020187: 13485753, 3047989: 13485763 };

function loadMasterSlot(staffId) {
  var serviceId = _SLOT_SERVICE[staffId];
  if (!serviceId) return;
  var el = document.getElementById('cw-slot-' + staffId);
  if (!el) return;

  function pad2(n) { return n < 10 ? '0'+n : String(n); }
  function fmtDate(ds) {
    var today = pad2fmt(new Date());
    var tom   = pad2fmt(new Date(Date.now() + 86400000));
    if (ds === today) return 'heute';
    if (ds === tom)   return 'morgen';
    var days = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    var dt = new Date(ds); return days[dt.getDay()]+', '+pad2(dt.getDate())+'.'+pad2(dt.getMonth()+1)+'.';
  }
  function pad2fmt(d) {
    return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
  }

  // Шаг 1: book_dates — сразу получаем доступные даты (1 запрос)
  apiGet('/book_dates/' + CONFIG.locationId, { staff_id: staffId, 'service_ids[]': serviceId })
    .then(function(res) {
      var dates = [];
      if (res && Array.isArray(res.booking_dates)) dates = res.booking_dates;
      else if (res && res.data && Array.isArray(res.data.booking_dates)) dates = res.data.booking_dates;

      // Fallback: если book_dates не дал результат — ищем в ближайших 14 днях
      if (!dates.length) {
        var fallback = [];
        for (var i = 0; i < 14; i++) {
          fallback.push(pad2fmt(new Date(Date.now() + i * 86400000)));
        }
        dates = fallback;
      }

      // Шаг 2: book_times только для первой доступной даты (1 запрос)
      var firstDate = dates[0];
      return apiGet('/book_times/' + CONFIG.locationId + '/' + staffId + '/' + firstDate, { 'service_ids[]': serviceId })
        .then(function(res2) {
          var slots = Array.isArray(res2) ? res2 : (res2 && res2.success && Array.isArray(res2.data)) ? res2.data : [];
          return slots.length ? { date: firstDate, slots: slots } : null;
        });
    })
    .catch(function(){ return null; })
    .then(function(result) {
      if (!el) return;
      if (!result) {
        el.innerHTML = '<span class="cw-master-slot-dot grey"></span><span style="color:rgba(240,232,216,0.55);">Auf Anfrage</span>';
      } else {
        var label = fmtDate(result.date);
        var first = result.slots[0] ? result.slots[0].time : '';
        var count = result.slots.length;
        var isToday = result.date === pad2fmt(new Date());
        var dotCls = (isToday && count <= 3) ? 'orange' : '';
        var txt = first ? label + ' · ab ' + first + ' Uhr' : label;
        if (isToday && count <= 3) txt += ' · letzter Platz';
        el.innerHTML = '<span class="cw-master-slot-dot ' + dotCls + '"></span><span style="color:rgba(240,232,216,0.85);">' + txt + '</span>';
      }
    });
}

function selectMaster(m, meta) {
  cw.express = false;
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
      if (res.success && res.data && res.data.services && res.data.services.length) {
        _allServices = res.data.services;
        // Кэшируем seance_length per staff+service
        _allServices.forEach(function(svc) {
          if (svc.seance_length) {
            _seanceCache[m.id + '_' + svc.id] = svc.seance_length;
          }
        });
        // НЕ перезаписываем _addonObjs — у staff_id запроса аддоны могут не вернуться
        // Используем _globalAddonObjs из начального запроса без staff_id
        if (_globalAddonObjs.length) {
          _addonObjs = _globalAddonObjs;
        } else {
          // fallback: если глобальный кэш пустой — берём из текущего ответа
          var fromCurrent = _allServices.filter(function(s){ return ADDON_IDS.indexOf(s.id) !== -1; });
          if (fromCurrent.length) { _addonObjs = fromCurrent; _globalAddonObjs = fromCurrent.slice(); }
        }
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

  function priceForStaff(serviceId) {
    var svc = _allServices.filter(function(s){ return s.id === serviceId; })[0];
    if (!svc) return 0;
    if (svc.staff && svc.staff.length) {
      for (var i = 0; i < svc.staff.length; i++) {
        if (Number(svc.staff[i].id) === Number(masterId)) {
          return Number(svc.staff[i].price_min || svc.price_min || 0);
        }
      }
      return 0;
    }
    return Number(svc.price_min || 0);
  }

  function categoryPriceFromAltegio(cat) {
    if (cw.express) {
      if (cat.key === 'kombi') {
        var comboPrices = KOMBI_STAFF_IDS.map(function(staffId) {
          return (function(oldMasterId) {
            masterId = staffId;
            var p = priceForStaff(KOMBI_MANI_SERVICE_ID) + priceForStaff(KOMBI_PEDI_SERVICE_ID);
            masterId = oldMasterId;
            return p;
          })(masterId);
        }).filter(function(p){ return p > 0; });
        return comboPrices.length ? 'ab '+Math.min.apply(Math, comboPrices)+' €' : '';
      }
      var allPrices = [];
      KOMBI_STAFF_IDS.forEach(function(staffId) {
        cat.serviceIds.forEach(function(serviceId) {
          var oldMasterId = masterId;
          masterId = staffId;
          var p = priceForStaff(serviceId);
          masterId = oldMasterId;
          if (p > 0) allPrices.push(p);
        });
      });
      return allPrices.length ? 'ab '+Math.min.apply(Math, allPrices)+' €' : '';
    }
    if (cat.key === 'kombi') {
      var comboPrice = priceForStaff(KOMBI_MANI_SERVICE_ID) + priceForStaff(KOMBI_PEDI_SERVICE_ID);
      return comboPrice ? 'ab '+comboPrice+' €' : '';
    }
    var prices = cat.serviceIds.map(priceForStaff).filter(function(p){ return p > 0; });
    if (!prices.length) return '';
    return 'ab '+Math.min.apply(Math, prices)+' €';
  }

  CATEGORIES.forEach(function(cat) {
    if (cw.express && cat.key !== 'manikuere' && cat.key !== 'pediküre' && cat.key !== 'kombi') return;
    // Показываем только категории из meta.cats мастера
    var meta = cw.master ? MASTERS_META[cw.master.id] : null;
    if (meta && meta.cats && meta.cats.indexOf(cat.key) === -1) return;

    var btn = document.createElement('button');
    btn.className = 'cw-cat-card';
    var priceHtml = categoryPriceFromAltegio(cat);
    var imgHtml = cat.img
      ? '<img class="cw-cat-img" src="'+cat.img+'" alt="'+cat.label+'" loading="lazy"'
        + (cat.fallbackImg ? ' onerror="this.onerror=null;this.src=\''+cat.fallbackImg+'\'"' : '')
        + '>'
      : '<div class="cw-cat-img" style="background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;font-size:22px">👁</div>';
    btn.innerHTML =
      imgHtml
      + '<div class="cw-cat-text">'
        + '<span class="cw-cat-label">'+cat.label+'</span>'
        + '<span class="cw-cat-desc">'+cat.desc+'</span>'
        + (priceHtml ? '<span class="cw-cat-price">'+priceHtml+'</span>' : '')
        + (cw.express ? '<span class="cw-express-status bad" id="cw-express-status-'+cat.key+'">prüfe 3 Tage</span>' : '')
      + '</div>'
      + '<span class="cw-cat-arrow">›</span>';
    btn.addEventListener('click', function(){ selectCategory(cat); });
    list.appendChild(btn);
  });
  if (cw.express) hydrateExpressCategoryStatuses();
}

function localDateString(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  function pad(n){ return String(n).padStart(2,'0'); }
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}

function expressDayLabel(ds) {
  var today = localDateString(0);
  var tomorrow = localDateString(1);
  var dayAfterTomorrow = localDateString(2);
  if (ds === today) return 'Heute';
  if (ds === tomorrow) return 'Morgen';
  if (ds === dayAfterTomorrow) return 'Übermorgen';
  return new Date(ds+'T12:00:00').toLocaleDateString('de-DE', { weekday:'short', day:'numeric', month:'short' });
}

function hydrateExpressCategoryStatuses() {
  CATEGORIES.forEach(function(cat) {
    if (cat.key !== 'manikuere' && cat.key !== 'pediküre' && cat.key !== 'kombi') return;
    var el = document.getElementById('cw-express-status-' + cat.key);
    if (!el) return;
    loadExpressCategoryPreview(cat).then(function(hit) {
      if (!hit) {
        el.className = 'cw-express-status bad';
        el.textContent = '3 Tage voll';
        return;
      }
      el.className = 'cw-express-status ' + (hit.ds === localDateString(0) ? 'good' : 'warn');
      el.textContent = expressDayLabel(hit.ds) + ' ab ' + hit.time + (hit.note ? ' · ' + hit.note : '');
    }).catch(function() {
      el.className = 'cw-express-status bad';
      el.textContent = 'auf Anfrage';
    });
  });
}

function expressServiceShortTitle(svc) {
  var title = String((svc && svc.title) || '');
  title = title
    .replace(/Maniküre/gi, '')
    .replace(/Pediküre/gi, '')
    .replace(/Russische/gi, '')
    .replace(/Hygienische/gi, 'Basis')
    .replace(/\s+/g, ' ')
    .replace(/^[\s+·-]+|[\s+·-]+$/g, '')
    .trim();
  if (!title) title = 'Basis';
  if (title.length > 18) title = title.slice(0, 17).trim() + '…';
  return title;
}

function expressPreviewDates() {
  return [localDateString(0), localDateString(1), localDateString(2)];
}

function cachedSingleExpressSlots(serviceId, ds, target) {
  var key = currentSingleServiceIds(serviceId).join(',') + '|' + ds + '|' + (target || 3);
  if (!_expressPreviewCache[key]) {
    _expressPreviewCache[key] = loadSingleExpressSlotsForDate(serviceId, ds, target || 3);
  }
  return _expressPreviewCache[key];
}

function loadExpressCategoryPreview(cat) {
  var dates = expressPreviewDates();
  if (cat.key === 'kombi') {
    return dates.reduce(function(chain, ds) {
      return chain.then(function(found) {
        if (found) return found;
        return loadComboSlotsForDate(ds).then(function(slots) {
          return slots && slots.length ? { ds: ds, time: slots[0].time, slots: slots, note: 'Kombi frei' } : null;
        });
      });
    }, Promise.resolve(null));
  }

  var services = (_allServices || []).filter(function(s){ return cat.serviceIds.indexOf(s.id) !== -1; });
  if (!services.length) return Promise.resolve(null);
  return dates.reduce(function(chain, ds) {
    return chain.then(function(found) {
      if (found) return found;
      return Promise.all(services.map(function(svc) {
        return cachedSingleExpressSlots(svc.id, ds, 3).then(function(slots) {
          return { service: svc, slots: slots || [] };
        });
      })).then(function(results) {
        var hits = results.filter(function(r){ return r.slots && r.slots.length; });
        if (!hits.length) return null;
        hits.sort(function(a, b) {
          return String(a.slots[0].datetime).localeCompare(String(b.slots[0].datetime));
        });
        var first = hits[0];
        return {
          ds: ds,
          time: first.slots[0].time,
          slots: first.slots,
          service: first.service,
          note: hits.length > 1 ? hits.length + ' Behandlungen' : expressServiceShortTitle(first.service),
        };
      });
    });
  }, Promise.resolve(null));
}

function selectCategory(cat) {
  cw.category = cat;
  cw.service = null;
  // Tracking
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'booking_category_selected', category: cat.label, master_name: cw.master ? cw.master.name : '', page_location: window.location.href });
  if (cat.key === 'kombi') {
    var kombiSvc = _allServices.filter(function(s){ return s.id === KOMBI_SERVICE_ID; })[0]
      || { id: KOMBI_SERVICE_ID, title: 'Maniküre + Pediküre (Kombi)', price_min: 0, price_max: 0 };
    selectService(kombiSvc);
    return;
  }
  document.getElementById('cw-step3-title').textContent = cat.label;
  document.getElementById('cw-step3-sub').innerHTML = cw.express
    ? '<strong style="color:#fdfaf8">Spontan-Termin sichern</strong>'
    : 'Meisterin: <strong style="color:#fdfaf8">'+cw.master.name+'</strong>';
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

  var byId = {};
  svcs.forEach(function(s){ byId[s.id] = s; });

  function appendWimperVisual() {
    var visual = document.createElement('div');
    var img = cw.master && cw.master.avatar
      ? cw.master.avatar
      : 'https://cdn.jsdelivr.net/gh/chistyartem-blip/crocus-widget@0df00f6/assets/albina.webp';
    visual.className = 'cw-wimp-visual';
    visual.innerHTML =
      '<img src="'+img+'" alt="Albina" loading="lazy" onerror="this.remove()">'
      + '<div>'
        + '<div class="cw-wimp-visual-title">Albina &middot; Lash Artistin</div>'
        + '<div class="cw-wimp-visual-sub">Neuset, Korrektur, Lifting und Extras klar sortiert.</div>'
      + '</div>';
    list.appendChild(visual);
  }

  function appendServiceGroup(group) {
    var groupSvcs = group.ids.map(function(id){ return byId[id]; }).filter(Boolean);
    if (!groupSvcs.length) return;
    var heading = document.createElement('div');
    heading.className = 'cw-svc-group';
    heading.innerHTML =
      '<span class="cw-svc-group-title">'+group.title+'</span>'
      + '<span class="cw-svc-group-note">'+group.note+'</span>';
    list.appendChild(heading);
    groupSvcs.forEach(function(s){ appendServiceButton(s, group.key); });
  }

  function appendServiceButton(s, groupKey) {
    // Цена конкретного мастера из staff[], иначе общий price_min/max
    var minP = s.price_min || 0;
    var maxP = s.price_max || 0;
    if (!cw.express && cw.master && s.staff && s.staff.length) {
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
    if (s.id === KOMBI_SERVICE_ID) {
      durStr = 'nach freiem Ablauf';
      priceStr = 'nach Slot';
    }
    if (cw.express && s.staff && s.staff.length) {
      var staffPrices = s.staff
        .filter(function(st){ return KOMBI_STAFF_IDS.indexOf(Number(st.id)) !== -1; })
        .map(function(st){ return Number(st.price_min || s.price_min || 0); })
        .filter(function(p){ return p > 0; });
      if (staffPrices.length) {
        minP = Math.min.apply(Math, staffPrices);
        maxP = Math.max.apply(Math, staffPrices);
        priceStr = minP === maxP ? minP+' &euro;' : 'ab '+minP+' &euro;';
      }
    }

    var btn = document.createElement('button');
    if (cw.express) priceStr = minP === maxP ? minP+' &euro;' : 'ab '+minP+' &euro;';
    btn.className = 'cw-svc-btn' + (groupKey === 'extras' ? ' cw-svc-btn--extra' : '');
    if (cw.express) {
      btn.disabled = true;
      btn.dataset.serviceId = s.id;
    }
    btn.innerHTML =
      '<div class="cw-svc-left">'
        + '<div class="cw-svc-name">'+s.title+'</div>'
        + (durStr ? '<div class="cw-svc-dur">⏱ '+durStr+'</div>' : '')
        + (cw.express ? '<span class="cw-svc-status bad" id="cw-svc-status-'+s.id+'">prüfe freie Slots</span>' : '')
      + '</div>'
      + '<div class="cw-svc-price">'+priceStr+'</div>';
    btn.addEventListener('click', function(){ selectService(s); });
    list.appendChild(btn);
    if (cw.express) hydrateExpressServiceStatus(s, btn);
  }

  if (cat.key === 'wimpern') {
    appendWimperVisual();
    WIMPER_SERVICE_GROUPS.forEach(appendServiceGroup);
    return;
  }

  svcs.forEach(function(s){ appendServiceButton(s); });
}

function loadExpressServicePreview(serviceId) {
  return expressPreviewDates().reduce(function(chain, ds) {
    return chain.then(function(found) {
      if (found) return found;
      return cachedSingleExpressSlots(serviceId, ds, 3).then(function(slots) {
        return slots && slots.length ? { ds: ds, time: slots[0].time, slots: slots } : null;
      });
    });
  }, Promise.resolve(null));
}

function hydrateExpressServiceStatus(service, btn) {
  var el = document.getElementById('cw-svc-status-' + service.id);
  loadExpressServicePreview(service.id).then(function(hit) {
    if (!el) return;
    if (!hit) {
      btn.disabled = true;
      el.className = 'cw-svc-status bad';
      el.textContent = 'kein Slot in 3 Tagen';
      return;
    }
    btn.disabled = false;
    el.className = 'cw-svc-status ' + (hit.ds === localDateString(0) ? 'good' : 'warn');
    el.textContent = expressDayLabel(hit.ds) + ' ab ' + hit.time;
  }).catch(function() {
    if (!el) return;
    btn.disabled = true;
    el.className = 'cw-svc-status bad';
    el.textContent = 'auf Anfrage';
  });
}

function selectService(s) {
  cw.service = s;
  cw.addons = [];
  cw.comboAppointments = null;
  cw.comboRoute = null;
  // Tracking
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'booking_service_selected', service_name: s.title, category: cw.category ? cw.category.label : '', master_name: cw.master ? cw.master.name : '', page_location: window.location.href });
  // Для ресниц — всегда пропускаем допы
  if (cw.category.key === 'wimpern') {
    buildStep5Sub();
    goStep(5);
    renderCalendar();
    loadAvailDates();
    return;
  }
  // Для услуг без допов — пропускаем шаг 4
  console.log('[crocus] selectService id='+s.id+' NO_ADDON_check='+(NO_ADDON_SERVICE_IDS.indexOf(s.id)!==-1)+' _addonObjs.length='+_addonObjs.length);
  if (NO_ADDON_SERVICE_IDS.indexOf(s.id) !== -1) {
    buildStep5Sub();
    goStep(5);
    if (cw.express) {
      renderExpressTwoDayPicker();
      return;
    }
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
  cw.addons = [];

  // Если _addonObjs пустой — восстановить из глобального кэша или статики
  if (!_addonObjs.length && _globalAddonObjs.length) {
    _addonObjs = _globalAddonObjs.slice();
  }
  if (!_addonObjs.length) {
    // Ни кэш ни глобальный кэш не заполнены — используем статику немедленно
    _addonObjs = ADDON_STATIC_DATA.slice();
    _globalAddonObjs = ADDON_STATIC_DATA.slice();
    console.warn('[crocus] renderAddons: _addonObjs empty — initialized from ADDON_STATIC_DATA');
  }

  console.log('[crocus] renderAddons: _addonObjs='+_addonObjs.length+' _globalAddonObjs='+_globalAddonObjs.length+' master='+(cw.master ? cw.master.id : 'null')+' service='+(cw.service ? cw.service.id : 'null'));

  // === Комби: особый рендер виртуальных аддонов (French x2: Hände + Füße) ===
  var isKombi = cw.service && cw.service.id === 13485762;
  if (isKombi) {
    // Найти объект French из API для цены
    var frenchObj = _addonObjs.filter(function(o){ return o.id === 13485756; })[0]
                 || _globalAddonObjs.filter(function(o){ return o.id === 13485756; })[0]
                 || { id: 13485756, title: 'French', price_min: 5 };
    KOMBI_VIRTUAL_ADDONS.forEach(function(vAddon) {
      var displayAddon = Object.assign({}, frenchObj, vAddon);
      var priceStr = frenchObj.price_min ? '+ '+frenchObj.price_min+' €' : '+ 5 €';
      var btn = document.createElement('button');
      btn.className = 'cw-addon-btn';
      btn.dataset.variantKey = vAddon._variantKey;
      btn.innerHTML =
        '<div class="cw-addon-check"></div>'
        + '<div class="cw-addon-info">'
          + '<div class="cw-addon-name">'+vAddon._kombiLabel+'</div>'
          + '<div class="cw-addon-price">'+priceStr+'</div>'
        + '</div>';
      btn.addEventListener('click', (function(da, b){
        return function(){
          var idx = cw.addons.findIndex(function(a){ return a._variantKey === da._variantKey; });
          if (idx === -1) {
            cw.addons.push(da);
            b.classList.add('sel');
            b.querySelector('.cw-addon-check').textContent = '✓';
          } else {
            cw.addons.splice(idx, 1);
            b.classList.remove('sel');
            b.querySelector('.cw-addon-check').textContent = '';
          }
          var nextBtn = document.getElementById('cw-next-addon');
          if (nextBtn) nextBtn.style.display = cw.addons.length ? 'block' : 'none';
        };
      })(displayAddon, btn));
      list.appendChild(btn);
    });

    var kombiById = {};
    ADDON_STATIC_DATA.concat(_addonObjs).forEach(function(s) {
      if (ADDON_IDS.indexOf(s.id) === -1) return;
      if (s.id === 13485756) return;
      kombiById[s.id] = Object.assign({}, kombiById[s.id] || {}, s);
    });
    var kombiExtraAddons = Object.keys(kombiById).map(function(id){ return kombiById[id]; });
    kombiExtraAddons.sort(function(a, b){ return ADDON_IDS.indexOf(a.id) - ADDON_IDS.indexOf(b.id); });
    kombiExtraAddons.forEach(function(s) {
      var priceStr = s.price_min ? '+ '+s.price_min+' €' : '';
      var btn = document.createElement('button');
      btn.className = 'cw-addon-btn';
      btn.dataset.id = s.id;
      btn.innerHTML =
        '<div class="cw-addon-check"></div>'
        + '<div class="cw-addon-info">'
          + '<div class="cw-addon-name">'+addonDisplayName(s)+'</div>'
          + (priceStr ? '<div class="cw-addon-price">'+priceStr+'</div>' : '')
        + '</div>';
      btn.addEventListener('click', (function(sv, b){
        return function(){
          var idx = cw.addons.findIndex(function(a){ return !a._variantKey && a.id === sv.id; });
          if (idx === -1) {
            cw.addons.push(sv);
            b.classList.add('sel');
            b.querySelector('.cw-addon-check').textContent = '✓';
          } else {
            cw.addons.splice(idx, 1);
            b.classList.remove('sel');
            b.querySelector('.cw-addon-check').textContent = '';
          }
          var nextBtn = document.getElementById('cw-next-addon');
          if (nextBtn) nextBtn.style.display = cw.addons.length ? 'block' : 'none';
        };
      })(s, btn));
      list.appendChild(btn);
    });
    return;
  }

  var filteredAddons = _addonObjs.filter(function(s){
    // Фильтр по услуге: если есть ADDON_IDS_BY_SERVICE для текущей услуги — показываем только разрешённые
    if (cw.service && ADDON_IDS_BY_SERVICE[cw.service.id]) {
      if (ADDON_IDS_BY_SERVICE[cw.service.id].indexOf(s.id) === -1) return false;
    }
    // Mandel-Form — только для Nelia и Sofia
    if (s.id === 13502395 && cw.master && MANDEL_STAFF_IDS.indexOf(cw.master.id) === -1) return false;
    // Stiletto — только для Diana, Nelia, Sofia
    if (s.id === 13485758 && cw.master && STILETTO_STAFF_IDS.indexOf(cw.master.id) === -1) return false;
    // Babyboomer — только для Diana
    if (s.id === 13485757 && cw.master && BABYBOOMER_STAFF_IDS.indexOf(cw.master.id) === -1) return false;
    return true;
  });
  // Порядок как в ADDON_IDS
  filteredAddons.sort(function(a, b){ return ADDON_IDS.indexOf(a.id) - ADDON_IDS.indexOf(b.id); });

  console.log('[crocus] renderAddons: filteredAddons='+filteredAddons.length);

  if (!filteredAddons.length) {
    // filteredAddons пустой — немедленно восстанавливаем из статического fallback
    var serviceHasDefinedAddons = cw.service && ADDON_IDS_BY_SERVICE[cw.service.id] && ADDON_IDS_BY_SERVICE[cw.service.id].length > 0;
    if (serviceHasDefinedAddons) {
      console.warn('[crocus] renderAddons: filteredAddons empty — applying ADDON_STATIC_DATA immediately');
      _addonObjs = ADDON_STATIC_DATA.slice();
      _globalAddonObjs = ADDON_STATIC_DATA.slice();
      // Повторный рендер с статическими данными (синхронно)
      var filteredStatic = _addonObjs.filter(function(s){
        if (cw.service && ADDON_IDS_BY_SERVICE[cw.service.id]) {
          if (ADDON_IDS_BY_SERVICE[cw.service.id].indexOf(s.id) === -1) return false;
        }
        if (s.id === 13502395 && cw.master && MANDEL_STAFF_IDS.indexOf(cw.master.id) === -1) return false;
        if (s.id === 13485758 && cw.master && STILETTO_STAFF_IDS.indexOf(cw.master.id) === -1) return false;
        if (s.id === 13485757 && cw.master && BABYBOOMER_STAFF_IDS.indexOf(cw.master.id) === -1) return false;
        return true;
      });
      filteredStatic.sort(function(a, b){ return ADDON_IDS.indexOf(a.id) - ADDON_IDS.indexOf(b.id); });
      filteredStatic.forEach(function(s) {
        var priceStr = s.price_min ? '+ '+s.price_min+' €' : '';
        var btn = document.createElement('button');
        btn.className = 'cw-addon-btn';
        btn.dataset.id = s.id;
        btn.innerHTML =
          '<div class="cw-addon-check"></div>'
          + '<div class="cw-addon-info">'
            + '<div class="cw-addon-name">'+addonDisplayName(s)+'</div>'
            + (priceStr ? '<div class="cw-addon-price">'+priceStr+'</div>' : '')
          + '</div>';
        btn.addEventListener('click', (function(sv, b){
          return function(){
            var idx = cw.addons.findIndex(function(a){ return a.id === sv.id; });
            if (idx === -1) {
              cw.addons.push(sv);
              b.classList.add('sel');
              b.querySelector('.cw-addon-check').textContent = '✓';
            } else {
              cw.addons.splice(idx, 1);
              b.classList.remove('sel');
              b.querySelector('.cw-addon-check').textContent = '';
            }
            var nextBtn = document.getElementById('cw-next-addon');
            if (nextBtn) nextBtn.style.display = cw.addons.length ? 'block' : 'none';
          };
        })(s, btn));
        list.appendChild(btn);
      });
      return; // Статика отрендерена — конец
    }
    // Услуга не должна иметь допов — пропустить шаг
    buildStep5Sub();
    goStep(5);
    renderCalendar();
    loadAvailDates();
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
        + '<div class="cw-addon-name">'+addonDisplayName(s)+'</div>'
        + (priceStr ? '<div class="cw-addon-price">'+priceStr+'</div>' : '')
      + '</div>';
    btn.addEventListener('click', (function(sv, b){
      return function(){
        var idx = cw.addons.findIndex(function(a){ return a.id === sv.id; });
        if (idx === -1) {
          cw.addons.push(sv);
          b.classList.add('sel');
          b.querySelector('.cw-addon-check').textContent = '✓';
        } else {
          cw.addons.splice(idx, 1);
          b.classList.remove('sel');
          b.querySelector('.cw-addon-check').textContent = '';
        }
        var nextBtn = document.getElementById('cw-next-addon');
        if (nextBtn) nextBtn.style.display = cw.addons.length ? 'block' : 'none';
      };
    })(s, btn));
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
    addon_name: cw.addons.length ? cw.addons.map(addonDisplayName).join(', ') : '',
    page_location: window.location.href,
  });
  buildStep5Sub();
  goStep(5);
  if (cw.express) {
    renderExpressTwoDayPicker();
    return;
  }
  renderCalendar();
  loadAvailDates();
}

function buildStep5Sub() {
  var parts = [cw.service.title];
  cw.addons.forEach(function(a){ parts.push(addonDisplayName(a)); });
  document.getElementById('cw-step5-sub').innerHTML =
    parts.join(' + ') + ' · <strong style="color:#fdfaf8">'
      +(cw.express ? 'frühester geprüfter Slot' : cw.master.name)+'</strong>';
}

// ── Step 5: Calendar ───────────────────────────────────────────
function renderExpressTwoDayPicker() {
  cw.date = null; cw.time = null; cw.datetime = null; cw.comboAppointments = null; cw.comboRoute = null;
  var cal = document.querySelector('#cw-step5 .cw-calendar');
  var grid = document.getElementById('cw-cal-grid');
  document.getElementById('cw-times-wrap').style.display = 'none';
  cal.classList.add('express');
  grid.innerHTML = '';
  [0, 1, 2].forEach(function(offset) {
    var ds = localDateString(offset);
    var card = document.createElement('div');
    card.className = 'cw-express-day-card';
    card.id = 'cw-express-day-' + offset;
    card.innerHTML =
      '<div class="cw-express-day-head">'
        + '<div><div class="cw-express-day-title">'+expressDayLabel(ds)+'</div><span class="cw-express-day-date">'+new Date(ds+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})+'</span></div>'
        + '<span class="cw-express-status bad">prüfe Slots</span>'
      + '</div>'
      + '<div class="cw-express-day-note">Wir suchen den schnellsten geprüften Termin.</div>';
    grid.appendChild(card);
    loadExpressDaySlots(ds).then(function(slots) {
      updateExpressDayCard(card, ds, slots);
    }).catch(function(err) {
      console.error('[crocus] express day load failed:', err);
      updateExpressDayCard(card, ds, []);
    });
  });
  var moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'cw-express-more-btn';
  moreBtn.innerHTML = 'Weitere Termine im Kalender<span>andere nahe Daten ansehen</span>';
  moreBtn.addEventListener('click', renderExpressFullCalendar);
  grid.appendChild(moreBtn);
}

function renderExpressFullCalendar() {
  cw.date = null; cw.time = null; cw.datetime = null; cw.comboAppointments = null; cw.comboRoute = null;
  var cal = document.querySelector('#cw-step5 .cw-calendar');
  var grid = document.getElementById('cw-cal-grid');
  if (cal) cal.classList.remove('express');
  if (grid) {
    grid.className = 'cw-cal-grid';
    grid.innerHTML = '<div class="cw-loader" style="grid-column:span 7;padding:18px 0"><div class="cw-spinner"></div><span class="cw-loader-text">Kalender wird geprüft...</span></div>';
  }
  document.getElementById('cw-times-wrap').style.display = 'none';
  cw.calY = new Date().getFullYear();
  cw.calM = new Date().getMonth();
  loadAvailDates();
}

function updateExpressDayCard(card, ds, slots) {
  var cls = slots && slots.length ? (ds === localDateString(0) ? 'good' : 'warn') : 'bad';
  card.className = 'cw-express-day-card ' + cls;
  if (!slots || !slots.length) {
    card.innerHTML =
      '<div class="cw-express-day-head">'
        + '<div><div class="cw-express-day-title">'+expressDayLabel(ds)+'</div><span class="cw-express-day-date">'+new Date(ds+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})+'</span></div>'
        + '<span class="cw-express-status bad">nicht verfügbar</span>'
      + '</div>'
      + '<div class="cw-express-day-note">Keine passenden Slots für diesen Tag.</div>';
    return;
  }
  card.innerHTML =
    '<div class="cw-express-day-head">'
      + '<div><div class="cw-express-day-title">'+expressDayLabel(ds)+'</div><span class="cw-express-day-date">'+new Date(ds+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})+'</span></div>'
      + '<span class="cw-express-status '+cls+'">ab '+slots[0].time+'</span>'
    + '</div>'
    + '<div class="cw-express-day-times"></div>';
  var times = card.querySelector('.cw-express-day-times');
  slots.slice(0, 8).forEach(function(slot) {
    var btn = document.createElement('button');
    btn.className = 'cw-time free';
    btn.textContent = slot.time;
    btn.addEventListener('click', function(){
      cw.date = ds;
      chooseTimeSlot(slot, slots);
    });
    times.appendChild(btn);
  });
}

function loadExpressDaySlots(ds) {
  return cw.service.id === KOMBI_SERVICE_ID
    ? loadComboSlotsForDate(ds)
    : loadSingleExpressSlotsForDate(cw.service.id, ds, 16);
}

function loadAvailDates() {
  cw.availDates = [];
  if (cw.service.id === KOMBI_SERVICE_ID) {
    loadComboAvailDates();
    return;
  }
  if (cw.express) {
    loadExpressAvailDates();
    return;
  }
  var serviceIds = currentSingleServiceIds(cw.service.id);
  // Для Комби (13485762) аддоны (French и т.п.) — только UI-выбор, в API не передаём
  // apiGet автоматически добавляет [] для массивов → service_ids[]=xxx
  var params = { 'service_ids': serviceIds, staff_id: cw.master.id };
  // Передаём длительность из кэша если есть (критично для Kombi и длинных услуг)
  var cachedDur = currentSingleDurationForStaff(cw.master.id, cw.service.id);
  if (cachedDur) params.duration = cachedDur;
  var firstDay = new Date(cw.calY, cw.calM, 1).toISOString().split('T')[0];
  params.date = firstDay;
  console.log('[crocus] loadAvailDates: serviceIds='+JSON.stringify(serviceIds)+' staff='+cw.master.id+' dur='+(cachedDur||'?')+' from='+firstDay);

  apiGet('/book_dates/'+CONFIG.locationId, params)
    .then(function(res){
      if (res.success && res.data && res.data.booking_dates) {
        cw.availDates = res.data.booking_dates;
        console.log('[crocus] loadAvailDates: got '+cw.availDates.length+' dates: '+JSON.stringify(cw.availDates.slice(0,5)));
      } else {
        console.warn('[crocus] loadAvailDates: no dates in response', res);
      }
      renderCalendar();
    })
    .catch(function(e){ console.error('[crocus] loadAvailDates error:', e); renderCalendar(); });
}

function loadExpressAvailDates() {
  var firstDay = new Date(cw.calY, cw.calM, 1).toISOString().split('T')[0];
  var serviceIds = currentSingleServiceIds(cw.service.id);
  Promise.all(KOMBI_STAFF_IDS.map(function(staffId) {
    var params = {
      staff_id: staffId,
      service_ids: serviceIds,
      date: firstDay,
    };
    var duration = currentSingleDurationForStaff(staffId, cw.service.id);
    if (duration) params.duration = duration;
    return apiGet('/book_dates/'+CONFIG.locationId, params).catch(function(){ return null; });
  })).then(function(results) {
    var dates = {};
    results.forEach(function(res) {
      var list = res && res.data && res.data.booking_dates ? res.data.booking_dates : [];
      list.forEach(function(ds){ dates[ds] = true; });
    });
    cw.availDates = Object.keys(dates).sort();
    renderCalendar();
  }).catch(function(e) {
    console.error('[crocus] loadExpressAvailDates error:', e);
    renderCalendar();
  });
}

function loadComboAvailDates() {
  var firstDay = new Date(cw.calY, cw.calM, 1).toISOString().split('T')[0];
  console.log('[crocus] loadComboAvailDates: staff='+JSON.stringify(KOMBI_STAFF_IDS)+' from='+firstDay);
  var serviceLoads = KOMBI_STAFF_IDS.map(function(staffId){ return fetchStaffServices(staffId); });
  var dateLoads = [];
  KOMBI_STAFF_IDS.forEach(function(staffId) {
    dateLoads.push(apiGet('/book_dates/'+CONFIG.locationId, {
      staff_id: staffId,
      service_ids: [KOMBI_MANI_SERVICE_ID],
      date: firstDay,
    }).catch(function(){ return null; }));
    dateLoads.push(apiGet('/book_dates/'+CONFIG.locationId, {
      staff_id: staffId,
      service_ids: [KOMBI_PEDI_SERVICE_ID],
      date: firstDay,
    }).catch(function(){ return null; }));
  });

  Promise.all(serviceLoads.concat(dateLoads)).then(function(results) {
    var offset = serviceLoads.length;
    var maniDates = {};
    var pediDates = {};
    KOMBI_STAFF_IDS.forEach(function(staffId, idx) {
      var maniRes = results[offset + idx * 2];
      var pediRes = results[offset + idx * 2 + 1];
      var maniList = maniRes && maniRes.data && maniRes.data.booking_dates ? maniRes.data.booking_dates : (maniRes && maniRes.booking_dates || []);
      var pediList = pediRes && pediRes.data && pediRes.data.booking_dates ? pediRes.data.booking_dates : (pediRes && pediRes.booking_dates || []);
      maniList.forEach(function(ds){ maniDates[ds] = true; });
      pediList.forEach(function(ds){ pediDates[ds] = true; });
    });
    var dates = Object.keys(maniDates).filter(function(ds){ return !!pediDates[ds]; }).sort();
    if (cw.express) {
      cw.availDates = dates;
      console.log('[crocus] loadComboAvailDates quick: '+cw.availDates.length+' dates: '+JSON.stringify(cw.availDates.slice(0,5)));
      renderCalendar();
      warmComboCalendarDates(dates);
      return;
    }
    cw.availDates = dates;
    console.log('[crocus] loadComboAvailDates: got '+cw.availDates.length+' dates: '+JSON.stringify(cw.availDates.slice(0,5)));
    renderCalendar();
  }).catch(function(e) {
    console.error('[crocus] loadComboAvailDates error:', e);
    renderCalendar();
  });
}

function renderCalendar() {
  var cal = document.querySelector('#cw-step5 .cw-calendar');
  if (cal) cal.classList.remove('express');
  document.getElementById('cw-cal-title').textContent = MONTHS[cw.calM]+' '+cw.calY;
  var grid = document.getElementById('cw-cal-grid');
  grid.className = 'cw-cal-grid';
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
  cw.date = ds; cw.time = null; cw.datetime = null; cw.comboAppointments = null; cw.comboRoute = null;
  document.getElementById('cw-times-wrap').style.display = 'block';
  renderCalendar();
  loadTimes();
}

function loadTimes() {
  var grid = document.getElementById('cw-time-grid');
  grid.innerHTML = '<div class="cw-loader" style="padding:16px 0"><div class="cw-spinner"></div></div>';
  if (cw.service.id === KOMBI_SERVICE_ID) {
    loadComboTimes();
    return;
  }
  if (cw.express) {
    loadExpressTimes();
    return;
  }
  // Передаём только основную услугу — аддоны не влияют на доступность слотов
  var serviceIds = currentSingleServiceIds(cw.service.id);
  // apiGet автоматически добавляет [] для массивов → service_ids[]=xxx
  var timeParams = { 'service_ids': serviceIds };
  // Длительность из кэша — критично для Kombi (3ч) и длинных услуг
  var cachedDur = currentSingleDurationForStaff(cw.master.id, cw.service.id);
  if (cachedDur) timeParams.duration = cachedDur;
  console.log('[crocus] loadTimes: master='+cw.master.id+' date='+cw.date+' serviceIds='+JSON.stringify(serviceIds)+' dur='+(cachedDur||'?')+' addons='+JSON.stringify(cw.addons.map(function(a){return a.id;})));
  apiGet('/book_times/'+CONFIG.locationId+'/'+cw.master.id+'/'+cw.date, timeParams)
    .then(function(res){
      console.log('[crocus] loadTimes response: success='+res.success+' slots='+(res.data ? res.data.length : 'N/A'));
      if (!res.success) throw new Error('API returned success=false');
      renderTimesLoaded(res.data || []);
    })
    .catch(function(e){
      console.error('[crocus] loadTimes error:', e);
      grid.innerHTML = '<div class="cw-error" style="grid-column:span 4">Keine Zeiten verfügbar.</div>';
    });
}

function loadSingleExpressSlotsForDate(serviceId, ds, target) {
  var serviceIds = currentSingleServiceIds(serviceId);
  return Promise.all(KOMBI_STAFF_IDS.map(function(staffId) {
    return fetchStaffServices(staffId).then(function() {
      var params = { service_ids: serviceIds };
      var duration = currentSingleDurationForStaff(staffId, serviceId);
      if (duration) params.duration = duration;
      return apiGet('/book_times/'+CONFIG.locationId+'/'+staffId+'/'+ds, params);
    }).then(function(res) {
      return { staffId: staffId, slots: res && res.success ? (res.data || []) : [] };
    }).catch(function(){ return { staffId: staffId, slots: [] }; });
  })).then(function(results) {
    var candidates = [];
    results.forEach(function(item) {
      var expressMaster = masterById(item.staffId);
      if (!expressMaster) return;
      item.slots.forEach(function(slot) {
        candidates.push(Object.assign({}, slot, {
          staff_id: item.staffId,
          expressMaster: expressMaster,
          expressAppointment: singleAppointment(serviceId, item.staffId, slot.datetime, serviceIds),
        }));
      });
    });
    candidates = filterTestBlockedSlots(candidates, serviceId);
    candidates.sort(function(a,b){ return String(a.datetime).localeCompare(String(b.datetime)); });
    return batchCheckSlots(candidates, function(slot){ return [slot.expressAppointment]; }, {
      maxChecks: 24,
      target: target || 16,
      concurrency: 4,
    }).then(function(slots) {
      return filterTestBlockedSlots(dedupeTimeSlots(slots), serviceId);
    });
  });
}

function dedupeTimeSlots(slots) {
  var byTime = {};
  (slots || []).forEach(function(slot) {
    var key = slot.datetime || slot.time;
    if (!byTime[key]) byTime[key] = slot;
  });
  return Object.keys(byTime).sort().map(function(key){ return byTime[key]; });
}

function loadExpressTimes() {
  var grid = document.getElementById('cw-time-grid');
  loadSingleExpressSlotsForDate(cw.service.id, cw.date, 16)
  .then(function(slots) {
    renderTimesLoaded(slots);
  }).catch(function(e) {
    console.error('[crocus] loadExpressTimes error:', e);
    grid.innerHTML = '<div class="cw-error" style="grid-column:span 4">Keine Zeiten verfügbar.</div>';
  });
}

function addSecondsToAltegioDatetime(datetime, seconds) {
  var match = datetime.match(/([+-])(\d{2}):(\d{2})$/);
  var offsetMinutes = 0;
  var suffix = '';
  if (match) {
    offsetMinutes = (parseInt(match[2], 10) * 60 + parseInt(match[3], 10)) * (match[1] === '-' ? -1 : 1);
    suffix = match[0];
  }
  var local = new Date(new Date(datetime).getTime() + seconds * 1000 + offsetMinutes * 60000);
  function pad(n){ return String(n).padStart(2, '0'); }
  return local.getUTCFullYear()+'-'+pad(local.getUTCMonth()+1)+'-'+pad(local.getUTCDate())
    +'T'+pad(local.getUTCHours())+':'+pad(local.getUTCMinutes())+':'+pad(local.getUTCSeconds())+suffix;
}

function datetimeMs(datetime) {
  var ms = new Date(datetime).getTime();
  return isNaN(ms) ? 0 : ms;
}

function intervalOverlaps(startA, durationA, startB, durationB) {
  var a0 = datetimeMs(startA);
  var b0 = datetimeMs(startB);
  if (!a0 || !b0 || !durationA || !durationB) return false;
  var a1 = a0 + durationA * 1000;
  var b1 = b0 + durationB * 1000;
  b0 -= TEMP_BLOCK_GUARD_MS;
  b1 += TEMP_BLOCK_GUARD_MS;
  return a0 < b1 && b0 < a1;
}

function isIntervalBlockedByTest(staffId, datetime, duration) {
  staffId = Number(staffId);
  return TEMP_BLOCKED_RECORDS.some(function(blocked) {
    return Number(blocked.staffId) === staffId
      && intervalOverlaps(datetime, duration, blocked.datetime, blocked.duration);
  });
}

function slotDurationForStaff(slot, staffId) {
  if (!cw.service) return 0;
  if (cw.service.id === KOMBI_SERVICE_ID) return 0;
  return currentSingleDurationForStaff(staffId, cw.service.id)
    || serviceDurationForStaff(staffId, cw.service.id, slot, 0);
}

function isSlotBlockedByTest(slot) {
  if (!slot || !slot.datetime || !cw.service) return false;
  if (slot.comboAppointments && slot.comboAppointments.length) {
    return slot.comboAppointments.some(function(appt) {
      var duration = serviceDurationForStaff(appt.staff_id, appt.id, null, 0);
      return isIntervalBlockedByTest(appt.staff_id, appt.datetime, duration);
    });
  }
  var staffId = slot.staff_id
    || (slot.expressMaster && slot.expressMaster.id)
    || (cw.master && cw.master.id);
  var duration = slotDurationForStaff(slot, staffId);
  return staffId && duration && isIntervalBlockedByTest(staffId, slot.datetime, duration);
}

function isSingleSlotMarkedUnbookable(slot, serviceId) {
  serviceId = Number(serviceId || (cw.service && cw.service.id));
  if (!slot || !serviceId || serviceId === KOMBI_SERVICE_ID) return false;
  var staffId = Number(slot.staff_id || (slot.expressMaster && slot.expressMaster.id) || (cw.master && cw.master.id));
  var key = staffId + '|' + serviceId + '|' + String(slot.datetime || '');
  return TEMP_UNBOOKABLE_SINGLE_SLOTS.indexOf(key) !== -1;
}

function filterTestBlockedSlots(slots, serviceId) {
  return (slots || []).filter(function(slot) {
    return !isSlotBlockedByTest(slot) && !isSingleSlotMarkedUnbookable(slot, serviceId);
  });
}

function comboAppointment(serviceId, staffId, datetime) {
  return { id: serviceId, services: [serviceId], staff_id: Number(staffId), datetime: datetime };
}

function singleAppointment(serviceId, staffId, datetime, serviceIds) {
  serviceIds = serviceIds && serviceIds.length ? serviceIds.slice() : [serviceId];
  return { id: serviceId, services: serviceIds, staff_id: Number(staffId), datetime: datetime };
}

function currentSingleServiceIds(serviceId) {
  var ids = [Number(serviceId)];
  if (cw.service && Number(cw.service.id) === Number(serviceId) && Number(serviceId) !== KOMBI_SERVICE_ID) {
    cw.addons.forEach(function(addon) {
      var id = Number(addon.id);
      if (id && ids.indexOf(id) === -1) ids.push(id);
    });
  }
  return ids;
}

function currentSingleDurationForStaff(staffId, serviceId) {
  return currentSingleServiceIds(serviceId).reduce(function(total, id) {
    return total + (serviceDurationForStaff(staffId, id, null, 0) || 0);
  }, 0);
}

function checkAppointments(appointments, client) {
  client = client || {};
  return apiPost('/book_check/'+CONFIG.locationId, {
    phone: client.phone || '+4915700000616',
    fullname: client.fullname || 'Online Booking Check',
    email: client.email || '',
    notify_by_email: 0,
    lang: CONFIG.lang,
    lang_id: 3,
    bookform_id: 1427839,
    appointments: appointments,
  });
}

function verifySlotsFast(candidates, appointmentsForSlot, options) {
  options = options || {};
  var maxChecks = options.maxChecks || 24;
  var target = options.target || 16;
  var concurrency = options.concurrency || 4;
  var queue = candidates.slice(0, maxChecks);
  var verified = [];
  var index = 0;
  var active = 0;

  return new Promise(function(resolve) {
    function done() {
      return (index >= queue.length && active === 0) || verified.length >= target;
    }
    function pump() {
      if (done()) {
        verified.sort(function(a,b){ return String(a.datetime).localeCompare(String(b.datetime)); });
        resolve(verified.slice(0, target));
        return;
      }
      while (active < concurrency && index < queue.length && verified.length < target) {
        (function(slot) {
          active++;
          checkAppointments(appointmentsForSlot(slot))
            .then(function(res) {
              if (res && res.success) verified.push(slot);
            })
            .catch(function(){})
            .then(function() {
              active--;
              pump();
            });
        })(queue[index++]);
      }
    }
    pump();
  });
}

function batchCheckSlots(candidates, appointmentsForSlot, options) {
  options = options || {};
  var maxChecks = options.maxChecks || 24;
  var target = options.target || 16;
  var limited = candidates.slice(0, maxChecks);
  if (!limited.length) return Promise.resolve([]);

  return apiPost('/batch_book_check', {
    company_id: CONFIG.locationId,
    max_checks: maxChecks,
    target: target,
    concurrency: options.concurrency || 4,
    base: {
      phone: '+4915700000616',
      fullname: 'Online Booking Check',
      email: '',
      notify_by_email: 0,
      lang: CONFIG.lang,
      lang_id: 3,
      bookform_id: 1427839,
    },
    candidates: limited.map(function(slot, index) {
      return {
        index: index,
        key: String(slot.datetime || '') + ':' + String(slot.staff_id || ''),
        appointments: appointmentsForSlot(slot),
      };
    }),
  }).then(function(res) {
    if (!res || !res.success || !Array.isArray(res.ok)) throw new Error('batch_check_failed');
    var ok = {};
    res.ok.forEach(function(item){ ok[item.index] = true; });
    return limited.filter(function(_, index){ return !!ok[index]; }).slice(0, target);
  }).catch(function(err) {
    console.warn('[crocus] batch_book_check fallback:', err && err.message ? err.message : err);
    return verifySlotsFast(candidates, appointmentsForSlot, options);
  });
}

function warmComboCalendarDates(dates) {
  if (!cw.express || !dates || !dates.length) return;
  var today = localDateString(0);
  dates.filter(function(ds){ return ds >= today; }).slice(0, 3).forEach(function(ds) {
    loadComboSlotsForDate(ds).catch(function(){});
  });
}

function loadComboSlotsForDate(ds) {
  if (_comboSlotsCache[ds]) return _comboSlotsCache[ds];
  var timeLoads = [];
  KOMBI_STAFF_IDS.forEach(function(staffId) {
    timeLoads.push(fetchStaffServices(staffId));
    timeLoads.push(apiGet('/book_times/'+CONFIG.locationId+'/'+staffId+'/'+ds, { service_ids: [KOMBI_MANI_SERVICE_ID] }).catch(function(){ return null; }));
    timeLoads.push(apiGet('/book_times/'+CONFIG.locationId+'/'+staffId+'/'+ds, { service_ids: [KOMBI_PEDI_SERVICE_ID] }).catch(function(){ return null; }));
  });

  _comboSlotsCache[ds] = Promise.all(timeLoads).then(function(results) {
    var byStaff = {};
    KOMBI_STAFF_IDS.forEach(function(staffId, idx) {
      var maniRes = results[idx * 3 + 1];
      var pediRes = results[idx * 3 + 2];
      var maniSlots = maniRes && maniRes.success ? (maniRes.data || []) : [];
      var pediSlots = pediRes && pediRes.success ? (pediRes.data || []) : [];
      byStaff[staffId] = {
        mani: maniSlots,
        pedi: pediSlots,
        maniMap: {},
        pediMap: {},
      };
      maniSlots.forEach(function(slot){ byStaff[staffId].maniMap[slot.datetime] = slot; });
      pediSlots.forEach(function(slot){ byStaff[staffId].pediMap[slot.datetime] = slot; });
    });

    var candidates = [];
    KOMBI_STAFF_IDS.forEach(function(maniStaffId) {
      KOMBI_STAFF_IDS.forEach(function(pediStaffId) {
        buildComboPairCandidates(byStaff, maniStaffId, pediStaffId, candidates);
      });
    });

    candidates.sort(function(a,b) {
      return String(a.datetime).localeCompare(String(b.datetime)) || routeSortKey(a.comboRoute).localeCompare(routeSortKey(b.comboRoute));
    });
    console.log('[crocus] loadComboTimes: candidates='+candidates.length+' date='+ds);
    return batchCheckSlots(candidates, function(slot){ return slot.comboAppointments; }, {
      maxChecks: 48,
      target: 16,
      concurrency: 4,
    });
  }).then(function(verifiedSlots) {
    return dedupeComboSlots(verifiedSlots);
  });
  return _comboSlotsCache[ds];
}

function loadComboTimes() {
  loadComboSlotsForDate(cw.date).then(function(verifiedSlots) {
    if (!verifiedSlots || !verifiedSlots.length) {
      var grid = document.getElementById('cw-time-grid');
      grid.innerHTML = '<div class="cw-error" style="grid-column:span 4">Für diesen Tag gibt es leider keinen passenden Kombi-Slot. Bitte wähle ein anderes Datum.</div>';
      return;
    }
    renderTimesLoaded(verifiedSlots);
  }).catch(function(err) {
    console.error('[crocus] loadComboTimes error:', err);
    renderTimesLoaded([]);
  });
}

function comboPriority(maniStaffId, pediStaffId) {
  var selectedId = Number(cw.master && cw.master.id);
  var sameMaster = Number(maniStaffId) === Number(pediStaffId);
  if (sameMaster && Number(maniStaffId) === selectedId) return 0;
  if (sameMaster) return 1;
  if (Number(maniStaffId) === selectedId || Number(pediStaffId) === selectedId) return 2;
  return 3;
}

function comboRouteLabel(route) {
  if (!route) return cw.master ? cw.master.name : '';
  if (route.maniStaffId === route.pediStaffId) return masterName(route.maniStaffId);
  return 'Maniküre: '+masterName(route.maniStaffId)+' · Pediküre: '+masterName(route.pediStaffId);
}

function comboStaffComment(route) {
  if (!route) return 'Kombi-Termin: Maniküre und Pediküre nacheinander.';
  if (route.maniStaffId === route.pediStaffId) {
    return 'Kombi-Termin: Maniküre und Pediküre nacheinander bei '+masterName(route.maniStaffId)+'. Bitte als zusammengehörigen Termin behandeln.';
  }
  if (route.order === 'mani_first') {
    return 'Kombi-Termin: Zuerst Maniküre bei '+masterName(route.maniStaffId)+', danach Pediküre bei '+masterName(route.pediStaffId)+'. Bitte als zusammengehörigen Termin behandeln.';
  }
  return 'Kombi-Termin: Zuerst Pediküre bei '+masterName(route.pediStaffId)+', danach Maniküre bei '+masterName(route.maniStaffId)+'. Bitte als zusammengehörigen Termin behandeln.';
}

function routeTotalPrice(route) {
  if (!route) return 0;
  return servicePriceForStaff(route.maniStaffId, KOMBI_MANI_SERVICE_ID)
    + servicePriceForStaff(route.pediStaffId, KOMBI_PEDI_SERVICE_ID);
}

function routeTotalDuration(route) {
  if (!route) return 0;
  return (route.maniDuration || 0) + (route.pediDuration || 0);
}

function routeSortKey(route) {
  return [
    route.priority,
    route.maniStaffId === route.pediStaffId ? 0 : 1,
    route.endDatetime || '',
    route.maniStaffId,
    route.pediStaffId,
  ].join('|');
}

function putBestCandidate(candidatesByStart, candidate) {
  var current = candidatesByStart[candidate.datetime];
  if (!current || routeSortKey(candidate.comboRoute) < routeSortKey(current.comboRoute)) {
    candidatesByStart[candidate.datetime] = candidate;
  }
}

function dedupeComboSlots(slots) {
  var bestByStart = {};
  (slots || []).forEach(function(slot) {
    var key = slot.datetime;
    if (!bestByStart[key] || routeSortKey(slot.comboRoute) < routeSortKey(bestByStart[key].comboRoute)) {
      bestByStart[key] = slot;
    }
  });
  return Object.keys(bestByStart).sort().map(function(key){ return bestByStart[key]; }).slice(0, 16);
}

function addComboCandidate(candidates, candidate) {
  candidates.push(candidate);
}

function buildComboPairCandidates(byStaff, maniStaffId, pediStaffId, candidates) {
  var maniData = byStaff[maniStaffId];
  var pediData = byStaff[pediStaffId];
  if (!maniData || !pediData) return;

  maniData.mani.forEach(function(maniSlot) {
    var maniDuration = serviceDurationForStaff(maniStaffId, KOMBI_MANI_SERVICE_ID, maniSlot, 0);
    if (!maniDuration) return;
    var pediStart = addSecondsToAltegioDatetime(maniSlot.datetime, maniDuration);
    var pediSlot = pediData.pediMap[pediStart];
    if (!pediSlot) return;
    var pediDuration = serviceDurationForStaff(pediStaffId, KOMBI_PEDI_SERVICE_ID, pediSlot, 0);
    if (!pediDuration) return;
    addComboCandidate(candidates, makeComboCandidate({
      startSlot: maniSlot,
      order: 'mani_first',
      maniStaffId: maniStaffId,
      pediStaffId: pediStaffId,
      maniDatetime: maniSlot.datetime,
      pediDatetime: pediStart,
      maniDuration: maniDuration,
      pediDuration: pediDuration,
    }));
  });

  pediData.pedi.forEach(function(pediSlot) {
    var pediDuration = serviceDurationForStaff(pediStaffId, KOMBI_PEDI_SERVICE_ID, pediSlot, 0);
    if (!pediDuration) return;
    var maniStart = addSecondsToAltegioDatetime(pediSlot.datetime, pediDuration);
    var maniSlot = maniData.maniMap[maniStart];
    if (!maniSlot) return;
    var maniDuration = serviceDurationForStaff(maniStaffId, KOMBI_MANI_SERVICE_ID, maniSlot, 0);
    if (!maniDuration) return;
    addComboCandidate(candidates, makeComboCandidate({
      startSlot: pediSlot,
      order: 'pedi_first',
      maniStaffId: maniStaffId,
      pediStaffId: pediStaffId,
      maniDatetime: maniStart,
      pediDatetime: pediSlot.datetime,
      maniDuration: maniDuration,
      pediDuration: pediDuration,
    }));
  });
}

function makeComboCandidate(opts) {
  var route = {
    order: opts.order,
    maniStaffId: Number(opts.maniStaffId),
    pediStaffId: Number(opts.pediStaffId),
    maniDatetime: opts.maniDatetime,
    pediDatetime: opts.pediDatetime,
    maniDuration: opts.maniDuration,
    pediDuration: opts.pediDuration,
    priority: comboPriority(opts.maniStaffId, opts.pediStaffId),
  };
  route.endDatetime = addSecondsToAltegioDatetime(
    opts.order === 'mani_first' ? opts.pediDatetime : opts.maniDatetime,
    opts.order === 'mani_first' ? opts.pediDuration : opts.maniDuration
  );
  var candidate = Object.assign({}, opts.startSlot);
  candidate.comboAppointments = opts.order === 'mani_first'
    ? [
        comboAppointment(KOMBI_MANI_SERVICE_ID, opts.maniStaffId, opts.maniDatetime),
        comboAppointment(KOMBI_PEDI_SERVICE_ID, opts.pediStaffId, opts.pediDatetime),
      ]
    : [
        comboAppointment(KOMBI_PEDI_SERVICE_ID, opts.pediStaffId, opts.pediDatetime),
        comboAppointment(KOMBI_MANI_SERVICE_ID, opts.maniStaffId, opts.maniDatetime),
      ];
  candidate.comboRoute = route;
  return candidate;
}

function chooseTimeSlot(slot, slots) {
  if (isSlotBlockedByTest(slot) || isSingleSlotMarkedUnbookable(slot)) {
    showSelectedSlotError(slots, 'Dieser Termin wurde gerade belegt. Bitte wÃ¤hlen Sie eine andere Zeit.', String(slot.datetime || slot.time || ''));
    return;
  }
  if (cw.express && slot.expressMaster) {
    cw.master = slot.expressMaster;
    cw.master._meta = MASTERS_META[cw.master.id] || {};
  }
  if (cw.express && !cw.master && slot.comboRoute) {
    cw.master = masterById(slot.comboRoute.maniStaffId) || masterById(slot.comboRoute.pediStaffId) || fallbackMasters()[0];
    cw.master._meta = MASTERS_META[cw.master.id] || {};
  }
  if (cw.express && !cw.master && slot.staff_id) {
    cw.master = masterById(slot.staff_id) || fallbackMasters()[0];
    cw.master._meta = MASTERS_META[cw.master.id] || {};
  }
  cw.time = slot.time;
  cw.datetime = slot.datetime;
  cw.comboAppointments = slot.comboAppointments || null;
  cw.comboRoute = slot.comboRoute || null;
  if (slots) renderTimesLoaded(slots);

  var appointments = buildBookingAppointmentsFromState();
  if (!appointments.length) {
    showSelectedSlotError(slots, 'Bitte wählen Sie die Zeit erneut aus.');
    return;
  }

  checkAppointments(appointments)
    .then(function(res) {
      if (!res || !res.success) throw new Error('slot_unavailable');
      setTimeout(function(){
        renderSummary();
        goStep(6);
        prefillClientFields();
      }, 120);
    })
    .catch(function() {
      var badSlotKey = String(cw.datetime || cw.time || '');
      cw.time = null;
      cw.datetime = null;
      cw.comboAppointments = null;
      cw.comboRoute = null;
      showSelectedSlotError(slots, 'Dieser Termin wurde gerade belegt. Bitte wählen Sie eine andere Zeit.', badSlotKey);
    });
}

function buildBookingAppointmentsFromState() {
  if (!cw.service || !cw.datetime) return [];
  if (cw.service.id === KOMBI_SERVICE_ID) {
    return (cw.comboAppointments && cw.comboAppointments.length === 2) ? cw.comboAppointments : [];
  }
  if (!cw.master || !cw.master.id) return [];
  var svcIds = [cw.service.id].concat(cw.addons.map(function(a){ return a.id; }));
  return [{
    id: cw.service.id,
    services: svcIds,
    staff_id: cw.master.id,
    datetime: cw.datetime,
  }];
}

function prefillClientFields() {
  try {
    var saved = JSON.parse(localStorage.getItem('crocus_client') || '{}');
    if (saved.name)  { var fn = document.getElementById('cw-name');  if (fn && !fn.dataset.dirty) fn.value = saved.name; }
    if (saved.phone) { var fp = document.getElementById('cw-phone'); if (fp && !fp.dataset.dirty) { var _pp = parseStoredPhone(saved.phone); fp.value = _pp.local; var _ds = document.getElementById('cw-dial'); if (_ds && !_ds.dataset.dirty) _ds.value = _pp.dial; } }
    if (saved.email) { var fe = document.getElementById('cw-email'); if (fe && !fe.dataset.dirty) fe.value = saved.email; }
  } catch(ex) {}
}

function showSelectedSlotError(slots, message, badSlotKey) {
  var filtered = (slots || []).filter(function(item) {
    return String(item.datetime || item.time) !== String(badSlotKey || cw.datetime || cw.time);
  });
  renderTimesLoaded(filtered);
  var grid = document.getElementById('cw-time-grid');
  if (grid) {
    var err = document.createElement('div');
    err.className = 'cw-error';
    err.style.gridColumn = 'span 4';
    err.textContent = message;
    grid.insertBefore(err, grid.firstChild);
  }
}

function goContactWithoutSlotCheck() {
  setTimeout(function(){
    renderSummary();
    goStep(6);
    prefillClientFields();
  }, 120);
}

function renderTimesLoaded(slots) {
  var grid = document.getElementById('cw-time-grid');
  if (!slots) return;
  slots = filterTestBlockedSlots(slots);
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
      chooseTimeSlot(slot, slots);
      return;
      if (cw.express && slot.expressMaster) {
        cw.master = slot.expressMaster;
        cw.master._meta = MASTERS_META[cw.master.id] || {};
      }
      if (cw.express && !cw.master && slot.comboRoute) {
        cw.master = masterById(slot.comboRoute.maniStaffId) || masterById(slot.comboRoute.pediStaffId) || fallbackMasters()[0];
        cw.master._meta = MASTERS_META[cw.master.id] || {};
      }
      if (cw.express && !cw.master && slot.staff_id) {
        cw.master = masterById(slot.staff_id) || fallbackMasters()[0];
        cw.master._meta = MASTERS_META[cw.master.id] || {};
      }
      cw.time = slot.time;

      cw.datetime = slot.datetime;
      cw.comboAppointments = slot.comboAppointments || null;
      cw.comboRoute = slot.comboRoute || null;
      renderTimesLoaded(slots);
      setTimeout(function(){
        renderSummary();
        goStep(6);
        // Prefill from localStorage — only if user hasn't manually edited the field (data-dirty)
        try {
          var saved = JSON.parse(localStorage.getItem('crocus_client') || '{}');
          if (saved.name)  { var fn = document.getElementById('cw-name');  if (fn && !fn.dataset.dirty) fn.value = saved.name; }
          if (saved.phone) { var fp = document.getElementById('cw-phone'); if (fp && !fp.dataset.dirty) { var _pp = parseStoredPhone(saved.phone); fp.value = _pp.local; var _ds = document.getElementById('cw-dial'); if (_ds && !_ds.dataset.dirty) _ds.value = _pp.dial; } }
          if (saved.email) { var fe = document.getElementById('cw-email'); if (fe && !fe.dataset.dirty) fe.value = saved.email; }
        } catch(ex) {}
      }, 180);
    });
    grid.appendChild(btn);
  });
  // Скролл до слотов после рендера
  requestAnimationFrame(function() {
    var timesWrap = document.getElementById('cw-times-wrap');
    var body = document.getElementById('crocus-body');
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
  var meta = (cw.master && cw.master._meta) || {};
  var dateStr = cw.date
    ? new Date(cw.date+'T12:00:00').toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'})
    : '';
  // Цена мастера из staff[], иначе общий price_min
  function getMasterPrice(svc) {
    if (svc.staff && svc.staff.length) {
      for (var i = 0; i < svc.staff.length; i++) {
        if (cw.master && svc.staff[i].id === cw.master.id) return svc.staff[i].price_min || 0;
      }
    }
    return svc.price_min || 0;
  }
  var totalPrice = getMasterPrice(cw.service) + cw.addons.reduce(function(sum,a){ return sum+getMasterPrice(a); }, 0);
  if (cw.service.id === KOMBI_SERVICE_ID && cw.comboRoute) {
    totalPrice = routeTotalPrice(cw.comboRoute) + cw.addons.reduce(function(sum,a){ return sum + Number(a.price_min || a.price || 0); }, 0);
  }
  var priceStr = totalPrice ? totalPrice+' €' : '—';
  var svcStr = cw.service.title + (cw.addons.length ? ' + '+cw.addons.map(addonDisplayName).join(' + ') : '');
  var comboDurationStr = '';
  if (cw.service.id === KOMBI_SERVICE_ID) {
    var routeDuration = cw.comboRoute ? routeTotalDuration(cw.comboRoute) : 0;
    comboDurationStr = routeDuration ? Math.round(routeDuration / 60)+' Min' : '';
  }
  var masterSummary = cw.service.id === KOMBI_SERVICE_ID && cw.comboRoute
    ? comboRouteLabel(cw.comboRoute)
    : (cw.master ? cw.master.name : 'Schnellster freier Slot');

  document.getElementById('cw-summary').innerHTML =
    '<div class="cw-sum-row"><span>Meisterin</span><strong>'+masterSummary
      +'&ensp;<span style="font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:1px 7px;border-radius:20px;color:'+(meta.levelColor||'#c9a87c')+';background:'+(meta.levelBg||'rgba(201,168,124,.1)')+';border:1px solid '+(meta.levelBorder||'rgba(201,168,124,.3)')+'">'+((meta.level)||'Master')+'</span>'
      +'</strong></div>'
    +'<div class="cw-sum-row"><span>Behandlung</span><strong>'+svcStr+'</strong></div>'
    +(comboDurationStr ? '<div class="cw-sum-row"><span>Dauer</span><strong>'+comboDurationStr+'</strong></div>' : '')
    +'<div class="cw-sum-row"><span>Datum &amp; Zeit</span><strong>'+dateStr+', '+cw.time+' Uhr</strong></div>'
    +'<div class="cw-sum-row cw-sum-price"><span>Preis</span><strong>'+priceStr+'</strong></div>';
}

function submitBooking(e) {
  e.preventDefault();
  var name  = document.getElementById('cw-name').value.trim();
  var dialCode = getDialCode('cw-dial');
  var phoneRaw = document.getElementById('cw-phone').value.trim().replace(/^0+/,'').replace(/^\+\d+/,'');
  var phone = dialCode + phoneRaw;
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
  var phoneDigits = phoneRaw.replace(/\D/g,'');
  var phoneOk = phoneDigits.length >= 5;
  setFieldState('cw-phone', phoneOk, 'Bitte gültige Telefonnummer eingeben (mind. 5 Ziffern).');
  if (!phoneOk) valid = false;

  // Email — basic check
  var emailOk = email.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  setFieldState('cw-email', emailOk, 'Bitte gültige E-Mail-Adresse eingeben.');
  if (!emailOk) valid = false;

  // Consent
  var consentEl = document.getElementById('cw-consent').parentElement;
  if (!consent) { consentEl.classList.add('invalid'); valid = false; }
  else { consentEl.classList.remove('invalid'); }

  if (!valid) { console.warn('[Crocus] Validation failed', {name, nameOk, phone, phoneOk, email, emailOk, consent}); return; }

  // ── Check booking state ──────────────────────────────────────
  if (!cw.service || !cw.master || !cw.datetime) {
    console.error('[Crocus] Missing booking state', {service: cw.service, master: cw.master, datetime: cw.datetime});
    var errMsg = document.getElementById('cw-form').querySelector('.cw-err-msg');
    if (errMsg) errMsg.remove();
    var pErr = document.createElement('p');
    pErr.className = 'cw-err-msg';
    pErr.style.cssText = 'color:#fca5a5;font-size:12px;text-align:center;margin:4px 0 0;font-family:DM Sans,sans-serif';
    pErr.textContent = 'Bitte wählen Sie zuerst Datum und Uhrzeit aus.';
    document.getElementById('cw-form').appendChild(pErr);
    return;
  }

  if (cw.service.id === KOMBI_SERVICE_ID && (!cw.comboAppointments || cw.comboAppointments.length !== 2 || !cw.comboRoute)) {
    console.error('[Crocus] Missing Kombi split route', {
      comboAppointments: cw.comboAppointments,
      comboRoute: cw.comboRoute,
      datetime: cw.datetime,
    });
    var comboErr = document.getElementById('cw-form').querySelector('.cw-err-msg');
    if (comboErr) comboErr.remove();
    var comboPErr = document.createElement('p');
    comboPErr.className = 'cw-err-msg';
    comboPErr.style.cssText = 'color:#fca5a5;font-size:12px;text-align:center;margin:4px 0 0;font-family:DM Sans,sans-serif';
    comboPErr.textContent = 'Bitte waehlen Sie die Kombi-Zeit erneut aus.';
    document.getElementById('cw-form').appendChild(comboPErr);
    return;
  }

  var btn = document.getElementById('cw-btn-submit');
  btn.disabled = true; btn.textContent = 'Wird gesendet…';

  // Addon must be in the same appointment — но для Комби (13485762) аддоны только UI, не в API
  var appointments = buildBookingAppointmentsFromState();
  var bookingBody = {
    phone: phone,
    fullname: name,
    email: email,
    notify_by_email: emailRemind ? 1 : 0,
    lang: CONFIG.lang,
    lang_id: 3,
    bookform_id: 1427839,
    appointments: appointments,
  };
  if (cw.service.id === KOMBI_SERVICE_ID) {
    bookingBody.comment = comboStaffComment(cw.comboRoute);
    if (cw.addons && cw.addons.length) {
      bookingBody.comment += ' Extras: ' + cw.addons.map(addonDisplayName).join(', ') + '.';
    }
  }

  console.log('[Crocus] Booking →', { phone, name, email, appointments });

  checkAppointments(appointments, { phone: phone, fullname: name, email: email })
    .then(function(checkRes) {
      if (!checkRes || !checkRes.success) {
        var availabilityError = new Error('Dieser Termin wurde gerade belegt. Bitte waehlen Sie eine andere Zeit.');
        availabilityError.isAvailability = true;
        throw availabilityError;
      }
      if (cw.service.id === KOMBI_SERVICE_ID) {
        bookingBody.company_id = CONFIG.locationId;
        return apiPost('/combo_book', bookingBody);
      }
      return apiPost('/book_record/'+CONFIG.locationId, bookingBody);
    })
    .then(function(res){
      console.log('[Crocus] Booking response:', res);
      if (!res.success) throw new Error((res.meta && res.meta.message) || res.message || 'Buchungsfehler');
      var dateStr = cw.date
        ? new Date(cw.date+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})
        : '';
      var svcStr = cw.service.title + (cw.addons.length ? ' + '+cw.addons.map(addonDisplayName).join(' + ') : '');
      var successMaster = cw.service.id === KOMBI_SERVICE_ID && cw.comboRoute ? comboRouteLabel(cw.comboRoute) : cw.master.name;
      document.getElementById('cw-success-text').innerHTML =
        '<strong>'+svcStr+'</strong> bei <strong>'+successMaster+'</strong><br>'+dateStr+', '+cw.time+' Uhr';
      // Save client data + last booking for next visit
      try {
        localStorage.setItem('crocus_client', JSON.stringify({ name: name, phone: phone, email: email }));
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
        var bookingEventId = makeBookingEventId(res);
        var bookingValue = bookingValueForTracking();
        var bookingPayload = {
          event: 'booking_success',
          event_id: bookingEventId,
          booking_id: bookingEventId,
          altegio_record_id: extractAltegioRecordId(res),
          service_name: cw.service ? cw.service.title : '',
          service_id: cw.service ? cw.service.id : '',
          service_category: cw.category ? cw.category.key : '',
          category: cw.category ? cw.category.label : '',
          master_name: cw.master ? cw.master.name : '',
          master_id: cw.master ? cw.master.id : '',
          addon_name: cw.addons.length ? cw.addons.map(addonDisplayName).join(', ') : '',
          booking_date: cw.date || '',
          booking_time: cw.time || '',
          value: bookingValue,
          currency: 'EUR',
          source: 'widget',
          page_location: window.location.href,
          landing_page: window.location.pathname,
          // Enhanced Conversions
          user_data: {
            email_address: _ecEmail || undefined,
            phone_number: _ecPhone || undefined,
            sha256_email_address: emailHash || undefined,
          },
        };
        Object.keys(CRO_ATTR || {}).forEach(function(key) {
          bookingPayload[key] = CRO_ATTR[key];
        });
        window.dataLayer.push(bookingPayload);
        // Google Ads conversion — Запись на встречу
        if (typeof gtag === 'function') {
          gtag('event', 'conversion', {
            send_to: 'AW-18106748478/gz_1CILgxKgcEL6c_LlD',
            value: bookingValue,
            currency: 'EUR',
            transaction_id: bookingEventId,
          });
        }
        // Meta Pixel — Schedule event (реальное бронирование)
        if (typeof fbq === 'function') {
          fbq('track', 'Schedule', {
            content_name: cw.service ? cw.service.title : '',
            content_category: cw.category ? cw.category.label : '',
            currency: 'EUR',
            value: bookingValue,
          });
          // Дополнительно Lead для оптимизации Leads-кампании
          fbq('track', 'Lead', {
            content_name: cw.service ? cw.service.title : '',
            currency: 'EUR',
            value: bookingValue,
          });
        }
      });
      goStep('success');
      document.getElementById('crocus-progress').style.display = 'none';
    })
    .catch(function(err){
      console.error('[Crocus] Booking error:', err);
      if (err && err.isAvailability) {
        cw.time = null;
        cw.datetime = null;
        cw.comboAppointments = null;
        cw.comboRoute = null;
        goStep(5);
        loadTimes();
      }
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
  cw.date=null; cw.time=null; cw.datetime=null; cw.comboAppointments=null; cw.comboRoute=null;
  renderCalendar(); loadAvailDates();
}
function calNext() {
  if (cw.calM === 11){ cw.calM=0; cw.calY++; } else cw.calM++;
  cw.date=null; cw.time=null; cw.datetime=null; cw.comboAppointments=null; cw.comboRoute=null;
  renderCalendar(); loadAvailDates();
}

// ── Reset ──────────────────────────────────────────────────────
function crocusReset() {
  cw = { step:1, master:null, category:null, service:null, addons:[],
         date:null, time:null, datetime:null, comboAppointments:null, comboRoute:null,
         calY:new Date().getFullYear(), calM:new Date().getMonth(), availDates:[] };
  // Always re-enable submit button in case previous attempt left it disabled
  var submitBtn = document.getElementById('cw-btn-submit');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Termin bestätigen →'; }
  // Clear any leftover error messages in form
  var oldErr = document.getElementById('cw-form') && document.getElementById('cw-form').querySelector('.cw-err-msg');
  if (oldErr) oldErr.remove();
  // Clear form fields and dirty flags
  ['cw-name','cw-phone','cw-email'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('invalid'); delete el.dataset.dirty; }
  });
  var dialEl = document.getElementById('cw-dial');
  if (dialEl) { dialEl.value = '+49'; delete dialEl.dataset.dirty; }
  updateDialBtn('cw-dial-btn', '+49');
  var consentEl = document.getElementById('cw-consent');
  if (consentEl) { consentEl.checked = true; consentEl.parentElement.classList.remove('invalid'); }
  var remindEl = document.getElementById('cw-email-remind');
  if (remindEl) remindEl.checked = true;
  document.getElementById('crocus-progress').style.display = 'flex';
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-step1').classList.add('active');
  updateProgress(1);
  if (_allMasters) renderMasters();
  resetWidgetScroll();
}

// ── Gift flow ──────────────────────────────────────────────────
function openGiftMode() {
  // Hide main progress bar, show gift steps
  document.getElementById('crocus-progress').style.display = 'none';
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-gift1').classList.add('active');
  resetWidgetScroll();
  // Reset gift state
  gift.amount = null;
  gift.isFlexible = false;
  // Deselect all amount buttons
  document.querySelectorAll('.cw-gift-amount-btn').forEach(function(b){ b.classList.remove('sel'); });
  // Reset gift form fields and dirty flags
  ['cw-gift-name','cw-gift-email','cw-gift-phone','cw-gift-recipient','cw-gift-wish'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('invalid'); delete el.dataset.dirty; }
  });
  var gDialEl = document.getElementById('cw-gift-dial');
  if (gDialEl) { gDialEl.value = '+49'; delete gDialEl.dataset.dirty; }
  updateDialBtn('cw-gift-dial-btn', '+49');
  // Re-enable submit button in case previous attempt disabled it
  var gBtn = document.getElementById('cw-gift-submit');
  if (gBtn) { gBtn.disabled = false; gBtn.textContent = 'Gutschein anfragen →'; }
}

function ensureWimpernHoldStep() {
  var step = document.getElementById('cw-wimpern-hold');
  if (!step) {
    step = document.createElement('div');
    step.id = 'cw-wimpern-hold';
    step.className = 'cw-step';
    var body = document.getElementById('crocus-body');
    if (body) body.appendChild(step);
  }
  step.innerHTML =
    '<div class="cw-success" style="padding:34px 16px 28px">'
      + '<div class="cw-success-icon">✦</div>'
      + '<h2>Wimpern-Bereich im Aufbau</h2>'
      + '<p>Wir stellen den Bereich gerade neu auf und suchen eine neue Spezialistin. Sobald Termine wieder verfügbar sind, öffnen wir die Buchung hier.</p>'
      + '<a class="cw-btn-confirm" href="https://wa.me/491728118528?text=Hallo%20Crocus%2C%20ich%20moechte%20informiert%20werden%2C%20sobald%20Wimperntermine%20wieder%20verfuegbar%20sind." target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Per WhatsApp vormerken</a>'
      + '<button class="cw-btn-new" id="cw-wimpern-back" type="button">Andere Behandlung buchen</button>'
    + '</div>';
  return step;
}

function openWimpernHoldMode() {
  cw = { step:'wimpern-hold', master:null, category:null, service:null, addons:[],
         date:null, time:null, datetime:null, comboAppointments:null, comboRoute:null,
         calY:new Date().getFullYear(), calM:new Date().getMonth(), availDates:[] };
  document.getElementById('crocus-progress').style.display = 'none';
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  var step = ensureWimpernHoldStep();
  step.classList.add('active');
  var back = document.getElementById('cw-wimpern-back');
  if (back) back.addEventListener('click', function(){ crocusReset(); });
  resetWidgetScroll();
}

function goGiftStep2() {
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-gift2').classList.add('active');
  var wishWrap = document.getElementById('cw-gift-wish-wrap');
  if (gift.isFlexible) {
    document.getElementById('cw-gift-selected-label').textContent = 'Flexible';
    document.getElementById('cw-gift-step2-sub').innerHTML = 'Gutschein: <strong id="cw-gift-selected-label">Flexible</strong> — wird per E-Mail bestätigt';
    if (wishWrap) wishWrap.style.display = '';
  } else {
    document.getElementById('cw-gift-selected-label').textContent = gift.amount + ' €';
    document.getElementById('cw-gift-step2-sub').innerHTML = 'Gutschein: <strong id="cw-gift-selected-label">' + gift.amount + ' €</strong> — wird per E-Mail bestätigt';
    if (wishWrap) wishWrap.style.display = 'none';
  }
  resetWidgetScroll();
}

function goGiftSuccess() {
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-gift-success').classList.add('active');
  var name = (document.getElementById('cw-gift-name').value || '').trim();
  document.getElementById('cw-gift-success-text').innerHTML = gift.isFlexible
    ? 'Vielen Dank' + (name ? ', <strong>' + name + '</strong>' : '') + '! ' +
      'Wir melden uns in Kürze und klären gemeinsam alle Details zu Ihrem <strong>Flexible Gutschein</strong>.'
    : 'Vielen Dank' + (name ? ', <strong>' + name + '</strong>' : '') + '! ' +
      'Wir melden uns in Kürze per E-Mail mit den Zahlungsdetails für Ihren <strong>' + gift.amount + '&nbsp;€ Gutschein</strong>.';
  resetWidgetScroll();
}

function submitGiftForm(e) {
  e.preventDefault();
  var name      = (document.getElementById('cw-gift-name').value || '').trim();
  var email     = (document.getElementById('cw-gift-email').value || '').trim();
  var dialCodeG = getDialCode('cw-gift-dial');
  var phoneRawG = (document.getElementById('cw-gift-phone').value || '').trim().replace(/^0+/,'').replace(/^\+\d+/,'');
  var phone     = phoneRawG ? dialCodeG + phoneRawG : '';
  var recipient = (document.getElementById('cw-gift-recipient').value || '').trim();
  var wish      = (document.getElementById('cw-gift-wish') ? document.getElementById('cw-gift-wish').value || '' : '').trim();

  if (!name || !email) {
    if (!name) document.getElementById('cw-gift-name').classList.add('invalid');
    if (!email) document.getElementById('cw-gift-email').classList.add('invalid');
    return;
  }

  var btn = document.getElementById('cw-gift-submit');
  btn.disabled = true;
  btn.textContent = 'Wird gesendet…';

  // Generate voucher code XXXX-XXXX-XXXX-XXXX (only sent to owner, not shown to client)
  function genCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var groups = [];
    for (var g = 0; g < 4; g++) {
      var part = '';
      for (var c = 0; c < 4; c++) {
        part += chars[Math.floor(Math.random() * chars.length)];
      }
      groups.push(part);
    }
    return groups.join('-');
  }
  var voucherCode = genCode();

  // Send via web3forms.com — no backend needed, delivers to email
  var payload = gift.isFlexible ? {
    subject: '✨ Flexible Gutschein-Anfrage — ' + name,
    replyto: email,
    from_name: 'Crocus Beauty Widget',
    Typ: 'Flexible Gutschein',
    Gutschein_Code: voucherCode,
    Name: name,
    EMail: email,
    Telefon: phone || '—',
    Fuer_wen: recipient || '—',
    Wunsch_Behandlung_Betrag: wish || '—',
    Hinweis: 'Flexible: Details mit Kunden klären, Code nach Bezahlung weitergeben',
  } : {
    subject: '🎁 Gutschein-Anfrage ' + gift.amount + ' € — ' + name,
    replyto: email,
    from_name: 'Crocus Beauty Widget',
    Betrag: gift.amount + ' €',
    Gutschein_Code: voucherCode,
    Name: name,
    EMail: email,
    Telefon: phone || '—',
    Fuer_wen: recipient || '—',
    Hinweis: 'Code nach Zahlungseingang an Kunden weitergeben',
  };

  fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(Object.assign({ access_key: 'ba6ac1b2-935d-4628-8d4b-44ebbcf6ca67' }, payload)),
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    btn.disabled = false;
    btn.textContent = 'Gutschein anfragen →';
    if (data.success) {
      // Tracking — gutschein_lead
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'gutschein_lead',
        gutschein_amount: gift.isFlexible ? 'flexible' : (gift.amount || ''),
        gutschein_type: gift.isFlexible ? 'flexible' : 'fixed',
        page_location: window.location.href,
        source: 'widget',
      });
      goGiftSuccess();
    } else {
      alert('Fehler beim Senden. Bitte ruf uns an: +49 172 811 8528');
    }
  })
  .catch(function(){
    btn.disabled = false;
    btn.textContent = 'Gutschein anfragen →';
    alert('Fehler beim Senden. Bitte ruf uns an: +49 172 811 8528');
  });
}


// ── Events ─────────────────────────────────────────────────────
document.getElementById('crocus-fab').addEventListener('click', crocusOpen);
document.getElementById('cw-btn-express').addEventListener('click', openExpressNails);
window.crocusOpen = crocusOpen;
window.crocusClose = crocusClose;
window.openGiftMode = openGiftMode;
window.crocusOpenGutschein = function(ctaLocation) {
  // Tracking — click_gutschein
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'click_gutschein',
    page_location: window.location.href,
    cta_location: ctaLocation || 'widget_fab',
  });
  crocusOpen();
  setTimeout(function(){ openGiftMode(); }, 80);
};

window.crocusOpenMasters = function() {
  crocusOpen();
  setTimeout(function() {
    // Сбрасываем до шага мастеров, игнорируем return screen
    document.getElementById('crocus-progress').style.display = 'flex';
    document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
    document.getElementById('cw-step1').classList.add('active');
    updateProgress(1);
    if (_allMasters) renderMasters();
    resetWidgetScroll();
  }, 80);
};

window.crocusOpenWimpern = function() {
  // Tracking — click_wimpern
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'click_wimpern',
    page_location: window.location.href,
    cta_location: 'goodshine_badge',
  });
  crocusOpen();
  setTimeout(openWimpernHoldMode, 80);
};

// Мобильная кнопка — отдельная верстка
(function(){
  var mwrap = document.createElement('div');
  mwrap.id = 'crocus-fab-mobile';
  mwrap.innerHTML =
    '<span class="cfm-ring"></span>'
    + '<span class="cfm-ring"></span>'
    + '<span class="cfm-ring"></span>'
    + '<button id="crocus-fab-mobile-btn"><img src="https://static.tildacdn.com/tild3830-6165-4233-b735-633433643031/crocus-logo-white.png" alt="Crocus"></button>'
    + '<span style="font-family:DM Sans,sans-serif;font-size:7.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#fff;text-align:center;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,1),0 0 8px rgba(0,0,0,.9)">Online · Termin</span>';
  document.body.appendChild(mwrap);
  document.getElementById('crocus-fab-mobile-btn').addEventListener('click', crocusOpen);
})();
document.getElementById('crocus-backdrop').addEventListener('click', crocusClose);

// ── Intercept anchor links that open the widget ────────────────
// Prevents href="#section" from jumping before/after scroll lock
(function(){
  document.addEventListener('click', function(e){
    var a = e.target.closest('a[href]');
    if (!a) return;
    var onclick = a.getAttribute('onclick') || '';
    if (onclick.indexOf('crocusOpen') === -1) return;
    var href = a.getAttribute('href') || '';
    // Only intercept non-empty anchors (not "#" — already harmless)
    if (href && href !== '#' && href.charAt(0) === '#') {
      e.preventDefault();
    }
  }, true); // capture phase — fires before href navigation
})();

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
        : a.closest('#crocus-modal') ? 'booking_widget'
        : a.closest('[class*="gutschein"], [class*="gift"]') ? 'gutschein'
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
    // Gutschein external links
    if (a.classList.contains('nra1__btn') || a.closest('[class*="gutschein"]')) {
      // handled separately
    }
  }
  document.addEventListener('click', trackExternalClick, true);
})();
document.getElementById('crocus-close').addEventListener('click', crocusClose);
document.getElementById('cw-back1').addEventListener('click', function(){ goStep(1); });
document.getElementById('cw-back2').addEventListener('click', function(){ goStep(2); });
document.getElementById('cw-back3').addEventListener('click', function(){ goStep(3); });
document.getElementById('cw-back4').addEventListener('click', function(){
  // Назад из календаря — если пропускали допы, вернуть к услугам
  var skipBack = (cw.category && cw.category.key === 'wimpern')
    || (cw.service && NO_ADDON_SERVICE_IDS.indexOf(cw.service.id) !== -1);
  goStep(skipBack ? 3 : 4);
});
document.getElementById('cw-back5').addEventListener('click', function(){ goStep(5); });
document.getElementById('cw-skip-addon').addEventListener('click', function(){ cw.addons=[]; proceedFromAddon(); });
document.getElementById('cw-cal-prev').addEventListener('click', calPrev);
document.getElementById('cw-cal-next').addEventListener('click', calNext);
document.getElementById('cw-btn-new').addEventListener('click', crocusReset);
document.getElementById('cw-form').addEventListener('submit', submitBooking);

// Gift flow events
document.getElementById('cw-btn-gift').addEventListener('click', openGiftMode);

document.getElementById('cw-gift-back1').addEventListener('click', function(){
  document.getElementById('crocus-progress').style.display = 'flex';
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-step1').classList.add('active');
  updateProgress(1);
  resetWidgetScroll();
});

document.getElementById('cw-gift-back2').addEventListener('click', function(){
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-gift1').classList.add('active');
  resetWidgetScroll();
});

document.getElementById('cgp1b').addEventListener('click', function(){
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('cw-gift1').classList.add('active');
  resetWidgetScroll();
});

// Amount button clicks — direct listeners on each button
document.querySelectorAll('.cw-gift-amount-btn').forEach(function(amtBtn){
  amtBtn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.cw-gift-amount-btn').forEach(function(b){ b.classList.remove('sel'); });
    amtBtn.classList.add('sel');
    if (amtBtn.getAttribute('data-gift-flexible') === 'true') {
      gift.amount = null;
      gift.isFlexible = true;
    } else {
      gift.amount = parseInt(amtBtn.getAttribute('data-gift-amount'), 10);
      gift.isFlexible = false;
    }
    setTimeout(goGiftStep2, 220);
  });
});

document.getElementById('cw-gift-form').addEventListener('submit', submitGiftForm);

document.getElementById('cw-gift-btn-new').addEventListener('click', function(){
  crocusReset();
  document.getElementById('crocus-progress').style.display = 'flex';
});

// Clear invalid state on input + mark dirty (so prefill won't overwrite manual edits)
['cw-gift-name','cw-gift-email'].forEach(function(id){
  document.getElementById(id).addEventListener('input', function(){
    this.classList.remove('invalid');
  });
});
['cw-name','cw-phone','cw-email'].forEach(function(id){
  document.getElementById(id).addEventListener('input', function(){
    this.classList.remove('invalid');
    this.dataset.dirty = '1';
  });
});
// Dial selects — dirty on change (prevents prefill from overwriting manual choice)
['cw-dial','cw-gift-dial'].forEach(function(id){
  var el = document.getElementById(id);
  if (el) el.addEventListener('change', function(){ this.dataset.dirty = '1'; });
});

// ── Custom dial dropdown (desktop) ───────────────────────────────────────────
function updateDialBtn(btnId, code) {
  var btn = document.getElementById(btnId);
  if (!btn) return;
  var c = PHONE_COUNTRIES.filter(function(x){ return x.code === code; })[0];
  if (!c) return;
  var codeEl = btn.querySelector('.cw-dial-btn__code');
  if (codeEl) codeEl.textContent = c.code;
}

function initDialDropdown(btnId, dropId, listId, searchId, selectId) {
  var btn    = document.getElementById(btnId);
  var drop   = document.getElementById(dropId);
  var list   = document.getElementById(listId);
  var search = document.getElementById(searchId);
  var sel    = document.getElementById(selectId);
  if (!btn || !drop || !list || !search || !sel) return;

  // Render all items
  function renderList(filter) {
    var q = (filter || '').toLowerCase().trim();
    var html = '';
    PHONE_COUNTRIES.forEach(function(c, idx) {
      if (q && c.name.toLowerCase().indexOf(q) === -1 &&
               c.code.toLowerCase().indexOf(q) === -1 &&
               c.short.toLowerCase().indexOf(q) === -1) return;
      var isSel = sel.value === c.code ? ' sel' : '';
      html += '<div class="cw-dial-item' + isSel + '" data-code="' + c.code + '" data-idx="' + idx + '">' +
                '<span class="cw-dial-item__code">' + c.code + '</span>' +
                '<span class="cw-dial-item__name">' + c.name + '</span>' +
              '</div>';
    });
    list.innerHTML = html || '<div style="padding:10px 14px;opacity:.4;font-size:12px">Keine Ergebnisse</div>';

    // Bind item clicks
    list.querySelectorAll('.cw-dial-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var code = this.getAttribute('data-code');
        sel.value = code;
        sel.dataset.dirty = '1';
        updateDialBtn(btnId, code);
        drop.classList.remove('open');
        btn.classList.remove('open');
        search.value = '';
        renderList('');
        // Scroll selected into view next open
      });
    });
  }

  renderList('');

  // Toggle open/close
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = drop.classList.contains('open');
    // Close all other dropdowns first
    document.querySelectorAll('.cw-dial-drop.open').forEach(function(d) {
      d.classList.remove('open');
    });
    document.querySelectorAll('.cw-dial-btn.open').forEach(function(b) {
      b.classList.remove('open');
    });
    if (!isOpen) {
      drop.classList.add('open');
      btn.classList.add('open');
      search.value = '';
      renderList('');
      // Scroll to selected
      setTimeout(function() {
        var selItem = list.querySelector('.cw-dial-item.sel');
        if (selItem) selItem.scrollIntoView({ block: 'nearest' });
        search.focus();
      }, 30);
    }
  });

  // Search input
  search.addEventListener('input', function() {
    renderList(this.value);
  });

  // Prevent closing when clicking inside dropdown
  drop.addEventListener('click', function(e) {
    e.stopPropagation();
  });
}

// Close all dropdowns on outside click
document.addEventListener('click', function() {
  document.querySelectorAll('.cw-dial-drop.open').forEach(function(d) {
    d.classList.remove('open');
  });
  document.querySelectorAll('.cw-dial-btn.open').forEach(function(b) {
    b.classList.remove('open');
  });
});

// Init both dropdowns
initDialDropdown('cw-dial-btn',      'cw-dial-drop',      'cw-dial-list',      'cw-dial-search',      'cw-dial');
initDialDropdown('cw-gift-dial-btn', 'cw-gift-dial-drop', 'cw-gift-dial-list', 'cw-gift-dial-search', 'cw-gift-dial');
document.addEventListener('keydown', function(e){ if(e.key==='Escape') crocusClose(); });

function crocusWidgetBack() {
  var isGiftMode = document.getElementById('cw-gift1') && document.getElementById('cw-gift1').classList.contains('active');
  var isGiftStep2 = document.getElementById('cw-gift2') && document.getElementById('cw-gift2').classList.contains('active');
  var isGiftSuccess = document.getElementById('cw-gift-success') && document.getElementById('cw-gift-success').classList.contains('active');

  if (isGiftStep2) {
    document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
    document.getElementById('cw-gift1').classList.add('active');
    resetWidgetScroll();
    return true;
  }
  if (isGiftMode || isGiftSuccess) {
    document.getElementById('crocus-progress').style.display = 'flex';
    document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
    document.getElementById('cw-step1').classList.add('active');
    updateProgress(1);
    resetWidgetScroll();
    return true;
  }

  var step = cw.step;
  if (step === 'success' || step === 1) {
    crocusClose();
    return false;
  }
  if (step === 2) { goStep(1); return true; }
  if (step === 3) { goStep(2); return true; }
  if (step === 4) { goStep(3); return true; }
  if (step === 5) {
    if (cw.express) { goStep(2); return true; }
    var skipBack = (cw.category && cw.category.key === 'wimpern')
      || (cw.service && NO_ADDON_SERVICE_IDS.indexOf(cw.service.id) !== -1);
    goStep(skipBack ? 3 : 4);
    return true;
  }
  if (step === 6) { goStep(5); return true; }
  return true;
}

function isCrocusWidgetFirstScreen() {
  var first = document.getElementById('cw-step1');
  return cw.step === 1 || !!(first && first.classList.contains('active'));
}

function showCrocusStepFromHistory(step) {
  var target = step === 'success' ? 'success' : parseInt(step, 10);
  if (target !== 'success' && (!target || target < 1 || target > 6)) target = 1;
  cw.step = target;
  document.querySelectorAll('.cw-step').forEach(function(el){ el.classList.remove('active'); });
  var id = target === 'success' ? 'cw-success' : 'cw-step' + target;
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
  resetWidgetScroll();
  updateProgress(target);
  if (target === 5) renderCalendar();
}

document.addEventListener('keydown', function(e) {
  var modal = document.getElementById('crocus-modal');
  if (!modal || !modal.classList.contains('open')) return;
  var tag = e.target && e.target.tagName;
  var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
  if (e.key === 'Backspace' && !typing) {
    e.preventDefault();
    crocusWidgetBack();
  }
});

// ── Android back button / browser back ─────────────────────────
window.addEventListener('popstate', function(e) {
  if (!isCrocusModalActive()) {
    _crocusHistoryActive = false;
    return;
  }

  // Modal is open — intercept back navigation
  e.preventDefault();
  _crocusHistoryActive = false;
  var state = e.state || {};
  if (state.crocusWidget && state.crocusOpen === false) {
    crocusClose();
    return;
  }
  if (state.crocusWidget && state.crocusOpen) {
    _crocusApplyingHistory = true;
    showCrocusStepFromHistory(state.crocusStep || 1);
    _crocusApplyingHistory = false;
    _crocusHistoryActive = true;
    return;
  }
  crocusClose();
});

// Кнопка "далее" после выбора допа (клик на карточку) — авто-переход с задержкой
// убран авто-переход, пользователь нажимает "Без допа" или выбирает и нажимает кнопку
// Добавим кнопку "Weiter" после выбора допа
(function(){
  var skipBtn = document.getElementById('cw-skip-addon');
  // Клонируем как "Weiter mit Zusatz"
  var nextBtn = document.createElement('button');
  nextBtn.id = 'cw-next-addon';
  nextBtn.className = 'cw-btn-confirm';
  nextBtn.style.marginTop = '8px';
  nextBtn.textContent = 'Weiter →';
  nextBtn.style.display = 'none';
  skipBtn.parentNode.insertBefore(nextBtn, skipBtn);

  // Показываем кнопку Weiter когда доп выбран
  document.getElementById('cw-addons-list').addEventListener('click', function(){
    setTimeout(function(){
      nextBtn.style.display = cw.addons.length ? 'block' : 'none';
    }, 50);
  });
  nextBtn.addEventListener('click', function(){ proceedFromAddon(); });
})();
} // end _crocusMount

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _crocusMount);
} else {
  _crocusMount();
}

// ── Page Theme Inject ──────────────────────────────────────────
(function(){
  var path = window.location.pathname.toLowerCase();

  // Главная страница — чуть светлее фон виджета
  var isHome = (path === '/' || path === '');
  if (isHome) {
    var homeOverride = '#crocus-modal{background:#2d1520!important;}' +
      '#crocus-body{background:#2d1520!important;}' +
      '#crocus-modal-header{background:rgba(255,255,255,0.04)!important;}';
    function injectHomeTheme(){
      if (document.getElementById('crocus-home-theme')) return;
      var s = document.createElement('style');
      s.id = 'crocus-home-theme';
      s.textContent = homeOverride;
      document.head.appendChild(s);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectHomeTheme);
    } else {
      injectHomeTheme();
    }
  }

  var isMani = path.indexOf('manik') !== -1;
  if (!isMani) return;

  var override =
    /* FAB — розовый */
    '#crocus-fab{background:linear-gradient(145deg,#3a0a1e 0%,#5c1030 100%)!important;border-color:rgba(212,84,122,.30)!important;}' +
    '#crocus-fab:hover{border-color:rgba(212,84,122,.70)!important;box-shadow:0 8px 36px rgba(192,52,104,.55)!important;}' +
    '#crocus-fab::before{background:radial-gradient(ellipse at 50% 110%,rgba(192,52,104,.18) 0%,transparent 65%)!important;}' +
    '.crocus-fab-ring:nth-child(1){border-color:rgba(192,52,104,.85)!important;}' +
    '.crocus-fab-ring:nth-child(2){border-color:rgba(192,52,104,.55)!important;}' +
    '.crocus-fab-ring:nth-child(3){border-color:rgba(212,84,122,.35)!important;}' +
    '#crocus-fab-mobile-btn{background:linear-gradient(145deg,#3a0a1e 0%,#5c1030 100%)!important;border-color:rgba(212,84,122,.30)!important;}' +
    '.cfm-ring:nth-child(1){border-color:rgba(192,52,104,.85)!important;}' +
    '.cfm-ring:nth-child(2){border-color:rgba(192,52,104,.55)!important;}' +
    '.cfm-ring:nth-child(3){border-color:rgba(212,84,122,.35)!important;}' +

    /* Modal — светлый */
    '#crocus-modal{background:#fce8ef!important;}' +
    '#crocus-modal-header{background:#f9dce7!important;border-bottom:none!important;}' +
    '.crocus-modal-title{color:#1a0810!important;}' +
    '.crocus-modal-sub{color:rgba(26,8,16,.45)!important;}' +
    '#crocus-close{border-color:rgba(192,52,104,.20)!important;background:rgba(192,52,104,.07)!important;color:rgba(26,8,16,.45)!important;}' +
    '#crocus-close:hover{background:rgba(192,52,104,.15)!important;color:#1a0810!important;}' +
    '@keyframes logoPulseManik{' +
      '0%,100%{' +
        'box-shadow:0 0 0 0 rgba(192,52,104,0), 0 2px 12px rgba(122,21,48,.35), inset 0 1px 0 rgba(255,255,255,.10);' +
        'filter:drop-shadow(0 0 3px rgba(255,255,255,.50))' +
      '}' +
      '50%{' +
        'box-shadow:0 0 0 6px rgba(192,52,104,.13), 0 4px 20px rgba(122,21,48,.55), inset 0 1px 0 rgba(255,255,255,.15);' +
        'filter:drop-shadow(0 0 7px rgba(255,255,255,.90)) drop-shadow(0 0 14px rgba(255,220,230,.60))' +
      '}' +
    '}' +
    '.crocus-modal-logo{' +
      'background:linear-gradient(145deg,#3d0e20 0%,#6b1535 100%)!important;' +
      'border:1px solid rgba(212,84,122,.45)!important;' +
      'box-shadow:0 0 0 0 rgba(192,52,104,0), 0 2px 12px rgba(122,21,48,.35), inset 0 1px 0 rgba(255,255,255,.10)!important;' +
      'animation-name:logoPulseManik!important;' +
      'filter:drop-shadow(0 0 3px rgba(255,255,255,.50))!important;' +
    '}' +

    /* Progress */
    '#crocus-progress{background:#f9dce7!important;border-bottom:none!important;}' +
    '.cp-dot{background:rgba(26,8,16,.06)!important;border-color:rgba(26,8,16,.15)!important;color:rgba(26,8,16,.30)!important;}' +
    '.cp-step.active .cp-dot{background:#c03468!important;border-color:#c03468!important;color:#fff!important;box-shadow:0 0 12px rgba(192,52,104,.40)!important;}' +
    '.cp-step.done .cp-dot{background:rgba(192,52,104,.12)!important;border-color:#c03468!important;color:#c03468!important;}' +
    '.cp-label{color:rgba(26,8,16,.30)!important;}' +
    '.cp-step.active .cp-label,.cp-step.done .cp-label{color:rgba(26,8,16,.60)!important;}' +
    '.cp-line{background:rgba(26,8,16,.08)!important;}' +
    '.cp-line.filled{background:rgba(192,52,104,.30)!important;}' +

    /* Body */
    '#crocus-body{background:#fce8ef!important;scrollbar-color:rgba(192,52,104,.30) transparent!important;}' +
    '#crocus-body::-webkit-scrollbar-thumb{background:rgba(192,52,104,.30)!important;}' +

    /* Titles & text */
    '.cw-title{color:#1a0810!important;}' +
    '.cw-sub{color:rgba(26,8,16,.45)!important;}' +
    '.cw-sub strong{color:#c03468!important;}' +
    '.cw-back{color:rgba(26,8,16,.40)!important;}' +
    '.cw-back:hover{color:#c03468!important;}' +
    '.cw-times-title{color:rgba(26,8,16,.40)!important;}' +

    /* Master cards */
    '.cw-master-card{background:#fff!important;border-color:rgba(26,8,16,.08)!important;box-shadow:0 2px 12px rgba(192,52,104,.08)!important;}' +
    '.cw-master-card:hover{border-color:rgba(192,52,104,.35)!important;background:#fff!important;box-shadow:0 8px 28px rgba(192,52,104,.20)!important;}' +
    '.cw-master-name{color:#1a0810!important;}' +
    '.cw-master-tagline{color:rgba(26,8,16,.55)!important;}' +
    '.cw-master-bio{color:rgba(26,8,16,.60)!important;}' +
    '.cw-skill-tag{color:rgba(26,8,16,.55)!important;background:rgba(192,52,104,.07)!important;border-color:rgba(192,52,104,.15)!important;}' +

    /* Category cards */
    '.cw-cat-card{background:#fff!important;border-color:rgba(26,8,16,.08)!important;}' +
    '.cw-cat-card:hover{border-color:rgba(192,52,104,.40)!important;background:#fff!important;box-shadow:0 6px 22px rgba(192,52,104,.14)!important;}' +
    '.cw-cat-label{color:#1a0810!important;}' +
    '.cw-cat-desc{color:rgba(26,8,16,.45)!important;}' +
    '.cw-cat-arrow{color:rgba(26,8,16,.25)!important;}' +

    /* Service buttons */
    '.cw-svc-btn{background:#fff!important;border-color:rgba(26,8,16,.08)!important;}' +
    '.cw-svc-btn:hover{border-color:rgba(192,52,104,.40)!important;background:#fff!important;}' +
    '.cw-svc-name{color:#1a0810!important;}' +
    '.cw-svc-dur{color:rgba(26,8,16,.38)!important;}' +
    '.cw-svc-price{color:#c03468!important;}' +

    /* Addons */
    '.cw-addon-btn{background:#fff!important;border-color:rgba(26,8,16,.08)!important;}' +
    '.cw-addon-btn:hover{border-color:rgba(192,52,104,.35)!important;background:#fff!important;}' +
    '.cw-addon-btn.sel{border-color:#c03468!important;background:rgba(192,52,104,.06)!important;}' +
    '.cw-addon-check{background:rgba(26,8,16,.05)!important;border-color:rgba(26,8,16,.18)!important;}' +
    '.cw-addon-btn.sel .cw-addon-check{background:#c03468!important;border-color:#c03468!important;color:#fff!important;}' +
    '.cw-addon-name{color:#1a0810!important;}' +
    '.cw-addon-price{color:rgba(192,52,104,.80)!important;}' +
    '.cw-skip-btn{border-color:rgba(26,8,16,.35)!important;color:rgba(26,8,16,.70)!important;}' +
    '.cw-skip-btn:hover{border-color:rgba(26,8,16,.55)!important;color:#1a0810!important;}' +

    /* Calendar */
    '.cw-calendar{background:#fff!important;border-color:rgba(26,8,16,.08)!important;}' +
    '.cw-cal-nav{border-bottom-color:rgba(26,8,16,.07)!important;}' +
    '.cw-cal-nav span{color:#1a0810!important;}' +
    '.cw-cal-nav button{color:rgba(26,8,16,.40)!important;}' +
    '.cw-cal-nav button:hover{background:rgba(192,52,104,.08)!important;color:#1a0810!important;}' +
    '.cw-dow{color:rgba(26,8,16,.30)!important;}' +
    '.cw-day{color:rgba(26,8,16,.55)!important;}' +
    '.cw-day.past,.cw-day.unavail{color:rgba(26,8,16,.18)!important;}' +
    '.cw-day.avail:hover{background:rgba(192,52,104,.12)!important;color:#1a0810!important;}' +
    '.cw-day.sel{background:#c03468!important;color:#fff!important;box-shadow:0 0 13px rgba(192,52,104,.35)!important;}' +
    '.cw-day.avail::after{background:#c03468!important;}' +
    '.cw-day.sel::after{background:#fff!important;}' +
    '.cw-time{background:rgba(26,8,16,.04)!important;border-color:rgba(26,8,16,.08)!important;color:rgba(26,8,16,.60)!important;}' +
    '.cw-time.free:hover{border-color:rgba(192,52,104,.45)!important;background:rgba(192,52,104,.10)!important;color:#1a0810!important;}' +
    '.cw-time.sel{background:#c03468!important;border-color:#c03468!important;color:#fff!important;box-shadow:0 0 11px rgba(192,52,104,.35)!important;}' +

    /* Loader / Error */
    '.cw-loader-text{color:rgba(26,8,16,.40)!important;}' +
    '.cw-spinner{border-color:rgba(192,52,104,.18)!important;border-top-color:#c03468!important;}' +

    /* Summary & form */
    '.cw-summary{background:#fff!important;border-color:rgba(192,52,104,.18)!important;}' +
    '.cw-master-slot{color:rgba(26,8,16,.55)!important;}' +
    '.cw-master-slot span{color:rgba(26,8,16,.55)!important;}' +
    '.cw-master-slot-dot.grey{background:rgba(26,8,16,.20)!important;}' +
    '.cw-sum-row span{color:rgba(26,8,16,.38)!important;}' +
    '.cw-sum-row strong{color:#1a0810!important;}' +
    '.cw-sum-price strong{color:#c03468!important;}' +
    '.cw-field label{color:rgba(26,8,16,.45)!important;}' +
    '.cw-field input{background:rgba(26,8,16,.04)!important;border-color:rgba(26,8,16,.10)!important;color:#1a0810!important;}' +
    '.cw-field input::placeholder{color:rgba(26,8,16,.25)!important;}' +
    '.cw-field input:focus{border-color:rgba(192,52,104,.50)!important;background:#fff!important;}' +
    '.cw-phone-dial{color:#1a0810!important;background:rgba(26,8,16,.06)!important;border-color:rgba(26,8,16,.09)!important;}' +
    '.cw-phone-wrap{background:rgba(26,8,16,.04)!important;border-color:rgba(26,8,16,.10)!important;}' +
    '.cw-phone-wrap:focus-within{border-color:rgba(192,52,104,.50)!important;}' +
    '.cw-phone-wrap input{color:#1a0810!important;}' +
    '.cw-dial-btn{color:#1a0810!important;background:rgba(26,8,16,.06)!important;border-color:rgba(26,8,16,.09)!important;}' +
    '.cw-dial-btn:hover,.cw-dial-btn.open{background:rgba(26,8,16,.11)!important;}' +
    '.cw-dial-drop{background:#fff5f8!important;border-color:rgba(26,8,16,.12)!important;}' +
    '.cw-dial-search{border-color:rgba(26,8,16,.08)!important;}' +
    '.cw-dial-search input{color:#1a0810!important;}' +
    '.cw-dial-search input::placeholder{color:rgba(26,8,16,.30)!important;}' +
    '.cw-dial-item{color:#1a0810!important;}' +
    '.cw-dial-item:hover{background:rgba(192,52,104,.07)!important;}' +
    '.cw-dial-item.sel{background:rgba(192,52,104,.12)!important;}' +
    '.cw-dial-item__code{color:#1a0810!important;}' +
    '.cw-dial-item__name{color:rgba(26,8,16,.45)!important;}' +
    '.cw-btn-confirm{background:linear-gradient(135deg,#c03468 0%,#96204e 100%)!important;box-shadow:0 6px 22px rgba(192,52,104,.35)!important;}' +
    '.cw-btn-confirm:hover:not(:disabled){box-shadow:0 10px 30px rgba(192,52,104,.52)!important;}' +
    '.cw-form-note{color:rgba(26,8,16,.30)!important;}' +

    /* Consent checkbox */
    '.cw-consent span{color:rgba(26,8,16,.72)!important;}' +
    '.cw-consent span a{color:#c03468!important;}' +
    '.cw-consent span a:hover{color:#96204e!important;}' +
    '.cw-consent.invalid span{color:#c03468!important;}' +

    /* Validation & booking errors — visible on pink bg */
    '.cw-field-err{color:#96204e!important;}' +
    '.cw-field input.invalid{border-color:rgba(150,32,78,.60)!important;background:rgba(150,32,78,.06)!important;}' +
    '.cw-err-msg--visible{color:#7a1530!important;background:rgba(192,52,104,.08)!important;border-color:rgba(192,52,104,.25)!important;}' +

    /* Gift CTA on light bg */
    '.cw-gift-cta{background:rgba(192,52,104,.08)!important;border-color:rgba(192,52,104,.25)!important;}' +
    '.cw-gift-cta:hover{background:rgba(192,52,104,.13)!important;border-color:rgba(192,52,104,.45)!important;}' +
    '.cw-gift-cta-title{color:#1a0810!important;}' +
    '.cw-gift-cta-sub{color:rgba(26,8,16,.62)!important;}' +
    '.cw-gift-cta-arrow{color:rgba(192,52,104,.65)!important;}' +
    '.cw-gift-divider span{color:rgba(26,8,16,.30)!important;}' +
    '.cw-gift-divider::before,.cw-gift-divider::after{background:rgba(26,8,16,.10)!important;}' +

    /* Gift steps — full light theme */
    '.cw-gp-dot{background:rgba(26,8,16,.06)!important;border-color:rgba(26,8,16,.18)!important;color:rgba(26,8,16,.35)!important;}' +
    '.cw-gp-step.active .cw-gp-dot{background:#c03468!important;border-color:#c03468!important;color:#fff!important;box-shadow:0 0 12px rgba(192,52,104,.35)!important;}' +
    '.cw-gp-step.done .cw-gp-dot{background:rgba(192,52,104,.12)!important;border-color:#c03468!important;color:#c03468!important;}' +
    '.cw-gp-label{color:rgba(26,8,16,.28)!important;}' +
    '.cw-gp-step.active .cw-gp-label,.cw-gp-step.done .cw-gp-label{color:rgba(26,8,16,.55)!important;}' +
    '.cw-gp-line{background:rgba(26,8,16,.08)!important;}' +
    '.cgpline-filled,.cw-gp-line.filled{background:rgba(192,52,104,.30)!important;}' +
    '.cw-gift-amount-btn{background:#fff!important;border-color:rgba(26,8,16,.09)!important;}' +
    '.cw-gift-amount-btn:hover{border-color:rgba(192,52,104,.40)!important;background:#fff!important;}' +
    '.cw-gift-amount-btn.sel{border-color:#c03468!important;background:rgba(192,52,104,.05)!important;}' +
    '.cw-gift-amount-value{color:#c03468!important;}' +
    '.cw-gift-amount-desc{color:rgba(26,8,16,.45)!important;}' +
    '.cw-gift-info-box{background:rgba(192,52,104,.05)!important;border-color:rgba(192,52,104,.18)!important;}' +
    '.cw-gift-info-box p{color:rgba(26,8,16,.55)!important;}' +
    '#cw-gift-step2-sub{color:rgba(26,8,16,.45)!important;}' +
    '#cw-gift-step2-sub strong{color:#c03468!important;}' +
    '.cw-gift1-info{background:rgba(192,52,104,.06)!important;border-color:rgba(192,52,104,.20)!important;}' +
    '.cw-gift1-info-text{color:rgba(26,8,16,.60)!important;}' +
    '.cw-gift1-info-accent{color:#c03468!important;}' +
    '.cw-gift1-info-italic{color:rgba(192,52,104,.70)!important;}' +
    '.cw-gift-amount-inner span[style]{color:rgba(192,52,104,.55)!important;}' +

    /* Success */
    '.cw-success-icon{background:rgba(192,52,104,.08)!important;border-color:rgba(192,52,104,.25)!important;color:#c03468!important;}' +
    '.cw-success h2{color:#1a0810!important;}' +
    '.cw-success p{color:rgba(26,8,16,.50)!important;}' +
    '.cw-success p strong{color:#1a0810!important;}' +
    '.cw-btn-new{background:rgba(26,8,16,.05)!important;border-color:rgba(26,8,16,.10)!important;color:rgba(26,8,16,.55)!important;}' +
    '.cw-btn-new:hover{background:rgba(26,8,16,.09)!important;color:#1a0810!important;}' +

    /* Backdrop */
    '#crocus-backdrop{background:rgba(180,100,130,.35)!important;}';

  function injectTheme(){
    var old = document.getElementById('crocus-page-theme');
    if (old) { old.textContent = override; return; }
    var s = document.createElement('style');
    s.id = 'crocus-page-theme';
    s.textContent = override;
    document.head.appendChild(s);
  }

  if (document.head) injectTheme();
  document.addEventListener('DOMContentLoaded', injectTheme);
  setTimeout(injectTheme, 100);
  setTimeout(injectTheme, 500);
})();

// ── Pedicure Page Theme ──────────────────────────────────────────────────────
(function(){
  var path = window.location.pathname.toLowerCase();
  var isPedi = path.indexOf('pedik') !== -1;
  if (!isPedi) return;

  var override =
    /* FAB — фиолетовый */
    '#crocus-fab{background:linear-gradient(145deg,#120a28 0%,#2a1660 100%)!important;border-color:rgba(196,168,216,.28)!important;}' +
    '#crocus-fab:hover{border-color:rgba(196,168,216,.65)!important;box-shadow:0 8px 36px rgba(94,58,140,.55)!important;}' +
    '#crocus-fab::before{background:radial-gradient(ellipse at 50% 110%,rgba(196,168,216,.14) 0%,transparent 65%)!important;}' +
    '.crocus-fab-ring:nth-child(1){border-color:rgba(94,58,140,.85)!important;}' +
    '.crocus-fab-ring:nth-child(2){border-color:rgba(94,58,140,.55)!important;}' +
    '.crocus-fab-ring:nth-child(3){border-color:rgba(196,168,216,.35)!important;}' +
    '#crocus-fab-mobile-btn{background:linear-gradient(145deg,#120a28 0%,#2a1660 100%)!important;border-color:rgba(196,168,216,.28)!important;}' +
    '.cfm-ring:nth-child(1){border-color:rgba(94,58,140,.85)!important;}' +
    '.cfm-ring:nth-child(2){border-color:rgba(94,58,140,.55)!important;}' +
    '.cfm-ring:nth-child(3){border-color:rgba(196,168,216,.35)!important;}' +

    /* Modal — тёмный фиолетовый */
    '#crocus-modal{background:#0f0820!important;}' +
    '#crocus-modal-header{background:rgba(94,58,140,.10)!important;border-bottom:none!important;}' +
    '.crocus-modal-title{color:#f0eaf8!important;}' +
    '.crocus-modal-sub{color:rgba(220,200,255,.38)!important;}' +
    '#crocus-close{border-color:rgba(196,168,216,.18)!important;background:rgba(196,168,216,.06)!important;color:rgba(220,200,255,.45)!important;}' +
    '#crocus-close:hover{background:rgba(196,168,216,.14)!important;color:#f0eaf8!important;}' +
    '@keyframes logoPulsePedi{0%,100%{filter:drop-shadow(0 0 4px rgba(255,255,255,.70)) drop-shadow(0 0 10px rgba(94,58,140,.65))}50%{filter:drop-shadow(0 0 8px rgba(255,255,255,1)) drop-shadow(0 0 22px rgba(196,168,216,.95))}}' +
    '.crocus-modal-logo{background:rgba(94,58,140,.20)!important;border-color:rgba(196,168,216,.22)!important;animation-name:logoPulsePedi!important;}' +

    /* Progress */
    '#crocus-progress{background:rgba(94,58,140,.08)!important;border-bottom:none!important;}' +
    '.cp-dot{background:rgba(255,255,255,.04)!important;border-color:rgba(255,255,255,.10)!important;color:rgba(220,200,255,.28)!important;}' +
    '.cp-step.active .cp-dot{background:#5e3a8c!important;border-color:#5e3a8c!important;color:#fff!important;box-shadow:0 0 12px rgba(94,58,140,.55)!important;}' +
    '.cp-step.done .cp-dot{background:rgba(196,168,216,.12)!important;border-color:#c4a8d8!important;color:#c4a8d8!important;}' +
    '.cp-label{color:rgba(220,200,255,.25)!important;}' +
    '.cp-step.active .cp-label,.cp-step.done .cp-label{color:rgba(220,200,255,.60)!important;}' +
    '.cp-line{background:rgba(255,255,255,.06)!important;}' +
    '.cp-line.filled{background:rgba(196,168,216,.30)!important;}' +

    /* Body */
    '#crocus-body{background:#0f0820!important;scrollbar-color:rgba(94,58,140,.35) transparent!important;}' +
    '#crocus-body::-webkit-scrollbar-thumb{background:rgba(94,58,140,.35)!important;}' +

    /* Titles & text */
    '.cw-title{color:#f0eaf8!important;}' +
    '.cw-sub{color:rgba(220,200,255,.45)!important;}' +
    '.cw-sub strong{color:#c4a8d8!important;}' +
    '.cw-back{color:rgba(220,200,255,.38)!important;}' +
    '.cw-back:hover{color:#c4a8d8!important;}' +
    '.cw-times-title{color:rgba(220,200,255,.38)!important;}' +

    /* Master cards */
    '.cw-master-card{background:rgba(255,255,255,.04)!important;border-color:rgba(196,168,216,.10)!important;}' +
    '.cw-master-card:hover{border-color:rgba(196,168,216,.35)!important;background:rgba(94,58,140,.08)!important;box-shadow:0 8px 28px rgba(94,58,140,.30)!important;}' +
    '.cw-master-card.selected{border-color:rgba(94,58,140,.60)!important;background:rgba(94,58,140,.10)!important;}' +
    '.cw-master-name{color:#f0eaf8!important;}' +
    '.cw-master-tagline{color:rgba(220,200,255,.50)!important;}' +
    '.cw-master-bio{color:rgba(220,200,255,.52)!important;}' +
    '.cw-skill-tag{color:rgba(196,168,216,.75)!important;background:rgba(196,168,216,.08)!important;border-color:rgba(196,168,216,.18)!important;}' +

    /* Category cards */
    '.cw-cat-card{background:rgba(255,255,255,.04)!important;border-color:rgba(196,168,216,.10)!important;}' +
    '.cw-cat-card:hover{border-color:rgba(196,168,216,.40)!important;background:rgba(94,58,140,.08)!important;box-shadow:0 6px 22px rgba(94,58,140,.28)!important;}' +
    '.cw-cat-label{color:#f0eaf8!important;}' +
    '.cw-cat-desc{color:rgba(220,200,255,.42)!important;}' +
    '.cw-cat-arrow{color:rgba(196,168,216,.30)!important;}' +

    /* Service buttons */
    '.cw-svc-btn{background:rgba(255,255,255,.04)!important;border-color:rgba(196,168,216,.10)!important;}' +
    '.cw-svc-btn:hover{border-color:rgba(196,168,216,.40)!important;background:rgba(94,58,140,.08)!important;}' +
    '.cw-svc-name{color:#f0eaf8!important;}' +
    '.cw-svc-dur{color:rgba(220,200,255,.38)!important;}' +
    '.cw-svc-price{color:#c4a8d8!important;}' +

    /* Addons */
    '.cw-addon-btn{background:rgba(255,255,255,.04)!important;border-color:rgba(196,168,216,.10)!important;}' +
    '.cw-addon-btn:hover{border-color:rgba(196,168,216,.38)!important;background:rgba(94,58,140,.07)!important;}' +
    '.cw-addon-btn.sel{border-color:#5e3a8c!important;background:rgba(94,58,140,.12)!important;}' +
    '.cw-addon-check{background:rgba(255,255,255,.05)!important;border-color:rgba(196,168,216,.20)!important;}' +
    '.cw-addon-btn.sel .cw-addon-check{background:#5e3a8c!important;border-color:#5e3a8c!important;color:#fff!important;}' +
    '.cw-addon-name{color:#f0eaf8!important;}' +
    '.cw-addon-price{color:rgba(196,168,216,.80)!important;}' +
    '.cw-skip-btn{border-color:rgba(196,168,216,.45)!important;color:rgba(220,200,255,.80)!important;}' +
    '.cw-skip-btn:hover{border-color:rgba(196,168,216,.70)!important;color:#f0eaf8!important;}' +

    /* Calendar */
    '.cw-calendar{background:rgba(255,255,255,.12)!important;border-color:rgba(196,168,216,.35)!important;}' +
    '.cw-cal-nav{border-bottom-color:rgba(196,168,216,.25)!important;}' +
    '.cw-cal-nav span{color:#f0eaf8!important;}' +
    '.cw-cal-nav button{color:rgba(220,200,255,.70)!important;}' +
    '.cw-cal-nav button:hover{background:rgba(94,58,140,.35)!important;color:#fff!important;}' +
    '.cw-dow{color:rgba(220,200,255,.70)!important;}' +
    '.cw-day{color:#f0eaf8!important;}' +
    '.cw-day.past,.cw-day.unavail{color:rgba(220,200,255,.30)!important;}' +
    '.cw-day.avail:hover{background:rgba(94,58,140,.40)!important;color:#fff!important;}' +
    '.cw-day.sel{background:#5e3a8c!important;color:#fff!important;box-shadow:0 0 13px rgba(94,58,140,.60)!important;}' +
    '.cw-day.avail::after{background:#c4a8d8!important;}' +
    '.cw-day.sel::after{background:#fff!important;}' +
    '.cw-time{background:rgba(255,255,255,.12)!important;border-color:rgba(196,168,216,.35)!important;color:#f0eaf8!important;}' +
    '.cw-time.free:hover{border-color:rgba(196,168,216,.70)!important;background:rgba(94,58,140,.35)!important;color:#fff!important;}' +
    '.cw-time.sel{background:#5e3a8c!important;border-color:#5e3a8c!important;color:#fff!important;box-shadow:0 0 11px rgba(94,58,140,.60)!important;}' +

    /* Loader / Error */
    '.cw-loader-text{color:rgba(220,200,255,.38)!important;}' +
    '.cw-spinner{border-color:rgba(94,58,140,.20)!important;border-top-color:#5e3a8c!important;}' +

    /* Summary & form */
    '.cw-summary{background:rgba(255,255,255,.04)!important;border-color:rgba(196,168,216,.18)!important;}' +
    '.cw-sum-row span{color:rgba(220,200,255,.38)!important;}' +
    '.cw-sum-row strong{color:#f0eaf8!important;}' +
    '.cw-sum-price strong{color:#c4a8d8!important;}' +
    '.cw-field label{color:rgba(220,200,255,.45)!important;}' +
    '.cw-field input{background:rgba(255,255,255,.05)!important;border-color:rgba(196,168,216,.14)!important;color:#f0eaf8!important;}' +
    '.cw-field input::placeholder{color:rgba(220,200,255,.25)!important;}' +
    '.cw-field input:focus{border-color:rgba(94,58,140,.60)!important;background:rgba(94,58,140,.07)!important;}' +
    '.cw-phone-dial{color:#f0eaf8!important;background:rgba(196,168,216,.08)!important;border-color:rgba(196,168,216,.14)!important;}' +
    '.cw-phone-wrap{background:rgba(255,255,255,.04)!important;border-color:rgba(196,168,216,.12)!important;}' +
    '.cw-phone-wrap:focus-within{border-color:rgba(94,58,140,.60)!important;}' +
    '.cw-phone-wrap input{color:#f0eaf8!important;}' +
    '.cw-dial-btn{color:#f0eaf8!important;background:rgba(196,168,216,.08)!important;border-color:rgba(196,168,216,.14)!important;}' +
    '.cw-dial-btn:hover,.cw-dial-btn.open{background:rgba(196,168,216,.16)!important;}' +
    '.cw-dial-drop{background:#1e1230!important;border-color:rgba(196,168,216,.18)!important;}' +
    '.cw-dial-search{border-color:rgba(196,168,216,.10)!important;}' +
    '.cw-dial-search input{color:#f0eaf8!important;}' +
    '.cw-dial-search input::placeholder{color:rgba(220,200,255,.30)!important;}' +
    '.cw-dial-item{color:#f0eaf8!important;}' +
    '.cw-dial-item:hover{background:rgba(94,58,140,.14)!important;}' +
    '.cw-dial-item.sel{background:rgba(94,58,140,.22)!important;}' +
    '.cw-dial-item__code{color:#f0eaf8!important;}' +
    '.cw-dial-item__name{color:rgba(220,200,255,.45)!important;}' +
    '.cw-btn-confirm{background:linear-gradient(135deg,#5e3a8c 0%,#3d1f6e 100%)!important;box-shadow:0 6px 22px rgba(94,58,140,.40)!important;}' +
    '.cw-btn-confirm:hover:not(:disabled){box-shadow:0 10px 30px rgba(94,58,140,.58)!important;}' +
    '.cw-form-note{color:rgba(220,200,255,.30)!important;}' +

    /* Success */
    '.cw-success-icon{background:rgba(94,58,140,.12)!important;border-color:rgba(196,168,216,.28)!important;color:#c4a8d8!important;}' +
    '.cw-success h2{color:#f0eaf8!important;}' +
    '.cw-success p{color:rgba(220,200,255,.50)!important;}' +
    '.cw-success p strong{color:#f0eaf8!important;}' +
    '.cw-btn-new{background:rgba(255,255,255,.05)!important;border-color:rgba(196,168,216,.14)!important;color:rgba(220,200,255,.55)!important;}' +
    '.cw-btn-new:hover{background:rgba(94,58,140,.10)!important;color:#f0eaf8!important;}' +


    /* Backdrop */
    '#crocus-backdrop{background:rgba(20,8,45,.55)!important;}';

  function injectPediTheme(){
    var old = document.getElementById('crocus-pedi-theme');
    if (old) { old.textContent = override; return; }
    var s = document.createElement('style');
    s.id = 'crocus-pedi-theme';
    s.textContent = override;
    document.head.appendChild(s);
  }

  if (document.head) injectPediTheme();
  document.addEventListener('DOMContentLoaded', injectPediTheme);
  setTimeout(injectPediTheme, 100);
  setTimeout(injectPediTheme, 500);
})();

// ── CRL2 MASTER SELECT + REVEAL ─────────────────────────────────────────────
(function(){
  var MASTER_INFO = {
    nelia: {
      badge: '✦ Master · Crocus Beauty Studio',
      title: '<em>Nelia</em>',
      sub: 'Ausgebildete Fachkraft · Gleiche Technik · Attraktiver Preis',
      sections: [
        {
          heading: 'Ausgebildet von Diana — nach denselben Standards',
          text: 'Nelia ist nicht einfach eine Mitarbeiterin — sie wurde persönlich von Diana ausgebildet und arbeitet vollständig nach deren Methoden, Techniken und Qualitätsprinzipien. Jede Behandlung folgt den Standards von Crocus Beauty Studio.'
        },
        {
          heading: 'Was dich erwartet',
          points: [
            'Präzise Technik nach Diana-Standard',
            'Saubere, sorgfältige Arbeit auf hohem Niveau',
            'Perfekte Nagelarchitektur & modernes Design',
            'Sterilisierte Instrumente — Hygiene auf medizinischem Niveau',
            'Nagelverlängerung — professionell mit Gel'
          ]
        },
        {
          heading: 'Warum Nelia wählen?',
          text: 'Der Unterschied zu Diana liegt hauptsächlich in der Erfahrung und Arbeitsgeschwindigkeit — was sich direkt im Preis widerspiegelt. Die ideale Wahl für Kundinnen, die Premium-Qualität zu einem besseren Preis-Leistungs-Verhältnis suchen. Kein Kompromiss bei der Qualität — nur ein fairerer Einstieg.'
        }
      ]
    },
    sofia: {
      badge: '✦ Master · Crocus Beauty Studio',
      title: '<em>Sofia</em>',
      sub: 'Ausgebildete Fachkraft · Maniküre & Pediküre · Attraktiver Preis',
      sections: [
        {
          heading: 'Sorgfältige Arbeit mit Herz',
          text: 'Sofia ist eine ausgebildete Maniküristin, die nach den Standards von Crocus Beauty Studio arbeitet. Herzlich, präzise und geduldig — man geht mit perfekten Nägeln und guter Laune raus.'
        },
        {
          heading: 'Was dich erwartet',
          points: [
            'Russische Technik mit Fräse — kein Einweichen',
            'Saubere, sorgfältige Arbeit auf hohem Niveau',
            'Maniküre, Pediküre & Kombi-Behandlungen',
            'Sterilisierte Instrumente — Hygiene auf medizinischem Niveau'
          ]
        },
        {
          heading: 'Warum Sofia wählen?',
          text: 'Sofia ist die perfekte Wahl für Kundinnen, die Premium-Qualität zu einem fairem Preis suchen. Gleiche Materialien, gleiche Standards — und ein entspanntes Erlebnis mit persönlicher Betreuung.'
        }
      ]
    },
    diana: {
      badge: '💎 Top-Master · Crocus Beauty Studio',
      title: '<em>Diana</em>',
      sub: 'Führende Spezialistin · 10+ Jahre · Standards setzen, nicht folgen',
      sections: [
        {
          heading: 'Die Meisterin hinter Crocus Beauty',
          text: 'Diana ist die führende Spezialistin im Crocus Beauty Studio mit über 10 Jahren Erfahrung im Bereich Nageldesign und ästhetische Kosmetik. Sie ist eine Expertin, die Standards setzt — nicht ihnen folgt. Tausende zufriedene Kundinnen, perfektionierte Techniken und ein ausgeprägtes Gefühl für Form, Farbe und Stil zeichnen ihre Arbeit aus.'
        },
        {
          heading: 'Was jede Behandlung auszeichnet',
          points: [
            'Perfekte Nagelarchitektur — beim ersten Termin, ohne Nachbesserungen',
            'Hygienische Präzision auf medizinischem Niveau',
            'Nagelverlängerung, komplexes Design & Premium-Ästhetik',
            'Schnell, exakt und kompromisslos in der Qualität'
          ]
        },
        {
          heading: 'Mehr als Maniküre',
          text: 'Kundinnen wählen Diana, wenn sie ein Ergebnis auf höchstem Niveau erwarten. Sie macht nicht einfach Maniküre — sie kreiert ein Gesamtbild, das Stil, Eleganz und Selbstbewusstsein unterstreicht.'
        }
      ]
    }
  };

  var MASTER_PHOTO = {
    nelia: 'https://static.tildacdn.com/tild3537-3733-4430-b466-336537373738/WhatsApp_Image_2026-.jpeg',
    diana: 'https://static.tildacdn.com/tild3565-3731-4564-a536-376463363936/WhatsApp_Image_2026-.jpeg',
    sofia: 'https://cdn.jsdelivr.net/gh/chistyartem-blip/crocus-widget@1a78ce1/assets/sofia.jpg'

  };

  function openMasterInfo(key) {
    var d = MASTER_INFO[key]; if (!d) return;
    var isDiana  = key === 'diana';
    var accent       = isDiana ? '#b8924a' : '#7B2D4E';
    var accentLight  = isDiana ? 'rgba(201,168,124,0.13)' : 'rgba(123,45,78,0.08)';
    var accentBorder = isDiana ? 'rgba(201,168,124,0.35)' : 'rgba(123,45,78,0.18)';
    var headerBg     = isDiana
      ? 'linear-gradient(160deg,#2a1f10 0%,#1a0d12 100%)'
      : 'linear-gradient(160deg,#2a0d1a 0%,#1a0d12 100%)';
    var photo = MASTER_PHOTO[key] || '';

    var h = '';

    // ── Шапка с фото ──────────────────────────────────────────────────────
    h += '<div style="position:relative;border-radius:22px 22px 0 0;overflow:hidden;">';
    if (photo) {
      h += '<img src="' + photo + '" alt="' + key + '" style="width:100%;height:420px;object-fit:cover;object-position:center 20%;display:block;">';
    }
    h += '<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(10,3,12,0.92) 0%,rgba(10,3,12,0.30) 55%,transparent 100%);"></div>';
    h += '<div style="position:absolute;bottom:20px;left:24px;right:24px;">';
    h += '<span style="display:inline-block;font-family:\'DM Sans\',sans-serif;font-size:8px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:' + accent + ';background:rgba(10,3,12,0.65);border:1px solid ' + accentBorder + ';padding:3px 10px;border-radius:50px;margin-bottom:8px;backdrop-filter:blur(4px);">' + d.badge + '</span><br>';
    h += '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:36px;font-weight:300;color:#fff;letter-spacing:-0.02em;line-height:1;">' + d.title + '</div>';
    h += '<p style="font-family:\'DM Sans\',sans-serif;font-size:9.5px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin:5px 0 0;">' + d.sub + '</p>';
    h += '</div></div>';

    // ── Контент ────────────────────────────────────────────────────────────
    h += '<div style="padding:24px 24px 28px;box-sizing:border-box;">';

    // Секции
    d.sections.forEach(function(s, i){
      if (i > 0) h += '<div style="height:1px;background:linear-gradient(to right,' + accentBorder + ',transparent);margin:18px 0;"></div>';
      h += '<div style="font-family:\'DM Sans\',sans-serif;font-size:8.5px;font-weight:700;letter-spacing:0.17em;text-transform:uppercase;color:' + accent + ';margin-bottom:8px;">' + s.heading + '</div>';
      if (s.text) {
        h += '<p style="font-family:\'DM Sans\',sans-serif;font-size:13px;font-weight:300;color:rgba(255,220,200,0.72);line-height:1.72;margin:0;">' + s.text + '</p>';
      }
      if (s.points) {
        h += '<div style="display:flex;flex-direction:column;gap:7px;margin-top:' + (s.text ? '10px' : '0') + ';">';
        s.points.forEach(function(p){
          h += '<div style="display:flex;align-items:flex-start;gap:11px;font-family:\'DM Sans\',sans-serif;font-size:12.5px;color:rgba(255,230,210,0.75);line-height:1.5;">'
            + '<span style="width:18px;height:18px;border-radius:50%;background:' + accentLight + ';border:1px solid ' + accentBorder + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:1px;">'
            + '<span style="width:5px;height:5px;border-radius:50%;background:' + accent + ';display:block;"></span></span>'
            + '<span>' + p + '</span></div>';
        });
        h += '</div>';
      }
    });

    // ── CTA ───────────────────────────────────────────────────────────────
    h += '<div style="margin-top:24px;padding-top:20px;border-top:1px solid ' + accentBorder + ';display:flex;flex-direction:column;gap:8px;">';
    h += '<button data-crl2-minfo-book style="width:100%;padding:14px 20px;border:none;border-radius:12px;cursor:pointer;font-family:\'DM Sans\',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#fff;background:' + (isDiana ? 'linear-gradient(135deg,#c9a87c,#8c6020)' : 'linear-gradient(135deg,#9b3660,#7B2D4E)') + ';display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:' + (isDiana ? '0 4px 18px rgba(201,168,124,0.35)' : '0 4px 18px rgba(123,45,78,0.38)') + ';box-sizing:border-box;">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
      + 'Termin buchen</button>';
    h += '<button data-crl2-select="' + key + '" style="width:100%;padding:12px 20px;border:1.5px solid ' + accentBorder + ';border-radius:12px;cursor:pointer;font-family:\'DM Sans\',sans-serif;font-size:12px;font-weight:600;letter-spacing:0.04em;color:' + accent + ';background:transparent;display:flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;">'
      + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M21 8.5A8.38 8.38 0 0 0 5 12a8.38 8.38 0 0 0 16 3.5M3 12h13"/></svg>'
      + 'Preise ansehen</button>';
    h += '</div>';
    h += '</div>'; // /контент

    var minfoCont = document.getElementById('crl2-minfo-content');
    var minfoOv   = document.getElementById('crl2-minfo-overlay');
    if (!minfoCont || !minfoOv) return;
    minfoCont.innerHTML = h;
    minfoOv.classList.add('crl2-open');
    lockPageScroll();
  }

  function selectMaster(key) {
    if (!key) return;
    // карточки
    document.querySelectorAll('[data-crl2-master]').forEach(function(el){
      el.classList.toggle('crl2__mc-btn--active', el.getAttribute('data-crl2-master') === key);
    });
    // стрелки
    document.querySelectorAll('[data-crl2-hint]').forEach(function(el){
      el.classList.toggle('crl2__mc-prices-hint--active', el.getAttribute('data-crl2-hint') === key);
    });
    // панели
    document.querySelectorAll('.crl2__sub-panel').forEach(function(p){ p.classList.remove('crl2__sub-panel--active'); });
    var panel = document.getElementById('crl2-sub-' + key);
    if (panel) panel.classList.add('crl2__sub-panel--active');
    // reveal
    var reveal = document.getElementById('crl2-reveal');
    if (reveal) {
      reveal.classList.add('crl2__reveal--open');
      // скролл после завершения анимации max-height (550ms transition)
    }
  }

  var _initDone = false;
  function init() {
    if (_initDone) return;
    _initDone = true;

    // закрыть minfo попап — прямой обработчик на крестик и фон
    function closeMinfo() {
      var ov = document.getElementById('crl2-minfo-overlay');
      if (!ov) return;
      ov.classList.remove('crl2-open');
      unlockPageScroll();
    }
    var minfoOverlay = document.getElementById('crl2-minfo-overlay');
    if (minfoOverlay) {
      minfoOverlay.addEventListener('click', function(e) {
        if (e.target === minfoOverlay || e.target.closest('[data-crl2-minfo-close]')) closeMinfo();
      });
    }

    // клик на карточку мастера + кнопки внутри minfo
    document.addEventListener('click', function(e) {
      // "Termin buchen" внутри minfo попапа
      if (e.target.closest('[data-crl2-minfo-book]')) {
        closeMinfo();
        if (typeof crocusOpen === 'function') crocusOpen();
        return;
      }
      // "Preise ansehen" внутри minfo попапа
      var sel = e.target.closest('[data-crl2-select]');
      if (sel) {
        closeMinfo();
        selectMaster(sel.getAttribute('data-crl2-select'));
        return;
      }
      // карточка мастера
      var mc = e.target.closest('[data-crl2-master]');
      if (mc) {
        var about = e.target.closest('[data-crl2-about]');
        if (about) {
          openMasterInfo(about.getAttribute('data-crl2-about'));
        } else {
          selectMaster(mc.getAttribute('data-crl2-master'));
        }
        return;
      }
    });

    // main tabs (Maniküre / Wimpern)
    document.addEventListener('click', function(e) {
      var tab = e.target.closest('[data-crl2-main]');
      if (!tab) return;
      var key = tab.getAttribute('data-crl2-main');
      document.querySelectorAll('[data-crl2-main]').forEach(function(t){
        t.classList.toggle('crl2__main-tab--active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      document.querySelectorAll('.crl2__main-panel').forEach(function(p){ p.classList.remove('crl2__main-panel--active'); });
      var panel = document.getElementById('crl2-panel-' + key);
      if (panel) panel.classList.add('crl2__main-panel--active');

      // переключаем карточки мастеров в mc-grid
      var isMani = (key === 'mani' || key === 'manikuere' || key === 'maniküre');
      var isWimpern = (key === 'wimpern');
      document.querySelectorAll('.crl2__mc-card--mani').forEach(function(c){ c.style.display = isMani ? '' : 'none'; });
      document.querySelectorAll('.crl2__mc-card--wimpern').forEach(function(c){ c.style.display = isWimpern ? '' : 'none'; });
      // центрировать грид когда одна карточка (wimpern)
      document.querySelectorAll('.crl2__mc-grid').forEach(function(g){
        g.classList.toggle('crl2__mc-grid--single', isWimpern);
      });

      // сбросить reveal и активную карточку
      var reveal = document.getElementById('crl2-reveal');
      if (reveal) reveal.classList.remove('crl2__reveal--open');
      document.querySelectorAll('[data-crl2-master]').forEach(function(el){ el.classList.remove('crl2__mc-btn--active'); });
      document.querySelectorAll('[data-crl2-hint]').forEach(function(el){ el.classList.remove('crl2__mc-prices-hint--active'); });
      document.querySelectorAll('.crl2__sub-panel').forEach(function(p){ p.classList.remove('crl2__sub-panel--active'); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 300);
  setTimeout(init, 800);
})();

})();


// ── Wimpern Page Theme ───────────────────────────────────────────────────────
(function(){
  var path = window.location.pathname.toLowerCase();
  var isWimpern = path.indexOf('wimper') !== -1 || path.indexOf('wimpern') !== -1 || path.indexOf('lash') !== -1;
  if (!isWimpern) return;

  // Палитра: midnight navy #06040a, steel #b8c8d8, gold #c9a87c, cream #f0e8d8
  var override =
    /* ── FAB — стальной/перламутровый ── */
    '#crocus-fab{background:linear-gradient(145deg,#07050e 0%,#0e0c1e 100%)!important;border-color:rgba(184,200,216,.28)!important;}' +
    '#crocus-fab:hover{border-color:rgba(184,200,216,.65)!important;box-shadow:0 8px 36px rgba(150,170,190,.35)!important;}' +
    '#crocus-fab::before{background:radial-gradient(ellipse at 50% 110%,rgba(184,200,216,.12) 0%,transparent 65%)!important;}' +
    '.crocus-fab-ring:nth-child(1){border-color:rgba(184,200,216,.90)!important;}' +
    '.crocus-fab-ring:nth-child(2){border-color:rgba(184,200,216,.55)!important;}' +
    '.crocus-fab-ring:nth-child(3){border-color:rgba(201,168,124,.35)!important;}' +
    '#crocus-fab-mobile-btn{background:linear-gradient(145deg,#07050e 0%,#0e0c1e 100%)!important;border-color:rgba(184,200,216,.28)!important;}' +
    '.cfm-ring:nth-child(1){border-color:rgba(184,200,216,.90)!important;}' +
    '.cfm-ring:nth-child(2){border-color:rgba(184,200,216,.55)!important;}' +
    '.cfm-ring:nth-child(3){border-color:rgba(201,168,124,.35)!important;}' +

    /* ── Modal — тёмный midnight с лёгким синим оттенком ── */
    '#crocus-modal{background:#08060f!important;}' +
    '#crocus-modal-header{background:rgba(184,200,216,.04)!important;border-bottom:1px solid rgba(184,200,216,.08)!important;}' +
    '.crocus-modal-title{color:#f0e8d8!important;}' +
    '.crocus-modal-sub{color:rgba(184,200,216,.42)!important;}' +
    '#crocus-close{border-color:rgba(184,200,216,.16)!important;background:rgba(184,200,216,.05)!important;color:rgba(240,232,216,.45)!important;}' +
    '#crocus-close:hover{background:rgba(184,200,216,.12)!important;color:#f0e8d8!important;}' +
    '@keyframes logoPulseWimp{0%,100%{filter:drop-shadow(0 0 4px rgba(255,255,255,.60)) drop-shadow(0 0 10px rgba(184,200,216,.55))}50%{filter:drop-shadow(0 0 9px rgba(255,255,255,.95)) drop-shadow(0 0 22px rgba(201,168,124,.75))}}' +
    '.crocus-modal-logo{background:rgba(184,200,216,.10)!important;border-color:rgba(184,200,216,.24)!important;animation-name:logoPulseWimp!important;}' +

    /* ── Progress — стальной ── */
    '#crocus-progress{background:rgba(184,200,216,.05)!important;border-bottom:1px solid rgba(184,200,216,.08)!important;}' +
    '.cp-dot{background:rgba(255,255,255,.04)!important;border-color:rgba(255,255,255,.08)!important;color:rgba(240,232,216,.25)!important;}' +
    '.cp-step.active .cp-dot{background:linear-gradient(135deg,#b8c8d8 0%,#c9a87c 100%)!important;border-color:#b8c8d8!important;color:#06040a!important;box-shadow:0 0 14px rgba(184,200,216,.50)!important;}' +
    '.cp-step.done .cp-dot{background:rgba(201,168,124,.14)!important;border-color:#c9a87c!important;color:#c9a87c!important;}' +
    '.cp-label{color:rgba(240,232,216,.22)!important;}' +
    '.cp-step.active .cp-label,.cp-step.done .cp-label{color:rgba(240,232,216,.60)!important;}' +
    '.cp-line{background:rgba(255,255,255,.06)!important;}' +
    '.cp-line.filled{background:linear-gradient(to right,rgba(184,200,216,.40),rgba(201,168,124,.35))!important;}' +

    /* ── Body ── */
    '#crocus-body{background:#08060f!important;scrollbar-color:rgba(184,200,216,.25) transparent!important;}' +
    '#crocus-body::-webkit-scrollbar-thumb{background:rgba(184,200,216,.25)!important;}' +

    /* ── Типографика ── */
    '.cw-title{color:#f0e8d8!important;}' +
    '.cw-sub{color:rgba(184,200,216,.45)!important;}' +
    '.cw-sub strong{color:#c9a87c!important;}' +
    '.cw-back{color:rgba(184,200,216,.38)!important;}' +
    '.cw-back:hover{color:#c9a87c!important;}' +
    '.cw-times-title{color:rgba(184,200,216,.38)!important;}' +

    /* ── Мастер карточки ── */
    '.cw-master-card{background:rgba(184,200,216,.03)!important;border-color:rgba(184,200,216,.10)!important;}' +
    '.cw-master-card:hover{border-color:rgba(184,200,216,.38)!important;background:rgba(184,200,216,.07)!important;box-shadow:0 8px 28px rgba(0,0,0,.55),0 0 0 1px rgba(184,200,216,.10)!important;}' +
    '.cw-master-card.selected{border-color:rgba(201,168,124,.55)!important;background:rgba(201,168,124,.06)!important;box-shadow:0 0 18px rgba(201,168,124,.20)!important;}' +
    '.cw-master-name{color:#f0e8d8!important;}' +
    '.cw-master-tagline{color:rgba(184,200,216,.52)!important;}' +
    '.cw-master-bio{color:rgba(184,200,216,.45)!important;}' +
    '.cw-skill-tag{color:rgba(184,200,216,.75)!important;background:rgba(184,200,216,.07)!important;border-color:rgba(184,200,216,.18)!important;}' +

    /* ── Категории ── */
    '.cw-cat-card{background:rgba(184,200,216,.03)!important;border-color:rgba(184,200,216,.09)!important;}' +
    '.cw-cat-card:hover{border-color:rgba(184,200,216,.42)!important;background:rgba(184,200,216,.07)!important;box-shadow:0 6px 22px rgba(0,0,0,.50)!important;}' +
    '.cw-cat-label{color:#f0e8d8!important;}' +
    '.cw-cat-desc{color:rgba(184,200,216,.42)!important;}' +
    '.cw-cat-arrow{color:rgba(201,168,124,.45)!important;}' +

    /* ── Сервисы ── */
    '.cw-svc-btn{background:rgba(184,200,216,.03)!important;border-color:rgba(184,200,216,.09)!important;}' +
    '.cw-svc-btn:hover{border-color:rgba(184,200,216,.40)!important;background:rgba(184,200,216,.07)!important;}' +
    '.cw-svc-name{color:#f0e8d8!important;}' +
    '.cw-svc-dur{color:rgba(184,200,216,.38)!important;}' +
    '.cw-svc-price{color:#c9a87c!important;}' +

    /* ── Доп. услуги ── */
    '.cw-addon-btn{background:rgba(184,200,216,.03)!important;border-color:rgba(184,200,216,.09)!important;}' +
    '.cw-addon-btn:hover{border-color:rgba(184,200,216,.38)!important;background:rgba(184,200,216,.07)!important;}' +
    '.cw-addon-btn.sel{border-color:rgba(201,168,124,.55)!important;background:rgba(201,168,124,.08)!important;}' +
    '.cw-addon-check{background:rgba(255,255,255,.04)!important;border-color:rgba(184,200,216,.20)!important;}' +
    '.cw-addon-btn.sel .cw-addon-check{background:linear-gradient(135deg,#b8c8d8,#c9a87c)!important;border-color:#c9a87c!important;color:#06040a!important;}' +
    '.cw-addon-name{color:#f0e8d8!important;}' +
    '.cw-addon-price{color:rgba(201,168,124,.85)!important;}' +
    '.cw-skip-btn{border-color:rgba(184,200,216,.38)!important;color:rgba(184,200,216,.75)!important;}' +
    '.cw-skip-btn:hover{border-color:rgba(184,200,216,.65)!important;color:#f0e8d8!important;}' +

    /* ── Календарь ── */
    '.cw-calendar{background:rgba(184,200,216,.06)!important;border-color:rgba(184,200,216,.16)!important;}' +
    '.cw-cal-nav{border-bottom-color:rgba(184,200,216,.12)!important;}' +
    '.cw-cal-nav span{color:#f0e8d8!important;}' +
    '.cw-cal-nav button{color:rgba(184,200,216,.55)!important;}' +
    '.cw-cal-nav button:hover{background:rgba(184,200,216,.12)!important;color:#f0e8d8!important;}' +
    '.cw-dow{color:rgba(184,200,216,.45)!important;}' +
    '.cw-day{color:#f0e8d8!important;}' +
    '.cw-day.past,.cw-day.unavail{color:rgba(240,232,216,.22)!important;}' +
    '.cw-day.avail:hover{background:rgba(184,200,216,.18)!important;color:#fff!important;}' +
    '.cw-day.sel{background:linear-gradient(135deg,#b8c8d8 0%,#c9a87c 100%)!important;color:#06040a!important;box-shadow:0 0 16px rgba(184,200,216,.45)!important;}' +
    '.cw-day.avail::after{background:#c9a87c!important;}' +
    '.cw-day.sel::after{background:#06040a!important;}' +
    '.cw-time{background:rgba(184,200,216,.05)!important;border-color:rgba(184,200,216,.14)!important;color:rgba(240,232,216,.80)!important;}' +
    '.cw-time.free:hover{border-color:rgba(184,200,216,.55)!important;background:rgba(184,200,216,.14)!important;color:#f0e8d8!important;}' +
    '.cw-time.sel{background:linear-gradient(135deg,#b8c8d8 0%,#c9a87c 100%)!important;border-color:#c9a87c!important;color:#06040a!important;box-shadow:0 0 12px rgba(184,200,216,.40)!important;}' +

    /* ── Loader ── */
    '.cw-loader-text{color:rgba(184,200,216,.38)!important;}' +
    '.cw-spinner{border-color:rgba(184,200,216,.14)!important;border-top-color:#b8c8d8!important;}' +

    /* ── Summary & форма ── */
    '.cw-summary{background:rgba(184,200,216,.04)!important;border-color:rgba(184,200,216,.14)!important;}' +
    '.cw-master-slot{color:rgba(184,200,216,.55)!important;}' +
    '.cw-sum-row span{color:rgba(184,200,216,.38)!important;}' +
    '.cw-sum-row strong{color:#f0e8d8!important;}' +
    '.cw-sum-price strong{color:#c9a87c!important;}' +
    '.cw-field label{color:rgba(184,200,216,.45)!important;}' +
    '.cw-field input{background:rgba(184,200,216,.05)!important;border-color:rgba(184,200,216,.12)!important;color:#f0e8d8!important;}' +
    '.cw-field input::placeholder{color:rgba(184,200,216,.28)!important;}' +
    '.cw-field input:focus{border-color:rgba(184,200,216,.55)!important;background:rgba(184,200,216,.08)!important;}' +
    '.cw-phone-dial{color:#f0e8d8!important;background:rgba(184,200,216,.08)!important;border-color:rgba(184,200,216,.14)!important;}' +
    '.cw-phone-wrap{background:rgba(184,200,216,.05)!important;border-color:rgba(184,200,216,.12)!important;}' +
    '.cw-phone-wrap:focus-within{border-color:rgba(184,200,216,.55)!important;}' +
    '.cw-phone-wrap input{color:#f0e8d8!important;}' +
    '.cw-dial-btn{color:#f0e8d8!important;background:rgba(184,200,216,.08)!important;border-color:rgba(184,200,216,.14)!important;}' +
    '.cw-dial-btn:hover,.cw-dial-btn.open{background:rgba(184,200,216,.16)!important;}' +
    '.cw-dial-drop{background:#131c24!important;border-color:rgba(184,200,216,.18)!important;}' +
    '.cw-dial-search{border-color:rgba(184,200,216,.10)!important;}' +
    '.cw-dial-search input{color:#f0e8d8!important;}' +
    '.cw-dial-search input::placeholder{color:rgba(184,200,216,.30)!important;}' +
    '.cw-dial-item{color:#f0e8d8!important;}' +
    '.cw-dial-item:hover{background:rgba(184,200,216,.10)!important;}' +
    '.cw-dial-item.sel{background:rgba(201,168,124,.16)!important;}' +
    '.cw-dial-item__code{color:#f0e8d8!important;}' +
    '.cw-dial-item__name{color:rgba(184,200,216,.45)!important;}' +

    /* ── CTA кнопка — steel→gold, текст всегда белый ── */
    '.cw-btn-confirm{background:linear-gradient(135deg,#8fa8bc 0%,#b8c8d8 35%,#c9a87c 65%,#d4b896 100%)!important;background-size:200% 100%!important;color:#fff!important;text-shadow:0 1px 3px rgba(0,0,0,.45)!important;font-weight:700!important;box-shadow:0 6px 24px rgba(184,200,216,.38),0 2px 0 rgba(201,168,124,.22) inset!important;animation:wimpConfirmShine 5s ease-in-out infinite!important;}' +
    '@keyframes wimpConfirmShine{0%,100%{background-position:0% 0}50%{background-position:100% 0}}' +
    '.cw-btn-confirm:hover:not(:disabled){background-position:100% 0!important;box-shadow:0 10px 32px rgba(184,200,216,.55),0 0 0 3px rgba(184,200,216,.20)!important;transform:translateY(-2px)!important;}' +
    '.cw-form-note{color:rgba(184,200,216,.28)!important;}' +

    /* ── Consent + чекбокс ── */
    '.cw-consent input[type=checkbox]{accent-color:#b8c8d8!important;}' +
    '.cw-consent span{color:rgba(184,200,216,.70)!important;}' +
    '.cw-consent span a{color:#c9a87c!important;}' +
    '.cw-consent span a:hover{color:#f0e8d8!important;}' +
    '.cw-consent.invalid span{color:#c9a87c!important;}' +

    /* ── Ошибки ── */
    '.cw-field-err{color:rgba(201,168,124,.90)!important;}' +
    '.cw-field input.invalid{border-color:rgba(201,168,124,.55)!important;background:rgba(201,168,124,.06)!important;}' +
    '.cw-err-msg--visible{color:#f0e8d8!important;background:rgba(201,168,124,.10)!important;border-color:rgba(201,168,124,.30)!important;}' +

    /* ── Gift CTA ── */
    '.cw-gift-cta{background:rgba(184,200,216,.05)!important;border-color:rgba(184,200,216,.18)!important;}' +
    '.cw-gift-cta:hover{background:rgba(184,200,216,.10)!important;border-color:rgba(184,200,216,.38)!important;}' +
    '.cw-gift-cta-title{color:#f0e8d8!important;}' +
    '.cw-gift-cta-sub{color:rgba(184,200,216,.50)!important;}' +
    '.cw-gift-cta-arrow{color:rgba(201,168,124,.65)!important;}' +
    '.cw-gift-divider span{color:rgba(184,200,216,.30)!important;}' +
    '.cw-gift-divider::before,.cw-gift-divider::after{background:rgba(184,200,216,.12)!important;}' +

    /* ── Success ── */
    '.cw-success-icon{background:rgba(184,200,216,.08)!important;border-color:rgba(201,168,124,.32)!important;color:#c9a87c!important;}' +
    '.cw-success h2{color:#f0e8d8!important;}' +
    '.cw-success p{color:rgba(184,200,216,.52)!important;}' +
    '.cw-success p strong{color:#f0e8d8!important;}' +
    '.cw-btn-new{background:rgba(184,200,216,.05)!important;border-color:rgba(184,200,216,.14)!important;color:rgba(184,200,216,.60)!important;}' +
    '.cw-btn-new:hover{background:rgba(184,200,216,.10)!important;color:#f0e8d8!important;}' +

    /* ── Backdrop ── */
    '#crocus-backdrop{background:rgba(4,2,12,.70)!important;}';

  function injectWimpernTheme(){
    var old = document.getElementById('crocus-wimpern-theme');
    if (old) { old.textContent = override; return; }
    var s = document.createElement('style');
    s.id = 'crocus-wimpern-theme';
    s.textContent = override;
    document.head.appendChild(s);
  }

  if (document.head) injectWimpernTheme();
  document.addEventListener('DOMContentLoaded', injectWimpernTheme);
  setTimeout(injectWimpernTheme, 100);
  setTimeout(injectWimpernTheme, 500);
})();
