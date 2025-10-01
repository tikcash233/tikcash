import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
// Use relative API paths for Vite proxy

export default function AdminDashboard() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState({});
  const [declining, setDeclining] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  

  useEffect(() => {
    fetchWithdrawals();
  }, [page]);

  // Helper to get token from localStorage (or wherever you store it)
  function getToken() {
    return localStorage.getItem('tikcash_token') || '';
  }

  async function fetchWithdrawals() {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/pending-withdrawals', {
        params: { page },
        headers: { Authorization: `Bearer ${getToken()}` },
        withCredentials: true,
      });
      setWithdrawals(Array.isArray(res.data.withdrawals) ? res.data.withdrawals : []);
      // try to read total pages from API response (common keys)
      setTotalPages(res.data.totalPages || res.data.total_pages || 1);
      setError(null);
    } catch (err) {
      setError('Failed to load withdrawals');
      setWithdrawals([]);
    }
    setLoading(false);
  }

  async function approveWithdrawal(id) {
    setApproving((prev) => ({ ...prev, [id]: true }));
    try {
      await axios.post('/api/admin/approve-withdrawal', { withdrawalId: id }, {
        headers: { Authorization: `Bearer ${getToken()}` },
        withCredentials: true,
      });
      fetchWithdrawals();
    } catch (err) {
      alert('Failed to approve withdrawal');
    }
    setApproving((prev) => ({ ...prev, [id]: false }));
    setConfirmAction(null);
  }

  async function declineWithdrawal(id) {
    setDeclining((prev) => ({ ...prev, [id]: true }));
    try {
      await axios.post('/api/admin/decline-withdrawal', { withdrawalId: id }, {
        headers: { Authorization: `Bearer ${getToken()}` },
        withCredentials: true,
      });
      fetchWithdrawals();
    } catch (err) {
      alert('Failed to decline withdrawal');
    }
    setDeclining((prev) => ({ ...prev, [id]: false }));
    setConfirmAction(null);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-4 text-right flex justify-end gap-3">
        <NavLink to="/admin/platform-earnings" className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md hover:brightness-105">Platform earnings</NavLink>
        <NavLink to="/admin/support-tickets" className="inline-block px-3 py-1 rounded bg-pink-600 text-white">Support Tickets</NavLink>
      </div>
      <div className="mb-4">
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded p-3">
          <AlertTriangle className="w-5 h-5 text-yellow-700 mt-0.5" />
          <div className="text-sm text-yellow-800">Amounts listed include a Paystack transfer fee of GH₵1.00. When paying creators, send the net amount shown (amount minus GH₵1).</div>
        </div>
      </div>
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold mb-4">Admin</h1>
        <div className="inline-flex bg-white shadow-sm rounded-xl overflow-hidden mx-auto">
          <NavLink to="/admin" end className={({ isActive }) => `px-4 py-2 text-sm font-medium w-28 text-center ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Pending</NavLink>
          <NavLink to="/admin/approved" className={({ isActive }) => `px-4 py-2 text-sm font-medium w-28 text-center ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Approved</NavLink>
          <NavLink to="/admin/declined" className={({ isActive }) => `px-4 py-2 text-sm font-medium w-28 text-center ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Declined</NavLink>
        </div>
      </div>
      <h2 className="text-xl font-semibold mb-4">Pending Withdrawals</h2>
      {loading && <div>Loading...</div>}
      {!loading && error && <div className="text-red-500">{error}</div>}
      {!loading && !error && withdrawals.length === 0 && (
        <div className="text-gray-500 mb-6">No pending withdrawals.</div>
      )}
      {!loading && !error && (
        <div className="space-y-5">
          {withdrawals.map(w => (
            <div key={w.id} className="bg-white rounded-xl shadow-lg p-5 flex flex-col sm:flex-row sm:items-center gap-4 border border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-block px-2 py-1 rounded bg-blue-50 text-blue-700 font-mono text-xs">{w.tiktok_username || '-'}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-lg text-gray-900 truncate">{w.display_name || (w.tiktok_username ? w.tiktok_username : '-')}</div>
                    {w.tiktok_username && w.display_name && w.tiktok_username !== w.display_name ? (
                      <div className="text-sm text-gray-500">@{w.tiktok_username}</div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="font-semibold text-green-700">GH₵ {Math.abs(Number(w.amount || 0)).toFixed(2)}</span>
                    <span className="text-sm text-gray-700">Send via Mobile Money: <span className="font-mono font-semibold">GH₵ {(Math.max(0, Number(Math.abs(w.amount || 0)) - 1)).toFixed(2)}</span></span>
                  <span className="">Mobile: <span className="font-mono text-gray-800">{w.momo_number}</span></span>
                  <span className="">Requested: <span className="text-gray-500">{new Date(w.created_date).toLocaleString()}</span></span>
                  <span className="inline-block px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 font-semibold text-xs">Pending</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow disabled:opacity-50 w-full sm:w-auto transition"
                  disabled={approving[w.id]}
                  onClick={() => setConfirmAction({ type: 'approve', id: w.id })}
                >
                  {approving[w.id] ? 'Approving...' : 'Mark as Sent'}
                </button>
                <button
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow disabled:opacity-50 w-full sm:w-auto transition"
                  disabled={declining[w.id]}
                  onClick={() => setConfirmAction({ type: 'decline', id: w.id })}
                >
                  {declining[w.id] ? 'Declining...' : 'Decline'}
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition ${page <= 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 shadow hover:bg-gray-50'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Prev
            </button>
            <div className="text-sm text-gray-600">Page <span className="font-semibold text-gray-800">{page}</span> of <span className="font-semibold text-gray-800">{totalPages}</span></div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition ${page >= totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 shadow hover:bg-gray-50'}`}
            >
              Next
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

  {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4">Confirm {confirmAction.type === 'approve' ? 'Approval' : 'Decline'}</h2>
            <p className="mb-6">Are you sure you want to {confirmAction.type === 'approve' ? 'mark this withdrawal as sent/approved?' : 'decline this withdrawal?'} This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded bg-gray-200 text-gray-800"
                onClick={() => setConfirmAction(null)}
              >Cancel</button>
              <button
                className={`px-4 py-2 rounded text-white ${confirmAction.type === 'approve' ? 'bg-green-600' : 'bg-red-600'}`}
                onClick={() => confirmAction.type === 'approve' ? approveWithdrawal(confirmAction.id) : declineWithdrawal(confirmAction.id)}
              >Confirm</button>
            </div>
          </div>
        </div>
  )}
    </div>
  );
}
