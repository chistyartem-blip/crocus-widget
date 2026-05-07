(function(){

  /* ══ POPUP DATA ══ */
  var EXTRAS_GEL = [
    {name:'French',price:'+ 5 €'},
    {name:'Babyboomer',price:'+ 10 €'},
    {name:'Stiletto-Form',price:'+ 10 €'},
    {name:'Nail-Art Design',price:'ab + 10 €'}
  ];
  var EXTRAS_KORREKTUR = [
    {name:'French',price:'+ 5 €'},
    {name:'Babyboomer',price:'+ 10 €'},
    {name:'Stiletto-Form',price:'+ 10 €'},
    {name:'Nail-Art Design',price:'ab + 10 €'},
    {name:'Länge über 2',price:'+ 5 €'},
    {name:'Länge über 3',price:'+ 10 €'}
  ];

  var POPUPS = {
    n_basis:{
      badge:'Nelia · Basis',
      title:'Hygienische <em>Maniküre</em>',
      sub:'Russische Technik mit elektrischer Fräse — kein Einweichen, präzise Nagelhautpflege.',
      sections:[
        {title:'Leistungen',rows:[{name:'Hygienische Maniküre · 30 Min.',old:'30 €',price:'25 €'}]},
        {title:'Enthalten',rows:[{name:'Behandlung der Nagelhaut',price:'✓'},{name:'Korrektur der Nagelform',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]}
      ],
      note:'Sterilisierte Instrumente. Premiummaterialien inklusive.'
    },
    n_gel:{
      badge:'Nelia · Beliebt',
      title:'Maniküre + <em>Gel</em>',
      sub:'Russische Maniküre mit Gel-Verstärkung — bis zu 4 Wochen Haltbarkeit.',
      sections:[
        {title:'Leistungen',rows:[{name:'Verstärkung & Gel · 1,5 Std.',old:'40 €',price:'35 €'}]},
        {title:'Enthalten',rows:[{name:'Nagelhautbehandlung',price:'✓'},{name:'Verstärkung mit Gel',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},
        {title:'Extras & Aufpreise',rows:EXTRAS_GEL}
      ],
      note:'3–4 Wochen Haltbarkeit. HEMA-freie Materialien.'
    },
    n_korrektur:{
      badge:'Nelia · Korrektur',
      title:'Nagel<em>korrektur</em>',
      sub:'Entfernung des alten Materials, Neuaufbau und Gel-Lack.',
      sections:[
        {title:'Leistungen',rows:[{name:'Nagelkorrektur · 2 Std.',old:'50 €',price:'40 €'}]},
        {title:'Enthalten',rows:[{name:'Entfernung des alten Materials',price:'✓'},{name:'Nagelhautbehandlung',price:'✓'},{name:'Verstärkung / Modellierung',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},
        {title:'Extras & Aufpreise',rows:EXTRAS_KORREKTUR}
      ],
      note:'Sterilisierte Instrumente. Premiummaterialien inklusive.'
    },
    d_basis:{
      badge:'Top-Master Diana · Basis',
      title:'Hygienische <em>Maniküre</em>',
      sub:'Sanfte, saubere Maniküre für ein gepflegtes Nagelbild.',
      sections:[
        {title:'Leistungen',rows:[{name:'Hygienische Maniküre · 30 Min.',price:'35 €'}]},
        {title:'Enthalten',rows:[{name:'Behandlung der Nagelhaut',price:'✓'},{name:'Korrektur der Nagelform',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]}
      ],
      note:'Premiummaterialien inklusive. Keine versteckten Kosten.'
    },
    d_gel:{
      badge:'Top-Master Diana · Beliebt',
      title:'Maniküre + <em>Gel</em>',
      sub:'Erstbehandlung ohne vorhandenes Material — Verstärkung, Gel-Lack, bis 4 Wochen.',
      sections:[
        {title:'Leistungen',rows:[{name:'Maniküre + Verstärkung + Gel · 1,5 Std.',price:'45 €'}]},
        {title:'Enthalten',rows:[{name:'Nagelhautbehandlung',price:'✓'},{name:'Verstärkung mit Gel',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},
        {title:'Extras & Aufpreise',rows:EXTRAS_GEL}
      ],
      note:'HEMA-freie Materialien. 3–4 Wochen Haltbarkeit.'
    },
    d_korrektur:{
      badge:'Top-Master Diana · Korrektur',
      title:'Nagel<em>korrektur</em>',
      sub:'Mit vorhandenem Material — Entfernung, Neuaufbau, Gel-Lack.',
      sections:[
        {title:'Leistungen',rows:[{name:'Nagelkorrektur · 2 Std.',price:'55 €'}]},
        {title:'Enthalten',rows:[{name:'Entfernung des alten Materials',price:'✓'},{name:'Nagelhautbehandlung',price:'✓'},{name:'Verstärkung / Modellierung',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},
        {title:'Extras & Aufpreise',rows:EXTRAS_KORREKTUR}
      ],
      note:'Premiummaterialien inklusive.'
    },
    d_verlaengerung:{
      badge:'Top-Master Diana · Verlänger.',
      title:'Nagel<em>verlängerung</em>',
      sub:'Preis abhängig von Länge und Form. Beratung kostenlos.',
      sections:[
        {title:'Leistungen',rows:[{name:'Nagelverlängerung · 2,5 Std.',price:'ab 75 €'}]},
        {title:'Enthalten',rows:[{name:'Entfernung altes Material (falls vorhanden)',price:'✓'},{name:'Nagelhautbehandlung',price:'✓'},{name:'Verlänger. mit Gel',price:'✓'},{name:'Modellierung der Form',price:'✓'},{name:'Gel-Lack + leichtes Design',price:'✓'},{name:'Pflege mit Öl',price:'✓'}]},
        {title:'Extras & Aufpreise',rows:EXTRAS_KORREKTUR}
      ],
      note:'Endpreis nach Länge und Design.'
    }
  };

  /* ══ MASTER INFO DATA ══ */
  var MASTER_INFO = {
    nelia:{
      photo:'https://static.tildacdn.com/tild3537-3733-4430-b466-336537373738/WhatsApp_Image_2026-.jpeg',
      photoClass:'mnp2-minfo-header--nelia',
      badge:'Nelia · Crocus Beauty',
      name:'',
      nameFull:'<em>Nelia</em>',
      desc:'Die Master-Spezialistin wurde persönlich von Diana ausgebildet und arbeitet vollständig nach ihren Methoden, Standards und Qualitätsprinzipien.\n\nEs handelt sich nicht um eine Anfängerin, sondern um eine qualifizierte Fachkraft, die nach denselben hohen Anforderungen an Hygiene, Technik und Ästhetik arbeitet wie der Top-Master. Jede Behandlung erfolgt nach den Standards von Crocus Beauty Studio: präzise Technik, saubere und sorgfältige Arbeit, perfekte Nagelarchitektur und modernes Design.\n\nDer Unterschied liegt hauptsächlich in der Erfahrung und Geschwindigkeit — was sich in einem attraktiveren Preis widerspiegelt. Die ideale Wahl für Kundinnen, die Premium-Qualität zu einem besseren Preis-Leistungs-Verhältnis suchen.',
      facts:[
        {icon:'🎓',text:'Persönlich von Top-Master Diana ausgebildet'},
        {icon:'💎',text:'Gleiche Technik · Gleiche Standards · Gleiche Materialien'},
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
      photo:'https://cdn.jsdelivr.net/gh/chistyartem-blip/crocus-widget@413e27d/assets/sofia.jpg',
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

  /* ══ RENDER DETAILS POPUP ══ */
  function buildDetailsPopup(key){
    var d = POPUPS[key]; if(!d) return '';
    var h = '';
    h += '<div class="mnp2-popup__badge">'+d.badge+'</div>';
    h += '<h3 class="mnp2-popup__title">'+d.title+'</h3>';
    h += '<p class="mnp2-popup__sub">'+d.sub+'</p>';
    h += '<div class="mnp2-popup__divider"></div>';
    d.sections.forEach(function(sec){
      h += '<div class="mnp2-popup__section"><div class="mnp2-popup__section-title">'+sec.title+'</div>';
      sec.rows.forEach(function(row){
        h += '<div class="mnp2-popup__row"><span class="mnp2-popup__row-name">'+row.name+'</span><span class="mnp2-popup__row-price">';
        if(row.old) h += '<span class="mnp2-popup__price-old">'+row.old+'</span><span class="mnp2-popup__price-new">'+row.price+'</span>';
        else h += '<span class="mnp2-popup__price-only">'+row.price+'</span>';
        h += '</span></div>';
      });
      h += '</div>';
    });
    if(d.note) h += '<p class="mnp2-popup__note">'+d.note+'</p>';
    h += '<button class="mnp2-popup__cta-btn" onclick="mnp2CloseDetailsPopup();crocusOpen();">';
    h += '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Jetzt buchen</button>';
    return h;
  }

  /* ══ RENDER MASTER INFO POPUP ══ */
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
    // Параграфы
    var paras = m.desc.split('\n\n');
    paras.forEach(function(p){
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

  /* ══ SCROLL LOCK ══ */
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

  /* ══ DETAILS POPUP ══ */
  function mnp2OpenDetailsPopup(key){
    document.getElementById('mnp2-popup-content').innerHTML = buildDetailsPopup(key);
    document.getElementById('mnp2-overlay').classList.add('is-open');
    mnp2LockScroll();
  }
  function mnp2CloseDetailsPopup(){
    document.getElementById('mnp2-overlay').classList.remove('is-open');
    mnp2UnlockScroll();
  }
  window.mnp2CloseDetailsPopup = mnp2CloseDetailsPopup;
  document.getElementById('mnp2-close').addEventListener('click', mnp2CloseDetailsPopup);
  document.getElementById('mnp2-overlay').addEventListener('click', function(e){ if(e.target===this) mnp2CloseDetailsPopup(); });

  /* ══ MASTER INFO POPUP ══ */
  function mnp2OpenMasterInfo(key){
    document.getElementById('mnp2-minfo-content').innerHTML = buildMasterInfoPopup(key);
    document.getElementById('mnp2-minfo-overlay').classList.add('is-open');
    mnp2LockScroll();
  }
  function mnp2CloseMasterInfo(){
    document.getElementById('mnp2-minfo-overlay').classList.remove('is-open');
    mnp2UnlockScroll();
  }
  window.mnp2OpenMasterInfo = mnp2OpenMasterInfo;
  window.mnp2CloseMasterInfo = mnp2CloseMasterInfo;
  document.getElementById('mnp2-minfo-close').addEventListener('click', mnp2CloseMasterInfo);
  document.getElementById('mnp2-minfo-overlay').addEventListener('click', function(e){ if(e.target===this) mnp2CloseMasterInfo(); });

  /* ══ ESC ══ */
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape'){ mnp2CloseDetailsPopup(); mnp2CloseMasterInfo(); }
  });

  /* ══ ДЕЛЕГИРОВАНИЕ КНОПОК DETAILS ══ */
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-mnp2-popup]');
    if(btn){ mnp2OpenDetailsPopup(btn.getAttribute('data-mnp2-popup')); }
  });

  /* ══ SELECT MASTER ══ */
  var currentMaster = null;
  function mnp2SelectMaster(key){
    var placeholder = document.getElementById('mnp2-placeholder');
    var reveal      = document.getElementById('mnp2-reveal');
    var cardNelia   = document.getElementById('mnp2-mc-nelia');
    var cardDiana   = document.getElementById('mnp2-mc-diana');
    var cardSofia   = document.getElementById('mnp2-mc-sofia');
    var subNelia    = document.getElementById('mnp2-sub-nelia');
    var subDiana    = document.getElementById('mnp2-sub-diana');
    var subSofia    = document.getElementById('mnp2-sub-sofia');

    if(currentMaster === key) return;

    currentMaster = key;

    /* карточки */
    cardNelia.classList.toggle('mnp2__mc-btn--active', key==='nelia');
    cardDiana.classList.toggle('mnp2__mc-btn--active', key==='diana');
    cardSofia.classList.toggle('mnp2__mc-btn--active', key==='sofia');

    /* панели */
    subNelia.classList.toggle('mnp2__sub-panel--active', key==='nelia');
    subDiana.classList.toggle('mnp2__sub-panel--active', key==='diana');
    subSofia.classList.toggle('mnp2__sub-panel--active', key==='sofia');

    /* показываем reveal, скрываем placeholder */
    placeholder.style.display = 'none';
    reveal.classList.add('mnp2__reveal--open');

    /* скролл к reveal */
    setTimeout(function(){
      var revealEl = document.getElementById('mnp2-reveal');
      if(revealEl){
        var rect = revealEl.getBoundingClientRect();
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var offset = rect.top + scrollTop - 80;
        window.scrollTo({top: offset, behavior: 'smooth'});
      }
    }, 80);

    /* анимация карточек */
    var panel = document.getElementById('mnp2-sub-'+key);
    panel.querySelectorAll('.mnp2__card').forEach(function(c,i){
      c.classList.remove('mnp2--visible');
      setTimeout(function(){ c.classList.add('mnp2--visible'); }, i*80);
    });


  }
  window.mnp2SelectMaster = mnp2SelectMaster;

  /* ══ INTERSECTION OBSERVER ══ */
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


  /* ══ API: ЗАГРУЗКА ДЛИТЕЛЬНОСТЕЙ ══ */
  var MNP2_API_TOKEN = 'u8xzkdpkgfc73uektn64';
  var MNP2_LOC = '1357963';
  var MNP2_API_BASE = 'https://api.alteg.io/api/v1';

  var MNP2_SERVICE_IDS = {
    n_basis:13485752, n_gel:13485753, n_korrektur:13485754,
    d_basis:13485752, d_gel:13485753, d_korrektur:13485754, d_verlaengerung:13485755
  };
  var MNP2_STAFF_FOR_DUR = { nelia:3020186, diana:3020185, sofia:3020187 };

  function mnp2FmtDur(sec){
    if(!sec) return '';
    var m = Math.round(sec/60);
    if(m < 60) return m+' Min.';
    var h = Math.floor(m/60), rm = m%60;
    return rm > 0 ? h+','+Math.round(rm/6)+' Std.' : h+' Std.';
  }

  function mnp2LoadDurations(masterKey){
    var staffId = MNP2_STAFF_FOR_DUR[masterKey];
    if(!staffId) return;
    fetch(MNP2_API_BASE+'/book_services/'+MNP2_LOC+'?staff_id='+staffId, {
      headers:{'Authorization':'Bearer '+MNP2_API_TOKEN,'Accept':'application/vnd.api.v2+json','Accept-Language':'de'}
    }).then(function(r){ return r.json(); }).then(function(data){
      var svcs = (data.data && data.data.services) ? data.data.services : [];
      var durMap = {};
      svcs.forEach(function(s){ if(s.seance_length) durMap[s.id] = s.seance_length; });
      var panel = document.getElementById('mnp2-sub-'+masterKey);
      if(!panel) return;
      panel.querySelectorAll('[data-mnp2-popup]').forEach(function(el){
        var popKey = el.getAttribute('data-mnp2-popup');
        var svcId = MNP2_SERVICE_IDS[popKey];
        if(!svcId || !durMap[svcId]) return;
        var dur = mnp2FmtDur(durMap[svcId]);
        if(!dur) return;
        var card = el.closest ? el.closest('.mnp2__card') : (function(){ var n=el; while(n && !(n.className||'').match(/mnp2__card/)) n=n.parentNode; return n; })();
        if(!card) return;
        var badge = card.querySelector('.mnp2__badge');
        if(!badge) return;
        badge.textContent = badge.textContent.replace(/·\s*[\d,]+\s*(Min\.|Std\.)/g, '· '+dur);
      });
    }).catch(function(){});
  }

  ['nelia','diana','sofia'].forEach(function(m){ mnp2LoadDurations(m); });

})();