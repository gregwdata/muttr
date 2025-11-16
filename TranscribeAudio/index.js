const os = require("os");

module.exports = async function (context, req) {
  const origin = req.headers.origin;
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  function respond(status, body, extraHeaders = {}) {
    const headers = {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    };

    context.res = {
      status,
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body)
    };
  }

  if (req.method === "OPTIONS") {
    respond(204, "");
    return;
  }

  if (req.method !== "POST") {
    respond(405, { error: "Method not allowed" });
    return;
  }

  const apiKey =
    process.env.TRANSCRIBE_OPENROUTER_API_KEY ||
    process.env.AUDIO_OPENROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    respond(500, { error: "OPENROUTER_API_KEY not configured" });
    return;
  }

  function parseBody(reqObj) {
    if (reqObj.body && typeof reqObj.body === "object") {
      if (Buffer.isBuffer(reqObj.body)) {
        try {
          return JSON.parse(reqObj.body.toString("utf8"));
        } catch (err) {
          return null;
        }
      }
      return reqObj.body;
    }
    if (typeof reqObj.body === "string" && reqObj.body.trim().length > 0) {
      try {
        return JSON.parse(reqObj.body);
      } catch (err) {
        return null;
      }
    }
    if (reqObj.rawBody) {
      if (typeof reqObj.rawBody === "string") {
        try {
          return JSON.parse(reqObj.rawBody);
        } catch (err) {
          return null;
        }
      }
      if (Buffer.isBuffer(reqObj.rawBody)) {
        try {
          return JSON.parse(reqObj.rawBody.toString("utf8"));
        } catch (err) {
          return null;
        }
      }
    }
    return null;
  }

  const payload = parseBody(req);
  if (!payload || typeof payload !== "object") {
    respond(400, { error: "JSON body required" });
    return;
  }

  const audio = payload.audio;
  if (!audio || typeof audio.data !== "string") {
    respond(400, { error: "audio.data (base64) is required" });
    return;
  }

  const sanitizedBase64 = audio.data.trim().replace(/^data:.*?;base64,/i, "");
  if (!sanitizedBase64) {
    respond(400, { error: "audio.data must be a base64 string" });
    return;
  }

  const requestedFormat =
    typeof audio.format === "string" ? audio.format.trim().toLowerCase() : "";
  const allowedFormats = new Set(["wav", "mp3"]);
  const format = requestedFormat && allowedFormats.has(requestedFormat)
    ? requestedFormat
    : requestedFormat
    ? null
    : "wav";

  if (!format) {
    respond(400, { error: "Unsupported audio format. Use wav or mp3." });
    return;
  }

  const prompt =
    typeof payload.prompt === "string" && payload.prompt.trim().length > 0
      ? payload.prompt.trim()
      : "Transcribe this audio exactly as spoken and return just the text.";

  const target =
    typeof payload.target === "string" && payload.target.trim().length > 0
      ? payload.target.trim()
      : "seed";

  const defaultModel =
    process.env.TRANSCRIBE_OPENROUTER_MODEL ||
    process.env.AUDIO_TRANSCRIBE_MODEL ||
    "google/gemini-2.0-flash-lite-001";

  const model =
    typeof payload.model === "string" && payload.model.trim().length > 0
      ? payload.model.trim()
      : defaultModel;

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

  function deriveHostname() {
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

  function deriveProtocol() {
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

  const refererHost = deriveHostname();
  const refererProtocol = deriveProtocol();
  const refererHeaderValue = refererHost.includes("://")
    ? refererHost
    : `${refererProtocol}://${refererHost}`;

  const openRouterPayload = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "input_audio",
            input_audio: {
              data: sanitizedBase64,
              format
            }
          }
        ]
      }
    ]
  };

  let orResp;
  try {
    orResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": refererHeaderValue,
        "X-Title": "muttr-audio-transcribe"
      },
      body: JSON.stringify(openRouterPayload)
    });
  } catch (err) {
    context.log.error("OpenRouter transcription call failed", err);
    respond(502, { error: "Failed to reach OpenRouter" });
    return;
  }

  const rawText = await orResp.text();
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    context.log.error("OpenRouter transcription returned non-JSON", rawText);
    respond(502, { error: "Invalid JSON from OpenRouter", raw: rawText });
    return;
  }

  if (!orResp.ok) {
    respond(orResp.status, { error: "OpenRouter error", openrouter: parsed });
    return;
  }

  function extractTranscript(response) {
    const choice = response && response.choices && response.choices[0];
    if (!choice || !choice.message) {
      return "";
    }
    const content = choice.message.content;
    if (typeof content === "string") {
      return content.trim();
    }
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }
          if (part && typeof part === "object" && typeof part.text === "string") {
            return part.text;
          }
          return "";
        })
        .join("")
        .trim();
    }
    if (content && typeof content.text === "string") {
      return content.text.trim();
    }
    return "";
  }

  const transcript = extractTranscript(parsed);

  if (!transcript) {
    respond(502, { error: "Transcription response did not include text", openrouter: parsed });
    return;
  }

  respond(200, {
    text: transcript,
    target,
    model,
    prompt,
    openrouter: parsed
  });
};
