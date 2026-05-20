import "server-only";

import type { Models } from "node-appwrite";
import { Account, Client, Databases, Storage, Users } from "node-appwrite";

function requiredEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const endpoint = requiredEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", process.env.APPWRITE_ENDPOINT);
const projectId = requiredEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", process.env.APPWRITE_PROJECT_ID);
const apiKey = requiredEnv("NEXT_APPWRITE_API_KEY", process.env.APPWRITE_API_KEY);

export const appwriteServerConfig = {
  endpoint,
  projectId,
  apiKey
};

function baseClient() {
  return new Client().setEndpoint(endpoint).setProject(projectId);
}

export function createAdminAccount() {
  return new Account(baseClient().setKey(apiKey));
}

export function createAdminUsers() {
  return new Users(baseClient().setKey(apiKey));
}

export async function markEmailVerified(userId: string) {
  return createAdminUsers().updateEmailVerification({
    userId,
    emailVerification: true
  });
}

export function createSessionAccount(sessionSecret: string) {
  return new Account(baseClient().setSession(sessionSecret));
}

export function createSessionStorage(sessionSecret: string) {
  return new Storage(baseClient().setSession(sessionSecret));
}

export function createSessionDatabases(sessionSecret: string) {
  return new Databases(baseClient().setSession(sessionSecret));
}

export async function ensureEmailVerified(user: Models.User<Models.Preferences>) {
  if (user.emailVerification || !user.email) {
    return user;
  }

  return markEmailVerified(user.$id);
}
