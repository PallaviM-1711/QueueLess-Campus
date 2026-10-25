import axiosClient from './axiosClient';
import type { CanteenSummary } from './menu.api';

export interface AdminCanteen extends CanteenSummary {
  university: string;
  isActive: boolean;
}

export interface AdminStaff {
  _id: string;
  name: string;
  email: string;
  role: 'staff' | 'canteen_admin';
  canteen?: { _id: string; name: string } | string | null;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AdminAnalytics {
  range: { from: string; to: string };
  summary: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    unpaidOrders: number;
    revenue: number;
    averagePreparationMinutes: number | null;
  };
  canteens: Array<{
    canteenId: string;
    name: string;
    orders: number;
    revenue: number;
  }>;
  popularItems: Array<{
    name: string;
    unitsOrdered: number;
    orderCount: number;
  }>;
}

interface CanteenResponse {
  success: boolean;
  canteen: AdminCanteen;
}

export async function getAdminAnalytics(from: string, to: string): Promise<AdminAnalytics> {
  const { data } = await axiosClient.get<{
    success: boolean;
    analytics: AdminAnalytics;
  }>('/api/admin/analytics', { params: { from, to } });
  return data.analytics;
}

export async function getAdminCanteens(): Promise<AdminCanteen[]> {
  const { data } = await axiosClient.get<{ success: boolean; canteens: AdminCanteen[] }>(
    '/api/admin/canteens'
  );
  return data.canteens;
}

export async function createAdminCanteen(input: {
  name: string;
  location?: string;
  openingTime: string;
  closingTime: string;
}): Promise<AdminCanteen> {
  const { data } = await axiosClient.post<CanteenResponse>('/api/admin/canteens', input);
  return data.canteen;
}

export async function setCanteenOpen(canteenId: string, isOpen: boolean): Promise<AdminCanteen> {
  const { data } = await axiosClient.patch<CanteenResponse>(
    `/api/admin/canteens/${canteenId}`,
    { isOpen }
  );
  return data.canteen;
}

export async function getAdminStaff(): Promise<AdminStaff[]> {
  const { data } = await axiosClient.get<{ success: boolean; staff: AdminStaff[] }>(
    '/api/admin/staff'
  );
  return data.staff;
}

export async function inviteStaff(input: {
  name: string;
  email: string;
  role: AdminStaff['role'];
  canteenId: string;
}): Promise<string> {
  const { data } = await axiosClient.post<{ success: boolean; message: string }>(
    '/api/admin/staff',
    input
  );
  return data.message;
}

export async function resendStaffInvite(staffId: string): Promise<string> {
  const { data } = await axiosClient.post<{ success: boolean; message: string }>(
    `/api/admin/staff/${staffId}/resend-invitation`
  );
  return data.message;
}

export async function updateStaff(
  staffId: string,
  input: { canteenId?: string; isActive?: boolean }
): Promise<AdminStaff> {
  const { data } = await axiosClient.patch<{ success: boolean; staff: AdminStaff }>(
    `/api/admin/staff/${staffId}`,
    input
  );
  return data.staff;
}
