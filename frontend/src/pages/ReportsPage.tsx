import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Appointment, Report, ReportSummary } from '../types';
import { formatDateTime, formatLongDate } from '../format';
import { Alert, Card, CardHead, EmptyState, StatusBadge } from '../components/ui';

export function ReportsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [current, setCurrent] = useState<Report | null>(null);
  const [form, setForm] = useState({ title: '', body: '', professionalName: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api.appointments(), api.reports()]);
      setAppointments(a);
      setReports(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar os laudos.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAppointment = async (a: Appointment) => {
    setError(null);
    setSuccess(null);
    setSelected(a);
    setCurrent(null);
    setForm({ title: '', body: '', professionalName: '' });

    if (a.reportStatus) {
      try {
        // Localiza o laudo do agendamento na lista carregada.
        const summary = reports.find((r) => r.appointmentId === a.id);
        if (summary) {
          const full = await api.report(summary.id);
          setCurrent(full);
          setForm({ title: full.title, body: full.body, professionalName: full.professionalName });
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Falha ao abrir o laudo.');
      }
    }
  };

  const handleSaveDraft = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await api.saveDraft(selected.id, form);
      setCurrent(saved);
      setSuccess('Rascunho salvo. Ele fica visível apenas para a clínica.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o rascunho.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!current) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const published = await api.publishReport(current.id);
      setCurrent(published);
      setSuccess(
        `Laudo publicado em ${published.publishedAtIso ? formatDateTime(published.publishedAtIso) : ''}. Agora está disponível para o paciente e não pode mais ser editado.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível publicar o laudo.');
    } finally {
      setSaving(false);
    }
  };

  const isPublished = current?.status === 'PUBLISHED';
  const eligible = appointments.filter((a) => a.status === 'ACTIVE');

  return (
    <>
      <div className="page__head">
        <div>
          <div className="page__eyebrow">Equipe da clínica</div>
          <h1>Laudos</h1>
          <p className="page__sub">
            Cada agendamento pode ter um laudo. Salve como rascunho quantas vezes precisar;
            depois de publicado, o laudo fica somente leitura e visível para o paciente.
          </p>
        </div>
      </div>

      <div className="stack" style={{ gap: 20 }}>
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">{success}</Alert>}

        <div className="grid grid--2">
          <Card>
            <CardHead title="Agendamentos ativos" hint="Escolha um para cadastrar ou revisar o laudo" />
            {eligible.length === 0 ? (
              <EmptyState
                icon="📄"
                title="Nenhum agendamento ativo"
                text="Crie um agendamento na Agenda para poder cadastrar um laudo para ele."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Paciente</th>
                      <th>Exame</th>
                      <th>Laudo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligible.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => void openAppointment(a)}
                        style={{ cursor: 'pointer', background: selected?.id === a.id ? 'var(--teal-50)' : undefined }}
                      >
                        <td>
                          {formatLongDate(a.scheduledAt)}
                          <div className="table__muted">{a.timeLabel}</div>
                        </td>
                        <td>{a.patient.fullName}</td>
                        <td>{a.examType.name}</td>
                        <td>
                          {a.reportStatus ? (
                            <StatusBadge status={a.reportStatus} />
                          ) : (
                            <span className="table__muted">sem laudo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHead
              title={selected ? `Laudo — ${selected.patient.fullName}` : 'Editor de laudo'}
              hint={
                selected
                  ? `${selected.examType.name} · ${formatLongDate(selected.scheduledAt)} às ${selected.timeLabel}`
                  : 'Selecione um agendamento à esquerda'
              }
              action={current ? <StatusBadge status={current.status} /> : undefined}
            />

            {!selected ? (
              <EmptyState
                icon="✎"
                title="Nenhum agendamento selecionado"
                text="Clique em um agendamento ativo para escrever o laudo, salvar como rascunho e publicar."
              />
            ) : (
              <div className="card__body stack">
                {isPublished && (
                  <Alert kind="info">
                    Laudo publicado — somente leitura. Publicado em{' '}
                    {current?.publishedAtIso ? formatDateTime(current.publishedAtIso) : ''}.
                  </Alert>
                )}

                <div className="field">
                  <label className="field__label" htmlFor="title">Título</label>
                  <input
                    id="title"
                    className="input"
                    value={form.title}
                    disabled={isPublished}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Ex.: Raio-X de tórax — resultado"
                  />
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="professional">Profissional responsável</label>
                  <input
                    id="professional"
                    className="input"
                    value={form.professionalName}
                    disabled={isPublished}
                    onChange={(e) => setForm((f) => ({ ...f, professionalName: e.target.value }))}
                    placeholder="Ex.: Dr. Ricardo Alves — CRM 12345"
                  />
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="body">Texto do laudo</label>
                  <textarea
                    id="body"
                    className="textarea"
                    value={form.body}
                    disabled={isPublished}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder="Descreva os achados e a conclusão do exame."
                  />
                </div>

                {!isPublished && (
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn--ghost"
                      disabled={saving || !form.title || !form.body || !form.professionalName}
                      onClick={handleSaveDraft}
                    >
                      {saving ? 'Salvando...' : current ? 'Salvar rascunho' : 'Criar rascunho'}
                    </button>
                    <button
                      className="btn btn--primary"
                      disabled={saving || !current || !form.title || !form.body || !form.professionalName}
                      title={!current ? 'Salve o rascunho antes de publicar' : undefined}
                      onClick={handlePublish}
                    >
                      Publicar laudo
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHead title="Todos os laudos" hint="Inclui rascunhos e publicados" />
          {reports.length === 0 ? (
            <EmptyState
              icon="📁"
              title="Nenhum laudo cadastrado"
              text="Os laudos criados para os agendamentos aparecem aqui, com o status de rascunho ou publicado."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Paciente</th>
                    <th>Exame</th>
                    <th>Profissional</th>
                    <th>Status</th>
                    <th>Publicado em</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td>{r.title}</td>
                      <td>{r.patientName}</td>
                      <td>{r.examTypeName}</td>
                      <td>{r.professionalName}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="table__muted">
                        {r.publishedAtIso ? formatDateTime(r.publishedAtIso) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
