import { NextRequest } from 'next/server';
import { create, getAll, getAllAsync } from '@/lib/db';
import { requireRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Order, OrderItem, Product, Inventory, PaymentStatus, PaymentMethod } from '@/types';
import { atomicDecreaseStock, decreaseInventoryOnPayment } from '@/lib/inventory-utils';
import { generateReceiptNumber } from '@/lib/receipt-utils';
import { getTerminalProvider } from '@/lib/terminal/factory';
import { notifyAdminsAboutSale } from '@/lib/telegram-notify';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/pos/orders:
 *   get:
 *     summary: Get POS orders (Cashier/Admin only)
 *     tags: [POS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PAID, PENDING, FAILED, COMPLETED]
 *       - in: query
 *         name: cashierId
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *           default: 0
 *     responses:
 *       200:
 *         description: List of POS orders
 *       403:
 *         description: Forbidden
 *   post:
 *     summary: Create POS order (Cashier/Admin only)
 *     tags: [POS]
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
 *               - paymentMethod
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     size:
 *                       type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, TERMINAL]
 *               cashierId:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created
 *       400:
 *         description: Bad request (validation error or stock insufficient)
 *       403:
 *         description: Forbidden
 */
export async function GET(req: NextRequest) {
  try {
    const user = requireRole(req, ['SUPERADMIN', 'ADMIN', 'CASHIER']);

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const cashierId = searchParams.get('cashierId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Use getAllAsync to support Blob storage
    let orders = await getAllAsync<Order>('orders');

    // Filter POS/OFFLINE orders
    orders = orders.filter(
      o => o.source === 'POS' || o.source === 'OFFLINE' || o.channel === 'offline'
    );

    // Filter by status
    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    // Filter by cashier
    // If user is CASHIER, they can only see their own orders (unless cashierId is explicitly provided)
    // If user is ADMIN/SUPERADMIN, they can see all orders or filter by cashierId
    let effectiveCashierId = cashierId;
    if (user.role === 'CASHIER' && !cashierId) {
      // Cashiers can only see their own orders
      effectiveCashierId = user.id;
    }

    if (effectiveCashierId) {
      orders = orders.filter(o =>
        o.cashier_id === effectiveCashierId || (o as any).cashierId === effectiveCashierId
      );
    }

    // Filter by date range (dateTo should include the entire day)
    if (dateFrom || dateTo) {
      orders = orders.filter(o => {
        const orderDate = new Date(o.createdAt);

        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (orderDate < fromDate) return false;
        }

        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999); // Include entire day
          if (orderDate > toDate) return false;
        }

        return true;
      });
    }

    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Paginate
    const total = orders.length;
    const paginatedOrders = orders.slice(offset, offset + limit);

    // Log for debugging
    console.log(`[POS ORDERS] Found ${total} orders (showing ${paginatedOrders.length}), filters:`, {
      cashierId: effectiveCashierId || 'all',
      dateFrom,
      dateTo,
      status,
      userRole: user.role,
      userId: user.id
    });

    return successResponse({
      data: paginatedOrders,
      meta: { total, limit, offset }
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get POS orders error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = requireRole(req, ['SUPERADMIN', 'ADMIN', 'CASHIER']);

    const data = await req.json();
    const { items, paymentMethod, cashierId, notes } = data;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('Items array is required and must not be empty', 400);
    }

    const allowedMethods: PaymentMethod[] = ['CASH', 'TERMINAL', 'TRANSFER'];
    if (!paymentMethod || !allowedMethods.includes(paymentMethod)) {
      return errorResponse('Payment method must be CASH, TERMINAL or TRANSFER', 400);
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return errorResponse('Each item must have productId and positive quantity', 400);
      }
    }

    // Get products and calculate total
    const products = getAll<Product>('products');

    // Get inventory for size-based stock checks
    const inventory = await getAllAsync<Inventory>('inventory');

    let total = 0;
    const validatedItems: { productId: string; quantity: number; size?: string; product: Product }[] = [];

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return errorResponse(`Product ${item.productId} not found`, 404);
      }

      // Check if product is active for POS
      if (product.active_for_pos === false) {
        return errorResponse(`Product ${product.name} is not available for POS`, 400);
      }

      // Check stock - if size is provided, check inventory, otherwise check product stock
      if (item.size) {
        const inventoryItem = inventory.find(
          inv => inv.productId === item.productId && inv.size === item.size
        );

        if (!inventoryItem || inventoryItem.quantity < item.quantity) {
          const availableQty = inventoryItem?.quantity || 0;
          return errorResponse(
            `Product "${product.name}" size ${item.size} only has ${availableQty} in stock (requested ${item.quantity})`,
            400
          );
        }
      } else {
        // Fallback: calculate stock from inventory if no size specified
        const productInventory = inventory.filter(inv => inv.productId === item.productId);
        const totalStock = productInventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
        if (totalStock < item.quantity) {
          return errorResponse(
            `Product "${product.name}" only has ${totalStock} in stock (requested ${item.quantity})`,
            400
          );
        }
      }

      const effectivePrice = (product.offline_price ?? product.price) || 0;
      total += effectivePrice * item.quantity;
      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        product
      });
    }

    if (total <= 0) {
      return errorResponse('Order total must be greater than 0', 400);
    }

    // Determine payment status based on method
    let initialPaymentStatus: PaymentStatus;
    let initialOrderStatus: string;
    let terminalTransactionId: string | undefined;

    if (paymentMethod === 'CASH' || paymentMethod === 'TRANSFER') {
      initialPaymentStatus = 'paid';
      initialOrderStatus = 'PAID';
    } else {
      // TERMINAL: needs confirmation
      initialPaymentStatus = 'pending';
      initialOrderStatus = 'PENDING';

      // Initiate terminal transaction
      const terminalProvider = getTerminalProvider();
      try {
        const terminalResult = await terminalProvider.initiate(total, {
          items: validatedItems.map(vi => ({ name: vi.product.name, qty: vi.quantity })),
          cashierId: cashierId || user.id,
          timestamp: new Date().toISOString()
        });
        terminalTransactionId = terminalResult.transactionId;
      } catch (error: any) {
        return errorResponse(`Terminal initiation failed: ${error.message}`, 500);
      }
    }

    // Create order
    const createdAt = new Date().toISOString();
    const receiptNumber = generateReceiptNumber(createdAt);
    const orderId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const order = create<Order>('orders', {
      id: orderId,
      orderNumber: receiptNumber,
      receipt_number: receiptNumber,
      status: initialOrderStatus,
      channel: 'offline',
      source: 'OFFLINE',
      total,
      paymentMethod,
      payment_method: paymentMethod,
      payment_status: initialPaymentStatus,
      terminal_transaction_id: terminalTransactionId,
      cashier_id: cashierId || user.id,
      createdAt,
    } as Order);

    // Create order items
    const createdItems: OrderItem[] = [];
    for (const validatedItem of validatedItems) {
      const orderItem = create<OrderItem>('orderItems', {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        orderId: order.id,
        productId: validatedItem.productId,
        size: validatedItem.size,
        quantity: validatedItem.quantity,
        price: (validatedItem.product.offline_price ?? validatedItem.product.price) || 0,
        product_name: validatedItem.product.name,
        sku: validatedItem.product.sku
      });
      createdItems.push(orderItem);
    }

    // Decrease stock immediately if оплата подтверждена сразу
    // Для TERMINAL уменьшаем при подтверждении
    if (paymentMethod === 'CASH' || paymentMethod === 'TRANSFER') {
      // If items have sizes, decrease inventory by size
      const hasSizes = validatedItems.some(item => item.size);

      if (hasSizes) {
        // Use inventory-based decrease for items with sizes
        await decreaseInventoryOnPayment(createdItems);

        // Also decrease product stock for compatibility
        for (const validatedItem of validatedItems) {
          const result = atomicDecreaseStock(
            validatedItem.productId,
            validatedItem.quantity,
            'purchase',
            cashierId || user.id,
            orderId
          );

          if (!result.success) {
            console.warn(`Failed to decrease product stock for ${validatedItem.product.name}: ${result.error}`);
            // Don't fail the order if inventory was decreased successfully
          }
        }
      } else {
        // Fallback to product stock if no sizes
        for (const validatedItem of validatedItems) {
          const result = atomicDecreaseStock(
            validatedItem.productId,
            validatedItem.quantity,
            'purchase',
            cashierId || user.id,
            orderId
          );

          if (!result.success) {
            return errorResponse(
              `Failed to decrease stock for ${validatedItem.product.name}: ${result.error}`,
              500
            );
          }
        }
      }
    }

    // Log successful order creation
    console.log(`[POS] Created order ${receiptNumber} with payment method ${paymentMethod}`);

    // Notify admins about new sale
    notifyAdminsAboutSale(order, createdItems).catch((err) => {
      console.error('[POS ORDER] Error notifying admins:', err);
    });

    return successResponse(
      {
        order,
        items: createdItems,
        message: paymentMethod === 'CASH'
          ? 'Order paid and confirmed'
          : 'Order awaiting terminal payment confirmation'
      },
      201
    );
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Create POS order error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

