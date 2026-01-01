import { NextRequest } from 'next/server';
import { getAllAsync, createAsync } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Inventory, Product } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/inventory:
 *   get:
 *     summary: Get all inventory items (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of inventory items
 *       403:
 *         description: Forbidden
 *   post:
 *     summary: Create inventory item (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Inventory item created
 *       403:
 *         description: Forbidden
 */
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const inventory = await getAllAsync<Inventory>('inventory');
    const products = await getAllAsync<Product>('products');

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
    const products = await getAllAsync<Product>('products');
    const product = products.find(p => p.id === productId);
    if (!product) {
      return errorResponse('Product not found', 404);
    }

    // Check if inventory item already exists for this product and size
    const inventory = await getAllAsync<Inventory>('inventory');
    const existingItem = inventory.find(
      item => item.productId === productId && item.size === size
    );

    if (existingItem) {
      return errorResponse('Inventory item for this product and size already exists. Use PUT to update.', 400);
    }

    const inventoryItem = await createAsync<Inventory>('inventory', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

