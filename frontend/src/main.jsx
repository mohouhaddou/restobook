import React from 'react';
import ReactDOM from 'react-dom/client';

/* ── Ifilino Design System ─────────────────────── */
import './styles/variables.css';
import './styles/compat.css';
import './styles/typography.css';
import './styles/animations.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/theme-dark.css';
import './styles/pos-receipt.css';

/* Moteur Markdown partagé (Discover/Sports/Kids/Stories) — enregistrement des thèmes */
import './shared/markdown/registerThemes';

import App from './App';
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
