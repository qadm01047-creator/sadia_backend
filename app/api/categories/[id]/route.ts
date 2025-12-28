import { NextRequest } from 'next/server';
import { getById, update, remove } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Category } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const category = getById<Category>('categories', params.id);

    if (!category) {
      return errorResponse('Category not found', 404);
    }

    return successResponse(category);
  } catch (error: any) {
    console.error('Get category error:', error);
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

    const updatedCategory = update<Category>('categories', params.id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedCategory) {
      return errorResponse('Category not found', 404);
    }

    return successResponse(updatedCategory);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Update category error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const deleted = remove('categories', params.id);

    if (!deleted) {
      return errorResponse('Category not found', 404);
    }

    return successResponse({ message: 'Category deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Delete category error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

