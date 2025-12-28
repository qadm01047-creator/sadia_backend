import { NextRequest } from 'next/server';
import { getAll, getById } from '@/lib/db';
import { requireSuperAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

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
] as const;

export async function GET(req: NextRequest) {
  try {
    requireSuperAdmin(req);

    const { searchParams } = new URL(req.url);
    const collection = searchParams.get('collection');
    const itemId = searchParams.get('itemId');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get overview of all collections
    if (!collection) {
      const overview = COLLECTIONS.map((col) => {
        try {
          const items = getAll(col as any);
          return {
            name: col,
            count: items.length,
            sample: items.slice(0, 3),
          };
        } catch (error) {
          return {
            name: col,
            count: 0,
            sample: [],
            error: 'Failed to read collection',
          };
        }
      });

      return successResponse(overview);
    }

    // Get specific collection
    if (!COLLECTIONS.includes(collection as any)) {
      return errorResponse('Invalid collection name', 400);
    }

    // Get specific item from collection
    if (itemId) {
      const item = getById(collection as any, itemId);
      if (!item) {
        return errorResponse('Item not found', 404);
      }
      return successResponse(item);
    }

    // Get all items from collection (with limit)
    const items = getAll(collection as any);
    const limitedItems = items.slice(0, limit);

    return successResponse({
      collection,
      total: items.length,
      items: limitedItems,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get database error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSuperAdmin(req);

    const data = await req.json();
    const { action } = data;

    // Export full database
    if (action === 'export') {
      const exportData: Record<string, any> = {};
      
      for (const collection of COLLECTIONS) {
        try {
          exportData[collection] = getAll(collection as any);
        } catch (error) {
          exportData[collection] = [];
          console.error(`Failed to export ${collection}:`, error);
        }
      }

      return successResponse(exportData);
    }

    return errorResponse('Invalid action', 400);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Database action error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

