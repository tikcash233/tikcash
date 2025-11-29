import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Creator, Transaction, User } from "@/entities/all";
import { Input } from "@/components/ui/input";
import { Search, ArrowUp, UserPlus, Eye } from "lucide-react";

import CreatorCard from "../components/supporter/CreatorCard";
import TipModal from "../components/supporter/TipModal";
import SearchFilters from "../components/supporter/SearchFilters";

export default function SupporterDashboard() {
  const { username } = useParams();
  const [creators, setCreators] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
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
      // If username is present in URL, auto-search for that creator
      if (username) {
        setSearchQuery(username);
      }
    })();
  }, [username]);

  // Deep-link: open tip modal when ?creator_id=... is present
  const location = useLocation();
  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    const creatorId = qp.get('creator_id') || qp.get('creatorId') || qp.get('creator');
    if (!creatorId) return;

    // Try to find the creator in the already-loaded list
    const found = creators.find(c => String(c.id) === String(creatorId));
    if (found) {
      setSelectedCreator(found);
      setIsTipModalOpen(true);
      return;
    }

    // Fallback: fetch creator by id
    (async () => {
      try {
        const res = await fetch(`/api/creators/${encodeURIComponent(creatorId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data) {
          setSelectedCreator(data);
          setIsTipModalOpen(true);
          // Add to creators list for convenience
          setCreators(prev => (prev.some(p => p.id === data.id) ? prev : [data, ...prev]));
        }
      } catch (e) {
        console.warn('Failed to load creator for deep-link', e);
      }
    })();
  }, [location.search, creators]);

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
              Creators & Hosts
            </span>
          </h1>
         
        </div>
    

        {/* Info Banner for Supporters */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mx-auto max-w-3xl flex flex-col md:flex-row items-center gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Find and Tip Creators</h3>
                <p className="text-gray-600 text-sm">Use the search bar below to discover creators, DJs, or service staff and send them your support instantly. No account needed!</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 mt-6">
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

        {/* Removed My Creators section for supporters */}

        {/* Tip Modal */}
        {selectedCreator && (
          <TipModal
            open={isTipModalOpen}
            creator={selectedCreator}
            onSendTip={handleSendTip}
            onClose={() => {
              setSelectedCreator(null);
              setIsTipModalOpen(false);
              // Clear the query param so reloading doesn't re-open the modal
              try { history.replaceState({}, '', '/support'); } catch {}
            }}
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
