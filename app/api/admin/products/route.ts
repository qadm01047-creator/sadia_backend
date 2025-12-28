import { NextRequest } from 'next/server';
import { getAll } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product } from '@/types';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const products = getAll<Product>('products');
    return successResponse(products);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get admin products error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

