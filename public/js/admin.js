// =============================================
// STUDYCORE — Admin Dashboard Module (admin.js)
// Backed by Supabase. Reads/writes go through Supabase; RLS on
// the backend enforces that only admins can insert/update/delete.
// =============================================

async function renderAdminSummary() {
  const target = document.getElementById('adminSummary');
  if (!target) return;
  const sb = window.sbClient;
  const [
    { count: totalStudents },
    { count: premiumStudents },
    { count: activeStudents },
    { count: verifiedStudents },
    { count: videos },
    { count: documents },
    { count: quizzes },
    { count: assignments },
    { count: announcements },
  ] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription', 'premium'),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
    sb.from('videos').select('*', { count: 'exact', head: true }),
    sb.from('documents').select('*', { count: 'exact', head: true }),
    sb.from('quizzes').select('*', { count: 'exact', head: true }),
    sb.from('assignments').select('*', { count: 'exact', head: true }),
    sb.from('announcements').select('*', { count: 'exact', head: true }),
  ]);
  target.innerHTML = `
    <div class="info-card"><h3>Total students</h3><p>${totalStudents ?? 0}</p></div>
    <div class="info-card"><h3>Active students</h3><p>${activeStudents ?? 0}</p></div>
    <div class="info-card"><h3>Premium students</h3><p>${premiumStudents ?? 0}</p></div>
    <div class="info-card"><h3>Verified students</h3><p>${verifiedStudents ?? 0}</p></div>
    <div class="info-card"><h3>Videos</h3><p>${videos ?? 0}</p></div>
    <div class="info-card"><h3>Documents</h3><p>${documents ?? 0}</p></div>
    <div class="info-card"><h3>Quizzes</h3><p>${quizzes ?? 0}</p></div>
    <div class="info-card"><h3>Assignments</h3><p>${assignments ?? 0}</p></div>
    <div class="info-card"><h3>Announcements</h3><p>${announcements ?? 0}</p></div>
  `;
}

async function renderAdminUsersList() {
  const target = document.getElementById('adminUsersList');
  if (!target) return;
  const sb = window.sbClient;
  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id, email, name, subscription, trial_end, is_active, is_verified, created_at')
    .order('created_at', { ascending: false });
  if (error) { target.innerHTML = `<p>Error loading students: ${error.message}</p>`; return; }
  // Filter out admins from the student list.
  const { data: adminRows } = await sb.from('user_roles').select('user_id').eq('role', 'admin');
  const adminIds = new Set((adminRows || []).map((r) => r.user_id));
  const students = (profiles || []).filter((p) => !adminIds.has(p.id));
  if (!students.length) { target.innerHTML = '<p>No students have signed up yet.</p>'; return; }
  target.innerHTML = students
    .map((u) => `
      <div class="resource-meta" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color,#2a2a2a);flex-wrap:wrap;">
        <span>
          <strong>${u.name || '—'}</strong> • ${u.email}
          <br>${u.subscription}${u.trial_end ? ` • trial ends ${new Date(u.trial_end).toLocaleDateString()}` : ''}
          • ${u.is_active ? 'active' : 'deactivated'}${u.is_verified ? ' • verified' : ''}
        </span>
        <span style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" data-toggle-active="${u.id}" data-active="${u.is_active}">
            ${u.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button class="btn btn-outline btn-sm" data-toggle-verified="${u.id}" data-verified="${u.is_verified}">
            ${u.is_verified ? 'Unverify' : 'Verify'}
          </button>
          <button class="btn btn-outline btn-sm" data-toggle-premium="${u.id}" data-sub="${u.subscription}">
            ${u.subscription === 'premium' ? 'Downgrade' : 'Make premium'}
          </button>
          <button class="btn btn-outline btn-sm" data-remove-user="${u.id}">Delete</button>
        </span>
      </div>`)
    .join('');

  target.querySelectorAll('[data-remove-user]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Delete this student account?')) return;
      const id = b.getAttribute('data-remove-user');
      const { error } = await sb.from('profiles').delete().eq('id', id);
      if (error) return showToast(error.message, 'error');
      showToast('Student account removed.', 'success');
      renderAdminUsersList(); renderAdminSummary();
    })
  );
  target.querySelectorAll('[data-toggle-active]').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.getAttribute('data-toggle-active');
      const next = b.getAttribute('data-active') !== 'true';
      const { error } = await sb.from('profiles').update({ is_active: next }).eq('id', id);
      if (error) return showToast(error.message, 'error');
      showToast(next ? 'Account activated.' : 'Account deactivated.', 'success');
      renderAdminUsersList(); renderAdminSummary();
    })
  );
  target.querySelectorAll('[data-toggle-verified]').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.getAttribute('data-toggle-verified');
      const next = b.getAttribute('data-verified') !== 'true';
      const { error } = await sb.from('profiles').update({ is_verified: next }).eq('id', id);
      if (error) return showToast(error.message, 'error');
      showToast(next ? 'Account verified.' : 'Verification revoked.', 'success');
      renderAdminUsersList(); renderAdminSummary();
    })
  );
  target.querySelectorAll('[data-toggle-premium]').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.getAttribute('data-toggle-premium');
      const next = b.getAttribute('data-sub') !== 'premium';
      const patch = next
        ? { subscription: 'premium', subscription_end: new Date(Date.now() + 30 * 86400000).toISOString() }
        : { subscription: 'trial', subscription_end: null };
      const { error } = await sb.from('profiles').update(patch).eq('id', id);
      if (error) return showToast(error.message, 'error');
      showToast('Subscription updated.', 'success');
      renderAdminUsersList(); renderAdminSummary();
    })
  );
}

function bindContentForm({ formId, table, statusFn, fieldMap, requireFields, resetMsg }) {
  const form = document.getElementById(formId);
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const row = {};
    for (const [key, elId] of Object.entries(fieldMap)) {
      const el = document.getElementById(elId);
      row[key] = el?.value?.trim() || null;
    }
    for (const f of requireFields) {
      if (!row[f]) return showToast(`Missing ${f}.`, 'error');
    }
    if (statusFn) statusFn(row);
    const { error } = await window.sbClient.from(table).insert(row);
    if (error) return showToast(error.message, 'error');
    form.reset();
    showToast(resetMsg, 'success');
    renderAdminSummary();
    renderAllContentManagers();
  });
}

function bindAdminVideoForm() {
  bindContentForm({
    formId: 'adminVideoForm', table: 'videos',
    fieldMap: { title: 'videoTitle', subject: 'videoSubject', description: 'videoDescription', url: 'videoLink' },
    requireFields: ['title', 'subject'],
    statusFn: (row) => { row.publish_status = 'published'; if (!row.url) row.url = ''; },
    resetMsg: 'Video published.',
  });
}
function bindAdminDocumentForm() {
  bindContentForm({
    formId: 'adminDocumentForm', table: 'documents',
    fieldMap: { title: 'documentTitle', subject: 'documentSubject', description: 'documentDescription', url: 'documentLink' },
    requireFields: ['title', 'subject'],
    statusFn: (row) => { row.publish_status = 'published'; if (!row.url) row.url = ''; },
    resetMsg: 'Document published.',
  });
}
function bindAdminQuizForm() {
  const form = document.getElementById('adminQuizForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = document.getElementById('quizTitle')?.value?.trim() || '';
    const subject = document.getElementById('quizSubject')?.value?.trim() || '';
    const questionsRaw = document.getElementById('quizQuestions')?.value?.trim() || '';
    if (!title || !subject || !questionsRaw) return showToast('Title, subject, and questions are required.', 'error');
    let questions;
    try { questions = JSON.parse(questionsRaw); if (!Array.isArray(questions) || !questions.length) throw 0; }
    catch { return showToast('Questions must be valid JSON, e.g. [{"prompt":"…","options":["…"],"answer":0}]', 'error'); }
    const { error } = await window.sbClient.from('quizzes').insert({ title, subject, questions, publish_status: 'published' });
    if (error) return showToast(error.message, 'error');
    form.reset(); showToast('Quiz published.', 'success'); renderAdminSummary(); renderAllContentManagers();
  });
}
function bindAdminAssignmentForm() {
  bindContentForm({
    formId: 'adminAssignmentForm', table: 'assignments',
    fieldMap: { title: 'assignmentTitle', subject: 'assignmentSubject', description: 'assignmentDescription', due_date: 'assignmentDue' },
    requireFields: ['title', 'subject', 'due_date'],
    statusFn: (row) => { row.publish_status = 'published'; },
    resetMsg: 'Assignment published.',
  });
}
function bindAdminAnnouncementForm() {
  bindContentForm({
    formId: 'adminAnnouncementForm', table: 'announcements',
    fieldMap: { title: 'announcementTitle', detail: 'announcementDetail' },
    requireFields: ['title', 'detail'],
    statusFn: (row) => { row.publish_status = 'published'; },
    resetMsg: 'Announcement published.',
  });
}

// --- Content management: edit / publish-toggle / delete for uploaded materials ---
// This is the only place in the app where learning materials can be created,
// edited, organized (published/unpublished), or deleted. Students only ever
// see published rows, read-only, on the public pages (see js/main.js).
const CONTENT_TYPES = [
  { table: 'videos', containerId: 'adminVideoList', singular: 'Video',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'url', label: 'URL', type: 'text' },
    ] },
  { table: 'documents', containerId: 'adminDocumentList', singular: 'Document',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'url', label: 'URL', type: 'text' },
    ] },
  { table: 'quizzes', containerId: 'adminQuizList', singular: 'Quiz',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'questions', label: 'Questions (JSON)', type: 'json' },
    ] },
  { table: 'assignments', containerId: 'adminAssignmentList', singular: 'Assignment',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'due_date', label: 'Due date', type: 'text' },
    ] },
  { table: 'announcements', containerId: 'adminAnnouncementList', singular: 'Announcement',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'detail', label: 'Message', type: 'textarea' },
    ] },
];

function contentFieldSummary(item, field) {
  if (field.type === 'json') {
    try { return JSON.stringify(item[field.key] ?? []); } catch { return ''; }
  }
  return item[field.key] ?? '';
}

async function editContentItem(type, item) {
  const updates = {};
  for (const field of type.fields) {
    if (field.key === 'title') continue; // title shown separately, edited too — see below
    const current = contentFieldSummary(item, field);
    const next = prompt(`Edit ${field.label.toLowerCase()}:`, current);
    if (next === null) return; // admin cancelled — abort without changing anything
    if (field.type === 'json') {
      try { updates[field.key] = JSON.parse(next); }
      catch { showToast(`${field.label} must be valid JSON.`, 'error'); return; }
    } else {
      updates[field.key] = next.trim();
    }
  }
  const nextTitle = prompt('Edit title:', item.title || '');
  if (nextTitle === null) return;
  updates.title = nextTitle.trim();
  if (!updates.title) return showToast('Title cannot be empty.', 'error');

  const { error } = await window.sbClient.from(type.table).update(updates).eq('id', item.id);
  if (error) return showToast(error.message, 'error');
  showToast(`${type.singular} updated.`, 'success');
  renderContentManager(type);
}

async function renderContentManager(type) {
  const target = document.getElementById(type.containerId);
  if (!target) return;
  const { data, error } = await window.sbClient
    .from(type.table).select('*').order('created_at', { ascending: false });
  if (error) { target.innerHTML = `<p>Error loading ${type.table}: ${error.message}</p>`; return; }
  const items = data || [];
  if (!items.length) { target.innerHTML = `<p>No ${type.table} yet.</p>`; return; }

  target.innerHTML = items.map((item) => {
    const isPublished = item.publish_status === 'published';
    const subline = type.fields
      .filter((f) => f.key !== 'title' && f.type !== 'json' && f.type !== 'textarea')
      .map((f) => contentFieldSummary(item, f))
      .filter(Boolean)
      .join(' • ');
    return `
      <div class="resource-meta" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color,#2a2a2a);flex-wrap:wrap;">
        <span>
          <strong>${item.title || 'Untitled'}</strong>${subline ? ` • ${subline}` : ''}
          <br>${isPublished ? 'Published' : 'Draft'} • ${new Date(item.created_at).toLocaleDateString()}
        </span>
        <span style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" data-edit-content="${item.id}">Edit</button>
          <button class="btn btn-outline btn-sm" data-toggle-publish="${item.id}" data-published="${isPublished}">
            ${isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button class="btn btn-outline btn-sm" data-delete-content="${item.id}">Delete</button>
        </span>
      </div>`;
  }).join('');

  target.querySelectorAll('[data-edit-content]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-edit-content');
      const item = items.find((i) => i.id === id);
      if (item) editContentItem(type, item);
    })
  );
  target.querySelectorAll('[data-toggle-publish]').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.getAttribute('data-toggle-publish');
      const next = b.getAttribute('data-published') !== 'true';
      const { error: updateError } = await window.sbClient
        .from(type.table)
        .update({ publish_status: next ? 'published' : 'draft' })
        .eq('id', id);
      if (updateError) return showToast(updateError.message, 'error');
      showToast(next ? `${type.singular} published.` : `${type.singular} unpublished.`, 'success');
      renderContentManager(type);
    })
  );
  target.querySelectorAll('[data-delete-content]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm(`Delete this ${type.singular.toLowerCase()}? This cannot be undone.`)) return;
      const id = b.getAttribute('data-delete-content');
      const { error: deleteError } = await window.sbClient.from(type.table).delete().eq('id', id);
      if (deleteError) return showToast(deleteError.message, 'error');
      showToast(`${type.singular} deleted.`, 'success');
      renderContentManager(type);
      renderAdminSummary();
    })
  );
}

async function renderAllContentManagers() {
  await Promise.all(CONTENT_TYPES.map((type) => renderContentManager(type)));
}

async function initAdminDashboard() {
  // ensureAccess() already redirects non-admins away by the time this runs;
  // this guard just keeps the file safe to reason about on its own.
  const user = getCurrentUser();
  if (!StudyCoreAuth.isAdmin(user)) return;
  await renderAdminSummary();
  await renderAdminUsersList();
  await renderAllContentManagers();
  bindAdminVideoForm();
  bindAdminDocumentForm();
  bindAdminQuizForm();
  bindAdminAssignmentForm();
  bindAdminAnnouncementForm();
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('adminSummary')) return;
  // Wait a tick for main.js's cloud session refresh, then init.
  setTimeout(initAdminDashboard, 600);
});
