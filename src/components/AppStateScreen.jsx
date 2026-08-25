import React from 'react';
import { AlertTriangle, Eye } from 'lucide-react';
import { Button, Skeleton } from './ui/Primitives';

export default function AppStateScreen({ type = 'loading', title, message, primaryAction, secondaryAction }) {
  const isLoading = type === 'loading';
  return (
    <main className={`appStateScreen appStateScreen-${type}`} aria-busy={isLoading || undefined}>
      <section className="appStateCard" role={isLoading ? 'status' : 'alert'}>
        <span className="appStateBrand" aria-hidden="true">{isLoading ? <Eye size={25} /> : <AlertTriangle size={25} />}</span>
        <h1>{title}</h1>
        {message && <p>{message}</p>}
        {isLoading ? (
          <div className="appStateSkeletons" aria-hidden="true">
            <Skeleton width="100%" height={12} /><Skeleton width="74%" height={12} />
          </div>
        ) : (
          <div className="appStateActions">
            {primaryAction && <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>}
            {secondaryAction && <Button variant="secondary" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}
          </div>
        )}
      </section>
    </main>
  );
}
