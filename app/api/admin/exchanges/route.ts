import { NextRequest } from 'next/server';
import { requireAdmin } from '@/middleware/auth';
import { getAll } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Exchange } from '@/types';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const exchanges = getAll<Exchange>('exchanges');
    return successResponse(exchanges);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get exchanges error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

