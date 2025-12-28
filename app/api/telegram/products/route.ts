import { NextRequest } from 'next/server';
import { getAll } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product } from '@/types';

// Public endpoint for Telegram bot to get products
export async function GET(req: NextRequest) {
  try {
    const products = getAll<Product>('products');
    
    // Return simplified product data for Telegram (include images)
    const simplifiedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      categoryId: p.categoryId,
      images: p.images || [],
    }));

    return successResponse(simplifiedProducts);
  } catch (error: any) {
    console.error('Get Telegram products error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

