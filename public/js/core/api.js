// js/core/api.js — Supabase REST API wrapper with caching & error handling

const apiCache = new Map();
const CACHE_TTL = 60000; // 1 minute default
const offlineQueue = [];

function getAuthHeaders() {
  const token = state.getToken();
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token || SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function apiGet(table, options = {}) {
  const { filters = [], select = '*', cache = true, ttl = CACHE_TTL } = options;

  try {
    const query = filters
      .map(f => `${f.column}=${f.operator}.${encodeURIComponent(f.value)}`)
      .join('&');

    const url = `${SUPABASE_URL}/rest/v1/${table}?${query ? query + '&' : ''}select=${select}`;

    // Check cache
    if (cache) {
      const cached = apiCache.get(url);
      if (cached && Date.now() - cached.time < ttl) {
        return cached.data;
      }
    }

    const res = await fetch(url, { headers: getAuthHeaders() });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const data = await res.json();

    if (cache) {
      apiCache.set(url, { data, time: Date.now() });
    }

    return data;
  } catch (err) {
    console.error(`API GET ${table} error:`, err);
    showToast(`Error loading ${table}: ${err.message}`, 'error');
    throw err;
  }
}

async function apiPost(table, data, options = {}) {
  const { returnData = false } = options;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Prefer': returnData ? 'return=representation' : 'return=minimal'
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const result = returnData ? await res.json() : null;

    // Invalidate cache for this table
    clearCache(table);

    return result;
  } catch (err) {
    console.error(`API POST ${table} error:`, err);
    showToast(`Error creating ${table}: ${err.message}`, 'error');
    throw err;
  }
}

async function apiPatch(table, id, data) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    // Invalidate cache
    clearCache(table);
  } catch (err) {
    console.error(`API PATCH ${table} error:`, err);
    showToast(`Error updating ${table}: ${err.message}`, 'error');
    throw err;
  }
}

async function apiDelete(table, id) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    // Invalidate cache
    clearCache(table);
  } catch (err) {
    console.error(`API DELETE ${table} error:`, err);
    showToast(`Error deleting ${table}: ${err.message}`, 'error');
    throw err;
  }
}

function clearCache(table) {
  for (const [key] of apiCache) {
    if (key.includes(`/rest/v1/${table}`)) {
      apiCache.delete(key);
    }
  }
}

// ═════════════════════════════════════════════════════════════
// Offline Queue for unreliable connections
// ═════════════════════════════════════════════════════════════

function queueOperation(table, action, data) {
  offlineQueue.push({
    id: Date.now(),
    table,
    action, // 'create' | 'update' | 'delete'
    data,
    timestamp: Date.now(),
    retries: 0
  });

  localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
  showToast('Saved offline. Will sync when online.', 'warn');
}

async function syncOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
  if (queue.length === 0) return;

  let synced = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const op = queue[i];
    try {
      if (op.action === 'create') await apiPost(op.table, op.data);
      else if (op.action === 'update') await apiPatch(op.table, op.data.id, op.data);
      else if (op.action === 'delete') await apiDelete(op.table, op.data.id);

      synced++;
      queue.splice(i, 1);
      i--;
    } catch (err) {
      failed++;
      op.retries = (op.retries || 0) + 1;
      if (op.retries > 3) {
        queue.splice(i, 1);
        i--;
      }
    }
  }

  localStorage.setItem('offlineQueue', JSON.stringify(queue));

  if (synced > 0) {
    showToast(`Synced ${synced} offline changes`, 'success');
  }
  if (failed > 0) {
    showToast(`${failed} changes failed to sync`, 'error');
  }
}

// Detect online/offline
window.addEventListener('online', syncOfflineQueue);
window.addEventListener('offline', () => {
  showToast('You are offline. Changes will sync when online.', 'warn');
});

// Sync on startup if online
if (navigator.onLine) {
  setTimeout(syncOfflineQueue, 2000);
}
