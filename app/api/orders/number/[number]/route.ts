import { NextRequest } from 'next/server';
import { getAll, findOne } from '@/lib/db';
import { requireAuth } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order, OrderItem } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const user = requireAuth(req);
    const order = findOne<Order>('orders', (o) => o.orderNumber === params.number);

    if (!order) {
      return errorResponse('Order not found', 404);
    }

    // Check access
    if (user.role === 'USER' && order.userId !== user.id) {
      return errorResponse('Forbidden', 403);
    }

    // Get order items
    const items = getAll<OrderItem>('orderItems').filter(item => item.orderId === order.id);

    return successResponse({ order, items });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    console.error('Get order by number error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

