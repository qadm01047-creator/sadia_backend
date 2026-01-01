import { NextRequest } from 'next/server';
import { getAllAsync, createAsync, getByIdAsync, updateAsync } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order, OrderItem, Product, Coupon } from '@/types';
import { sendTelegramNotificationByPhone } from '@/lib/telegram-notify';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get all orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PAID, CANCELLED, COMPLETED]
 *         description: Filter by order status
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [ONLINE, POS, TELEGRAM]
 *         description: Filter by order source
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     size:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *               couponCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const source = searchParams.get('source');

    let orders = await getAllAsync<Order>('orders');

    // Filter by user role
    if (user.role === 'USER') {
      orders = orders.filter(o => o.userId === user.id);
    }

    // Filter by status
    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    // Filter by source
    if (source) {
      orders = orders.filter(o => o.source === source);
    }

    // Sort by date (newest first)
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return successResponse(orders);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    console.error('Get orders error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const data = await req.json();
    const { items, source = 'ONLINE', paymentMethod, telegramUserId, couponCode, phone, email } = data;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('Items are required', 400);
    }

    // Calculate total
    let total = 0;
    const products = await getAllAsync<Product>('products');

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
      const coupons = await getAllAsync<Coupon>('coupons');
      const coupon = coupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase());
      
      if (coupon) {
        // Validate coupon
        if (coupon.oneTimeUse && coupon.used) {
          return errorResponse('Coupon has already been used', 400);
        }
        if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
          return errorResponse('Coupon has expired', 400);
        }

        // Calculate discount
        if (coupon.discountType === 'PERCENTAGE') {
          discount = (total * coupon.discount) / 100;
        } else {
          discount = coupon.discount;
        }
        
        total = Math.max(0, total - discount);
        
        // Mark coupon as used if it's one-time
        if (coupon.oneTimeUse) {
          await updateAsync<Coupon>('coupons', coupon.id, {
            used: true,
            usedBy: user.id,
          });
        }
      } else {
        return errorResponse('Invalid coupon code', 400);
      }
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Extract phone from email field if it's actually a phone number
    let orderPhone = phone;
    if (!orderPhone && email) {
      // Check if email is actually a phone number (doesn't contain @)
      if (!email.includes('@')) {
        orderPhone = email;
      }
    }

    // Create order
    const order = await createAsync<Order>('orders', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: user.role !== 'USER' ? undefined : user.id,
      orderNumber,
      status: 'PENDING',
      source: source as any,
      total,
      paymentMethod,
      telegramUserId,
      couponCode: appliedCouponCode || undefined,
      discount: discount > 0 ? discount : undefined,
      createdAt: new Date().toISOString(),
    });

    // Create order items
    const orderItems: OrderItem[] = [];
    for (const item of items) {
      const product = products.find(p => p.id === item.productId)!;
      const orderItem = await createAsync<OrderItem>('orderItems', {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        orderId: order.id,
        productId: item.productId,
        size: item.size,
        quantity: item.quantity,
        price: product.price,
      });
      orderItems.push(orderItem);
    }

    // Send Telegram notification if phone is provided and order is from website
    if (orderPhone && source === 'ONLINE') {
      const productNames = orderItems.map(item => {
        const product = products.find(p => p.id === item.productId);
        return product?.name || 'Товар';
      }).join(', ');
      
      const notificationMessage = `✅ *Новый заказ!*\n\n` +
        `📦 Номер заказа: *${order.orderNumber}*\n` +
        `💰 Сумма: *${order.total.toFixed(2)} сум*\n` +
        `🛍️ Товары: ${productNames}\n` +
        `📊 Статус: Ожидает оплаты\n\n` +
        `Спасибо за ваш заказ! Мы свяжемся с вами в ближайшее время.`;
      
      sendTelegramNotificationByPhone(orderPhone, notificationMessage).catch((err) => {
        console.error('[ORDER] Error sending Telegram notification:', err);
      });
    }

    return successResponse({ order, items: orderItems }, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    console.error('Create order error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

