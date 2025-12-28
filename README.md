# Sadia.lux Backend API

Backend API для маркетплейса Sadia.lux на Next.js.

## Установка

```bash
npm install
```

## Настройка

Создайте файл `.env` на основе `.env.example`:

```bash
JWT_SECRET=your-secret-key-here
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
NODE_ENV=development
```

## Запуск

### Режим разработки

```bash
npm run dev
```

API будет доступно на `http://localhost:3000/api`

### Production

```bash
npm run build
npm start
```

## Инициализация базы данных

Запустите seed скрипт для создания начальных данных:

```bash
npx tsx scripts/seed.ts
```

Это создаст:

- Пользователей (SuperAdmin, Admin, Cashier)
- Категории товаров

## API Endpoints

### Аутентификация

- `POST /api/auth/login` - Вход
- `POST /api/auth/register` - Регистрация
- `GET /api/auth/me` - Текущий пользователь

### Продукты

- `GET /api/products` - Список продуктов
- `GET /api/products/:id` - Продукт по ID
- `GET /api/products/slug/:slug` - Продукт по slug
- `POST /api/products` - Создать продукт (Admin)
- `PUT /api/products/:id` - Обновить продукт (Admin)
- `DELETE /api/products/:id` - Удалить продукт (Admin)

### Категории

- `GET /api/categories` - Список категорий
- `GET /api/categories/:id` - Категория по ID
- `POST /api/categories` - Создать категорию (Admin)
- `PUT /api/categories/:id` - Обновить категорию (Admin)
- `DELETE /api/categories/:id` - Удалить категорию (Admin)

### Заказы

- `GET /api/orders` - Список заказов
- `GET /api/orders/:id` - Заказ по ID
- `POST /api/orders` - Создать заказ

### Админ панель

- `GET /api/admin/products` - Все продукты (Admin)
- `GET /api/admin/stats` - Статистика (Admin)
- `GET /api/admin/users` - Все пользователи (SuperAdmin)
- `GET /api/admin/support` - Сообщения поддержки (Admin)
- `PUT /api/admin/support` - Обновить сообщение поддержки (Admin)
- `GET /api/admin/reviews` - Все отзывы (Admin)
- `PUT /api/admin/reviews` - Обновить отзыв (Admin)
- `DELETE /api/admin/reviews` - Удалить отзыв (Admin)

### POS система

- `GET /api/pos/orders` - Заказы POS (Admin/Cashier)
- `POST /api/pos/orders` - Создать заказ POS (Admin/Cashier)

### Telegram бот

- `GET /api/telegram/products` - Продукты для бота
- `POST /api/telegram/webhook` - Webhook для создания заказов из бота

### Отзывы

- `GET /api/reviews` - Список отзывов
- `POST /api/reviews` - Создать отзыв

### Поддержка

- `POST /api/support` - Отправить сообщение поддержки

## Роли пользователей

- **USER** - Обычный пользователь
- **CASHIER** - Кассир (POS система)
- **ADMIN** - Администратор
- **SUPERADMIN** - Суперадминистратор

## База данных

База данных использует файловую систему, где каждая коллекция хранится в отдельном JSON файле в директории `data/collections/`:

- `users.json` - Пользователи
- `categories.json` - Категории
- `products.json` - Продукты
- `orders.json` - Заказы
- `orderItems.json` - Элементы заказов
- `reviews.json` - Отзывы
- `supportMessages.json` - Сообщения поддержки
- `coupons.json` - Купоны
- `exchanges.json` - Обмены
- `inventory.json` - Склад
- `payments.json` - Платежи
- `saleAnalytics.json` - Аналитика продаж

Каждый файл содержит массив объектов соответствующего типа.
