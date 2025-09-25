import React from 'react';
import { Navigate } from 'react-router-dom';

// Simple synchronous guard: if there's no token in localStorage, redirect to /auth.
// Use this to wrap protected routes so the protected UI never renders when unauthenticated.
export default function RequireAuth({ children }) {
  const token = localStorage.getItem('tikcash_token') || '';
  if (!token) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
