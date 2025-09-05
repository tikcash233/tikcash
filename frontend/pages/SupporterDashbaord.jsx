import React, { useState, useEffect, useCallback } from "react";
import { Creator, Transaction } from "@/entities/all";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

import CreatorCard from "../components/supporter/CreatorCard";
import TipModal from "../components/supporter/TipModal";
import SearchFilters from "../components/supporter/SearchFilters";

export default function SupporterDashboard() {
  const [creators, setCreators] = useState([]);
  const [filteredCreators, setFilteredCreators] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCreators();
  }, []);

  const filterCreators = useCallback(() => {
    let filtered = creators;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(creator => 
        creator.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.tiktok_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.bio?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(creator => creator.category === selectedCategory);
    }

    setFilteredCreators(filtered);
  }, [creators, searchQuery, selectedCategory]);

  useEffect(() => {
    filterCreators();
  }, [filterCreators]);

  const loadCreators = async () => {
    try {
      const creatorList = await Creator.list('-total_earnings');
      setCreators(creatorList);
    } catch (error) {
      console.error("Error loading creators:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTip = async (tipData) => {
    try {
      // Create tip transaction
      const transaction = await Transaction.create({
        creator_id: selectedCreator.id,
        supporter_name: tipData.supporter_name,
        amount: tipData.amount,
        message: tipData.message,
        transaction_type: "tip",
        status: "completed"
      });

      setSelectedCreator(null);
      await loadCreators();
      
      return { success: true };
    } catch (error) {
      console.error("Error sending tip:", error);
      return { success: false, error: "Failed to send tip" };
    }
  };

  const topCreators = creators.slice(0, 3);
  // Removed stats (Active Creators/Total Supported/Tips Sent), so derived totals are no longer needed here

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Support Your Favorite 
            <span className="block bg-gradient-to-r from-red-600 via-yellow-500 to-green-600 bg-clip-text text-transparent">
              TikTok Creators
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Show love to Ghanaian creators by sending tips and supporting their amazing content
          </p>
        </div>

        {/* Top Creators Spotlight */}
        {topCreators.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              🌟 Top Earning Creators
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {topCreators.map((creator, index) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  onTip={() => setSelectedCreator(creator)}
                  rank={index + 1}
                  isSpotlight={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search creators by name or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 py-3"
              />
            </div>
          </div>
          
          <SearchFilters
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>

        {/* All Creators Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            All Creators ({filteredCreators.length})
          </h2>
          
          {filteredCreators.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCreators.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  onTip={() => setSelectedCreator(creator)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No creators found</h3>
              <p className="text-gray-600">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </div>

        {/* Tip Modal */}
        {selectedCreator && (
          <TipModal
            creator={selectedCreator}
            onSendTip={handleSendTip}
            onClose={() => setSelectedCreator(null)}
          />
        )}
      </div>
    </div>
  );
}
