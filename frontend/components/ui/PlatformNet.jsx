import React, { useEffect, useState } from 'react';
import { Button } from './button';

export default function PlatformNet({ open, onClose }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [heightMode, setHeightMode] = useState('medium'); // short | medium | long

  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  async function fetchData() {
    setLoading(true); setError(null);
    try {
      const qp = new URLSearchParams();
      if (from) qp.set('date_from', from);
      if (to) qp.set('date_to', to);
      const token = localStorage.getItem('tikcash_token') || '';
      const res = await fetch(`/api/admin/platform-net?${qp.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json.data || []);
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }

  function totalSum() {
    return data.reduce((s, r) => s + Number(r.total_platform_net || 0), 0).toFixed(2);
  }

  function clearFilters() {
    setFrom(''); setTo('');
    fetchData();
  }

  function heightClass() {
    if (heightMode === 'short') return 'h-40';
    if (heightMode === 'long') return 'h-96';
    return 'h-64';
  }

  async function exportCSV() {
    const qp = new URLSearchParams();
    if (from) qp.set('date_from', from);
    if (to) qp.set('date_to', to);
    qp.set('format', 'csv');
    const token = localStorage.getItem('tikcash_token') || '';
    const url = `/api/admin/platform-net?${qp.toString()}`;
    // Use fetch to include auth header and download
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
    if (!resp.ok) return alert('Export failed');
    const blob = await resp.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = `platform-net-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(u);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Platform net per day</h2>
          <div className="text-sm text-gray-600">Total: GHS {totalSum()}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4 items-end">
          <div>
            <label className="text-xs text-gray-600">From</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full border rounded p-2" />
          </div>
          <div>
            <label className="text-xs text-gray-600">To</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full border rounded p-2" />
          </div>
          <div className="flex items-center gap-2">
            <div className="ml-auto text-xs text-gray-600">View size</div>
            <select value={heightMode} onChange={e=>setHeightMode(e.target.value)} className="border rounded p-2 text-sm">
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </div>
        </div>
        <div className="mb-4 flex gap-2">
          <Button onClick={fetchData} variant="default">Refresh</Button>
          <Button onClick={exportCSV} variant="outline">Export CSV</Button>
          <Button onClick={clearFilters} variant="ghost">Clear</Button>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-sm text-gray-600">Total:</div>
            <div className="font-semibold">GHS {totalSum()}</div>
            <Button onClick={onClose} variant="ghost">Close</Button>
          </div>
        </div>
        <div className={`${heightClass()} overflow-auto border rounded p-2`}>
          {loading && <div>Loading...</div>}
          {error && <div className="text-red-600">{error}</div>}
          {!loading && !error && data.length === 0 && <div className="text-gray-500">No data for selected range.</div>}
          {!loading && data.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="pr-4">Day</th>
                  <th className="pr-4">Platform net (GHS)</th>
                  <th>Tips</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r=> (
                  <tr key={r.day} className="border-t">
                    <td className="py-2">{r.day}</td>
                    <td className="py-2">{Number(r.total_platform_net).toFixed(2)}</td>
                    <td className="py-2">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
