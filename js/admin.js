// =============================================
// STUDYCORE — Admin Dashboard Module (admin.js)
// By Dr. Relentless | Stay Curious & Winning
// -----------------------------------------------
// Only ever runs on pages/admin.html. Depends on js/auth.js and
// js/main.js being loaded first (for StudyCoreAuth, getStoredList,
// saveStoredList, getUsers, showToast, etc.).
//
// Route protection for this page already happens in main.js's
// ensureAccess() before this file's code has any effect — this file
// only renders/handles the page itself, it never re-decides who is
// allowed in. That decision lives in exactly one place: js/auth.js.
//
// FUTURE UPGRADE (backend migration): every "publish" handler below
// simply appends to a localStorage list. When there's a real backend,
// swap each getStoredList/saveStoredList pair for a fetch() to the
// matching POST /api/admin/... endpoint (server.js already has these
// routes implemented as a reference) and keep requireRole('ADMIN')
// enforced server-side.
// =============================================

function renderAdminSummary() {
  const target = document.getElementById('adminSummary');
  if (!target) return;
  const users = getUsers().filter((user) => !StudyCoreAuth.isAdmin(user));
  const premiumUsers = users.filter((user) => user.subscription === 'premium').length;
  const videos = getStoredList('studycore_video_resources', []).length;
  const documents = getStoredList('studycore_document_resources', []).length;
  target.innerHTML = `
    <div class="info-card"><h3>Total students</h3><p>${users.length}</p></div>
    <div class="info-card"><h3>Premium students</h3><p>${premiumUsers}</p></div>
    <div class="info-card"><h3>Videos published</h3><p>${videos}</p></div>
    <div class="info-card"><h3>Documents published</h3><p>${documents}</p></div>
  `;
}

function renderAdminUsersList() {
  const target = document.getElementById('adminUsersList');
  if (!target) return;
  const users = getUsers().filter((user) => !StudyCoreAuth.isAdmin(user));
  if (!users.length) {
    target.innerHTML = '<p>No students have signed up yet.</p>';
    return;
  }
  target.innerHTML = users.map((user) => `
    <div class="resource-meta" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color, #2a2a2a);">
      <span>${user.name} • ${user.email} • ${user.subscription}${user.trialEnd ? ` • trial ends ${new Date(user.trialEnd).toLocaleDateString()}` : ''}</span>
      <button class="btn btn-outline btn-sm" type="button" data-remove-user="${user.id}">Remove</button>
    </div>
  `).join('');
  target.querySelectorAll('[data-remove-user]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-remove-user');
      const remaining = getUsers().filter((user) => user.id !== id);
      saveUsers(remaining);
      showToast('Student account removed.', 'success');
      renderAdminUsersList();
      renderAdminSummary();
    });
  });
}

function bindAdminVideoForm() {
  const form = document.getElementById('adminVideoForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('videoTitle')?.value?.trim() || '';
    const subject = document.getElementById('videoSubject')?.value?.trim() || '';
    const description = document.getElementById('videoDescription')?.value?.trim() || '';
    const link = document.getElementById('videoLink')?.value?.trim() || 'videos.html';
    if (!title || !subject) { showToast('Title and subject are required.', 'error'); return; }
    const videos = getStoredList('studycore_video_resources', []);
    videos.unshift({ id: `video-${Date.now()}`, title, subject, description, link });
    saveStoredList('studycore_video_resources', videos);
    form.reset();
    showToast('Video published.', 'success');
    renderAdminSummary();
  });
}

function bindAdminDocumentForm() {
  const form = document.getElementById('adminDocumentForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('documentTitle')?.value?.trim() || '';
    const subject = document.getElementById('documentSubject')?.value?.trim() || '';
    const description = document.getElementById('documentDescription')?.value?.trim() || '';
    const link = document.getElementById('documentLink')?.value?.trim() || 'documents.html';
    if (!title || !subject) { showToast('Title and subject are required.', 'error'); return; }
    const documents = getStoredList('studycore_document_resources', []);
    documents.unshift({ id: `doc-${Date.now()}`, title, subject, description, link });
    saveStoredList('studycore_document_resources', documents);
    form.reset();
    showToast('Document published.', 'success');
    renderAdminSummary();
  });
}

function bindAdminQuizForm() {
  const form = document.getElementById('adminQuizForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('quizTitle')?.value?.trim() || '';
    const subject = document.getElementById('quizSubject')?.value?.trim() || '';
    const questionsRaw = document.getElementById('quizQuestions')?.value?.trim() || '';
    if (!title || !subject || !questionsRaw) { showToast('Title, subject, and questions are required.', 'error'); return; }
    let questions;
    try {
      questions = JSON.parse(questionsRaw);
      if (!Array.isArray(questions) || !questions.length) throw new Error('empty');
    } catch {
      showToast('Questions must be valid JSON, e.g. [{"prompt":"...","options":["..."],"answer":0}]', 'error');
      return;
    }
    const quizzes = getStoredList('studycore_quizzes', DEFAULT_QUIZZES);
    quizzes.unshift({ id: `quiz-${Date.now()}`, title, subject, questions });
    saveStoredList('studycore_quizzes', quizzes);
    form.reset();
    showToast('Quiz published.', 'success');
  });
}

function bindAdminAssignmentForm() {
  const form = document.getElementById('adminAssignmentForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('assignmentTitle')?.value?.trim() || '';
    const subject = document.getElementById('assignmentSubject')?.value?.trim() || '';
    const description = document.getElementById('assignmentDescription')?.value?.trim() || '';
    const due = document.getElementById('assignmentDue')?.value?.trim() || '';
    if (!title || !subject || !due) { showToast('Title, subject, and due date are required.', 'error'); return; }
    const assignments = getStoredList('studycore_assignments', DEFAULT_ASSIGNMENTS);
    assignments.unshift({ id: `assignment-${Date.now()}`, title, subject, description, due });
    saveStoredList('studycore_assignments', assignments);
    form.reset();
    showToast('Assignment published.', 'success');
  });
}

function bindAdminAnnouncementForm() {
  const form = document.getElementById('adminAnnouncementForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('announcementTitle')?.value?.trim() || '';
    const detail = document.getElementById('announcementDetail')?.value?.trim() || '';
    if (!title || !detail) { showToast('Please add both a title and a message.', 'error'); return; }
    const announcements = getStoredList('studycore_announcements', DEFAULT_ANNOUNCEMENTS);
    announcements.unshift({ id: `a-${Date.now()}`, title, detail, createdAt: new Date().toISOString() });
    saveStoredList('studycore_announcements', announcements.slice(0, 20));
    form.reset();
    showToast('Announcement published.', 'success');
  });
}

function initAdminDashboard() {
  // ensureAccess() in main.js already redirected away anyone who isn't
  // the admin by the time this runs, but this page-local check keeps
  // admin.js safe to reason about on its own too.
  const user = getCurrentUser();
  if (!StudyCoreAuth.isAdmin(user)) return;
  renderAdminSummary();
  renderAdminUsersList();
  bindAdminVideoForm();
  bindAdminDocumentForm();
  bindAdminQuizForm();
  bindAdminAssignmentForm();
  bindAdminAnnouncementForm();
}

window.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('adminSummary')) return; // not the admin page
  initAdminDashboard();
});
