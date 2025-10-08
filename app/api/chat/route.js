// app/api/chat/route.js
import OpenAI from "openai";

// Se nei Runtime Logs Edge desse problemi, cambia in: "nodejs"
export const runtime = "edge";

/* ---------------- CORS comuni ---------------- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function OPTIONS() {
  // preflight
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
/* --------------------------------------------- */

// Prompt commerciale (puoi sovrascriverlo con la env SYSTEM_PROMPT)
const systemPrompt =
  process.env.SYSTEM_PROMPT ??
  `Sei ExaoraGPT, l’assistente commerciale di Exaora.
Obiettivo: trasformare la conversazione in una consulenza introduttiva (30–45 min).
Stile: italiano, chiaro, professionale, concreto. Frasi brevi.
Cosa fai:
- Qualifichi in 2-3 domande (settore, dimensioni, urgenza).
- Proponi il servizio Exaora adeguato (AI consulting, cybersecurity/NIS2, privacy/GDPR, cloud/IT, formazione).
- Elenchi 3 benefici specifici e un mini-caso d’uso.
- Chiudi sempre con una domanda-CTA: “Vuoi una call gratuita di 30 minuti? Dimmi nome, azienda ed email.”`;

// Diagnostica rapida in GET
export async function GET() {
  const ok = Boolean(process.env.OPENAI_API_KEY);
  return new Response(
    JSON.stringify({ ok, model: process.env.MODEL || "gpt-4o-mini" }),
    { headers: { "Content-Type": "application/json", ...CORS_HEADERS }, status: ok ? 200 : 500 }
  );
}

export async function POST(req) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY non configurata");
    }

    // Body: { messages: [{role:'user'|'assistant'|'system', content:'...'}] }
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await client.chat.completions.create({
      model: process.env.MODEL || "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "system", content: systemPrompt }, ...messages]
    });

    let text = completion?.choices?.[0]?.message?.content || "Nessuna risposta.";

    // CTA commerciale di sicurezza: se manca, la aggiungo
    const lower = text.toLowerCase();
    if (!/(\?|prenot|call|contatt|email|appuntamento)/.test(lower)) {
      text += "\n\nTi va una **call gratuita di 30 minuti**? Dimmi **nome**, **azienda** ed **email** e ti scrivo subito.";
    }

    // ---- Email via Formspree (LEAD_WEBHOOK) - non blocca la risposta ----
    try {
      if (process.env.LEAD_WEBHOOK) {
        const lastMsg = (messages.at(-1)?.content || "").slice(0, 4000);
        const { name, email, phone } = extractContact(lastMsg);

        const payload = {
          _subject: "Nuova chat ExaoraGPT (lead)",
          name,
          email,
          phone,
          source: req.headers.get("origin") || req.headers.get("referer") || "",
          model: process.env.MODEL || "gpt-4o-mini",
          last_user_message: lastMsg,
          reply_preview: text.slice(0, 500),
          transcript: JSON.stringify(messages).slice(0, 60000) // limite prudenziale
        };

        // Formspree accetta JSON se specifichi Accept
        fetch(process.env.LEAD_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => {});
      }
    } catch {
      // non interrompere la chat se il webhook fallisce
    }
    // ---------------------------------------------------------------------

    return new Response(JSON.stringify({ reply: text }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      status: 200
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Errore server" }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      status: 500
    });
  }
}

/* ------------- Utilità: estrazione contatti dal testo ------------- */
function extractContact(text = "") {
  const email =
    (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || "";
  const phone =
    (text.match(/\+?\d[\d\s\-()]{6,}/) || [])[0] || "";
  const nameMatch = text.match(/\b(?:mi chiamo|nome)\s+([A-ZÀ-ÖÙ-Ý][a-zà-öù-ý']+)/i);
  const name = nameMatch ? nameMatch[1] : "";
  return { name, email, phone };
}
