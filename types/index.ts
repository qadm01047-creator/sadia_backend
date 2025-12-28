export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'CASHIER' | 'USER';
export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'COMPLETED';
export type OrderSource = 'ONLINE' | 'POS' | 'TELEGRAM';
export type PaymentProvider = 'PAYME' | 'CLICK' | 'TERMINAL' | 'CASH';
export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type ExchangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardHolder?: string;
  telegramUserId?: string; // Added Telegram user ID
  createdAt: string;
  updatedAt?: string;
}

export interface TelegramUserMapping {
  id: string;
  telegramUserId: string;
  userId?: string; // Optional link to User account
  role: UserRole;
  firstName?: string;
  lastName?: string;
  username?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  type?: 'image' | 'video'; // тип медиа файла
  order: number;
  productId: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  costPrice?: number;
  profit?: number;
  categoryId: string;
  images?: ProductImage[];
  createdAt: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  userId?: string;
  orderNumber: string;
  status: OrderStatus;
  source: OrderSource;
  total: number;
  paymentMethod?: string;
  telegramUserId?: string;
  couponCode?: string;
  discount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  size?: string;
  quantity: number;
  price: number;
}

export interface Review {
  id: string;
  name: string;
  text: string;
  rating: number;
  productId?: string;
  approved: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount: number;
  discountType: DiscountType;
  validFrom: string;
  validUntil: string;
  minPurchase?: number;
  maxDiscount?: number;
  oneTimeUse: boolean;
  used: boolean;
  usedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Exchange {
  id: string;
  orderId: string;
  productId?: string; // Made optional for cancellation requests
  reason: string;
  type: 'EXCHANGE' | 'CANCELLATION'; // Added type field
  status: ExchangeStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Inventory {
  id: string;
  productId: string;
  size: string;
  quantity: number;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  provider: PaymentProvider;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt?: string;
}

export interface SupportMessage {
  id: string;
  email: string;
  message: string;
  status: 'PENDING' | 'RESOLVED';
  createdAt: string;
  updatedAt?: string;
}

export interface NewsletterSubscription {
  id: string;
  email: string;
  createdAt: string;
}
