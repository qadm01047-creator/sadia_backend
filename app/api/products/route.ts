import { NextRequest } from 'next/server';
import { getAll, create } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product, Category } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    let products = getAll<Product>('products');
    const categories = getAll<Category>('categories');

    // Populate category for each product
    products = products.map(product => ({
      ...product,
      category: categories.find(cat => cat.id === product.categoryId) || null,
    }));

    // Filter by category
    if (categoryId) {
      products = products.filter(p => p.categoryId === categoryId);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const total = products.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedProducts = products.slice(offset, offset + limit);

    return successResponse({
      data: paginatedProducts,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Get products error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);

    const data = await req.json();
    const { name, description, price, costPrice, categoryId, slug } = data;

    if (!name || !price || !categoryId) {
      return errorResponse('Name, price, and categoryId are required', 400);
    }

    const productSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const profit = costPrice ? price - costPrice : undefined;

    const product = create<Product>('products', {
      name,
      slug: productSlug,
      description,
      price,
      costPrice,
      profit,
      categoryId,
      createdAt: new Date().toISOString(),
    });

    return successResponse(product, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Create product error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

