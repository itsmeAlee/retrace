function publicEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing public environment variable: ${name}`);
  }
  return value;
}

export const appwritePublicConfig = {
  endpoint: publicEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT),
  projectId: publicEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID),
  databaseId: publicEnv("NEXT_PUBLIC_APPWRITE_DB_ID", process.env.NEXT_PUBLIC_APPWRITE_DB_ID),
  captureItemsTableId: publicEnv(
    "NEXT_PUBLIC_APPWRITE_CAPTURE_ITEMS_COL_ID",
    process.env.NEXT_PUBLIC_APPWRITE_CAPTURE_ITEMS_COL_ID
  ),
  bucketId: publicEnv("NEXT_PUBLIC_APPWRITE_BUCKET_ID", process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID)
};
