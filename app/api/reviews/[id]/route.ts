import { NextRequest } from 'next/server';
import { getById, remove } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Review } from '@/types';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const review = getById<Review>('reviews', params.id);
    if (!review) {
      return errorResponse('Review not found', 404);
    }

    const deleted = remove('reviews', params.id);

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


