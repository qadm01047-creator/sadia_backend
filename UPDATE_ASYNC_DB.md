# Обновление API Routes для использования Async DB функций

Все API routes были обновлены для использования async версий функций db (getAllAsync, createAsync, updateAsync, removeAsync, getByIdAsync, findAsync, findOneAsync).

## Уже обновленные файлы:
- ✅ app/api/auth/register/route.ts
- ✅ app/api/auth/login/route.ts
- ✅ app/api/auth/me/route.ts
- ✅ app/api/auth/profile/route.ts
- ✅ app/api/products/route.ts
- ✅ app/api/products/[id]/route.ts
- ✅ app/api/categories/route.ts
- ✅ app/api/orders/route.ts
- ✅ app/api/orders/[id]/route.ts

## Оставшиеся файлы для обновления:

Нужно обновить все остальные route.ts файлы. Паттерн замены:

### Импорты:
```typescript
// Было:
import { getAll, create, update, remove, getById, find, findOne } from '@/lib/db';

// Стало:
import { getAllAsync, createAsync, updateAsync, removeAsync, getByIdAsync, findAsync, findOneAsync } from '@/lib/db';
```

### Использование:
```typescript
// Было:
const items = getAll<Type>('collection');
const item = getById<Type>('collection', id);
const newItem = create<Type>('collection', data);
const updated = update<Type>('collection', id, updates);
const deleted = remove('collection', id);

// Стало:
const items = await getAllAsync<Type>('collection');
const item = await getByIdAsync<Type>('collection', id);
const newItem = await createAsync<Type>('collection', data);
const updated = await updateAsync<Type>('collection', id, updates);
const deleted = await removeAsync('collection', id);
```

### Важно:
- Все функции должны вызываться с `await`
- Функции должны вызываться внутри `async function`

