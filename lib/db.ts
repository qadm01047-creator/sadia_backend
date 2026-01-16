import fs from 'fs';
import path from 'path';
import { put, list, del } from '@vercel/blob';

// Use Blob Storage in production, fallback to filesystem in development
const USE_BLOB = process.env.BLOB_READ_WRITE_TOKEN !== undefined;

const DB_DIR = path.join(process.cwd(), 'data');
const COLLECTIONS_DIR = path.join(DB_DIR, 'collections');

// Ensure directories exist (only for filesystem mode)
if (!USE_BLOB) {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(COLLECTIONS_DIR)) {
    fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
  }
}

// Get file path for a collection (filesystem mode only)
function getCollectionFilePath(collection: string): string {
  return path.join(COLLECTIONS_DIR, `${collection}.json`);
}

// Read all items from a collection file (filesystem mode)
function readCollectionFS<T>(collection: string): T[] {
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

// Write all items to a collection file (filesystem mode)
function writeCollectionFS<T>(collection: string, items: T[]): void {
  const filePath = getCollectionFilePath(collection);
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
}

// Store blob URLs after first write (for faster reads)
const blobUrlCache: Map<string, string> = new Map();

// Read all items from Blob Storage
async function readCollectionBlob<T>(collection: string): Promise<T[]> {
  try {
    const blobName = `db/${collection}.json`;
    
    // Try to get URL from cache first
    let blobUrl = blobUrlCache.get(blobName);
    
    // If not in cache, search for it
    if (!blobUrl) {
      console.log(`[readCollectionBlob] URL not in cache for ${collection}, searching...`);
      const blobs = await list({ prefix: blobName });
      // Find the most recent blob with exact pathname match
      const matchingBlobs = blobs.blobs
        .filter(b => b.pathname === blobName)
        .sort((a, b) => (b.uploadedAt?.getTime() || 0) - (a.uploadedAt?.getTime() || 0));
      
      if (matchingBlobs.length === 0) {
        console.log(`[readCollectionBlob] No blobs found for ${collection}`);
        return [];
      }
      
      // Use the most recent blob (first in sorted array)
      const matchingBlob = matchingBlobs[0];
      blobUrl = matchingBlob.url;
      blobUrlCache.set(blobName, blobUrl);
      console.log(`[readCollectionBlob] Found ${matchingBlobs.length} blob(s) for ${collection}, using most recent`);
    } else {
      console.log(`[readCollectionBlob] Using cached URL for ${collection}`);
    }

    // Fetch the blob content
    const response = await fetch(blobUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[readCollectionBlob] Blob not found (404), clearing cache for ${collection}`);
        blobUrlCache.delete(blobName);
        return [];
      }
      throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }

    const text = await response.text();
    const items = JSON.parse(text);
    console.log(`[readCollectionBlob] Loaded ${items.length} items from ${collection}`);
    
    // Log sample data for inventory collection
    if (collection === 'inventory' && items.length > 0) {
      console.log(`[readCollectionBlob] Sample inventory items:`, items.slice(0, 3).map((inv: any) => ({
        id: inv.id,
        productId: inv.productId,
        size: inv.size,
        quantity: inv.quantity
      })));
    }
    
    return Array.isArray(items) ? items : [];
  } catch (error: any) {
    console.error(`[readCollectionBlob] Error reading collection ${collection} from Blob:`, error);
    blobUrlCache.delete(`db/${collection}.json`);
    return [];
  }
}

// Write all items to Blob Storage
async function writeCollectionBlob<T>(collection: string, items: T[]): Promise<void> {
  try {
    const blobName = `db/${collection}.json`;
    const content = JSON.stringify(items, null, 2);
    
    console.log(`[writeCollectionBlob] Writing ${items.length} items to ${collection}`);
    
    // Log sample data for inventory collection
    if (collection === 'inventory' && items.length > 0) {
      console.log(`[writeCollectionBlob] Sample inventory items being written:`, items.slice(0, 3).map((inv: any) => ({
        id: inv.id,
        productId: inv.productId,
        size: inv.size,
        quantity: inv.quantity
      })));
    }
    
    // Try to use allowOverwrite if available (v1.0.0+), otherwise delete old blobs first
    const putOptions: any = {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    };

    // Check if allowOverwrite is available (v1.0.0+)
    try {
      // Try to use allowOverwrite (available in v1.0.0+)
      putOptions.allowOverwrite = true;
      const { url } = await put(blobName, content, putOptions);
      blobUrlCache.set(blobName, url);
      console.log(`[writeCollectionBlob] Successfully wrote ${items.length} items to ${collection} using allowOverwrite`);
    } catch (error: any) {
      // If allowOverwrite is not supported (v0.26.0), delete old blobs first
      if (error.message?.includes('allowOverwrite') || error.message?.includes('overwrite')) {
        console.log(`[writeCollectionBlob] allowOverwrite not supported, using delete-then-create approach for ${collection}`);
        
        // Delete existing blobs with the same pathname
        try {
          const blobs = await list({ prefix: blobName });
          const existingBlobs = blobs.blobs.filter(b => b.pathname === blobName);
          
          if (existingBlobs.length > 0) {
            const urlsToDelete = existingBlobs.map(b => b.url);
            await del(urlsToDelete);
            blobUrlCache.delete(blobName);
            console.log(`[writeCollectionBlob] Deleted ${existingBlobs.length} existing blob(s) for ${collection}`);
          }
        } catch (listError) {
          const cachedUrl = blobUrlCache.get(blobName);
          if (cachedUrl) {
            await del(cachedUrl);
            blobUrlCache.delete(blobName);
          }
        }
        
        // Create new blob without allowOverwrite
        delete putOptions.allowOverwrite;
        const { url } = await put(blobName, content, putOptions);
        blobUrlCache.set(blobName, url);
        console.log(`[writeCollectionBlob] Successfully wrote ${items.length} items to ${collection} using delete-then-create`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(`[writeCollectionBlob] Error writing collection ${collection} to Blob:`, error);
    throw error;
  }
}

// Cache for Blob reads (to avoid reading on every request)
const cache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 1000; // 1 second cache

// Read collection (supports both modes)
async function readCollection<T>(collection: string): Promise<T[]> {
  if (USE_BLOB) {
    // Check cache first
    const cached = cache.get(collection);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[readCollection] Using cached data for ${collection} (${cached.data.length} items)`);
      return cached.data;
    }
    
    console.log(`[readCollection] Cache miss or expired for ${collection}, reading from Blob Storage`);
    const data = await readCollectionBlob<T>(collection);
    cache.set(collection, { data, timestamp: Date.now() });
    return data;
  }
  return readCollectionFS<T>(collection);
}

// Write collection (supports both modes)
async function writeCollection<T>(collection: string, items: T[]): Promise<void> {
  if (USE_BLOB) {
    await writeCollectionBlob<T>(collection, items);
    // Update cache immediately after write
    cache.set(collection, { data: items, timestamp: Date.now() });
    console.log(`Updated cache for collection ${collection} with ${items.length} items`);
  } else {
    writeCollectionFS<T>(collection, items);
  }
}

/**
 * Clear cache for a specific collection (useful for forcing refresh)
 */
export function clearCache(collection: string): void {
  console.log(`[clearCache] Clearing cache for ${collection}`);
  cache.delete(collection);
  blobUrlCache.delete(`db/${collection}.json`);
  console.log(`[clearCache] Cache cleared for ${collection}`);
}

/**
 * Get all items from a collection (async version for Blob support)
 */
export async function getAllAsync<T>(collection: string): Promise<T[]> {
  return readCollection<T>(collection);
}

/**
 * Get all items from a collection (sync version - works only in filesystem mode)
 */
export function getAll<T>(collection: string): T[] {
  if (USE_BLOB) {
    // In Blob mode, try to return from cache, otherwise return empty
    const cached = cache.get(collection);
    if (cached) {
      return cached.data;
    }
    // Return empty array and log warning - caller should use async version
    console.warn(`getAll('${collection}') called synchronously but Blob storage is enabled. Use getAllAsync() or await in async context.`);
    return [];
  }
  
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

/**
 * Get item by ID from a collection
 */
export async function getByIdAsync<T>(collection: string, id: string): Promise<T | null> {
  const items = await readCollection<T>(collection);
  return items.find((item: any) => item.id === id) || null;
}

export function getById<T>(collection: string, id: string): T | null {
  const items = getAll<T>(collection);
  return items.find((item: any) => item.id === id) || null;
}

/**
 * Create new item in collection
 */
export async function createAsync<T extends { id?: string }>(collection: string, item: T): Promise<T> {
  if (!item.id) {
    item.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const items = await readCollection<T>(collection);
  
  const existingIndex = items.findIndex((existing: any) => existing.id === item.id);
  if (existingIndex !== -1) {
    items[existingIndex] = { ...items[existingIndex] as T, ...item, id: item.id } as T;
    await writeCollection(collection, items);
    return items[existingIndex];
  }

  items.push(item as T);
  await writeCollection(collection, items);
  return item;
}

export function create<T extends { id?: string }>(collection: string, item: T): T {
  if (USE_BLOB) {
    throw new Error(`create() called synchronously but Blob storage is enabled. Use createAsync() instead.`);
  }

  if (!item.id) {
    item.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const filePath = getCollectionFilePath(collection);
  let items: T[] = [];
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      items = JSON.parse(data);
    } catch (error) {
      console.error(`Error reading collection ${collection}:`, error);
    }
  }
  
  const existingIndex = items.findIndex((existing: any) => existing.id === item.id);
  if (existingIndex !== -1) {
    items[existingIndex] = { ...items[existingIndex] as T, ...item, id: item.id } as T;
    writeCollectionFS(collection, items);
    return items[existingIndex];
  }

  items.push(item as T);
  writeCollectionFS(collection, items);
  return item;
}

/**
 * Update item in collection
 */
export async function updateAsync<T extends { id: string }>(collection: string, id: string, updates: Partial<T>): Promise<T | null> {
  const items = await readCollection<T>(collection);
  const index = items.findIndex((item: any) => item.id === id);
  
  if (index === -1) {
    return null;
  }

  items[index] = { ...items[index] as T, ...updates, id } as T;
  await writeCollection(collection, items);
  return items[index];
}

export function update<T extends { id: string }>(collection: string, id: string, updates: Partial<T>): T | null {
  if (USE_BLOB) {
    throw new Error(`update() called synchronously but Blob storage is enabled. Use updateAsync() instead.`);
  }

  const items = readCollectionFS<T>(collection);
  const index = items.findIndex((item: any) => item.id === id);
  
  if (index === -1) {
    return null;
  }

  items[index] = { ...items[index] as T, ...updates, id } as T;
  writeCollectionFS(collection, items);
  return items[index];
}

/**
 * Delete item from collection
 */
export async function removeAsync(collection: string, id: string): Promise<boolean> {
  const items = await readCollection<any>(collection);
  const index = items.findIndex((item: any) => item.id === id);
  
  if (index === -1) {
    return false;
  }

  items.splice(index, 1);
  await writeCollection(collection, items);
  return true;
}

export function remove(collection: string, id: string): boolean {
  if (USE_BLOB) {
    throw new Error(`remove() called synchronously but Blob storage is enabled. Use removeAsync() instead.`);
  }

  const items = readCollectionFS(collection);
  const index = items.findIndex((item: any) => item.id === id);
  
  if (index === -1) {
    return false;
  }

  items.splice(index, 1);
  writeCollectionFS(collection, items);
  return true;
}

/**
 * Find items by condition
 */
export async function findAsync<T>(collection: string, condition: (item: T) => boolean): Promise<T[]> {
  const items = await readCollection<T>(collection);
  return items.filter(condition);
}

export function find<T>(collection: string, condition: (item: T) => boolean): T[] {
  const items = getAll<T>(collection);
  return items.filter(condition);
}

/**
 * Find one item by condition
 */
export async function findOneAsync<T>(collection: string, condition: (item: T) => boolean): Promise<T | null> {
  const items = await readCollection<T>(collection);
  return items.find(condition) || null;
}

export function findOne<T>(collection: string, condition: (item: T) => boolean): T | null {
  const items = getAll<T>(collection);
  return items.find(condition) || null;
}

/**
 * Count items by condition
 */
export async function countAsync(collection: string, condition?: (item: any) => boolean): Promise<number> {
  const items = await readCollection(collection);
  if (!condition) {
    return items.length;
  }
  return items.filter(condition).length;
}

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
export async function readDBAsync(): Promise<any> {
  const collections = ['users', 'categories', 'products', 'reviews', 'supportMessages', 'orders', 'orderItems', 'payments', 'inventory', 'saleAnalytics', 'coupons', 'exchanges'];
  const db: any = {};
  
  for (const collection of collections) {
    db[collection] = await readCollection(collection);
  }
  
  return db;
}

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
  console.warn('writeDB is deprecated. Use individual create/update/remove functions instead.');
}
