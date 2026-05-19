import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../../lib/auth-session";
import { createSessionStorage } from "../../../../../lib/server/appwrite";

export const runtime = "nodejs";

function getSession(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
}

function unauthorized() {
  const response = NextResponse.json({ success: false, message: "Please sign in again." }, { status: 401 });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function GET(request: Request, { params }: { params: { bucketId: string; fileId: string } }) {
  const session = getSession(request);
  if (!session) return unauthorized();

  const mode = new URL(request.url).searchParams.get("mode") ?? "view";
  const storage = createSessionStorage(decodeURIComponent(session));

  try {
    const file = await storage.getFile({ bucketId: params.bucketId, fileId: params.fileId });
    const bytes =
      mode === "preview"
        ? await storage.getFilePreview({ bucketId: params.bucketId, fileId: params.fileId })
        : mode === "download"
          ? await storage.getFileDownload({ bucketId: params.bucketId, fileId: params.fileId })
          : await storage.getFileView({ bucketId: params.bucketId, fileId: params.fileId });

    const headers = new Headers({
      "content-type": mode === "preview" ? "image/png" : file.mimeType || "application/octet-stream",
      "cache-control": "private, max-age=60"
    });
    if (mode === "download") {
      headers.set("content-disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
    }

    return new NextResponse(bytes, { headers });
  } catch {
    return NextResponse.json({ success: false, message: "File not found." }, { status: 404 });
  }
}

