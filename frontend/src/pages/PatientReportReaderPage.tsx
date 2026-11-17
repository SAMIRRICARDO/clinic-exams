import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import type { Report } from '../types';
import { formatDateTime } from '../format';
import { Alert, Card, LoadingPanel } from '../components/ui';

export function PatientReportReaderPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .myReport(id)
      .then(setReport)
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.status === 404
              ? 'Laudo não encontrado ou ainda não publicado. Se o laudo for de outro paciente, o acesso é negado.'
              : err.message
            : 'Falha ao carregar o laudo.',
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <LoadingPanel label="Abrindo laudo..." />;
  }

  if (error || !report) {
    return (
      <Card>
        <div className="card__body stack">
          <Alert kind="error">{error ?? 'Laudo indisponível.'}</Alert>
          <Link className="btn btn--ghost" to="/portal/laudos">
            ← Voltar para meus laudos
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="card__body">
        <Link className="small" to="/portal/laudos">
          ← Voltar para meus laudos
        </Link>

        <article className="report-doc" style={{ marginTop: 20 }}>
          <h2 className="report-doc__title">{report.title}</h2>
          <div className="report-doc__meta">
            <span><strong>Profissional:</strong> {report.professionalName}</span>
            {report.publishedAtIso && (
              <span><strong>Publicado em:</strong> {formatDateTime(report.publishedAtIso)}</span>
            )}
            <span className="badge badge--published">Publicado</span>
          </div>
          <div className="report-doc__body">{report.body}</div>
        </article>
      </div>
    </Card>
  );
}
