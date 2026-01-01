import { NextRequest } from 'next/server';
import { getByIdAsync, updateAsync, removeAsync, getAllAsync } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product, Category } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 *   put:
 *     summary: Update product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product updated
 *       404:
 *         description: Product not found
 *   delete:
 *     summary: Delete product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product deleted
 *       404:
 *         description: Product not found
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await getByIdAsync<Product>('products', params.id);

    if (!product) {
      return errorResponse('Product not found', 404);
    }

    // Populate category
    const categories = await getAllAsync<Category>('categories');
    const category = categories.find(cat => cat.id === product.categoryId) || null;

    // Populate images
    const images = product.images || [];

    return successResponse({
      ...product,
      category,
      images: images.sort((a, b) => (a.order || 0) - (b.order || 0)),
    });
  } catch (error: any) {
    console.error('Get product error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const data = await req.json();
    const { name, description, price, costPrice, categoryId, slug } = data;

    const existingProduct = await getByIdAsync<Product>('products', params.id);
    if (!existingProduct) {
      return errorResponse('Product not found', 404);
    }

    const productSlug = slug || name?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || existingProduct.slug;
    const profit = costPrice !== undefined ? (price || existingProduct.price) - costPrice : existingProduct.profit;

    const updatedProduct = await updateAsync<Product>('products', params.id, {
      ...data,
      slug: productSlug,
      profit,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedProduct) {
      return errorResponse('Product not found', 404);
    }

    return successResponse(updatedProduct);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Update product error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const deleted = await removeAsync('products', params.id);

    if (!deleted) {
      return errorResponse('Product not found', 404);
    }

    return successResponse({ message: 'Product deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Delete product error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

