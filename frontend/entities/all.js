// Tiny in-memory event bus for real-time-like updates in this SPA
const Bus = (() => {
  const listeners = new Map();
  return {
    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(cb);
      return () => listeners.get(event)?.delete(cb);
    },
    emit(event, payload) {
      (listeners.get(event) || []).forEach((cb) => {
        try { cb(payload); } catch {}
      });
    }
  };
})();

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? import.meta.env.VITE_API_URL
  : ((typeof window !== 'undefined' && window.__API_BASE__) || 'http://localhost:5000');

// Persistent BroadcastChannel for cross-tab events
let bc;
try { bc = new BroadcastChannel('tikcash-events'); } catch { bc = null; }

function getAuthHeaders() {
  try {
    const t = localStorage.getItem('tikcash_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

async function fetchJson(path, options) {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      ...options,
    });
    
    if (res.status === 503) {
      // Service temporarily unavailable - database offline
      const errorData = await res.json().catch(() => ({}));
      const error = new Error('SERVICE_TEMPORARILY_UNAVAILABLE');
      error.status = 503;
      error.retryAfter = errorData.retryAfter || 30;
      error.isTemporary = true;
      throw error;
    }
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Network error (no internet, server down, etc.)
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const networkError = new Error('NETWORK_ERROR');
      networkError.isNetworkError = true;
      networkError.isTemporary = true;
      throw networkError;
    }
    throw err;
  }
}

function sortByField(items, field) {
  if (!field) return items;
  const desc = field.startsWith("-");
  const key = desc ? field.slice(1) : field;
  return [...items].sort((a, b) => {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    return desc ? (bv - av) : (av - bv);
  });
}

export const Creator = {
  async list(sortField = "-total_earnings") {
    const qs = new URLSearchParams();
    if (sortField) qs.set('sort', sortField);
    const list = await fetchJson(`/api/creators?${qs.toString()}`);
    return list;
  },
  async filter(criteria = {}, sortField = null, limit = null) {
    const qs = new URLSearchParams();
    if (sortField) qs.set('sort', sortField);
    if (criteria.category) qs.set('category', criteria.category);
    if (criteria.created_by) qs.set('created_by', criteria.created_by);
    if (criteria.search) qs.set('search', criteria.search);
    const list = await fetchJson(`/api/creators?${qs.toString()}`);
    return limit ? list.slice(0, limit) : list;
  },
  async search(q, { page = 1, limit = 10 } = {}) {
    const qs = new URLSearchParams();
    if (q != null) qs.set('q', String(q));
    qs.set('page', String(page));
    qs.set('limit', String(limit));
    // Returns { data, page, pageSize, hasMore }
    return await fetchJson(`/api/creators/search?${qs.toString()}`);
  },
  async create(data) {
    return await fetchJson(`/api/creators`, { method: 'POST', body: JSON.stringify(data) });
  },
  async update(id, patch) {
    return await fetchJson(`/api/creators/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  },
  async get(id) {
    return await fetchJson(`/api/creators/${id}`);
  }
};

export const Transaction = {
  async filter(criteria = {}, sortField = null, limit = null) {
    if (criteria.creator_id) {
      const qs = new URLSearchParams();
      if (limit) qs.set('limit', String(limit)); // allow 'all'
      const list = await fetchJson(`/api/creators/${criteria.creator_id}/transactions?${qs.toString()}`);
      let out = list;
      if (sortField) out = sortByField(out, sortField);
      return out;
    }
    return [];
  },
  async create(data) {
    const created = await fetchJson(`/api/transactions`, { method: 'POST', body: JSON.stringify(data) });
    if (created.transaction_type === "tip") {
      Bus.emit("transaction:tip", created);
      try {
        if (bc) bc.postMessage({ type: "transaction:tip", payload: created });
      } catch {}
      // Fallback: trigger storage event so other tabs can pick it up
      try {
        localStorage.setItem('tikcash:last_tip', JSON.stringify({ ts: Date.now(), tip: created }));
      } catch {}
    }
    return created;
  }
};

export const User = {
  async me() {
    try {
      const r = await fetchJson('/api/auth/me');
      return r.user;
    } catch (e) {
      const msg = (e && e.message) || '';
      if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) return null;
      return null; // treat other failures as unauthenticated for guard simplicity
    }
  },
  async myCreators({ page = 1, limit = 24 } = {}) {
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(limit));
    // Returns { data, page, pageSize, hasMore }
    return await fetchJson(`/api/me/creators?${qs.toString()}`);
  },
  async register(payload) {
    // Send full payload so creator fields reach the backend for auto-creation
    const r = await fetchJson('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    try { localStorage.setItem('tikcash_token', r.token); } catch {}
    return r.user;
  },
  async login({ email, password }) {
    const r = await fetchJson('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    try { localStorage.setItem('tikcash_token', r.token); } catch {}
    return r.user;
  },
  async requestVerify(email) {
    await fetchJson('/api/auth/request-verify', { method: 'POST', body: JSON.stringify({ email }) });
    return true;
  },
  async verify({ email, code }) {
    await fetchJson('/api/auth/verify', { method: 'POST', body: JSON.stringify({ email, code }) });
    return true;
  },
  logout() {
    try { localStorage.removeItem('tikcash_token'); } catch {}
  }
};

export const Password = {
  async resetWithPin({ email, pin, new_password }) {
    return await fetchJson('/api/auth/reset-with-pin', { method: 'POST', body: JSON.stringify({ email, pin, new_password }) });
  }
};

export const RealtimeBus = Bus;
