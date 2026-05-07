/**
 * crocus-slots.js — Live slot availability for Crocus Beauty Studio
 * Fetches real available slots from Alteg API and renders them on the page
 * Used in crw3 (Warum Crocus) section
 */
(function(){
'use strict';

var CONFIG = {
  partnerToken: 'u8xzkdpkgfc73uektn64',
  locationId:   '1357963',
  apiBase:      'https://api.alteg.io/api/v1',
  // Мастера и их основные услуги для проверки слотов
  staff: [
    { id: 3020185, name: 'Diana',  serviceId: 13485754 }, // Nagelkorrektur
    { id: 3020186, name: 'Nelia',  serviceId: 13485753 }, // Maniküre+Gel
    { id: 3020188, name: 'Karina', serviceId: 13485756 }, // Wimpern (French как заглушка)
  ],
  // Сколько дней вперёд искать ближайший слот
  lookAheadDays: 14,
};

// ── Helpers ──────────────────────────────────────────────────────
function pad(n){ return n < 10 ? '0'+n : String(n); }

function formatDate(d){
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}

function dateLabel(dateStr){
  var today    = formatDate(new Date());
  var tomorrow = formatDate(new Date(Date.now() + 86400000));
  if(dateStr === today)    return 'heute';
  if(dateStr === tomorrow) return 'morgen';
  // иначе — день недели
  var days = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  var d = new Date(dateStr);
  return days[d.getDay()] + ', ' + pad(d.getDate()) + '.' + pad(d.getMonth()+1);
}

function fetchSlots(staffId, serviceId, date){
  var url = CONFIG.apiBase + '/book_times/' + CONFIG.locationId + '/' + staffId + '/' + date
    + '?service_ids[]=' + serviceId;
  return fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + CONFIG.partnerToken,
      'Accept': 'application/vnd.api.v2+json'
    }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){ return (d.success && Array.isArray(d.data)) ? d.data : []; })
  .catch(function(){ return []; });
}

// Находим ближайшую дату со слотами (today + lookAheadDays)
function findNextAvailable(staffId, serviceId){
  var dates = [];
  var now = new Date();
  for(var i = 0; i < CONFIG.lookAheadDays; i++){
    var d = new Date(now.getTime() + i * 86400000);
    dates.push(formatDate(d));
  }

  // Запрашиваем последовательно, останавливаемся на первой с результатом
  return dates.reduce(function(promise, date){
    return promise.then(function(found){
      if(found) return found; // уже нашли
      return fetchSlots(staffId, serviceId, date).then(function(slots){
        if(slots.length > 0) return { date: date, slots: slots };
        return null;
      });
    });
  }, Promise.resolve(null));
}

// ── Render helpers ────────────────────────────────────────────────
function renderBadge(result){
  if(!result) return '<span style="color:rgba(26,13,18,0.35);font-size:10px;">Auf Anfrage</span>';

  var label = dateLabel(result.date);
  var count = result.slots.length;
  var isToday = result.date === formatDate(new Date());

  // Первый доступный слот
  var firstTime = result.slots[0] ? result.slots[0].time : '';

  var urgency = '';
  var color = '#2ecc71';
  if(isToday && count <= 3){
    urgency = ' · nur noch '+count;
    color = '#e67e22';
  } else if(isToday && count <= 7){
    urgency = ' · '+count+' frei';
  } else if(isToday){
    urgency = ' · '+count+' Termine frei';
  } else {
    urgency = ' ab ' + firstTime + ' Uhr';
  }

  var dot = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+color
    +';margin-right:5px;flex-shrink:0;box-shadow:0 0 0 3px '+color+'22;animation:crwSlotPulse 1.5s ease-in-out infinite;"></span>';

  return dot + '<span style="font-weight:600;color:#1a0d12;">' + label + '</span>'
    + '<span style="color:rgba(26,13,18,0.50);">' + urgency + '</span>';
}

// ── Inject per-master slot badges ─────────────────────────────────
function injectMasterSlots(staffId, result){
  // Ищем все элементы с data-crw3-master-slots="staffId"
  var els = document.querySelectorAll('[data-crw3-master-slots="'+staffId+'"]');
  var html = renderBadge(result);
  els.forEach(function(el){
    el.innerHTML = html;
    el.style.display = 'flex';
    el.style.alignItems = 'center';
  });
}

// ── Update global live badge ──────────────────────────────────────
function updateGlobalBadge(results){
  var el = document.getElementById('crw3SlotsCount');
  var wrap = document.querySelector('.crw3__live');
  if(!el || !wrap) return;

  // Считаем свободные слоты сегодня у всех мастеров
  var today = formatDate(new Date());
  var todayTotal = 0;
  var anyToday = false;
  var nextDate = null;
  var nextSlots = 0;

  results.forEach(function(r){
    if(!r) return;
    if(r.date === today){
      anyToday = true;
      todayTotal += r.slots.length;
    } else if(!nextDate || r.date < nextDate){
      nextDate = r.date;
      nextSlots = r.slots.length;
    }
  });

  if(anyToday && todayTotal > 0){
    // Анимированный счётчик
    animateCount(el, todayTotal);
    wrap.querySelector('.crw3__live-text').innerHTML =
      'Heute noch <span id="crw3SlotsCount" style="color:#7B2D4E;font-weight:700;">' + todayTotal + '</span> freie Termine';

    // Подсветка срочности
    if(todayTotal <= 3){
      wrap.querySelector('.crw3__live-dot').style.background = '#e74c3c';
      wrap.querySelector('.crw3__live-dot').style.boxShadow = '0 0 0 3px rgba(231,76,60,0.20)';
    }
  } else if(nextDate){
    var label = dateLabel(nextDate);
    wrap.querySelector('.crw3__live-text').innerHTML =
      'Nächster freier Termin: <span style="color:#7B2D4E;font-weight:700;">' + label + '</span> · '
      + '<span style="color:rgba(26,13,18,0.50);">' + nextSlots + ' verfügbar</span>';
    wrap.querySelector('.crw3__live-dot').style.background = '#3498db';
  } else {
    wrap.querySelector('.crw3__live-text').innerHTML =
      'Termine <span style="color:#7B2D4E;font-weight:700;">auf Anfrage</span>';
    wrap.querySelector('.crw3__live-dot').style.background = '#95a5a6';
  }
}

function animateCount(el, target){
  var start = 0;
  var dur = 800;
  var t0 = null;
  function step(ts){
    if(!t0) t0 = ts;
    var p = Math.min((ts - t0) / dur, 1);
    el.textContent = Math.round(p * target);
    if(p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── CSS для анимации точек ────────────────────────────────────────
function injectCSS(){
  if(document.getElementById('crw3-slots-css')) return;
  var s = document.createElement('style');
  s.id = 'crw3-slots-css';
  s.textContent = [
    '@keyframes crwSlotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.7)}}',
    '.crw3__master-slot-badge{display:flex;align-items:center;gap:4px;font-family:"DM Sans",Arial,sans-serif;',
    'font-size:10.5px;line-height:1.3;margin-top:6px;min-height:16px;}',
    '.crw3__master-slot-badge.loading::after{content:"";display:inline-block;width:10px;height:10px;',
    'border:1.5px solid rgba(123,45,78,0.20);border-top-color:#7B2D4E;border-radius:50%;',
    'animation:crwSlotSpin 0.7s linear infinite;}',
    '@keyframes crwSlotSpin{to{transform:rotate(360deg)}}',
  ].join('');
  document.head.appendChild(s);
}

// ── Main ─────────────────────────────────────────────────────────
function init(){
  injectCSS();

  // Ставим loading state
  document.querySelectorAll('[data-crw3-master-slots]').forEach(function(el){
    el.classList.add('loading');
    el.style.display = 'flex';
  });

  var promises = CONFIG.staff.map(function(s){
    return findNextAvailable(s.id, s.serviceId).then(function(result){
      el_remove_loading(s.id);
      injectMasterSlots(s.id, result);
      return result;
    });
  });

  Promise.all(promises).then(function(results){
    updateGlobalBadge(results);
  });
}

function el_remove_loading(staffId){
  document.querySelectorAll('[data-crw3-master-slots="'+staffId+'"]').forEach(function(el){
    el.classList.remove('loading');
  });
}

// Запускаем после загрузки DOM
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  // Небольшая задержка чтобы HTML успел отрендериться
  setTimeout(init, 300);
}

// Обновляем каждые 5 минут
setInterval(init, 5 * 60 * 1000);

})();
