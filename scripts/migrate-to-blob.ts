import fs from 'fs';
import path from 'path';
import { getAllAsync } from '../lib/db';
import { put } from '@vercel/blob';

const COLLECTIONS_DIR = path.join(process.cwd(), 'data', 'collections');

// List of all collections to migrate
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
  'newsletterSubscriptions',
];

async function migrateCollection(collection: string) {
  const filePath = path.join(COLLECTIONS_DIR, `${collection}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${collection}.json`);
    return;
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const items = JSON.parse(fileContent);
    
    if (!Array.isArray(items)) {
      console.log(`⚠️  ${collection}.json is not an array, skipping`);
      return;
    }

    if (items.length === 0) {
      console.log(`ℹ️  ${collection}.json is empty, skipping`);
      return;
    }

    console.log(`📦 Migrating ${collection}... (${items.length} items)`);
    
    // Read existing items from Blob Storage first
    const { getAllAsync } = await import('../lib/db');
    const existingItems = await getAllAsync(collection);
    
    if (existingItems.length > 0) {
      console.log(`⚠️  ${collection} already has ${existingItems.length} items in Blob Storage. Skipping to avoid duplicates.`);
      console.log(`   If you want to overwrite, delete the blob first in Vercel dashboard.`);
      return;
    }

    // Write all items to Blob Storage at once
    const blobName = `db/${collection}.json`;
    const content = JSON.stringify(items, null, 2);
    
    try {
      await put(blobName, content, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true, // Overwrite if exists
      });
      console.log(`✅ Migrated ${items.length} items from ${collection} to Blob Storage`);
    } catch (error: any) {
      console.error(`   Error writing to Blob Storage:`, error.message);
      throw error;
    }
  } catch (error: any) {
    console.error(`❌ Error migrating ${collection}:`, error.message);
  }
}

async function migrateAll() {
  console.log('🚀 Starting migration to Blob Storage...\n');
  
  // Check if BLOB_READ_WRITE_TOKEN is set
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ BLOB_READ_WRITE_TOKEN is not set!');
    console.error('   Please set it in your .env.local file or Vercel environment variables.');
    process.exit(1);
  }

  console.log('✅ BLOB_READ_WRITE_TOKEN is set\n');

  for (const collection of COLLECTIONS) {
    await migrateCollection(collection);
    console.log(''); // Empty line for readability
  }

  console.log('✨ Migration complete!');
}

migrateAll().catch(console.error);
