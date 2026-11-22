# Система репетитора

Статичний сайт без збірки (ES-модулі). Дані зберігаються в прихованій папці застосунку (`appDataFolder`) на Google Диску користувача.

## Налаштування
1. У `js/config.js` вставте OAuth Client ID.
2. У Google Cloud: увімкніть **Google Drive API**; в OAuth client додайте **Authorized JavaScript origins**: `https://<ваш-логін>.github.io` (тільки origin, без шляху) та `http://localhost:8080` для розробки.
3. На екрані згоди додайте scope `.../auth/drive.appdata`. Поки застосунок у статусі Testing, додайте свій акаунт у Test users.

## Запуск локально
`python3 -m http.server 8080` у цій папці → http://localhost:8080 (через `file://` модулі не працюють).

## Публікація
Залийте вміст репозиторію на GitHub та увімкніть Pages (Settings → Pages → Deploy from branch).

## Структура
- `js/core/` — auth, drive, store (збереження), router, ui, html (екранування), schema (версії даних)
- `js/domain/` — бізнес-логіка без DOM
- `js/views/` — екрани; `js/demo/seed.js` — демо-дані
- Новий екран: файл у `views/` + рядок `router.route(...)` у `app.js`
