import { NextRequest } from 'next/server';
import { getAll, update, remove } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Review } from '@/types';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const reviews = getAll<Review>('reviews');
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return successResponse(reviews);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get reviews error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    requireAdmin(req);

    const { id, approved } = await req.json();

    if (!id || approved === undefined) {
      return errorResponse('ID and approved status are required', 400);
    }

    const updated = update<Review>('reviews', id, { approved });

    if (!updated) {
      return errorResponse('Review not found', 404);
    }

    return successResponse(updated);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Update review error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('ID is required', 400);
    }

    const deleted = remove('reviews', id);

    if (!deleted) {
      return errorResponse('Review not found', 404);
    }

    return successResponse({ message: 'Review deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Delete review error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

