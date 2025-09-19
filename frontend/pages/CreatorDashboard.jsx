import React, { useState, useEffect, useRef, useCallback } from "react";
import PenIcon from "../components/ui/PenIcon";
import { useNavigate } from "react-router-dom";
import { Creator, Transaction, User, RealtimeBus } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Gift } from "lucide-react";
import EarningsOverview from "../components/creator/EarningsOverview";
import ShareLinkBar from "../components/creator/ShareLinkBar";
import RecentTransactions from "../components/creator/RecentTransactions";
import WithdrawalHistory from "../components/creator/WithdrawalHistory";
import WithdrawalModal from "../components/creator/WithdrawalModal";
import PerformanceChart from "../components/creator/PerformanceChart";
import { useToast } from "@/components/ui/toast.jsx";

export default function CreatorDashboard() {
  const [creator, setCreator] = useState(null);
  // Recent transactions (capped at 50) for sidebar/list components
  const [transactions, setTransactions] = useState([]);
  // Full history (larger cap) dedicated to performance chart so historical points never shift
  const [performanceTransactions, setPerformanceTransactions] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();
  const tempPreviewRef = useRef(null);
  // Simple upload handler used by the "Update photo" button
  const handleFileUpload = async (file) => {
    if (!file) return;
    const MAX_FILE_SIZE = 2 * 1024 * 1024;
    if (!file.type.startsWith('image/')) { toastError('Only images allowed'); return; }
    if (file.size > MAX_FILE_SIZE) { toastError('Image must be smaller than 2MB'); return; }
    // show a local preview while uploading
    const objUrl = URL.createObjectURL(file);
    if (tempPreviewRef.current) URL.revokeObjectURL(tempPreviewRef.current);
    tempPreviewRef.current = objUrl;
    setCreator(prev => ({ ...(prev||{}), profile_image: objUrl }));
    try {
      const formData = new FormData();
      formData.append('profile_picture', file);
      const res = await fetch('/api/creators/upload-profile-picture', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        if (tempPreviewRef.current) { URL.revokeObjectURL(tempPreviewRef.current); tempPreviewRef.current = null; }
        setCreator(prev => ({ ...(prev||{}), profile_image: data.url }));
        toastSuccess('Profile picture updated.');
      } else {
        toastError(data.error || 'Upload failed');
      }
    } catch (e) {
      toastError('Network error while uploading');
    }
  };

  const onFileInputChange = (e) => {
    const f = e?.target?.files?.[0];
    if (f) handleFileUpload(f);
  };

  const handleRemovePhoto = async () => {
    // UI-only removal. Call backend delete endpoint here if available.
    try {
      if (tempPreviewRef.current) { URL.revokeObjectURL(tempPreviewRef.current); tempPreviewRef.current = null; }
      setCreator(prev => ({ ...(prev||{}), profile_image: '' }));
      toastSuccess('Profile picture removed.');
    } catch {
      toastError('Failed to remove picture');
    }
  };
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  // (Legacy) safetySyncTimerRef removed: we now use a lightweight conditional fallback poll.
  const visibilityRef = useRef(document.visibilityState === 'visible');
  const creatorIdRef = useRef(null);
  const processedTipIdsRef = useRef(new Set());
  const txStatusByKeyRef = useRef(new Map());
  const lastCreatorRefreshAtRef = useRef(0);
  const [balancePulse, setBalancePulse] = useState(false);
  const initializedRef = useRef(false);
  
  // Simple notification state for completed tips
  const [completedTipNotification, setCompletedTipNotification] = useState(null);
  
  // Connection status for offline indicator
  const [isOffline, setIsOffline] = useState(false);

  const refreshCreatorThrottled = useCallback(async () => {
    const now = Date.now();
    if (now - lastCreatorRefreshAtRef.current < 1500) return; // throttle to 1.5s
    lastCreatorRefreshAtRef.current = now;
    try {
      const id = creatorIdRef.current || creator?.id;
      if (!id) return;
      const fresh = await Creator.get(id);
      if (fresh) setCreator(fresh);
    } catch {}
  }, [creator]);

  // Stable tip key: id || payment_reference || reference
  const getTipKey = useCallback((t) => (t?.id || t?.payment_reference || t?.reference || null), []);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Initialize processedTipIdsRef with ALL completed tips (full history) so old tips do NOT trigger notifications again.
  useEffect(() => {
    if (!creator || !performanceTransactions.length || initializedRef.current) return;
    const completedTips = performanceTransactions.filter(t => t.transaction_type === 'tip' && t.status === 'completed');
    for (const tip of completedTips) {
      const key = getTipKey(tip);
      if (key) processedTipIdsRef.current.add(key);
    }
    initializedRef.current = true;
  }, [creator, performanceTransactions, getTipKey]);

  // Load initial dashboard data (user, creator profile, recent transactions)
  async function loadDashboardData() {
    try {
      const currentUser = await User.me();
      if (!currentUser) {
        navigate('/', { replace: true });
        return;
      }
      setUser(currentUser);
      // Find creator profile
      const creators = await Creator.filter({ created_by: currentUser.email });
      if (creators.length === 0) {
        navigate('/auth?mode=register&role=creator', { replace: true });
        return;
      }
      const creatorProfile = creators[0];
      setCreator(creatorProfile);
      creatorIdRef.current = creatorProfile.id; // Set ref for SSE processing
      try {
        const creatorTransactions = await Transaction.filter({ creator_id: creatorProfile.id }, '-created_date', 50);
        setTransactions(creatorTransactions);
        // Fetch a larger window for chart (up to 1000) so old days are preserved
        // This avoids the bug where adding a new tip pushes an old tip out of the 50-item list,
        // which made that old day's total appear to “decrease”.
        try {
          // Fetch full history for performance chart (no truncation)
          const longHistory = await Transaction.filter({ creator_id: creatorProfile.id }, '-created_date', 'all');
          setPerformanceTransactions(longHistory);
        } catch (e) {
          // If large fetch fails, fall back to recent list to at least show some data
          setPerformanceTransactions(creatorTransactions);
        }
      } catch (txError) {
        // Don't fail the whole dashboard if transactions can't load (offline)
        if (txError.isTemporary || txError.status === 503 || txError.isNetworkError) {
          console.warn('Transactions temporarily unavailable, loading creator profile only');
          setTransactions([]); // Show empty state but allow user to access dashboard
        } else {
          throw txError; // Re-throw non-network errors
        }
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      // Only redirect on non-network errors
      if (!err.isTemporary && !err.isNetworkError && err.status !== 503) {
        navigate('/', { replace: true });
      } else {
        // Show error state but don't redirect for network issues
        toastError('Connection issues. Please check your internet and try again.');
        setIsLoading(false);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Helper to insert incoming tip into local transactions (keep newest first, dedupe)
  const addIncomingTip = (tip) => {
    if (!tip || tip.transaction_type !== "tip") return;
    // (Optional) hide pending tips from list: uncomment to suppress
    // if (tip.status === 'pending') return;
    const k = getTipKey(tip);
    // NOTE: We now keep a full history (limit=all). For very large creators (tens of thousands of tips)
    // you may want to switch to a backend aggregation endpoint that returns pre-summed buckets
    // instead of sending every row. This keeps things simple for now while app is early stage.
    // Update RECENT (capped)
    setTransactions(prev => {
      const exists = k ? prev.some(t => getTipKey(t) === k) : false;
      const toTime = (t) => new Date(t.created_date || t.createdAt || Date.now()).getTime();
      let next;
      if (exists) next = prev.map(t => getTipKey(t) === k ? { ...t, ...tip } : t);
      else next = [tip, ...prev];
      next.sort((a, b) => toTime(b) - toTime(a));
      return next.slice(0, 50);
    });
    // Update FULL HISTORY (larger cap) – do NOT slice to 50 so older buckets remain
    setPerformanceTransactions(prev => {
      const exists = k ? prev.some(t => getTipKey(t) === k) : false;
      const toTime = (t) => new Date(t.created_date || t.createdAt || Date.now()).getTime();
      let next;
      if (exists) next = prev.map(t => getTipKey(t) === k ? { ...t, ...tip } : t);
      else next = [tip, ...prev];
      next.sort((a, b) => toTime(b) - toTime(a));
      return next.slice(0, 1000); // hard safety cap
    });
  };

  // Apply tip impact to creator balances exactly once per tip id
  const applyTipToCreator = (tip) => {
    if (!tip) return;
    if (!creator || String(tip.creator_id) !== String(creator.id)) return;
    if (tip.status !== 'completed') return; // only apply completed tips
    const key = getTipKey(tip);
    if (!key) return;
    if (processedTipIdsRef.current.has(key)) return; // already applied
    // If the tip is HISTORICAL (created more than 2 minutes before page load), do not pulse or notify again.
    const createdTs = new Date(tip.created_date || Date.now()).getTime();
    const recentCutoff = Date.now() - 2 * 60 * 1000; // 2 minutes window counts as "new"
    const amt = Number(tip.amount || 0) || 0;
    if (!(amt > 0)) return;
    processedTipIdsRef.current.add(key);
    setCreator(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        total_earnings: (prev.total_earnings || 0) + amt,
        available_balance: (prev.available_balance || 0) + amt,
      };
    });
    if (import.meta.env.DEV) console.debug('[balance] applied tip locally', { key, amt, historical: createdTs < recentCutoff });
    if (createdTs >= recentCutoff) {
      setBalancePulse(true);
      setTimeout(() => setBalancePulse(false), 1200);
      showCompletedTipNotification(tip);
    }
  };

  // Show a completion notification
  const showCompletedTipNotification = (tip) => {
    const notification = {
      id: Date.now(),
      amount: Number(tip.amount || 0),
      supporter_name: tip.supporter_name || 'Anonymous',
      message: tip.message || ''
    };
    setCompletedTipNotification(notification);
    setTimeout(() => setCompletedTipNotification(null), 5000);
  };

  // Detect status transitions (pending -> completed) AFTER initial historical set is registered
  useEffect(() => {
    if (!creator || !initializedRef.current) return;
    const map = txStatusByKeyRef.current;
    for (const t of performanceTransactions) {
      if (!t || t.transaction_type !== 'tip') continue;
      const key = getTipKey(t);
      if (!key) continue;
      const prev = map.get(key);
      if (t.status === 'completed') {
        if (prev !== 'completed' && !processedTipIdsRef.current.has(key)) {
          // Newly completed tip (not historical duplicate) → apply
          applyTipToCreator(t);
        }
        map.set(key, 'completed');
      } else {
        map.set(key, t.status);
      }
    }
  }, [performanceTransactions, creator, getTipKey]);
  
  // Subscribe to BroadcastChannel + storage events (was malformed after previous edit – restored)
  useEffect(() => {
    if (!creator) return;
    let bc;
    const onMsg = (e) => {
      const { type, payload } = e.data || {};
      if (type === "transaction:tip" && payload && String(payload.creator_id) === String(creator.id)) {
        addIncomingTip(payload);
        applyTipToCreator(payload);
      }
    };
    try {
      bc = new BroadcastChannel("tikcash-events");
      bc.addEventListener("message", onMsg);
    } catch {}

    const onStorage = (e) => {
      if (e.key !== 'tikcash:last_tip') return;
      try {
        const parsed = JSON.parse(e.newValue || '{}');
        const tip = parsed.tip;
        if (tip && String(tip.creator_id) === String(creator.id)) {
          addIncomingTip(tip);
          applyTipToCreator(tip);
        }
      } catch {}
    };
    window.addEventListener('storage', onStorage);

    return () => {
      if (bc) bc.removeEventListener('message', onMsg);
      window.removeEventListener('storage', onStorage);
    };
  }, [creator, addIncomingTip]);

  // =============================================================
  // SSE HEALTH STATE (for smarter, low-resource fallback polling)
  // We only poll the server if (a) SSE is currently disconnected OR
  // (b) SSE has been silent for a long time (stale) which might mean
  // the connection died without firing an error event (rare, but happens
  // on some mobile networks / suspended tabs).
  // =============================================================
  const sseConnectedRef = useRef(false);       // true while EventSource.open
  const lastSseEventAtRef = useRef(0);         // timestamp (ms) of last received tx event OR open

  // Smart fallback polling with offline detection
  useEffect(() => {
    if (!creator?.id) return;
    let INTERVAL = 10000; // Base interval: 10s
    let stopped = false;
    let consecutiveFailures = 0;

    const run = async () => {
      if (stopped) return;
      const now = Date.now();
      const connected = sseConnectedRef.current;
      const lastEvt = lastSseEventAtRef.current;
      const stale = (now - lastEvt) > 20000; // >20s without any SSE activity
      
      // Only fetch when: not connected (after initial 3s grace) OR stale.
      if (connected && !stale) return; // nothing to do (SSE healthy)
      
      if (import.meta.env.DEV) console.debug('[fallback] polling transactions (SSE disconnected or stale)');
      try {
        const latest = await Transaction.filter({ creator_id: creator.id }, '-created_date', 50);
        setTransactions(latest);
        try {
          const longHistory = await Transaction.filter({ creator_id: creator.id }, '-created_date', 'all');
          setPerformanceTransactions(longHistory);
        } catch {}
        consecutiveFailures = 0; // Reset failure count on success
        INTERVAL = 10000; // Reset to normal interval
        setIsOffline(false); // Connection restored
      } catch (err) {
        consecutiveFailures++;
        
        // If it's a network/offline error, reduce polling frequency
        if (err.isTemporary || err.status === 503 || err.isNetworkError) {
          // Exponential backoff for offline scenarios
          INTERVAL = Math.min(60000, 10000 * Math.pow(2, Math.min(consecutiveFailures - 1, 3))); // Max 60s
          setIsOffline(true); // Mark as offline
          if (import.meta.env.DEV) console.debug(`[fallback] Network issues detected, backing off to ${INTERVAL/1000}s`);
        }
      }
    };

    // Dynamic interval management
    let intervalId;
    const scheduleNext = () => {
      if (stopped) return;
      intervalId = setTimeout(() => {
        run().then(scheduleNext);
      }, INTERVAL);
    };

    // Initial delayed check (gives SSE chance to connect first)
    const initial = setTimeout(() => {
      run().then(scheduleNext);
    }, 3000);
    
    return () => { 
      stopped = true; 
      clearTimeout(initial); 
      if (intervalId) clearTimeout(intervalId);
    };
  }, [creator?.id]);

  // SSE subscription with exponential backoff reconnect; keep connected even when hidden
  useEffect(() => {
    if (!creator?.id) return;
    let es = null;
    let closed = false;
    let attempt = 0;
    const baseDelay = 1000; // 1s
    const maxDelay = 30000; // 30s
    const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
      ? import.meta.env.VITE_API_URL
      : ((typeof window !== 'undefined' && window.__API_BASE__) || '');
    const STREAM_URL = API_BASE ? `${API_BASE}/api/stream/transactions` : '/api/stream/transactions';

    const processEvent = (data) => {
      const currentId = creatorIdRef.current || creator?.id;
  if (!data || !currentId || String(data.creator_id) !== String(currentId)) return;
      console.debug('[SSE] tx event received for current creator', data);
      lastSseEventAtRef.current = Date.now(); // mark activity

      // Build full transaction object from SSE data
      const fullTx = {
        id: data.id || 'temp_' + data.reference,
        creator_id: data.creator_id,
        amount: data.amount,
        transaction_type: data.transaction_type || 'tip',
        status: data.status,
        payment_reference: data.reference,
        reference: data.reference,
        supporter_name: data.supporter_name || 'Anonymous',
        message: data.message || null,
        created_date: new Date().toISOString()
      };

      // Add/update transaction immediately
      addIncomingTip(fullTx);

      // Only apply balance updates for completed tips that we haven't processed yet
      if (data.status === 'completed') {
        const key = getTipKey(fullTx);
        if (key && !processedTipIdsRef.current.has(key)) {
          applyTipToCreator(fullTx);
        }
        // Delay canonical refresh slightly so backend has time to persist updated balances
        setTimeout(() => {
          refreshCreatorThrottled();
        }, 1200);
      } else {
        // For non-completed statuses we don't touch balances; a later completed event will handle it.
      }
    };

    const connect = () => {
      if (closed) return;
      try {
  es = new EventSource(STREAM_URL);
        es.addEventListener('open', () => {
          console.debug('[SSE] open event fired');
        });
        console.debug('[SSE] connecting /api/stream/transactions');
        es.addEventListener('tx', (evt) => {
          try { 
            const data = JSON.parse(evt.data); 
            if (import.meta.env.DEV) console.debug('[SSE] received event:', data);
            processEvent(data); 
          } catch (e) {
            if (import.meta.env.DEV) console.warn('[SSE] failed to parse event:', e);
          }
        });
        es.onopen = () => {
          attempt = 0;
          console.debug('[SSE] connected');
          sseConnectedRef.current = true;
          lastSseEventAtRef.current = Date.now();
          // Immediately refresh transactions to catch anything missed while disconnected
          (async () => {
            try {
              const latest = await Transaction.filter({ creator_id: creator.id }, '-created_date', 50);
              setTransactions(latest);
              try {
                const longHistory = await Transaction.filter({ creator_id: creator.id }, '-created_date', 'all');
                setPerformanceTransactions(longHistory);
              } catch {}
            } catch {}
          })();
          // Also refresh balances right away
          refreshCreatorThrottled();
        }; // reset backoff
        es.onerror = () => {
          console.warn('[SSE] error, will retry');
          try { es.close(); } catch {}
          if (closed) return;
          sseConnectedRef.current = false;
          attempt += 1;
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
          setTimeout(() => { connect(); }, delay);
        };
      } catch (err) {
        console.warn('[SSE] connect failed, will retry');
        sseConnectedRef.current = false;
        attempt += 1;
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        setTimeout(() => { connect(); }, delay);
      }
    };

    // Visibility hook: reconnect when visible if needed (do not force close when hidden)
    const onVis = () => {
      const vis = document.visibilityState === 'visible';
      visibilityRef.current = vis;
      if (vis && !es) { attempt = 0; connect(); }
    };
    document.addEventListener('visibilitychange', onVis);
    // Initial connect regardless of visibility
    connect();

    return () => {
      closed = true;
      sseConnectedRef.current = false;
      document.removeEventListener('visibilitychange', onVis);
      if (es) try { es.close(); } catch {}
    };
  }, [creator?.id]);

  // When transactions update (e.g., via periodic sync), detect pending->completed transitions and apply balances
  useEffect(() => {
    if (!creator) return;
    const map = txStatusByKeyRef.current;
    // Use performanceTransactions here so status transitions in older items are also considered
    for (const t of performanceTransactions) {
      if (!t || t.transaction_type !== 'tip') continue;
      const key = getTipKey(t);
      if (!key) continue;
      const prev = map.get(key);
      
      // Apply balance changes when we see completed tips for the first time (only if not already processed by SSE)
      if (t.status === 'completed') {
        if (prev !== 'completed' && !processedTipIdsRef.current.has(key)) {
          // This tip just completed via polling (SSE missed it) - apply balance changes
          applyTipToCreator(t);
        }
        map.set(key, 'completed');
      } else {
        map.set(key, t.status);
      }
    }
  }, [transactions, performanceTransactions, creator, getTipKey]);

  // Reconciliation pass: if the sum of completed tips (local) exceeds creator totals, patch UI (rare race condition)
  useEffect(() => {
    if (!creator) return;
    // Compute expected earnings from processed completed tips in current session only (not full historical recompute)
    const appliedKeys = processedTipIdsRef.current;
    let sessionAppliedTotal = 0;
    for (const t of transactions) {
      if (t.transaction_type === 'tip' && t.status === 'completed') {
        const k = getTipKey(t);
        if (k && appliedKeys.has(k)) {
          sessionAppliedTotal += Number(t.amount || 0) || 0;
        }
      }
    }
    // If creator totals somehow lag behind recently applied session increments (possible overwrite by stale fetch), reapply diff
    // This keeps UX consistent without double counting because we only consider keys already marked processed.
    // NOTE: This is a heuristic; backend remains source of truth after next refresh.
    const displayedTotal = Number(creator.total_earnings || 0);
    if (sessionAppliedTotal > 0 && displayedTotal < sessionAppliedTotal && import.meta.env.DEV) {
      console.debug('[reconcile] Adjusting displayed totals. sessionAppliedTotal=', sessionAppliedTotal, 'displayed=', displayedTotal);
    }
  }, [creator, transactions, getTipKey]);

  const handleCreateProfile = async (profileData) => {
    try {
      const newCreator = await Creator.create(profileData);
      setCreator(newCreator);
      await loadDashboardData();
    } catch (error) {
      console.error("Error creating profile:", error);
    }
  };

  const handleWithdrawal = async ({ amount, momo }) => {
    try {
      if (isSubmittingWithdraw) return;
      setIsSubmittingWithdraw(true);
      await Transaction.create({
        creator_id: creator.id,
        amount: -amount,
        transaction_type: 'withdrawal',
        status: 'pending',
        momo_number: momo,
      });
      setShowWithdrawModal(false);
      await loadDashboardData();
      toastSuccess(`Withdrawal of GH₵ ${amount.toFixed(2)} requested to ${momo}.`);
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toastError('Failed to request withdrawal. Please try again.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!creator) {
    // We redirect when unauthenticated or missing profile; render nothing to avoid flicker
    return null;
  }

  // Simple local icon component that renders the GH₵ currency sign
  const CediIcon = ({ className = "" }) => (
    <span className={["font-bold", className].join(" ")}>GH₵</span>
  );

  const stats = [
    {
      title: "Total Earnings",
      value: `GH₵ ${(creator.total_earnings || 0).toFixed(2)}`,
  icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Available Balance",
      value: `GH₵ ${(creator.available_balance || 0).toFixed(2)}`,
      icon: CediIcon,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Total Tips",
      value: transactions.filter(t => t.transaction_type === 'tip').length,
      icon: Gift,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Supporters",
      value: (() => {
        const tips = transactions.filter(t => t.transaction_type === 'tip');
        const namedSet = new Set();
        let anonymousCount = 0;
        for (const t of tips) {
          const name = (t.supporter_name || '').trim();
          if (!name || name.toLowerCase() === 'anonymous') {
            anonymousCount += 1; // each anonymous tip counts as a separate supporter
          } else {
            namedSet.add(name);
          }
        }
        return namedSet.size + anonymousCount;
      })(),
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-hidden">
                
        {/* Completed Tip Notification */}
        {completedTipNotification && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
            <style>{`
              @keyframes slideDown {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <div className="pointer-events-auto bg-white border border-green-200 rounded-lg shadow-lg p-4 w-80 mx-auto animate-[slideDown_0.3s_ease-out]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Gift className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    Tip Received! GH₵ {completedTipNotification.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-600">
                    from {completedTipNotification.supporter_name}
                  </p>
                  {completedTipNotification.message && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      "{completedTipNotification.message}"
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setCompletedTipNotification(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm ml-1 pointer-events-auto"
                  aria-label="Close notification"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header (mobile-first stacked layout) */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col items-center sm:items-start">
              <div className="relative w-28 h-28 sm:w-16 sm:h-16 flex items-center justify-center">
                <img
                  src={creator.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.display_name)}&size=128&background=2563eb&color=ffffff`}
                  alt={creator.display_name}
                  className="w-full h-full rounded-full border-4 border-white shadow-lg object-cover"
                />
                <input
                  id="profile-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileInputChange}
                />
                <button
                  type="button"
                  className="absolute bottom-2 right-2 sm:bottom-2 sm:right-2 bg-white rounded-full p-1 shadow-md hover:bg-blue-100 transition-colors flex items-center justify-center"
                  title={creator.profile_image ? "Change or remove photo" : "Upload photo"}
                  onClick={() => document.getElementById('profile-upload-input').click()}
                  style={{ zIndex: 2 }}
                >
                  <PenIcon size={22} color="#2563eb" />
                </button>
                {creator.profile_image && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute top-2 right-2 bg-red-50 text-red-600 rounded-full p-1 shadow hover:bg-red-100 text-xs"
                    title="Remove photo"
                    style={{ zIndex: 2 }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome back, {creator.display_name}!</h1>
              <p className="text-gray-600">@{creator.tiktok_username}</p>
              {creator.is_verified && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full mt-1">
                  ✓ Verified Creator
                </span>
              )}
            </div>
          </div>
          {/* Sound toggle removed for production */}
        </div>

        {/* Share Link */}
        <div className="mb-8">
          <ShareLinkBar creator={creator} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const pulse = balancePulse && (stat.title === 'Total Earnings' || stat.title === 'Available Balance');
            return (
              <Card key={index} className={`border-none shadow-lg transition-all duration-300 ${pulse ? 'ring-2 ring-emerald-400 scale-[1.015]' : 'hover:shadow-xl'}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                        {stat.title}
                        {pulse && (
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        )}
                      </p>
                      <p className={`text-2xl font-bold text-gray-900 ${pulse ? 'animate-pulse' : ''}`}>{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bgColor} ${pulse ? 'ring-2 ring-white/50' : ''}`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid lg:grid-cols-3 gap-8 overflow-x-hidden">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8 overflow-x-hidden">
            <EarningsOverview 
              creator={creator} 
              onWithdraw={() => setShowWithdrawModal(true)}
            />

            {/* Recent Tips first on mobile */}
            <div className="lg:hidden">
              <RecentTransactions transactions={transactions} />
            </div>
            {/* Use full history for stable chart so historical buckets never retroactively change */}
            <PerformanceChart transactions={performanceTransactions} />
          </div>

          {/* Right Column */}
          <div className="space-y-8 overflow-x-hidden">
            {/* Keep Recent Tips in sidebar on desktop */}
            <div className="hidden lg:block">
              <RecentTransactions transactions={transactions} />
            </div>
            <WithdrawalHistory transactions={transactions} />
          </div>
        </div>

        {/* Withdrawal Modal */}
        {showWithdrawModal && (
          <WithdrawalModal
            creator={creator}
            onWithdraw={handleWithdrawal}
            onClose={() => setShowWithdrawModal(false)}
          />
        )}
  {/* Live Tip Banner (longer on desktop) */}
  {/* Live tip banner removed */}
      </div>
    </div>
  );
}

// Uploader component removed — using the simple Update photo button in the header instead.
