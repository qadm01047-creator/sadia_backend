import { getAll, findOne, update, remove } from './db';
import { Inventory, OrderItem } from '@/types';

/**
 * Decrease inventory quantity when order is paid
 * @param orderItems - Array of order items
 */
export function decreaseInventoryOnPayment(orderItems: OrderItem[]): void {
  const inventory = getAll<Inventory>('inventory');

  for (const orderItem of orderItems) {
    // Find inventory item for this product and size
    const inventoryItem = findOne<Inventory>(
      'inventory',
      (inv) => inv.productId === orderItem.productId && inv.size === orderItem.size
    );

    if (inventoryItem) {
      // Decrease quantity, but don't go below 0
      const newQuantity = Math.max(0, inventoryItem.quantity - orderItem.quantity);
      update<Inventory>('inventory', inventoryItem.id, {
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

