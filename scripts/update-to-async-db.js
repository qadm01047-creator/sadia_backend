// Скрипт для автоматического обновления всех API routes на async версии функций db
// Запуск: node scripts/update-to-async-db.js

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const API_DIR = path.join(__dirname, '../app/api');

// Маппинг синхронных функций на async версии
const functionMap = {
  'getAll': 'getAllAsync',
  'getById': 'getByIdAsync',
  'create': 'createAsync',
  'update': 'updateAsync',
  'remove': 'removeAsync',
  'find': 'findAsync',
  'findOne': 'findOneAsync',
  'count': 'countAsync',
  'readDB': 'readDBAsync',
};

// Найти все route.ts файлы
const routeFiles = glob.sync('**/route.ts', { cwd: API_DIR, absolute: true });

console.log(`Found ${routeFiles.length} route files`);

let totalUpdated = 0;

routeFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;
  let needsAsyncImport = false;

  // Проверить импорты
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/db['"]/;
  const importMatch = content.match(importRegex);
  
  if (importMatch) {
    let imports = importMatch[1];
    let newImports = imports;
    
    // Заменить функции в импортах
    Object.keys(functionMap).forEach(syncFunc => {
      const regex = new RegExp(`\\b${syncFunc}\\b`, 'g');
      if (regex.test(imports)) {
        newImports = newImports.replace(regex, functionMap[syncFunc]);
        needsAsyncImport = true;
        updated = true;
      }
    });
    
    if (needsAsyncImport) {
      content = content.replace(importRegex, `import {${newImports}} from '@/lib/db'`);
    }
  }

  // Заменить вызовы функций (добавить await перед async функциями)
  Object.keys(functionMap).forEach(syncFunc => {
    const asyncFunc = functionMap[syncFunc];
    // Паттерн для поиска вызовов функций (не в комментариях)
    const regex = new RegExp(`(\\b${syncFunc})\\s*\\(`, 'g');
    if (regex.test(content) && !content.includes(asyncFunc)) {
      // Заменить вызовы функций
      content = content.replace(regex, `await ${asyncFunc}(`);
      updated = true;
    }
  });

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${path.relative(process.cwd(), filePath)}`);
    totalUpdated++;
  }
});

console.log(`\n✅ Updated ${totalUpdated} files`);
console.log('\n⚠️  Please review the changes and test your API routes!');

