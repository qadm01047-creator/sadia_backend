import { NextRequest } from 'next/server';
import { getAll } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order } from '@/types';

// Public endpoint for Telegram bot to get user orders
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramUserId = searchParams.get('telegramUserId');

    if (!telegramUserId) {
      return errorResponse('telegramUserId is required', 400);
    }

    // Get all orders and filter by telegramUserId
    const orders = getAll<Order>('orders')
      .filter(o => o.telegramUserId === telegramUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return successResponse(orders);
  } catch (error: any) {
    console.error('Get Telegram orders error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

