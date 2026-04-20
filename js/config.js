// ═══════════════════ CONFIGURATION ═══════════════════
// Environment-aware configuration loading
// SUPABASE_KEY and SUPABASE_URL are externalized to prevent hardcoding credentials in source

const CONFIG = {
  // In development: loaded from window.SUPABASE_CONFIG (set via inline script in HTML)
  // In production: loaded from environment variables via server
  SUPABASE_URL: window.SUPABASE_CONFIG?.url || '',
  SUPABASE_KEY: window.SUPABASE_CONFIG?.key || '',

  validate() {
    if (!this.SUPABASE_URL || !this.SUPABASE_KEY) {
      console.error('CRITICAL: Supabase configuration not loaded. Check HTML initialization.');
      return false;
    }
    return true;
  }
};

// Validate on load
if (!CONFIG.validate()) {
  // Fail gracefully—prevent app from running with missing credentials
  document.body.innerHTML = '<h1 style="color:red;margin:20px">Configuration Error: Unable to load Supabase credentials. Contact administrator.</h1>';
}
