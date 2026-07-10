// =============================================
// STUDYCORE — Auth & Role Module (auth.js)
// By Dr. Relentless | Stay Curious & Winning
// -----------------------------------------------
// This file is the single source of truth for "who is an admin?".
// It knows nothing about localStorage, forms, or pages — it just
// answers that one question — so it can be swapped for a real
// backend later without touching any other file.
//
// LOAD ORDER: include this file BEFORE main.js and admin.js on
// every page:
//   <script src="js/auth.js" defer></script>
//   <script src="js/main.js" defer></script>
//
// -----------------------------------------------
// FUTURE UPGRADE (backend migration):
// Right now, role is derived from the email address every time it's
// needed (computeRole). When StudyCore moves to a real database:
//   1. Add a `role` column ("admin" | "student") to the users table.
//   2. Set it ONCE, server-side, at signup — using the exact same
//      logic as computeRole() below — so a client can never spoof it.
//   3. Replace every call to StudyCoreAuth.isAdmin(user) with a check
//      of the trusted `user.role` value that came from the server
//      session/JWT, not from anything stored in the browser.
//   4. Keep enforcing admin-only actions on the server too (see
//      server.js's requireRole('ADMIN') middleware for a reference
//      implementation) — everything in this file is for UI/UX
//      convenience only, never real security, once there's a server.
// =============================================

(function (global) {
  'use strict';

  // The one and only StudyCore admin account. Change this in exactly
  // one place if the admin email ever needs to change.
  const ADMIN_EMAIL = 'ronisherbwalya@gmail.com';

  const ROLES = {
    ADMIN: 'admin',
    STUDENT: 'student'
  };

  function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
  }

  // Pure function: given an email, what role should this account have?
  // This is the ONLY place role assignment happens. Signup, login, and
  // profile-update code must all call through here rather than trusting
  // any "role" value a user object already happens to carry — that is
  // what stops someone from granting themselves admin by editing
  // localStorage or a signup form field.
  function computeRole(email) {
    return normalizeEmail(email) === normalizeEmail(ADMIN_EMAIL) ? ROLES.ADMIN : ROLES.STUDENT;
  }

  function isAdminEmail(email) {
    return computeRole(email) === ROLES.ADMIN;
  }

  function isAdmin(user) {
    return !!user && computeRole(user.email) === ROLES.ADMIN;
  }

  // Where each role should land right after login/signup.
  // Kept here (not in main.js) so the redirect target and the role
  // check always travel together.
  const DASHBOARD_PAGE = {
    admin: 'admin.html',
    student: 'dashboard.html'
  };

  function getDashboardPage(user) {
    return isAdmin(user) ? DASHBOARD_PAGE.admin : DASHBOARD_PAGE.student;
  }

  global.StudyCoreAuth = {
    ADMIN_EMAIL,
    ROLES,
    computeRole,
    isAdminEmail,
    isAdmin,
    getDashboardPage
  };
})(window);
