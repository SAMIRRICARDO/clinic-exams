import type {
  Appointment,
  AuthUser,
  ExamType,
  PatientOption,
  Report,
  ReportSummary,
  Slot,
} from './types';
import { setClinicTimezone } from './format';

const BASE = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'clinic.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.message ?? 'Erro inesperado.', err.code);
  }
  return data as T;
}

/**
 * Carrega o fuso da clinica no GET /health do backend (fonte de verdade).
 * Nao lanca: se a API estiver indisponivel, format.ts mantem o fallback.
 */
export async function loadClinicTimezone(): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const health = await request<{ status: string; timezone: string }>('/health', {
      signal: controller.signal,
    });
    if (health.timezone) setClinicTimezone(health.timezone);
  } catch {
    // API indisponivel: mantem o fallback de inicializacao em format.ts.
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  // ---- Auth ----
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<AuthUser>('/auth/me'),

  // ---- Catalogo ----
  patients: () => request<PatientOption[]>('/patients'),
  examTypes: () => request<ExamType[]>('/exam-types'),

  // ---- Agendamentos (staff) ----
  availability: (date: string) => request<Slot[]>(`/appointments/availability?date=${date}`),
  appointments: (params: { date?: string; patientId?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.date) qs.set('date', params.date);
    if (params.patientId) qs.set('patientId', params.patientId);
    if (params.status) qs.set('status', params.status);
    const q = qs.toString();
    return request<Appointment[]>(`/appointments${q ? `?${q}` : ''}`);
  },
  createAppointment: (body: { patientId: string; examTypeId: string; scheduledAt: string }) =>
    request<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(body) }),
  cancelAppointment: (id: string) =>
    request<Appointment>(`/appointments/${id}/cancel`, { method: 'POST' }),

  // ---- Laudos (staff) ----
  reports: () => request<ReportSummary[]>('/reports'),
  report: (id: string) => request<Report>(`/reports/${id}`),
  saveDraft: (appointmentId: string, body: { title: string; body: string; professionalName: string }) =>
    request<Report>(`/appointments/${appointmentId}/report`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  publishReport: (id: string) =>
    request<Report>(`/reports/${id}/publish`, { method: 'POST' }),

  // ---- Portal do paciente ----
  myAppointments: () => request<Appointment[]>('/me/appointments'),
  myReports: () => request<ReportSummary[]>('/me/reports'),
  myReport: (id: string) => request<Report>(`/me/reports/${id}`),
};
