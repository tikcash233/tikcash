
import React, { useState, useEffect } from "react";
import { Creator, Transaction, User } from "@/entities/all";
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
import CreatorProfile from "../components/creator/CreatorProfile";
import PerformanceChart from "../components/creator/PerformanceChart";
import { useToast } from "@/components/ui/toast.jsx";

export default function CreatorDashboard() {
  const [creator, setCreator] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const { success, error } = useToast();
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      // Try to find existing creator profile
      const creators = await Creator.filter({ created_by: currentUser.email });
      if (creators.length > 0) {
        const creatorProfile = creators[0];
        setCreator(creatorProfile);
        
        // Load transactions for this creator
        const creatorTransactions = await Transaction.filter(
          { creator_id: creatorProfile.id }, 
          '-created_date', 
          20
        );
        setTransactions(creatorTransactions);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
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
      
      // Update creator balance
      await Creator.update(creator.id, {
        available_balance: creator.available_balance - amount
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
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <CreatorProfile onCreateProfile={handleCreateProfile} />
        </div>
      </div>
    );
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
      value: new Set(transactions.filter(t => t.transaction_type === 'tip').map(t => t.supporter_name)).size,
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
      </div>
    </div>
  );
}
