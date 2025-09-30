import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, NavLink } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import PlatformNet from '../components/ui/PlatformNet';

function formatDate(d) { return new Date(d).toLocaleString(); }

export default function AdminDeclined() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [totalPages, setTotalPages] = useState(1);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [sort, setSort] = useState('declined_at:desc');
  const [showPlatformNet, setShowPlatformNet] = useState(false);

  useEffect(() => { fetchPage(); }, [page]);

  async function fetchPage() {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (dateRange?.from) params.date_from = new Date(dateRange.from).toISOString();
      if (dateRange?.to) params.date_to = new Date(dateRange.to).toISOString();
      if (amountMin) params.amount_min = amountMin;
      if (amountMax) params.amount_max = amountMax;
      if (creatorSearch) params.creator_search = creatorSearch;
      if (sort) params.sort = sort;
      const token = localStorage.getItem('tikcash_token') || '';
      const res = await axios.get('/api/admin/declined-withdrawals', { params, headers: { Authorization: `Bearer ${token}` }, withCredentials: true });
      const list = Array.isArray(res.data.withdrawals) ? res.data.withdrawals.slice() : [];
      list.sort((a, b) => {
        const ta = Date.parse(a.declined_at || a.created_date || 0) || 0;
        const tb = Date.parse(b.declined_at || b.created_date || 0) || 0;
        return tb - ta;
      });
      setWithdrawals(list);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function exportCSV() {
    const params = {};
    if (dateRange?.from) params.date_from = new Date(dateRange.from).toISOString();
    if (dateRange?.to) params.date_to = new Date(dateRange.to).toISOString();
    if (amountMin) params.amount_min = amountMin;
    if (amountMax) params.amount_max = amountMax;
    if (creatorSearch) params.creator_search = creatorSearch;
    if (sort) params.sort = sort;
    const qp = new URLSearchParams(params).toString();
    try {
      const token = localStorage.getItem('tikcash_token') || '';
      const exportUrl = `/api/admin/declined-withdrawals/export?${qp}`;
      const resp = await fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!resp.ok) return console.error('Export failed', resp.status);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `declined-withdrawals-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { console.error('Export error', e); }
  }

  return (
    <>
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-4">
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded p-3">
          <AlertTriangle className="w-5 h-5 text-yellow-700 mt-0.5" />
          <div className="text-sm text-yellow-800">Amounts listed include a Paystack transfer fee of GH₵1.00.</div>
        </div>
      </div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Declined Withdrawals</h1>
        <div className="inline-flex bg-white shadow-sm rounded-xl overflow-hidden">
          <NavLink to="/admin" end className={({ isActive }) => `px-4 py-2 text-sm font-medium w-28 text-center ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Pending</NavLink>
          <NavLink to="/admin/approved" className={({ isActive }) => `px-4 py-2 text-sm font-medium w-28 text-center ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Approved</NavLink>
          <NavLink to="/admin/declined" className={({ isActive }) => `px-4 py-2 text-sm font-medium w-28 text-center ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Declined</NavLink>
        </div>
        <div className="mt-3 flex justify-end gap-3">
          <button onClick={() => setShowPlatformNet(true)} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md hover:brightness-105">Platform earnings</button>
          <NavLink to="/admin/support-tickets" className="px-3 py-1 rounded bg-pink-600 text-white">Support Tickets</NavLink>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-4 items-end">
        <div>
          <label className="text-sm block mb-1">Date range</label>
          <div className="flex gap-2">
            <input type="date" value={dateRange.from ? dateRange.from : ''} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))} className="border rounded p-2 bg-white w-full" />
            <span className="mx-1 text-gray-500">to</span>
            <input type="date" value={dateRange.to ? dateRange.to : ''} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))} className="border rounded p-2 bg-white w-full" />
          </div>
        </div>
        <div>
          <label className="text-sm block mb-1">Creator / search</label>
          <input type="text" placeholder="TikTok username or display name" value={creatorSearch} onChange={(e)=>setCreatorSearch(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div className="sm:col-span-3 flex gap-2">
          <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={() => { setPage(1); fetchPage(); }}>Filter</button>
          <button className="px-3 py-1 rounded bg-gray-200" onClick={() => { setDateRange({ from: undefined, to: undefined }); setCreatorSearch(''); setPage(1); fetchPage(); }}>Clear</button>
          <button className="ml-auto px-3 py-1 rounded bg-blue-600 text-white" onClick={() => exportCSV()}>Export CSV</button>
        </div>
      </div>

      {loading ? <div>Loading...</div> : (
        <div className="space-y-4">
          {(!withdrawals || withdrawals.length === 0) && (
            <div className="text-gray-500">No declined withdrawals found.</div>
          )}
          {withdrawals.map(w => (
            <div key={w.id} className="bg-white rounded-xl shadow-lg p-5 flex flex-col sm:flex-row sm:items-center gap-4 border border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-block px-2 py-1 rounded bg-blue-50 text-blue-700 font-mono text-xs">{w.tiktok_username ? `@${w.tiktok_username}` : '-'}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-lg text-gray-900 truncate">{w.display_name || (w.tiktok_username ? w.tiktok_username : '-')}</div>
                    {w.tiktok_username && w.display_name && w.tiktok_username !== w.display_name ? (
                      <div className="text-sm text-gray-500">@{w.tiktok_username}</div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="font-semibold text-green-700">GH₵ {Math.abs(Number(w.amount || 0)).toFixed(2)}</span>
                    <span className="text-sm text-gray-700">Send via Mobile Money: <span className="font-mono font-semibold">GH₵ {(Math.max(0, Math.abs(Number(w.amount || 0)) - 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                    <span className="">Mobile: <span className="font-mono text-gray-800">{w.momo_number}</span></span>
                  <span className="">Requested: <span className="text-gray-500">{new Date(w.created_date).toLocaleString()}</span></span>
                  <span className="inline-block px-2 py-1 rounded-full bg-red-50 text-red-700 font-semibold text-xs">Declined</span>
                </div>
                {w.declined_by_name ? <div className="text-sm text-gray-600 mt-2">Declined by: <span className="font-semibold">{w.declined_by_name}</span></div> : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="text-right">
                  <div className="font-mono text-lg text-gray-800">GH₵ {Math.abs(Number(w.amount || 0)).toFixed(2)}</div>
                  <div className="text-sm text-gray-500">Declined: {formatDate(w.declined_at)}</div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p-1))}
              disabled={page <= 1}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition ${page <= 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 shadow hover:bg-gray-50'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Prev
            </button>

            <div className="text-sm text-gray-600">Page <span className="font-semibold text-gray-800">{page}</span> of <span className="font-semibold text-gray-800">{totalPages}</span></div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p+1))}
              disabled={page >= totalPages}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition ${page >= totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 shadow hover:bg-gray-50'}`}
            >
              Next
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
    <PlatformNet open={!!showPlatformNet} onClose={() => setShowPlatformNet(false)} />
    </>
  );
}
