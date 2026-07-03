// =============================================
// STUDYCORE v2.0 — Main JavaScript
// By Dr. Relentless | Stay Curious & Winning
// AI Tutor: Arab
// =============================================

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
if (document.getElementById('quizProgressFill')) { loadQuiz(); }

// ── Forms ──
document.getElementById('signupForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const name = document.getElementById('signupName')?.value;
  closeModal('signupModal');
  showToast(`Welcome to StudyCore, ${name}! Stay curious & winning! 🌟`);
});
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  if (!email || !password) { showToast('Please enter both email and password', 'error'); return; }
  const submitBtn = this.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      if (data.token) localStorage.setItem('auth_token', data.token);
      showToast(data.message || 'Welcome back! Redirecting...', 'success');
      setTimeout(() => { window.location.href = '/pages/dashboard.html'; }, 700);
    } else {
      showToast(data.message || 'Invalid credentials', 'error');
    }
  } catch (err) {
    showToast('Connection issue. Please try again.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
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
