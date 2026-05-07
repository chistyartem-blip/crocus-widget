(function(){

  /* ══════════════════════════════════════════════
     API CONFIG
  ══════════════════════════════════════════════ */
  var TOKEN   = 'u8xzkdpkgfc73uektn64';
  var LOC     = '1357963';
  var API     = 'https://api.alteg.io/api/v1';
  var STAFF   = { diana:3020185, nelia:3020186, sofia:3020187 };

  /* Service IDs */
  var SVC = {
    basis:         13485752,
    gel:           13485753,
    korrektur:     13485754,
    verlaengerung: 13485755,
    pedi:          13485760,
    pedi_gel:      13485761,
    kombi:         13485762
  };

  /* Popup key → {master, svc} */
  var POPUP_META = {
    n_basis:        { master:'nelia', svc: SVC.basis         },
    n_gel:          { master:'nelia', svc: SVC.gel           },
    n_korrektur:    { master:'nelia', svc: SVC.korrektur     },
    n_verlaengerung:{ master:'nelia', svc: SVC.verlaengerung },
    n_pedi:         { master:'nelia', svc: SVC.pedi          },
    n_kombi:        { master:'nelia', svc: SVC.kombi         },
    s_basis:        { master:'sofia', svc: SVC.basis         },
    s_gel:          { master:'sofia', svc: SVC.gel           },
    s_korrektur:    { master:'sofia', svc: SVC.korrektur     },
    s_pedi:         { master:'sofia', svc: SVC.pedi          },
    s_kombi:        { master:'sofia', svc: SVC.kombi         },
    d_basis:        { master:'diana', svc: SVC.basis         },
    d_gel:          { master:'diana', svc: SVC.gel           },
    d_korrektur:    { master:'diana', svc: SVC.korrektur     },
    d_verlaengerung:{ master:'diana', svc: SVC.verlaengerung },
    d_pedi:         { master:'diana', svc: SVC.pedi          },
    d_kombi:        { master:'diana', svc: SVC.kombi         }
  };

  /* Addon IDs у каждого мастера (из API) */
  var ADDON_IDS_BY_MASTER = {
    diana: [13485758, 13485757, 13485756, 13502360, 13502359],
    nelia: [13485759, 13485756, 13502360, 13502359, 13502395],
    sofia: [13485759, 13485756, 13502360, 13502359, 13502395]
  };

  /* Допы разрешены только для этих услуг */
  var ADDON_SVC_WHITELIST = [SVC.gel, SVC.korrektur, SVC.verlaengerung];

  var ADDON_INFO = {
    13485756: { name:'French',           price:'+ 5 €'    },
    13485757: { name:'Babyboomer',       price:'+ 10 €'   },
    13485758: { name:'Stiletto-Form',    price:'+ 10 €'   },
    13485759: { name:'Nageldesign',      price:'+ 10 €'   },
    13502359: { name:'Gel-Lack (Farbe)', price:'+ 5 €'    },
    13502360: { name:'Design',           price:'ab + 5 €' },
    13502395: { name:'Mandel-Form',      price:'+ 5 €'    }
  };

  /* Кэш API данных: masterKey → { svcId → {dur, price} } */
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
    if(min === max || !max) return min + ' €';
    return 'ab ' + min + ' €';
  }

  function loadMasterData(masterKey, cb){
    if(apiCache[masterKey]){ cb(apiCache[masterKey]); return; }
    fetch(API + '/book_services/' + LOC + '?staff_id=' + STAFF[masterKey], {
      headers:{
        'Authorization':'Bearer ' + TOKEN,
        'Accept':'application/vnd.api.v2+json',
        'Accept-Language':'de'
      }
    }).then(function(r){ return r.json(); }).then(function(data){
      var svcs = (data.data && data.data.services) ? data.data.services : [];
      var map = {};
      svcs.forEach(function(s){
        map[s.id] = { dur: s.seance_length || 0, price: fmtPrice(s.price_min, s.price_max), title: s.title };
      });
      apiCache[masterKey] = map;
      cb(map);
    }).catch(function(){ cb({}); });
  }

  function buildAddons(popupKey){
    var meta = POPUP_META[popupKey];
    if(!meta || ADDON_SVC_WHITELIST.indexOf(meta.svc) === -1) return [];
    return (ADDON_IDS_BY_MASTER[meta.master] || [])
      .map(function(id){ return ADDON_INFO[id]; }).filter(Boolean);
  }


  /* ══════════════════════════════════════════════
     STATIC POPUP TEXT
  ══════════════════════════════════════════════ */
  var POPUP_STATIC = {
    n_basis:{
      badge:'Nelia · Basis', title:'Hygienische <em>Maniküre</em>',
      sub:'Russische Technik mit Fräse — präzise Nagelhautpflege, kein Einweichen.',
      included:['Behandlung der Nagelhaut','Korrektur der Nagelform','Pflege mit Öl'],
      note:'Premiummaterialien inklusive. Sterilisierte Instrumente.', oldPrice:'30 €'
    },
    n_gel:{
      badge:'Nelia · Beliebt', title:'Maniküre + <em>Gel-Lack</em>',
      sub:'Russische Maniküre mit Gel-Verstärkung — bis zu 4 Wochen Haltbarkeit.',
      included:['Nagelhautbehandlung','Verstärkung mit Gel','Gel-Lack + leichtes Design','Pflege mit Öl'],
      note:'3–4 Wochen Haltbarkeit. HEMA-freie Materialien.', oldPrice:'40 €'
    },
    n_korrektur:{
      badge:'Nelia · Korrektur', title:'Nagel<em>korrektur</em>',
      sub:'Entfernung des alten Materials, Neuaufbau und Gel-Lack.',
      included:['Entfernung des alten Materials','Nagelhautbehandlung','Verstärkung / Modellierung','Gel-Lack + leichtes Design','Pflege mit Öl'],
      note:'Sterilisierte Instrumente. Premiummaterialien inklusive.', oldPrice:'50 €'
    },
    n_verlaengerung:{
      badge:'Nelia · Verlänger.', title:'Nagel<em>verlängerung</em>',
      sub:'Verlängerung mit Gel, Modellierung und Gel-Lack. Preis nach Länge.',
      included:['Entfernung altes Material (falls vorhanden)','Nagelhautbehandlung','Verlänger. mit Gel','Modellierung der Form','Gel-Lack + leichtes Design','Pflege mit Öl'],
      note:'Endpreis nach Länge und Design.', oldPrice:'85 €'
    },
    n_pedi:{
      badge:'Nelia · Pediküre', title:'<em>Pediküre</em>',
      sub:'Hygienische Fußpflege mit Creme und leichter Massage.',
      included:['Nagelhautbehandlung & Formkorrektur','Reinigung der Füße','Pflege mit Creme','Leichte Massage'],
      note:'', oldPrice:null, multiRow:true,
      rows:[
        { svc: SVC.pedi,     label:'Hygienische Pediküre', oldPrice:'35 €' },
        { svc: SVC.pedi_gel, label:'Pediküre + Gel-Lack',  oldPrice:'50 €' }
      ]
    },
    n_kombi:{
      badge:'Nelia · Kombi', title:'<em>Kombi</em>behandlung',
      sub:'Maniküre + Pediküre in einem Termin — bequem und komplett.',
      included:['Nagelhaut Hände & Füße','Gel-Lack auf Hände & Füße','Creme & Massage Füße','Pflege mit Öl'],
      note:'Idealerweise mit Voranmeldung.', oldPrice:'100 €'
    },
    s_basis:{
      badge:'Sofia · Basis', title:'Hygienische <em>Maniküre</em>',
      sub:'Russische Technik mit Fräse — präzise Nagelhautpflege, kein Einweichen.',
      included:['Behandlung der Nagelhaut','Korrektur der Nagelform','Pflege mit Öl'],
      note:'Premiummaterialien inklusive. Sterilisierte Instrumente.', oldPrice:'30 €'
    },
    s_gel:{
      badge:'Sofia · Beliebt', title:'Maniküre + <em>Gel</em>',
      sub:'Russische Maniküre mit Gel-Verstärkung — bis zu 4 Wochen Haltbarkeit.',
      included:['Nagelhautbehandlung','Verstärkung mit Gel','Gel-Lack + leichtes Design','Pflege mit Öl'],
      note:'3–4 Wochen Haltbarkeit. HEMA-freie Materialien.', oldPrice:'40 €'
    },
    s_korrektur:{
      badge:'Sofia · Korrektur', title:'Nagel<em>korrektur</em>',
      sub:'Entfernung des alten Materials, Neuaufbau und Gel-Lack.',
      included:['Entfernung des alten Materials','Nagelhautbehandlung','Verstärkung / Modellierung','Gel-Lack + leichtes Design','Pflege mit Öl'],
      note:'Sterilisierte Instrumente. Premiummaterialien inklusive.', oldPrice:'50 €'
    },
    s_pedi:{
      badge:'Sofia · Pediküre', title:'<em>Pediküre</em>',
      sub:'Hygienische Fußpflege mit Creme und leichter Massage.',
      included:['Nagelhautbehandlung & Formkorrektur','Reinigung der Füße','Pflege mit Creme','Leichte Massage'],
      note:'', oldPrice:null, multiRow:true,
      rows:[
        { svc: SVC.pedi,     label:'Hygienische Pediküre', oldPrice:'35 €' },
        { svc: SVC.pedi_gel, label:'Pediküre + Gel-Lack',  oldPrice:'50 €' }
      ]
    },
    s_kombi:{
      badge:'Sofia · Kombi', title:'<em>Kombi</em>behandlung',
      sub:'Maniküre + Pediküre in einem Termin — bequem und komplett.',
      included:['Nagelhaut Hände & Füße','Gel-Lack auf Hände & Füße','Creme & Massage Füße','Pflege mit Öl'],
      note:'Idealerweise mit Voranmeldung.', oldPrice:'100 €'
    },
    d_basis:{
      badge:'Meisterin Diana · Basis', title:'Hygienische <em>Maniküre</em>',
      sub:'Sanfte, saubere Maniküre für ein gepflegtes Nagelbild.',
      included:['Behandlung der Nagelhaut','Korrektur der Nagelform','Pflege mit Öl'],
      note:'Premiummaterialien inklusive.', oldPrice:null
    },
    d_gel:{
      badge:'Meisterin Diana · Beliebt', title:'Maniküre + <em>Gel-Lack</em>',
      sub:'Erstbehandlung ohne vorhandenes Material — Verstärkung, Gel-Lack, bis 4 Wochen.',
      included:['Nagelhautbehandlung','Verstärkung mit Gel','Gel-Lack + leichtes Design','Pflege mit Öl'],
      note:'HEMA-freie Materialien. 3–4 Wochen Haltbarkeit.', oldPrice:null
    },
    d_korrektur:{
      badge:'Meisterin Diana · Korrektur', title:'Nagel<em>korrektur</em>',
      sub:'Mit vorhandenem Material — Entfernung, Neuaufbau, Gel-Lack.',
      included:['Entfernung des alten Materials','Nagelhautbehandlung','Verstärkung / Modellierung','Gel-Lack + leichtes Design','Pflege mit Öl'],
      note:'Premiummaterialien inklusive.', oldPrice:null
    },
    d_verlaengerung:{
      badge:'Meisterin Diana · Verlänger.', title:'Nagel<em>verlängerung</em>',
      sub:'Preis abhängig von Länge und Form. Beratung kostenlos.',
      included:['Entfernung altes Material (falls vorhanden)','Nagelhautbehandlung','Verlänger. mit Gel','Modellierung der Form','Gel-Lack + leichtes Design','Pflege mit Öl'],
      note:'Endpreis nach Länge und Design.', oldPrice:null
    },
    d_pedi:{
      badge:'Meisterin Diana · Pediküre', title:'<em>Pediküre</em>',
      sub:'Gründliche Fußpflege mit Creme und leichter Massage.',
      included:['Nagelhaut & Formkorrektur','Reinigung der Füße','Pflege mit Creme','Leichte Massage'],
      note:'', oldPrice:null, multiRow:true,
      rows:[
        { svc: SVC.pedi,     label:'Hygienische Pediküre', oldPrice:null },
        { svc: SVC.pedi_gel, label:'Pediküre + Gel-Lack',  oldPrice:null }
      ]
    },
    d_kombi:{
      badge:'Meisterin Diana · Kombi', title:'<em>Kombi</em>behandlung',
      sub:'Maniküre + Pediküre komplett in einem Termin.',
      included:['Nagelhaut Hände & Füße','Verstärkung & Gel-Lack Hände & Füße','Creme & Massage Füße','Leichtes Design','Pflege mit Öl'],
      note:'Bitte beim Buchen "Kombi" als Kategorie wählen.', oldPrice:null
    }
  };


  /* ══════════════════════════════════════════════
     BUILD POPUP HTML
  ══════════════════════════════════════════════ */
  function buildPopup(key, apiData){
    var st = POPUP_STATIC[key]; if(!st) return '';
    var meta = POPUP_META[key] || {};
    var svcData = (apiData && meta.svc) ? apiData[meta.svc] : null;

    var h = '';
    h += '<span class="crl2-popup__badge">'+st.badge+'</span>';
    h += '<div class="crl2-popup__title">'+st.title+'</div>';
    h += '<p class="crl2-popup__sub">'+st.sub+'</p>';

    // Leistungen
    h += '<div class="crl2-popup__section"><div class="crl2-popup__section-title">Leistungen</div>';

    if(st.multiRow && st.rows){
      // Педикюр — две строки из API
      st.rows.forEach(function(row){
        var rd = apiData ? apiData[row.svc] : null;
        var dur = rd ? fmtDur(rd.dur) : '';
        var price = rd ? rd.price : '';
        var name = (rd ? rd.title : row.label) + (dur ? ' · ' + dur : '');
        h += '<div class="crl2-popup__row"><span class="crl2-popup__row-name">'+name+'</span><span class="crl2-popup__row-price">';
        if(row.oldPrice && price){
          h += '<span class="crl2-popup__price-old">'+row.oldPrice+'</span><span class="crl2-popup__price-new">'+price+'</span>';
        } else if(price){
          h += '<span class="crl2-popup__price-only">'+price+'</span>';
        }
        h += '</span></div>';
      });
    } else {
      var dur = svcData ? fmtDur(svcData.dur) : '';
      var price = svcData ? svcData.price : '';
      var svcTitle = svcData ? svcData.title : st.title.replace(/<[^>]+>/g,'');
      var rowName = svcTitle + (dur ? ' · ' + dur : '');
      h += '<div class="crl2-popup__row"><span class="crl2-popup__row-name">'+rowName+'</span><span class="crl2-popup__row-price">';
      if(st.oldPrice && price){
        h += '<span class="crl2-popup__price-old">'+st.oldPrice+'</span><span class="crl2-popup__price-new">'+price+'</span>';
      } else if(price){
        h += '<span class="crl2-popup__price-only">'+price+'</span>';
      }
      h += '</span></div>';
    }
    h += '</div>';

    // Enthalten
    h += '<div class="crl2-popup__section"><div class="crl2-popup__section-title">Enthalten</div>';
    st.included.forEach(function(item){
      h += '<div class="crl2-popup__row"><span class="crl2-popup__row-name">'+item+'</span><span class="crl2-popup__row-price"><span class="crl2-popup__price-only">✓</span></span></div>';
    });
    h += '</div>';

    // Extras
    var addons = buildAddons(key);
    if(addons.length){
      h += '<div class="crl2-popup__section"><div class="crl2-popup__section-title">Extras & Aufpreise</div>';
      addons.forEach(function(a){
        h += '<div class="crl2-popup__row"><span class="crl2-popup__row-name">'+a.name+'</span><span class="crl2-popup__row-price"><span class="crl2-popup__price-only">'+a.price+'</span></span></div>';
      });
      h += '</div>';
    }

    if(st.note) h += '<p class="crl2-popup__note">'+st.note+'</p>';
    h += '<button class="crl2-popup__cta-btn" onclick="this.closest(\'.crl2-overlay\').classList.remove(\'crl2-open\');document.body.style.overflow=\'\';crocusOpen();">';
    h += '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Jetzt Termin buchen</button>';
    return h;
  }


  /* ══════════════════════════════════════════════
     POPUP OPEN/CLOSE
  ══════════════════════════════════════════════ */
  var overlay = document.getElementById('crl2-overlay');
  var content = document.getElementById('crl2-popup-content');

  document.getElementById('crl2-close').addEventListener('click', function(){
    overlay.classList.remove('crl2-open'); document.body.style.overflow='';
  });
  overlay.addEventListener('click', function(e){
    if(e.target===overlay){ overlay.classList.remove('crl2-open'); document.body.style.overflow=''; }
  });
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape'){ overlay.classList.remove('crl2-open'); document.body.style.overflow=''; }
  });

  function openPopup(key){
    var meta = POPUP_META[key];
    var masterKey = meta ? meta.master : null;
    // Рендерим сразу (с кэшем если есть)
    content.innerHTML = buildPopup(key, masterKey ? apiCache[masterKey] : null);
    overlay.classList.add('crl2-open');
    document.body.style.overflow = 'hidden';
    document.getElementById('crl2-popup').scrollTop = 0;
    // Если кэша нет — грузим и обновляем
    if(masterKey && !apiCache[masterKey]){
      loadMasterData(masterKey, function(data){
        if(overlay.classList.contains('crl2-open')){
          content.innerHTML = buildPopup(key, data);
        }
      });
    }
  }

  document.querySelectorAll('[data-crl2-popup]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      openPopup(btn.getAttribute('data-crl2-popup'));
    });
  });


  /* ══════════════════════════════════════════════
     UPDATE BADGES/PRICES IN CARDS FROM API
  ══════════════════════════════════════════════ */
  function updatePanelFromApi(masterKey, apiData){
    var panel = document.getElementById('crl2-sub-' + masterKey);
    if(!panel || !apiData) return;

    // Обновляем бейджи (время)
    panel.querySelectorAll('[data-crl2-popup]').forEach(function(el){
      var popKey = el.getAttribute('data-crl2-popup');
      var meta = POPUP_META[popKey];
      if(!meta || meta.master !== masterKey) return;
      var svcData = apiData[meta.svc];
      if(!svcData || !svcData.dur) return;
      var card = el.closest ? el.closest('.crl2__card') : null;
      if(!card) return;
      var badge = card.querySelector('.crl2__badge');
      if(badge) badge.textContent = badge.textContent.replace(/·.*/g, '· ' + fmtDur(svcData.dur));
      // Обновляем цену в карточке
      var priceNew = card.querySelector('.crl2__price-new');
      var priceOnly = card.querySelector('.crl2__price-only');
      if(svcData.price){
        if(priceNew) priceNew.textContent = svcData.price;
        else if(priceOnly) priceOnly.textContent = svcData.price;
      }
    });

    // Для Pediküre карточек — обновляем обе строки
    ['n_pedi','s_pedi','d_pedi'].forEach(function(pk){
      var meta = POPUP_META[pk];
      if(!meta || meta.master !== masterKey) return;
      var panel = document.getElementById('crl2-sub-' + masterKey);
      if(!panel) return;
      var card = panel.querySelector('[data-crl2-popup="'+pk+'"]');
      if(!card) card = panel.querySelector('[data-crl2-popup="'+pk+'"]');
      // Найдём карточку
      var cardEl = null;
      panel.querySelectorAll('.crl2__card').forEach(function(c){
        if(c.querySelector('[data-crl2-popup="'+pk+'"]')) cardEl = c;
      });
      if(!cardEl) return;
      var rows = cardEl.querySelectorAll('.crl2__price-row');
      var svcPedi = apiData[SVC.pedi];
      var svcPediGel = apiData[SVC.pedi_gel];
      if(rows[0] && svcPedi){
        var pNew = rows[0].querySelector('.crl2__price-new');
        var pOnly = rows[0].querySelector('.crl2__price-only');
        if(pNew) pNew.textContent = svcPedi.price;
        else if(pOnly) pOnly.textContent = svcPedi.price;
      }
      if(rows[1] && svcPediGel){
        var pNew2 = rows[1].querySelector('.crl2__price-new');
        var pOnly2 = rows[1].querySelector('.crl2__price-only');
        if(pNew2) pNew2.textContent = svcPediGel.price;
        else if(pOnly2) pOnly2.textContent = svcPediGel.price;
      }
    });
  }


  /* ══════════════════════════════════════════════
     MAIN TAB SWITCHING
  ══════════════════════════════════════════════ */
  function crl2SwitchToWimpern(){
    document.querySelectorAll('[data-crl2-main]').forEach(function(t){
      var isW = t.getAttribute('data-crl2-main')==='wimpern';
      t.classList.toggle('crl2__main-tab--active', isW);
      t.setAttribute('aria-selected', isW ? 'true' : 'false');
    });
    document.querySelectorAll('.crl2__main-panel').forEach(function(p){
      p.classList.toggle('crl2__main-panel--active', p.id==='crl2-panel-wimpern');
    });
    document.querySelectorAll('.crl2__mc-card--mani').forEach(function(c){ c.style.display='none'; });
    document.querySelectorAll('.crl2__mc-card--wimpern').forEach(function(c){ c.style.display=''; });
    document.querySelectorAll('.crl2__mc-grid').forEach(function(g){ g.classList.add('crl2__mc-grid--single'); });
    setTimeout(function(){
      var panel = document.getElementById('crl2-panel-wimpern');
      if(panel){ var y = panel.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({top:y,behavior:'smooth'}); }
    }, 60);
  }

  function crl2UpdateTippenBadge(){
    var badge = document.getElementById('crl2-tippen-badge'); if(!badge) return;
    var inactive = document.querySelector('[data-crl2-main]:not(.crl2__main-tab--active)');
    if(!inactive){ badge.style.opacity='0'; return; }
    var tabsRect = inactive.parentElement.getBoundingClientRect();
    var tabRect  = inactive.getBoundingClientRect();
    badge.style.left = ((tabRect.left - tabsRect.left) + tabRect.width/2) + 'px';
    badge.style.opacity = '1';
  }
  crl2UpdateTippenBadge();
  window.addEventListener('resize', crl2UpdateTippenBadge);

  var crl2Badge = document.getElementById('crl2-tippen-badge');
  if(crl2Badge){ crl2Badge.addEventListener('click', function(){ var i=document.querySelector('[data-crl2-main]:not(.crl2__main-tab--active)'); if(i) i.click(); }); }

  document.querySelectorAll('[data-crl2-main]').forEach(function(tab){
    tab.addEventListener('click', function(){
      var key = tab.getAttribute('data-crl2-main');
      var isW = key==='wimpern';
      document.querySelectorAll('.crl2__mc-card--mani').forEach(function(c){ c.style.display=isW?'none':''; });
      document.querySelectorAll('.crl2__mc-card--wimpern').forEach(function(c){ c.style.display=isW?'':'none'; });
      document.querySelectorAll('.crl2__mc-grid').forEach(function(g){ g.classList.toggle('crl2__mc-grid--single',isW); });
      setTimeout(crl2UpdateTippenBadge, 50);
    });
  });

  var karinaCard = document.querySelector('[data-crl2-master="karina"]');
  if(karinaCard){
    karinaCard.addEventListener('click', function(e){ if(e.target.closest('[data-crl2-hint],[data-crl2-about]')) return; crl2SwitchToWimpern(); });
  }
  var karinaHintBtn = document.querySelector('[data-crl2-hint="karina"]');
  if(karinaHintBtn){ karinaHintBtn.addEventListener('click', function(e){ e.stopPropagation(); crl2SwitchToWimpern(); }); }


  /* ══════════════════════════════════════════════
     MASTER CARD SELECT → REVEAL + API UPDATE
  ══════════════════════════════════════════════ */
  var currentRevealMaster = null;
  var crl2Reveal = document.getElementById('crl2-reveal');

  function crl2SelectMaster(masterKey){
    if(currentRevealMaster === masterKey){
      // Второй клик — закрыть
      crl2Reveal.classList.remove('crl2__reveal--open');
      document.querySelectorAll('[data-crl2-master]').forEach(function(c){ c.classList.remove('crl2__mc-btn--active'); });
      currentRevealMaster = null;
      return;
    }
    currentRevealMaster = masterKey;

    // Активируем карточку
    document.querySelectorAll('[data-crl2-master]').forEach(function(c){
      c.classList.toggle('crl2__mc-btn--active', c.getAttribute('data-crl2-master')===masterKey);
    });

    // Показываем нужную панель
    document.querySelectorAll('.crl2__sub-panel').forEach(function(p){ p.classList.remove('crl2__sub-panel--active'); });
    var panel = document.getElementById('crl2-sub-' + masterKey);
    if(panel) panel.classList.add('crl2__sub-panel--active');

    // Открываем reveal
    crl2Reveal.classList.add('crl2__reveal--open');

    // Скролл
    setTimeout(function(){
      var el = document.getElementById('crl2-reveal');
      if(el){ var y = el.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({top:y,behavior:'smooth'}); }
    }, 80);

    // Hint
    crl2ShowSvcHint(masterKey);

    // Анимация карточек
    if(panel){ panel.querySelectorAll('.crl2__card').forEach(function(c,i){ c.classList.remove('crl2--visible'); setTimeout(function(){ c.classList.add('crl2--visible'); }, i*80); }); }

    // Грузим API и обновляем бейджи
    loadMasterData(masterKey, function(data){ updatePanelFromApi(masterKey, data); });
  }

  // Вешаем клик на кнопки "Preise ansehen"
  document.querySelectorAll('[data-crl2-hint]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var master = btn.getAttribute('data-crl2-hint');
      if(master && master !== 'karina') crl2SelectMaster(master);
    });
  });

  // Клик по карточке мастера (не по кнопкам)
  document.querySelectorAll('[data-crl2-master]').forEach(function(card){
    card.addEventListener('click', function(e){
      if(e.target.closest('[data-crl2-hint],[data-crl2-about]')) return;
      var master = card.getAttribute('data-crl2-master');
      if(master && master !== 'karina') crl2SelectMaster(master);
    });
  });


  /* ══════════════════════════════════════════════
     HINTS
  ══════════════════════════════════════════════ */
  function crl2DismissHint(hintId, storageKey){
    var el = document.getElementById(hintId);
    if(!el || el.classList.contains('crl2--gone')) return;
    el.classList.add('crl2--gone');
    setTimeout(function(){ el.style.display='none'; }, 450);
    if(storageKey) sessionStorage.setItem(storageKey, '1');
  }

  var hintMaster = document.getElementById('crl2-tap-hint');
  if(sessionStorage.getItem('crl2_hint_master')){ if(hintMaster) hintMaster.style.display='none'; }
  else{
    setTimeout(function(){ document.querySelectorAll('.crl2__mc-prices-btn').forEach(function(b){ b.classList.add('crl2--attention'); }); }, 900);
    document.querySelectorAll('.crl2__mc-btn,[data-crl2-hint],[data-crl2-about]').forEach(function(el){
      el.addEventListener('click', function(){
        crl2DismissHint('crl2-tap-hint','crl2_hint_master');
        document.querySelectorAll('.crl2__mc-prices-btn').forEach(function(b){ b.classList.remove('crl2--attention'); });
      }, {once:true});
    });
  }

  function crl2ShowSvcHint(masterId){
    var hintId = 'crl2-svc-hint-' + masterId;
    var el = document.getElementById(hintId); if(!el) return;
    if(sessionStorage.getItem('crl2_hint_svc_' + masterId)){ el.style.display='none'; return; }
    el.style.display=''; el.classList.remove('crl2--gone');
    var panel = document.getElementById('crl2-sub-' + masterId);
    if(panel){ panel.querySelectorAll('.crl2__btn-primary').forEach(function(b){ b.classList.remove('crl2--attention'); void b.offsetWidth; b.classList.add('crl2--attention'); }); }
    if(panel){ panel.querySelectorAll('[data-crl2-popup],.crl2__btn-primary,.crl2__btn-secondary').forEach(function(b){
      b.addEventListener('click', function(){
        crl2DismissHint(hintId,'crl2_hint_svc_' + masterId);
        if(panel) panel.querySelectorAll('.crl2__btn-primary').forEach(function(x){ x.classList.remove('crl2--attention'); });
      }, {once:true});
    }); }
  }


  /* ══════════════════════════════════════════════
     INTERSECTION OBSERVER
  ══════════════════════════════════════════════ */
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.querySelectorAll('.crl2__card,.crl2__wt-card').forEach(function(c,i){ setTimeout(function(){ c.classList.add('crl2--visible'); }, i*80); });
          io.unobserve(entry.target);
        }
      });
    },{threshold:0.08});
    document.querySelectorAll('.crl2--observe').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.crl2__card,.crl2__wt-card').forEach(function(c){ c.classList.add('crl2--visible'); });
  }

  // Префетч API для всех мастеров
  ['nelia','sofia','diana'].forEach(function(m){ loadMasterData(m, function(){}); });

})();


/* ══════════════════════════════════════════════
   SCROLL LOCK
══════════════════════════════════════════════ */
(function(){
  var _scrollY=0;
  function lockScroll(){ _scrollY=window.scrollY||window.pageYOffset; document.body.style.overflow='hidden'; document.documentElement.style.overflow='hidden'; }
  function unlockScroll(){ if(!document.querySelector('.crl2-overlay.crl2-open')){ document.body.style.overflow=''; document.documentElement.style.overflow=''; } }
  var mo = new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      if(m.attributeName==='class'){ if(m.target.classList.contains('crl2-open')) lockScroll(); else unlockScroll(); }
    });
  });
  document.querySelectorAll('.crl2-overlay').forEach(function(el){ mo.observe(el,{attributes:true}); });
  document.querySelectorAll('[data-crl2-minfo-close]').forEach(function(btn){
    btn.addEventListener('click',function(){ var ov=document.getElementById('crl2-minfo-overlay'); if(ov) ov.classList.remove('crl2-open'); unlockScroll(); });
  });
  var minfoOv=document.getElementById('crl2-minfo-overlay');
  if(minfoOv){ minfoOv.addEventListener('click',function(e){ if(e.target===minfoOv){ minfoOv.classList.remove('crl2-open'); unlockScroll(); } }); }
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ document.querySelectorAll('.crl2-overlay.crl2-open').forEach(function(ov){ ov.classList.remove('crl2-open'); }); unlockScroll(); } });
})();
