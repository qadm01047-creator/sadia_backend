import { NextRequest } from 'next/server';
import { getAll } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { NewsletterSubscription } from '@/types';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const subscriptions = getAll<NewsletterSubscription>('newsletterSubscriptions');
    return successResponse(subscriptions);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get newsletter subscribers error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

