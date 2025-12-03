import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Activity, BadgeCheck, CalendarDays, RefreshCw, Search, Users2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { apiUrl } from '@/src/config';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'dance', label: 'Dance' },
  { value: 'music', label: 'Music' },
  { value: 'education', label: 'Education' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'food', label: 'Food' },
  { value: 'sports', label: 'Sports' },
  { value: 'other', label: 'Other' },
];

const ACTIVE_WINDOW_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const currencyFormatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 });
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, notation: 'compact' });

function formatCurrency(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'GH₵ 0.00';
  return currencyFormatter.format(value);
}

function formatDate(dateValue) {
  if (!dateValue) return '—';
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRelative(dateValue) {
  if (!dateValue) return 'Never';
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return 'Never';
  const diff = Date.now() - dt.getTime();
  if (diff < 0) return 'Just now';
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function getInitials(name, username) {
  const source = name || username || '';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdminCreators() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('latest');
  const [refreshing, setRefreshing] = useState(false);

  const fetchCreators = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const token = localStorage.getItem('tikcash_token') || '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(apiUrl('/api/creators'), { headers, withCredentials: true });
      setCreators(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load creators', err);
      setError('Unable to load creators. Please try again.');
      setCreators([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCreators(); }, [fetchCreators]);

  const stats = useMemo(() => {
    if (!creators.length) return { total: 0, active: 0, earnings: 0, balance: 0 };
    let active = 0;
    let earnings = 0;
    let balance = 0;
    creators.forEach((creator) => {
      const lastActive = new Date(creator.updated_at || creator.created_at || 0).getTime();
      if (!Number.isNaN(lastActive) && Date.now() - lastActive <= ACTIVE_WINDOW_MS) active += 1;
      earnings += Number(creator.total_earnings || 0);
      balance += Number(creator.available_balance || 0);
    });
    return { total: creators.length, active, earnings, balance };
  }, [creators]);

  const visibleCreators = useMemo(() => {
    const term = search.trim().toLowerCase();
    const next = creators.filter((creator) => {
      const sameCategory = category === 'all' || (creator.category || 'other') === category;
      if (!sameCategory) return false;
      if (!term) return true;
      return ['display_name', 'tiktok_username', 'bio'].some((key) => {
        const value = creator[key];
        return value && value.toLowerCase().includes(term);
      });
    });

    next.sort((a, b) => {
      if (sort === 'active') {
        const aLast = new Date(a.updated_at || a.created_at || 0).getTime();
        const bLast = new Date(b.updated_at || b.created_at || 0).getTime();
        return (bLast || 0) - (aLast || 0);
      }
      if (sort === 'earnings') {
        return Number(b.total_earnings || 0) - Number(a.total_earnings || 0);
      }
      if (sort === 'balance') {
        return Number(b.available_balance || 0) - Number(a.available_balance || 0);
      }
      // latest
      const aCreated = new Date(a.created_at || 0).getTime();
      const bCreated = new Date(b.created_at || 0).getTime();
      return (bCreated || 0) - (aCreated || 0);
    });

    return next;
  }, [creators, category, search, sort]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-4 flex flex-wrap justify-end gap-3">
        <NavLink to="/admin/platform-earnings" className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md hover:brightness-110">Platform earnings</NavLink>
        <NavLink to="/admin/support-tickets" className="px-3 py-1.5 rounded-lg bg-pink-600 text-white shadow-md hover:brightness-110">Support Tickets</NavLink>
      </div>

      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Creator Directory</h1>
        <div className="bg-white shadow-sm rounded-xl p-2 max-w-2xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <NavLink to="/admin" end className={({ isActive }) => `px-3 py-2 text-sm font-medium text-center rounded-lg transition ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>Pending</NavLink>
            <NavLink to="/admin/approved" className={({ isActive }) => `px-3 py-2 text-sm font-medium text-center rounded-lg transition ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>Approved</NavLink>
            <NavLink to="/admin/declined" className={({ isActive }) => `px-3 py-2 text-sm font-medium text-center rounded-lg transition ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>Declined</NavLink>
            <NavLink to="/admin/creators" className={({ isActive }) => `px-3 py-2 text-sm font-medium text-center rounded-lg transition ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>Creators</NavLink>
          </div>
        </div>
        <p className="mt-3 text-gray-500 text-sm">Stay on top of every creator profile, their earnings, balances, and recent activity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">Creators <Users2 className="w-4 h-4 text-blue-500" /></div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">on the platform</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">Active (7d) <Activity className="w-4 h-4 text-emerald-500" /></div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{stats.active}</div>
          <div className="text-sm text-gray-500">recently updated</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">Total earnings</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(stats.earnings)}</div>
          <div className="text-sm text-gray-500">all-time</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">Available balance</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(stats.balance)}</div>
          <div className="text-sm text-gray-500">ready to withdraw</div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-gray-700">
            <span className="block mb-1 font-medium">Search creators</span>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, username, bio"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </label>
          <label className="text-sm text-gray-700">
            <span className="block mb-1 font-medium">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            <span className="block mb-1 font-medium">Sort by</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="latest">Recently joined</option>
              <option value="active">Last active</option>
              <option value="earnings">Top earners</option>
              <option value="balance">Highest balance</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={fetchCreators}
              className="inline-flex items-center justify-center gap-2 w-full md:w-auto px-4 py-2 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh data
            </button>
          </div>
        </div>
        <div className="mt-3 text-sm text-gray-500">Showing <span className="font-semibold text-gray-700">{visibleCreators.length}</span> of {creators.length} creators</div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Loading creators...</div>
      ) : error ? (
        <div className="text-center text-red-500">{error}</div>
      ) : visibleCreators.length === 0 ? (
        <div className="text-center text-gray-500">No creators match your filters yet.</div>
      ) : (
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {visibleCreators.map((creator) => {
            const lastActive = creator.updated_at || creator.created_at;
            const isActive = (() => {
              const ts = new Date(lastActive || 0).getTime();
              if (Number.isNaN(ts)) return false;
              return Date.now() - ts <= ACTIVE_WINDOW_MS;
            })();
            const badgeClasses = isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-gray-50 text-gray-500 border border-gray-100';
            return (
              <article key={creator.id || creator.tiktok_username} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-14 w-14">
                    {creator.profile_image ? (
                      <img
                        src={creator.profile_image}
                        alt={creator.display_name || creator.tiktok_username}
                        className="h-14 w-14 rounded-full object-cover border border-gray-100"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('[data-avatar-fallback]');
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                        loading="lazy"
                      />
                    ) : null}
                    <div
                      data-avatar-fallback
                      className={`absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-lg font-semibold ${creator.profile_image ? 'hidden' : ''}`}
                    >
                      {getInitials(creator.display_name, creator.tiktok_username)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900 truncate">{creator.display_name || creator.tiktok_username}</h2>
                      {creator.is_verified ? <BadgeCheck className="w-4 h-4 text-blue-600" /> : null}
                    </div>
                    <p className="text-sm text-gray-500">@{creator.tiktok_username || 'unknown'}</p>
                    <div className="mt-1 inline-flex items-center gap-2 text-xs text-gray-500">
                      <span className="capitalize px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{creator.category || 'other'}</span>
                      {creator.follower_count ? (
                        <span>{numberFormatter.format(Number(creator.follower_count))} followers</span>
                      ) : null}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClasses}`}>{isActive ? 'Active' : 'Idle'}</span>
                </div>

                {creator.bio ? (
                  <p className="text-sm text-gray-600 line-clamp-3">{creator.bio}</p>
                ) : (
                  <p className="text-sm text-gray-400">No bio yet.</p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-xl bg-gray-50">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Total earnings</p>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(Number(creator.total_earnings || 0))}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Available balance</p>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(Number(creator.available_balance || 0))}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Last active</p>
                    <p className="text-sm font-semibold text-gray-900">{formatRelative(lastActive)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Joined</p>
                    <p className="text-sm font-semibold text-gray-900">{formatDate(creator.created_at)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  {creator.phone_number ? (
                    <span className="px-3 py-1 rounded-full bg-gray-100">{creator.phone_number}</span>
                  ) : null}
                  {creator.preferred_payment_method ? (
                    <span className="px-3 py-1 rounded-full bg-gray-100 capitalize">{creator.preferred_payment_method}</span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100">
                    <CalendarDays className="w-3 h-3" />
                    Joined {formatDate(creator.created_at)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
