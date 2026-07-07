// =============================================
// STUDYCORE — Auth & Role Module (auth.js)
// Backed by Supabase. Role is looked up from the
// user_roles table server-side; the client only caches the answer
// for UI gating. Real security lives in RLS on the backend.
// =============================================
(function (global) {
  'use strict';

  // Backend config — replaced at write time from .env.
  const SUPABASE_URL = 'https://olzguopmbkqavrqkfvle.supabase.co';
  const SUPABASE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9semd1b3BtYmtxYXZycWtmdmxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTQ1NTEsImV4cCI6MjA5ODk5MDU1MX0.W8wZk4Fuvb4pqd4ikpHUy8keCLp8cII6TULD-ppoXGM';

  if (!global.supabase || !global.supabase.createClient) {
    console.error('[StudyCore] supabase-js UMD not loaded before auth.js');
  }
  const sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
  });
  global.sbClient = sb;

  const ROLES = { ADMIN: 'admin', STUDENT: 'student' };

  // Role is never determined from a hardcoded email on the client — it is
  // looked up from the user_roles table (see fetchRole below) only *after*
  // a user has successfully authenticated with Supabase. The one place that
  // maps an email to the admin role lives entirely server-side, in a
  // SECURITY DEFINER database trigger (see supabase/migrations), and is
  // never shipped to the browser.

  // Sync check used across the UI. The role was written to the local
  // user object at login time after fetching it from user_roles.
  function isAdmin(user) {
    return !!user && user.role === ROLES.ADMIN;
  }

  const DASHBOARD_PAGE = { admin: 'admin.html', student: 'dashboard.html' };
  function getDashboardPage(user) {
    return isAdmin(user) ? DASHBOARD_PAGE.admin : DASHBOARD_PAGE.student;
  }

  // Fetch role from user_roles table (source of truth).
  async function fetchRole(userId) {
    const { data, error } = await sb
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[StudyCore] role lookup failed', error);
      return ROLES.STUDENT;
    }
    return data?.role || ROLES.STUDENT;
  }

  // Fetch profile row for a user id.
  async function fetchProfile(userId) {
    const { data } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    return data;
  }

  // Merge auth user + profile + role into the shape the UI expects.
  async function buildUser(authUser) {
    if (!authUser) return null;
    const [role, profile] = await Promise.all([fetchRole(authUser.id), fetchProfile(authUser.id)]);
    return {
      id: authUser.id,
      email: authUser.email,
      name: profile?.name || authUser.user_metadata?.name || authUser.email,
      role,
      subscription: profile?.subscription || 'trial',
      trialEnd: profile?.trial_end ? new Date(profile.trial_end).getTime() : null,
      subscriptionEnd: profile?.subscription_end ? new Date(profile.subscription_end).getTime() : null,
      learningLevel: profile?.learning_level || 'secondary',
      school: profile?.school || 'Not set',
      grade: profile?.grade || 'Grade 10+',
      isActive: profile?.is_active !== false,
      isVerified: !!profile?.is_verified,
      darkMode: !!profile?.dark_mode,
      joinedAt: profile?.created_at || new Date().toISOString(),
    };
  }

  global.StudyCoreAuth = {
    ROLES,
    isAdmin,
    getDashboardPage,
    fetchRole,
    fetchProfile,
    buildUser,
    sb,
  };
})(window);
