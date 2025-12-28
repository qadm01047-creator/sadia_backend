import { NextRequest } from 'next/server';
import { getById, getAll } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order, OrderItem, Product } from '@/types';

// Public endpoint for Telegram bot to get order details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = getById<Order>('orders', params.id);

    if (!order) {
      return errorResponse('Order not found', 404);
    }

    // Get order items
    const items = getAll<OrderItem>('orderItems').filter(item => item.orderId === order.id);
    
    // Enrich items with product information
    const products = getAll<Product>('products');
    const enrichedItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        ...item,
        product: product ? { id: product.id, name: product.name } : null,
      };
    });

    return successResponse({ order, items: enrichedItems });
  } catch (error: any) {
    console.error('Get Telegram order error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

