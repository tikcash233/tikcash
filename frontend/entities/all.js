// Simple in-browser data layer to support the pages during migration
const KEY_CREATORS = "tikcash_creators";
const KEY_TRANSACTIONS = "tikcash_transactions";
const KEY_USER = "tikcash_user";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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

// Seed a few creators on first run
function seedCreatorsIfEmpty() {
  const existing = load(KEY_CREATORS, []);
  if (existing.length) return existing;
  const seeded = [
    {
      id: uid(),
      tiktok_username: "kwesi_comedy",
      display_name: "Kwesi Comedy",
      bio: "Skits and laughs from GH",
      profile_image: "https://i.pravatar.cc/150?img=12",
      follower_count: 25000,
      total_earnings: 820,
      available_balance: 320,
      phone_number: "+233201234567",
      preferred_payment_method: "momo",
      is_verified: true,
      category: "comedy"
    },
    {
      id: uid(),
      tiktok_username: "ama_dance",
      display_name: "Ama Dance",
      bio: "Afrobeats choreos",
      profile_image: "https://i.pravatar.cc/150?img=32",
      follower_count: 54000,
      total_earnings: 1120,
      available_balance: 500,
      phone_number: "+233501112222",
      preferred_payment_method: "momo",
      is_verified: false,
      category: "dance"
    },
    {
      id: uid(),
      tiktok_username: "kofi_kitchen",
      display_name: "Kofi Kitchen",
      bio: "Ghanaian recipes",
      profile_image: "https://i.pravatar.cc/150?img=5",
      follower_count: 18000,
      total_earnings: 410,
      available_balance: 210,
  phone_number: "+233244556677",
  preferred_payment_method: "momo",
      is_verified: false,
      category: "food"
    }
  ];
  save(KEY_CREATORS, seeded);
  return seeded;
}

export const Creator = {
  async list(sortField = "-total_earnings") {
    const items = seedCreatorsIfEmpty();
    return sortByField(items, sortField);
  },
  async filter(criteria = {}, sortField = null, limit = null) {
    const items = load(KEY_CREATORS, seedCreatorsIfEmpty());
    let out = items.filter(it => Object.entries(criteria).every(([k, v]) => it[k] === v));
    if (sortField) out = sortByField(out, sortField);
    if (limit) out = out.slice(0, limit);
    return out;
  },
  async create(data) {
    const items = load(KEY_CREATORS, seedCreatorsIfEmpty());
    const entity = {
      id: uid(),
      total_earnings: 0,
      available_balance: 0,
      preferred_payment_method: "momo",
      is_verified: false,
      category: "other",
      follower_count: 0,
      ...data,
    };
    items.push(entity);
    save(KEY_CREATORS, items);
    return entity;
  },
  async update(id, patch) {
    const items = load(KEY_CREATORS, seedCreatorsIfEmpty());
    const idx = items.findIndex(it => it.id === id);
    if (idx === -1) throw new Error("Creator not found");
    items[idx] = { ...items[idx], ...patch };
    save(KEY_CREATORS, items);
    return items[idx];
  }
};

export const Transaction = {
  async list(sortField = "-created_date") {
    const items = load(KEY_TRANSACTIONS, []);
    return sortByField(items, sortField);
  },
  async filter(criteria = {}, sortField = null, limit = null) {
    const items = load(KEY_TRANSACTIONS, []);
    let out = items.filter(it => Object.entries(criteria).every(([k, v]) => it[k] === v));
    if (sortField) out = sortByField(out, sortField);
    if (limit) out = out.slice(0, limit);
    return out;
  },
  async create(data) {
    const items = load(KEY_TRANSACTIONS, []);
    const entity = {
      id: uid(),
      created_date: Date.now(),
      status: "pending",
      transaction_type: "tip",
      ...data,
    };
    items.push(entity);
    save(KEY_TRANSACTIONS, items);
    return entity;
  }
};

export const User = {
  async me() {
    let user = load(KEY_USER, null);
    if (!user) {
      user = { id: uid(), email: "user@example.com", name: "Demo User" };
      save(KEY_USER, user);
    }
    return user;
  }
};
