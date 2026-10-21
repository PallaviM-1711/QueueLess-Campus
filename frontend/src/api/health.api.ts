/**
 * health.api.ts
 * Thin wrapper around the /api/health endpoint.
 */

import axiosClient from './axiosClient';

export interface HealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
  uptime: string;
  environment: string;
  database: { state: number; label: string };
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await axiosClient.get<HealthResponse>('/api/health');
  return data;
}
