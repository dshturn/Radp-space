// js/core/realtime.js — Supabase Realtime subscriptions (replaces polling)

let supabaseClient = null;
let channels = new Map();

function initRealtime() {
  if (supabaseClient || typeof supabase === 'undefined') return;

  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

function subscribeToNotifications(contractorId, callback) {
  if (!supabaseClient) initRealtime();
  if (!supabaseClient) return;

  const channel = supabaseClient
    .channel(`notifications:${contractorId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `contractor_id=eq.${contractorId}`
    }, payload => {
      callback(payload.new);
    })
    .subscribe();

  channels.set('notifications', channel);
  return channel;
}

function subscribeToTable(table, contractorId, callback) {
  if (!supabaseClient) initRealtime();
  if (!supabaseClient) return;

  const channel = supabaseClient
    .channel(`${table}:${contractorId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: table,
      filter: `contractor_id=eq.${contractorId}`
    }, (payload) => {
      callback(payload.eventType, payload.new, payload.old);
    })
    .subscribe();

  channels.set(table, channel);
  return channel;
}

function unsubscribeAll() {
  channels.forEach(channel => {
    if (channel && typeof channel.unsubscribe === 'function') {
      channel.unsubscribe();
    }
  });
  channels.clear();
}

function startRealtime() {
  const user = state.getUser();
  if (!user?.id) return;

  initRealtime();
  if (!supabaseClient) return;

  // Subscribe to notifications
  subscribeToNotifications(user.id, (notification) => {
    showToast(notification.entity_label || 'New notification', 'info');
    updateNotifBadge();
  });
}

function stopRealtime() {
  unsubscribeAll();
}

// Update notification badge
function updateNotifBadge() {
  const user = state.getUser();
  if (!user) return;

  const badge = document.getElementById('notifBadge');
  if (badge) {
    badge.textContent = '!';
    badge.style.display = 'block';
  }
}
