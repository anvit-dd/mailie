// Auth utilities for client-side (used by auth-context indirectly)
// Most auth is now handled server-side via API routes and session cookies.
// This file is kept for any remaining client-side utilities.

// The OAuth flow is now:
// 1. Client clicks "Connect Gmail"
// 2. Redirect to /api/auth/gmail (server-side redirect to Google)
// 3. Google redirects to /api/auth/callback (server exchanges code for tokens, creates session)
// 4. Callback redirects to / with session cookie set

export {}
