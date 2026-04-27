# Crocus Booking Widget — Altegio Integration

## Что это

Кастомный виджет онлайн-записи для Tilda + Cloudflare Worker прокси.
Фронтенд наш, бэкенд — Altegio API.

## Файлы

- `crocus-booking.js` — виджет (вставляется в Tilda через HTML-блок)
- `proxy-worker.js` — CF Worker, скрывает токены от браузера
- `wrangler.toml` — конфиг деплоя

## Как подключить (после получения токенов)

### 1. Задеплоить прокси

```bash
cd crocus-widget
bunx wrangler deploy
bunx wrangler secret put ALTEGIO_PARTNER_TOKEN
bunx wrangler secret put ALTEGIO_USER_TOKEN
```

Получишь URL типа: `https://crocus-booking-proxy.workers.dev`

### 2. Обновить виджет

В `crocus-booking.js` найти CONFIG и заменить:

```js
var CONFIG = {
  partnerToken: 'PARTNER_TOKEN_HERE',  // не нужен если используешь прокси
  locationId:   '12345',               // ← ID салона из Altegio
  apiBase:      'https://crocus-booking-proxy.workers.dev/api', // ← прокси URL
};
```

### 3. Вставить в Tilda

В HTML-блок Tilda:
```html
<script src="https://YOUR_CDN/crocus-booking.js"></script>
```
Или вставить содержимое напрямую в `<script>` тег.

## API эндпоинты (Altegio Public)

| Шаг | Эндпоинт | Описание |
|-----|---------|---------|
| 1 | `GET /book_services/{location_id}` | Список услуг |
| 2 | `GET /book_staff/{location_id}?service_ids[]=X` | Мастера для услуги |
| 3 | `GET /book_dates/{location_id}?staff_id=X&service_ids[]=Y` | Доступные даты |
| 3 | `GET /book_times/{location_id}/{staff_id}/{date}` | Доступное время |
| 4 | `POST /book_record/{location_id}` | Создать запись |

## Маппинг уровней мастеров

В Altegio нет понятия Junior/Master/Top Master.
Уровень берётся из поля `specialization` мастера.

**Настрой в Altegio:** зайди в профиль каждого мастера → поле "Специализация" → напиши:
- `Junior` / `Master` / `Top Master` / `Premium`

Виджет автоматически подтянет нужный цвет и описание.

## Цены по уровням

Altegio поддерживает разные цены для разных мастеров на одну услугу.
Настраивается в: Услуги → Выбрать услугу → Цены по сотрудникам.
