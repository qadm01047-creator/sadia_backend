import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import fs from 'fs';
import path from 'path';
import { getAllAsync } from '@/lib/db';
import { put } from '@vercel/blob';

const COLLECTIONS_DIR = path.join(process.cwd(), 'data', 'collections');

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

export const dynamic = 'force-dynamic';

/**
 * Migrate data from local files to Blob Storage
 */
export async function POST(req: NextRequest) {
  try {
    requireSuperAdmin(req);

    // Check if BLOB_READ_WRITE_TOKEN is set
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return errorResponse('BLOB_READ_WRITE_TOKEN is not set. Blob Storage is not configured.', 500);
    }

    const results: Record<string, { migrated: number; total: number; skipped: boolean; error?: string }> = {};

    for (const collection of COLLECTIONS) {
      const filePath = path.join(COLLECTIONS_DIR, `${collection}.json`);
      
      if (!fs.existsSync(filePath)) {
        results[collection] = { migrated: 0, total: 0, skipped: true };
        continue;
      }

      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const items = JSON.parse(fileContent);
        
        if (!Array.isArray(items) || items.length === 0) {
          results[collection] = { migrated: 0, total: 0, skipped: true };
          continue;
        }

        // Check if collection already has data in Blob Storage
        const existingItems = await getAllAsync(collection);
        if (existingItems.length > 0) {
          results[collection] = { 
            migrated: 0, 
            total: items.length, 
            skipped: true,
            error: `Collection already has ${existingItems.length} items. Delete existing data first if you want to overwrite.`
          };
          continue;
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
          results[collection] = { migrated: items.length, total: items.length, skipped: false };
        } catch (error: any) {
          results[collection] = { 
            migrated: 0, 
            total: items.length, 
            skipped: false,
            error: error.message 
          };
        }
      } catch (error: any) {
        results[collection] = { 
          migrated: 0, 
          total: 0, 
          skipped: false,
          error: error.message 
        };
      }
    }

    const totalMigrated = Object.values(results).reduce((sum, r) => sum + r.migrated, 0);
    const totalItems = Object.values(results).reduce((sum, r) => sum + r.total, 0);

    return successResponse({
      message: `Migration complete: ${totalMigrated}/${totalItems} items migrated`,
      results,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Migration error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
