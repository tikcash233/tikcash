import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

export default function PaymentResult() {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');

  const webhookRef = useRef(false);
  useEffect(() => {
    // fetch config to know if webhook is enabled
    fetch('/api/config').then(r => r.json()).then(c => { webhookRef.current = !!c.webhookEnabled; }).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
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
    return () => { cancelled = true; };
  }, [ref]);

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Payment Result</h1>
      {!ref && <p className="text-red-600">Missing reference.</p>}
      {ref && (
        <>
          <p className="mb-2 text-sm text-gray-500 break-all">Reference: {ref}</p>
          <p className="mb-6 font-medium capitalize">Status: {status}</p>
          {status === 'completed' && <p className="text-green-600 mb-4">Tip recorded! You can close this page.</p>}
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
