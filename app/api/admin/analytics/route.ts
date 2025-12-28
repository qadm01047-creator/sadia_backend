import { NextRequest } from 'next/server';
import { getAll } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order, OrderItem } from '@/types';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const orders = getAll<Order>('orders');
    const orderItems = getAll<OrderItem>('orderItems');

    // Группировка по дате и источнику
    const analyticsMap = new Map<string, {
      date: string;
      source: string;
      totalRevenue: number;
      totalOrders: number;
      productsSold: number;
    }>();

    // Обработка всех заказов
    orders.forEach(order => {
      // Получаем только оплаченные и завершенные заказы
      if (order.status === 'PAID' || order.status === 'COMPLETED') {
        const date = new Date(order.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
        const key = `${date}-${order.source}`;

        if (!analyticsMap.has(key)) {
          analyticsMap.set(key, {
            date,
            source: order.source,
            totalRevenue: 0,
            totalOrders: 0,
            productsSold: 0,
          });
        }

        const analyticsItem = analyticsMap.get(key)!;
        analyticsItem.totalRevenue += order.total || 0;
        analyticsItem.totalOrders += 1;

        // Подсчитываем количество товаров в заказе
        const items = orderItems.filter(item => item.orderId === order.id);
        analyticsItem.productsSold += items.reduce((sum, item) => sum + item.quantity, 0);
      }
    });

    // Преобразуем Map в массив
    const analytics = Array.from(analyticsMap.values());

    // Сортируем по дате (новые первыми)
    analytics.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Подсчитываем общие итоги
    const totals = {
      totalRevenue: analytics.reduce((sum, item) => sum + item.totalRevenue, 0),
      totalOrders: analytics.reduce((sum, item) => sum + item.totalOrders, 0),
      productsSold: analytics.reduce((sum, item) => sum + item.productsSold, 0),
    };

    return successResponse({
      data: analytics,
      totals,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get analytics error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

