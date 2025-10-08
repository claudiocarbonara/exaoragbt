import OpenAI from "openai";

// Se Edge desse problemi nei runtime logs, cambia in "nodejs"
export const runtime = "edge";

const systemPrompt =
  process.env.SYSTEM_PROMPT ??
  "Sei ExaoraGPT, assistente per AI, cybersecurity, privacy e infrastrutture IT. Rispondi in italiano, tecnico ma chiaro; proponi audit iniziali e una call quando utile.";

export async function GET() {
  const ok = !!process.env.OPENAI_API_KEY;
  return new Response(
    JSON.stringify({ ok, model: process.env.MODEL || "gpt-4o-mini" }),
    { headers: { "Content-Type": "application/json" }, status: ok ? 200 : 500 }
  );
}

export async function POST(req) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY non configurata");
    }
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await client.chat.completions.create({
      model: process.env.MODEL || "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    });

    const text =
      completion?.choices?.[0]?.message?.content || "Nessuna risposta.";
    return new Response(JSON.stringify({ reply: text }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e?.message || "Errore server" }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
}
