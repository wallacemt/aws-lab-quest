"use client";

import { createAuthClient } from "better-auth/react";

const publicAppUrl = process.env._APP_URL?.trim();

export const authClient = createAuthClient({
  ...(publicAppUrl ? { baseURL: publicAppUrl } : {}),
});

export const { signIn, signUp, signOut, useSession } = authClient;
