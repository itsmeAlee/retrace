import "server-only";

import { Account, Client } from "node-appwrite";

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

function baseClient() {
  return new Client().setEndpoint(endpoint).setProject(projectId);
}

export function createAdminAccount() {
  return new Account(baseClient().setKey(apiKey));
}

export function createSessionAccount(sessionSecret: string) {
  return new Account(baseClient().setSession(sessionSecret));
}
