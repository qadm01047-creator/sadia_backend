import { getAll, findOne, update, remove, create, getAllAsync, findOneAsync, updateAsync } from './db';
import { Inventory, OrderItem, Product, StockMovement } from '@/types';

/**
 * Decrease inventory quantity when order is paid (async version for Blob Storage)
 * @param orderItems - Array of order items
 */
export async function decreaseInventoryOnPayment(orderItems: OrderItem[]): Promise<void> {
  const inventory = await getAllAsync<Inventory>('inventory');

  for (const orderItem of orderItems) {
    // Find inventory item for this product and size
    const inventoryItem = inventory.find(
      (inv) => inv.productId === orderItem.productId && inv.size === orderItem.size
    );

    if (inventoryItem) {
      // Decrease quantity, but don't go below 0
      const newQuantity = Math.max(0, inventoryItem.quantity - orderItem.quantity);
      await updateAsync<Inventory>('inventory', inventoryItem.id, {
        quantity: newQuantity,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

/**
 * Remove items from inventory when order is completed (sold out)
 * @param orderItems - Array of order items
 */
export function removeInventoryOnCompletion(orderItems: OrderItem[]): void {
  for (const orderItem of orderItems) {
    // Find inventory item for this product and size
    const inventoryItem = findOne<Inventory>(
      'inventory',
      (inv) => inv.productId === orderItem.productId && inv.size === orderItem.size
    );

    if (inventoryItem) {
      // Remove item from inventory completely
      remove('inventory', inventoryItem.id);
    }
  }
}

/**
 * Atomically decrease product stock
 * Validates sufficient stock before decrementing
 * Creates StockMovement audit record
 * @param productId - Product ID
 * @param quantity - Quantity to decrease
 * @param reason - Reason for stock change
 * @param userId - User making the change
 * @param orderId - Optional order ID
 * @returns { success: boolean, newStock?: number, error?: string }
 */
export function atomicDecreaseStock(
  productId: string,
  quantity: number,
  reason: 'purchase' | 'manual_adjustment' | 'return' | 'damage' = 'purchase',
  userId: string,
  orderId?: string
): { success: boolean; newStock?: number; error?: string } {
  try {
    // 1. Read current stock
    const products = getAll<Product>('products');
    const product = products.find(p => p.id === productId);

    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    const currentStock = product.stock ?? 0;

    // 2. Validate sufficient stock
    if (currentStock < quantity) {
      return {
        success: false,
        error: `Only ${currentStock} in stock (requested ${quantity})`
      };
    }

    // 3. Decrement stock
    product.stock = currentStock - quantity;
    product.updatedAt = new Date().toISOString();

    // 4. Write back
    update<Product>('products', product.id, product);

    // 5. Record stock movement for audit trail
    create<StockMovement>('stockMovements', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      productId,
      delta: -quantity,
      reason,
      orderId,
      userId,
      createdAt: new Date().toISOString()
    });

    console.log(`[STOCK] Decreased ${productId} by ${quantity}. New stock: ${product.stock}`);

    return { success: true, newStock: product.stock };
  } catch (error: any) {
    console.error(`[STOCK ERROR] Failed to decrease stock for ${productId}:`, error);
    return { success: false, error: 'Stock update failed' };
  }
}

/**
 * Increase product stock (for returns or adjustments)
 * @param productId - Product ID
 * @param quantity - Quantity to increase
 * @param reason - Reason for stock change
 * @param userId - User making the change
 * @param orderId - Optional order ID
 * @returns { success: boolean, newStock?: number, error?: string }
 */
export function atomicIncreaseStock(
  productId: string,
  quantity: number,
  reason: 'return' | 'manual_adjustment' | 'damage' = 'manual_adjustment',
  userId: string,
  orderId?: string
): { success: boolean; newStock?: number; error?: string } {
  try {
    const products = getAll<Product>('products');
    const product = products.find(p => p.id === productId);

    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    const currentStock = product.stock ?? 0;
    product.stock = currentStock + quantity;
    product.updatedAt = new Date().toISOString();

    update<Product>('products', product.id, product);

    create<StockMovement>('stockMovements', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      productId,
      delta: quantity,
      reason,
      orderId,
      userId,
      createdAt: new Date().toISOString()
    });

    console.log(`[STOCK] Increased ${productId} by ${quantity}. New stock: ${product.stock}`);

    return { success: true, newStock: product.stock };
  } catch (error: any) {
    console.error(`[STOCK ERROR] Failed to increase stock for ${productId}:`, error);
    return { success: false, error: 'Stock update failed' };
  }
}
