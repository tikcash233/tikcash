
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Creator, Transaction, User, RealtimeBus } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Coins, 
  TrendingUp, 
  Users, 
  Gift,
  ArrowUpRight,
  Eye,
  Heart,
  MessageCircle
} from "lucide-react";

import EarningsOverview from "../components/creator/EarningsOverview";
import ShareLinkBar from "../components/creator/ShareLinkBar";
import RecentTransactions from "../components/creator/RecentTransactions";
import WithdrawalHistory from "../components/creator/WithdrawalHistory";
import WithdrawalModal from "../components/creator/WithdrawalModal";
// Removed inline CreatorProfile fallback; use dedicated signup flow instead
import PerformanceChart from "../components/creator/PerformanceChart";
import LiveTipToast from "../components/creator/LiveTipToast";
import { useToast } from "@/components/ui/toast.jsx";

export default function CreatorDashboard() {
  const [creator, setCreator] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [liveTip, setLiveTip] = useState(null);
  const [tipQueue, setTipQueue] = useState([]);
  // sound removed; toast banner only
  const safetySyncTimerRef = useRef(null); // holds periodic sync interval
  const visibilityRef = useRef(document.visibilityState === 'visible');
  const creatorIdRef = useRef(null);
  // bell removed; we just keep a toast + sound toggle
  const processedTipIdsRef = useRef(new Set()); // avoid double-applying same tip across bus+broadcast
  const lastNotifiedTipIdRef = useRef(null); // last tip key we notified for this creator (persisted)
  const notifiedTipIdsRef = useRef(new Set()); // in-session set of tip keys we already showed as toast
  const txStatusByKeyRef = useRef(new Map()); // track last known status per tip to detect transitions
  const lastCreatorRefreshAtRef = useRef(0);
  const [balancePulse, setBalancePulse] = useState(false);

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

  // Immediately display newest tip by preempting current toast (memoized to avoid re-subscribing SSE)
  const showTipNow = useCallback((tip) => {
    if (!tip) return;
    const key = getTipKey(tip);
    // Drop the current toast (do not re-queue) and ensure no duplicate of the new tip sits in queue
    setTipQueue((q) => q.filter((t) => getTipKey(t) !== key));
    setLiveTip(() => tip);
    if (key && creator?.id) {
      lastNotifiedTipIdRef.current = key;
      saveLastNotified(creator.id, key);
      notifiedTipIdsRef.current.add(key);
    }
  }, [creator, getTipKey, saveLastNotified]);

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

  // Light periodic sync (safety) with visibility awareness.
  useEffect(() => {
    if (!creator?.id || !user?.email) return;
    const run = async () => {
      if (!visibilityRef.current) return; // skip if hidden
      try {
        // Only refresh transactions to avoid unnecessary re-renders
        const latest = await Transaction.filter({ creator_id: creator.id }, '-created_date', 50);
        setTransactions(latest);
      } catch {}
    };
    // initial run only if visible
    if (document.visibilityState === 'visible') run();
    // start interval
    safetySyncTimerRef.current = setInterval(run, 10000);
    const onVis = () => {
      const vis = document.visibilityState === 'visible';
      visibilityRef.current = vis;
      if (vis) {
        // run immediate sync after becoming visible
        run();
        if (!safetySyncTimerRef.current) {
          safetySyncTimerRef.current = setInterval(run, 10000);
        }
      } else {
        // pause interval while hidden
        if (safetySyncTimerRef.current) {
          clearInterval(safetySyncTimerRef.current);
          safetySyncTimerRef.current = null;
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (safetySyncTimerRef.current) clearInterval(safetySyncTimerRef.current);
      safetySyncTimerRef.current = null;
    };
  }, [creator?.id, user?.email]);

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
        console.debug('[SSE] connecting /api/stream/transactions');
        es.addEventListener('tx', (evt) => {
          try { processEvent(JSON.parse(evt.data)); } catch {}
        });
        es.onopen = () => {
          attempt = 0;
          console.debug('[SSE] connected');
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
          attempt += 1;
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
          setTimeout(() => { connect(); }, delay);
        };
      } catch (err) {
        console.warn('[SSE] connect failed, will retry');
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
      document.removeEventListener('visibilitychange', onVis);
      if (es) try { es.close(); } catch {}
    };
  }, [creator?.id]);

  // Seed last-notified from storage on initial load, or to newest existing tip to avoid retro-toasts
  useEffect(() => {
    if (!creator) return;
    const stored = loadLastNotified(creator.id);
    if (stored) {
      lastNotifiedTipIdRef.current = stored;
      return;
    }
    if (Array.isArray(transactions) && transactions.length > 0) {
      const newest = transactions.find((t) => t && t.transaction_type === 'tip');
      const key = getTipKey(newest);
      if (key) {
        lastNotifiedTipIdRef.current = key;
        saveLastNotified(creator.id, key);
      }
    }
  }, [creator, transactions, loadLastNotified, saveLastNotified, getTipKey]);

  // Dequeue toasts one at a time
  useEffect(() => {
    if (!liveTip && tipQueue.length > 0) {
      const [next, ...rest] = tipQueue;
      setLiveTip(next);
      setTipQueue(rest);
    }
  }, [liveTip, tipQueue]);

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
          // transitioned to completed -> apply balance once
          applyTipToCreator(t);
        }
        map.set(key, 'completed');
      } else {
        // pending or other statuses
        map.set(key, t.status);
      }
    }
  }, [transactions, creator, getTipKey]);

  // Stable close handler so auto-dismiss timer isn't reset on each render
  const closeTip = useCallback(() => setLiveTip(null), []);

  // Keep current creator id in a ref for stable SSE filtering
  useEffect(() => {
    creatorIdRef.current = creator?.id || null;
  }, [creator?.id]);

  const loadDashboardData = async () => {
    try {
      const currentUser = await User.me();
      if (!currentUser) {
        // Not authenticated: send to Home and prevent back to this page
        navigate('/', { replace: true });
        return;
      }
      setUser(currentUser);

      // Try to find existing creator profile for this user
      const creators = await Creator.filter({ created_by: currentUser.email });
      if (creators.length > 0) {
        const creatorProfile = creators[0];
        setCreator(creatorProfile);
        
        // Load transactions for this creator (load more to include older tips like yesterday)
        const creatorTransactions = await Transaction.filter(
          { creator_id: creatorProfile.id }, 
          '-created_date', 
          50
        );
        setTransactions(creatorTransactions);
      } else {
        // Logged in but no profile: redirect to creator signup page
        navigate('/auth?mode=register&role=creator', { replace: true });
        return;
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      // On any unexpected error, keep users safe on Home
      navigate('/', { replace: true });
      return;
    } finally {
      setIsLoading(false);
    }
  };

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
      // Create withdrawal transaction
      await Transaction.create({
        creator_id: creator.id,
        amount: -amount,
        transaction_type: "withdrawal",
        status: "pending",
        momo_number: momo
      });
      
      setShowWithdrawModal(false);
      await loadDashboardData();
  toastSuccess(`Withdrawal of GH₵ ${amount.toFixed(2)} requested to ${momo}.`);
    } catch (error) {
  console.error("Error processing withdrawal:", error);
      toastError("Failed to request withdrawal. Please try again.");
    }
    finally {
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
            {/* Speaker toggle removed here; use the one inside Recent Tips section */}
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
  <LiveTipToast
    tip={liveTip}
    onClose={closeTip}
    duration={(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 1024px)').matches) ? 10000 : 7000}
  />
      </div>
    </div>
  );
}
