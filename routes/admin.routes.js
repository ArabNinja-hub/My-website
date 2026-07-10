const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth, requireRole('ADMIN'));

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

function deleteFileIfExists(storedName) {
  if (!storedName) return;
  const filePath = path.join(UPLOAD_DIR, storedName);
  fs.unlink(filePath, () => {});
}

function hashFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ---- Resource CRUD -------------------------------------------------------

// GET all resources for the management table (includes drafts, supports search/filter/sort)
router.get('/resources', (req, res) => {
  const { category, subject, search, sort = 'newest', publishStatus } = req.query;
  const clauses = [];
  const params = {};
  if (category) { clauses.push('category = @category'); params.category = category; }
  if (subject) { clauses.push('subject = @subject'); params.subject = subject; }
  if (publishStatus) { clauses.push('publish_status = @publishStatus'); params.publishStatus = publishStatus; }
  if (search) {
    clauses.push('(title LIKE @search OR description LIKE @search OR tags LIKE @search)');
    params.search = `%${search}%`;
  }
  const sortMap = {
    newest: 'created_at DESC',
    oldest: 'created_at ASC',
    popular: 'download_count DESC',
    title: 'title ASC'
  };
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM resources ${where} ORDER BY ${sortMap[sort] || sortMap.newest}`).all(params);
  res.json({ resources: rows.map(serializeResource) });
});

router.post('/resources', upload.single('file'), (req, res) => {
  const { title, description, category, subject, course, yearLevel, semester, tags, externalUrl, quizData, dueDate, publishStatus } = req.body;

  if (!title || !title.trim()) return res.status(400).json({ message: 'Title is required.' });
  if (!category) return res.status(400).json({ message: 'Category is required.' });
  if (category === 'quiz' && !quizData) return res.status(400).json({ message: 'Quiz questions (JSON) are required for quizzes.' });

  if (quizData) {
    try { JSON.parse(quizData); } catch { return res.status(400).json({ message: 'Quiz questions must be valid JSON.' }); }
  }

  const now = new Date().toISOString();
  const id = `res-${uuidv4()}`;
  let contentHash = null;
  let duplicateOf = null;

  if (req.file) {
    contentHash = hashFile(req.file.path);
    const existingDuplicate = db.prepare(`
      SELECT id, title FROM resources WHERE content_hash = ? AND id != ? LIMIT 1
    `).get(contentHash, id);
    if (existingDuplicate) duplicateOf = existingDuplicate;
  }

  const row = {
    id,
    title: title.trim(),
    description: description || null,
    category,
    subject: subject || null,
    course: course || null,
    year_level: yearLevel || null,
    semester: semester || null,
    tags: tags || null,
    file_name: req.file ? req.file.originalname : null,
    stored_name: req.file ? req.file.filename : null,
    file_size: req.file ? req.file.size : null,
    mime_type: req.file ? req.file.mimetype : null,
    content_hash: contentHash,
    external_url: externalUrl || null,
    quiz_data: quizData || null,
    due_date: dueDate || null,
    publish_status: publishStatus || 'published',
    uploaded_by: req.user.id,
    created_at: now,
    updated_at: now
  };

  db.prepare(`
    INSERT INTO resources (id, title, description, category, subject, course, year_level, semester, tags,
      file_name, stored_name, file_size, mime_type, content_hash, external_url, quiz_data, due_date, publish_status, uploaded_by, created_at, updated_at)
    VALUES (@id, @title, @description, @category, @subject, @course, @year_level, @semester, @tags,
      @file_name, @stored_name, @file_size, @mime_type, @content_hash, @external_url, @quiz_data, @due_date, @publish_status, @uploaded_by, @created_at, @updated_at)
  `).run(row);

  const saved = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
  const response = { resource: serializeResource(saved) };
  if (duplicateOf) {
    response.warning = `This file appears to be identical to an existing resource: "${duplicateOf.title}". Both have been kept - delete the one you don't need from the resource table below.`;
  }
  res.status(201).json(response);
});

router.put('/resources/:id', upload.single('file'), (req, res) => {
  const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Resource not found.' });

  const { title, description, category, subject, course, yearLevel, semester, tags, externalUrl, quizData, dueDate, publishStatus } = req.body;

  if (quizData) {
    try { JSON.parse(quizData); } catch { return res.status(400).json({ message: 'Quiz questions must be valid JSON.' }); }
  }

  let fileFields = {
    file_name: existing.file_name,
    stored_name: existing.stored_name,
    file_size: existing.file_size,
    mime_type: existing.mime_type,
    content_hash: existing.content_hash
  };

  if (req.file) {
    deleteFileIfExists(existing.stored_name);
    fileFields = {
      file_name: req.file.originalname,
      stored_name: req.file.filename,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      content_hash: hashFile(req.file.path)
    };
  }

  const updated = {
    id: existing.id,
    title: (title ?? existing.title).trim(),
    description: description ?? existing.description,
    category: category ?? existing.category,
    subject: subject ?? existing.subject,
    course: course ?? existing.course,
    year_level: yearLevel ?? existing.year_level,
    semester: semester ?? existing.semester,
    tags: tags ?? existing.tags,
    external_url: externalUrl ?? existing.external_url,
    quiz_data: quizData ?? existing.quiz_data,
    due_date: dueDate ?? existing.due_date,
    publish_status: publishStatus ?? existing.publish_status,
    updated_at: new Date().toISOString(),
    ...fileFields
  };

  db.prepare(`
    UPDATE resources SET title=@title, description=@description, category=@category, subject=@subject, course=@course,
      year_level=@year_level, semester=@semester, tags=@tags, external_url=@external_url, quiz_data=@quiz_data,
      due_date=@due_date, publish_status=@publish_status, updated_at=@updated_at,
      file_name=@file_name, stored_name=@stored_name, file_size=@file_size, mime_type=@mime_type, content_hash=@content_hash
    WHERE id=@id
  `).run(updated);

  const saved = db.prepare('SELECT * FROM resources WHERE id = ?').get(existing.id);
  res.json({ resource: serializeResource(saved) });
});

router.delete('/resources/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Resource not found.' });
  deleteFileIfExists(existing.stored_name);
  db.prepare('DELETE FROM resources WHERE id = ?').run(existing.id);
  res.json({ message: 'Resource deleted.' });
});

// ---- Users ---------------------------------------------------------------

router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, role, school, grade, learning_level, subscription, trial_end, subscription_start, subscription_end, created_at
    FROM users ORDER BY created_at DESC
  `).all();
  res.json({ users });
});

router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account.' });
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role === 'ADMIN') return res.status(400).json({ message: 'Admin accounts cannot be removed here.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'Student account removed.' });
});

// ---- Analytics -------------------------------------------------------------

router.get('/analytics', (req, res) => {
  const totalUsers = db.prepare(`SELECT COUNT(*) c FROM users`).get().c;
  const totalStudents = db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'STUDENT'`).get().c;
  const premiumStudents = db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'STUDENT' AND subscription = 'premium'`).get().c;
  const totalResources = db.prepare(`SELECT COUNT(*) c FROM resources`).get().c;
  const publishedResources = db.prepare(`SELECT COUNT(*) c FROM resources WHERE publish_status = 'published'`).get().c;
  const totalDownloads = db.prepare(`SELECT COALESCE(SUM(download_count),0) c FROM resources`).get().c;
  const totalViews = db.prepare(`SELECT COALESCE(SUM(view_count),0) c FROM resources`).get().c;
  const revenue = db.prepare(`SELECT COALESCE(SUM(amount),0) c FROM payments WHERE status = 'SUCCESS'`).get().c;

  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count FROM resources GROUP BY category
  `).all();

  const popular = db.prepare(`
    SELECT id, title, category, download_count FROM resources ORDER BY download_count DESC LIMIT 5
  `).all();

  const mostViewed = db.prepare(`
    SELECT id, title, category, view_count FROM resources WHERE view_count > 0 ORDER BY view_count DESC LIMIT 5
  `).all();

  const recentUploads = db.prepare(`
    SELECT id, title, category, created_at FROM resources ORDER BY created_at DESC LIMIT 5
  `).all();

  const storageUsedBytes = db.prepare(`SELECT COALESCE(SUM(file_size),0) c FROM resources`).get().c;

  const recentActivity = db.prepare(`
    SELECT d.created_at, r.title, u.name as student_name
    FROM downloads d
    JOIN resources r ON r.id = d.resource_id
    LEFT JOIN users u ON u.id = d.user_id
    ORDER BY d.created_at DESC LIMIT 8
  `).all();

  res.json({
    totalUsers,
    totalStudents,
    premiumStudents,
    totalResources,
    publishedResources,
    totalDownloads,
    totalViews,
    revenue,
    storageUsedBytes,
    byCategory,
    popular,
    mostViewed,
    recentUploads,
    recentActivity
  });
});

module.exports = router;
