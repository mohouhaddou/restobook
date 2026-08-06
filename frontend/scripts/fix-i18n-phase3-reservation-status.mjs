import fs from 'node:fs';

const file = 'src/pages/dashboard/ActivityPage.jsx';
let source = fs.readFileSync(file, 'utf8');
source = source
  .replace("{ label: 'En attente', color: '#D97706', icon: '⏳' }", "{ labelKey: 'status.reservation.pending', color: '#D97706', icon: '⏳' }")
  .replace("{ label: 'Confirmée',  color: '#16A34A', icon: '✅' }", "{ labelKey: 'status.reservation.confirmed',  color: '#16A34A', icon: '✅' }")
  .replace("{ label: 'Attablée',   color: '#2563EB', icon: '🪑' }", "{ labelKey: 'status.reservation.seated',   color: '#2563EB', icon: '🪑' }")
  .replace("{ label: 'Annulée',    color: '#DC2626', icon: '❌' }", "{ labelKey: 'status.reservation.cancelled',    color: '#DC2626', icon: '❌' }")
  .replace("{ label: 'No-show',    color: 'var(--mk-muted)', icon: '👻' }", "{ labelKey: 'status.reservation.no_show',    color: 'var(--mk-muted)', icon: '👻' }")
  .replace("{st.icon} {st.label}", "{st.icon} {st.labelKey ? t(st.labelKey) : reservation.status}");
fs.writeFileSync(file, source);

function merge(file, additions) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(data, additions);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

merge('src/i18n/locales/fr/orders.json', {
  'status.reservation.pending': 'En attente',
  'status.reservation.confirmed': 'Confirmée',
  'status.reservation.seated': 'Attablée',
  'status.reservation.cancelled': 'Annulée',
  'status.reservation.no_show': 'No-show',
});
merge('src/i18n/locales/en/orders.json', {
  'status.reservation.pending': 'Pending',
  'status.reservation.confirmed': 'Confirmed',
  'status.reservation.seated': 'Seated',
  'status.reservation.cancelled': 'Cancelled',
  'status.reservation.no_show': 'No-show',
});
merge('src/i18n/locales/ar/orders.json', {
  'status.reservation.pending': 'في الانتظار',
  'status.reservation.confirmed': 'مؤكد',
  'status.reservation.seated': 'على الطاولة',
  'status.reservation.cancelled': 'ملغى',
  'status.reservation.no_show': 'لم يحضر',
});

console.log('reservation statuses migrated');
