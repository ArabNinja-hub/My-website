const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'studycore-secret';
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

async function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      users: [],
      videos: [],
      documents: [],
      quizzes: [],
      assignments: [],
      announcements: [],
      payments: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
}

function seedAdminAccount() {
  const data = readData();
  if (!data.users.length) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    data.users.push({
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@studycore.com',
      password: hashedPassword,
      role: 'ADMIN',
      subscription: 'premium',
      trialEnd: null,
      subscriptionStart: new Date().toISOString(),
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    });
    writeData(data);
  }
}

ensureDataFile();
seedAdminAccount();

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

function getUserByEmail(email) {
  const data = readData();
  return data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function getUserById(id) {
  const data = readData();
  return data.users.find((u) => u.id === id);
}

function ensureSubscription(user) {
  const now = Date.now();
  const trialEnd = new Date(user.trialEnd || Date.now()).getTime();
  const premiumEnd = new Date(user.subscriptionEnd || 0).getTime();
  const active = user.role === 'ADMIN' || user.subscription === 'premium' && now < premiumEnd;
  const inTrial = user.role !== 'ADMIN' && !active && now < trialEnd;
  return { active, inTrial, premiumEnd, trialEnd };
}

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role = 'STUDENT' } = req.body;
  const data = readData();
  if (!email || !password || !name) return res.status(400).json({ message: 'Missing required fields' });
  if (data.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: 'Email already exists' });
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: `user-${Date.now()}`,
    name,
    email,
    password: hashedPassword,
    role: role.toUpperCase(),
    subscription: 'trial',
    trialEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    subscriptionStart: null,
    subscriptionEnd: null,
    createdAt: new Date().toISOString()
  };
  data.users.push(user);
  writeData(data);
  res.json({ token: createToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = getUserByEmail(email);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
  const subscriptionStatus = ensureSubscription(user);
  const userPayload = { id: user.id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, trialEnd: user.trialEnd, subscriptionEnd: user.subscriptionEnd, subscriptionStatus };
  res.json({ token: createToken(user), user: userPayload });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const subscriptionStatus = ensureSubscription(user);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, trialEnd: user.trialEnd, subscriptionEnd: user.subscriptionEnd, subscriptionStatus } });
});

app.post('/api/subscribe', authMiddleware, (req, res) => {
  const { phone, method } = req.body;
  if (!phone || !method) return res.status(400).json({ message: 'Phone number and payment method are required' });
  const data = readData();
  const user = data.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const payment = {
    id: `payment-${Date.now()}`,
    userId: user.id,
    method,
    phone,
    amount: 50,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };
  data.payments.push(payment);
  writeData(data);
  setTimeout(() => {
    const fresh = readData();
    const record = fresh.payments.find((p) => p.id === payment.id);
    if (record) {
      record.status = 'SUCCESS';
      const userRecord = fresh.users.find((u) => u.id === user.id);
      if (userRecord) {
        userRecord.subscription = 'premium';
        userRecord.subscriptionStart = new Date().toISOString();
        userRecord.subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      writeData(fresh);
    }
  }, 1500);
  res.json({ message: 'Payment request sent. Please confirm on your phone.', payment });
});

app.get('/api/admin/users', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const data = readData();
  res.json({ users: data.users });
});

app.get('/api/admin/analytics', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const data = readData();
  const active = data.users.filter((u) => u.role === 'STUDENT').length;
  const revenue = data.payments.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + p.amount, 0);
  res.json({ totalUsers: data.users.length, activeUsers: active, revenue });
});

app.get('/api/content/videos', authMiddleware, (req, res) => {
  const data = readData();
  const user = getUserById(req.user.id);
  const status = ensureSubscription(user);
  if (user?.role !== 'ADMIN' && !status.active && !status.inTrial) return res.status(403).json({ message: 'Subscription required' });
  res.json({ videos: data.videos.filter((item) => item.publishStatus === 'published') });
});

app.get('/api/content/documents', authMiddleware, (req, res) => {
  const data = readData();
  const user = getUserById(req.user.id);
  const status = ensureSubscription(user);
  if (user?.role !== 'ADMIN' && !status.active && !status.inTrial) return res.status(403).json({ message: 'Subscription required' });
  res.json({ documents: data.documents.filter((item) => item.publishStatus === 'published') });
});

app.get('/api/content/quizzes', authMiddleware, (req, res) => {
  const data = readData();
  const user = getUserById(req.user.id);
  const status = ensureSubscription(user);
  if (user?.role !== 'ADMIN' && !status.active && !status.inTrial) return res.status(403).json({ message: 'Subscription required' });
  res.json({ quizzes: data.quizzes.filter((item) => item.publishStatus === 'published') });
});

app.get('/api/content/assignments', authMiddleware, (req, res) => {
  const data = readData();
  const user = getUserById(req.user.id);
  const status = ensureSubscription(user);
  if (user?.role !== 'ADMIN' && !status.active && !status.inTrial) return res.status(403).json({ message: 'Subscription required' });
  res.json({ assignments: data.assignments.filter((item) => item.publishStatus === 'published') });
});

app.get('/api/content/announcements', authMiddleware, (req, res) => {
  const data = readData();
  res.json({ announcements: data.announcements.filter((item) => item.publishStatus === 'published') });
});

app.post('/api/admin/videos', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const data = readData();
  const video = { id: `video-${Date.now()}`, ...req.body, publishStatus: req.body.publishStatus || 'published' };
  data.videos.push(video);
  writeData(data);
  res.json({ video });
});

app.post('/api/admin/documents', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const data = readData();
  const documentItem = { id: `doc-${Date.now()}`, ...req.body, publishStatus: req.body.publishStatus || 'published' };
  data.documents.push(documentItem);
  writeData(data);
  res.json({ document: documentItem });
});

app.post('/api/admin/quizzes', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const data = readData();
  const quiz = { id: `quiz-${Date.now()}`, ...req.body, publishStatus: req.body.publishStatus || 'published' };
  data.quizzes.push(quiz);
  writeData(data);
  res.json({ quiz });
});

app.post('/api/admin/assignments', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const data = readData();
  const assignment = { id: `assignment-${Date.now()}`, ...req.body, publishStatus: req.body.publishStatus || 'published' };
  data.assignments.push(assignment);
  writeData(data);
  res.json({ assignment });
});

app.post('/api/admin/announcements', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const data = readData();
  const announcement = { id: `announcement-${Date.now()}`, ...req.body, publishStatus: req.body.publishStatus || 'published' };
  data.announcements.push(announcement);
  writeData(data);
  res.json({ announcement });
});

function getRequestedPath(req) {
  const raw = req.path.replace(/\\/g, '/');
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

app.get(['/dashboard', '/dashboard.html'], authMiddleware, (req, res) => {
  const user = getUserById(req.user.id);
  if (user?.role === 'ADMIN') return res.redirect('/admin/dashboard');
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get(['/admin', '/admin/dashboard', '/admin/dashboard.html'], authMiddleware, requireRole('ADMIN'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get(['/login', '/login.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get(['/signup', '/signup.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('*', (req, res) => {
  const requestedPath = getRequestedPath(req);
  if (requestedPath === '/admin' || requestedPath === '/admin/dashboard') {
    return res.sendFile(path.join(__dirname, 'admin.html'));
  }
  if (requestedPath === '/dashboard') {
    return res.sendFile(path.join(__dirname, 'dashboard.html'));
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`StudyCore server running on http://localhost:${PORT}`);
});
