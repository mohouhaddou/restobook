import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Inbox, LoaderCircle, RefreshCw } from 'lucide-react';

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="ai-skeleton" aria-label="Chargement" aria-busy="true">{Array.from({ length: lines }, (_, index) => <span key={index} />)}</div>;
}

export function LoadingState({ label = 'Chargement des données…' }: { label?: string }) {
  return <div className="ai-state"><LoaderCircle className="ai-spin" aria-hidden="true" /><p>{label}</p></div>;
}

export function EmptyState({ title = 'Aucune donnée', description = 'Les éléments apparaîtront ici dès qu’ils seront disponibles.' }: { title?: string; description?: string }) {
  return <div className="ai-state"><Inbox aria-hidden="true" /><h3>{title}</h3><p>{description}</p></div>;
}

interface BoundaryState { hasError: boolean; }
export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { hasError: false };
  static getDerivedStateFromError(): BoundaryState { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[AI Command Center]', error, info.componentStack); }
  render() {
    if (this.state.hasError) return (
      <div className="ai-state ai-state--error" role="alert">
        <AlertTriangle aria-hidden="true" />
        <h2>Impossible d’afficher cette vue</h2>
        <p>Les données simulées sont intactes. Rechargez uniquement ce module.</p>
        <button className="ai-btn ai-btn--primary" onClick={() => this.setState({ hasError: false })}><RefreshCw size={17} /> Réessayer</button>
      </div>
    );
    return this.props.children;
  }
}
