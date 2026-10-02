// Vercel Serverless Function: /api/brave
// Keeps your BRAVE_API_KEY secure in Vercel Environment Variables. Supports multi-key fallback.

function getBraveApiKeys() {
  const keys = [];
  const addKeys = (str) => {
    if (!str || typeof str !== "string") return;
    str.split(/[\s,\n]+/).forEach((k) => {
      const trimmed = k.trim();
      if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
    });
  };

  addKeys(process.env.BRAVE_API_KEY);
  addKeys(process.env.BRAVE_API_KEYS);
  addKeys(process.env.BRAVE_API_KEY_1);
  addKeys(process.env.BRAVE_API_KEY_2);

  Object.keys(process.env).forEach((envVar) => {
    if (/^BRAVE_API_KEY/i.test(envVar)) {
      addKeys(process.env[envVar]);
    }
  });

  return keys;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const apiKeys = getBraveApiKeys();
  if (apiKeys.length === 0) {
    return res.status(500).json({ 
      error: "BRAVE_API_KEY environment variable is not set in Vercel project settings." 
    });
  }

  try {
    const query = req.query.q || (req.body && req.body.q);
    if (!query) {
      return res.status(400).json({ error: "Search query 'q' parameter is required." });
    }

    const count = req.query.count || (req.body && req.body.count) || 5;
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;

    let lastError = null;

    for (const key of apiKeys) {
      try {
        const braveRes = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": key
          }
        });

        if (braveRes.ok) {
          const data = await braveRes.json();
          return res.status(200).json(data);
        } else {
          lastError = await braveRes.text();
          console.warn(`[Vercel Brave] Key fallback on status ${braveRes.status}:`, lastError);
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    return res.status(502).json({ error: "All Brave Search API keys failed or rate-limited.", details: lastError });

  } catch (err) {
    console.error("[Vercel Brave API Error]:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
}
