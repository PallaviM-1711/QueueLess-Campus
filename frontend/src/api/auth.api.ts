import axiosClient from './axiosClient';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
}

interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

interface MessageResponse {
  success: boolean;
  message: string;
}

export async function registerStudent(input: {
  name: string;
  email: string;
  password: string;
}): Promise<MessageResponse> {
  const { data } = await axiosClient.post<MessageResponse>('/api/auth/register', input);
  return data;
}

export async function verifyEmail(input: {
  email: string;
  otp: string;
}): Promise<AuthResponse> {
  const { data } = await axiosClient.post<AuthResponse>('/api/auth/verify-email', input);
  return data;
}

export async function resendVerificationCode(email: string): Promise<MessageResponse> {
  const { data } = await axiosClient.post<MessageResponse>('/api/auth/resend-otp', { email });
  return data;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const { data } = await axiosClient.post<AuthResponse>('/api/auth/login', input);
  return data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await axiosClient.get<{ success: boolean; user: AuthUser }>('/api/auth/me');
  return data.user;
}

export function saveAuthToken(token: string): void {
  localStorage.setItem('qlc_token', token);
}

export function clearAuthToken(): void {
  localStorage.removeItem('qlc_token');
}
