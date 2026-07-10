const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { createToken, setAuthCookie, clearAuthCookie, requireAuth } = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function subscriptionStatus(user) {
  const now = Date.now();
  const trialEnd = new Date(user.trial_end || 0).getTime();
  const subEnd = new Date(user.subscription_end || 0).getTime();
  const active = user.role === 'ADMIN' || (user.subscription === 'premium' && now < subEnd);
  const inTrial = user.role !== 'ADMIN' && !active && now < trialEnd;
  return { active, inTrial, trialEnd: user.trial_end, subscriptionEnd: user.subscription_end };
}

router.post('/register', async (req, res) => {
  const { name, email, password, school, grade, learningLevel } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Full name is required.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'A valid email is required.' });
  if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });

  const hashed = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const user = {
    id: `user-${uuidv4()}`,
    name: name.trim(),
    email: normalizedEmail,
    password: hashed,
    role: 'STUDENT', // role can never be set by the client - always STUDENT on public signup
    school: school || null,
    grade: grade || null,
    learning_level: learningLevel === 'tertiary' ? 'tertiary' : 'secondary',
    subscription: 'trial',
    trial_end: trialEnd,
    subscription_start: null,
    subscription_end: null,
    created_at: now
  };

  db.prepare(`
    INSERT INTO users (id, name, email, password, role, school, grade, learning_level, subscription, trial_end, subscription_start, subscription_end, created_at)
    VALUES (@id, @name, @email, @password, @role, @school, @grade, @learning_level, @subscription, @trial_end, @subscription_start, @subscription_end, @created_at)
  `).run(user);

  const token = createToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ token, user: { ...publicUser(user), subscriptionStatus: subscriptionStatus(user) } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });

  const token = createToken(user);
  setAuthCookie(res, token);
  res.json({ token, user: { ...publicUser(user), subscriptionStatus: subscriptionStatus(user) } });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out.' });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: { ...publicUser(user), subscriptionStatus: subscriptionStatus(user) } });
});

router.put('/profile', requireAuth, (req, res) => {
  const { name, school, grade, learningLevel } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!name || !name.trim()) return res.status(400).json({ message: 'Name cannot be empty.' });

  db.prepare(`
    UPDATE users SET name = ?, school = ?, grade = ?, learning_level = ? WHERE id = ?
  `).run(name.trim(), school || null, grade || null, learningLevel === 'tertiary' ? 'tertiary' : 'secondary', user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ user: { ...publicUser(updated), subscriptionStatus: subscriptionStatus(updated) } });
});

router.put('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const valid = await bcrypt.compare(currentPassword || '', user.password);
  if (!valid) return res.status(401).json({ message: 'Current password is incorrect.' });
  const hashed = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
  res.json({ message: 'Password updated.' });
});

router.post('/subscribe', requireAuth, (req, res) => {
  const { phone, method } = req.body;
  if (!phone || !method) return res.status(400).json({ message: 'Phone number and payment method are required.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const paymentId = `payment-${uuidv4()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO payments (id, user_id, method, phone, amount, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(paymentId, user.id, method, phone, 50, now);

  // NOTE: this simulates a mobile-money confirmation. Wiring this to a real
  // provider (MTN MoMo / Airtel Money) requires that provider's merchant API
  // credentials and webhook endpoint - swap this setTimeout block for the
  // provider's payment-confirmation callback when those credentials exist.
  setTimeout(() => {
    const subStart = new Date().toISOString();
    const subEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`UPDATE payments SET status = 'SUCCESS' WHERE id = ?`).run(paymentId);
    db.prepare(`UPDATE users SET subscription = 'premium', subscription_start = ?, subscription_end = ? WHERE id = ?`)
      .run(subStart, subEnd, user.id);
  }, 1500);

  res.json({ message: 'Payment request sent. Please confirm on your phone.', paymentId });
});

module.exports = router;
