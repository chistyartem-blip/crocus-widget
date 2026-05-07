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
  if(!result){
    return '<span class="crw3__master-slot-dot grey"></span>'
      + '<span style="color:rgba(26,13,18,0.40);font-size:10.5px;">Auf Anfrage</span>';
  }

  var label = dateLabel(result.date);
  var isToday = result.date === formatDate(new Date());
  var firstTime = result.slots[0] ? result.slots[0].time : '';
  var count = result.slots.length;

  // Цвет: оранжевый если сегодня и мало мест, зелёный иначе
  var dotClass = (isToday && count <= 3) ? 'orange' : '';
  var dot = '<span class="crw3__master-slot-dot ' + dotClass + '"></span>';

  var timeStr = '';
  if(isToday && firstTime){
    timeStr = 'ab ' + firstTime + ' Uhr';
    if(count <= 3) timeStr += ' · letzter';
  } else if(firstTime){
    timeStr = label + ' · ab ' + firstTime;
  } else {
    timeStr = label;
  }

  return dot + '<span style="font-size:10.5px;color:#1a0d12;">' + timeStr + '</span>';
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

  Promise.all(promises);
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
