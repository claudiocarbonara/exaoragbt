import { NextRequest } from "next/server";
import OpenAI from "openai";

export const runtime = "edge";

const systemPrompt =
  process.env.SYSTEM_PROMPT ??
  "Sei ExaoraGPT, assistente AI per aziende e professionisti, esperto in AI, cybersecurity e privacy. Rispondi in modo chiaro, professionale e in italiano.";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY non configurata");
    const { messages = [] } = await req.json().catch(() => ({ messages: [] }));
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await client.chat.completions.create({
      model: process.env.MODEL || "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    });

    const text = completion.choices?.[0]?.message?.content || "Nessuna risposta.";
    return new Response(JSON.stringify({ reply: text }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Errore server" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: "ExaoraGPT online" }), {
    headers: { "Content-Type": "application/json" }
  });
}
