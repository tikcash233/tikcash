import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from './input.jsx';
import { Button } from './button.jsx';

export default function SupportModal({ open, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  // Keep hooks above the early-return to follow the rules of hooks.
  // The effect is declared unconditionally but will only run when `open` is true.
  React.useEffect(() => {
    if (!open) return;
    console.debug('SupportModal mounted/opened');
    return () => console.debug('SupportModal unmounted/closed');
  }, [open]);

  // Avoid rendering Headless UI Dialog until explicitly opened.
  if (!open) return null;

  async function submit(e) {
    e && e.preventDefault();
    setError('');
    if (!name || !email || !message) return setError('Name, email and message are required');
    setLoading(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message }),
      });
      if (!res.ok) throw new Error('Send failed');
      setOk(true);
      setName(''); setEmail(''); setPhone(''); setMessage('');
    } catch (err) {
      console.error('SupportModal submit error', err);
      setError('Failed to send. Try again.');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-xl p-6">
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-400 hover:text-gray-200"><X /></button>
        <h3 className="text-lg md:text-xl font-semibold mb-1 text-gray-900 dark:text-white">Contact Support</h3>
        <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">Send us a message and we'll respond as soon as possible.</p>
        {ok ? (
          <div className="text-center p-6">
            <div className="text-green-600 font-semibold mb-2">Thanks — message sent</div>
            <Button onClick={onClose} variant="default">Close</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" />
              <div className="text-sm text-gray-500 dark:text-gray-300 px-2">We will respond by email or phone.</div>
            </div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Your message" rows={6} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="flex justify-end gap-3">
              <Button onClick={onClose} variant="outline">Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send'}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
