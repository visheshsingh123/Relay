// Vercel Serverless Function: /api/groq
// Multi-key rotation and model fallback for Groq API keys configured in Vercel Environment Variables.

function getAllApiKeys() {
  const keys = [];

  const addKeys = (str) => {
    if (!str || typeof str !== "string") return;
    str.split(/[\s,\n]+/).forEach((k) => {
      const trimmed = k.trim();
      if (trimmed && !keys.includes(trimmed)) {
        keys.push(trimmed);
      }
    });
  };

  // 1. Explicit environment variables as named in Vercel
  addKeys(process.env.GROQ_API_KEY);
  addKeys(process.env.GROQ_API_KEY1);
  addKeys(process.env.GROQ_API_KEY2);
  addKeys(process.env.GROQ_API_KEY3);
  addKeys(process.env.GROQ_API_KEYS);
  addKeys(process.env.GROQ_API_KEY_1);
  addKeys(process.env.GROQ_API_KEY_2);

  // 2. Scan process.env dynamically for any GROQ_* or AI_API_KEY_*
  Object.keys(process.env).forEach((envVar) => {
    if (/^(GROQ_API_KEY|GROQ_KEY|AI_API_KEY)/i.test(envVar)) {
      addKeys(process.env[envVar]);
    }
  });

  return keys;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKeys = getAllApiKeys();
  if (apiKeys.length === 0) {
    return res.status(500).json({
      error: "No GROQ API key found in Vercel environment variables (GROQ_API_KEY, GROQ_API_KEY1, GROQ_API_KEY2)."
    });
  }

  try {
    const { messages, model = "llama-3.3-70b-versatile", temperature = 0.7, max_tokens = 1024 } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request. 'messages' array is required." });
    }

    const GROQ_MODELS = [
      model,
      "qwen/qwen3.6-27b",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "groq/compound"
    ];

    const targetModels = Array.from(new Set(GROQ_MODELS));
    let lastError = null;

    // Multi-key and multi-model rotation matrix
    for (const key of apiKeys) {
      for (const targetModel of targetModels) {
        try {
          const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: targetModel,
              messages,
              temperature,
              max_tokens
            })
          });

          if (groqResponse.ok) {
            const data = await groqResponse.json();
            return res.status(200).json(data);
          } else {
            const errData = await groqResponse.json().catch(() => ({}));
            lastError = errData;
            console.warn(`[Vercel Groq] Key (ending ...${key.slice(-4)}) on model ${targetModel} status ${groqResponse.status}:`, errData);
          }
        } catch (err) {
          lastError = err.message;
        }
      }
    }

    return res.status(502).json({
      error: "All Groq API keys or models failed / rate-limited.",
      details: lastError
    });

  } catch (error) {
    console.error("[Vercel Groq API Error]:", error);
    return res.status(500).json({ error: "Internal server error.", message: error.message });
  }
}
