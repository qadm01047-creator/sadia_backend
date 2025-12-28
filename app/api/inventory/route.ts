import { NextRequest } from 'next/server';
import { getAll, create } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Inventory, Product } from '@/types';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const inventory = getAll<Inventory>('inventory');
    const products = getAll<Product>('products');

    // Populate product information for each inventory item
    const inventoryWithProducts = inventory.map(item => ({
      ...item,
      product: products.find(p => p.id === item.productId) || null,
    }));

    return successResponse(inventoryWithProducts);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get inventory error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);

    const data = await req.json();
    const { productId, size, quantity } = data;

    if (!productId || !size || quantity === undefined) {
      return errorResponse('productId, size, and quantity are required', 400);
    }

    // Check if product exists
    const products = getAll<Product>('products');
    const product = products.find(p => p.id === productId);
    if (!product) {
      return errorResponse('Product not found', 404);
    }

    // Check if inventory item already exists for this product and size
    const inventory = getAll<Inventory>('inventory');
    const existingItem = inventory.find(
      item => item.productId === productId && item.size === size
    );

    if (existingItem) {
      return errorResponse('Inventory item for this product and size already exists. Use PUT to update.', 400);
    }

    const inventoryItem = create<Inventory>('inventory', {
      productId,
      size,
      quantity: parseInt(quantity.toString()),
      updatedAt: new Date().toISOString(),
    });

    return successResponse(inventoryItem, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Create inventory error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

