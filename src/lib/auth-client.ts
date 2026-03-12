"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.APP_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
