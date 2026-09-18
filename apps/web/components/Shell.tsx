'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Health } from '@/lib/types';

const WORKSPACE_NAV = [
  { href: '/', label: 'Start discovery', icon: '◆' },
  { href: '/projects', label: 'Projects', icon: '▤' },
  { href: '/prompts', label: 'Prompt library', icon: '❯' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export function Rail({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <nav className="rail">
      <Link href="/" className="rail__brand" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="rail__mark">D</span>
        <span>
          <span className="rail__name">Discovery</span>
          <br />
          <span className="rail__sub">Product Research</span>
        </span>
      </Link>

      <div className="rail__group">
        {WORKSPACE_NAV.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rail__link${active ? ' rail__link--on' : ''}`}
            >
              <span className="rail__icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {children}

      <div className="rail__foot">
        {health ? (
          <>
            <div className="row" style={{ gap: 6, marginBottom: 4 }}>
              <span
                className="badge__dot"
                style={{ background: health.llm.live ? 'var(--pine)' : 'var(--amber)' }}
              />
              <span>{health.llm.live ? 'Live AI' : 'Deterministic mode'}</span>
            </div>
            <div className="tiny subtle">
              {health.prompts.count} prompts · v{health.version}
            </div>
          </>
        ) : (
          <span className="tiny">API unreachable</span>
        )}
      </div>
    </nav>
  );
}

export function TopBar({
  crumbs, actions,
}: {
  crumbs: { label: string; href?: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="crumbs">
        {crumbs.map((crumb, index) => (
          <span key={index} className="row" style={{ gap: 7 }}>
            {index > 0 && <span className="crumbs__sep">/</span>}
            {crumb.href ? (
              <Link href={crumb.href}>{crumb.label}</Link>
            ) : (
              <span className="crumbs__now">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>
      {actions && <div className="topbar__right">{actions}</div>}
    </header>
  );
}

export function PageHead({
  title, lede, actions,
}: { title: string; lede?: string; actions?: React.ReactNode }) {
  return (
    <div className="pagehead">
      <div className="pagehead__row">
        <div className="pagehead__title">
          <h1>{title}</h1>
          {lede && <p className="pagehead__lede">{lede}</p>}
        </div>
        {actions && <div className="pagehead__actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Empty({
  mark = '○', title, children, action,
}: {
  mark?: string; title: string;
  children?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__mark">{mark}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Notice({
  tone = 'info', mark, children,
}: {
  tone?: 'info' | 'warn' | 'risk' | 'good';
  mark?: string;
  children: React.ReactNode;
}) {
  const defaultMark = { info: 'i', warn: '!', risk: '!', good: '✓' }[tone];
  return (
    <div className={`notice notice--${tone}`}>
      <span className="notice__mark">{mark ?? defaultMark}</span>
      <div>{children}</div>
    </div>
  );
}

export function Stat({
  label, value, note,
}: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="stat">
      <div className="stat__k">{label}</div>
      <div className="stat__v">{value}</div>
      {note && <div className="stat__n">{note}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <Notice tone="risk">{error}</Notice>;
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return (
    <div className="row" style={{ padding: 24, justifyContent: 'center' }}>
      <span className="spin" />
      <span className="muted small">{what}…</span>
    </div>
  );
}
