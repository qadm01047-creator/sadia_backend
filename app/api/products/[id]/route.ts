import { NextRequest } from 'next/server';
import { getById, update, remove, getAll } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product, Category } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = getById<Product>('products', params.id);

    if (!product) {
      return errorResponse('Product not found', 404);
    }

    // Populate category
    const categories = getAll<Category>('categories');
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

    const existingProduct = getById<Product>('products', params.id);
    if (!existingProduct) {
      return errorResponse('Product not found', 404);
    }

    const productSlug = slug || name?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || existingProduct.slug;
    const profit = costPrice !== undefined ? (price || existingProduct.price) - costPrice : existingProduct.profit;

    const updatedProduct = update<Product>('products', params.id, {
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

    const deleted = remove('products', params.id);

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

