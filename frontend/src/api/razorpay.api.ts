import axiosClient from './axiosClient';
import type { OrderRecord } from './ordering.api';

export interface RazorpayConfiguration {
  enabled: boolean;
  keyId?: string;
}

export interface RazorpayPaymentOrder {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
}

export interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export async function getRazorpayConfiguration(): Promise<RazorpayConfiguration> {
  const { data } = await axiosClient.get<{
    success: boolean;
    razorpay: RazorpayConfiguration;
  }>('/api/payments/razorpay/config');
  return data.razorpay;
}

export async function createRazorpayOrder(orderId: string): Promise<RazorpayPaymentOrder> {
  const { data } = await axiosClient.post<{
    success: boolean;
    payment: RazorpayPaymentOrder;
  }>(`/api/payments/razorpay/orders/${orderId}`);
  return data.payment;
}

export async function verifyRazorpayCheckout(
  orderId: string,
  payment: RazorpayCheckoutResponse
): Promise<OrderRecord> {
  const { data } = await axiosClient.post<{ success: boolean; order: OrderRecord }>(
    '/api/payments/razorpay/verify',
    {
      orderId,
      razorpayOrderId: payment.razorpay_order_id,
      razorpayPaymentId: payment.razorpay_payment_id,
      razorpaySignature: payment.razorpay_signature,
    }
  );
  return data.order;
}
