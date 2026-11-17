import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import type { Appointment, ExamType, PatientOption, Slot } from '../types';
import { addDays, formatLongDate, todayKey } from '../format';
import { Alert, Card, CardHead, EmptyState, LoadingPanel, StatusBadge } from '../components/ui';

export function AgendaPage() {
  const [day, setDay] = useState<string>(todayKey());
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({ patientId: '', examTypeId: '', scheduledAt: '' });

  // Filtros da listagem
  const [filterPatient, setFilterPatient] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadCatalog = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([api.patients(), api.examTypes()]);
      setPatients(p);
      setExamTypes(e);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar o catálogo.');
    }
  }, []);

  const loadDay = useCallback(async (dayKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const s = await api.availability(dayKey);
      setSlots(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar a disponibilidade.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    try {
      const a = await api.appointments({
        date: filterDate || undefined,
        patientId: filterPatient || undefined,
        status: filterStatus || undefined,
      });
      setAppointments(a);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar os agendamentos.');
    }
  }, [filterDate, filterPatient, filterStatus]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadDay(day);
  }, [day, loadDay]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.scheduledAt === form.scheduledAt),
    [slots, form.scheduledAt],
  );

  const canSubmit = form.patientId && form.examTypeId && form.scheduledAt && !saving;

  const resetForm = () => {
    setForm({ patientId: '', examTypeId: '', scheduledAt: '' });
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await api.createAppointment({
        patientId: form.patientId,
        examTypeId: form.examTypeId,
        scheduledAt: form.scheduledAt,
      });
      setSuccess(
        `Agendamento confirmado: ${created.patient.fullName} — ${created.examType.name} em ${formatLongDate(created.scheduledAt)} às ${created.timeLabel}.`,
      );
      resetForm();
      await Promise.all([loadDay(day), loadAppointments()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o agendamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    setError(null);
    setSuccess(null);
    try {
      await api.cancelAppointment(id);
      setSuccess('Agendamento cancelado. O horário voltou a ficar disponível.');
      await Promise.all([loadDay(day), loadAppointments()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cancelar o agendamento.');
    }
  };

  return (
    <>
      <div className="page__head">
        <div>
          <div className="page__eyebrow">Equipe da clínica</div>
          <h1>Agenda de exames</h1>
          <p className="page__sub">
            Sala única, horários fixos de 30 minutos. Não é possível agendar no passado nem
            ocupar dois agendamentos ativos no mesmo horário.
          </p>
        </div>
      </div>

      <div className="stack" style={{ gap: 20 }}>
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">{success}</Alert>}

        <Card>
          <CardHead
            title="Novo agendamento"
            hint="Selecione paciente, tipo de exame e um horário livre"
          />
          <div className="card__body stack">
            <div className="form-row">
              <div className="field">
                <label className="field__label" htmlFor="patient">Paciente</label>
                <select
                  id="patient"
                  className="select"
                  value={form.patientId}
                  onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                >
                  <option value="">Selecione um paciente</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} — {p.document}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="examType">Tipo de exame</label>
                <select
                  id="examType"
                  className="select"
                  value={form.examTypeId}
                  onChange={(e) => setForm((f) => ({ ...f, examTypeId: e.target.value }))}
                >
                  <option value="">Selecione o exame</option>
                  {examTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.durationMinutes} min)
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="day">Data</label>
                <input
                  id="day"
                  className="input"
                  type="date"
                  min={todayKey()}
                  value={day}
                  onChange={(e) => {
                    setDay(e.target.value || todayKey());
                    setForm((f) => ({ ...f, scheduledAt: '' }));
                  }}
                />
                <span className="field__hint">
                  <button className="login__demo-btn" type="button" onClick={() => { setDay(addDays(day, -1)); setForm((f) => ({ ...f, scheduledAt: '' })); }}>← dia anterior</button>
                  {' · '}
                  <button className="login__demo-btn" type="button" onClick={() => { setDay(addDays(day, 1)); setForm((f) => ({ ...f, scheduledAt: '' })); }}>próximo dia →</button>
                </span>
              </div>
            </div>

            <div className="divider" />

            <div>
              <div className="field__label" style={{ marginBottom: 8 }}>
                Horários — {formatLongDate(`${day}T12:00:00-03:00`)}
              </div>
              {loading ? (
                <LoadingPanel label="Carregando horários..." />
              ) : (
                <div className="slots">
                  {slots.map((s) => {
                    const cls = [
                      'slot',
                      form.scheduledAt === s.scheduledAt ? 'slot--selected' : '',
                      !s.available && !s.isPast ? 'slot--taken' : '',
                      s.isPast ? 'slot--past' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <button
                        key={s.scheduledAt}
                        type="button"
                        className={cls}
                        disabled={!s.available}
                        title={
                          s.isPast
                            ? 'Horário já passou'
                            : s.occupiedBy
                              ? `Ocupado por ${s.occupiedBy}`
                              : 'Disponível'
                        }
                        onClick={() => setForm((f) => ({ ...f, scheduledAt: s.scheduledAt }))}
                      >
                        {s.timeLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="row row--between">
              <span className="small muted">
                {selectedSlot
                  ? `Selecionado: ${selectedSlot.timeLabel} (${formatLongDate(selectedSlot.scheduledAt)})`
                  : 'Nenhum horário selecionado'}
              </span>
              <button className="btn btn--primary" disabled={!canSubmit} onClick={handleCreate}>
                {saving ? 'Agendando...' : 'Confirmar agendamento'}
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Agendamentos"
            hint="Filtre por data, paciente ou situação"
            action={
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setFilterDate('');
                  setFilterPatient('');
                  setFilterStatus('');
                }}
              >
                Limpar filtros
              </button>
            }
          />

          <div className="card__body">
            <div className="form-row">
              <div className="field">
                <label className="field__label">Filtrar por data</label>
                <input
                  className="input"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label">Filtrar por paciente</label>
                <select
                  className="select"
                  value={filterPatient}
                  onChange={(e) => setFilterPatient(e.target.value)}
                >
                  <option value="">Todos os pacientes</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label">Situação</label>
                <select
                  className="select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">Todas</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="CANCELLED">Cancelados</option>
                </select>
              </div>
            </div>
          </div>

          {appointments.length === 0 ? (
            <EmptyState
              icon="🗓"
              title="Nenhum agendamento encontrado"
              text="Ajuste os filtros ou crie um novo agendamento no formulário acima para vê-lo aqui."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Horário</th>
                    <th>Paciente</th>
                    <th>Exame</th>
                    <th>Situação</th>
                    <th>Laudo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a.id}>
                      <td>{formatLongDate(a.scheduledAt)}</td>
                      <td className="table__time">{a.timeLabel}</td>
                      <td>
                        {a.patient.fullName}
                        <div className="table__muted">{a.patient.document}</div>
                      </td>
                      <td>{a.examType.name}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        {a.reportStatus ? (
                          <StatusBadge status={a.reportStatus} />
                        ) : (
                          <span className="table__muted">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn--danger btn--sm"
                          disabled={!a.canCancel}
                          title={!a.canCancel ? 'Laudo publicado impede o cancelamento' : undefined}
                          onClick={() => handleCancel(a.id)}
                        >
                          Cancelar
                        </button>
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
