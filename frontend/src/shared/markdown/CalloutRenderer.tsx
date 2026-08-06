import React from 'react';
import { Lightbulb, Info, AlertTriangle, Pin } from 'lucide-react';
import type { CalloutBlock } from './MarkdownParser';
import type { CalloutKind, MarkdownTheme } from './MarkdownTheme';

const DEFAULT_LABELS: Record<CalloutKind, string> = { tip: 'Astuce', info: 'Info', warning: 'Attention', note: 'Note' };
const ICONS: Record<CalloutKind, React.ComponentType<{ size?: number }>> = { tip: Lightbulb, info: Info, warning: AlertTriangle, note: Pin };

export function CalloutRenderer({ block, theme }: { block: CalloutBlock; theme: MarkdownTheme }) {
  const Icon = ICONS[block.kind];
  const label = block.title || theme.calloutLabels?.[block.kind] || DEFAULT_LABELS[block.kind];
  return (
    <div className={`${theme.classes.callout} ${theme.classes.callout}--${block.kind}`}>
      <div className={`${theme.classes.callout}-header`}>
        <Icon size={18} />
        <strong>{label}</strong>
      </div>
      <div dangerouslySetInnerHTML={{ __html: block.html }} />
    </div>
  );
}
