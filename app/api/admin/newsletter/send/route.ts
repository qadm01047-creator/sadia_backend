import { NextRequest } from 'next/server';
import { getAll } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { NewsletterSubscription } from '@/types';

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const data = await req.json();
    const { subject, message } = data;

    if (!subject || !message) {
      return errorResponse('Subject and message are required', 400);
    }

    const subscriptions = getAll<NewsletterSubscription>('newsletterSubscriptions');
    
    if (subscriptions.length === 0) {
      return errorResponse('No subscribers found', 400);
    }

    // В реальном приложении здесь была бы отправка email
    // Для демонстрации просто возвращаем информацию о рассылке
    const emailList = subscriptions.map(sub => sub.email);

    return successResponse({
      sent: true,
      recipientsCount: subscriptions.length,
      recipients: emailList,
      subject,
      message,
      sentAt: new Date().toISOString(),
    }, 200);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Send newsletter error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

