import Groq from "groq-sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TRANSCRIPTION_TIMEOUT_MS = 20000;

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Transcription is not configured." }, { status: 500 });
  }

  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  try {
    const client = new Groq({ apiKey, maxRetries: 0, timeout: TRANSCRIPTION_TIMEOUT_MS });
    const transcript = await client.audio.transcriptions.create(
      {
        file: audio,
        model: "whisper-large-v3-turbo",
        temperature: 0,
        response_format: "verbose_json"
      },
      { maxRetries: 0, timeout: TRANSCRIPTION_TIMEOUT_MS }
    );

    const verboseTranscript = transcript as { text?: string; duration?: number };
    return NextResponse.json({
      text: transcript.text ?? "",
      duration: Math.round(Number(verboseTranscript.duration ?? 0))
    });
  } catch (error) {
    console.error("Transcription request failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not transcribe this audio." }, { status: 502 });
  }
}
