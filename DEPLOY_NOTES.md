# Важные заметки для деплоя на Vercel

## Проблема с файлами базы данных

На Vercel файловая система доступна только для чтения. JSON файлы в папке `data/collections/` должны быть включены в репозиторий.

### Решение:

Файлы базы данных **НЕ** должны быть в `.gitignore`. Убедитесь что они закоммичены:

```bash
# Проверьте что файлы не игнорируются
git check-ignore data/collections/*.json

# Если они игнорируются, нужно временно убрать из .gitignore
# Затем закоммитить файлы:
git add data/collections/*.json
git commit -m "Add database files for Vercel deployment"
git push
```

**ВНИМАНИЕ:** На Vercel файлы будут доступны только для чтения. Запись в файлы не будет работать в production. Для записи данных нужно использовать базу данных (PostgreSQL, MongoDB и т.д.).

## Переменные окружения на Vercel

В настройках проекта Vercel добавьте:

1. `JWT_SECRET` - секретный ключ для JWT
2. `NEXT_PUBLIC_API_URL` - URL вашего API (например: `https://sadia-backend.vercel.app`)
3. `FRONTEND_URL` - URL фронтенда (если нужно)
4. `TELEGRAM_BOT_TOKEN` - токен бота (если используется)

## CORS

CORS настроен для разрешения всех источников. Для production можно ограничить в `middleware.ts`.

## Проверка после деплоя

1. Health check: `https://your-backend.vercel.app/api/health`
2. Swagger docs: `https://your-backend.vercel.app/swagger`
3. Тестовый запрос: `GET https://your-backend.vercel.app/api/products`

