"use client";

import { createAuthClient } from "better-auth/react";

// LSF-2026-304: process.env._APP_URL never existed (client components only see
// NEXT_PUBLIC_*-prefixed vars, and nothing defines that one). The app is always
// served same-origin, so omitting baseURL and letting better-auth default to it
// is correct — no env plumbing needed unless a cross-origin client shows up.
export const authClient = createAuthClient({});

export const { signIn, signUp, signOut, useSession } = authClient;
