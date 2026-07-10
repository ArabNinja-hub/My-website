// =============================================
// STUDYCORE — Session & Nav Module (js/auth.js)
// By Dr. Relentless | Stay Curious & Winning
// -----------------------------------------------
// Role is decided ONLY by the server (see middleware/auth.js -
// requireAuth always re-reads the role from the users table, never trusts
// the JWT payload alone). This file just asks the server "who am I?" via
// GET /api/auth/me and renders the nav / redirects accordingly. It cannot
// grant anyone admin access - it can only reflect what the server says.
// =============================================

(function (global) {
  'use strict';

  let cachedUser = null;
  let sessionChecked = false;

  function isAdmin(user) {
    return !!user && user.role === 'ADMIN';
  }

  // All app pages live at the site root when served (index.html, login.html,
  // signup.html) or are gated view routes (dashboard.html, admin.html) - both
  // are always reachable at the root path regardless of how deeply nested the
  // current page is (e.g. /pages/subjects/mathematics.html). Absolute paths
  // avoid the class of bug where a relative link resolves against the wrong
  // directory depth.
  function getPageLink(fileName) {
    return fileName === 'index.html' ? '/' : `/${fileName}`;
  }

  function getDashboardPage(user) {
    return isAdmin(user) ? getPageLink('admin.html') : getPageLink('dashboard.html');
  }

  async function fetchSession() {
    try {
      const data = await StudyCoreAPI.me();
      cachedUser = data.user;
    } catch {
      cachedUser = null;
    }
    sessionChecked = true;
    return cachedUser;
  }

  function getCurrentUser() {
    return cachedUser;
  }

  function applyTheme(theme) {
    const resolved = theme || localStorage.getItem('studycore_theme') || 'light';
    document.body.dataset.theme = resolved;
    localStorage.setItem('studycore_theme', resolved);
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.textContent = resolved === 'dark' ? '☀️' : '🌙';
  }

  async function logoutUser() {
    try { await StudyCoreAPI.logout(); } catch { /* ignore network errors on logout */ }
    cachedUser = null;
    window.location.href = getPageLink('index.html');
  }

  function updateAuthUI() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    const themeControl = document.createElement('button');
    themeControl.id = 'themeToggle';
    themeControl.className = 'btn btn-outline btn-sm';
    themeControl.type = 'button';
    themeControl.setAttribute('aria-label', 'Toggle theme');
    themeControl.addEventListener('click', () => {
      applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    navActions.innerHTML = '';
    navActions.appendChild(themeControl);

    if (cachedUser) {
      const dashboardLink = isAdmin(cachedUser)
        ? `<a class="btn btn-outline btn-sm" href="${getPageLink('admin.html')}">Admin Dashboard</a>`
        : `<a class="btn btn-outline btn-sm" href="${getPageLink('dashboard.html')}">Dashboard</a>`;
      navActions.insertAdjacentHTML('beforeend', `
        ${dashboardLink}
        <button id="logoutBtn" class="btn btn-primary btn-sm" type="button">Log Out</button>
      `);
      document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);
    } else {
      navActions.insertAdjacentHTML('beforeend', `
        <a class="btn btn-outline btn-sm" href="${getPageLink('login.html')}">Log In</a>
        <a class="btn btn-primary btn-sm" href="${getPageLink('signup.html')}">Get Started</a>
      `);
    }

    applyTheme();
  }

  function showToast(message, type = 'info') {
    let container = document.getElementById('scToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'scToastContainer';
      container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:340px;';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const colors = { success: '#1A9E8F', error: '#D64545', info: '#1A3A5C' };
    toast.textContent = message;
    toast.style.cssText = `background:${colors[type] || colors.info};color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-size:0.9rem;font-weight:500;animation:sc-toast-in 0.25s ease;`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  if (!document.getElementById('scToastStyle')) {
    const style = document.createElement('style');
    style.id = 'scToastStyle';
    style.textContent = '@keyframes sc-toast-in { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
    document.head.appendChild(style);
  }

  global.StudyCoreAuth = {
    isAdmin,
    getPageLink,
    getDashboardPage,
    fetchSession,
    getCurrentUser,
    updateAuthUI,
    logoutUser,
    applyTheme,
    showToast,
    get sessionChecked() { return sessionChecked; }
  };

  global.showToast = showToast; // convenience global used by page scripts
})(window);
