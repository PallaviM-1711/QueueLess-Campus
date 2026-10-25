import axiosClient from './axiosClient';

export interface PickupSlot {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  booked: number;
}

export interface OrderItem {
  menuItem: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderRecord {
  _id: string;
  items: OrderItem[];
  totalAmount: number;
  pickupToken: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentAttemptExists?: boolean;
  createdAt: string;
  canteen: { _id: string; name: string; location?: string };
  pickupSlot: { _id: string; date: string; startTime: string; endTime: string };
  notes?: string;
  student?: { _id?: string; name: string };
}

interface OrderResponse {
  success: boolean;
  order: OrderRecord;
}

export async function getPickupSlots(canteenId: string, date: string): Promise<PickupSlot[]> {
  const { data } = await axiosClient.get<{ success: boolean; slots: PickupSlot[] }>(
    `/api/canteens/${canteenId}/pickup-slots`,
    { params: { date } }
  );
  return data.slots;
}

export async function createPickupSlot(
  canteenId: string,
  input: { date: string; startTime: string; endTime: string; capacity: number }
): Promise<PickupSlot> {
  const { data } = await axiosClient.post<{ success: boolean; slot: PickupSlot }>(
    `/api/canteens/${canteenId}/pickup-slots`,
    input
  );
  return data.slot;
}

export async function placeOrder(input: {
  canteenId: string;
  pickupSlotId: string;
  paymentMethod?: 'pay_at_pickup' | 'razorpay';
  items: Array<{ menuItemId: string; quantity: number }>;
  notes?: string;
}): Promise<OrderRecord> {
  const { data } = await axiosClient.post<OrderResponse>('/api/orders', input);
  return data.order;
}

export async function getOrder(orderId: string): Promise<OrderRecord> {
  const { data } = await axiosClient.get<OrderResponse>(`/api/orders/${orderId}`);
  return data.order;
}

export async function getMyOrders(): Promise<OrderRecord[]> {
  const { data } = await axiosClient.get<{ success: boolean; orders: OrderRecord[] }>(
    '/api/orders/me'
  );
  return data.orders;
}

export async function getCanteenOrders(
  canteenId: string,
  status?: string
): Promise<OrderRecord[]> {
  const { data } = await axiosClient.get<{ success: boolean; orders: OrderRecord[] }>(
    `/api/canteens/${canteenId}/orders`,
    { params: status ? { status } : {} }
  );
  return data.orders;
}

export async function updateOrderStatus(
  canteenId: string,
  orderId: string,
  status: string
): Promise<OrderRecord> {
  const { data } = await axiosClient.patch<OrderResponse>(
    `/api/canteens/${canteenId}/orders/${orderId}/status`,
    { status }
  );
  return data.order;
}

export async function verifyPickupAtCanteen(
  canteenId: string,
  pickupToken: string
): Promise<OrderRecord> {
  const { data } = await axiosClient.post<OrderResponse>(
    `/api/canteens/${canteenId}/orders/verify-pickup`,
    { pickupToken }
  );
  return data.order;
}
