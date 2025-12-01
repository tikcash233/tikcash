import React, { useEffect, useState, useRef } from 'react';
import { Button } from './button';
import { apiUrl } from '@/src/config';

export default function PlatformNet({ open, onClose, inline = false }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  // fixed height for inline page mode (no drag-to-resize)
  const [heightPx] = useState(520);
  const [period, setPeriod] = useState('daily'); // daily | monthly
  const containerRef = useRef(null);
  // no drag ref needed for fixed height

  useEffect(() => {
    if (open) fetchData();
  }, [open]);
  // refetch when period changes while open
  useEffect(() => {
    if (open) fetchData();
  }, [period]);

  // fetchData accepts optional overrides so callers (like clearFilters) can force specific params
  async function fetchData(overrides = {}) {
    setLoading(true); setError(null);
    try {
      const qp = new URLSearchParams();
      const fromVal = overrides.from !== undefined ? overrides.from : from;
      const toVal = overrides.to !== undefined ? overrides.to : to;
      const periodVal = overrides.period !== undefined ? overrides.period : period;
      if (fromVal) qp.set('date_from', fromVal);
      if (toVal) qp.set('date_to', toVal);
      qp.set('period', periodVal);
      const token = localStorage.getItem('tikcash_token') || '';
      const endpoint = apiUrl(`/api/admin/platform-net?${qp.toString()}`);
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json.data || []);
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }

  function totalSum() {
    return data.reduce((s, r) => s + Number(r.total_platform_net || 0), 0).toFixed(2);
  }

  function clearFilters() { setFrom(''); setTo(''); fetchData({ from: '', to: '' }); }

  // drag-to-resize removed; fixed height used instead

  async function exportCSV() {
    const qp = new URLSearchParams();
    if (from) qp.set('date_from', from);
    if (to) qp.set('date_to', to);
    qp.set('format', 'csv');
    qp.set('period', period);
    const token = localStorage.getItem('tikcash_token') || '';
    const url = apiUrl(`/api/admin/platform-net?${qp.toString()}`);
    // Use fetch to include auth header and download
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
    if (!resp.ok) return alert('Export failed');
    const blob = await resp.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = `platform-net-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(u);
  }

  if (!open) return null;

  const inner = (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <label className="inline-flex items-center gap-2"><input type="radio" name="period" checked={period==='daily'} onChange={()=>setPeriod('daily')} /> <span>Daily</span></label>
            <label className="inline-flex items-center gap-2"><input type="radio" name="period" checked={period==='monthly'} onChange={()=>setPeriod('monthly')} /> <span>Monthly</span></label>
            <label className="inline-flex items-center gap-2"><input type="radio" name="period" checked={period==='yearly'} onChange={()=>setPeriod('yearly')} /> <span>Yearly</span></label>
          </div>
          <div className="w-full sm:w-auto sm:ml-4">
            {/* Modern total badge - stacks on mobile and centers */}
            <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg shadow-sm flex items-center justify-center gap-3 w-full">
              <span className="text-xs font-medium">Total</span>
              <span className="text-base sm:text-lg font-bold">{`GHS ${Number(totalSum()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
            </div>
          </div>
        </div>
      </div>

  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 items-end">
        <div>
          <label className="text-xs text-gray-600">From</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="text-xs text-gray-600">To</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full border rounded p-2" />
        </div>
        <div className="text-right text-xs text-gray-500">&nbsp;</div>
      </div>

      <div className="mb-4 flex gap-2">
        <Button size="sm" onClick={fetchData} variant="default">Refresh</Button>
        <Button size="sm" onClick={exportCSV} variant="outline">Export CSV</Button>
        <Button size="sm" onClick={clearFilters} variant="ghost">Clear</Button>
        <div className="ml-auto flex items-center gap-3">
          {!inline && <Button size="sm" onClick={onClose} variant="ghost">Close</Button>}
        </div>
      </div>

      {/* sparkline removed per request */}

  <div ref={containerRef} style={{ height: `${inline ? 520 : heightPx}px` }} className={`overflow-auto border rounded p-2`}>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && data.length === 0 && <div className="text-gray-500">No data for selected range.</div>}
        {!loading && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed min-w-full sm:min-w-[640px]">
              <colgroup>
                <col style={{ width: '34%' }} />
                <col style={{ width: '36%' }} />
                <col style={{ width: '30%' }} />
              </colgroup>
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="pr-3 sticky top-0 bg-white z-10 text-left">{period === 'yearly' ? 'Year' : period === 'monthly' ? 'Month' : 'Day'}</th>
                  <th className="pr-3 sticky top-0 bg-white z-10 text-center">Platform net (GHS)</th>
                  <th className="sticky top-0 bg-white z-10 text-right">Times</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r=> (
                  <tr key={r.day || r.month || r.year} className="border-t">
                    <td className="py-2">{period === 'yearly' ? (r.year || (r.day ? new Date(r.day).getFullYear() : '')) : (r.day || r.month)}</td>
                    <td className="py-2 text-center">{Number(r.total_platform_net).toFixed(2)}</td>
                    <td className="py-2 text-right">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* drag handle removed - fixed height */}
    </div>
  );

  if (inline) {
    return (
      // remove horizontal max-width so it fills more of small screens; keep some padding
      <div className="px-4 sm:px-6 md:px-8 py-6">{inner}</div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">{inner}</div>
  );
}


// Sparkline removed
