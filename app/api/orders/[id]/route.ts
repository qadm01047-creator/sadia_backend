import { NextRequest } from 'next/server';
import { getByIdAsync, updateAsync, getAllAsync } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order, OrderItem, User, Product } from '@/types';
import { decreaseInventoryOnPayment, removeInventoryOnCompletion } from '@/lib/inventory-utils';
import { sendTelegramNotificationByPhone } from '@/lib/telegram-notify';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 *   put:
 *     summary: Update order status (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order updated
 *       404:
 *         description: Order not found
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requireAuth(req);
    const order = await getByIdAsync<Order>('orders', params.id);

    if (!order) {
      return errorResponse('Order not found', 404);
    }

    // Check access
    if (user.role === 'USER' && order.userId !== user.id) {
      return errorResponse('Forbidden', 403);
    }

    // Get order items
    const allOrderItems = await getAllAsync<OrderItem>('orderItems');
    const items = allOrderItems.filter(item => item.orderId === order.id);

    return successResponse({ order, items });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    console.error('Get order error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const data = await req.json();
    const { status } = data;

    // Get current order to check if status is changing
    const currentOrder = await getByIdAsync<Order>('orders', params.id);
    if (!currentOrder) {
      return errorResponse('Order not found', 404);
    }

    const updatedOrder = await updateAsync<Order>('orders', params.id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    // Get order items
    const allOrderItems = await getAllAsync<OrderItem>('orderItems');
    const orderItems = allOrderItems.filter(item => item.orderId === params.id);

    // If status changed to PAID, decrease inventory
    if (status === 'PAID' && currentOrder.status !== 'PAID') {
      decreaseInventoryOnPayment(orderItems);
    }

    // If status changed to COMPLETED, remove items from inventory completely
    if (status === 'COMPLETED' && currentOrder.status !== 'COMPLETED') {
      removeInventoryOnCompletion(orderItems);
    }

    // Send Telegram notification if status changed and order has phone/telegramUserId
    if (status && status !== currentOrder.status && currentOrder.source === 'ONLINE') {
      // Try to get phone from user
      let phone: string | undefined;
      if (currentOrder.userId) {
        const user = await getByIdAsync<User>('users', currentOrder.userId);
        phone = user?.phone;
      }

      // Send notification if we have phone or telegramUserId
      if (phone || currentOrder.telegramUserId) {
        const statusText: { [key: string]: string } = {
          'PENDING': '⏳ Ожидает оплаты',
          'PAID': '✅ Оплачен',
          'CANCELLED': '❌ Отменен',
          'COMPLETED': '🎉 Завершен',
        };

        const notificationMessage = `📦 *Статус заказа изменен*\n\n` +
          `Номер заказа: *${currentOrder.orderNumber}*\n` +
          `Новый статус: ${statusText[status] || status}\n` +
          `💰 Сумма: *${currentOrder.total.toFixed(2)} сум*\n\n` +
          `Следите за обновлениями вашего заказа!`;

        if (phone) {
          sendTelegramNotificationByPhone(phone, notificationMessage).catch((err) => {
            console.error('[ORDER] Error sending Telegram notification:', err);
          });
        } else if (currentOrder.telegramUserId) {
          // Send directly to telegramUserId
          try {
            const { default: axios } = await import('axios');
            await axios.post(`${process.env.API_URL || 'http://localhost:3000/api'}/telegram/send-notification`, {
              telegramUserId: currentOrder.telegramUserId,
              message: notificationMessage,
            });
          } catch (err) {
            console.error('[ORDER] Error sending Telegram notification:', err);
          }
        }
      }
    }

    return successResponse(updatedOrder);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Update order error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

