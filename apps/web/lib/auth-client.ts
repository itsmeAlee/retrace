"use client";

import type { Models } from "appwrite";

const jwtTtlMs = 14 * 60 * 1000;
const userTtlMs = 60 * 1000;

let jwtCache: { jwt: string; expiresAt: number } | null = null;
let userCache: { user: Models.User<Models.Preferences>; expiresAt: number } | null = null;
let jwtPromise: Promise<string> | null = null;
let userPromise: Promise<Models.User<Models.Preferences> | null> | null = null;

export async function getSessionJwt() {
  if (jwtCache && jwtCache.expiresAt > Date.now()) {
    return jwtCache.jwt;
  }

  if (!jwtPromise) {
    jwtPromise = fetch("/api/auth/jwt", { method: "POST" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Please sign in again.");
        const data = (await response.json().catch(() => null)) as { jwt?: string } | null;
        if (!data?.jwt) throw new Error("Please sign in again.");
        jwtCache = { jwt: data.jwt, expiresAt: Date.now() + jwtTtlMs };
        return data.jwt;
      })
      .finally(() => {
        jwtPromise = null;
      });
  }

  return jwtPromise;
}

export async function getCurrentUser() {
  if (userCache && userCache.expiresAt > Date.now()) {
    return userCache.user;
  }

  if (!userPromise) {
    userPromise = fetch("/api/auth/me", { method: "GET" })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json().catch(() => null)) as { user?: Models.User<Models.Preferences> } | null;
        if (!data?.user) return null;
        userCache = { user: data.user, expiresAt: Date.now() + userTtlMs };
        return data.user;
      })
      .catch(() => null)
      .finally(() => {
        userPromise = null;
      });
  }

  return userPromise;
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();
  if (!user?.$id) {
    throw new Error("Please sign in again.");
  }
  return user.$id;
}

export function clearClientAuthCache() {
  jwtCache = null;
  userCache = null;
  jwtPromise = null;
  userPromise = null;
}
