"use client";

import { Account, Client, Functions } from "appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

if (!endpoint || !projectId) {
  throw new Error("Missing Appwrite public environment variables.");
}

export const client = new Client().setEndpoint(endpoint).setProject(projectId);
export const account = new Account(client);
export const functions = new Functions(client);

export const appwriteClient = client;
export const appwriteFunctions = functions;
