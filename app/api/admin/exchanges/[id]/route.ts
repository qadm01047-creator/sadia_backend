import { NextRequest } from 'next/server';
import { requireAdmin } from '@/middleware/auth';
import { getById, remove } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Exchange } from '@/types';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);
    const { id } = params;

    const exchange = getById<Exchange>('exchanges', id);
    if (!exchange) {
      return errorResponse('Exchange not found', 404);
    }

    remove('exchanges', id);
    return successResponse({ message: 'Exchange deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Delete exchange error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

