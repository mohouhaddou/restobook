import React from 'react';
import { useCustomerAuth } from '../../../contexts/CustomerAuthContext';
import { NotificationPreferences } from '../../../shared/components/notifications/NotificationPreferences';

export default function CustomerNotificationPreferencesPage() {
  const { token } = useCustomerAuth();
  return (
    <div className="mk-fade-up">
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 18px' }}>Préférences de notifications</h1>
      <NotificationPreferences token={token} />
    </div>
  );
}
