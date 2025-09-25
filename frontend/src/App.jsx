import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/Layout.jsx';
import Home from '@/pages/Home.jsx';
import CreatorDashboard from '@/pages/CreatorDashboard.jsx';
import SupporterDashbaord from '@/pages/SupporterDashbaord.jsx';
import { ToastProvider } from '@/components/ui/toast.jsx';
import Auth from '@/pages/Auth.jsx';
import Reset from '@/pages/Reset.jsx';
import PaymentResult from '@/pages/PaymentResult.jsx';
import AdminDashboard from '@/pages/AdminDashboard.jsx';
import AdminApproved from '@/pages/AdminApproved.jsx';
import AdminDeclined from '@/pages/AdminDeclined.jsx';
import RequireAuth from '@/utils/RequireAuth.jsx';

function WithLayout({ children, name }) {
  return <Layout currentPageName={name}>{children}</Layout>;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WithLayout name="Home"><Home /></WithLayout>} />
          <Route path="/creator" element={<WithLayout name="CreatorDashboard"><CreatorDashboard /></WithLayout>} />
          {/* Redirect legacy /browse to /support */}
          <Route path="/browse" element={<Navigate to="/support" replace />} />
          <Route path="/support" element={<WithLayout name="SupporterDashboard"><SupporterDashbaord /></WithLayout>} />
          <Route path="/:username" element={<WithLayout name="SupporterDashboard"><SupporterDashbaord /></WithLayout>} />
          <Route path="/auth" element={<WithLayout name="Auth"><Auth /></WithLayout>} />
          <Route path="/reset" element={<WithLayout name="Reset"><Reset /></WithLayout>} />
          <Route path="/payment/result" element={<WithLayout name="PaymentResult"><PaymentResult /></WithLayout>} />
          <Route path="/admin" element={<RequireAuth><WithLayout name="AdminDashboard"><AdminDashboard /></WithLayout></RequireAuth>} />
          <Route path="/admin/approved" element={<RequireAuth><WithLayout name="AdminDashboard"><AdminApproved /></WithLayout></RequireAuth>} />
          <Route path="/admin/declined" element={<RequireAuth><WithLayout name="AdminDashboard"><AdminDeclined /></WithLayout></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
