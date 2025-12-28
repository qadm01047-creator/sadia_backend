import { NextRequest } from 'next/server';
import { getAll, update } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { SupportMessage } from '@/types';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const messages = getAll<SupportMessage>('supportMessages');
    messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return successResponse(messages);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get support messages error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    requireAdmin(req);

    const { id, responded } = await req.json();

    if (!id) {
      return errorResponse('Message ID is required', 400);
    }

    const updated = update<SupportMessage>('supportMessages', id, {
      responded: responded !== undefined ? responded : true,
    });

    if (!updated) {
      return errorResponse('Message not found', 404);
    }

    return successResponse(updated);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Update support message error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

