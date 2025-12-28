import { NextRequest } from 'next/server';
import { getAll, count } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order } from '@/types';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const orders = getAll<Order>('orders');
    const totalRevenue = orders
      .filter(o => o.status === 'PAID' || o.status === 'COMPLETED')
      .reduce((sum, order) => sum + order.total, 0);

    const stats = {
      totalProducts: count('products'),
      totalCategories: count('categories'),
      totalOrders: count('orders'),
      totalUsers: count('users'),
      totalRevenue,
      pendingOrders: count('orders', (o: Order) => o.status === 'PENDING'),
      completedOrders: count('orders', (o: Order) => o.status === 'COMPLETED'),
      onlineOrders: count('orders', (o: Order) => o.source === 'ONLINE'),
      posOrders: count('orders', (o: Order) => o.source === 'POS'),
      telegramOrders: count('orders', (o: Order) => o.source === 'TELEGRAM'),
    };

    return successResponse(stats);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get admin stats error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

