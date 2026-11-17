import { type ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHead({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card__head">
      <div>
        <div className="card__title">{title}</div>
        {hint && <div className="card__hint">{hint}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon = '—',
  title,
  text,
  action,
}: {
  icon?: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <div className="empty__title">{title}</div>
      <div className="empty__text">{text}</div>
      {action}
    </div>
  );
}

export function Alert({
  kind = 'info',
  children,
}: {
  kind?: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const icon = kind === 'error' ? '!' : kind === 'success' ? '✓' : 'i';
  return (
    <div className={`alert alert--${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      <span style={{ fontWeight: 700 }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: string }) {
  return <div className="skeleton" style={{ height, width }} />;
}

export function StatusBadge({ status }: { status: 'ACTIVE' | 'CANCELLED' | 'DRAFT' | 'PUBLISHED' }) {
  const map = {
    ACTIVE: { cls: 'badge--active', label: 'Ativo' },
    CANCELLED: { cls: 'badge--cancelled', label: 'Cancelado' },
    DRAFT: { cls: 'badge--draft', label: 'Rascunho' },
    PUBLISHED: { cls: 'badge--published', label: 'Publicado' },
  } as const;
  const { cls, label } = map[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function LoadingPanel({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="card">
      <div className="card__body stack">
        <div className="muted small">{label}</div>
        <Skeleton height={14} width="40%" />
        <Skeleton height={14} width="70%" />
        <Skeleton height={14} width="55%" />
      </div>
    </div>
  );
}
