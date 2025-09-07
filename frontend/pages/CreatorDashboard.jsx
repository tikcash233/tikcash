
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
  const { success, error } = useToast();
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [liveTip, setLiveTip] = useState(null);
  const [tipQueue, setTipQueue] = useState([]);
  const [tipSoundOn, setTipSoundOn] = useState(true);
  // bell removed; we just keep a toast + sound toggle
  const processedTipIdsRef = useRef(new Set()); // avoid double-applying same tip across bus+broadcast
  const lastNotifiedTipIdRef = useRef(null); // ensure we show toast at least once per newest tip
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Helper to insert incoming tip into local transactions (keep newest first, dedupe)
  const addIncomingTip = (tip) => {
    if (!tip || tip.transaction_type !== "tip") return;
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === tip.id);
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
    const id = tip.id;
    if (!id) return;
    if (processedTipIdsRef.current.has(id)) return; // already applied
    processedTipIdsRef.current.add(id);
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
  };

  // Immediately display newest tip by preempting current toast; push current back into queue
  const showTipNow = (tip) => {
    if (!tip) return;
  // Drop the current toast (do not re-queue) and ensure no duplicate of the new tip sits in queue
  setTipQueue((q) => q.filter((t) => t.id !== tip.id));
  setLiveTip(() => tip);
  if (tip.id) lastNotifiedTipIdRef.current = tip.id;
  };

  // Subscribe to in-app bus
  useEffect(() => {
  const off = RealtimeBus.on("transaction:tip", (tip) => {
      if (!creator || tip.creator_id !== creator.id) return;
      addIncomingTip(tip);
      applyTipToCreator(tip);
      showTipNow(tip);
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
    showTipNow(payload);
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
      showTipNow(tip);
        }
      } catch {}
    };
    window.addEventListener('storage', onStorage);

    return () => {
      if (bc) bc.removeEventListener('message', onMsg);
      window.removeEventListener('storage', onStorage);
    };
  }, [creator]);

  // Polling fallback: refresh creator + recent transactions every 3s
  useEffect(() => {
    if (!creator || !user) return;
    const id = setInterval(async () => {
      try {
        // Refresh creator balances
        const list = await Creator.filter({ created_by: user.email });
        if (list && list[0]) setCreator(list[0]);
        // Refresh transactions (top 50)
        const latest = await Transaction.filter({ creator_id: creator.id }, '-created_date', 50);
        setTransactions(latest);
        // Fallback: if a new tip appears via polling, show a toast for the newest one
        const newestTip = Array.isArray(latest)
          ? latest.find((t) => t && t.transaction_type === 'tip')
          : null;
        if (newestTip && newestTip.id && lastNotifiedTipIdRef.current !== newestTip.id) {
          showTipNow(newestTip);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [creator, user]);

  // Dequeue toasts one at a time
  useEffect(() => {
    if (!liveTip && tipQueue.length > 0) {
      const [next, ...rest] = tipQueue;
      setLiveTip(next);
      setTipQueue(rest);
    }
  }, [liveTip, tipQueue]);

  // Stable close handler so auto-dismiss timer isn't reset on each render
  const closeTip = useCallback(() => setLiveTip(null), []);

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
  success(`Withdrawal of GH₵ ${amount.toFixed(2)} requested to ${momo}.`);
    } catch (error) {
  console.error("Error processing withdrawal:", error);
      error("Failed to request withdrawal. Please try again.");
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
          {stats.map((stat, index) => (
            <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                    <p className={"text-2xl font-bold text-gray-900"}>{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
              <RecentTransactions transactions={transactions} tipSoundOn={tipSoundOn} onToggleSound={() => setTipSoundOn(v=>!v)} />
            </div>
            <PerformanceChart transactions={transactions} />
          </div>

          {/* Right Column */}
          <div className="space-y-8 overflow-x-hidden">
            {/* Keep Recent Tips in sidebar on desktop */}
            <div className="hidden lg:block">
              <RecentTransactions transactions={transactions} tipSoundOn={tipSoundOn} onToggleSound={() => setTipSoundOn(v=>!v)} />
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
        {/* Live Tip Toast */}
        <LiveTipToast
          tip={liveTip}
          onClose={closeTip}
          soundEnabled={tipSoundOn}
          duration={5000}
        />
      </div>
    </div>
  );
}
