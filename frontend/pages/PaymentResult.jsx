import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/src/config';

export default function PaymentResult() {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const webhookRef = useRef(false);
  const lastSseAtRef = useRef(0);
  useEffect(() => {
    // fetch config to know if webhook is enabled
    fetch('/api/config').then(r => r.json()).then(c => { webhookRef.current = !!c.webhookEnabled; }).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    // Open SSE stream for instant status updates
    let es;
    // If webhook is not enabled, we'll attempt a few automatic server-side verifications
    // to avoid requiring the user to click the "Verify" button. This is rate-limited
    // locally to avoid spamming the Paystack verify API.
    let verifyAttempts = 0;
    try {
      // Always prefer explicit backend origin for SSE so streaming is not buffered by intermediate proxies
      const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
        ? import.meta.env.VITE_API_URL
        : ((typeof window !== 'undefined' && window.__API_BASE__) || '');
      const STREAM_URL = `${API_BASE || ''}/api/stream/transactions`;
      es = new EventSource(STREAM_URL);
      es.addEventListener('tx', (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.reference === ref) {
            lastSseAtRef.current = Date.now();
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
        const r = await fetch(apiUrl(`/api/payments/paystack/status/${encodeURIComponent(ref)}`));
        if (!r.ok) throw new Error('Status error');
        const j = await r.json();
        if (cancelled) return;
        setStatus(j.status);
        if (j.status === 'pending') {
          // If the SSE stream hasn't reported activity for this ref recently, attempt a limited number
          // of auto-verifications (covers cases where webhooks are enabled but the SSE didn't arrive).
          const sseStale = !lastSseAtRef.current || (Date.now() - lastSseAtRef.current) > 3000;
          if (sseStale && verifyAttempts < 3) {
            verifyAttempts += 1;
            try {
              await new Promise(r => setTimeout(r, 1200));
              const vv = await fetch(apiUrl(`/api/payments/paystack/verify/${encodeURIComponent(ref)}`));
              const vj = await vv.json().catch(() => ({}));
              if (vj && vj.status) {
                setStatus(vj.status);
                if (vj.status === 'completed') return; // done
              }
            } catch {}
          }
          // Continue polling; if webhooks enabled, poll faster to catch webhook-driven changes
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

  // Attempt to find a creator id on the page so we can offer a deep-link back to tipping the same creator
  const location = useLocation();
  const navigate = useNavigate();
  const qp = new URLSearchParams(location.search);
  // Common keys that might appear in transaction or state
  const txnCreatorId = qp.get('creator_id') || qp.get('creatorId') || qp.get('creator');

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Payment Result</h1>
      {!ref && <p className="text-red-600">Missing reference.</p>}
      {ref && (
        <>
          <p className="mb-2 text-sm text-gray-500 break-all">Reference: {ref}</p>
          <p className="mb-6 font-medium capitalize">Status: {status}</p>
          {status === 'completed' && <p className="text-green-600 mb-4">Tip Sent! You can close this page.</p>}
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
``            {txnCreatorId && (
              <Button
                variant="success"
                size="md"
                as="button"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set('creator_id', txnCreatorId);
                  navigate({ pathname: '/support', search: params.toString() });
                }}
                className="ml-2 rounded-full px-4"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M10 3a1 1 0 00-1 1v6H6a1 1 0 000 2h3v6a1 1 0 002 0v-6h3a1 1 0 100-2h-3V4a1 1 0 00-1-1z" />
                </svg>
                Tip again
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
