import React, { useState, useEffect, useCallback } from "react";
import { Creator, Transaction, User } from "@/entities/all";
import { Input } from "@/components/ui/input";
import { Search, ArrowUp } from "lucide-react";

import CreatorCard from "../components/supporter/CreatorCard";
import TipModal from "../components/supporter/TipModal";
import SearchFilters from "../components/supporter/SearchFilters";

export default function SupporterDashboard() {
  const [creators, setCreators] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [user, setUser] = useState(null);
  const [showingSearchResults, setShowingSearchResults] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await User.me();
      setUser(me);
      await loadCreators(1, true);
    })();
  }, []);

  // Show/hide scroll-to-top button based on scroll position
  useEffect(() => {
    const onScroll = () => {
      try { setShowScrollTop(window.scrollY > 300); } catch {}
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Initialize visibility on mount
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const loadCreators = async (nextPage = 1, replace = false) => {
    try {
      setIsLoading(true);
      const data = await User.myCreators({ page: nextPage, limit: 24 });
      const list = Array.isArray(data?.data) ? data.data : [];
      setCreators((prev) => replace ? list : [...prev, ...list]);
      setPage(nextPage);
      setHasMore(Boolean(data?.hasMore ?? (list.length >= (data?.pageSize || 24))));
    } catch (error) {
      console.error("Error loading creators:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchCreators = async (query, nextPage = 1, replace = false) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowingSearchResults(false);
      return;
    }
    
    try {
    setIsSearching(true);
      const data = await Creator.search(query.trim(), { page: nextPage, limit: 10 });
      const list = Array.isArray(data?.data) ? data.data : [];
      setSearchResults((prev) => replace ? list : [...prev, ...list]);
      setSearchPage(nextPage);
      setSearchHasMore(Boolean(data?.hasMore ?? (list.length >= (data?.pageSize || 10))));
      setShowingSearchResults(true);
    } catch (error) {
      console.error("Error searching creators:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchCreators(searchQuery, 1, true);
      } else {
        setSearchResults([]);
        setShowingSearchResults(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowingSearchResults(false);
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
      
      // Refresh the supported creators list to include the new creator
      await loadCreators(1, true);
      
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
        {!showingSearchResults && topCreators.length > 0 && (
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

        {/* Search helper */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search creators by @username or display name..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10 py-3"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search Results */}
        {showingSearchResults && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                Search Results ({searchResults.length})
              </h2>
              <button
                onClick={clearSearch}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Clear search
              </button>
            </div>
            {isSearching && searchResults.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Searching...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {searchResults.map((creator) => (
                    <CreatorCard
                      key={creator.id}
                      creator={creator}
                      onTip={() => setSelectedCreator(creator)}
                    />
                  ))}
                </div>
                {searchHasMore && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => searchCreators(searchQuery, searchPage + 1)}
                      className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                      disabled={isSearching}
                    >
                      {isSearching ? 'Loading...' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No creators found</h3>
                <p className="text-gray-600">
                  Try a different search term or check the spelling.
                </p>
              </div>
            )}
          </div>
        )}

        {/* My Creators */}
        {!showingSearchResults && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              My Creators ({creators.length})
            </h2>
            {creators.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {creators.map((creator) => (
                    <CreatorCard
                      key={creator.id}
                      creator={creator}
                      onTip={() => setSelectedCreator(creator)}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => loadCreators(page + 1)}
                      className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Loading...' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">You haven't supported any creators yet</h3>
                <p className="text-gray-600 mb-4">
                  Use the search above to find creators by their @username or display name.
                </p>
              </div>
            )}
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
        {showScrollTop && (
          <button
            aria-label="Back to top"
            onClick={scrollToTopSmooth}
            className="fixed bottom-6 right-6 md:bottom-8 md:right-8 h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Smooth scroll helper (in case browsers lacking smooth behavior)
function scrollToTopSmooth() {
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { window.scrollTo(0, 0); }
}
