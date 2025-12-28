import { NextRequest } from 'next/server';
import { getAll } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Inventory } from '@/types';

// Public endpoint for Telegram bot to get inventory
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    const inventory = getAll<Inventory>('inventory');

    if (productId) {
      const filtered = inventory.filter((inv) => inv.productId === productId);
      return successResponse(filtered);
    }

    return successResponse(inventory);
  } catch (error: any) {
    console.error('Get Telegram inventory error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

