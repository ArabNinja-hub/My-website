// =============================================
// STUDYCORE — Student Dashboard Module (js/dashboard.js)
// By Dr. Relentless | Stay Curious & Winning
// -----------------------------------------------
// Runs only on views/dashboard.html, which the server refuses to send to
// anyone who isn't logged in (see middleware/auth.js - requirePageAuth).
// =============================================

function renderAccessNotice(user) {
  const target = document.getElementById('accessNotice');
  if (!target) return;
  const status = user.subscriptionStatus || {};
  if (status.active && user.subscription === 'premium') {
    target.innerHTML = `<div class="access-banner premium">⭐ Premium active - all resources are unlocked.</div>`;
  } else if (!status.active && !status.inTrial) {
    target.innerHTML = `<div class="access-banner locked">Your free trial has ended. Subscribe below to keep learning.</div>`;
  } else {
    const daysLeft = status.trialEnd ? Math.max(0, Math.ceil((new Date(status.trialEnd).getTime() - Date.now()) / 86400000)) : 0;
    target.innerHTML = `<div class="access-banner info">Your free trial is active. ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.</div>`;
  }
}

function renderSummary(user) {
  const target = document.getElementById('studentSummary');
  target.innerHTML = `
    <div class="info-card"><h3>Welcome</h3><p>${escapeHtml(user.name.split(' ')[0])}</p></div>
    <div class="info-card"><h3>Subscription</h3><p>${user.subscription === 'premium' ? 'Premium' : 'Free trial'}</p></div>
    <div class="info-card"><h3>Trial ends</h3><p>${user.trial_end ? new Date(user.trial_end).toLocaleDateString() : '-'}</p></div>
  `;
}

function fillProfileForm(user) {
  document.getElementById('profileName').value = user.name || '';
  document.getElementById('profileSchool').value = user.school || '';
  document.getElementById('profileGrade').value = user.grade || '';
  document.getElementById('profileLevel').value = user.learning_level || 'secondary';
}

function renderSubscriptionArea(user) {
  const target = document.getElementById('subscriptionArea');
  if (user.subscription === 'premium') {
    target.innerHTML = `
      <h3>Subscription</h3>
      <p>⭐ You have an active Premium subscription${user.subscription_end ? ` until ${new Date(user.subscription_end).toLocaleDateString()}` : ''}.</p>
    `;
    return;
  }
  target.innerHTML = `
    <h3>Subscribe</h3>
    <p>Pay K50 for 30 days of full access via mobile money.</p>
    <div class="form-group"><label for="phone">Phone number</label><input id="phone" placeholder="e.g. 0977 123 456" /></div>
    <div class="form-group">
      <label for="method">Payment method</label>
      <select id="method">
        <option value="MTN MoMo">MTN Mobile Money</option>
        <option value="Airtel Money">Airtel Money</option>
      </select>
    </div>
    <button class="btn btn-primary" id="subscribeBtn">Subscribe</button>
    <p style="font-size:0.75rem;opacity:0.7;margin-top:8px;">This sends a simulated mobile-money confirmation. Wiring a real MTN/Airtel merchant account is the one remaining step before this goes fully live - see README.md.</p>
  `;
  document.getElementById('subscribeBtn').addEventListener('click', async () => {
    const phone = document.getElementById('phone').value.trim();
    const method = document.getElementById('method').value;
    if (!phone) return showToast('Enter your phone number first.', 'error');
    try {
      const data = await StudyCoreAPI.subscribe({ phone, method });
      showToast(data.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadBookmarks() {
  const grid = document.getElementById('bookmarkCards');
  try {
    const { resources } = await StudyCoreAPI.myBookmarks();
    if (!resources.length) {
      grid.innerHTML = '<div class="info-card"><p>No bookmarks yet - star a resource to save it here.</p></div>';
      return;
    }
    const bookmarkedIds = new Set(resources.map((r) => r.id));
    grid.innerHTML = resources.map((r) => resourceCard(r, bookmarkedIds)).join('');
    bindCardInteractions(grid);
  } catch (err) {
    grid.innerHTML = `<p>${err.message}</p>`;
  }
}

async function loadRecent() {
  const grid = document.getElementById('recentCards');
  try {
    const { resources } = await StudyCoreAPI.listResources({ sort: 'newest', pageSize: 8 });
    if (!resources.length) {
      grid.innerHTML = '<div class="info-card"><p>Nothing published yet - check back soon.</p></div>';
      return;
    }
    let bookmarkedIds = new Set();
    try {
      const bm = await StudyCoreAPI.myBookmarks();
      bookmarkedIds = new Set(bm.resources.map((r) => r.id));
    } catch { /* ignore */ }
    grid.innerHTML = resources.map((r) => resourceCard(r, bookmarkedIds)).join('');
    bindCardInteractions(grid);
  } catch (err) {
    if (err.locked) {
      grid.innerHTML = `<div class="info-card"><p>${err.message}</p></div>`;
    } else {
      grid.innerHTML = `<p>${err.message}</p>`;
    }
  }
}

async function initDashboard() {
  const user = await StudyCoreAuth.fetchSession();
  StudyCoreAuth.updateAuthUI();
  if (!user) { window.location.href = '/login.html'; return; }

  renderAccessNotice(user);
  renderSummary(user);
  fillProfileForm(user);
  renderSubscriptionArea(user);
  loadBookmarks();
  loadRecent();

  document.getElementById('logoutBtn').addEventListener('click', StudyCoreAuth.logoutUser);

  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await StudyCoreAPI.updateProfile({
        name: document.getElementById('profileName').value.trim(),
        school: document.getElementById('profileSchool').value.trim(),
        grade: document.getElementById('profileGrade').value.trim(),
        learningLevel: document.getElementById('profileLevel').value
      });
      showToast('Profile updated.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    try {
      await StudyCoreAPI.changePassword({ currentPassword, newPassword });
      showToast('Password updated.', 'success');
      e.target.reset();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', initDashboard);
