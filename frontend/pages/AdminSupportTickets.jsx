import React, { useEffect, useState } from 'react';
import { BadgeCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm.jsx';
import { apiUrl } from '@/src/config';

export default function AdminSupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open'); // open | resolved | all
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  // Simple client-side pagination (server endpoint currently returns all). If server starts paging, adapt fetch.
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => { fetchTickets(); }, []);

  function fmt(dt) {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      return d.toLocaleString();
    } catch { return String(dt); }
  }

  async function fetchTickets() {
    setLoading(true); setError('');
    try {
      const resp = await fetch(apiUrl('/api/admin/support-tickets'), { headers: { Authorization: `Bearer ${localStorage.getItem('tikcash_token') || ''}` } });
      if (resp.status === 401) { setError('Unauthorized'); setTickets([]); return; }
      const data = await resp.json();
      if (data.error) { setError(data.error); setTickets([]); return; }
      setTickets(data.tickets || []);
    } catch (err) { setError(`Failed to load tickets: ${err.message}`); }
    setLoading(false);
  }

  async function markResolved(id) {
    try {
      const resp = await fetch(apiUrl(`/api/admin/support-tickets/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('tikcash_token') || ''}` },
        body: JSON.stringify({ status: 'resolved' }),
      });
      if (!resp.ok) throw new Error('Failed');
      fetchTickets();
    } catch (e) { console.error(e); }
    setConfirmOpen(false);
    setSelectedTicket(null);
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Support Tickets</h1>
      {loading ? <div>Loading...</div> : error ? <div className="text-red-600">{error}</div> : (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setFilter('open')} className={`px-3 py-1 rounded ${filter === 'open' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Open</button>
            <button onClick={() => setFilter('resolved')} className={`px-3 py-1 rounded ${filter === 'resolved' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Resolved</button>
            <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>All</button>
          </div>

          <div className="space-y-4">
            {(() => {
              const filtered = tickets.filter(t => filter === 'all' ? true : (filter === 'open' ? t.status === 'open' : t.status === 'resolved'));
              const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
              const safePage = page > totalPages ? totalPages : page; // clamp locally without setState during render
              const start = (safePage - 1) * pageSize;
              const slice = filtered.slice(start, start + pageSize);
              return slice.map(t => (
              <div key={t.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 border">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-lg text-gray-900 dark:text-white">{t.name} <span className="text-sm text-gray-500">{t.email}</span></div>
                    <div className="text-sm text-gray-500 mt-1">{t.phone || '—'}</div>
                    <div className="mt-2 text-xs text-gray-400">Opened: {fmt(t.created_at)}</div>
                    {t.responded_at && <div className="mt-1 text-xs text-gray-400">Resolved: {fmt(t.responded_at)}</div>}
                  </div>
                </div>
                <div className="mt-4 text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{t.message}</div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  {t.status !== 'resolved' && <Button onClick={() => { setSelectedTicket(t); setConfirmOpen(true); }} variant="success">Mark resolved</Button>}
                </div>
              </div>
              ));
            })()}
            {tickets.filter(t => filter === 'all' ? true : (filter === 'open' ? t.status === 'open' : t.status === 'resolved')).length === 0 && (
              <div className="text-gray-500">No tickets found for selected filter.</div>
            )}
            {/* Pagination controls (always visible) */}
            {(() => {
              const filtered = tickets.filter(t => filter === 'all' ? true : (filter === 'open' ? t.status === 'open' : t.status === 'resolved'));
              const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
              const safePage = page > totalPages ? totalPages : page;
              return (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition ${safePage <= 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 shadow hover:bg-gray-50'}`}
                  >
                    Prev
                  </button>
                  <div className="text-sm text-gray-600">Page <span className="font-semibold text-gray-800">{safePage}</span> of <span className="font-semibold text-gray-800">{totalPages}</span></div>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition ${safePage >= totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 shadow hover:bg-gray-50'}`}
                  >
                    Next
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      <ConfirmDialog open={confirmOpen} title="Mark ticket resolved?" description="This will mark the ticket as resolved. You will still contact the user via email or phone." confirmText="Mark resolved" cancelText="Cancel" onConfirm={() => selectedTicket && markResolved(selectedTicket.id)} onCancel={() => { setConfirmOpen(false); setSelectedTicket(null); }} />
    </div>
  );
}
