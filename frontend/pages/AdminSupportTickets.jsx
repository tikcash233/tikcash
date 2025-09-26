import React, { useEffect, useState } from 'react';
import { BadgeCheck, XCircle } from 'lucide-react';

export default function AdminSupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [response, setResponse] = useState({});
  const [status, setStatus] = useState({});

  useEffect(() => { fetchTickets(); }, []);

  async function fetchTickets() {
    setLoading(true); setError('');
    try {
      const resp = await fetch('/api/admin/support-tickets', { headers: { Authorization: `Bearer ${localStorage.getItem('tikcash_token') || ''}` } });
      if (resp.status === 401) { setError('Unauthorized'); setTickets([]); return; }
      const data = await resp.json();
      setTickets(data.tickets || []);
    } catch (err) { setError('Failed to load tickets'); }
    setLoading(false);
  }

  async function updateTicket(id) {
    try {
      const resp = await fetch(`/api/admin/support-tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('tikcash_token') || ''}` },
        body: JSON.stringify({ response: response[id] || '', status: status[id] || 'resolved' }),
      });
      if (!resp.ok) throw new Error('Failed');
      fetchTickets();
    } catch {}
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Support Tickets</h1>
      {loading ? <div>Loading...</div> : error ? <div className="text-red-600">{error}</div> : (
        <div className="space-y-4">
          {tickets.length === 0 && <div className="text-gray-500">No tickets found.</div>}
          {tickets.map(t => (
            <div key={t.id} className="bg-white dark:bg-gray-900 rounded-xl shadow p-4 border">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-lg">{t.name} <span className="text-sm text-gray-500">{t.email}</span></div>
                  <div className="text-sm text-gray-600">{t.category} · {t.phone || '—'}</div>
                </div>
                <div className="text-xs px-2 py-1 rounded bg-gray-100">{t.status}</div>
              </div>
              <div className="mt-3 text-gray-800">{t.message}</div>
              <div className="mt-3 flex gap-2">
                <select value={status[t.id] || t.status} onChange={e => setStatus(s => ({ ...s, [t.id]: e.target.value }))} className="p-1 rounded border">
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <input type="text" value={response[t.id] || t.admin_response || ''} onChange={e => setResponse(r => ({ ...r, [t.id]: e.target.value }))} placeholder="Response (optional)" className="p-1 rounded border flex-1" />
                <button onClick={() => updateTicket(t.id)} className="px-3 py-1 rounded bg-green-600 text-white">Save</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
