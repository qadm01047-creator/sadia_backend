import { NextRequest } from 'next/server';
import { getByIdAsync, updateAsync, removeAsync, getAllAsync } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product, Category, Inventory } from '@/types';
import { normalizeProduct } from '@/lib/image-urls';

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

    // Populate inventory
    const inventory = await getAllAsync<Inventory>('inventory');
    const productInventory = inventory.filter(inv => inv.productId === product.id);
    
    // Debug logging
    console.log(`Product ${product.id} - Total inventory items: ${inventory.length}, Product inventory: ${productInventory.length}`);

    // Populate images
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
    const {
      name,
      description,
      price,
      costPrice,
      categoryId,
      slug,
      sku,
      active_for_pos,
      offline_price,
      images,
    } = data;

    const existingProduct = await getByIdAsync<Product>('products', params.id);
    if (!existingProduct) {
      return errorResponse('Product not found', 404);
    }

    const productSlug = slug || name?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || existingProduct.slug;
    const nextPrice = price ?? existingProduct.price;
    const nextCost = costPrice !== undefined ? costPrice : existingProduct.costPrice;
    const profit = nextCost !== undefined ? nextPrice - nextCost : existingProduct.profit;

    // Prepare update object
    const updateData: any = {
      slug: productSlug,
      price: nextPrice,
      costPrice: nextCost,
      profit,
      sku: sku ?? existingProduct.sku,
      active_for_pos: active_for_pos ?? existingProduct.active_for_pos ?? false,
      offline_price: offline_price ?? existingProduct.offline_price ?? null,
      updatedAt: new Date().toISOString(),
    };

    // Include images if provided (for reordering)
    if (images !== undefined && Array.isArray(images)) {
      updateData.images = images;
      console.log(`Updating product ${params.id} with ${images.length} images`);
    }

    // Include other fields if provided
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    const updatedProduct = await updateAsync<Product>('products', params.id, updateData);

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

