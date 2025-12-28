import { NextRequest } from 'next/server';
import { getById, update, create, getAll } from '@/lib/db';
import { requireRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order, Payment, OrderItem } from '@/types';
import { decreaseInventoryOnPayment } from '@/lib/inventory-utils';

export async function POST(req: NextRequest) {
  try {
    requireRole(req, ['SUPERADMIN', 'ADMIN', 'CASHIER']);

    const { orderId } = await req.json();

    if (!orderId) {
      return errorResponse('Order ID is required', 400);
    }

    const order = getById<Order>('orders', orderId);

    if (!order) {
      return errorResponse('Order not found', 404);
    }

    // Update order status to PAID
    const updatedOrder = update<Order>('orders', orderId, {
      status: 'PAID',
      updatedAt: new Date().toISOString(),
    });

    // Get order items and decrease inventory
    const orderItems = getAll<OrderItem>('orderItems').filter(item => item.orderId === orderId);
    decreaseInventoryOnPayment(orderItems);

    // Create payment record
    const payment = create<Payment>('payments', {
      orderId,
      provider: 'TERMINAL',
      status: 'COMPLETED',
      amount: order.total,
      createdAt: new Date().toISOString(),
    });

    return successResponse({ order: updatedOrder, payment }, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Process POS payment error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

