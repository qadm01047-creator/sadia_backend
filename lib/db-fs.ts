import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const COLLECTIONS_DIR = path.join(DB_DIR, 'collections');

// Ensure directories exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(COLLECTIONS_DIR)) {
  fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
}

// Get file path for a collection
function getCollectionFilePath(collection: string): string {
  return path.join(COLLECTIONS_DIR, `${collection}.json`);
}

// Read all items from a collection file
function readCollection<T>(collection: string): T[] {
  const filePath = getCollectionFilePath(collection);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const items = JSON.parse(data);
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error(`Error reading collection ${collection}:`, error);
    return [];
  }
}

// Write all items to a collection file
function writeCollection<T>(collection: string, items: T[]): void {
  const filePath = getCollectionFilePath(collection);
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
}

/**
 * Get all items from a collection
 */
export function getAll<T>(collection: string): T[] {
  return readCollection<T>(collection);
}

/**
 * Get item by ID from a collection
 */
export function getById<T>(collection: string, id: string): T | null {
  const items = readCollection<T>(collection);
  return items.find((item: any) => item.id === id) || null;
}

/**
 * Create new item in collection
 */
export function create<T extends { id?: string }>(collection: string, item: T): T {
  // Generate ID if not provided
  if (!item.id) {
    item.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const items = readCollection<T>(collection);
  
  // Check if item with this ID already exists
  const existingIndex = items.findIndex((existing: any) => existing.id === item.id);
  if (existingIndex !== -1) {
    // Update existing item
    items[existingIndex] = { ...items[existingIndex], ...item, id: item.id };
    writeCollection(collection, items);
    return items[existingIndex];
  }

  // Add new item
  items.push(item as T);
  writeCollection(collection, items);
  return item;
}

/**
 * Update item in collection
 */
export function update<T extends { id: string }>(collection: string, id: string, updates: Partial<T>): T | null {
  const items = readCollection<T>(collection);
  const index = items.findIndex((item: any) => item.id === id);
  
  if (index === -1) {
    return null;
  }

  // Update item
  items[index] = { ...items[index], ...updates, id }; // Ensure ID is preserved
  writeCollection(collection, items);
  return items[index];
}

/**
 * Delete item from collection
 */
export function remove(collection: string, id: string): boolean {
  const items = readCollection<any>(collection);
  const index = items.findIndex((item: any) => item.id === id);
  
  if (index === -1) {
    return false;
  }

  // Remove item
  items.splice(index, 1);
  writeCollection(collection, items);
  return true;
}

/**
 * Find items by condition
 */
export function find<T>(collection: string, condition: (item: T) => boolean): T[] {
  const items = getAll<T>(collection);
  return items.filter(condition);
}

/**
 * Find one item by condition
 */
export function findOne<T>(collection: string, condition: (item: T) => boolean): T | null {
  const items = getAll<T>(collection);
  return items.find(condition) || null;
}

/**
 * Count items by condition
 */
export function count(collection: string, condition?: (item: any) => boolean): number {
  const items = getAll(collection);
  if (!condition) {
    return items.length;
  }
  return items.filter(condition).length;
}

/**
 * Read entire database (for backward compatibility / migration)
 */
export function readDB(): any {
  const collections = ['users', 'categories', 'products', 'reviews', 'supportMessages', 'orders', 'orderItems', 'payments', 'inventory', 'saleAnalytics', 'coupons', 'exchanges'];
  const db: any = {};
  
  for (const collection of collections) {
    db[collection] = getAll(collection);
  }
  
  return db;
}

/**
 * Write entire database (deprecated - use individual create/update/remove)
 */
export function writeDB(data: any): void {
  // This function is deprecated - we use individual collection files now
  console.warn('writeDB is deprecated. Use individual create/update/remove functions instead.');
}

