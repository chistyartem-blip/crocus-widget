(function(){

  /* ══════════════════════════════════════════════
     API CONFIG
  ══════════════════════════════════════════════ */
  var MNP2_API_TOKEN = 'u8xzkdpkgfc73uektn64';
  var MNP2_LOC       = '1357963';
  var MNP2_API_BASE  = 'https://api.alteg.io/api/v1';

  /* Staff IDs */
  var STAFF = { diana:3020185, nelia:3020186, sofia:3020187 };

  /* Service IDs (одинаковые для всех мастеров у кого есть) */
  var SVC = {
    basis:        13485752,
    gel:          13485753,
    korrektur:    13485754,
    verlaengerung:13485755
  };

  /* Popup key → {master, service} */
  var POPUP_META = {
    n_basis:        { master:'nelia',  svc: SVC.basis        },
    n_gel:          { master:'nelia',  svc: SVC.gel          },
    n_korrektur:    { master:'nelia',  svc: SVC.korrektur    },
    n_verlaengerung:{ master:'nelia',  svc: SVC.verlaengerung},
    s_basis:        { master:'sofia',  svc: SVC.basis        },
    s_gel:          { master:'sofia',  svc: SVC.gel          },
    s_korrektur:    { master:'sofia',  svc: SVC.korrektur    },
    d_basis:        { master:'diana',  svc: SVC.basis        },
    d_gel:          { master:'diana',  svc: SVC.gel          },
    d_korrektur:    { master:'diana',  svc: SVC.korrektur    },
    d_verlaengerung:{ master:'diana',  svc: SVC.verlaengerung}
  };

  /* Addon IDs available per master (из API: что есть у мастера) */
  var ADDON_IDS_BY_MASTER = {
    diana: [13485758, 13485757, 13485756, 13502360, 13502359], // Stiletto, Babyboomer, French, Design, Gel-Lack
    nelia: [13485759, 13485756, 13502360, 13502359, 13502395], // Nageldesign, French, Design, Gel-Lack, Mandel
    sofia: [13485759, 13485756, 13502360, 13502359, 13502395]  // Nageldesign, French, Design, Gel-Lack, Mandel
  };

  /* Addon IDs разрешённые для каждой услуги */
  var ADDON_IDS_BY_SVC = {
    [SVC.basis]:         [],                                              // Basis — нет допов
    [SVC.gel]:           [13485758,13485757,13485756,13502360,13502359,13485759,13502395], // все
    [SVC.korrektur]:     [13485758,13485757,13485756,13502360,13502359,13485759,13502395],
    [SVC.verlaengerung]: [13485758,13485757,13485756,13502360,13502359,13485759,13502395]
  };

  /* Addon info */
  var ADDON_INFO = {
    13485756: { name:'French',           price:'+ 5 €'    },
    13485757: { name:'Babyboomer',       price:'+ 10 €'   },
    13485758: { name:'Stiletto-Form',    price:'+ 10 €'   },
    13485759: { name:'Nageldesign',      price:'+ 10 €'   },
    13502359: { name:'Gel-Lack (Farbe)', price:'+ 5 €'    },
    13502360: { name:'Design',           price:'ab + 5 €' },
    13502395: { name:'Mandel-Form',      price:'+ 5 €'    }
  };

  /* Кэш данных из API: masterKey → { svcId → {dur, price} } */
  var apiCache = {};

  function fmtDur(sec){
    if(!sec) return '';
    var m = Math.round(sec / 60);
    if(m < 60) return m + ' Min.';
    var h = Math.floor(m / 60), rm = m % 60;
    return rm > 0 ? h + ' Std. ' + rm + ' Min.' : h + ' Std.';
  }

  function fmtPrice(min, max){
    if(!min && !max) return '';
    if(min === max) return min + ' €';
    return 'ab ' + min + ' €';
  }

  /* Загрузка данных из API для мастера */
  function loadMasterData(masterKey, callback){
    if(apiCache[masterKey]){ callback(apiCache[masterKey]); return; }
    var staffId = STAFF[masterKey];
    fetch(MNP2_API_BASE + '/book_services/' + MNP2_LOC + '?staff_id=' + staffId, {
      headers:{
        'Authorization':'Bearer ' + MNP2_API_TOKEN,
        'Accept':'application/vnd.api.v2+json',
        'Accept-Language':'de'
      }
    }).then(function(r){ return r.json(); }).then(function(data){
      var svcs = (data.data && data.data.services) ? data.data.services : [];
      var map = {};
      svcs.forEach(function(s){
        map[s.id] = {
          dur:   s.seance_length || 0,
          price: fmtPrice(s.price_min, s.price_max),
          title: s.title
        };
      });
      apiCache[masterKey] = map;
      callback(map);
    }).catch(function(){ callback({}); });
  }

  /* Строит список допов для попапа */
  function buildAddons(popupKey){
    var meta = POPUP_META[popupKey];
    if(!meta) return [];
    var masterAddons = ADDON_IDS_BY_MASTER[meta.master] || [];
    var svcAddons    = ADDON_IDS_BY_SVC[meta.svc] || [];
    // пересечение: только те допы, что есть у мастера И разрешены для услуги
    return masterAddons.filter(function(id){
      return svcAddons.indexOf(id) !== -1;
    }).map(function(id){ return ADDON_INFO[id]; }).filter(Boolean);
  }


  /* ══════════════════════════════════════════════
     STATIC POPUP TEXT DATA
  ══════════════════════════════════════════════ */
  var POPUP_STATIC = {
    // ─── NELIA ───
    n_basis:{
      badge:'Nelia · Basis',
      title:'Hygienische <em>Maniküre</em>',
      sub:'Russische Technik mit elektrischer Fräse — kein Einweichen, präzise Nagelhautpflege.',
      included:[
        'Behandlung der Nagelhaut',
        'Korrektur der Nagelform',
        'Pflege mit Öl'
      ],
      note:'Sterilisierte Instrumente. Premiummaterialien inklusive.',
      oldPrice:'30 €'
    },
    n_gel:{
      badge:'Nelia · Beliebt',
      title:'Maniküre + <em>Gel</em>',
      sub:'Russische Maniküre mit Gel-Verstärkung — bis zu 4 Wochen Haltbarkeit.',
      included:[
        'Nagelhautbehandlung',
        'Verstärkung mit Gel',
        'Gel-Lack + leichtes Design',
        'Pflege mit Öl'
      ],
      note:'3–4 Wochen Haltbarkeit. HEMA-freie Materialien.',
      oldPrice:'40 €'
    },
    n_korrektur:{
      badge:'Nelia · Korrektur',
      title:'Nagel<em>korrektur</em>',
      sub:'Entfernung des alten Materials, Neuaufbau und Gel-Lack.',
      included:[
        'Entfernung des alten Materials',
        'Nagelhautbehandlung',
        'Verstärkung / Modellierung',
        'Gel-Lack + leichtes Design',
        'Pflege mit Öl'
      ],
      note:'Sterilisierte Instrumente. Premiummaterialien inklusive.',
      oldPrice:'50 €'
    },
    n_verlaengerung:{
      badge:'Nelia · Verlänger.',
      title:'Nagel<em>verlängerung</em>',
      sub:'Verlängerung mit Gel, Modellierung, Gel-Lack.',
      included:[
        'Entfernung altes Material (falls vorhanden)',
        'Nagelhautbehandlung',
        'Verlänger. mit Gel',
        'Modellierung der Form',
        'Gel-Lack + leichtes Design',
        'Pflege mit Öl'
      ],
      note:'Endpreis nach Länge und Design. Sterilisierte Instrumente.',
      oldPrice:'85 €'
    },
    // ─── SOFIA ───
    s_basis:{
      badge:'Sofia · Basis',
      title:'Hygienische <em>Maniküre</em>',
      sub:'Russische Technik mit elektrischer Fräse — kein Einweichen, präzise Nagelhautpflege.',
      included:[
        'Behandlung der Nagelhaut',
        'Korrektur der Nagelform',
        'Pflege mit Öl'
      ],
      note:'Sterilisierte Instrumente. Premiummaterialien inklusive.',
      oldPrice:null
    },
    s_gel:{
      badge:'Sofia · Beliebt',
      title:'Maniküre + <em>Gel</em>',
      sub:'Russische Maniküre mit Gel-Verstärkung — bis zu 4 Wochen Haltbarkeit.',
      included:[
        'Nagelhautbehandlung',
        'Verstärkung mit Gel',
        'Gel-Lack + leichtes Design',
        'Pflege mit Öl'
      ],
      note:'3–4 Wochen Haltbarkeit. HEMA-freie Materialien.',
      oldPrice:null
    },
    s_korrektur:{
      badge:'Sofia · Korrektur',
      title:'Nagel<em>korrektur</em>',
      sub:'Entfernung des alten Materials, Neuaufbau und Gel-Lack.',
      included:[
        'Entfernung des alten Materials',
        'Nagelhautbehandlung',
        'Verstärkung / Modellierung',
        'Gel-Lack + leichtes Design',
        'Pflege mit Öl'
      ],
      note:'Sterilisierte Instrumente. Premiummaterialien inklusive.',
      oldPrice:null
    },
    // ─── DIANA ───
    d_basis:{
      badge:'Top-Master Diana · Basis',
      title:'Hygienische <em>Maniküre</em>',
      sub:'Sanfte, saubere Maniküre für ein gepflegtes Nagelbild.',
      included:[
        'Behandlung der Nagelhaut',
        'Korrektur der Nagelform',
        'Pflege mit Öl'
      ],
      note:'Premiummaterialien inklusive. Keine versteckten Kosten.',
      oldPrice:null
    },
    d_gel:{
      badge:'Top-Master Diana · Beliebt',
      title:'Maniküre + <em>Gel</em>',
      sub:'Erstbehandlung ohne vorhandenes Material — Verstärkung, Gel-Lack, bis 4 Wochen.',
      included:[
        'Nagelhautbehandlung',
        'Verstärkung mit Gel',
        'Gel-Lack + leichtes Design',
        'Pflege mit Öl'
      ],
      note:'HEMA-freie Materialien. 3–4 Wochen Haltbarkeit.',
      oldPrice:null
    },
    d_korrektur:{
      badge:'Top-Master Diana · Korrektur',
      title:'Nagel<em>korrektur</em>',
      sub:'Mit vorhandenem Material — Entfernung, Neuaufbau, Gel-Lack.',
      included:[
        'Entfernung des alten Materials',
        'Nagelhautbehandlung',
        'Verstärkung / Modellierung',
        'Gel-Lack + leichtes Design',
        'Pflege mit Öl'
      ],
      note:'Premiummaterialien inklusive.',
      oldPrice:null
    },
    d_verlaengerung:{
      badge:'Top-Master Diana · Verlänger.',
      title:'Nagel<em>verlängerung</em>',
      sub:'Preis abhängig von Länge und Form. Beratung kostenlos.',
      included:[
        'Entfernung altes Material (falls vorhanden)',
        'Nagelhautbehandlung',
        'Verlänger. mit Gel',
        'Modellierung der Form',
        'Gel-Lack + leichtes Design',
        'Pflege mit Öl'
      ],
      note:'Endpreis nach Länge und Design.',
      oldPrice:null
    }
  };


  /* ══════════════════════════════════════════════
     MASTER INFO DATA
  ══════════════════════════════════════════════ */
  var MASTER_INFO = {
    nelia:{
      photo:'https://static.tildacdn.com/tild3537-3733-4430-b466-336537373738/WhatsApp_Image_2026-.jpeg',
      photoClass:'mnp2-minfo-header--nelia',
      badge:'Nelia · Crocus Beauty',
      name:'',
      nameFull:'<em>Nelia</em>',
      desc:'Nelia wurde persönlich von Top-Master Diana ausgebildet und arbeitet vollständig nach deren Methoden, Standards und Qualitätsprinzipien.\n\nSie ist eine qualifizierte Fachkraft — keine Anfängerin — die nach denselben hohen Anforderungen an Hygiene, Technik und Ästhetik arbeitet. Zu ihrem Leistungsspektrum gehören Maniküre, Pediküre, Gel-Lack sowie Nagelverlängerung mit Gel.\n\nDer Unterschied liegt hauptsächlich in der Erfahrung und Geschwindigkeit — was sich in einem attraktiveren Preis widerspiegelt. Die ideale Wahl für Kundinnen, die Premium-Qualität zu einem besseren Preis-Leistungs-Verhältnis suchen.',
      facts:[
        {icon:'🎓',text:'Persönlich von Top-Master Diana ausgebildet'},
        {icon:'💎',text:'Gleiche Technik · Gleiche Standards · Gleiche Materialien'},
        {icon:'💅',text:'Nagelverlängerung mit Gel · Maniküre · Pediküre'},
        {icon:'🩺',text:'Sterilisierte Instrumente · Medizinische Hygiene'},
        {icon:'⭐',text:'5.0 · Premium-Qualität zum attraktiven Preis'}
      ]
    },
    diana:{
      photo:'https://static.tildacdn.com/tild3565-3731-4564-a536-376463363936/WhatsApp_Image_2026-.jpeg',
      photoClass:'mnp2-minfo-header--diana',
      badge:'Top-Master · Crocus Beauty',
      name:'Top-Master',
      nameFull:'<em>Diana</em>',
      desc:'Diana ist die führende Spezialistin im Crocus Beauty Studio mit über 10 Jahren Erfahrung im Bereich Nageldesign und ästhetische Kosmetik.\n\nSie ist eine Expertin, die Standards setzt — nicht ihnen folgt. Tausende zufriedene Kundinnen, perfektionierte Techniken und ein ausgeprägtes Gefühl für Form, Farbe und Stil zeichnen ihre Arbeit aus.\n\nJede Behandlung von Diana vereint perfekte Nagelarchitektur, hygienische Präzision auf medizinischem Niveau und eine Premium-Ästhetik. Sie arbeitet schnell, exakt und kompromisslos in der Qualität. Kundinnen wählen Diana, wenn sie ein Ergebnis auf höchstem Niveau erwarten — perfekt beim ersten Termin, ohne Nachbesserungen.',
      facts:[
        {icon:'🏆',text:'10+ Jahre Erfahrung im Nageldesign'},
        {icon:'✦',text:'Nagelverlängerung · Premium-Ästhetik · Komplexe Designs'},
        {icon:'🧴',text:'HEMA-freie Premiummaterialien'},
        {icon:'⭐',text:'5.0 · Perfekt beim ersten Termin, ohne Nachbesserungen'}
      ]
    },
    sofia:{
      photo:'https://cdn.jsdelivr.net/gh/chistyartem-blip/crocus-widget@9bb8504/assets/sofia.jpg',
      photoClass:'mnp2-minfo-header--sofia',
      badge:'Master · Crocus Beauty',
      name:'',
      nameFull:'<em>Sofia</em>',
      desc:'Sofia ist eine eigenständige Nagelkünstlerin im Crocus Beauty Studio — mit eigenem Stil und persönlichem Ansatz.\n\nSie arbeitet nach den hohen Standards des Studios: sterilisierte Instrumente, präzise Nagelhautpflege mit elektrischer Fräse und langlebiger Gellack. Jede Behandlung ist sorgfältig, sauber und ästhetisch.\n\nSofia ist die ideale Wahl für Kundinnen, die ein gepflegtes Ergebnis auf Studio-Niveau zu einem attraktiven Preis schätzen — mit persönlicher Betreuung und Liebe zum Detail.',
      facts:[
        {icon:'🎓',text:'Von Master Nelia persönlich empfohlen und ausgebildet'},
        {icon:'💎',text:'Gleiche Technik · Gleiche Standards · Gleiche Materialien'},
        {icon:'🩺',text:'Sterilisierte Instrumente · Medizinische Hygiene'},
        {icon:'⭐',text:'5.0 · Premium-Qualität zum attraktiven Preis'}
      ]
    }
  };


  /* ══════════════════════════════════════════════
     BUILD POPUP HTML (с данными из API)
  ══════════════════════════════════════════════ */
  function buildDetailsPopup(key, apiData){
    var st = POPUP_STATIC[key]; if(!st) return '';
    var meta = POPUP_META[key] || {};
    var svcData = (apiData && meta.svc) ? apiData[meta.svc] : null;

    var durStr   = svcData ? fmtDur(svcData.dur)   : '';
    var priceStr = svcData ? svcData.price          : '';

    // Название услуги для строки Leistungen
    var svcTitle = svcData ? svcData.title : st.title.replace(/<[^>]+>/g,'');

    var rowName = durStr ? svcTitle + ' · ' + durStr : svcTitle;

    var h = '';
    h += '<div class="mnp2-popup__badge">'+st.badge+'</div>';
    h += '<h3 class="mnp2-popup__title">'+st.title+'</h3>';
    h += '<p class="mnp2-popup__sub">'+st.sub+'</p>';
    h += '<div class="mnp2-popup__divider"></div>';

    // Leistungen
    h += '<div class="mnp2-popup__section"><div class="mnp2-popup__section-title">Leistungen</div>';
    h += '<div class="mnp2-popup__row"><span class="mnp2-popup__row-name">'+rowName+'</span><span class="mnp2-popup__row-price">';
    if(st.oldPrice && priceStr){
      h += '<span class="mnp2-popup__price-old">'+st.oldPrice+'</span><span class="mnp2-popup__price-new">'+priceStr+'</span>';
    } else if(priceStr){
      h += '<span class="mnp2-popup__price-only">'+priceStr+'</span>';
    }
    h += '</span></div></div>';

    // Enthalten
    h += '<div class="mnp2-popup__section"><div class="mnp2-popup__section-title">Enthalten</div>';
    st.included.forEach(function(item){
      h += '<div class="mnp2-popup__row"><span class="mnp2-popup__row-name">'+item+'</span><span class="mnp2-popup__row-price"><span class="mnp2-popup__price-only">✓</span></span></div>';
    });
    h += '</div>';

    // Extras & Aufpreise
    var addons = buildAddons(key);
    if(addons.length){
      h += '<div class="mnp2-popup__section"><div class="mnp2-popup__section-title">Extras & Aufpreise</div>';
      addons.forEach(function(a){
        h += '<div class="mnp2-popup__row"><span class="mnp2-popup__row-name">'+a.name+'</span><span class="mnp2-popup__row-price"><span class="mnp2-popup__price-only">'+a.price+'</span></span></div>';
      });
      h += '</div>';
    }

    if(st.note) h += '<p class="mnp2-popup__note">'+st.note+'</p>';
    h += '<button class="mnp2-popup__cta-btn" onclick="mnp2CloseDetailsPopup();crocusOpen();">';
    h += '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Jetzt buchen</button>';
    return h;
  }

  /* ══════════════════════════════════════════════
     BUILD MASTER INFO POPUP HTML
  ══════════════════════════════════════════════ */
  function buildMasterInfoPopup(key){
    var m = MASTER_INFO[key]; if(!m) return '';
    var h = '';
    h += '<div class="mnp2-minfo-header '+m.photoClass+'">';
    h += '<img src="'+m.photo+'" alt="'+m.nameFull+'" loading="lazy"/>';
    h += '<div class="mnp2-minfo-header-overlay">';
    h += '<span class="mnp2-minfo-header-badge">'+m.badge+'</span>';
    h += '<div class="mnp2-minfo-header-name">'+m.name+' '+m.nameFull+'</div>';
    h += '</div></div>';
    h += '<div class="mnp2-minfo-body">';
    m.desc.split('\n\n').forEach(function(p){
      if(p.trim()) h += '<p class="mnp2-minfo-desc" style="margin-bottom:12px;">'+p.trim()+'</p>';
    });
    h += '<div class="mnp2-minfo-facts">';
    m.facts.forEach(function(f){
      h += '<div class="mnp2-minfo-fact"><span class="mnp2-minfo-fact-icon">'+f.icon+'</span><span>'+f.text+'</span></div>';
    });
    h += '</div>';
    h += '<button class="mnp2-minfo-cta" onclick="mnp2CloseMasterInfo();crocusOpen();">';
    h += '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Termin buchen</button>';
    h += '</div>';
    return h;
  }


  /* ══════════════════════════════════════════════
     SCROLL LOCK
  ══════════════════════════════════════════════ */
  var _scrollLockEl=null,_scrollLockY=0,_scrollLockActive=false;
  function mnp2LockScroll(){
    if(_scrollLockActive) return;
    _scrollLockActive=true;
    _scrollLockY=window.scrollY||window.pageYOffset||0;
    var el=document.querySelector('.t-body')||document.querySelector('.t-records')||document.documentElement;
    _scrollLockEl=el;
    el.style.overflow='hidden';
    el.style.position='fixed';
    el.style.top='-'+_scrollLockY+'px';
    el.style.left='0';
    el.style.right='0';
    document.body.style.overflow='hidden';
  }
  function mnp2UnlockScroll(){
    if(!_scrollLockActive) return;
    _scrollLockActive=false;
    if(_scrollLockEl){
      _scrollLockEl.style.overflow='';
      _scrollLockEl.style.position='';
      _scrollLockEl.style.top='';
      _scrollLockEl.style.left='';
      _scrollLockEl.style.right='';
    }
    document.body.style.overflow='';
    window.scrollTo({top:_scrollLockY,left:0,behavior:'instant'});
  }


  /* ══════════════════════════════════════════════
     DETAILS POPUP
  ══════════════════════════════════════════════ */
  function mnp2OpenDetailsPopup(key){
    var meta = POPUP_META[key];
    var masterKey = meta ? meta.master : null;
    var contentEl = document.getElementById('mnp2-popup-content');
    var overlay   = document.getElementById('mnp2-overlay');

    // Показываем сразу с тем что есть в кэше (или без цены/времени)
    contentEl.innerHTML = buildDetailsPopup(key, masterKey ? apiCache[masterKey] : null);
    overlay.classList.add('is-open');
    mnp2LockScroll();

    // Если данных ещё нет — грузим и обновляем
    if(masterKey && !apiCache[masterKey]){
      loadMasterData(masterKey, function(data){
        if(overlay.classList.contains('is-open')){
          contentEl.innerHTML = buildDetailsPopup(key, data);
        }
      });
    }
  }
  function mnp2CloseDetailsPopup(){
    document.getElementById('mnp2-overlay').classList.remove('is-open');
    mnp2UnlockScroll();
  }
  window.mnp2CloseDetailsPopup = mnp2CloseDetailsPopup;
  document.getElementById('mnp2-close').addEventListener('click', mnp2CloseDetailsPopup);
  document.getElementById('mnp2-overlay').addEventListener('click', function(e){ if(e.target===this) mnp2CloseDetailsPopup(); });


  /* ══════════════════════════════════════════════
     MASTER INFO POPUP
  ══════════════════════════════════════════════ */
  function mnp2OpenMasterInfo(key){
    document.getElementById('mnp2-minfo-content').innerHTML = buildMasterInfoPopup(key);
    document.getElementById('mnp2-minfo-overlay').classList.add('is-open');
    mnp2LockScroll();
  }
  function mnp2CloseMasterInfo(){
    document.getElementById('mnp2-minfo-overlay').classList.remove('is-open');
    mnp2UnlockScroll();
  }
  window.mnp2OpenMasterInfo  = mnp2OpenMasterInfo;
  window.mnp2CloseMasterInfo = mnp2CloseMasterInfo;
  document.getElementById('mnp2-minfo-close').addEventListener('click', mnp2CloseMasterInfo);
  document.getElementById('mnp2-minfo-overlay').addEventListener('click', function(e){ if(e.target===this) mnp2CloseMasterInfo(); });


  /* ══════════════════════════════════════════════
     ESC
  ══════════════════════════════════════════════ */
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape'){ mnp2CloseDetailsPopup(); mnp2CloseMasterInfo(); }
  });


  /* ══════════════════════════════════════════════
     ДЕЛЕГИРОВАНИЕ КНОПОК DETAILS
  ══════════════════════════════════════════════ */
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-mnp2-popup]');
    if(btn){ mnp2OpenDetailsPopup(btn.getAttribute('data-mnp2-popup')); }
  });


  /* ══════════════════════════════════════════════
     SELECT MASTER + обновление бейджей из API
  ══════════════════════════════════════════════ */
  var currentMaster = null;

  function mnp2UpdateBadges(masterKey, apiData){
    var panel = document.getElementById('mnp2-sub-' + masterKey);
    if(!panel || !apiData) return;
    panel.querySelectorAll('[data-mnp2-popup]').forEach(function(el){
      var popKey = el.getAttribute('data-mnp2-popup');
      var meta   = POPUP_META[popKey];
      if(!meta || meta.master !== masterKey) return;
      var svcData = apiData[meta.svc];
      if(!svcData || !svcData.dur) return;
      var card = el.closest ? el.closest('.mnp2__card') : null;
      if(!card){ var n=el; while(n && !(n.className||'').match(/mnp2__card/)) n=n.parentNode; card=n; }
      if(!card) return;
      var badge = card.querySelector('.mnp2__badge');
      if(badge) badge.textContent = badge.textContent.replace(/·.*/g, '· ' + fmtDur(svcData.dur));
      var priceEl = card.querySelector('.mnp2__price');
      if(priceEl && svcData.price) priceEl.textContent = svcData.price;
    });
  }

  function mnp2SelectMaster(key){
    if(currentMaster === key) return;
    currentMaster = key;

    ['nelia','diana','sofia'].forEach(function(m){
      document.getElementById('mnp2-mc-'+m).classList.toggle('mnp2__mc-btn--active', m===key);
      document.getElementById('mnp2-sub-'+m).classList.toggle('mnp2__sub-panel--active', m===key);
    });

    document.getElementById('mnp2-placeholder').style.display = 'none';
    document.getElementById('mnp2-reveal').classList.add('mnp2__reveal--open');

    setTimeout(function(){
      var el = document.getElementById('mnp2-reveal');
      if(el){
        var rect = el.getBoundingClientRect();
        window.scrollTo({top: rect.top + (window.pageYOffset||0) - 80, behavior:'smooth'});
      }
    }, 80);

    var panel = document.getElementById('mnp2-sub-'+key);
    panel.querySelectorAll('.mnp2__card').forEach(function(c,i){
      c.classList.remove('mnp2--visible');
      setTimeout(function(){ c.classList.add('mnp2--visible'); }, i*80);
    });

    // Грузим данные из API и обновляем бейджи
    loadMasterData(key, function(data){
      mnp2UpdateBadges(key, data);
    });
  }
  window.mnp2SelectMaster = mnp2SelectMaster;


  /* ══════════════════════════════════════════════
     INTERSECTION OBSERVER
  ══════════════════════════════════════════════ */
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.querySelectorAll('.mnp2__card').forEach(function(c,i){
            setTimeout(function(){ c.classList.add('mnp2--visible'); }, i*80);
          });
          io.unobserve(entry.target);
        }
      });
    },{threshold:0.06});
    document.querySelectorAll('.mnp2--observe').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.mnp2__card').forEach(function(c){ c.classList.add('mnp2--visible'); });
  }

  // Префетч данных для всех мастеров в фоне
  ['nelia','diana','sofia'].forEach(function(m){ loadMasterData(m, function(){}); });

})();
