import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCustomerAuth } from '../../../contexts/CustomerAuthContext';

// Miroir du ProtectedRoute back-office (App.jsx), mais basé sur useCustomerAuth().
// Les pages client faisaient jusqu'ici chacune leur propre `if (!token) navigate(...)` —
// ce composant centralise la garde pour toutes les routes /dashboard/*.
export function CustomerProtectedRoute({ children }) {
  const { token } = useCustomerAuth();
  if (!token) return <Navigate to="/account" replace />;
  return children;
}
