import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api';
import { getClinicTimezone, isClinicTimezoneLoaded } from '../format';
import { Alert } from '../components/ui';

const DEMO_ACCOUNTS = [
  { label: 'Equipe da clínica', email: 'staff@clinica.com' },
  { label: 'Paciente — Ana Souza', email: 'ana.souza@email.com' },
  { label: 'Paciente — Bruno Lima', email: 'bruno.lima@email.com' },
];
const DEMO_PASSWORD = 'demo1234';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={user.role === 'STAFF' ? '/agenda' : '/portal'} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(email.trim(), password);
      navigate(u.role === 'STAFF' ? '/agenda' : '/portal', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const fill = (mail: string) => {
    setEmail(mail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <div className="login">
      <aside className="login__aside">
        <div className="login__brand">
          <span className="topbar__mark">D</span>
          <span>Clínica Drtis</span>
        </div>

        <div className="login__pitch">
          <h1>Exames agendados. Laudos ao alcance do paciente.</h1>
          <p>
            Plataforma interna da clínica para agendar exames, registrar e publicar laudos e
            permitir que cada paciente consulte apenas os seus próprios resultados.
          </p>
          <div className="login__features">
            <div className="login__feature"><span>→</span><span>Agenda com horários fixos de 30 minutos em sala única</span></div>
            <div className="login__feature"><span>→</span><span>Laudos em rascunho, publicados só quando o profissional decide</span></div>
            <div className="login__feature"><span>→</span><span>Acesso do paciente restrito aos seus próprios exames</span></div>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
          Fuso horário da clínica: {isClinicTimezoneLoaded() ? getClinicTimezone() : 'não disponível'}
        </div>
      </aside>

      <main className="login__main">
        <div className="login__form">
          <h2>Entrar</h2>
          <p>Acesse com a conta da equipe ou com o e-mail cadastrado como paciente.</p>

          <form onSubmit={handleSubmit} className="stack">
            {error && <Alert kind="error">{error}</Alert>}

            <div className="field">
              <label className="field__label" htmlFor="email">E-mail</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="password">Senha</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="login__demo">
            <div className="login__demo-title">Contas de demonstração</div>
            {DEMO_ACCOUNTS.map((a) => (
              <div className="login__demo-row" key={a.email}>
                <span>{a.label}</span>
                <button className="login__demo-btn" type="button" onClick={() => fill(a.email)}>
                  usar
                </button>
              </div>
            ))}
            <div className="divider" />
            <div className="login__demo-row">
              <span className="muted">Senha para todas</span>
              <code>{DEMO_PASSWORD}</code>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
