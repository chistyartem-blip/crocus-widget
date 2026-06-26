(function(){
  var root = document.getElementById('cb26');
  if (!root) return;

  var widgetSrc = root.getAttribute('data-widget-src') || 'https://cdn.jsdelivr.net/gh/chistyartem-blip/crocus-widget@68df2b7/crocus-booking.min.js';
  var widgetReady = false;
  var inlineTimer = 0;

  function qs(sel, ctx){ return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function unlockBody(){
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.classList.remove('crocus-open');
  }

  function ensureWidgetLoaded(done){
    if (window.crocusOpen || document.getElementById('crocus-modal')) {
      done && done();
      return;
    }
    if (!document.getElementById('cb26-widget-script')) {
      var s = document.createElement('script');
      s.id = 'cb26-widget-script';
      s.src = widgetSrc;
      s.async = true;
      s.onload = function(){ done && done(); };
      document.head.appendChild(s);
    } else {
      setTimeout(function(){ ensureWidgetLoaded(done); }, 120);
    }
  }

  function inlineWidget(){
    var anchor = document.getElementById('cb26-widget-anchor');
    var modal = document.getElementById('crocus-modal');
    if (!anchor || !modal) {
      clearTimeout(inlineTimer);
      inlineTimer = setTimeout(inlineWidget, 120);
      return;
    }

    var backdrop = document.getElementById('crocus-backdrop');
    var fab = document.getElementById('crocus-fab-wrap');
    var fabMobile = document.getElementById('crocus-fab-mobile');
    if (backdrop) backdrop.style.display = 'none';
    if (fab) fab.style.display = 'none';
    if (fabMobile) fabMobile.style.display = 'none';

    if (modal.parentNode !== anchor) anchor.appendChild(modal);
    modal.classList.add('open');
    modal.classList.add('cb26-inlined');
    modal.style.position = 'static';
    modal.style.transform = 'none';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '1';
    modal.style.maxWidth = '500px';
    modal.style.width = '100%';
    modal.style.height = '680px';
    modal.style.borderRadius = '24px';
    widgetReady = true;
    unlockBody();
  }

  function scrollToWidget(){
    var anchor = document.getElementById('cb26-widget');
    if (!anchor) return;
    var y = anchor.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - 18;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  function callWidget(kind){
    ensureWidgetLoaded(function(){
      inlineWidget();
      scrollToWidget();
      setTimeout(function(){
        try {
          if (kind === 'gift' && typeof window.crocusOpenGutschein === 'function') {
            window.crocusOpenGutschein('booking_landing_2026');
          } else if (kind === 'wimpern' && typeof window.crocusOpenWimpern === 'function') {
            window.crocusOpenWimpern();
          } else if (typeof window.crocusOpen === 'function') {
            window.crocusOpen();
          }
        } catch(e) {}
        setTimeout(function(){
          inlineWidget();
          unlockBody();
        }, 120);
      }, 180);
    });
  }

  window.cb26Book = function(kind){
    callWidget(kind || 'nails');
  };

  window.cb26Scroll = function(target){
    var el = document.getElementById(target);
    if (!el) return;
    var y = el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - 16;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  function setupReveal(){
    if (!('IntersectionObserver' in window)) {
      qsa('.cb26-reveal', root).forEach(function(el){ el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: .12 });
    qsa('.cb26-reveal', root).forEach(function(el){ io.observe(el); });
  }

  function setupEyeReveal(){
    var sec = document.getElementById('cb26-eye');
    var frame = qs('.cb26-eye-frame', root);
    if (!sec || !frame) return;
    function update(){
      var r = sec.getBoundingClientRect();
      var h = window.innerHeight || document.documentElement.clientHeight;
      var p = (h - r.top) / (h + r.height * .58);
      p = Math.max(.05, Math.min(.96, p));
      frame.style.setProperty('--reveal', p.toFixed(3));
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  function setupPointerLight(){
    function move(clientX, clientY){
      var r = root.getBoundingClientRect();
      root.style.setProperty('--mx', (clientX - r.left) + 'px');
      root.style.setProperty('--my', (clientY - r.top) + 'px');
    }
    root.addEventListener('pointermove', function(e){ move(e.clientX, e.clientY); }, { passive: true });

    var stage = qs('.cb26-nail-stage', root);
    if (!stage) return;

    stage.addEventListener('pointermove', function(e){
      var r = stage.getBoundingClientRect();
      stage.style.setProperty('--tilt-x', ((e.clientX - r.left) / r.width * 80 - 40).toFixed(1) + 'px');
      stage.style.setProperty('--tilt-y', ((e.clientY - r.top) / r.height * 80 - 40).toFixed(1) + 'px');
    }, { passive: true });

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', function(e){
        if (!stage) return;
        var x = Math.max(-40, Math.min(40, (e.gamma || 0) * 1.2));
        var y = Math.max(-40, Math.min(40, (e.beta || 0) * .7));
        stage.style.setProperty('--tilt-x', x.toFixed(1) + 'px');
        stage.style.setProperty('--tilt-y', y.toFixed(1) + 'px');
      }, { passive: true });
    }
  }

  function setupSticky(){
    var sticky = qs('.cb26-sticky', root);
    var hero = qs('.cb26-hero', root);
    var widget = document.getElementById('cb26-widget');
    var play = document.getElementById('cb26-play');
    var gift = document.getElementById('cb26-gift');
    if (!sticky || !hero) return;
    function update(){
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var heroBottom = hero.offsetTop + hero.offsetHeight;
      var widgetRect = widget ? widget.getBoundingClientRect() : null;
      var playRect = play ? play.getBoundingClientRect() : null;
      var giftRect = gift ? gift.getBoundingClientRect() : null;
      var vh = window.innerHeight || 800;
      var nearWidget = widgetRect && widgetRect.top < vh * .88 && widgetRect.bottom > 120;
      var nearPlay = playRect && playRect.top < vh * .88 && playRect.bottom > 140;
      var nearGift = giftRect && giftRect.top < vh * .88 && giftRect.bottom > 140;
      sticky.classList.toggle('is-visible', y > heroBottom - 120 && !nearWidget && !nearPlay && !nearGift);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  function setupNailPlayground(){
    var stage = qs('.cb26-nail-stage', root);
    if (!stage) return;

    qsa('[data-nail-color]', root).forEach(function(btn){
      btn.addEventListener('click', function(){
        qsa('[data-nail-color]', root).forEach(function(b){ b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        stage.style.setProperty('--nail-color', btn.getAttribute('data-nail-color'));
        stage.style.setProperty('--nail-effect', btn.getAttribute('data-nail-effect') || 'linear-gradient(135deg, rgba(255,255,255,.72), transparent 42%)');
      });
    });

    qsa('[data-nail-shape]', root).forEach(function(btn){
      btn.addEventListener('click', function(){
        qsa('[data-nail-shape]', root).forEach(function(b){ b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        stage.classList.remove('is-almond', 'is-square', 'is-short');
        stage.classList.add('is-' + btn.getAttribute('data-nail-shape'));
      });
    });

    var upload = document.getElementById('cb26-upload');
    if (upload) {
      upload.addEventListener('change', function(){
        var file = upload.files && upload.files[0];
        if (!file) return;
        var url = URL.createObjectURL(file);
        stage.style.backgroundImage = 'url("' + url + '")';
      });
    }
  }

  function setupFaq(){
    qsa('.cb26-faq-q', root).forEach(function(btn){
      btn.addEventListener('click', function(){
        var item = btn.closest('.cb26-faq-item');
        if (!item) return;
        var open = item.classList.contains('is-open');
        qsa('.cb26-faq-item', root).forEach(function(i){ i.classList.remove('is-open'); });
        if (!open) item.classList.add('is-open');
      });
    });
  }

  function setupGuard(){
    document.addEventListener('click', function(e){
      if (e.target && e.target.id === 'crocus-close' && e.target.closest('#cb26-widget-anchor')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);

    try {
      var observer = new MutationObserver(function(){
        if (document.body.style.position === 'fixed' || document.body.classList.contains('crocus-open')) {
          if (document.getElementById('crocus-modal') && document.getElementById('crocus-modal').classList.contains('cb26-inlined')) {
            unlockBody();
          }
        }
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    } catch(e) {}
  }

  function init(){
    setupReveal();
    setupEyeReveal();
    setupPointerLight();
    setupSticky();
    setupNailPlayground();
    setupFaq();
    setupGuard();
    ensureWidgetLoaded(function(){
      setTimeout(inlineWidget, 280);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
