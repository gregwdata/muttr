const os = require("os");

module.exports = async function (context, req) {
  const HOP_NAME = process.env.HOP_NAME || "unknown-hop";
  const NEXT_HOP_URL = process.env.NEXT_HOP_URL || null;
  const PREV_HOP_URL = process.env.PREV_HOP_URL || null;
  const DELAY_MS = parseInt(process.env.DELAY_MS || "0", 10);
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || null;
  const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const DEFAULT_SYSTEM_PROMPT =
    "You are a chaotic todo-list game of telephone. Repeat and mutate this list as you see fit.";

  const urlPath = req.originalUrl || "/api/muttr";

  const direction = req.headers["x-direction"] || "forward";
  const incomingContentType = req.headers["content-type"] || "text/plain";

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

  function parseHopLogHeader(value) {
    if (!value) {
      return [];
    }

    let stringValue = value;
    if (Array.isArray(stringValue)) {
      stringValue = stringValue.join("\n");
    }

    stringValue = String(stringValue).trim();
    if (!stringValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(stringValue);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) =>
          typeof entry === "string" ? entry : JSON.stringify(entry)
        );
      }
    } catch (err) {
      // Not JSON – fall back to newline-delimited parsing below.
    }

    return stringValue
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  const prevLogLines = parseHopLogHeader(req.headers["x-hop-log"]);
  const currentHopLogLine = JSON.stringify({
    hop: HOP_NAME,
    direction,
    path: urlPath,
    delay_ms: DELAY_MS,
    chain: newChain,
    timestamp: new Date().toISOString()
  });
  const newLogLines = [...prevLogLines, currentHopLogLine];
  const newLogHeader = JSON.stringify(newLogLines);

  context.log(currentHopLogLine);

  if (DELAY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  function safeParseUrl(value) {
    if (!value) {
      return null;
    }

    try {
      return new URL(value);
    } catch (err) {
      return null;
    }
  }

  function deriveSelfHostname() {
    const originUrl = safeParseUrl(origin);

    const candidates = [
      process.env.MUTTR_HOSTNAME,
      process.env.WEBSITE_HOSTNAME,
      req.headers["x-appservice-hostname"],
      req.headers.host,
      originUrl ? originUrl.host : null
    ]
      .map((value) => (value ? String(value).trim() : ""))
      .filter((value) => value.length > 0);

    if (candidates.length > 0) {
      return candidates[0];
    }

    return os.hostname();
  }

  function deriveSelfProtocol() {
    let forwardedProtoHeader = req.headers["x-forwarded-proto"];
    if (Array.isArray(forwardedProtoHeader)) {
      forwardedProtoHeader = forwardedProtoHeader[0];
    }

    const forwardedProto = forwardedProtoHeader
      ? String(forwardedProtoHeader).split(",")[0].trim()
      : null;

    const originUrl = safeParseUrl(origin);
    const originProtocol = originUrl && originUrl.protocol
      ? originUrl.protocol.replace(/:$/, "")
      : null;

    const protocol = forwardedProto || originProtocol || "https";
    return protocol.replace(/:$/, "");
  }

  async function callHop(targetUrl, newDirection, bodyStr, contentType = "text/plain") {
    const headers = {
      "Content-Type": contentType,
      "X-Hop-Chain": newChain,
      "X-Hop-Log": newLogHeader,
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
      const errorLogLines = [
        ...newLogLines,
        JSON.stringify({ error: String(err) })
      ];
      const errorLogHeader = JSON.stringify(errorLogLines);
      setResponse(
        502,
        {
          "Content-Type": "text/plain",
          "X-Hop-Chain": newChain,
          "X-Hop-Log": errorLogHeader
        },
        `Failed to reach hop at ${targetUrl}`
      );
      return;
    }

    const text = await resp.text();
    const respHopChain = resp.headers.get("x-hop-chain") || newChain;
    const respHopLogLines = parseHopLogHeader(resp.headers.get("x-hop-log"));
    const respHopLog =
      respHopLogLines.length > 0
        ? JSON.stringify(respHopLogLines)
        : newLogHeader;

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
      return callHop(NEXT_HOP_URL, "forward", body, incomingContentType);
    }

    if (!OPENROUTER_API_KEY) {
      setResponse(500, {}, "OPENROUTER_API_KEY not configured on this app.");
      return;
    }

    let parsedPayload = null;
    if (body) {
      try {
        parsedPayload = JSON.parse(body);
      } catch (err) {
        parsedPayload = null;
      }
    }

    function normalizeMessage(msg) {
      if (!msg || typeof msg !== "object") {
        return null;
      }

      const role = typeof msg.role === "string" ? msg.role.trim().toLowerCase() : null;
      if (!role) {
        return null;
      }

      let content = msg.content;
      if (Array.isArray(content)) {
        content = content
          .map((part) => {
            if (typeof part === "string") {
              return part;
            }
            if (part && typeof part === "object" && typeof part.text === "string") {
              return part.text;
            }
            return "";
          })
          .join("");
      }

      if (content === undefined || content === null) {
        return null;
      }

      if (typeof content !== "string") {
        content = String(content);
      }

      const trimmed = content.trim();
      if (!trimmed) {
        return null;
      }

      return { role, content: trimmed };
    }

    function extractMessagesFromPayload(payload) {
      if (!payload || typeof payload !== "object") {
        return null;
      }

      if (Array.isArray(payload.messages)) {
        const normalized = payload.messages
          .map(normalizeMessage)
          .filter((entry) => entry !== null);
        if (normalized.length > 0) {
          return normalized;
        }
      }

      const systemPrompt =
        typeof payload.system_prompt === "string"
          ? payload.system_prompt
          : typeof payload.systemPrompt === "string"
          ? payload.systemPrompt
          : null;

      const userMessagesRaw = Array.isArray(payload.user_messages)
        ? payload.user_messages
        : Array.isArray(payload.userMessages)
        ? payload.userMessages
        : [];

      const normalizedUsers = userMessagesRaw
        .map((entry) => {
          if (typeof entry === "string") {
            return entry;
          }
          if (entry && typeof entry === "object" && typeof entry.content === "string") {
            return entry.content;
          }
          return null;
        })
        .filter((entry) => typeof entry === "string" && entry.trim().length > 0);

      if (!systemPrompt && normalizedUsers.length === 0) {
        return null;
      }

      const messages = [];
      if (systemPrompt && systemPrompt.trim().length > 0) {
        messages.push({ role: "system", content: systemPrompt.trim() });
      }
      messages.push(
        ...normalizedUsers.map((content) => ({ role: "user", content: content.trim() }))
      );

      return messages.length > 0 ? messages : null;
    }

    let requestMessages = extractMessagesFromPayload(parsedPayload);
    if (!requestMessages) {
      const fallbackUser = typeof body === "string" && body.trim().length > 0 ? body.trim() : null;
      requestMessages = [
        { role: "system", content: DEFAULT_SYSTEM_PROMPT },
        { role: "user", content: fallbackUser || DEFAULT_SYSTEM_PROMPT }
      ];
    }

    const allowedForwardKeys = [
      "response_format",
      "stop",
      "stream",
      "max_tokens",
      "temperature",
      "tools",
      "tool_choice",
      "seed",
      "top_p",
      "top_k",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "logit_bias",
      "top_logprobs",
      "min_p",
      "top_a",
      "prediction",
      "transforms",
      "models",
      "route",
      "provider",
      "user"
    ];

    const requestModel =
      parsedPayload && typeof parsedPayload.model === "string" && parsedPayload.model.trim().length > 0
        ? parsedPayload.model.trim()
        : OPENROUTER_MODEL;

    const openRouterReqBody = {
      model: requestModel,
      messages: requestMessages
    };

    if (parsedPayload && typeof parsedPayload === "object") {
      allowedForwardKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(parsedPayload, key)) {
          openRouterReqBody[key] = parsedPayload[key];
        }
      });
    }

    const refererHost = deriveSelfHostname();
    const refererProtocol = deriveSelfProtocol();
    const refererHeaderValue = refererHost.includes("://")
      ? refererHost
      : `${refererProtocol}://${refererHost}`;

    let orResp;
    try {
      orResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": refererHeaderValue,
          "X-Title": "muttr"
        },
        body: JSON.stringify(openRouterReqBody)
      });
    } catch (err) {
      context.log.error("OpenRouter call failed:", err);
      const errorLogLines = [
        ...newLogLines,
        JSON.stringify({ error: String(err) })
      ];
      const errorLogHeader = JSON.stringify(errorLogLines);
      setResponse(
        502,
        {
          "Content-Type": "text/plain",
          "X-Hop-Chain": newChain,
          "X-Hop-Log": errorLogHeader
        },
        "Failed to reach OpenRouter"
      );
      return;
    }

    const orText = await orResp.text();

    if (PREV_HOP_URL) {
      return callHop(PREV_HOP_URL, "return", orText, "application/json");
    }

    setResponse(
      200,
      {
        "Content-Type": "application/json",
        "X-Hop-Chain": newChain,
        "X-Hop-Log": newLogHeader
      },
      orText
    );
    return;
  }

  if (direction === "return") {
    const llmResponseBody = body;

    if (PREV_HOP_URL) {
      return callHop(PREV_HOP_URL, "return", llmResponseBody, "application/json");
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
        hop_log: newLogLines.map((line) => {
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
        "X-Hop-Log": newLogHeader
      },
      responseBody
    );
    return;
  }

  setResponse(500, {}, "Invalid direction state");
};
