import React, { useState, useEffect, useRef, useCallback } from "react";
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
  const [transactions, setTransactions] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  // (Legacy) safetySyncTimerRef removed: we now use a lightweight conditional fallback poll.
  const visibilityRef = useRef(document.visibilityState === 'visible');
  const creatorIdRef = useRef(null);
  const processedTipIdsRef = useRef(new Set());
  const lastNotifiedTipIdRef = useRef(null);
  const notifiedTipIdsRef = useRef(new Set());
  const txStatusByKeyRef = useRef(new Map());
  const lastCreatorRefreshAtRef = useRef(0);
  const [balancePulse, setBalancePulse] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const lastSoundAtRef = useRef(0);
  useEffect(() => {
    try {
      const v = localStorage.getItem('tikcash:sound_enabled');
      if (v === '1') setSoundEnabled(true);
    } catch {}
  }, []);
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev; 
      try { localStorage.setItem('tikcash:sound_enabled', next ? '1' : '0'); } catch {}
      return next;
    });
  };
  const playTipSound = useCallback(() => {
    if (!soundEnabled) return;
    const now = Date.now();
    if (now - lastSoundAtRef.current < 800) return; // rate-limit
    lastSoundAtRef.current = now;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880; // A5
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => { try { ctx.close(); } catch {} }, 400);
    } catch {}
  }, [soundEnabled]);

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

  // Helpers for persisting last-notified per creator
  const getNotifyKey = useCallback((creatorId) => `tikcash:last_notified_tip:${creatorId}`, []);
  const loadLastNotified = useCallback((creatorId) => {
    if (!creatorId) return null;
    try { return localStorage.getItem(getNotifyKey(creatorId)) || null; } catch { return null; }
  }, [getNotifyKey]);
  const saveLastNotified = useCallback((creatorId, tipId) => {
    if (!creatorId) return;
    try { localStorage.setItem(getNotifyKey(creatorId), tipId || ''); } catch {}
  }, [getNotifyKey]);

  const shouldNotify = useCallback((tip, c = creator) => {
    // Show for any new tip (pending or completed) once by unique key
    if (!tip || !c?.id) return false;
    if (String(tip.creator_id) !== String(c.id)) return false;
    const key = getTipKey(tip);
    if (!key) return false;
    if (notifiedTipIdsRef.current.has(key)) return false;
    return true;
  }, [creator, getTipKey]);

  const markNotified = useCallback((tip, c = creator) => {
    if (!tip || !c?.id) return;
    const key = getTipKey(tip);
    if (!key) return;
    notifiedTipIdsRef.current.add(key);
    lastNotifiedTipIdRef.current = key;
    saveLastNotified(c.id, key);
  }, [creator, saveLastNotified, getTipKey]);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

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
      const creatorTransactions = await Transaction.filter({ creator_id: creatorProfile.id }, '-created_date', 50);
      setTransactions(creatorTransactions);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      navigate('/', { replace: true });
    } finally {
      setIsLoading(false);
    }
  }

  // Helper to insert incoming tip into local transactions (keep newest first, dedupe)
  const addIncomingTip = (tip) => {
    if (!tip || tip.transaction_type !== "tip") return;
    setTransactions((prev) => {
      const k = getTipKey(tip);
      const exists = k ? prev.some((t) => getTipKey(t) === k) : false;
      if (exists) return prev;
  const next = [tip, ...prev];
  // Ensure sorted by created_date desc (robust to string/number) and limit to 50
  const toTime = (t) => new Date(t.created_date || t.createdAt || Date.now()).getTime();
  next.sort((a, b) => toTime(b) - toTime(a));
      return next.slice(0, 50);
    });
  };

  // Apply tip impact to creator balances exactly once per tip id
  const applyTipToCreator = (tip) => {
    if (!tip || !creator || tip.creator_id !== creator.id) return;
    const key = getTipKey(tip);
    if (!key) return;
    if (processedTipIdsRef.current.has(key)) return; // already applied
    processedTipIdsRef.current.add(key);
    const amt = Number(tip.amount || 0) || 0;
    if (amt <= 0) return;
    setCreator((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        total_earnings: (prev.total_earnings || 0) + amt,
        available_balance: (prev.available_balance || 0) + amt,
      };
    });
    setBalancePulse(true);
    setTimeout(() => setBalancePulse(false), 1200);
  };

  // Live tip notifications state (max 3 stacked)
  const [liveTips, setLiveTips] = useState([]); // {key, amount, supporter_name, message, status}

  // Show a live tip banner immediately (deduped by stable key)
  const showTipNow = useCallback((tip) => {
    if (!tip) return;
    const key = getTipKey(tip);
    if (!key) return;
    console.debug('[liveTip] showTipNow attempt', { key, tip });
    setLiveTips(prev => {
      if (prev.some(n => n.key === key)) return prev; // already showing
      const entry = {
        key,
        amount: Number(tip.amount) || 0,
        supporter_name: tip.supporter_name || 'Anonymous',
        message: tip.message || '',
        status: tip.status || 'pending'
      };
      return [entry, ...prev].slice(0,3);
    });
    playTipSound();
    // Auto dismiss after 6s
    setTimeout(() => {
      setLiveTips(prev => prev.filter(n => n.key !== key));
    }, 6000);
  }, [getTipKey]);

  // Keep latest handlers in refs to avoid re-subscribing SSE on every render
  const shouldNotifyRef = useRef(shouldNotify);
  const showTipNowRef = useRef(showTipNow);
  const markNotifiedRef = useRef(markNotified);
  useEffect(() => { shouldNotifyRef.current = shouldNotify; }, [shouldNotify]);
  useEffect(() => { showTipNowRef.current = showTipNow; }, [showTipNow]);
  useEffect(() => { markNotifiedRef.current = markNotified; }, [markNotified]);

  // Subscribe to in-app bus
  useEffect(() => {
  const off = RealtimeBus.on("transaction:tip", (tip) => {
      if (!creator || tip.creator_id !== creator.id) return;
      addIncomingTip(tip);
      applyTipToCreator(tip);
      if (shouldNotify(tip)) {
        showTipNow(tip);
        markNotified(tip);
      }
    });
    return off;
  }, [creator]);

  // Subscribe to BroadcastChannel for cross-tab tips and always add a storage fallback
  useEffect(() => {
    let bc;
  const onMsg = (e) => {
      const { type, payload } = e.data || {};
      if (type === "transaction:tip" && payload && creator && payload.creator_id === creator.id) {
    addIncomingTip(payload);
    applyTipToCreator(payload);
    if (shouldNotify(payload)) {
      showTipNow(payload);
      markNotified(payload);
    }
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
        if (tip && creator && tip.creator_id === creator.id) {
      addIncomingTip(tip);
      applyTipToCreator(tip);
      if (shouldNotify(tip)) {
        showTipNow(tip);
        markNotified(tip);
      }
        }
      } catch {}
    };
    window.addEventListener('storage', onStorage);

    return () => {
      if (bc) bc.removeEventListener('message', onMsg);
      window.removeEventListener('storage', onStorage);
    };
  }, [creator]);

  // =============================================================
  // SSE HEALTH STATE (for smarter, low-resource fallback polling)
  // We only poll the server if (a) SSE is currently disconnected OR
  // (b) SSE has been silent for a long time (stale) which might mean
  // the connection died without firing an error event (rare, but happens
  // on some mobile networks / suspended tabs).
  // =============================================================
  const sseConnectedRef = useRef(false);       // true while EventSource.open
  const lastSseEventAtRef = useRef(0);         // timestamp (ms) of last received tx event OR open

  // Lightweight conditional fallback poll (runs every 30s but usually NO-OP)
  useEffect(() => {
    if (!creator?.id) return;
    const INTERVAL = 30000; // check every 30s (very light)
    let stopped = false;

    const run = async () => {
      if (stopped) return;
      const now = Date.now();
      const connected = sseConnectedRef.current;
      const lastEvt = lastSseEventAtRef.current;
      const stale = (now - lastEvt) > 45000; // >45s without any SSE activity
      // Only fetch when: not connected (after initial 3s grace) OR stale.
      if (connected && !stale) return; // nothing to do (SSE healthy)
      try {
        const latest = await Transaction.filter({ creator_id: creator.id }, '-created_date', 50);
        setTransactions(latest);
      } catch {}
    };

    // Initial delayed check (gives SSE chance to connect first)
    const initial = setTimeout(run, 5000);
    const id = setInterval(run, INTERVAL);
    return () => { stopped = true; clearTimeout(initial); clearInterval(id); };
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
      if (!data || !currentId || data.creator_id !== currentId) return;
      console.debug('[SSE] tx event received for current creator', data);
      lastSseEventAtRef.current = Date.now(); // mark activity
      // Always upsert transaction for this reference (pending or completed)
      setTransactions((prev) => {
        const exists = prev.find(t => (t.payment_reference || t.reference) === data.reference);
        const fullTx = {
          id: data.id || (exists && exists.id) || 'temp_'+data.reference,
          creator_id: data.creator_id,
          amount: data.amount,
          transaction_type: data.transaction_type || 'tip',
          status: data.status,
          payment_reference: data.reference,
          supporter_name: data.supporter_name || exists?.supporter_name || 'Anonymous',
          message: data.message || exists?.message || null,
          created_date: exists?.created_date || new Date().toISOString()
        };
        let next;
        if (exists) {
          next = prev.map(t => (t.payment_reference || t.reference) === data.reference ? { ...t, ...fullTx } : t);
        } else {
          next = [fullTx, ...prev];
        }
        next.sort((a,b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
        return next.slice(0,50);
      });

      // Apply balances only when completed and then fetch canonical creator to avoid drift
      if (data.status === 'completed') {
        setCreator((prev) => prev ? { ...prev, total_earnings: (prev.total_earnings||0)+Number(data.amount||0), available_balance: (prev.available_balance||0)+Number(data.amount||0) } : prev);
        setBalancePulse(true);
        setTimeout(() => setBalancePulse(false), 1200);
        (async () => {
          try {
            const id = creatorIdRef.current || creator?.id;
            if (id) {
              const fresh = await Creator.get(id);
              if (fresh) setCreator(fresh);
            }
          } catch {}
        })();
      }

  // Show banner on pending and completed (dedupe via stable key)
      const maybeTip = {
        id: data.id,
        creator_id: data.creator_id,
        amount: data.amount,
        transaction_type: data.transaction_type || 'tip',
        payment_reference: data.reference,
        reference: data.reference,
        supporter_name: data.supporter_name,
        message: data.message,
        status: data.status,
      };
      // Always show banner for pending/completed once; ensures visibility even if UI missed pending
      if (shouldNotifyRef.current(maybeTip)) {
        console.debug('[notify] triggering live banner for tip', maybeTip);
        showTipNowRef.current(maybeTip);
        markNotifiedRef.current(maybeTip);
      }

  // Always refresh creator balances (throttled) so cards update without manual refresh
  refreshCreatorThrottled();
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
          try { processEvent(JSON.parse(evt.data)); } catch {}
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
            } catch {}
          })();
          // Also refresh balances right away
          refreshCreatorThrottled();
          setBalancePulse(true);
          setTimeout(() => setBalancePulse(false), 1200);
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

  // Seed last-notified from storage on initial load, or to newest existing tip to avoid retro-toasts
  // Seed: mark ALL existing tips as already notified so we never show historical tips again on reload.
  const initialSeedDoneRef = useRef(false);
  const latestSeenCreatedRef = useRef(0); // ms timestamp of the latest tip we have acknowledged
  useEffect(() => {
    if (!creator || initialSeedDoneRef.current) return;
    const tips = (transactions || []).filter(t => t && t.transaction_type === 'tip');
    let maxDate = 0;
    for (const t of tips) {
      const key = getTipKey(t);
      if (key) {
        notifiedTipIdsRef.current.add(key);
        const ts = new Date(t.created_date || Date.now()).getTime();
        if (ts > maxDate) maxDate = ts;
      }
    }
    latestSeenCreatedRef.current = maxDate || Date.now();
    // Persist only newest key (still used for cross-tab dedupe)
    const newest = tips.sort((a,b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
    if (newest) {
      const newestKey = getTipKey(newest);
      if (newestKey) {
        lastNotifiedTipIdRef.current = newestKey;
        saveLastNotified(creator.id, newestKey);
      }
    }
    initialSeedDoneRef.current = true;
  }, [creator, transactions, getTipKey, saveLastNotified]);

  // Fallback: if for any reason SSE/banner missed a newly arrived tip that appears in transactions list,
  // surface the most recent un-notified tip (runs after transactions update). Prevents silent failures.
  // Fallback: only consider tips whose created_date is AFTER the latest seen timestamp
  useEffect(() => {
    if (!creator || !initialSeedDoneRef.current) return;
    const ordered = (transactions || []).filter(t => t && t.transaction_type === 'tip')
      .sort((a,b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime()); // oldest -> newest
    for (const t of ordered) {
      const ts = new Date(t.created_date || Date.now()).getTime();
      if (ts <= latestSeenCreatedRef.current) continue; // already seen timeline
      const key = getTipKey(t);
      if (!key || notifiedTipIdsRef.current.has(key)) continue;
      if (shouldNotifyRef.current(t)) {
        if (import.meta.env.DEV) console.debug('[fallback] new unseen tip -> banner', t);
        showTipNowRef.current(t);
        markNotifiedRef.current(t);
        latestSeenCreatedRef.current = ts;
      }
    }
  }, [transactions, creator, getTipKey]);

  // Dequeue toasts one at a time
  // Tip queue logic removed

  // When transactions update (e.g., via periodic sync), detect pending->completed transitions and apply balances
  useEffect(() => {
    if (!creator) return;
    const map = txStatusByKeyRef.current;
    for (const t of transactions) {
      if (!t || t.transaction_type !== 'tip') continue;
      const key = getTipKey(t);
      if (!key) continue;
      const prev = map.get(key);
      if (t.status === 'completed') {
        if (prev && prev !== 'completed') {
          applyTipToCreator(t);
        }
        map.set(key, 'completed');
      } else {
        map.set(key, t.status);
      }
    }
  }, [transactions, creator, getTipKey]);

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
        {/* Live Tip Banners */}
        {liveTips.length > 0 && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-full pointer-events-none px-2">
            {liveTips.map(t => (
              <div
                key={t.key}
                className={`pointer-events-auto w-[min(95%,420px)] rounded-lg border shadow-md bg-white/95 backdrop-blur px-4 py-3 flex items-start gap-3 animate-[fadeIn_.25s_ease] ${t.status==='completed' ? 'border-emerald-300' : 'border-amber-300'}`}
                style={{ boxShadow: '0 4px 14px -2px rgba(0,0,0,0.15)' }}
              >
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${t.status==='completed' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'}`}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {t.status==='completed' ? 'Tip received' : 'New tip started'} • GH₵ {t.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-600 truncate">from {t.supporter_name}</p>
                  {t.message && <p className="text-xs text-gray-500 mt-1 line-clamp-2 break-words">{t.message}</p>}
                </div>
                <button
                  onClick={() => setLiveTips(prev => prev.filter(n => n.key !== t.key))}
                  aria-label="Close notification"
                  className="text-gray-400 hover:text-gray-600 text-sm ml-1"
                >×</button>
              </div>
            ))}
          </div>
        )}
        {/* Beginner test helper (remove in production): manually trigger a fake tip banner */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="fixed bottom-4 right-4 z-40">
            <button
              onClick={() => {
                const fake = { id: 'test_'+Date.now(), creator_id: creator.id, amount: (Math.random()*10+1).toFixed(2), supporter_name: 'Test', message: 'Sample tip', status: 'pending' };
                console.debug('[test] manual fake tip trigger', fake);
                showTipNow(fake);
              }}
              className="px-3 py-1.5 text-xs rounded-md bg-gray-800 text-white/90 hover:bg-gray-700 shadow"
            >Test Tip Banner</button>
          </div>
        )}
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 mb-4">
            <img 
              src={creator.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.display_name)}&size=64&background=2563eb&color=ffffff`}
              alt={creator.display_name}
              className="w-16 h-16 rounded-full border-4 border-white shadow-lg"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome back, {creator.display_name}!</h1>
              <p className="text-gray-600">@{creator.tiktok_username}</p>
              {creator.is_verified && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full mt-1">
                  ✓ Verified Creator
                </span>
              )}
            </div>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={toggleSound}
                className={`text-xs px-3 py-1.5 rounded-full border shadow-sm transition ${soundEnabled ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                title={soundEnabled ? 'Click to mute tip sound' : 'Click to enable tip sound'}
              >{soundEnabled ? '🔔 Sound On' : '🔕 Sound Off'}</button>
            </div>
          </div>
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
            <PerformanceChart transactions={transactions} />
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
