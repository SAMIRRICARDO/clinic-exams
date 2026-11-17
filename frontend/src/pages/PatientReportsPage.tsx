import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import type { ReportSummary } from '../types';
import { formatDateTime } from '../format';
import { Alert, Card, CardHead, EmptyState, LoadingPanel } from '../components/ui';

export function PatientReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .myReports()
      .then(setReports)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Falha ao carregar seus laudos.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page__head">
        <div>
          <div className="page__eyebrow">Portal do paciente</div>
          <h1>Meus laudos</h1>
          <p className="page__sub">
            Somente laudos publicados pela clínica aparecem aqui. Rascunhos em preparação não
            são exibidos ao paciente.
          </p>
        </div>
      </div>

      <div className="stack" style={{ gap: 20 }}>
        {error && <Alert kind="error">{error}</Alert>}

        {loading ? (
          <LoadingPanel label="Carregando seus laudos..." />
        ) : reports.length === 0 ? (
          <Card>
            <EmptyState
              icon="📄"
              title="Nenhum laudo publicado"
              text="Quando a clínica publicar o laudo de um dos seus exames, ele ficará disponível aqui para leitura."
            />
          </Card>
        ) : (
          <Card>
            <CardHead title="Laudos publicados" hint={`${reports.length} laudo(s) disponível(is)`} />
            <div className="card__body grid grid--2">
              {reports.map((r) => (
                <Link
                  key={r.id}
                  to={`/portal/laudos/${r.id}`}
                  className="card"
                  style={{ padding: 18, display: 'block', color: 'inherit', textDecoration: 'none' }}
                >
                  <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <div className="card__title">{r.title}</div>
                      <div className="card__hint">
                        {r.examTypeName} · {r.scheduledAt ? formatDateTime(r.scheduledAt) : ''}
                      </div>
                    </div>
                    <span className="badge badge--published">Publicado</span>
                  </div>
                  <div className="divider" style={{ margin: '14px 0' }} />
                  <div className="small muted">
                    {r.professionalName}
                    {r.publishedAtIso ? ` · publicado em ${formatDateTime(r.publishedAtIso)}` : ''}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
