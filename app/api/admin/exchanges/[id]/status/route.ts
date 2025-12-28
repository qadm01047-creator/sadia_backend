import { NextRequest } from 'next/server';
import { requireAdmin } from '@/middleware/auth';
import { getById, update, getAll } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Exchange, Order } from '@/types';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);
    const { status } = await req.json();
    const { id } = params;

    if (!status) {
      return errorResponse('Status is required', 400);
    }

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return errorResponse('Invalid status', 400);
    }

    const exchange = getById<Exchange>('exchanges', id);
    if (!exchange) {
      return errorResponse('Exchange not found', 404);
    }

    // Если статус изменяется на APPROVED и это запрос на отмену заказа
    if (status === 'APPROVED' && exchange.type === 'CANCELLATION') {
      const order = getById<Order>('orders', exchange.orderId);
      if (order && order.status !== 'CANCELLED') {
        // Отменить заказ
        update<Order>('orders', order.id, {
          status: 'CANCELLED',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Обновить статус запроса
    const updatedExchange = update<Exchange>('exchanges', id, {
      status: status as any,
      updatedAt: new Date().toISOString(),
    });

    return successResponse(updatedExchange);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Update exchange status error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

