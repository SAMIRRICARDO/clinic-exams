export type Role = 'STAFF' | 'PATIENT';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  patientId: string | null;
}

export interface ExamType {
  id: string;
  code: string;
  name: string;
  durationMinutes: number;
}

export interface PatientOption {
  id: string;
  fullName: string;
  document: string;
  birthDate: string | null;
}

export interface Appointment {
  id: string;
  scheduledAt: string;
  scheduledAtIso: string;
  dayKey: string;
  timeLabel: string;
  status: 'ACTIVE' | 'CANCELLED';
  examType: { id: string; code: string; name: string };
  patient: { id: string; fullName: string; document: string };
  hasReport: boolean;
  reportStatus: 'DRAFT' | 'PUBLISHED' | null;
  canCancel: boolean;
}

export interface Slot {
  scheduledAt: string;
  scheduledAtIso: string;
  timeLabel: string;
  available: boolean;
  isPast: boolean;
  occupiedBy: string | null;
}

export interface Report {
  id: string;
  appointmentId: string;
  title: string;
  body: string;
  professionalName: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  publishedAtIso: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSummary {
  id: string;
  appointmentId: string;
  title: string;
  professionalName: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  publishedAtIso: string | null;
  patientName?: string;
  examTypeName?: string;
  scheduledAt?: string;
}
