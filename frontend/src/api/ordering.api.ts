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
  createdAt: string;
  canteen: { _id: string; name: string; location?: string };
  pickupSlot: { _id: string; date: string; startTime: string; endTime: string };
  notes?: string;
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
