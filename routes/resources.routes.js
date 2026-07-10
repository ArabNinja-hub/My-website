const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, attachUser } = require('../middleware/auth');
const { UPLOAD_DIR } = require('../middleware/upload');

const router = express.Router();

function serializeResource(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    subject: row.subject,
    course: row.course,
    yearLevel: row.year_level,
    semester: row.semester,
    tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    hasFile: Boolean(row.stored_name),
    externalUrl: row.external_url,
    quizData: row.quiz_data ? JSON.parse(row.quiz_data) : null,
    dueDate: row.due_date,
    publishStatus: row.publish_status,
    downloadCount: row.download_count,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function subscriptionGate(req, res, next) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const now = Date.now();
  const trialEnd = new Date(user.trial_end || 0).getTime();
  const subEnd = new Date(user.subscription_end || 0).getTime();
  const active = user.role === 'ADMIN' || (user.subscription === 'premium' && now < subEnd);
  const inTrial = user.role !== 'ADMIN' && !active && now < trialEnd;
  req.subscriptionOk = active || inTrial || user.role === 'ADMIN';
  next();
}

// GET /api/resources?category=&subject=&course=&year=&semester=&search=&sort=&page=&pageSize=
router.get('/', requireAuth, subscriptionGate, (req, res) => {
  const { category, subject, course, year, semester, search, sort = 'newest', page = 1, pageSize = 24 } = req.query;

  // Announcements are always visible even without an active subscription.
  if (!req.subscriptionOk && category !== 'announcement') {
    return res.status(403).json({ message: 'Your trial has ended. Subscribe to unlock resources.', locked: true });
  }

  const clauses = [`publish_status = 'published'`];
  const params = {};
  if (category) { clauses.push('category = @category'); params.category = category; }
  if (subject) { clauses.push('LOWER(subject) = LOWER(@subject)'); params.subject = subject; }
  if (course) { clauses.push('course = @course'); params.course = course; }
  if (year) { clauses.push('year_level = @year'); params.year = year; }
  if (semester) { clauses.push('semester = @semester'); params.semester = semester; }
  if (search) {
    clauses.push('(title LIKE @search OR description LIKE @search OR subject LIKE @search OR tags LIKE @search)');
    params.search = `%${search}%`;
  }

  const sortMap = {
    newest: 'created_at DESC',
    oldest: 'created_at ASC',
    popular: 'download_count DESC',
    title: 'title ASC'
  };
  const orderBy = sortMap[sort] || sortMap.newest;

  const limit = Math.min(Number(pageSize) || 24, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as count FROM resources ${where}`).get(params).count;
  const rows = db.prepare(`SELECT * FROM resources ${where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`).all(params);

  res.json({ resources: rows.map(serializeResource), total, page: Number(page), pageSize: limit });
});

router.get('/:id/stream', requireAuth, subscriptionGate, (req, res) => {
  const row = db.prepare(`SELECT * FROM resources WHERE id = ? AND publish_status = 'published'`).get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Resource not found.' });
  if (!req.subscriptionOk && row.category !== 'announcement') {
    return res.status(403).json({ message: 'Your trial has ended. Subscribe to unlock this content.', locked: true });
  }
  if (!row.stored_name) return res.status(404).json({ message: 'This resource has no previewable file.' });
  const filePath = path.join(UPLOAD_DIR, row.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File is missing from storage.' });
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(filePath);
});

router.get('/bookmarks/mine', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT r.* FROM bookmarks b
    JOIN resources r ON r.id = b.resource_id
    WHERE b.user_id = ? AND r.publish_status = 'published'
    ORDER BY b.created_at DESC
  `).all(req.user.id);
  res.json({ resources: rows.map(serializeResource) });
});

router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM resources WHERE id = ? AND publish_status = 'published'`).get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Resource not found.' });
  db.prepare('UPDATE resources SET view_count = view_count + 1 WHERE id = ?').run(row.id);
  res.json({ resource: serializeResource(row) });
});

router.get('/:id/download', requireAuth, subscriptionGate, (req, res) => {
  const row = db.prepare(`SELECT * FROM resources WHERE id = ? AND publish_status = 'published'`).get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Resource not found.' });
  if (!req.subscriptionOk && row.category !== 'announcement') {
    return res.status(403).json({ message: 'Your trial has ended. Subscribe to unlock downloads.', locked: true });
  }

  if (row.external_url) {
    db.prepare('UPDATE resources SET download_count = download_count + 1 WHERE id = ?').run(row.id);
    return res.redirect(row.external_url);
  }
  if (!row.stored_name) return res.status(404).json({ message: 'This resource has no downloadable file.' });

  const filePath = path.join(UPLOAD_DIR, row.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File is missing from storage.' });

  db.prepare('UPDATE resources SET download_count = download_count + 1 WHERE id = ?').run(row.id);
  db.prepare('INSERT INTO downloads (id, resource_id, user_id, created_at) VALUES (?, ?, ?, ?)')
    .run(`dl-${uuidv4()}`, row.id, req.user.id, new Date().toISOString());

  res.download(filePath, row.file_name || row.stored_name);
});

router.post('/:id/bookmark', requireAuth, (req, res) => {
  const resource = db.prepare('SELECT id FROM resources WHERE id = ?').get(req.params.id);
  if (!resource) return res.status(404).json({ message: 'Resource not found.' });
  try {
    db.prepare('INSERT INTO bookmarks (id, user_id, resource_id, created_at) VALUES (?, ?, ?, ?)')
      .run(`bm-${uuidv4()}`, req.user.id, resource.id, new Date().toISOString());
  } catch {
    // already bookmarked - ignore (idempotent)
  }
  res.json({ message: 'Bookmarked.' });
});

router.delete('/:id/bookmark', requireAuth, (req, res) => {
  db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND resource_id = ?').run(req.user.id, req.params.id);
  res.json({ message: 'Bookmark removed.' });
});

module.exports = router;
