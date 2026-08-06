import fs from 'node:fs';

const file = 'src/styles/layout.css';
let css = fs.readFileSync(file, 'utf8');

const block = `

/* Modern app shell used by the shared professional dashboard layout. */
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--il-bg);
}
.app-sidebar {
  width: var(--il-sidebar-w);
  height: 100vh;
  position: fixed;
  inset-block-start: 0;
  inset-inline-start: 0;
  background: var(--il-gradient-navy);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: var(--il-z-fixed);
  transition: transform var(--il-transition-lg);
  box-shadow: var(--il-shadow-lg);
}
.app-main {
  flex: 1;
  min-width: 0;
  margin-inline-start: var(--il-sidebar-w);
  display: flex;
  flex-direction: column;
  transition: margin-inline-start var(--il-transition-lg), margin-inline-end var(--il-transition-lg);
}
.app-content {
  padding: 28px;
  flex: 1;
}
.app-sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--il-z-fixed) - 1);
  background: rgba(8, 17, 31, .45);
  backdrop-filter: blur(2px);
}

[dir="rtl"] .app-shell {
  direction: rtl;
}
[dir="rtl"] .app-sidebar {
  inset-inline-start: auto;
  inset-inline-end: 0;
  right: 0;
  left: auto;
}
[dir="rtl"] .app-main {
  margin-inline-start: 0;
  margin-inline-end: var(--il-sidebar-w);
}
[dir="rtl"] .app-content {
  direction: rtl;
}
[dir="rtl"] .app-sidebar .sb-nav-item:hover {
  transform: translateX(-2px);
}
[dir="rtl"] .app-sidebar .sb-nav-item.active::before {
  left: auto;
  right: -8px;
  border-radius: 3px 0 0 3px;
}
`;

const responsive = `
  .app-sidebar {
    transform: translateX(-100%);
  }
  [dir="rtl"] .app-sidebar {
    transform: translateX(100%);
  }
  .app-sidebar.open {
    transform: translateX(0);
  }
  .app-main,
  [dir="rtl"] .app-main {
    margin-inline-start: 0;
    margin-inline-end: 0;
  }
  .app-content {
    padding: 20px 16px;
  }
`;

if (!css.includes('.app-shell {')) {
  css = css.replace(
    `.rb-content, .if-content {
  padding: 28px;
  flex: 1;
}
`,
    `.rb-content, .if-content {
  padding: 28px;
  flex: 1;
}
${block}`
  );
}

if (!css.includes('[dir="rtl"] .app-sidebar {\n    transform: translateX(100%);')) {
  css = css.replace(
    `  #rbSidebar, .if-sidebar {
    transform: translateX(-100%);
  }
`,
    `  #rbSidebar, .if-sidebar {
    transform: translateX(-100%);
  }
${responsive}`
  );
}

fs.writeFileSync(file, css);
console.log('RTL professional sidebar styles applied');
