// =============================================
// STUDYCORE v2.0 — Main JavaScript
// By Dr. Relentless | Stay Curious & Winning
// AI Tutor: Arab
// =============================================

const STORAGE_KEYS = {
  users: 'studycore_users',
  currentUser: 'studycore_current_user',
  theme: 'studycore_theme',
  rememberedLogin: 'studycore_remembered_login'
};

const DEFAULT_ANNOUNCEMENTS = [
  { id: 'a1', title: 'New study packs released', detail: 'Fresh revision guides and practice material are now available for mathematics and science.', createdAt: '2026-07-02T09:00:00.000Z' },
  { id: 'a2', title: 'Live learning update', detail: 'New lesson videos and subject pages have been added for faster navigation.', createdAt: '2026-07-01T09:00:00.000Z' },
  { id: 'a3', title: 'Student portal refresh', detail: 'The student dashboard now includes reminders, saved resources, and progress tracking.', createdAt: '2026-06-28T09:00:00.000Z' }
];

const DEFAULT_ASSIGNMENTS = [
  { id: 'm1', title: 'Algebra practice set', subject: 'Mathematics', due: 'Tomorrow', description: 'Solve a set of quadratic equations and graph the solutions.' },
  { id: 'p1', title: 'Physics investigation worksheet', subject: 'Physics', due: 'Friday', description: 'Complete the motion and energy worksheet with worked answers.' },
  { id: 'c1', title: 'Chemistry reaction review', subject: 'Chemistry', due: 'Next week', description: 'Explain the reaction types and balance sample equations.' }
];

const DEFAULT_QUIZZES = [
  { id: 'q1', title: 'Mathematics revision', subject: 'Mathematics', questions: [
    { prompt: 'What is the value of 7²?', options: ['49','14','21','56'], answer: 0 },
    { prompt: 'Solve 2x + 3 = 11', options: ['x = 4','x = 5','x = 6','x = 7'], answer: 1 }
  ] },
  { id: 'q2', title: 'Physics quick test', subject: 'Physics', questions: [
    { prompt: 'What does speed measure?', options: ['Distance only','Distance over time','Force over mass','Energy stored'], answer: 1 }
  ] }
];

function getStoredList(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveStoredList(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]'); }
  catch { return []; }
}

function parseLearningLevel(level) {
  return level === 'tertiary' ? 'tertiary' : 'secondary';
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    subscription: user.subscription || 'trial',
    learningLevel: parseLearningLevel(user.learningLevel),
    darkMode: Boolean(user.darkMode),
    // Role is always recomputed from email via StudyCoreAuth (js/auth.js),
    // never trusted from stored/incoming data. This self-heals any existing
    // account the moment it's saved, and makes it impossible to grant
    // admin access through anything other than logging in as the one
    // admin email. See js/auth.js for the single source of truth.
    role: StudyCoreAuth.computeRole(user.email)
  };
}

function getLearningLabel(level) {
  return parseLearningLevel(level) === 'tertiary' ? 'Tertiary' : 'Secondary';
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.currentUser) || 'null'); }
  catch { return null; }
}

function setCurrentUser(user) {
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
}

function getRememberedLogin() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.rememberedLogin) || 'null'); }
  catch { return null; }
}

function setRememberedLogin(email) {
  if (!email) return;
  localStorage.setItem(STORAGE_KEYS.rememberedLogin, JSON.stringify({ email: email.toLowerCase() }));
}

function clearRememberedLogin() {
  localStorage.removeItem(STORAGE_KEYS.rememberedLogin);
}

function persistUser(user) {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) return null;
  const users = getUsers();
  const index = users.findIndex(item => item.id === normalizedUser.id || item.email?.toLowerCase() === normalizedUser.email?.toLowerCase());
  if (index >= 0) {
    users[index] = { ...users[index], ...normalizedUser };
  } else {
    users.push(normalizedUser);
  }
  saveUsers(users);
  setCurrentUser(normalizedUser);
  return normalizedUser;
}

function restoreSession() {
  const currentUser = getCurrentUser();
  if (currentUser) return persistUser(currentUser);
  const remembered = getRememberedLogin();
  if (!remembered?.email) return null;
  const users = getUsers();
  const user = users.find(item => item.email?.toLowerCase() === remembered.email.toLowerCase());
  if (!user) return null;
  return persistUser(user);
}

function isInPagesFolder() {
  return window.location.pathname.includes('/pages/');
}

function getPageLink(fileName) {
  if (isInPagesFolder()) {
    return fileName === 'index.html' ? '../index.html' : fileName;
  }
  return `pages/${fileName}`;
}

function isProtectedRoute(path = window.location.pathname) {
  const normalized = path.replace(/\\/g, '/');
  const publicPaths = [
    '/', '/index.html',
    '/pages/about.html',
    '/pages/contact.html',
    '/pages/pricing.html',
    '/pages/login.html',
    '/pages/signup.html'
  ];
  return !publicPaths.includes(normalized);
}

// Admin-only pages. Kept as a small explicit list (rather than a naming
// convention) so it's obvious at a glance what StudyCoreAuth.isAdmin()
// gates access to.
function isAdminRoute(path = window.location.pathname) {
  const normalized = path.replace(/\\/g, '/');
  return normalized.endsWith('/pages/admin.html');
}

function getTrialState(user) {
  if (!user) return { isActive: false, isPremium: false, daysLeft: 0, trialEnded: true };
  const now = Date.now();
  const trialEnds = new Date(user.trialEnd || Date.now()).getTime();
  const isPremium = user.subscription === 'premium';
  const trialEnded = !isPremium && now >= trialEnds;
  const daysLeft = Math.max(0, Math.ceil((trialEnds - now) / 86400000));
  return { isActive: isPremium || !trialEnded, isPremium, daysLeft, trialEnded };
}

function registerUser({ name, email, password, learningLevel = 'secondary' }) {
  const users = getUsers();
  const existing = users.find(user => user.email.toLowerCase() === email.toLowerCase());
  if (existing) return { ok: false, message: 'An account with this email already exists.' };
  const newUser = {
    id: Date.now().toString(36),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    subscription: 'trial',
    trialEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    school: 'Not set',
    grade: 'Grade 10+',
    learningLevel: parseLearningLevel(learningLevel),
    subjects: ['Mathematics', 'Science'],
    joinedAt: new Date().toISOString(),
    darkMode: false
  };
  const savedUser = persistUser(newUser);
  setRememberedLogin(savedUser.email);
  return { ok: true, user: savedUser };
}

function loginUser(email, password, remember = true) {
  const users = getUsers();
  const user = users.find(entry => entry.email.toLowerCase() === email.toLowerCase() && entry.password === password);
  if (!user) return { ok: false, message: 'Invalid email or password.' };
  const normalizedUser = persistUser(user);
  if (remember) setRememberedLogin(normalizedUser.email);
  else clearRememberedLogin();
  return { ok: true, user: normalizedUser };
}

function updateUserProfile(updates) {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  const nextUser = {
    ...currentUser,
    ...updates,
    learningLevel: parseLearningLevel(updates.learningLevel || currentUser.learningLevel || 'secondary')
  };
  return persistUser(nextUser);
}

function logoutUser() {
  clearCurrentUser();
  clearRememberedLogin();
  window.location.href = getPageLink('index.html');
}

function applyTheme(theme = localStorage.getItem(STORAGE_KEYS.theme) || 'light') {
  document.body.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function updateAuthUI() {
  const user = getCurrentUser();
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  const themeControl = document.createElement('button');
  themeControl.id = 'themeToggle';
  themeControl.className = 'btn btn-outline btn-sm';
  themeControl.type = 'button';
  themeControl.setAttribute('aria-label', 'Toggle theme');
  themeControl.addEventListener('click', () => {
    const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    const currentUser = getCurrentUser();
    if (currentUser) {
      currentUser.darkMode = nextTheme === 'dark';
      setCurrentUser(currentUser);
    }
  });

  if (user) {
    navActions.innerHTML = '';
    navActions.appendChild(themeControl);
    const dashboardLink = StudyCoreAuth.isAdmin(user)
      ? `<a class="btn btn-outline btn-sm" href="${getPageLink('admin.html')}">Admin Dashboard</a>`
      : `<a class="btn btn-outline btn-sm" href="${getPageLink('dashboard.html')}">Dashboard</a>`;
    navActions.insertAdjacentHTML('beforeend', `
      ${dashboardLink}
      <button id="logoutBtn" class="btn btn-primary btn-sm" type="button">Log Out</button>
    `);
  } else {
    navActions.innerHTML = '';
    navActions.appendChild(themeControl);
    navActions.insertAdjacentHTML('beforeend', `
      <a class="btn btn-outline btn-sm" href="${getPageLink('login.html')}">Log In</a>
      <a class="btn btn-primary btn-sm" href="${getPageLink('signup.html')}">Get Started</a>
    `);
  }

  document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);
  applyTheme(user?.darkMode ? 'dark' : (localStorage.getItem(STORAGE_KEYS.theme) || 'light'));
}

function ensureAccess() {
  const user = restoreSession() || getCurrentUser();
  const path = window.location.pathname.replace(/\\/g, '/');
  if (!user && isProtectedRoute(path)) {
    window.location.replace(getPageLink('login.html'));
    return false;
  }
  // Students (anyone who isn't the admin email) can never reach the
  // admin dashboard, no matter how they got the URL.
  if (isAdminRoute(path) && !StudyCoreAuth.isAdmin(user)) {
    window.location.replace(getPageLink(user ? 'dashboard.html' : 'login.html'));
    return false;
  }
  if (user && (path.endsWith('/login.html') || path.endsWith('/signup.html'))) {
    window.location.replace(getPageLink(StudyCoreAuth.getDashboardPage(user)));
    return false;
  }
  return true;
}

function renderAccessNotice(targetId = 'accessNotice') {
  const user = getCurrentUser();
  const target = document.getElementById(targetId);
  if (!target || !user) return;
  const { isActive, isPremium, daysLeft, trialEnded } = getTrialState(user);
  if (isPremium) {
    target.innerHTML = `<div class="access-banner premium">⭐ Premium active — all resources are unlocked.</div>`;
  } else if (trialEnded) {
    target.innerHTML = `<div class="access-banner locked">Your free trial has ended. Continue learning by subscribing to StudyCore Premium for K50 per month.</div>`;
  } else {
    target.innerHTML = `<div class="access-banner info">Your free trial is active. ${daysLeft} day${daysLeft === 1 ? '' : 's'} left to explore everything StudyCore has to offer.</div>`;
  }
}

function bindProfileForm() {
  const form = document.getElementById('profileForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const updates = {
      name: document.getElementById('profileName')?.value || '',
      email: document.getElementById('profileEmail')?.value || '',
      school: document.getElementById('profileSchool')?.value || '',
      grade: document.getElementById('profileGrade')?.value || '',
      learningLevel: document.getElementById('profileLevel')?.value || 'secondary',
      subjects: (document.getElementById('profileSubjects')?.value || '').split(',').map(item => item.trim()).filter(Boolean)
    };
    const updatedUser = updateUserProfile(updates);
    if (!updatedUser) return;
    showToast('Profile updated. Your learning path is ready.', 'success');
    const targetRoute = `${getPageLink('courses.html')}?level=${updatedUser.learningLevel}`;
    window.location.href = targetRoute;
  });
}

function renderDashboard() {
  const user = getCurrentUser();
  const container = document.getElementById('dashboardContent');
  if (!container || !user) return;
  const { isActive, isPremium, daysLeft, trialEnded } = getTrialState(user);
  const progress = isPremium ? 88 : trialEnded ? 42 : 68;
  const recentLessons = [
    { title: 'Quadratic equations', subject: 'Mathematics', progress: 'Completed' },
    { title: 'Cell structure', subject: 'Biology', progress: 'In progress' },
    { title: 'Newton’s laws', subject: 'Physics', progress: 'Saved' }
  ];
  const assignments = [
    { title: 'Chemistry revision quiz', due: 'Tomorrow' },
    { title: 'Programming exercise', due: 'Friday' }
  ];
  const announcements = getStoredList('studycore_announcements', DEFAULT_ANNOUNCEMENTS).slice(0, 2);
  const adminBanner = StudyCoreAuth.isAdmin(user) ? `
    <div class="info-card dashboard-hero" style="margin-bottom:16px;">
      <div class="dashboard-hero-copy">
        <h3>🛠️ You're signed in as the StudyCore admin</h3>
        <p>Manage videos, documents, quizzes, assignments, announcements, and users from the Admin Dashboard.</p>
      </div>
      <a class="btn btn-primary btn-sm" href="${getPageLink('admin.html')}">Open Admin Dashboard</a>
    </div>
  ` : '';

  container.innerHTML = `
    ${adminBanner}
    <div class="dashboard-grid">
      <div class="info-card dashboard-hero">
        <div class="dashboard-hero-copy">
          <h3>Welcome back, ${user.name.split(' ')[0]} 👋</h3>
          <p>${isPremium ? 'Premium access is active. Keep learning with full access to every resource.' : trialEnded ? 'Your trial has ended, but your learning journey can continue with StudyCore Premium.' : 'Your 30-day free trial is running. Explore videos, notes, and assignments while they are fully unlocked.'}</p>
        </div>
        <div class="dashboard-badges">
          <span class="dashboard-pill">${isPremium ? 'Premium' : trialEnded ? 'Trial ended' : 'Free trial'}</span>
          <span class="dashboard-pill">${trialEnded ? 'Locked content' : `${daysLeft} days left`}</span>
        </div>
      </div>
      <div class="info-card">
        <h3>👤 Student profile</h3>
        <ul class="detail-list">
          <li><strong>Name:</strong> ${user.name}</li>
          <li><strong>Email:</strong> ${user.email}</li>
          <li><strong>School:</strong> ${user.school}</li>
          <li><strong>Grade:</strong> ${user.grade}</li>
        </ul>
      </div>
      <div class="info-card">
        <h3>⚙️ Edit profile & learning level</h3>
        <form id="profileForm" class="profile-form">
          <div class="form-group">
            <label for="profileName">Full name</label>
            <input id="profileName" type="text" value="${user.name}" />
          </div>
          <div class="form-group">
            <label for="profileEmail">Email</label>
            <input id="profileEmail" type="email" value="${user.email}" />
          </div>
          <div class="form-group">
            <label for="profileSchool">School</label>
            <input id="profileSchool" type="text" value="${user.school}" />
          </div>
          <div class="form-group">
            <label for="profileGrade">Grade / year</label>
            <input id="profileGrade" type="text" value="${user.grade}" />
          </div>
          <div class="form-group">
            <label for="profileLevel">Learning level</label>
            <select id="profileLevel">
              <option value="secondary" ${user.learningLevel === 'secondary' ? 'selected' : ''}>Secondary</option>
              <option value="tertiary" ${user.learningLevel === 'tertiary' ? 'selected' : ''}>Tertiary</option>
            </select>
          </div>
          <div class="form-group">
            <label for="profileSubjects">Subjects</label>
            <input id="profileSubjects" type="text" value="${(user.subjects || []).join(', ')}" placeholder="Mathematics, Biology" />
          </div>
          <button class="btn btn-primary" type="submit">Save profile</button>
        </form>
      </div>
      <div class="info-card">
        <h3>📈 Learning progress</h3>
        <div class="progress-block">
          <div class="progress-labels"><span>Overall completion</span><span>${progress}%</span></div>
          <div class="progress-bar"><span style="width:${progress}%"></span></div>
        </div>
        <div class="progress-block">
          <div class="progress-labels"><span>Videos watched</span><span>12/20</span></div>
          <div class="progress-bar"><span style="width:60%"></span></div>
        </div>
      </div>
      <div class="info-card">
        <h3>▶ Continue learning</h3>
        <ul class="detail-list">
          ${recentLessons.map(item => `<li><strong>${item.title}</strong> — ${item.subject} · ${item.progress}</li>`).join('')}
        </ul>
      </div>
      <div class="info-card">
        <h3>📝 Upcoming assignments</h3>
        <ul class="detail-list">
          ${assignments.map(item => `<li><strong>${item.title}</strong> — due ${item.due}</li>`).join('')}
        </ul>
      </div>
      <div class="info-card">
        <h3>📢 Latest announcements</h3>
        <ul class="detail-list">
          ${announcements.map(item => `<li><strong>${item.title}</strong><br>${item.detail || item.description}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
  bindProfileForm();
}

function renderCoursePathNotice() {
  const target = document.getElementById('courseLevelNotice');
  if (!target) return;
  const params = new URLSearchParams(window.location.search);
  const user = getCurrentUser();
  const level = params.get('level') || user?.learningLevel || 'secondary';
  const label = getLearningLabel(level);
  const detail = level === 'tertiary'
    ? 'You are seeing the tertiary pathway with university-style study resources and advanced practice.'
    : 'You are seeing the secondary pathway with school-focused lessons, revision notes, and exam support.';
  target.innerHTML = `
    <div class="access-banner ${level === 'tertiary' ? 'premium' : 'info'}">
      <strong>${label} learning path</strong>
      <p>${detail}</p>
      <a class="btn btn-outline btn-sm" href="${getPageLink('dashboard.html')}">Edit profile</a>
    </div>
  `;
}

function injectGlobalSearch() {
  const target = document.querySelector('.page-hero .container, .hero-inner .hero-content');
  if (!target || document.getElementById('globalSearchForm')) return;
  const form = document.createElement('form');
  form.id = 'globalSearchForm';
  form.className = 'global-search-form';
  form.innerHTML = `
    <input id="globalSearchInput" type="search" placeholder="Search videos, notes, quizzes, assignments" />
    <button type="submit" class="btn btn-primary btn-sm">Search</button>
  `;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('globalSearchInput')?.value?.trim() || '';
    if (!value) return;
    window.location.href = `${getPageLink('search.html')}?q=${encodeURIComponent(value)}`;
  });
  target.appendChild(form);
}

function renderAnnouncements() {
  const container = document.getElementById('announcementList');
  if (!container) return;
  const announcements = getStoredList('studycore_announcements', DEFAULT_ANNOUNCEMENTS).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  container.innerHTML = announcements.map((item) => `
    <div class="info-card">
      <h3>${item.title}</h3>
      <p>${item.detail || item.description}</p>
      <span class="resource-meta">Posted ${new Date(item.createdAt).toLocaleDateString()}</span>
    </div>
  `).join('');
}

function handleAnnouncementForm() {
  const form = document.getElementById('announcementForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('announcementTitle')?.value?.trim() || '';
    const detail = document.getElementById('announcementDetail')?.value?.trim() || '';
    if (!title || !detail) { showToast('Please add both a title and a message.', 'error'); return; }
    const announcements = getStoredList('studycore_announcements', DEFAULT_ANNOUNCEMENTS);
    announcements.unshift({ id: `a-${Date.now()}`, title, detail, createdAt: new Date().toISOString() });
    saveStoredList('studycore_announcements', announcements.slice(0, 10));
    form.reset();
    renderAnnouncements();
    showToast('Announcement published.', 'success');
  });
}

function renderAssignments() {
  const container = document.getElementById('assignmentList');
  if (!container) return;
  const assignments = getStoredList('studycore_assignments', DEFAULT_ASSIGNMENTS);
  container.innerHTML = assignments.map((item) => `
    <div class="info-card">
      <h3>${item.title}</h3>
      <p>${item.description}</p>
      <div class="resource-meta">Subject: ${item.subject} • Due: ${item.due}</div>
      <a class="btn btn-outline btn-sm" href="${getPageLink('documents.html')}" style="margin-top:10px;">Open resources</a>
    </div>
  `).join('');
}

function renderQuizzes() {
  const container = document.getElementById('quizList');
  if (!container) return;
  const quizzes = getStoredList('studycore_quizzes', DEFAULT_QUIZZES);
  container.innerHTML = quizzes.map((quiz, index) => `
    <div class="info-card">
      <h3>${quiz.title}</h3>
      <p>${quiz.subject}</p>
      <button class="btn btn-primary btn-sm" type="button" data-quiz-index="${index}">Start quiz</button>
    </div>
  `).join('');
  container.querySelectorAll('[data-quiz-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const quizIndex = Number(button.dataset.quizIndex);
      const selected = quizzes[quizIndex];
      runQuiz(selected);
    });
  });
}

function runQuiz(quiz) {
  if (!quiz) return;
  const container = document.getElementById('quizList');
  if (!container) return;
  let score = 0;
  const answers = quiz.questions.map((question, index) => {
    const prompt = `${index + 1}. ${question.prompt}`;
    const options = question.options.map((option, optionIndex) => `<label><input type="radio" name="q${index}" value="${optionIndex}" /> ${option}</label>`).join('');
    return `<div class="quiz-question-card"><p>${prompt}</p>${options}</div>`;
  }).join('');
  container.innerHTML = `
    <div class="info-card">
      <h3>${quiz.title}</h3>
      <p>${quiz.subject}</p>
      <div>${answers}</div>
      <button class="btn btn-primary" type="button" id="submitQuiz">Submit quiz</button>
    </div>
  `;
  document.getElementById('submitQuiz')?.addEventListener('click', () => {
    const selectedAnswers = Array.from(container.querySelectorAll('input[type="radio"]:checked')).map((input) => Number(input.value));
    quiz.questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.answer) score += 1;
    });
    const percentage = Math.round((score / quiz.questions.length) * 100);
    container.innerHTML = `
      <div class="info-card">
        <h3>${quiz.title} complete</h3>
        <p>You scored ${score}/${quiz.questions.length} (${percentage}%).</p>
        <button class="btn btn-outline btn-sm" type="button" onclick="window.location.reload()">Try again</button>
      </div>
    `;
  });
}

function buildSearchIndex() {
  const localResources = [
    ...getStoredList('studycore_document_resources', []).map((item) => ({ type: 'Document', title: item.title, description: item.description, link: item.link || 'documents.html' })),
    ...getStoredList('studycore_video_resources', []).map((item) => ({ type: 'Video', title: item.title, description: item.description, link: item.link || 'videos.html' }))
  ];
  const assignments = getStoredList('studycore_assignments', DEFAULT_ASSIGNMENTS).map((item) => ({ type: 'Assignment', title: item.title, description: item.description, link: 'assignments.html' }));
  const quizzes = getStoredList('studycore_quizzes', DEFAULT_QUIZZES).map((item) => ({ type: 'Quiz', title: item.title, description: item.subject, link: 'quizzes.html' }));
  const announcements = getStoredList('studycore_announcements', DEFAULT_ANNOUNCEMENTS).map((item) => ({ type: 'Announcement', title: item.title, description: item.detail || item.description, link: 'announcements.html' }));
  return [...localResources, ...assignments, ...quizzes, ...announcements];
}

function renderSearchResults() {
  const container = document.getElementById('searchResults');
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  const query = (params.get('q') || '').trim().toLowerCase();
  const results = buildSearchIndex().filter((item) => !query || `${item.title} ${item.description}`.toLowerCase().includes(query));
  container.innerHTML = results.length ? results.map((item) => `
    <a class="info-card" href="${item.link}">
      <div class="resource-pill">${item.type}</div>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
    </a>
  `).join('') : '<div class="info-card"><h3>No results yet</h3><p>Try another search term.</p></div>';
}

function renderLockedContent(pageName) {
  const target = document.getElementById('accessNotice');
  if (!target) return;
  const user = getCurrentUser();
  const { isPremium, trialEnded } = getTrialState(user);
  if (!user) return;
  if (isPremium || !trialEnded) return;
  target.innerHTML = `
    <div class="access-banner locked">
      <strong>${pageName} is locked until you subscribe.</strong>
      <p>Unlock videos, documents, quizzes, and assignments with StudyCore Premium for K50 per month.</p>
      <a class="btn btn-primary btn-sm" href="${getPageLink('pricing.html')}">View subscription</a>
    </div>
  `;
}

function handleAuthForms() {
  const remembered = getRememberedLogin();
  const loginEmail = document.getElementById('loginEmail');
  if (loginEmail && remembered?.email) {
    loginEmail.value = remembered.email;
  }

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const name = document.getElementById('signupName')?.value || '';
      const email = document.getElementById('signupEmail')?.value || '';
      const password = document.getElementById('signupPassword')?.value || '';
      const learningLevel = document.getElementById('signupLevel')?.value || 'secondary';
      const result = registerUser({ name, email, password, learningLevel });
      if (!result.ok) {
        showToast(result.message, 'error');
        return;
      }
      showToast(`Welcome to StudyCore, ${result.user.name}!`, 'success');
      window.location.href = getPageLink(StudyCoreAuth.getDashboardPage(result.user));
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const email = document.getElementById('loginEmail')?.value || '';
      const password = document.getElementById('loginPassword')?.value || '';
      const remember = document.getElementById('rememberMe')?.checked || true;
      const result = loginUser(email, password, remember);
      if (!result.ok) {
        showToast(result.message, 'error');
        return;
      }
      const destination = StudyCoreAuth.getDashboardPage(result.user);
      showToast(destination === 'admin.html' ? 'Welcome back, admin.' : 'Welcome back! Your learning dashboard is ready.', 'success');
      window.location.href = getPageLink(destination);
    });
  }
}

function handleSubscriptionButton() {
  const button = document.getElementById('subscribeBtn');
  if (!button) return;
  const user = getCurrentUser();
  if (user?.subscription === 'premium') {
    button.textContent = 'Subscribed';
    button.disabled = true;
    return;
  }
  button.addEventListener('click', () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = getPageLink('login.html');
      return;
    }
    const updatedUser = persistUser({ ...currentUser, subscription: 'premium', subscribedAt: new Date().toISOString(), trialEnd: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    setRememberedLogin(updatedUser.email);
    showToast('Subscription activated — premium access is now unlocked.', 'success');
    window.location.reload();
  });
}

function enhanceHomePage() {
  const user = getCurrentUser();
  const cta = document.querySelector('.hero-actions .btn-primary');
  if (cta) {
    cta.textContent = user ? (StudyCoreAuth.isAdmin(user) ? 'Open Admin Dashboard' : 'Open Dashboard') : 'Explore Courses';
    cta.href = user ? getPageLink(StudyCoreAuth.getDashboardPage(user)) : getPageLink('courses.html');
  }
  const secondary = document.querySelector('.hero-actions .btn-outline');
  if (secondary) {
    secondary.textContent = user ? 'View Pricing' : 'About StudyCore';
    secondary.href = user ? getPageLink('pricing.html') : getPageLink('about.html');
  }
}

function initAuthSystem() {
  const user = getCurrentUser();
  if (user?.darkMode) {
    applyTheme('dark');
  } else {
    applyTheme(localStorage.getItem(STORAGE_KEYS.theme) || 'light');
  }
  updateAuthUI();
  handleAuthForms();
  handleSubscriptionButton();
  enhanceHomePage();
  renderAccessNotice('accessNotice');
  renderDashboard();
  renderCoursePathNotice();
  injectGlobalSearch();
  renderAnnouncements();
  handleAnnouncementForm();
  renderAssignments();
  renderQuizzes();
  renderSearchResults();
  renderLockedContent('Videos');
  if (window.location.pathname.includes('/videos.html')) {
    renderLockedContent('Videos');
  }
  if (window.location.pathname.includes('/documents.html')) {
    renderLockedContent('Documents');
  }
}

function getStoredResources(type) {
  try { return JSON.parse(localStorage.getItem(`studycore_${type}_resources`) || '[]'); }
  catch { return []; }
}

function saveStoredResources(type, items) {
  localStorage.setItem(`studycore_${type}_resources`, JSON.stringify(items));
}

function getSubjectPage(subject, type) {
  const normalized = (subject || '').toLowerCase();
  const map = {
    mathematics: 'subjects/mathematics.html',
    physics: 'subjects/physics.html',
    chemistry: 'subjects/chemistry.html',
    biology: 'subjects/biology.html',
    programming: 'subjects/programming.html',
    'computer science': 'subjects/programming.html',
    'computer studies': 'subjects/programming.html',
    communication: 'subjects/communication.html'
  };
  return map[normalized] || (type === 'video' ? 'videos.html' : 'documents.html');
}

function normalizeSubjectName(subject) {
  return (subject || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
}

function matchesResourceSubject(itemSubject, targetSubject) {
  const normalizedTarget = normalizeSubjectName(targetSubject);
  if (!normalizedTarget || normalizedTarget === 'general') return true;
  const normalizedItem = normalizeSubjectName(itemSubject);
  if (!normalizedItem || normalizedItem === 'general') return false;
  return normalizedItem === normalizedTarget || normalizedItem.includes(normalizedTarget) || normalizedTarget.includes(normalizedItem);
}

function isOwnerUser(user) {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  if (role === 'owner' || user.isOwner) return true;
  const email = (user.email || '').toLowerCase();
  return ['admin@studycore.com', 'drrelentless@gmail.com', 'drrelentless@studycore.com'].includes(email);
}

function shouldShowOwnerTools() {
  return isOwnerUser(getCurrentUser());
}

function getCurrentSubjectName() {
  const fromBody = document.body.dataset.subject || document.body.getAttribute('data-subject') || '';
  if (fromBody) return fromBody;
  const match = window.location.pathname.match(/subjects\/([^/]+)\.html$/i);
  return match ? match[1] : '';
}

function renderSubjectResources() {
  const subjectName = getCurrentSubjectName();
  if (!subjectName) return;
  const displayName = document.querySelector('.page-hero h1')?.textContent?.trim() || subjectName.charAt(0).toUpperCase() + subjectName.slice(1);
  const ownerTools = document.getElementById('subjectOwnerTools');
  if (ownerTools) ownerTools.style.display = shouldShowOwnerTools() ? '' : 'none';

  const documentsContainer = document.getElementById('subjectDocuments');
  const videosContainer = document.getElementById('subjectVideos');
  const assignmentsContainer = document.getElementById('subjectAssignments');
  const quizzesContainer = document.getElementById('subjectQuizzes');

  const documentItems = getStoredResources('document').filter(item => matchesResourceSubject(item.subject, displayName));
  const videoItems = getStoredResources('video').filter(item => matchesResourceSubject(item.subject, displayName));
  const assignmentItems = getStoredList('studycore_assignments', DEFAULT_ASSIGNMENTS).filter(item => matchesResourceSubject(item.subject, displayName));
  const quizItems = getStoredList('studycore_quizzes', DEFAULT_QUIZZES).filter(item => matchesResourceSubject(item.subject, displayName));

  if (documentsContainer) {
    documentsContainer.innerHTML = documentItems.length ? documentItems.map(item => `
      <a class="info-card resource-card" href="${item.link || '#'}" target="_blank" rel="noopener noreferrer">
        <h3>${item.title}</h3>
        <p>${item.description || 'Open this document from StudyCore.'}</p>
        <div class="resource-meta">${item.fileName ? `📎 ${item.fileName}` : '🔗 Open link'} • ${item.uploadedAt || 'Just added'}</div>
      </a>
    `).join('') : '<div class="info-card"><h3>No documents uploaded for this course yet</h3></div>';
  }

  if (videosContainer) {
    videosContainer.innerHTML = videoItems.length ? videoItems.map(item => `
      <a class="info-card resource-card" href="${item.link || '#'}" target="_blank" rel="noopener noreferrer">
        <h3>${item.title}</h3>
        <p>${item.description || 'Open this lesson video from StudyCore.'}</p>
        <div class="resource-meta">${item.fileName ? `📎 ${item.fileName}` : '🔗 Open link'} • ${item.uploadedAt || 'Just added'}</div>
      </a>
    `).join('') : '<div class="info-card"><h3>No videos uploaded for this course yet</h3></div>';
  }

  if (assignmentsContainer) {
    assignmentsContainer.innerHTML = assignmentItems.length ? assignmentItems.map(item => `
      <div class="info-card">
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="resource-meta">Due: ${item.due || 'Soon'}</div>
      </div>
    `).join('') : '<div class="info-card"><h3>No assignments uploaded for this course yet</h3></div>';
  }

  if (quizzesContainer) {
    quizzesContainer.innerHTML = quizItems.length ? quizItems.map(item => `
      <div class="info-card">
        <h3>${item.title}</h3>
        <p>${item.subject || displayName}</p>
        <div class="resource-meta">${item.questions?.length || 0} question${(item.questions?.length || 0) === 1 ? '' : 's'}</div>
      </div>
    `).join('') : '<div class="info-card"><h3>No quizzes uploaded for this course yet</h3></div>';
  }

  bindSubjectPageForms(displayName);
}

function bindSubjectPageForms(subjectName) {
  const assignmentForm = document.getElementById('subjectAssignmentForm');
  if (assignmentForm && assignmentForm.dataset.bound !== 'true') {
    assignmentForm.dataset.bound = 'true';
    assignmentForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = document.getElementById('subjectAssignmentTitle')?.value?.trim() || '';
      const due = document.getElementById('subjectAssignmentDue')?.value?.trim() || 'Soon';
      const description = document.getElementById('subjectAssignmentDescription')?.value?.trim() || 'New assignment added for this course.';
      if (!title) { showToast('Please add an assignment title.', 'error'); return; }
      const assignments = getStoredList('studycore_assignments', DEFAULT_ASSIGNMENTS);
      assignments.unshift({ id: `assignment-${Date.now()}`, title, subject: subjectName, due, description });
      saveStoredList('studycore_assignments', assignments);
      renderSubjectResources();
      assignmentForm.reset();
      showToast('Assignment added for this course.', 'success');
    });
  }

  const quizForm = document.getElementById('subjectQuizForm');
  if (quizForm && quizForm.dataset.bound !== 'true') {
    quizForm.dataset.bound = 'true';
    quizForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = document.getElementById('subjectQuizTitle')?.value?.trim() || '';
      const prompt = document.getElementById('subjectQuizPrompt')?.value?.trim() || '';
      const optionA = document.getElementById('subjectQuizOptionA')?.value?.trim() || '';
      const optionB = document.getElementById('subjectQuizOptionB')?.value?.trim() || '';
      const optionC = document.getElementById('subjectQuizOptionC')?.value?.trim() || '';
      const optionD = document.getElementById('subjectQuizOptionD')?.value?.trim() || '';
      const answer = Number(document.getElementById('subjectQuizAnswer')?.value || 0);
      if (!title || !prompt || !optionA || !optionB || !optionC || !optionD) { showToast('Please complete the quiz form.', 'error'); return; }
      const quizzes = getStoredList('studycore_quizzes', DEFAULT_QUIZZES);
      quizzes.unshift({ id: `quiz-${Date.now()}`, title, subject: subjectName, questions: [{ prompt, options: [optionA, optionB, optionC, optionD], answer: Math.max(0, Math.min(3, answer)) }] });
      saveStoredList('studycore_quizzes', quizzes);
      renderSubjectResources();
      quizForm.reset();
      showToast('Quiz added for this course.', 'success');
    });
  }
}

function renderResourceCards(type, containerId, formId, options = {}) {
  const container = document.getElementById(containerId);
  const form = document.getElementById(formId);
  if (!container) return;
  const filterSubject = options.subject || getUrlSubject();
  const items = getStoredResources(type).filter(item => {
    if (!filterSubject) return true;
    if (options.filter === 'past-papers') return matchesResourceSubject(item.subject, filterSubject) && isPastPaperItem(item);
    return matchesResourceSubject(item.subject, filterSubject);
  });
  if (!items.length) {
    container.innerHTML = `<div class="info-card"><h3>No ${options.label || type} uploaded yet</h3><p>Upload a new ${options.label || type} and it will appear here instantly.</p></div>`;
    if (form) {
      form.style.display = shouldShowOwnerTools() ? '' : 'none';
    }
    return;
  }
  container.innerHTML = items.map(item => `
    <a class="info-card resource-card" href="${item.link || '#'}" target="_blank" rel="noopener noreferrer">
      <div class="resource-card-top">
        <span class="resource-pill">${item.subject || 'General'}</span>
        <span class="resource-pill muted">${item.type || options.label || type}</span>
      </div>
      <h3>${item.title}</h3>
      <p>${item.description || 'Open this resource directly from StudyCore.'}</p>
      <div class="resource-meta">${item.fileName ? `📎 ${item.fileName}` : '🔗 Open link'} • ${item.uploadedAt || 'Just added'}</div>
    </a>
  `).join('');
  if (form) {
    form.style.display = shouldShowOwnerTools() ? '' : 'none';
    if (!shouldShowOwnerTools() || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = document.getElementById(options.titleId)?.value?.trim() || '';
      const description = document.getElementById(options.descriptionId)?.value?.trim() || '';
      const subject = document.getElementById(options.subjectId)?.value || 'General';
      const fileInput = document.getElementById(options.fileId);
      const file = fileInput?.files?.[0];
      if (!title) { showToast('Please add a title for this resource.', 'error'); return; }
      const link = file ? URL.createObjectURL(file) : getSubjectPage(subject, type);
      const resource = {
        id: `${type}-${Date.now()}`,
        title,
        description,
        subject,
        type: type === 'video' ? 'Video' : 'Document',
        link,
        fileName: file?.name || '',
        uploadedAt: new Date().toLocaleString()
      };
      const nextItems = [resource, ...getStoredResources(type)];
      saveStoredResources(type, nextItems);
      renderResourceCards(type, containerId, formId, options);
      form.reset();
      showToast(`${options.label || type} added and is ready to open.`, 'success');
    });
  }
}

function initResourcePages() {
  renderSubjectResources();
  if (window.location.pathname.includes('/documents.html')) {
    renderResourceCards('document', 'documentCards', 'documentUploadForm', {
      label: 'document',
      titleId: 'documentTitle',
      descriptionId: 'documentDescription',
      subjectId: 'documentSubject',
      fileId: 'documentFile',
      subject: getUrlSubject(),
      filter: new URLSearchParams(window.location.search).get('filter') || ''
    });
  }
  if (window.location.pathname.includes('/videos.html')) {
    renderResourceCards('video', 'videoCards', 'videoUploadForm', {
      label: 'video',
      titleId: 'videoTitle',
      descriptionId: 'videoDescription',
      subjectId: 'videoSubject',
      fileId: 'videoFile',
      subject: getUrlSubject()
    });
  }
  if (window.location.pathname.includes('/assignments.html')) {
    renderAssignmentsPage();
  }
  if (window.location.pathname.includes('/quizzes.html')) {
    renderQuizzesPage();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (!ensureAccess()) return;
  initAuthSystem();
  initResourcePages();
});

// ── Top bar hide on scroll ──
const topBar = document.querySelector('.top-bar');
const navbar = document.querySelector('.navbar');
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const current = window.scrollY;
  navbar.classList.toggle('scrolled', current > 60);
  lastScroll = current;
});

// ── Mobile Menu ──
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger?.addEventListener('click', () => {
  mobileMenu?.classList.toggle('open');
  const spans = hamburger.querySelectorAll('span');
  if (mobileMenu?.classList.contains('open')) {
    spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
  } else {
    spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }
});
document.querySelectorAll('.mobile-menu a').forEach(a => {
  a.addEventListener('click', () => {
    mobileMenu?.classList.remove('open');
    hamburger?.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  });
});

// ── Active nav link ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 130) current = s.id; });
  navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${current}`));
});

// ── Modal ──
function openModal(id) { document.getElementById(id)?.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); document.body.style.overflow = ''; }
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); });
window.openModal = openModal;
window.closeModal = closeModal;

// ── Toast ──
function showToast(msg, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast'; document.body.appendChild(toast); }
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type]||'✅'}</span><span>${msg}</span>`;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3500);
}
window.showToast = showToast;

// ── Document filter ──
const filterBtns = document.querySelectorAll('.filter-btn');
const docCards = document.querySelectorAll('.doc-card');
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    docCards.forEach(card => {
      const show = filter === 'all' || card.dataset.subject === filter;
      card.style.display = show ? '' : 'none';
      if (show) { card.style.animation = 'none'; requestAnimationFrame(() => { card.style.animation = 'fadeIn 0.35s ease'; }); }
    });
  });
});

// ── Level tabs ──
document.querySelectorAll('.level-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.level-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const level = tab.dataset.level;
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
      if (btn.dataset.filter === 'all') { btn.click(); }
    });
    if (level !== 'all') {
      docCards.forEach(card => {
        card.style.display = (card.dataset.level === level || !level) ? '' : 'none';
      });
    } else {
      docCards.forEach(card => { card.style.display = ''; });
    }
    showToast(`Showing ${tab.textContent.trim().split('\n')[0]} resources`, 'info');
  });
});

// ═══════════════════════════════════════════════════
// ARAB AI TUTOR — Live Anthropic API Integration
// ═══════════════════════════════════════════════════
const API_URL = "https://api.anthropic.com/v1/messages";
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
let conversationHistory = [];

const ARAB_SYSTEM = `You are Arab, a warm, brilliant, and highly knowledgeable AI study tutor for StudyCore — an educational platform for students across Africa, including secondary school students, Copperbelt University (CBU) NQ students, and university-level learners in Zambia.

Your personality:
- Friendly, patient, encouraging, and motivating
- You speak clearly and adapt to the student's level (secondary school to university)
- You celebrate correct answers and gently correct mistakes
- You use relatable African examples when explaining concepts
- You sign off sometimes with "Stay curious and winning! 🌟" (the StudyCore motto)
- Your name is Arab and you are proud of it

Your capabilities:
- Explain ANY academic subject: Mathematics, Physics, Chemistry, Biology, Computer Science, English, History, Geography, Business Studies, Economics, Engineering (for CBU/NQ), Law, Accounting, and more
- Solve problems step-by-step with clear working
- Summarise topics for exam revision
- Help with essay structure and writing
- Explain past paper questions
- Give study tips and memory techniques
- Quiz students and give feedback

For CBU NQ students, you understand:
- National Qualifications framework
- Engineering, Business, ICT, and Applied Sciences modules
- Zambia's educational context

Always be positive. Never make students feel stupid. Keep responses focused and helpful. Use **bold** for key terms. Use numbered steps for processes.`;

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(text, role) {
  const msg = document.createElement('div');
  msg.className = `msg ${role}`;
  const icon = role === 'ai' ? 'A' : '👤';
  const formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  msg.innerHTML = `
    <div class="msg-icon">${icon}</div>
    <div>
      <div class="msg-bubble">${formattedText}</div>
      <div class="msg-time">${getTime()}</div>
    </div>`;
  chatMessages?.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
  const t = document.createElement('div');
  t.className = 'msg ai'; t.id = 'typing-indicator';
  t.innerHTML = `<div class="msg-icon">A</div><div class="typing"><span></span><span></span><span></span></div>`;
  chatMessages?.appendChild(t);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function removeTyping() { document.getElementById('typing-indicator')?.remove(); }

async function sendMessage(customText) {
  const text = customText || chatInput?.value.trim();
  if (!text) return;
  if (chatInput) chatInput.value = '';
  if (chatInput) chatInput.disabled = true;
  if (chatSend) chatSend.disabled = true;
  appendMessage(text, 'user');
  conversationHistory.push({ role: 'user', content: text });
  showTyping();
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: ARAB_SYSTEM,
        messages: conversationHistory
      })
    });
    const data = await res.json();
    removeTyping();
    if (data.content?.[0]?.text) {
      const reply = data.content[0].text;
      conversationHistory.push({ role: 'assistant', content: reply });
      appendMessage(reply, 'ai');
    } else {
      appendMessage("Hmm, I had a hiccup. Try again in a moment! Stay curious 🌟", 'ai');
    }
  } catch (err) {
    removeTyping();
    appendMessage("Connection issue. Please check your internet and try again.", 'ai');
  }
  if (chatInput) chatInput.disabled = false;
  if (chatSend) chatSend.disabled = false;
  chatInput?.focus();
}
window.sendMessage = sendMessage;

chatSend?.addEventListener('click', () => sendMessage());
chatInput?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

// Quick prompts
document.querySelectorAll('.quick-prompt').forEach(btn => {
  btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
});

// ── Video Upload ──
document.querySelectorAll('.video-upload-slot').forEach(slot => {
  const input = slot.querySelector('.video-upload-input');
  slot.addEventListener('click', () => input?.click());
  slot.addEventListener('dragover', e => { e.preventDefault(); slot.style.borderColor = 'var(--teal-light)'; });
  slot.addEventListener('dragleave', () => { slot.style.borderColor = ''; });
  slot.addEventListener('drop', e => {
    e.preventDefault(); slot.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) handleVideoUpload(file, slot);
    else showToast('Please drop a video file', 'error');
  });
  input?.addEventListener('change', () => { if (input.files[0]) handleVideoUpload(input.files[0], slot); });
});

function handleVideoUpload(file, slot) {
  const url = URL.createObjectURL(file);
  const name = file.name.replace(/\.[^.]+$/, '');
  const size = (file.size / 1024 / 1024).toFixed(1);
  slot.innerHTML = `
    <div style="width:100%;position:relative;">
      <video src="${url}" style="width:100%;border-radius:10px;max-height:160px;object-fit:cover;" controls></video>
      <div style="padding:12px 0 0;">
        <div style="font-family:var(--font-display);font-weight:700;color:rgba(255,255,255,0.9);font-size:0.9rem;margin-bottom:4px;">${name}</div>
        <div style="font-size:0.78rem;color:rgba(255,255,255,0.5);">📁 ${size} MB — Ready to share with students</div>
      </div>
    </div>`;
  showToast(`✅ "${name}" uploaded successfully!`);
}

// Video player modal
document.querySelectorAll('.video-card[data-video]').forEach(card => {
  card.addEventListener('click', () => {
    const modal = document.getElementById('videoPlayerModal');
    const videoEl = document.getElementById('modalVideo');
    const src = card.dataset.video;
    if (modal && videoEl && src) {
      videoEl.src = src;
      modal.classList.add('open');
      videoEl.play?.();
    }
  });
});
document.getElementById('closeVideoModal')?.addEventListener('click', () => {
  const modal = document.getElementById('videoPlayerModal');
  const videoEl = document.getElementById('modalVideo');
  modal?.classList.remove('open');
  if (videoEl) { videoEl.pause(); videoEl.src = ''; }
});

// ── Study Timer (Pomodoro) ──
let timerInterval = null, timerSeconds = 25 * 60, timerRunning = false;
const timerDisplay = document.getElementById('timerDisplay');
const modes = { pomodoro: 25 * 60, short: 5 * 60, long: 15 * 60 };

function updateTimerDisplay() {
  if (!timerDisplay) return;
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${m}:${s}`;
}

document.querySelectorAll('.timer-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    clearInterval(timerInterval); timerRunning = false;
    timerSeconds = modes[btn.dataset.mode];
    updateTimerDisplay();
  });
});
document.getElementById('timerStart')?.addEventListener('click', () => {
  if (timerRunning) return;
  timerRunning = true;
  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval); timerRunning = false;
      showToast('⏰ Time is up! Take a break.', 'info');
      timerSeconds = 25 * 60; updateTimerDisplay();
    }
  }, 1000);
});
document.getElementById('timerPause')?.addEventListener('click', () => { clearInterval(timerInterval); timerRunning = false; });
document.getElementById('timerReset')?.addEventListener('click', () => { clearInterval(timerInterval); timerRunning = false; timerSeconds = 25 * 60; updateTimerDisplay(); });
updateTimerDisplay();

// ── Calculator ──
let calcExpr = '';
const calcDisplay = document.getElementById('calcDisplay');
function calcPress(val) {
  if (val === 'C') { calcExpr = ''; }
  else if (val === '=') {
    try { calcExpr = String(Function('"use strict"; return (' + calcExpr.replace(/×/g,'*').replace(/÷/g,'/') + ')')()).slice(0, 12); }
    catch { calcExpr = 'Error'; }
  } else if (val === '⌫') { calcExpr = calcExpr.slice(0, -1); }
  else { calcExpr += val; }
  if (calcDisplay) calcDisplay.textContent = calcExpr || '0';
}
window.calcPress = calcPress;

// ── Notes ──
const notesArea = document.getElementById('notesArea');
const savedNotes = localStorage.getItem('studycore_notes');
if (notesArea && savedNotes) notesArea.value = savedNotes;
notesArea?.addEventListener('input', () => { try { localStorage.setItem('studycore_notes', notesArea.value); } catch(e){} });
document.getElementById('saveNotes')?.addEventListener('click', () => {
  try { localStorage.setItem('studycore_notes', notesArea?.value || ''); showToast('Notes saved! 📝'); } catch(e) { showToast('Could not save notes', 'error'); }
});
document.getElementById('clearNotes')?.addEventListener('click', () => { if (notesArea) notesArea.value = ''; showToast('Notes cleared', 'info'); });
document.getElementById('copyNotes')?.addEventListener('click', () => {
  if (notesArea?.value) { navigator.clipboard?.writeText(notesArea.value).then(() => showToast('Notes copied! 📋')); }
});

// ── Quiz ──
const quizData = [
  { q: "What is the quadratic formula for ax² + bx + c = 0?", opts: ["x = (-b ± √(b²−4ac)) / 2a", "x = (b ± √(b²+4ac)) / 2a", "x = −b / 2a", "x = (b² − 4ac) / 2a"], ans: 0, subject: "Mathematics" },
  { q: "Which organelle is known as the 'powerhouse of the cell'?", opts: ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"], ans: 2, subject: "Biology" },
  { q: "What does CPU stand for in Computer Studies?", opts: ["Central Processing Unit", "Computer Power Unit", "Core Processing Unit", "Central Program Utility"], ans: 0, subject: "Computer Studies" },
  { q: "What is Newton's Second Law of Motion?", opts: ["Every action has an equal and opposite reaction", "An object at rest stays at rest", "Force equals mass times acceleration (F=ma)", "Energy cannot be created or destroyed"], ans: 2, subject: "Physics" },
  { q: "In Chemistry, what is the atomic number of Carbon?", opts: ["6", "12", "8", "4"], ans: 0, subject: "Chemistry" },
  { q: "Who was the first President of Zambia?", opts: ["Frederick Chiluba", "Kenneth Kaunda", "Levy Mwanawasa", "Michael Sata"], ans: 1, subject: "History" },
  { q: "What is the value of π (pi) to 2 decimal places?", opts: ["3.12", "3.14", "3.16", "3.18"], ans: 1, subject: "Mathematics" },
  { q: "Which literary device involves giving human qualities to non-human things?", opts: ["Simile", "Metaphor", "Personification", "Alliteration"], ans: 2, subject: "English" },
];
let quizIndex = 0, quizScore = 0, quizAnswered = false;

function loadQuiz() {
  if (quizIndex >= quizData.length) { showQuizResult(); return; }
  const q = quizData[quizIndex];
  const fill = ((quizIndex / quizData.length) * 100).toFixed(0);
  document.getElementById('quizProgressFill').style.width = fill + '%';
  document.getElementById('quizScore').textContent = `${quizIndex + 1}/${quizData.length}`;
  document.getElementById('quizSubject').textContent = q.subject;
  document.getElementById('quizQuestion').textContent = q.q;
  const opts = document.getElementById('quizOptions');
  opts.innerHTML = '';
  q.opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option'; btn.textContent = opt;
    btn.addEventListener('click', () => {
      if (quizAnswered) return;
      quizAnswered = true;
      const isCorrect = i === q.ans;
      if (isCorrect) { quizScore++; btn.classList.add('correct'); showToast('✅ Correct! Well done!'); }
      else { btn.classList.add('wrong'); opts.children[q.ans].classList.add('correct'); showToast('❌ Not quite — see the correct answer above', 'error'); }
      setTimeout(() => { quizIndex++; quizAnswered = false; loadQuiz(); }, 1800);
    });
    opts.appendChild(btn);
  });
  document.getElementById('quizContent').style.display = '';
  document.getElementById('quizResult').style.display = 'none';
}
function showQuizResult() {
  const pct = Math.round((quizScore / quizData.length) * 100);
  const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👏' : '📚';
  const msg = pct >= 80 ? 'Excellent work! You are truly curious and winning!' : pct >= 60 ? 'Good effort! Keep studying and you will master it!' : 'Keep going! Every attempt makes you stronger!';
  document.getElementById('quizContent').style.display = 'none';
  document.getElementById('quizResult').style.display = 'block';
  document.getElementById('resultEmoji').textContent = emoji;
  document.getElementById('resultScore').textContent = `${quizScore} / ${quizData.length} (${pct}%)`;
  document.getElementById('resultMsg').textContent = msg;
}
document.getElementById('restartQuiz')?.addEventListener('click', () => { quizIndex = 0; quizScore = 0; quizAnswered = false; loadQuiz(); });
loadQuiz();

// ── Forms ──
document.getElementById('signupForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const name = document.getElementById('signupName')?.value;
  closeModal('signupModal');
  showToast(`Welcome to StudyCore, ${name}! Stay curious & winning! 🌟`);
});
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  closeModal('loginModal');
  showToast('Welcome back! Let\'s get learning 📚');
});

// ── Animate on scroll ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.style.opacity = '1'; entry.target.style.transform = 'translateY(0)'; }
  });
}, { threshold: 0.08 });
document.querySelectorAll('.feature-card, .doc-card, .subject-card, .testi-card, .video-card, .tool-card').forEach(el => {
  el.style.opacity = '0'; el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// Subject filter shortcut
window.filterSubject = function(subject) {
  const btn = document.querySelector(`.filter-btn[data-filter="${subject}"]`);
  if (btn) { document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); btn.click(); }
};
