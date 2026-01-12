import { NextRequest } from 'next/server';
import { getAll } from '@/lib/db';
import { requireRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order, OrderItem } from '@/types';
import { atomicDecreaseStock } from '@/lib/inventory-utils';
import { getTerminalProvider } from '@/lib/terminal/factory';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/pos/payments/confirm:
 *   post:
 *     summary: Confirm terminal payment for a POS order
 *     tags: [POS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transactionId:
 *                 type: string
 *                 description: Terminal transaction ID
 *               orderId:
 *                 type: string
 *                 description: Order ID (alternative to transactionId)
 *     responses:
 *       200:
 *         description: Payment confirmed successfully
 *       400:
 *         description: Invalid request or payment confirmation failed
 *       404:
 *         description: Order or transaction not found
 *       409:
 *         description: Order already confirmed or state mismatch
 *       403:
 *         description: Forbidden
 */
export async function POST(req: NextRequest) {
  try {
    const user = requireRole(req, ['SUPERADMIN', 'ADMIN', 'CASHIER']);

    const data = await req.json();
    const { transactionId, orderId } = data;

    if (!transactionId && !orderId) {
      return errorResponse('Either transactionId or orderId is required', 400);
    }

    // Find the order
    const orders = getAll<Order>('orders');
    let order: Order | null = null;

    if (orderId) {
      order = orders.find(o => o.id === orderId) || null;
    } else if (transactionId) {
      order = orders.find(o => o.terminal_transaction_id === transactionId) || null;
    }

    if (!order) {
      return errorResponse('Order or transaction not found', 404);
    }

    // Validate order state
    if (order.channel !== 'offline' && order.source !== 'POS') {
      return errorResponse('Order is not a POS order', 400);
    }

    if (order.paymentMethod !== 'TERMINAL') {
      return errorResponse('Order payment method is not TERMINAL', 400);
    }

    if (order.payment_status === 'paid') {
      return errorResponse('Order already confirmed', 409);
    }

    if (order.payment_status === 'failed') {
      return errorResponse('Order payment already failed, cannot confirm', 409);
    }

    // Confirm with terminal provider
    const terminalProvider = getTerminalProvider();
    let confirmResult;

    try {
      confirmResult = await terminalProvider.confirm(order.terminal_transaction_id!);
    } catch (error: any) {
      console.error(`[TERMINAL] Confirmation error for ${order.terminal_transaction_id}:`, error);
      return errorResponse(
        `Terminal confirmation failed: ${error.message}`,
        500
      );
    }

    if (!confirmResult.success) {
      // Payment failed
      order.payment_status = 'failed';
      order.status = 'CANCELLED';
      order.updatedAt = new Date().toISOString();

      // Update order in collection
      const orderIdx = orders.findIndex(o => o.id === order!.id);
      if (orderIdx !== -1) {
        orders[orderIdx] = order;
      }

      console.log(`[POS] Payment declined for order ${order.receipt_number}`);

      return errorResponse(
        `Payment declined: ${confirmResult.message || 'Card declined'}`,
        400
      );
    }

    // Payment successful - update order and decrease stock
    order.payment_status = 'paid';
    order.status = 'PAID';
    order.updatedAt = new Date().toISOString();

    // Decrease stock
    const orderItems = getAll<OrderItem>('orderItems').filter(oi => oi.orderId === order!.id);

    for (const item of orderItems) {
      const result = atomicDecreaseStock(
        item.productId,
        item.quantity,
        'purchase',
        user.id,
        order.id
      );

      if (!result.success) {
        // Stock issue - but order was already charged!
        // Log error and mark order as needs review
        console.error(`[STOCK ERROR] Failed to decrease stock after payment confirmation: ${result.error}`);
        // Don't fail the order, just log it - payment is already processed
      }
    }

    // Update order in collection
    const orderIdx = orders.findIndex(o => o.id === order.id);
    if (orderIdx !== -1) {
      orders[orderIdx] = order;
    }

    console.log(`[POS] Confirmed payment for order ${order.receipt_number}`);

    return successResponse({
      order,
      payment_status: 'paid',
      message: 'Payment confirmed successfully, order completed'
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Confirm payment error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

