import { NextRequest } from 'next/server';
import { getAllAsync, findOneAsync } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product, Category, Inventory } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/products/slug/{slug}:
 *   get:
 *     summary: Get product by slug
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const product = await findOneAsync<Product>('products', (p) => p.slug === params.slug);

    if (!product) {
      return errorResponse('Product not found', 404);
    }

    // Populate category
    const categories = await getAllAsync<Category>('categories');
    const category = categories.find(cat => cat.id === product.categoryId) || null;

    // Populate inventory
    const inventory = await getAllAsync<Inventory>('inventory');
    const productInventory = inventory.filter(inv => inv.productId === product.id);

    // Get images (if stored separately, otherwise use product.images)
    const images = product.images || [];

    return successResponse({
      ...product,
      category,
      inventory: productInventory,
      images: images.sort((a, b) => (a.order || 0) - (b.order || 0)),
    });
  } catch (error: any) {
    console.error('Get product by slug error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

