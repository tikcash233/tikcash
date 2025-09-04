import React, { useState, useEffect, useCallback } from "react";
import { Creator } from "@/entities/all";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp } from "lucide-react";

import CreatorCard from "../components/supporter/CreatorCard";
import SearchFilters from "../components/supporter/SearchFilters";
import TipModal from "../components/supporter/TipModal";

export default function BrowseCreators() {
  const [creators, setCreators] = useState([]);
  const [filteredCreators, setFilteredCreators] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('earnings');
  const [isLoading, setIsLoading] = useState(true);

  const loadCreators = useCallback(async () => {
    try {
      const sortField = '-total_earnings'; // followers-based sorting removed
      const creatorList = await Creator.list(sortField);
      setCreators(creatorList);
    } catch (error) {
      console.error("Error loading creators:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  const filterCreators = useCallback(() => {
    let filtered = creators;

    if (searchQuery) {
      filtered = filtered.filter(creator => 
        creator.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.tiktok_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.bio?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(creator => creator.category === selectedCategory);
    }

    setFilteredCreators(filtered);
  }, [creators, searchQuery, selectedCategory]);

  useEffect(() => {
    loadCreators();
  }, [loadCreators]);

  useEffect(() => {
    filterCreators();
  }, [filterCreators]);

  const handleSendTip = async (tipData) => {
    // Implementation would be similar to SupporterDashboard
    console.log("Tip sent:", tipData);
    setSelectedCreator(null);
    return { success: true };
  };

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
            Discover Amazing 
            <span className="block bg-gradient-to-r from-red-600 via-yellow-500 to-green-600 bg-clip-text text-transparent">
              Ghanaian Creators
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Browse through our community of talented TikTok creators and show your support
          </p>
        </div>

        {/* Search and Sort */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search creators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 py-3"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('earnings')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                  sortBy === 'earnings'
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Top Earners</span>
              </button>
            </div>
          </div>
          
          <SearchFilters
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>

        {/* Results */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {filteredCreators.length} Creator{filteredCreators.length !== 1 ? 's' : ''} Found
            </h2>
            <div className="text-sm text-gray-600">Sorted by earnings</div>
          </div>
        </div>

        {/* Creators Grid */}
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
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No creators found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}

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
