module.exports = async function (context, req) {
  const HOP_NAME = process.env.HOP_NAME || "unknown-hop";
  const NEXT_HOP_URL = process.env.NEXT_HOP_URL || null;
  const PREV_HOP_URL = process.env.PREV_HOP_URL || null;
  const DELAY_MS = parseInt(process.env.DELAY_MS || "0", 10);
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || null;
  const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  const urlPath = req.originalUrl || "/api/muttr";

  const direction = req.headers["x-direction"] || "forward";

  const origin = req.headers.origin;
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Direction, X-Hop-Chain, X-Hop-Log"
  };

  function setResponse(status, headers, body) {
    context.res = {
      status,
      headers: { ...corsHeaders, ...headers },
      body
    };
  }

  if (req.method === "OPTIONS") {
    setResponse(204, {}, null);
    return;
  }

  const body =
    req.rawBody ||
    (typeof req.body === "string"
      ? req.body
      : req.body
      ? JSON.stringify(req.body)
      : "");

  const hopsSoFar = req.headers["x-hop-chain"];
  const hopLabel = `${HOP_NAME}(${direction})`;
  const newChain = hopsSoFar ? `${hopsSoFar},${hopLabel}` : hopLabel;

  const prevLog = req.headers["x-hop-log"] || "";
  const currentHopLogLine = JSON.stringify({
    hop: HOP_NAME,
    direction,
    path: urlPath,
    delay_ms: DELAY_MS,
    chain: newChain,
    timestamp: new Date().toISOString()
  });
  const newLog = prevLog ? `${prevLog}\n${currentHopLogLine}` : currentHopLogLine;

  context.log(currentHopLogLine);

  if (DELAY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  async function callHop(targetUrl, newDirection, bodyStr) {
    const headers = {
      "Content-Type": "text/plain",
      "X-Hop-Chain": newChain,
      "X-Hop-Log": newLog,
      "X-Direction": newDirection
    };

    let resp;
    try {
      resp = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: bodyStr
      });
    } catch (err) {
      context.log.error(`Failed to contact hop ${targetUrl}:`, err);
      setResponse(
        502,
        {
          "Content-Type": "text/plain",
          "X-Hop-Chain": newChain,
          "X-Hop-Log": `${newLog}\n${JSON.stringify({ error: String(err) })}`
        },
        `Failed to reach hop at ${targetUrl}`
      );
      return;
    }

    const text = await resp.text();
    const respHopChain = resp.headers.get("x-hop-chain") || newChain;
    const respHopLog = resp.headers.get("x-hop-log") || newLog;

    setResponse(
      resp.status,
      {
        "Content-Type": resp.headers.get("content-type") || "text/plain",
        "X-Hop-Chain": respHopChain,
        "X-Hop-Log": respHopLog
      },
      text
    );
  }

  if (direction === "forward") {
    if (NEXT_HOP_URL) {
      return callHop(NEXT_HOP_URL, "forward", body);
    }

    if (!OPENROUTER_API_KEY) {
      setResponse(500, {}, "OPENROUTER_API_KEY not configured on this app.");
      return;
    }

    const userMessage =
      body ||
      "You are a chaotic todo-list game of telephone. Repeat and mutate this list as you see fit.";

    const openRouterReqBody = {
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "user",
          content: userMessage
        }
      ]
    };

    let orResp;
    try {
      orResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://yourdomain.example",
          "X-Title": "muttr"
        },
        body: JSON.stringify(openRouterReqBody)
      });
    } catch (err) {
      context.log.error("OpenRouter call failed:", err);
      setResponse(
        502,
        {
          "Content-Type": "text/plain",
          "X-Hop-Chain": newChain,
          "X-Hop-Log": `${newLog}\n${JSON.stringify({ error: String(err) })}`
        },
        "Failed to reach OpenRouter"
      );
      return;
    }

    const orText = await orResp.text();

    if (PREV_HOP_URL) {
      return callHop(PREV_HOP_URL, "return", orText);
    }

    setResponse(
      200,
      {
        "Content-Type": "application/json",
        "X-Hop-Chain": newChain,
        "X-Hop-Log": newLog
      },
      orText
    );
    return;
  }

  if (direction === "return") {
    const llmResponseBody = body;

    if (PREV_HOP_URL) {
      return callHop(PREV_HOP_URL, "return", llmResponseBody);
    }

    let parsed;
    try {
      parsed = JSON.parse(llmResponseBody);
    } catch (err) {
      parsed = { raw: llmResponseBody };
    }

    let assistantText = "(no assistant text)";
    try {
      const choice = parsed.choices && parsed.choices[0];
      if (choice && choice.message && choice.message.content) {
        const c = choice.message.content;
        if (typeof c === "string") {
          assistantText = c;
        } else if (Array.isArray(c)) {
          assistantText = c
            .map((part) => (typeof part === "string" ? part : part.text || ""))
            .join("");
        }
      }
    } catch (e) {
      assistantText = `(error extracting assistant text: ${e})`;
    }

    const responseBody = JSON.stringify(
      {
        phase: "completed-there-and-back",
        hop_chain: newChain,
        hop_log: newLog.split("\n").map((line) => {
          try {
            return JSON.parse(line);
          } catch (err) {
            return { raw: line };
          }
        }),
        assistant_text: assistantText,
        openrouter_response: parsed
      },
      null,
      2
    );

    setResponse(
      200,
      {
        "Content-Type": "application/json",
        "X-Hop-Chain": newChain,
        "X-Hop-Log": newLog
      },
      responseBody
    );
    return;
  }

  setResponse(500, {}, "Invalid direction state");
};
