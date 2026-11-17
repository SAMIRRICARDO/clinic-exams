import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import type { Appointment } from '../types';
import { formatLongDate } from '../format';
import { Alert, Card, CardHead, EmptyState, LoadingPanel, StatusBadge } from '../components/ui';
import { useAuth } from '../auth';

export function PatientAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .myAppointments()
      .then(setAppointments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Falha ao carregar seus exames.'))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = appointments.filter((a) => a.status === 'ACTIVE');

  return (
    <>
      <div className="page__head">
        <div>
          <div className="page__eyebrow">Portal do paciente</div>
          <h1>Meus exames</h1>
          <p className="page__sub">
            Olá, {user?.name}. Aqui você vê apenas os seus próprios agendamentos e laudos.
            Exames com laudo publicado ficam marcados e podem ser lidos na íntegra.
          </p>
        </div>
      </div>

      <div className="stack" style={{ gap: 20 }}>
        {error && <Alert kind="error">{error}</Alert>}

        {loading ? (
          <LoadingPanel label="Carregando seus exames..." />
        ) : (
          <Card>
            <CardHead
              title="Agendamentos"
              hint={`${upcoming.length} exame(s) ativo(s) de ${appointments.length} no total`}
            />
            {appointments.length === 0 ? (
              <EmptyState
                icon="🗓"
                title="Você ainda não tem exames"
                text="Quando a clínica agendar um exame para você, ele aparecerá aqui com o tipo, a data e a situação."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Horário</th>
                      <th>Exame</th>
                      <th>Situação</th>
                      <th>Laudo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((a) => (
                      <tr key={a.id}>
                        <td>{formatLongDate(a.scheduledAt)}</td>
                        <td className="table__time">{a.timeLabel}</td>
                        <td>{a.examType.name}</td>
                        <td><StatusBadge status={a.status} /></td>
                        <td>
                          {a.reportStatus === 'PUBLISHED' ? (
                            <Link to="/portal/laudos" className="badge badge--published" style={{ textDecoration: 'none' }}>
                              Publicado — ler
                            </Link>
                          ) : a.reportStatus === 'DRAFT' ? (
                            <span className="table__muted">Em preparação</span>
                          ) : (
                            <span className="table__muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
