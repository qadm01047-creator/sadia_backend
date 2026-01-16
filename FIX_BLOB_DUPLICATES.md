# Исправление проблемы с дубликатами файлов в Blob Storage

## Проблема

При каждом изменении данных в базе данных на Vercel создавался новый файл в Blob Storage, что приводило к накоплению дубликатов файлов.

## Решение

Исправлена функция `writeCollectionBlob` в `lib/db.ts`:

1. **Удаление старых blobs перед созданием нового** - для версий `@vercel/blob < 1.0.0` (например, 0.26.0), которые не поддерживают `allowOverwrite`, мы сначала удаляем все существующие blobs с таким же pathname, затем создаем новый
2. **Добавлена опция `addRandomSuffix: false`** - гарантирует, что имя файла остается одинаковым

**Примечание:** Если вы обновите `@vercel/blob` до версии 1.0.0+, можно использовать `allowOverwrite: true` вместо удаления старых blobs.

## Что изменилось

### До:
```typescript
const { url } = await put(blobName, content, {
  access: 'public',
  contentType: 'application/json',
});
```

### После:
```typescript
// Delete existing blobs with the same pathname first
const blobs = await list({ prefix: blobName });
const existingBlobs = blobs.blobs.filter(b => b.pathname === blobName);
if (existingBlobs.length > 0) {
  await del(existingBlobs.map(b => b.url));
  blobUrlCache.delete(blobName);
}

// Create new blob
const { url } = await put(blobName, content, {
  access: 'public',
  contentType: 'application/json',
  addRandomSuffix: false, // Keep the same filename
});
```

**Для версий @vercel/blob >= 1.0.0:**
```typescript
const { url } = await put(blobName, content, {
  access: 'public',
  contentType: 'application/json',
  addRandomSuffix: false,
  allowOverwrite: true, // Available in v1.0.0+
});
```

## Результат

Теперь при каждом обновлении данных:
- ✅ Существующий файл обновляется (не создается новый)
- ✅ Нет накопления дубликатов файлов
- ✅ URL файла остается постоянным (кешируется для быстрого доступа)

## Очистка старых дубликатов

Если у вас уже накопились дубликаты файлов в Blob Storage:

1. Перейдите в настройки проекта на Vercel
2. Откройте вкладку "Storage" → "Blob"
3. Найдите файлы с префиксом `db/` (например, `db/products.json`)
4. Удалите старые версии, оставив только самую последнюю

Или используйте Vercel CLI:
```bash
vercel blob list --prefix db/
# Затем удалите старые версии вручную через веб-интерфейс
```

## Проверка

После деплоя изменений:
1. Сделайте любое изменение в базе данных (создайте/обновите товар, пользователя и т.д.)
2. Проверьте Blob Storage - должен быть только один файл для каждой коллекции
3. Убедитесь, что изменения сохраняются корректно
