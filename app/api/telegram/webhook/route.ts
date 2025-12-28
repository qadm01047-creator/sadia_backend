import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { create, getAll, update } from '@/lib/db';
import { Order, OrderItem, Product, Coupon } from '@/types';

// This endpoint will be used by Telegram bot to create orders
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { telegramUserId, items, orderNumber, paymentMethod, couponCode } = data;

    // Verify Telegram bot token (optional security)
    const token = req.headers.get('x-telegram-bot-token');
    const expectedToken = process.env.TELEGRAM_BOT_TOKEN;

    if (expectedToken && token !== expectedToken) {
      return errorResponse('Invalid bot token', 401);
    }

    if (!telegramUserId || !items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('telegramUserId and items are required', 400);
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

    // Apply coupon discount if provided
    let discount = 0;
    let appliedCouponCode = couponCode;
    if (couponCode) {
      const coupons = getAll<Coupon>('coupons');
      const coupon = coupons.find((c) => c.code.toUpperCase() === couponCode.toUpperCase());
      
      if (coupon) {
        // Validate coupon - проверяем оба варианта полей для совместимости
        const isOneTime = (coupon as any).oneTime || coupon.oneTimeUse;
        const expiresAt = (coupon as any).expiresAt || coupon.validUntil;
        
        if (isOneTime && coupon.used) {
          return errorResponse('Coupon has already been used', 400);
        }
        if (expiresAt && new Date(expiresAt) < new Date()) {
          return errorResponse('Coupon has expired', 400);
        }

        // Calculate discount
        if (coupon.discountType === 'PERCENTAGE') {
          discount = (total * coupon.discount) / 100;
        } else {
          discount = coupon.discount;
        }
        
        total = Math.max(0, total - discount);
        
        // Mark coupon as used if it's one-time (Note: для Telegram бота нет userId, поэтому usedBy не устанавливаем)
        // isOneTime уже определена выше, используем её
        if (isOneTime) {
          update<Coupon>('coupons', coupon.id, {
            used: true,
          });
        }
      } else {
        return errorResponse('Invalid coupon code', 400);
      }
    }

    // Generate order number if not provided
    const finalOrderNumber = orderNumber || `TG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const order = create<Order>('orders', {
      orderNumber: finalOrderNumber,
      status: 'PENDING',
      source: 'TELEGRAM',
      total,
      telegramUserId: String(telegramUserId),
      paymentMethod: paymentMethod || undefined,
      couponCode: appliedCouponCode || undefined,
      discount: discount > 0 ? discount : undefined,
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

    return successResponse({ order, items: orderItems }, 201);
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

