// js/core/state.js — Global state management

const state = {
  user: null,
  token: null,
  currentPage: null,

  init() {
    this.token = localStorage.getItem('radp_token');
    const userStr = localStorage.getItem('radp_user');
    this.user = userStr ? JSON.parse(userStr) : null;
  },

  setUser(user, token) {
    this.user = user;
    this.token = token;
    localStorage.setItem('radp_token', token);
    localStorage.setItem('radp_user', JSON.stringify(user));
  },

  clearUser() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('radp_token');
    localStorage.removeItem('radp_user');
  },

  getToken() { return this.token; },
  getUser() { return this.user; },
  roleOf() { return this.user?.role || 'contractor'; }
};

state.init();
