import { NextRequest } from 'next/server';
import { getAllAsync, createAsync } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Category } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories
 *   post:
 *     summary: Create a new category (Admin only)
 *     tags: [Categories]
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
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created successfully
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  try {
    const categories = await getAllAsync<Category>('categories');
    return successResponse(categories);
  } catch (error: any) {
    console.error('Get categories error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);

    const data = await req.json();
    const { name, description, slug } = data;

    if (!name) {
      return errorResponse('Name is required', 400);
    }

    const categorySlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

    const category = await createAsync<Category>('categories', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      slug: categorySlug,
      description,
      createdAt: new Date().toISOString(),
    });

    return successResponse(category, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Create category error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

