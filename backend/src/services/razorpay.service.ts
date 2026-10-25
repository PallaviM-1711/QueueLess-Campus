import { createHmac, timingSafeEqual } from 'crypto';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { createError } from '../middleware/errorHandler';
import { Order } from '../models/Order';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../types/enums';

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  attempts: number;
}

interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
}

interface PaymentInitialization {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
}

function razorpayEnabled(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayConfiguration(): {
  enabled: boolean;
  keyId?: string;
} {
  return {
    enabled: razorpayEnabled(),
    ...(env.RAZORPAY_KEY_ID && { keyId: env.RAZORPAY_KEY_ID }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRazorpayOrder(value: unknown): RazorpayOrder {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !Number.isInteger(value.amount) ||
    typeof value.currency !== 'string' ||
    typeof value.status !== 'string' ||
    !Number.isInteger(value.attempts)
  ) {
    throw createError('Razorpay returned an invalid order response', 502);
  }
  return {
    id: value.id,
    amount: value.amount as number,
    currency: value.currency,
    status: value.status,
    attempts: value.attempts as number,
  };
}

function parseRazorpayPayment(value: unknown): RazorpayPayment {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.order_id !== 'string' ||
    !Number.isInteger(value.amount) ||
    typeof value.currency !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.captured !== 'boolean'
  ) {
    throw createError('Razorpay returned an invalid payment response', 502);
  }
  return {
    id: value.id,
    order_id: value.order_id,
    amount: value.amount as number,
    currency: value.currency,
    status: value.status,
    captured: value.captured,
  };
}

async function razorpayRequest(path: string, method = 'GET', body?: object): Promise<unknown> {
  if (!razorpayEnabled()) {
    throw createError('Online payments are not configured', 503);
  }
  const authorization = Buffer.from(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');

  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Basic ${authorization}`,
        'Content-Type': 'application/json',
      },
      ...(body && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error('[Razorpay] Gateway request failed:', error);
    throw createError('Razorpay is temporarily unavailable; please try again', 502);
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch (error) {
    console.error('[Razorpay] Gateway returned invalid JSON:', error);
    throw createError('Razorpay returned an invalid response', 502);
  }
  if (!response.ok) {
    console.error(`[Razorpay] Gateway returned HTTP ${response.status}`);
    throw createError('Razorpay could not process the payment request', 502);
  }
  return result;
}

function paymentAmountPaise(amountInRupees: number): number {
  const amount = Math.round(amountInRupees * 100);
  if (!Number.isSafeInteger(amount) || amount < 100) {
    throw createError('Online payments require an order total of at least ₹1.00', 400);
  }
  return amount;
}

async function fetchGatewayPayments(orderId: string): Promise<RazorpayPayment[]> {
  const result = await razorpayRequest(`/orders/${encodeURIComponent(orderId)}/payments`);
  if (!isRecord(result) || !Array.isArray(result.items)) {
    throw createError('Razorpay returned an invalid payment list', 502);
  }
  return result.items.map(parseRazorpayPayment);
}

async function fetchGatewayPayment(paymentId: string): Promise<RazorpayPayment> {
  return parseRazorpayPayment(
    await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`)
  );
}

function createInitialization(
  keyId: string,
  orderId: string,
  amount: number
): PaymentInitialization {
  return { keyId, razorpayOrderId: orderId, amount, currency: 'INR' };
}

export async function createRazorpayOrder(
  studentId: string,
  orderId: string
): Promise<PaymentInitialization> {
  if (!Types.ObjectId.isValid(orderId)) throw createError('Invalid order identifier', 400);
  if (!razorpayEnabled() || !env.RAZORPAY_KEY_ID) {
    throw createError('Online payments are not configured', 503);
  }
  const order = await Order.findOne({
    _id: orderId,
    student: studentId,
    paymentMethod: PaymentMethod.RAZORPAY,
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
  }).select('+razorpayOrderId');
  if (!order) throw createError('Unpaid online order not found', 404);

  const amount = paymentAmountPaise(order.totalAmount);
  let previousGatewayOrderId = order.razorpayOrderId;
  if (previousGatewayOrderId) {
    const gatewayOrder = parseRazorpayOrder(
      await razorpayRequest(`/orders/${encodeURIComponent(previousGatewayOrderId)}`)
    );
    if (gatewayOrder.amount !== amount || gatewayOrder.currency !== 'INR') {
      throw createError('Razorpay order amount does not match the campus order', 409);
    }
    if (gatewayOrder.status === 'paid') {
      const payments = await fetchGatewayPayments(gatewayOrder.id);
      const capturedPayment = payments.find((payment) => payment.captured);
      if (capturedPayment) {
        await recordCapturedPayment(capturedPayment);
        throw createError('Payment is already complete; refresh the order status', 409);
      }
    }
    if (gatewayOrder.status === 'created' && gatewayOrder.attempts === 0) {
      return createInitialization(env.RAZORPAY_KEY_ID, gatewayOrder.id, amount);
    }

    const previousPayments = await fetchGatewayPayments(gatewayOrder.id);
    if (
      previousPayments.length === 0 ||
      previousPayments.some((payment) => payment.status !== 'failed')
    ) {
      throw createError(
        'A previous payment attempt is still processing; refresh the order before retrying',
        409
      );
    }
    if (gatewayOrder.status === 'created' || gatewayOrder.status === 'attempted') {
      return createInitialization(env.RAZORPAY_KEY_ID, gatewayOrder.id, amount);
    }
    throw createError('The previous Razorpay order cannot accept another payment', 409);
  }

  const gatewayOrder = parseRazorpayOrder(
    await razorpayRequest('/orders', 'POST', {
      amount,
      currency: 'INR',
      receipt: `qlc_${order._id.toString()}`,
      notes: { campus_order_id: order._id.toString() },
    })
  );
  if (
    gatewayOrder.amount !== amount ||
    gatewayOrder.currency !== 'INR' ||
    gatewayOrder.status !== 'created'
  ) {
    throw createError('Razorpay created an unexpected payment order', 502);
  }

  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      student: studentId,
      paymentMethod: PaymentMethod.RAZORPAY,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      ...(previousGatewayOrderId
        ? { razorpayOrderId: previousGatewayOrderId }
        : { razorpayOrderId: { $exists: false } }),
    },
    { $set: { razorpayOrderId: gatewayOrder.id } },
    { new: true }
  ).select('+razorpayOrderId');

  if (!updated) {
    const current = await Order.findOne({
      _id: order._id,
      student: studentId,
      paymentMethod: PaymentMethod.RAZORPAY,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
    }).select('+razorpayOrderId');
    if (current?.razorpayOrderId) {
      return createInitialization(env.RAZORPAY_KEY_ID, current.razorpayOrderId, amount);
    }
    throw createError('The order changed while payment was being prepared; refresh and retry', 409);
  }

  return createInitialization(env.RAZORPAY_KEY_ID, gatewayOrder.id, amount);
}

function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): void {
  if (!env.RAZORPAY_KEY_SECRET || !/^[a-f\d]{64}$/i.test(signature)) {
    throw createError('Invalid Razorpay payment signature', 400);
  }
  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const provided = Buffer.from(signature, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) {
    throw createError('Invalid Razorpay payment signature', 400);
  }
}

async function recordCapturedPayment(payment: RazorpayPayment, signature?: string) {
  if (payment.status !== 'captured' || !payment.captured || payment.currency !== 'INR') {
    throw createError('Payment has not been captured by Razorpay', 409);
  }
  const order = await Order.findOne({
    razorpayOrderId: payment.order_id,
    paymentMethod: PaymentMethod.RAZORPAY,
  }).select('+razorpayOrderId +razorpayPaymentId');
  if (!order) throw createError('Razorpay order is not linked to a campus order', 404);
  if (payment.amount !== paymentAmountPaise(order.totalAmount)) {
    throw createError('Captured payment amount does not match the campus order', 409);
  }
  if (order.paymentStatus === PaymentStatus.PAID) {
    if (order.razorpayPaymentId === payment.id) {
      return Order.findById(order._id)
        .populate('canteen', 'name location')
        .populate('pickupSlot', 'date startTime endTime')
        .orFail();
    }
    throw createError('A different payment is already recorded for this order', 409);
  }
  if (order.status === OrderStatus.CANCELLED) {
    throw createError('The campus order was cancelled before payment confirmation', 409);
  }

  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: { $ne: OrderStatus.CANCELLED },
      paymentMethod: PaymentMethod.RAZORPAY,
      paymentStatus: PaymentStatus.UNPAID,
      razorpayOrderId: payment.order_id,
    },
    {
      $set: {
        paymentStatus: PaymentStatus.PAID,
        razorpayPaymentId: payment.id,
        ...(signature && { razorpaySignature: signature }),
      },
    },
    { new: true }
  )
    .populate('canteen', 'name location')
    .populate('pickupSlot', 'date startTime endTime');
  if (updated) return updated;

  const current = await Order.findById(order._id).select('+razorpayPaymentId');
  if (
    current?.paymentStatus === PaymentStatus.PAID &&
    current.razorpayPaymentId === payment.id
  ) {
    return Order.findById(order._id)
      .populate('canteen', 'name location')
      .populate('pickupSlot', 'date startTime endTime')
      .orFail();
  }
  throw createError('Order status changed while confirming payment; refresh and retry', 409);
}

async function ensureCapturedPayment(
  payment: RazorpayPayment,
  expectedOrderId: string,
  expectedAmount: number
): Promise<RazorpayPayment> {
  if (
    payment.order_id !== expectedOrderId ||
    payment.amount !== expectedAmount ||
    payment.currency !== 'INR'
  ) {
    throw createError('Razorpay payment does not match the campus order amount', 409);
  }
  if (payment.status === 'captured' && payment.captured) return payment;
  if (payment.status !== 'authorized' || payment.captured) {
    throw createError('Razorpay payment has not been authorized', 409);
  }

  const capturedPayment = parseRazorpayPayment(
    await razorpayRequest(
      `/payments/${encodeURIComponent(payment.id)}/capture`,
      'POST',
      { amount: expectedAmount, currency: 'INR' }
    )
  );
  if (
    capturedPayment.id !== payment.id ||
    capturedPayment.order_id !== expectedOrderId ||
    capturedPayment.amount !== expectedAmount ||
    capturedPayment.currency !== 'INR' ||
    capturedPayment.status !== 'captured' ||
    !capturedPayment.captured
  ) {
    throw createError('Razorpay did not confirm payment capture', 502);
  }
  return capturedPayment;
}

export async function verifyRazorpayCheckout(
  studentId: string,
  input: {
    orderId: string;
    razorpayOrderId: string;
    paymentId: string;
    signature: string;
  }
) {
  if (!Types.ObjectId.isValid(input.orderId)) {
    throw createError('Invalid order identifier', 400);
  }
  if (!/^order_[A-Za-z0-9]+$/.test(input.razorpayOrderId)) {
    throw createError('Invalid Razorpay order identifier', 400);
  }
  if (!/^[A-Za-z0-9_]{1,64}$/.test(input.paymentId)) {
    throw createError('Invalid Razorpay payment identifier', 400);
  }
  const order = await Order.findOne({
    _id: input.orderId,
    student: studentId,
    paymentMethod: PaymentMethod.RAZORPAY,
    razorpayOrderId: input.razorpayOrderId,
  }).select('+razorpayOrderId +razorpayPaymentId');
  if (!order?.razorpayOrderId) throw createError('Online payment order not found', 404);
  if (
    order.paymentStatus === PaymentStatus.PAID &&
    order.razorpayPaymentId === input.paymentId
  ) {
    return Order.findById(order._id)
      .populate('canteen', 'name location')
      .populate('pickupSlot', 'date startTime endTime')
      .orFail();
  }
  if (order.status === OrderStatus.CANCELLED) {
    throw createError('This campus order has been cancelled', 409);
  }
  if (order.paymentStatus !== PaymentStatus.UNPAID) {
    throw createError('This order cannot accept another payment', 409);
  }
  verifyCheckoutSignature(order.razorpayOrderId, input.paymentId, input.signature);

  const payment = await fetchGatewayPayment(input.paymentId);
  const capturedPayment = await ensureCapturedPayment(
    payment,
    order.razorpayOrderId,
    paymentAmountPaise(order.totalAmount)
  );
  return recordCapturedPayment(capturedPayment, input.signature);
}

export function verifyRazorpayWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined
): void {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw createError('Razorpay webhooks are not configured', 503);
  }
  if (!signature || !/^[a-f\d]{64}$/i.test(signature)) {
    throw createError('Invalid Razorpay webhook signature', 400);
  }
  const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest();
  const provided = Buffer.from(signature, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) {
    throw createError('Invalid Razorpay webhook signature', 400);
  }
}

export async function processRazorpayWebhook(rawBody: Buffer, signature: string | undefined) {
  verifyRazorpayWebhookSignature(rawBody, signature);
  let event: unknown;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw createError('Invalid Razorpay webhook payload', 400);
  }
  if (
    !isRecord(event) ||
    (event.event !== 'payment.captured' && event.event !== 'payment.authorized')
  ) {
    return null;
  }
  if (
    !isRecord(event.payload) ||
    !isRecord(event.payload.payment) ||
    !isRecord(event.payload.payment.entity)
  ) {
    throw createError('Invalid Razorpay payment event', 400);
  }
  const payment = parseRazorpayPayment(event.payload.payment.entity);
  if (event.event === 'payment.authorized') {
    const order = await Order.findOne({
      razorpayOrderId: payment.order_id,
      paymentMethod: PaymentMethod.RAZORPAY,
    }).select('+razorpayOrderId');
    if (!order) throw createError('Razorpay order is not linked to a campus order', 404);
    const currentPayment = await fetchGatewayPayment(payment.id);
    const capturedPayment = await ensureCapturedPayment(
      currentPayment,
      payment.order_id,
      paymentAmountPaise(order.totalAmount)
    );
    return recordCapturedPayment(capturedPayment);
  }
  return recordCapturedPayment(payment);
}
