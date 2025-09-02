import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/Layout.jsx';
import Home from '@/pages/Home.jsx';
import CreatorDashboard from '@/pages/CreatorDashboard.jsx';
import BrowseCreators from '@/pages/BrowseCreators.jsx';
import SupporterDashbaord from '@/pages/SupporterDashbaord.jsx';
import { ToastProvider } from '@/components/ui/toast.jsx';

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
          <Route path="/browse" element={<WithLayout name="BrowseCreators"><BrowseCreators /></WithLayout>} />
          <Route path="/support" element={<WithLayout name="SupporterDashboard"><SupporterDashbaord /></WithLayout>} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
