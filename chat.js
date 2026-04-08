// ============================================================
// EDUCAM — Secure Serverless API Function
// This file runs on Vercel's servers — your API key is NEVER
// exposed to the browser or visible to anyone.
// ============================================================

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Read the Anthropic API key from Vercel Environment Variables
  // (You will set this in the Vercel dashboard — it never touches your code)
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "API key not configured on server." });
  }

  const { messages, system } = req.body;

  if (!messages || !system) {
    return res.status(400).json({ error: "Missing messages or system prompt." });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: system,
        messages: messages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const reply = data.content
      ? data.content.map((b) => b.text || "").join("")
      : "Sorry, I could not respond. Please try again.";

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}
