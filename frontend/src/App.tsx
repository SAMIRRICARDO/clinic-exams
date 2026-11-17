import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AppLayout } from './components/AppLayout';
import { LoadingPanel } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { AgendaPage } from './pages/AgendaPage';
import { ReportsPage } from './pages/ReportsPage';
import { PatientAppointmentsPage } from './pages/PatientAppointmentsPage';
import { PatientReportsPage } from './pages/PatientReportsPage';
import { PatientReportReaderPage } from './pages/PatientReportReaderPage';

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 48, maxWidth: 640, margin: '0 auto' }}>
        <LoadingPanel label="Verificando sessão..." />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isStaff = user.role === 'STAFF';

  return (
    <AppLayout>
      <Routes>
        {isStaff ? (
          <>
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/laudos" element={<ReportsPage />} />
            <Route path="*" element={<Navigate to="/agenda" replace />} />
          </>
        ) : (
          <>
            <Route path="/portal" element={<PatientAppointmentsPage />} />
            <Route path="/portal/laudos" element={<PatientReportsPage />} />
            <Route path="/portal/laudos/:id" element={<PatientReportReaderPage />} />
            <Route path="*" element={<Navigate to="/portal" replace />} />
          </>
        )}
      </Routes>
    </AppLayout>
  );
}
