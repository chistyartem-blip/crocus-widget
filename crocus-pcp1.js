(function(){

  /* ── API CONFIG ── */
  var PCP1_API_TOKEN = 'u8xzkdpkgfc73uektn64';
  var PCP1_LOC       = '1357963';
  var PCP1_API_BASE  = 'https://api.alteg.io/api/v1';

  /* Staff IDs */
  var STAFF = { diana:3020185, nelia:3020186, sofia:3020187 };

  /* Service IDs педикюра */
  var SVC = {
    hyg:   13485760,  // Hygienische Pediküre
    gel:   13485761,  // Pediküre + Gellack
    kombi: 13485762   // Maniküre + Pediküre (Kombi)
  };

  /* Popup key → {master, svc} */
  var POPUP_META = {
    n_hyg:   { master:'nelia', svc: SVC.hyg   },
    n_gel:   { master:'nelia', svc: SVC.gel   },
    n_kombi: { master:'nelia', svc: SVC.kombi },
    s_hyg:   { master:'sofia', svc: SVC.hyg   },
    s_gel:   { master:'sofia', svc: SVC.gel   },
    s_kombi: { master:'sofia', svc: SVC.kombi },
    d_hyg:   { master:'diana', svc: SVC.hyg   },
    d_gel:   { master:'diana', svc: SVC.gel   },
    d_kombi: { master:'diana', svc: SVC.kombi }
  };

  /* Кэш API данных */
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
    fetch(PCP1_API_BASE + '/book_services/' + PCP1_LOC + '?staff_id=' + staffId, {
      headers:{
        'Authorization':'Bearer ' + PCP1_API_TOKEN,
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

  /* Обновление длительности и цен на карточках из API */
  function updateCardBadges(masterKey, apiData){
    if(!apiData) return;
    var badgeDefaults = {
      hyg:   'Basis',
      gel:   'Beliebt',
      kombi: 'Kombi'
    };
    ['hyg','gel','kombi'].forEach(function(svcKey){
      var prefix = masterKey.charAt(0); // n / s / d
      var popKey = prefix + '_' + svcKey;
      var svcId  = SVC[svcKey];
      var svcData = apiData[svcId];
      if(!svcData) return;

      // Badge: "Basis · 30 Min."
      var badgeEl = document.getElementById('pcp1-badge-' + popKey);
      if(badgeEl && svcData.dur){
        badgeEl.textContent = badgeDefaults[svcKey] + ' · ' + fmtDur(svcData.dur);
      }

      // Цена (только если изменилась от дефолта)
      var priceEl = document.getElementById('pcp1-price-' + popKey);
      if(priceEl && svcData.price){
        priceEl.textContent = svcData.price;
      }
    });
  }

  /* ── STATIC POPUP DATA ── */
  var POPUP_STATIC = {
    n_hyg:{
      badge:'Nelia · Basis',
      title:'Hygienische <em>Pediküre</em>',
      sub:'Präzise Fußpflege mit sterilisierten Instrumenten — sauber, entspannend, nachhaltig.',
      included:['Behandlung der Nagelhaut','Formkorrektur der Nägel','Pflege mit Creme','Leichte Massage'],
      oldPrice:'35 €', fallbackPrice:'30 €',
      note:'Sterilisierte Instrumente. Aktionspreis gültig bis auf Weiteres.'
    },
    n_gel:{
      badge:'Nelia · Beliebt',
      title:'Pediküre + <em>Gel-Lack</em>',
      sub:'Hygienische Pediküre mit Gel-Beschichtung — bis zu 4 Wochen Haltbarkeit.',
      included:['Nagelhautbehandlung & Formkorrektur','Pflege mit Creme','Gel-Lack Auftrag','UV-Härtung'],
      extras:[{name:'French auf Füßen',price:'+ 5 €'}],
      oldPrice:'50 €', fallbackPrice:'40 €',
      note:'HEMA-freie Materialien. 3–4 Wochen Haltbarkeit.'
    },
    n_kombi:{
      badge:'Nelia · Kombi',
      title:'<em>Kombi</em>behandlung',
      sub:'Maniküre + Pediküre in einem Termin — Hände und Füße komplett gepflegt.',
      included:['Nagelhaut Hände & Füße','Gel-Lack Hände & Füße','Creme & Massage Füße','Pflege mit Öl'],
      oldPrice:'100 €', fallbackPrice:'80 €',
      note:'Idealerweise mit Voranmeldung buchen.'
    },
    s_hyg:{
      badge:'Sofia · Basis',
      title:'Hygienische <em>Pediküre</em>',
      sub:'Präzise Fußpflege mit sterilisierten Instrumenten — sauber, entspannend, nachhaltig.',
      included:['Behandlung der Nagelhaut','Formkorrektur der Nägel','Pflege mit Creme','Leichte Massage'],
      oldPrice:'35 €', fallbackPrice:'30 €',
      note:'Sterilisierte Instrumente. Aktionspreis gültig bis auf Weiteres.'
    },
    s_gel:{
      badge:'Sofia · Beliebt',
      title:'Pediküre + <em>Gel-Lack</em>',
      sub:'Hygienische Pediküre mit Gel-Beschichtung — bis zu 4 Wochen Haltbarkeit.',
      included:['Nagelhautbehandlung & Formkorrektur','Pflege mit Creme','Gel-Lack Auftrag','UV-Härtung'],
      extras:[{name:'French auf Füßen',price:'+ 5 €'}],
      oldPrice:'50 €', fallbackPrice:'40 €',
      note:'HEMA-freie Materialien. 3–4 Wochen Haltbarkeit.'
    },
    s_kombi:{
      badge:'Sofia · Kombi',
      title:'<em>Kombi</em>behandlung',
      sub:'Maniküre + Pediküre in einem Termin — Hände und Füße komplett gepflegt.',
      included:['Nagelhaut Hände & Füße','Gel-Lack Hände & Füße','Creme & Massage Füße','Pflege mit Öl'],
      oldPrice:'100 €', fallbackPrice:'80 €',
      note:'Idealerweise mit Voranmeldung buchen.'
    },
    d_hyg:{
      badge:'Meisterin Diana · Basis',
      title:'Hygienische <em>Pediküre</em>',
      sub:'Premium-Fußpflege mit über 10 Jahren Erfahrung — gründlich, steril, entspannend.',
      included:['Behandlung der Nagelhaut','Formkorrektur der Nägel','Pflege mit Creme','Leichte Massage'],
      oldPrice:null, fallbackPrice:'40 €',
      note:'Premiummaterialien inklusive. Sterilisierte Instrumente.'
    },
    d_gel:{
      badge:'Meisterin Diana · Beliebt',
      title:'Pediküre + <em>Gel-Lack</em>',
      sub:'Premium-Pediküre mit Gel-Beschichtung bei Top-Meisterin Diana.',
      included:['Nagelhautbehandlung & Formkorrektur','Pflege mit Creme','Gel-Lack Auftrag','UV-Härtung'],
      extras:[{name:'French auf Füßen',price:'+ 5 €'}],
      oldPrice:null, fallbackPrice:'55 €',
      note:'HEMA-freie Materialien. 3–4 Wochen Haltbarkeit.'
    },
    d_kombi:{
      badge:'Meisterin Diana · Kombi',
      title:'<em>Kombi</em>behandlung',
      sub:'Maniküre + Pediküre komplett in einem Termin bei Meisterin Diana.',
      included:['Nagelhaut Hände & Füße','Verstärkung & Gel-Lack Hände & Füße','Creme & Massage Füße','Leichtes Design','Pflege mit Öl'],
      oldPrice:null, fallbackPrice:'100 €',
      note:'Bitte beim Buchen "Kombi" als Kategorie wählen.'
    }
  };

  /* ── MASTER INFO DATA ── */
  var MASTERS = {
    nelia:{
      badge:'Master · Schülerin von Diana',
      name:'<em>Nelia</em>',
      avatar:'https://static.tildacdn.net/tild3537-3733-4430-b466-336537373738/WhatsApp_Image_2026-.jpeg',
      role:'Master-Spezialistin · Crocus Beauty',
      bio:'Die Master-Spezialistin im Studio wurde persönlich von Diana ausgebildet und arbeitet vollständig nach ihren Methoden, Standards und Qualitätsprinzipien.\n\nEs handelt sich nicht um eine „Anfängerin", sondern um eine qualifizierte Fachkraft, die nach denselben hohen Anforderungen an Hygiene, Technik und Ästhetik arbeitet wie der Top-Master.\n\nJede Behandlung erfolgt nach den Standards von Crocus Beauty Studio: präzise Technik, saubere und sorgfältige Arbeit, perfekte Nagelarchitektur, modernes Design.\n\nDer Unterschied liegt hauptsächlich in der Erfahrung und Geschwindigkeit — was sich in einem attraktiveren Preis widerspiegelt. Die ideale Wahl für Kundinnen, die Premium-Qualität zu einem besseren Preis-Leistungs-Verhältnis suchen.',
      tags:['Pediküre','Gel-Lack','Maniküre','Aktionspreise','Diana-Methode'],
      stats:[{val:'5.0★',lbl:'Bewertung'},{val:'100%',lbl:'Steril'},{val:'4 W.',lbl:'Haltbarkeit'}]
    },
    sofia:{
      badge:'Master · Crocus Beauty',
      name:'<em>Sofia</em>',
      avatar:'https://cdn.jsdelivr.net/gh/chistyartem-blip/crocus-widget@94db95b/assets/sofia.jpg',
      role:'Master-Spezialistin · Crocus Beauty',
      bio:'Sofia ist eine eigenständige Nagelkünstlerin im Crocus Beauty Studio — mit eigenem Stil und persönlichem Ansatz.\n\nSie arbeitet nach den hohen Standards des Studios: sterilisierte Instrumente, präzise Nagelhautpflege mit elektrischer Fräse und langlebiger Gel-Lack. Jede Behandlung ist sorgfältig, sauber und ästhetisch.\n\nSofia ist die ideale Wahl für Kundinnen, die ein gepflegtes Ergebnis auf Studio-Niveau zu einem attraktiven Preis schätzen — mit persönlicher Betreuung und Liebe zum Detail.',
      tags:['Pediküre','Gel-Lack','Maniküre','Aktionspreise'],
      stats:[{val:'5.0★',lbl:'Bewertung'},{val:'100%',lbl:'Steril'},{val:'4 W.',lbl:'Haltbarkeit'}]
    },
    diana:{
      badge:'💎 Top-Master · 10+ Jahre',
      name:'<em>Diana</em>',
      avatar:'https://static.tildacdn.net/tild3565-3731-4564-a536-376463363936/WhatsApp_Image_2026-.jpeg',
      role:'Führende Spezialistin · Crocus Beauty',
      bio:'Diana ist die führende Spezialistin im Crocus Beauty Studio mit über 10 Jahren Erfahrung im Bereich Nageldesign und ästhetische Kosmetik.\n\nSie ist eine Expertin, die Standards setzt – nicht ihnen folgt. Tausende zufriedene Kundinnen, perfektionierte Techniken und ein ausgeprägtes Gefühl für Form, Farbe und Stil zeichnen ihre Arbeit aus.\n\nJede Behandlung vereint perfekte Nagelarchitektur, hygienische Präzision auf medizinischem Niveau und eine Premium-Ästhetik. Sie arbeitet schnell, exakt und kompromisslos in der Qualität.\n\nKundinnen wählen Diana, wenn sie ein Ergebnis auf höchstem Niveau erwarten – perfekt beim ersten Termin, ohne Nachbesserungen.',
      tags:['Pediküre','Gel-Lack','Kombi','Premium','10+ Jahre'],
      stats:[{val:'5.0★',lbl:'Bewertung'},{val:'10+',lbl:'Jahre'},{val:'100%',lbl:'Steril'}]
    }
  };

  /* ── BUILD POPUP HTML ── */
  function buildPopup(key, apiData){
    var st = POPUP_STATIC[key]; if(!st) return '';
    var meta = POPUP_META[key] || {};
    var svcData = (apiData && meta.svc) ? apiData[meta.svc] : null;

    var durStr   = svcData ? fmtDur(svcData.dur) : '';
    var priceStr = (svcData && svcData.price) ? svcData.price : st.fallbackPrice;
    var svcTitle = (svcData && svcData.title) ? svcData.title : st.title.replace(/<[^>]+>/g,'');
    var rowName  = durStr ? svcTitle + ' · ' + durStr : svcTitle;

    var h = '';
    h += '<span class="pcp1-popup__badge">'+st.badge+'</span>';
    h += '<div class="pcp1-popup__title">'+st.title+'</div>';
    h += '<p class="pcp1-popup__sub">'+st.sub+'</p>';

    // Leistungen
    h += '<div class="pcp1-popup__section"><div class="pcp1-popup__section-title">Leistungen</div>';
    h += '<div class="pcp1-popup__row"><span class="pcp1-popup__row-name">'+rowName+'</span><span class="pcp1-popup__row-price">';
    if(st.oldPrice && priceStr){
      h += '<span class="pcp1-popup__price-old">'+st.oldPrice+'</span><span class="pcp1-popup__price-new">'+priceStr+'</span>';
    } else {
      h += '<span class="pcp1-popup__price-only">'+priceStr+'</span>';
    }
    h += '</span></div></div>';

    // Enthalten
    h += '<div class="pcp1-popup__section"><div class="pcp1-popup__section-title">Enthalten</div>';
    st.included.forEach(function(item){
      h += '<div class="pcp1-popup__row"><span class="pcp1-popup__row-name">'+item+'</span><span class="pcp1-popup__row-price"><span class="pcp1-popup__price-only">✓</span></span></div>';
    });
    h += '</div>';

    // Extras
    if(st.extras && st.extras.length){
      h += '<div class="pcp1-popup__section"><div class="pcp1-popup__section-title">Extras & Aufpreise</div>';
      st.extras.forEach(function(e){
        h += '<div class="pcp1-popup__row"><span class="pcp1-popup__row-name">'+e.name+'</span><span class="pcp1-popup__row-price"><span class="pcp1-popup__price-only">'+e.price+'</span></span></div>';
      });
      h += '</div>';
    }

    if(st.note) h += '<p class="pcp1-popup__note">'+st.note+'</p>';
    h += '<button class="pcp1-popup__cta-btn" onclick="document.getElementById(\'pcp1-overlay\').classList.remove(\'pcp1-open\');document.body.style.overflow=\'\';crocusOpen();">';
    h += '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Jetzt Termin buchen</button>';
    return h;
  }

  /* ── BUILD MINFO HTML ── */
  function buildMinfo(key){
    var m = MASTERS[key]; if(!m) return '';
    var h = '';
    h += '<div style="width:100%;height:340px;overflow:hidden;border-radius:22px 22px 0 0;flex-shrink:0;">';
    h += '<img src="'+m.avatar+'" style="width:100%;height:100%;object-fit:cover;object-position:center '+(key==='sofia'?'20%':'15%')+';display:block;" alt="'+key+'"/>';
    h += '</div>';
    h += '<div class="pcp1-popup-inner" style="padding-top:22px;">';
    h += '<span style="font-family:\'DM Sans\',Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(196,168,216,0.80);display:block;margin-bottom:6px;">'+m.badge+'</span>';
    h += '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:34px;font-weight:300;color:#fff;line-height:1;letter-spacing:-0.02em;margin-bottom:5px;">'+m.name+'</div>';
    h += '<div style="font-family:\'DM Sans\',Arial,sans-serif;font-size:11px;color:rgba(220,200,255,0.55);margin-bottom:20px;">'+m.role+'</div>';
    h += '<div style="display:flex;gap:10px;margin-bottom:18px;">';
    m.stats.forEach(function(s){
      h += '<div style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(196,168,216,0.12);border-radius:12px;padding:10px;text-align:center;">';
      h += '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:20px;font-weight:300;color:#c4a8d8;">'+s.val+'</div>';
      h += '<div style="font-family:\'DM Sans\',Arial,sans-serif;font-size:9px;color:rgba(220,200,255,0.45);margin-top:2px;letter-spacing:0.05em;">'+s.lbl+'</div>';
      h += '</div>';
    });
    h += '</div>';
    h += '<p style="font-family:\'DM Sans\',Arial,sans-serif;font-size:13px;color:rgba(220,200,255,0.68);line-height:1.72;margin-bottom:18px;">'+m.bio.replace(/\n\n/g,'<br><br>')+'</p>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:24px;">';
    m.tags.forEach(function(t){
      h += '<span style="font-family:\'DM Sans\',Arial,sans-serif;font-size:9px;font-weight:600;color:rgba(196,168,216,0.80);background:rgba(196,168,216,0.10);border:1px solid rgba(196,168,216,0.20);border-radius:50px;padding:3px 10px;">'+t+'</span>';
    });
    h += '</div>';
    h += '<button class="pcp1-popup__cta-btn" onclick="document.getElementById(\'pcp1-minfo-overlay\').classList.remove(\'pcp1-open\');document.body.style.overflow=\'\';crocusOpen();">';
    h += '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
    h += 'Termin bei '+key.charAt(0).toUpperCase()+key.slice(1)+' buchen</button>';
    h += '</div>';
    return h;
  }

  /* ── POPUP OPEN/CLOSE ── */
  var overlay = document.getElementById('pcp1-overlay');
  var popupContent = document.getElementById('pcp1-popup-content');

  function pcp1OpenPopup(key){
    var meta = POPUP_META[key];
    var masterKey = meta ? meta.master : null;
    popupContent.innerHTML = buildPopup(key, masterKey ? apiCache[masterKey] : null);
    overlay.classList.add('pcp1-open');
    document.body.style.overflow = 'hidden';
    document.getElementById('pcp1-popup').scrollTop = 0;
    // Дозагрузка из API если нет кэша
    if(masterKey && !apiCache[masterKey]){
      loadMasterData(masterKey, function(data){
        if(overlay.classList.contains('pcp1-open')){
          popupContent.innerHTML = buildPopup(key, data);
        }
      });
    }
  }

  document.getElementById('pcp1-close').addEventListener('click', function(){
    overlay.classList.remove('pcp1-open'); document.body.style.overflow = '';
  });
  overlay.addEventListener('click', function(e){
    if(e.target === overlay){ overlay.classList.remove('pcp1-open'); document.body.style.overflow = ''; }
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){ overlay.classList.remove('pcp1-open'); minfoOverlay.classList.remove('pcp1-open'); document.body.style.overflow = ''; }
  });
  document.querySelectorAll('[data-pcp1-popup]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      pcp1OpenPopup(btn.getAttribute('data-pcp1-popup'));
    });
  });

  /* ── MINFO POPUP ── */
  var minfoOverlay = document.getElementById('pcp1-minfo-overlay');
  var minfoContent = document.getElementById('pcp1-minfo-content');

  document.getElementById('pcp1-minfo-close').addEventListener('click', function(){
    minfoOverlay.classList.remove('pcp1-open'); document.body.style.overflow = '';
  });
  minfoOverlay.addEventListener('click', function(e){
    if(e.target === minfoOverlay){ minfoOverlay.classList.remove('pcp1-open'); document.body.style.overflow = ''; }
  });
  document.querySelectorAll('[data-pcp1-about]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      minfoContent.innerHTML = buildMinfo(btn.getAttribute('data-pcp1-about'));
      minfoOverlay.classList.add('pcp1-open');
      document.body.style.overflow = 'hidden';
      document.getElementById('pcp1-minfo-popup').scrollTop = 0;
    });
  });

  /* ── MASTER CARD SELECTION + REVEAL ── */
  var reveal = document.getElementById('pcp1-reveal');
  var subNelia = document.getElementById('pcp1-sub-nelia');
  var subSofia = document.getElementById('pcp1-sub-sofia');
  var subDiana = document.getElementById('pcp1-sub-diana');
  var activeMaster = null;

  document.querySelectorAll('[data-pcp1-hint]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var master = btn.getAttribute('data-pcp1-hint');
      var card = btn.closest('[data-pcp1-master]');

      // Тот же мастер — закрыть
      if(activeMaster === master){
        activeMaster = null;
        reveal.classList.remove('pcp1__reveal--open');
        document.querySelectorAll('[data-pcp1-master]').forEach(function(c){ c.classList.remove('pcp1__mc-btn--active'); });
        document.querySelectorAll('.pcp1__mc-arrow').forEach(function(a){ a.style.transform = ''; });
        return;
      }

      activeMaster = master;
      document.querySelectorAll('[data-pcp1-master]').forEach(function(c){ c.classList.remove('pcp1__mc-btn--active'); });
      document.querySelectorAll('.pcp1__mc-arrow').forEach(function(a){ a.style.transform = ''; });
      if(card){ card.classList.add('pcp1__mc-btn--active'); }
      btn.querySelector('.pcp1__mc-arrow').style.transform = 'rotate(180deg)';

      // Показать нужную панель
      subNelia.style.display = master === 'nelia' ? 'block' : 'none';
      subSofia.style.display = master === 'sofia' ? 'block' : 'none';
      subDiana.style.display = master === 'diana' ? 'block' : 'none';

      reveal.classList.add('pcp1__reveal--open');

      // Скролл к reveal
      setTimeout(function(){
        var rect = reveal.getBoundingClientRect();
        if(rect.top > window.innerHeight * 0.85){
          window.scrollTo({top: window.scrollY + rect.top - 80, behavior:'smooth'});
        }
      }, 120);

      // Анимация карточек
      var panel = document.getElementById('pcp1-sub-' + master);
      if(panel){
        panel.querySelectorAll('.pcp1__card').forEach(function(c,i){
          c.classList.remove('pcp1--visible');
          setTimeout(function(){ c.classList.add('pcp1--visible'); }, i*80);
        });
      }

      // Загрузить API данные и обновить бейджи
      loadMasterData(master, function(data){
        updateCardBadges(master, data);
      });
    });
  });

  // Клик по карточке — триггер кнопки Preise
  document.querySelectorAll('[data-pcp1-master]').forEach(function(card){
    card.addEventListener('click', function(e){
      if(!e.target.closest('[data-pcp1-hint]')){
        var btn = card.querySelector('[data-pcp1-hint]');
        if(btn) btn.click();
      }
    });
  });

  /* ── INTERSECTION OBSERVER ── */
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.querySelectorAll('.pcp1__card').forEach(function(c,i){
            setTimeout(function(){ c.classList.add('pcp1--visible'); }, i*80);
          });
          io.unobserve(entry.target);
        }
      });
    },{threshold:0.08});
    document.querySelectorAll('.pcp1--observe').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.pcp1__card').forEach(function(c){ c.classList.add('pcp1--visible'); });
  }

  // Префетч данных для всех мастеров в фоне
  ['nelia','sofia','diana'].forEach(function(m){ loadMasterData(m, function(data){ updateCardBadges(m, data); }); });

})();
