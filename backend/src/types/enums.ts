/**
 * types/enums.ts
 * Shared enums for roles and order/entity statuses.
 * Single source of truth — used by both models and middleware.
 */

export enum UserRole {
  STUDENT = 'student',
  STAFF = 'staff',
  CANTEEN_ADMIN = 'canteen_admin',
  SUPER_ADMIN = 'super_admin',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  PICKED_UP = 'picked_up',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  PAY_AT_PICKUP = 'pay_at_pickup',
  RAZORPAY = 'razorpay',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

