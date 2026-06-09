import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.' },
      { status: 501 },
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof File)) {
      return Response.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });
    const start = performance.now();

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    const durationMs = performance.now() - start;

    return Response.json({
      text: transcription.text,
      durationMs: Math.round(durationMs),
    });
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      if (err.status === 401) {
        return Response.json({ error: 'Invalid OpenAI API key' }, { status: 401 });
      }
      if (err.status === 429) {
        return Response.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
      }
      return Response.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return Response.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
