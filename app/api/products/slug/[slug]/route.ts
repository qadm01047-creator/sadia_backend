import { NextRequest } from 'next/server';
import { getAllAsync, findOneAsync } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product, Category, Inventory } from '@/types';
import { normalizeProduct } from '@/lib/image-urls';

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
    const DEBUG = process.env.DEBUG_DB === 'true' || process.env.NODE_ENV === 'development';
    
    if (DEBUG) console.log(`Fetching product by slug: ${params.slug}`);
    
    const product = await findOneAsync<Product>('products', (p) => p.slug === params.slug);

    if (!product) {
      if (DEBUG) console.log(`Product not found for slug: ${params.slug}`);
      return errorResponse('Product not found', 404);
    }

    // Populate category
    const categories = await getAllAsync<Category>('categories');
    const category = categories.find(cat => cat.id === product.categoryId) || null;

    // Populate inventory
    const inventory = await getAllAsync<Inventory>('inventory');
    
    // Use strict equality check
    const productInventory = inventory.filter(inv => inv.productId === product.id);
    
    if (DEBUG && productInventory.length === 0 && inventory.length > 0) {
      console.warn(`⚠️ No inventory items found for product ${product.id}, but ${inventory.length} total items exist`);
    }

    // Get images (if stored separately, otherwise use product.images)
    const images = product.images || [];

    // Normalize image URLs to ensure blob storage URLs are used
    const normalizedProduct = normalizeProduct({
      ...product,
      category,
      inventory: productInventory,
      images: images.sort((a, b) => (a.order || 0) - (b.order || 0)),
    });

    return successResponse(normalizedProduct);
  } catch (error: any) {
    console.error('Get product by slug error:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

