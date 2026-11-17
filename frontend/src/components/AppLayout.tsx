import { NavLink, useNavigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth } from '../auth';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isStaff = user?.role === 'STAFF';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__mark">D</span>
          <span>Clínica Drtis</span>
        </div>

        <nav className="topbar__nav">
          {isStaff ? (
            <>
              <NavLink
                to="/agenda"
                className={({ isActive }) => `topbar__link${isActive ? ' topbar__link--active' : ''}`}
              >
                Agenda
              </NavLink>
              <NavLink
                to="/laudos"
                className={({ isActive }) => `topbar__link${isActive ? ' topbar__link--active' : ''}`}
              >
                Laudos
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/portal"
                className={({ isActive }) => `topbar__link${isActive ? ' topbar__link--active' : ''}`}
              >
                Meus exames
              </NavLink>
              <NavLink
                to="/portal/laudos"
                className={({ isActive }) => `topbar__link${isActive ? ' topbar__link--active' : ''}`}
              >
                Meus laudos
              </NavLink>
            </>
          )}
        </nav>

        <div className="topbar__spacer" />

        <div className="topbar__user">
          <span className="topbar__role">{isStaff ? 'Equipe' : 'Paciente'}</span>
          <span>{user?.name}</span>
          <button className="btn btn--ghost btn--sm" onClick={handleLogout} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
            Sair
          </button>
        </div>
      </header>

      <main className="page">{children}</main>
    </div>
  );
}
