# Исправление всех API Routes для работы с Vercel Blob Storage

## Проблема
На Vercel с включенным Blob Storage (BLOB_READ_WRITE_TOKEN) синхронные функции db (`getAll`, `create`, `update`, `remove`, `getById`, `find`, `findOne`) не работают, так как они пытаются использовать файловую систему, которая доступна только для чтения.

## Решение
Использовать async версии функций: `getAllAsync`, `createAsync`, `updateAsync`, `removeAsync`, `getByIdAsync`, `findAsync`, `findOneAsync`.

## Уже обновленные файлы:
- ✅ app/api/auth/register/route.ts
- ✅ app/api/auth/login/route.ts
- ✅ app/api/auth/me/route.ts
- ✅ app/api/auth/profile/route.ts
- ✅ app/api/products/route.ts
- ✅ app/api/products/[id]/route.ts
- ✅ app/api/products/slug/[slug]/route.ts
- ✅ app/api/categories/route.ts
- ✅ app/api/categories/[id]/route.ts
- ✅ app/api/orders/route.ts
- ✅ app/api/orders/[id]/route.ts
- ✅ app/api/reviews/route.ts
- ✅ app/api/inventory/route.ts
- ✅ app/api/inventory/[id]/route.ts

## Оставшиеся файлы для обновления:

Осталось обновить еще ~15 файлов. Используйте следующий паттерн:

### 1. Обновить импорты:
```typescript
// Было:
import { getAll, create, update, remove, getById, find, findOne, count } from '@/lib/db';

// Стало:
import { getAllAsync, createAsync, updateAsync, removeAsync, getByIdAsync, findAsync, findOneAsync, countAsync } from '@/lib/db';
```

### 2. Обновить вызовы функций (добавить await):
```typescript
// Было:
const items = getAll<Type>('collection');
const item = getById<Type>('collection', id);
const newItem = create<Type>('collection', data);
const updated = update<Type>('collection', id, updates);
const deleted = remove('collection', id);
const found = find<Type>('collection', condition);
const one = findOne<Type>('collection', condition);

// Стало:
const items = await getAllAsync<Type>('collection');
const item = await getByIdAsync<Type>('collection', id);
const newItem = await createAsync<Type>('collection', data);
const updated = await updateAsync<Type>('collection', id, updates);
const deleted = await removeAsync('collection', id);
const found = await findAsync<Type>('collection', condition);
const one = await findOneAsync<Type>('collection', condition);
```

### Список оставшихся файлов:
1. app/api/reviews/[id]/route.ts
2. app/api/reviews/[id]/approve/route.ts
3. app/api/products/[id]/images/route.ts
4. app/api/products/images/[imageId]/route.ts
5. app/api/orders/number/[number]/route.ts
6. app/api/admin/database/route.ts
7. app/api/admin/stats/route.ts
8. app/api/admin/products/route.ts
9. app/api/admin/reviews/route.ts
10. app/api/admin/coupons/route.ts
11. app/api/admin/coupons/[id]/route.ts
12. app/api/admin/exchanges/route.ts
13. app/api/admin/exchanges/[id]/route.ts
14. app/api/admin/exchanges/[id]/status/route.ts
15. app/api/admin/analytics/dashboard/route.ts
16. app/api/admin/analytics/recent-orders/route.ts
17. app/api/telegram/*.ts (все файлы)
18. app/api/pos/*.ts (все файлы)
19. app/api/coupons/validate/route.ts
20. app/api/exchanges/route.ts
21. app/api/newsletter/subscribe/route.ts
22. app/api/support/route.ts

## Важно:
- Все функции должны вызываться с `await`
- Функции должны вызываться внутри `async function` (все route handlers уже async)
- Если используете `.filter()` после `getAll`, сначала получите данные: `const items = await getAllAsync<Type>('collection'); const filtered = items.filter(...);`

## После обновления:
1. Убедитесь, что на Vercel установлена переменная окружения `BLOB_READ_WRITE_TOKEN`
2. Пересоберите проект: `npm run build`
3. Задеплойте на Vercel
4. Проверьте работу API endpoints

