import { NextRequest } from 'next/server';
import { create, getAll } from '@/lib/db';
import { requireRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order, OrderItem, Product } from '@/types';
import { decreaseInventoryOnPayment } from '@/lib/inventory-utils';

// Alias for /pos/orders (for compatibility with frontend)
export async function POST(req: NextRequest) {
  try {
    requireRole(req, ['SUPERADMIN', 'ADMIN', 'CASHIER']);

    const data = await req.json();
    const { items, paymentMethod } = data;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('Items are required', 400);
    }

    if (!paymentMethod) {
      return errorResponse('Payment method is required', 400);
    }

    // Calculate total
    let total = 0;
    const products = getAll<Product>('products');

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return errorResponse(`Product ${item.productId} not found`, 400);
      }
      total += product.price * item.quantity;
    }

    // Generate order number
    const orderNumber = `POS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const order = create<Order>('orders', {
      orderNumber,
      status: 'PAID',
      source: 'POS',
      total,
      paymentMethod,
      createdAt: new Date().toISOString(),
    });

    // Create order items
    const orderItems: OrderItem[] = [];
    for (const item of items) {
      const product = products.find(p => p.id === item.productId)!;
      const orderItem = create<OrderItem>('orderItems', {
        orderId: order.id,
        productId: item.productId,
        size: item.size,
        quantity: item.quantity,
        price: product.price,
      });
      orderItems.push(orderItem);
    }

    // Decrease inventory since order is immediately PAID
    decreaseInventoryOnPayment(orderItems);

    return successResponse({ order, items: orderItems }, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Create POS order error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

