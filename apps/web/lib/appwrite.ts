"use client";

import { Account, Client, Functions } from "appwrite";
import { appwritePublicConfig } from "./app-config";

export const client = new Client().setEndpoint(appwritePublicConfig.endpoint).setProject(appwritePublicConfig.projectId);
export const account = new Account(client);
export const functions = new Functions(client);

export const appwriteClient = client;
export const appwriteFunctions = functions;
