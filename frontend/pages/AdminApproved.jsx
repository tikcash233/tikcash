import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
// Removed broken react-day-picker import

function formatDate(d) { return new Date(d).toLocaleString(); }

export default function AdminApproved() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [totalPages, setTotalPages] = useState(1);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [sort, setSort] = useState('approved_at:desc');

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
  const res = await axios.get('/api/admin/approved-withdrawals', { params, headers: { Authorization: `Bearer ${token}` }, withCredentials: true });
      setWithdrawals(res.data.withdrawals || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function exportCSV(serverSide = false) {
    if (serverSide) {
      const params = {};
      if (dateRange?.from) params.date_from = new Date(dateRange.from).toISOString();
      if (dateRange?.to) params.date_to = new Date(dateRange.to).toISOString();
      if (amountMin) params.amount_min = amountMin;
      if (amountMax) params.amount_max = amountMax;
      if (creatorSearch) params.creator_search = creatorSearch;
      if (sort) params.sort = sort;
      const qp = new URLSearchParams(params).toString();
      // Use fetch so we can include Authorization header (window.open can't set headers)
      try {
    const token = localStorage.getItem('tikcash_token') || '';
  const exportUrl = `/api/admin/approved-withdrawals/export?${qp}`;
  const resp = await fetch(exportUrl, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        if (!resp.ok) {
          console.error('Export failed', resp.status);
          return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `approved-withdrawals-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Export error', e);
      }
      return;
    }
    if (!withdrawals || withdrawals.length === 0) return;
    const cols = ['id','creator_id','tiktok_username','display_name','amount','momo_number','approved_at'];
    const rows = withdrawals.map(w => cols.map(c => JSON.stringify(w[c] ?? '')).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `approved-withdrawals-page-${page}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin Approved Withdrawals</h1>
        <div className="flex gap-2">
          <Link to="/admin" className="px-3 py-1 rounded bg-gray-100 text-gray-800">Pending</Link>
          <Link to="/admin/approved" className="px-3 py-1 rounded bg-blue-600 text-white">Approved</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-4 items-end">
      
        <div>
          <label className="text-sm block mb-1">Date range</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.from ? dateRange.from : ''}
              onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
              className="border rounded p-2 bg-white w-full"
            />
            <span className="mx-1 text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.to ? dateRange.to : ''}
              onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
              className="border rounded p-2 bg-white w-full"
            />
          </div>
        </div>
        <div>
          <label className="text-sm block mb-1">Creator / search</label>
          <input type="text" placeholder="TikTok username or display name" value={creatorSearch} onChange={(e)=>setCreatorSearch(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div className="sm:col-span-3 flex gap-2">
          <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={() => { setPage(1); fetchPage(); }}>Filter</button>
          <button className="px-3 py-1 rounded bg-gray-200" onClick={() => { setDateRange({ from: undefined, to: undefined }); setCreatorSearch(''); setPage(1); fetchPage(); }}>Clear</button>
          <button className="ml-auto px-3 py-1 rounded bg-blue-600 text-white" onClick={() => exportCSV(true)}>Export CSV</button>
        </div>
      </div>

      {loading ? <div>Loading...</div> : (
        <div className="space-y-4">
          {withdrawals.map(w => (
            <div key={w.id} className="bg-white rounded-xl shadow-lg p-5 flex flex-col sm:flex-row sm:items-center gap-4 border border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-block px-2 py-1 rounded bg-blue-50 text-blue-700 font-mono text-xs">{w.tiktok_username ? `@${w.tiktok_username}` : '-'}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-lg text-gray-900 truncate">{w.display_name || (w.tiktok_username ? w.tiktok_username : '-')}</div>
                    {/* show the username as secondary info only when it's different from the display name */}
                    {w.tiktok_username && w.display_name && w.tiktok_username !== w.display_name ? (
                      <div className="text-sm text-gray-500">@{w.tiktok_username}</div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <span className="font-semibold text-green-700">GH₵ {Math.abs(Number(w.amount || 0)).toFixed(2)}</span>
                  <span className="">Mobile: <span className="font-mono text-gray-800">{w.momo_number}</span></span>
                  <span className="">Requested: <span className="text-gray-500">{new Date(w.created_date).toLocaleString()}</span></span>
                  <span className="inline-block px-2 py-1 rounded-full bg-green-50 text-green-700 font-semibold text-xs">Approved</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="text-right">
                  <div className="font-mono text-lg text-gray-800">GH₵ {Math.abs(Number(w.amount || 0)).toFixed(2)}</div>
                  <div className="text-sm text-gray-500">Approved: {formatDate(w.approved_at)}</div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-center gap-2">
            <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page<=1}>Prev</button>
            <div>Page {page} / {totalPages}</div>
            <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page>=totalPages}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
