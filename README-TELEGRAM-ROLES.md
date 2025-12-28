# Настройка ролей пользователей в Telegram боте

## Как назначить роль пользователю Telegram

### Вариант 1: Через User таблицу (рекомендуется)

Добавьте поле `telegramUserId` к пользователю в базе данных:

1. Откройте `backend/data/collections/users.json`
2. Найдите пользователя, которому нужно дать права
3. Добавьте поле `telegramUserId` с ID пользователя из Telegram:

```json
{
  "id": "...",
  "email": "admin@sadia.lux",
  "role": "ADMIN",
  "telegramUserId": "123456789",
  ...
}
```

Чтобы узнать Telegram ID пользователя:
- Попросите пользователя написать `/start` боту
- В логах бота будет видно `chat.id` (это и есть Telegram User ID)

### Вариант 2: Через TelegramUserMapping коллекцию

Используйте API endpoint для создания маппинга:

```bash
POST /api/telegram/user
{
  "telegramUserId": "123456789",
  "userId": "optional-user-id",
  "role": "ADMIN"
}
```

Это создаст запись в коллекции `telegramUserMappings`.

## Роли

- **USER** - обычный пользователь (доступ к покупкам)
- **ADMIN** - администратор (доступ к админ панели в боте)
- **SUPERADMIN** - суперадминистратор (полный доступ к админ панели)
- **CASHIER** - кассир (для POS системы)

## По умолчанию

Если пользователь не найден ни в User таблице, ни в TelegramUserMapping, ему присваивается роль **USER**.

