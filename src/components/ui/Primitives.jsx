import React from 'react';

const classNames = (...values) => values.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size = 'md', className, loading = false, disabled, type = 'button', children, ...props }) {
  return (
    <button type={type} className={classNames('uiButton', `uiButton-${variant}`, `uiButton-${size}`, className)} disabled={disabled || loading} aria-busy={loading || undefined} data-loading={loading || undefined} {...props}>
      {loading && <span className="uiButtonSpinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({ as: Component = 'section', tone = 'default', className, children, ...props }) {
  return <Component className={classNames('uiCard', `uiCard-${tone}`, className)} {...props}>{children}</Component>;
}

export function Panel({ className, children, ...props }) {
  return <section className={classNames('uiPanel', className)} {...props}>{children}</section>;
}

export function StatusBadge({ tone = 'neutral', icon, children, className, ...props }) {
  return <span className={classNames('uiStatusBadge', `uiStatusBadge-${tone}`, className)} {...props}>{icon && <span aria-hidden="true">{icon}</span>}{children}</span>;
}

export function Skeleton({ width, height, className, ...props }) {
  return <span className={classNames('uiSkeleton', className)} style={{ width, height }} aria-hidden="true" {...props} />;
}

export function EmptyState({ icon, title, description, action, className, ...props }) {
  return (
    <div className={classNames('uiEmptyState', className)} {...props}>
      {icon && <span className="uiEmptyStateIcon" aria-hidden="true">{icon}</span>}
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && <div className="uiEmptyStateAction">{action}</div>}
    </div>
  );
}

export function TabBar({ label, value, tabs, onChange, className }) {
  const handleKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[nextIndex].value);
    event.currentTarget.parentElement?.children[nextIndex]?.focus();
  };

  return (
    <div className={classNames('uiTabBar', className)} role="tablist" aria-label={label} aria-orientation="horizontal">
      {tabs.map((tab, index) => (
        <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value} tabIndex={value === tab.value ? 0 : -1} className={value === tab.value ? 'active' : ''} onClick={() => onChange(tab.value)} onKeyDown={event => handleKeyDown(event, index)}>
          {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
          <span>{tab.label}</span>
          {tab.badge != null && <small>{tab.badge}</small>}
        </button>
      ))}
    </div>
  );
}
