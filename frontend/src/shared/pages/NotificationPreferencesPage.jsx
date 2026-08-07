import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationPreferences } from '../components/notifications/NotificationPreferences';

export default function NotificationPreferencesPage() {
  const { token } = useAuth();
  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 18px' }}>Préférences de notifications</h1>
      <NotificationPreferences token={token} />
    </div>
  );
}
