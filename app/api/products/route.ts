import { NextRequest } from 'next/server';
import { getAllAsync, createAsync } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product, Category } from '@/types';
import { normalizeProducts } from '@/lib/image-urls';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search products by name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Product'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *   post:
 *     summary: Create a new product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *               - price
 *               - categoryId
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               categoryId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Product created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    let products = await getAllAsync<Product>('products');
    const categories = await getAllAsync<Category>('categories');

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

    // Normalize image URLs to ensure blob storage URLs are used
    const normalizedProducts = normalizeProducts(paginatedProducts);

    return successResponse({
      data: normalizedProducts,
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
    } = data;

    if (!name || !price || !categoryId) {
      return errorResponse('Name, price, and categoryId are required', 400);
    }

    const productSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const profit = costPrice ? price - costPrice : undefined;

    const product = await createAsync<Product>('products', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      slug: productSlug,
      description,
      price,
      costPrice,
      profit,
      categoryId,
      sku,
      active_for_pos: active_for_pos ?? false,
      offline_price: offline_price ?? null,
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

