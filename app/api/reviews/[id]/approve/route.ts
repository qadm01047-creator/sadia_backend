import { NextRequest } from 'next/server';
import { getById, update } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Review } from '@/types';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const review = getById<Review>('reviews', params.id);
    if (!review) {
      return errorResponse('Review not found', 404);
    }

    const updated = update<Review>('reviews', params.id, { approved: true });

    return successResponse(updated);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Approve review error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}


