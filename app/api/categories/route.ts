import { NextRequest } from 'next/server';
import { getAll, create } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Category } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const categories = getAll<Category>('categories');
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

    const category = create<Category>('categories', {
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

