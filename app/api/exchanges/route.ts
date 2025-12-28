import { NextRequest } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { create, getAll, getById } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Exchange, Order } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const data = await req.json();
    const { orderId, productId, reason, type = 'EXCHANGE' } = data;

    if (!orderId || !reason) {
      return errorResponse('Order ID and reason are required', 400);
    }

    // Проверить, существует ли заказ
    const order = getById<Order>('orders', orderId);
    if (!order) {
      return errorResponse('Order not found', 404);
    }

    // Проверить, что заказ принадлежит пользователю (для обычных пользователей)
    if (user.role === 'USER' && order.userId && order.userId !== user.id) {
      return errorResponse('You can only create exchange requests for your own orders', 403);
    }

    // Проверить, что заказ еще не отменен
    if (order.status === 'CANCELLED') {
      return errorResponse('Cannot create exchange request for cancelled order', 400);
    }

    // Проверить, нет ли уже запроса на отмену/обмен для этого заказа
    const existingExchanges = getAll<Exchange>('exchanges');
    const hasPendingRequest = existingExchanges.some(
      (ex) => ex.orderId === orderId && ex.status === 'PENDING'
    );
    if (hasPendingRequest) {
      return errorResponse('You already have a pending request for this order', 400);
    }

    // Создать запрос на обмен/отмену
    const exchange = create<Exchange>('exchanges', {
      orderId,
      productId: productId || undefined, // null для отмены всего заказа
      reason,
      type: type === 'CANCELLATION' ? 'CANCELLATION' : 'EXCHANGE',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    return successResponse(exchange, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    console.error('Create exchange error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

