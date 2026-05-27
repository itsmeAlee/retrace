import { NextResponse } from "next/server";
import dns from "dns";
import { promisify } from "util";
import { uiDurations } from "../../../lib/app-constants";

const lookup = promisify(dns.lookup);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlString = searchParams.get("url");

  if (!urlString) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") {
      return NextResponse.json({ error: "Only HTTPS URLs are allowed" }, { status: 400 });
    }

    // Resolve IP address to prevent SSRF
    const { address } = await lookup(url.hostname);
    if (isPrivateIP(address)) {
      return NextResponse.json({ error: "Private IPs are not allowed" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), uiDurations.pageTitleFetchTimeoutMs);

    const response = await fetch(urlString, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch page" }, { status: 400 });
    }

    const html = await response.text();
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = match ? match[1].trim() : url.hostname;

    return NextResponse.json({ title });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch title" }, { status: 500 });
  }
}

function isPrivateIP(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  
  const parts = ip.split(".").map(Number);
  if (parts.length === 4) {
    const [a, b] = parts;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link local)
    if (a === 169 && b === 254) return true;
  }
  return false;
}
