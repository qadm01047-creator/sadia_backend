# Vercel Deployment Guide

## Важные моменты для деплоя на Vercel

### 1. Файловая система

На Vercel файловая система доступна только для чтения в production. JSON файлы базы данных должны быть включены в деплой.

**Важно:** Убедитесь, что файлы в папке `data/collections/` включены в git:

```bash
git add data/collections/*.json
git commit -m "Add database files"
git push
```

Или проверьте `.gitignore` - файлы не должны быть там исключены.

### 2. Переменные окружения

В настройках проекта Vercel добавьте переменные окружения:

- `JWT_SECRET` - секретный ключ для JWT токенов
- `NEXT_PUBLIC_API_URL` - URL API (например, `https://sadia-backend.vercel.app`)
- `TELEGRAM_BOT_TOKEN` - токен Telegram бота (если используется)
- `FRONTEND_URL` - URL фронтенда (например, `https://sadia-lux.vercel.app`)

### 3. CORS настройки

Middleware автоматически разрешает запросы с:
- Всех Vercel доменов (*.vercel.app)
- Вашего production домена

Если используете кастомный домен, добавьте его в `middleware.ts` в массив `allowedOrigins`.

### 4. Build команды

Vercel автоматически определяет Next.js проекты, но можно явно указать в `vercel.json`.

### 5. Проверка деплоя

После деплоя проверьте:
1. Health endpoint: `https://your-backend.vercel.app/api/health`
2. API docs: `https://your-backend.vercel.app/swagger`
3. Тестовый запрос: `GET https://your-backend.vercel.app/api/products`

### 6. Проблемы с файлами

Если возникают проблемы с записью в файлы:
- Vercel использует serverless functions с read-only файловой системой
- Для production рекомендуется использовать базу данных (PostgreSQL, MongoDB и т.д.)
- Текущая реализация с JSON файлами работает только для чтения

