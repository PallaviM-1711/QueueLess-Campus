import axiosClient from './axiosClient';

export interface CanteenSummary {
  _id: string;
  name: string;
  description?: string;
  location?: string;
  imageUrl?: string;
  isOpen: boolean;
  openingTime: string;
  closingTime: string;
}

export interface MenuItem {
  _id: string;
  canteen: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  isVeg: boolean;
  preparationTimeMinutes: number;
}

interface CanteensResponse {
  success: boolean;
  canteens: CanteenSummary[];
}

interface MenuResponse {
  success: boolean;
  canteen: CanteenSummary;
  items: MenuItem[];
  categories: string[];
}

export interface MenuItemInput {
  name: string;
  description?: string;
  category: string;
  price: number;
  imageUrl?: string;
  isAvailable?: boolean;
  isVeg?: boolean;
  preparationTimeMinutes?: number;
}

export async function getCanteens(): Promise<CanteenSummary[]> {
  const { data } = await axiosClient.get<CanteensResponse>('/api/canteens');
  return data.canteens;
}

export async function getMenu(
  canteenId: string,
  filters: { search?: string; category?: string; isVeg?: boolean } = {}
): Promise<MenuResponse> {
  const { data } = await axiosClient.get<MenuResponse>(`/api/canteens/${canteenId}/menu`, {
    params: filters,
  });
  return data;
}

export async function createMenuItem(
  canteenId: string,
  input: MenuItemInput
): Promise<MenuItem> {
  const { data } = await axiosClient.post<{ success: boolean; item: MenuItem }>(
    `/api/canteens/${canteenId}/menu`,
    input
  );
  return data.item;
}

export async function updateMenuItem(
  canteenId: string,
  itemId: string,
  input: Partial<MenuItemInput>
): Promise<MenuItem> {
  const { data } = await axiosClient.patch<{ success: boolean; item: MenuItem }>(
    `/api/canteens/${canteenId}/menu/${itemId}`,
    input
  );
  return data.item;
}

export async function deactivateMenuItem(canteenId: string, itemId: string): Promise<void> {
  await axiosClient.delete(`/api/canteens/${canteenId}/menu/${itemId}`);
}
