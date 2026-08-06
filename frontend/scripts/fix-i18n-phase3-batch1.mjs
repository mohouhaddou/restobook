import fs from 'node:fs';

const activityPath = 'src/pages/dashboard/ActivityPage.jsx';
let activity = fs.readFileSync(activityPath, 'utf8');
activity = activity.replace(
  `{TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={\`mk-pill\${tab === t.key ? ' active' : ''}\`}>{t.icon} {t(t.labelKey)}</button>
        ))}`,
  `{TABS.map(item => (
          <button key={item.key} onClick={() => setTab(item.key)} className={\`mk-pill\${tab === item.key ? ' active' : ''}\`}>{item.icon} {t(item.labelKey)}</button>
        ))}`
);
fs.writeFileSync(activityPath, activity);

const authPath = 'src/i18n/locales/fr/auth.json';
function add(file, key, value) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data[key] = value;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
add(authPath, 'auth.fields.passwordRequired', 'Mot de passe *');
add('src/i18n/locales/en/auth.json', 'auth.fields.passwordRequired', 'Password *');
add('src/i18n/locales/ar/auth.json', 'auth.fields.passwordRequired', 'كلمة المرور *');

console.log('phase3 batch1 fixes applied');
