import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

export default function PaymentResult() {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const webhookRef = useRef(false);
  useEffect(() => {
    // fetch config to know if webhook is enabled
    fetch('/api/config').then(r => r.json()).then(c => { webhookRef.current = !!c.webhookEnabled; }).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    // Open SSE stream for instant status updates
    let es;
    try {
      const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
        ? import.meta.env.VITE_API_URL
        : ((typeof window !== 'undefined' && window.__API_BASE__) || '');
      const STREAM_URL = API_BASE ? `${API_BASE}/api/stream/transactions` : '/api/stream/transactions';
      es = new EventSource(STREAM_URL);
      es.addEventListener('tx', (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.reference === ref) {
            setStatus(data.status);
            if (data.status === 'completed') {
              es.close();
            }
          }
        } catch {}
      });
      es.onerror = () => {
        // Allow normal polling to continue; close to avoid reconnection storms
        try { es.close(); } catch {}
      };
    } catch {}
    const poll = async () => {
      try {
        const r = await fetch(`/api/payments/paystack/status/${encodeURIComponent(ref)}`);
        if (!r.ok) throw new Error('Status error');
        const j = await r.json();
        if (cancelled) return;
        setStatus(j.status);
        if (j.status === 'pending') {
          // If webhooks enabled we expect a quick update, keep polling; else slow down after a few tries
          setTimeout(poll, webhookRef.current ? 2000 : 4000);
        }
      } catch {
        if (!cancelled) setError('Waiting...');
        setTimeout(poll, 4000);
      }
    };
    poll();
    return () => { cancelled = true; if (es) try { es.close(); } catch {} };
  }, [ref]);

  const manualVerify = async () => {
    if (!ref || verifying) return;
    try {
      setVerifying(true);
      const r = await fetch(`/api/payments/paystack/verify/${encodeURIComponent(ref)}`);
      const j = await r.json().catch(() => ({}));
      if (j && j.status) setStatus(j.status);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Payment Result</h1>
      {!ref && <p className="text-red-600">Missing reference.</p>}
      {ref && (
        <>
          <p className="mb-2 text-sm text-gray-500 break-all">Reference: {ref}</p>
          <p className="mb-6 font-medium capitalize">Status: {status}</p>
          {status === 'completed' && <p className="text-green-600 mb-4">Tip recorded! You can close this page.</p>}
          {status === 'pending' && (
            <div className="mb-4 text-sm text-gray-600">
              <p className="mb-2">Waiting for confirmation… if this takes too long, click verify:</p>
              <button disabled={verifying} onClick={manualVerify} className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50">
                {verifying ? 'Verifying…' : 'Verify Now'}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-500 mb-4">{error}</p>}
          <div className="space-x-4">
            <Link to="/support" className="text-blue-600 underline">Back to Support</Link>
            <Link to="/" className="text-gray-600 underline">Home</Link>
          </div>
        </>
      )}
    </div>
  );
}
