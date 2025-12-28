import fs from 'fs';
import path from 'path';

const COLLECTIONS_DIR = path.join(process.cwd(), 'data', 'collections');

// List of all collections
const COLLECTIONS = [
  'users',
  'categories',
  'products',
  'orders',
  'orderItems',
  'inventory',
  'reviews',
  'supportMessages',
  'coupons',
  'payments',
  'exchanges',
];

function clearDatabase() {
  console.log('🗑️ Clearing database...');

  if (!fs.existsSync(COLLECTIONS_DIR)) {
    console.log('ℹ️ Collections directory does not exist, nothing to clear');
    return;
  }

  let clearedCount = 0;
  for (const collection of COLLECTIONS) {
    const filePath = path.join(COLLECTIONS_DIR, `${collection}.json`);
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf8');
      clearedCount++;
      console.log(`✅ Cleared ${collection}`);
    }
  }

  console.log(`✨ Cleared ${clearedCount} collections`);
}

clearDatabase();
process.exit(0);

