const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>muttr · global todo telephone</title>
    <style>
      :root {
        color-scheme: dark light;
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top left, #1f2937, #111827 50%, #0b1120);
        color: #f9fafb;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr auto;
        padding: 1.5rem;
        gap: 1.5rem;
      }

      header {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      h1 {
        margin: 0;
        font-size: clamp(1.8rem, 3vw, 2.6rem);
      }

      main {
        display: grid;
        gap: 1.5rem;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        align-items: start;
      }

      section {
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 16px;
        padding: 1.25rem;
        box-shadow: 0 25px 45px rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(16px);
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      textarea {
        min-height: 240px;
        resize: vertical;
        width: 100%;
        padding: 0.75rem;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(15, 23, 42, 0.6);
        color: inherit;
        font-size: 0.95rem;
        line-height: 1.5;
        font-family: "Iosevka", "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      }

      button {
        appearance: none;
        border: none;
        border-radius: 999px;
        padding: 0.75rem 1.5rem;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
        background: linear-gradient(120deg, #f97316, #ec4899);
        color: white;
        box-shadow: 0 18px 30px rgba(236, 72, 153, 0.35);
      }

      button:hover:not([disabled]) {
        transform: translateY(-1px);
        box-shadow: 0 20px 40px rgba(236, 72, 153, 0.45);
      }

      button[disabled] {
        cursor: progress;
        opacity: 0.65;
        box-shadow: none;
      }

      .controls {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        font-size: 0.8rem;
        background: rgba(15, 23, 42, 0.55);
      }

      pre {
        margin: 0;
        overflow: auto;
        font-size: 0.85rem;
        line-height: 1.5;
        background: rgba(15, 23, 42, 0.6);
        border-radius: 12px;
        padding: 0.75rem;
        max-height: 360px;
      }

      .log-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 320px;
        overflow: auto;
      }

      .log-item {
        font-family: "Iosevka", "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
        font-size: 0.8rem;
        white-space: pre-wrap;
        word-break: break-word;
        background: rgba(15, 23, 42, 0.55);
        border-radius: 12px;
        padding: 0.65rem;
      }

      footer {
        opacity: 0.6;
        font-size: 0.75rem;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>muttr: the borderless todo telephone</h1>
      <p>Everything you type goes on a global sightseeing tour through a daisy-chained LLM relay.</p>
    </header>

    <main>
      <section>
        <h2>Seed the chaos</h2>
        <textarea id="seed" placeholder="Plant your initial todo vibe here...">- plan launch party
- check rocket fuel levels
- convince the parrot we're serious explorers
</textarea>
        <div class="controls">
          <button id="start">Start Global Loop</button>
          <button id="stop" disabled>Stop</button>
          <span class="badge">iteration: <span id="iterations">0</span></span>
          <span class="badge">status: <span id="status">idle</span></span>
        </div>
      </section>

      <section>
        <h2>Assistant whisper</h2>
        <pre id="assistant">(no assistant response yet)</pre>
      </section>

      <section>
        <h2>Hop chain</h2>
        <pre id="chain">(awaiting first run)</pre>
        <h3>Hop log</h3>
        <ul id="log" class="log-list"></ul>
      </section>

      <section>
        <h2>Raw OpenRouter JSON</h2>
        <pre id="raw">(awaiting data)</pre>
      </section>
    </main>

    <footer>
      <p>There is no storage. Only vibes. Powered by Cloudflare Workers + OpenRouter.</p>
    </footer>

    <script>
      const seed = document.querySelector('#seed');
      const startBtn = document.querySelector('#start');
      const stopBtn = document.querySelector('#stop');
      const iterationsEl = document.querySelector('#iterations');
      const statusEl = document.querySelector('#status');
      const assistantEl = document.querySelector('#assistant');
      const chainEl = document.querySelector('#chain');
      const logEl = document.querySelector('#log');
      const rawEl = document.querySelector('#raw');

      let running = false;
      let iteration = 0;
      let currentPayload = '';

      function setStatus(text) {
        statusEl.textContent = text;
      }

      function updateUI(result) {
        if (!result) return;
        assistantEl.textContent = result.assistant_text || '(no assistant text)';
        chainEl.textContent = result.hop_chain || '(no chain)';
        iterationsEl.textContent = iteration;
        rawEl.textContent = JSON.stringify(result.openrouter_response, null, 2);

        logEl.innerHTML = '';
        (result.hop_log || []).forEach((entry) => {
          const li = document.createElement('li');
          li.className = 'log-item';
          li.textContent = JSON.stringify(entry, null, 2);
          logEl.appendChild(li);
        });
      }

      async function runOnce(payload) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        try {
          const response = await fetch('/api/hop', {
            method: 'POST',
            headers: {
              'content-type': 'text/plain; charset=utf-8',
              'X-Muttr-Direction': 'forward',
            },
            body: payload,
            signal: controller.signal,
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(`Hop failed: ${response.status} ${text}`);
          }

          const result = await response.json();
          iteration += 1;
          updateUI(result);
          return result.assistant_text || '';
        } finally {
          clearTimeout(timeout);
        }
      }

      async function loop() {
        if (!running) return;
        setStatus('in-flight');
        try {
          currentPayload = await runOnce(currentPayload);
          if (!running) return;
          setStatus('waiting');
          requestAnimationFrame(loop);
        } catch (error) {
          console.error(error);
          setStatus('error');
          startBtn.disabled = false;
          stopBtn.disabled = true;
          running = false;
        }
      }

      startBtn.addEventListener('click', () => {
        if (running) return;
        running = true;
        iteration = 0;
        currentPayload = seed.value.trim() || '(empty seed)';
        startBtn.disabled = true;
        stopBtn.disabled = false;
        setStatus('booting');
        loop();
      });

      stopBtn.addEventListener('click', () => {
        running = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        setStatus('stopped');
      });
    </script>
  </body>
</html>`;

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseBody(rawBody) {
  if (!rawBody) return '';
  try {
    const parsed = JSON.parse(rawBody);
    if (typeof parsed === 'string') {
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.message === 'string') {
        return parsed.message;
      }
      if (Array.isArray(parsed.messages)) {
        return JSON.stringify(parsed.messages, null, 2);
      }
      return JSON.stringify(parsed, null, 2);
    }
  } catch (error) {
    // swallow; treat as plain text
  }
  return rawBody;
}

function appendChain(chain, hopName, direction) {
  const suffix = `${hopName}(${direction})`;
  if (!chain) return suffix;
  return `${chain} -> ${suffix}`;
}

function appendLog(log, entry) {
  return log ? `${log}\n${entry}` : entry;
}

function makeLogEntry({ hopName, direction, request, extra }) {
  const cf = request.cf || {};
  const payload = {
    hop: hopName,
    direction,
    ts: new Date().toISOString(),
    colo: cf.colo || 'unknown',
    country: cf.country || 'unknown',
    asn: cf.asn || 'unknown',
    ip: request.headers.get('cf-connecting-ip') || 'unknown',
    ...extra,
  };
  return JSON.stringify(payload);
}

async function callHop(url, direction, body, { chain, log, contentType, requestInitExtra = {} }) {
  const headers = new Headers(requestInitExtra.headers || {});
  headers.set('X-Muttr-Direction', direction);
  if (chain) headers.set('X-Hop-Chain', chain);
  if (log) headers.set('X-Hop-Log', log);
  if (contentType) headers.set('content-type', contentType);

  const response = await fetch(url, {
    method: 'POST',
    body,
    headers,
    ...requestInitExtra,
  });

  return response;
}

async function handleForward({ rawBody, env, request, chain, log, contentType }) {
  const hopName = env.HOP_NAME || 'unknown-hop';
  const nextHop = env.NEXT_HOP_URL;
  const prevHop = env.PREV_HOP_URL;
  const delay = parseInt(env.DELAY_MS || '0', 10);

  if (delay > 0) {
    await sleep(delay);
  }

  if (nextHop) {
    const response = await callHop(nextHop, 'forward', rawBody, {
      chain,
      log,
      contentType,
    });
    return response;
  }

  // Final forward hop → call OpenRouter
  const prompt = parseBody(rawBody);
  const model = env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const headers = new Headers({
    'content-type': 'application/json',
    Accept: 'application/json',
  });

  if (env.OPENROUTER_API_KEY) {
    headers.set('Authorization', `Bearer ${env.OPENROUTER_API_KEY}`);
  }

  if (env.OPENROUTER_SITE) {
    headers.set('HTTP-Referer', env.OPENROUTER_SITE);
  }

  if (env.OPENROUTER_APP) {
    headers.set('X-Title', env.OPENROUTER_APP);
  }

  const openRouterBody = JSON.stringify({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are muttr, a global todo list that mutates each time it travels across the planet. Embrace playful chaos while keeping tasks actionable.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers,
    body: openRouterBody,
  });

  const text = await response.text();

  if (!response.ok) {
    const errorBody = JSON.stringify(
      {
        error: 'OpenRouter call failed',
        status: response.status,
        body: text,
      },
      null,
      2,
    );

    if (!prevHop) {
      return new Response(errorBody, {
        status: 502,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      });
    }

    return callHop(prevHop, 'return', errorBody, {
      chain,
      log,
      contentType: 'application/json; charset=utf-8',
    });
  }

  if (!prevHop) {
    return new Response(text, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    });
  }

  return callHop(prevHop, 'return', text, {
    chain,
    log,
    contentType: 'application/json; charset=utf-8',
  });
}

function extractAssistantText(parsed) {
  try {
    const choice = parsed?.choices?.[0];
    const message = choice?.message;
    if (!message) return '(no assistant message found)';
    const content = message.content;
    if (!content) return '(no assistant content)';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (!part) return '';
          if (typeof part === 'string') return part;
          if (typeof part.text === 'string') return part.text;
          if (part.type === 'text' && typeof part.value === 'string') return part.value;
          return '';
        })
        .join('');
    }
    if (typeof content === 'object') {
      return JSON.stringify(content);
    }
  } catch (error) {
    return `(error extracting assistant text: ${error})`;
  }
  return '(unknown assistant format)';
}

async function handleReturn({ rawBody, env, request, chain, log }) {
  const prevHop = env.PREV_HOP_URL;

  if (prevHop) {
    return callHop(prevHop, 'return', rawBody, {
      chain,
      log,
      contentType: request.headers.get('content-type') || 'application/json; charset=utf-8',
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch (error) {
    parsed = { raw: rawBody };
  }

  const assistantText = extractAssistantText(parsed);
  const responseBody = JSON.stringify(
    {
      phase: 'completed-there-and-back',
      hop_chain: chain,
      hop_log: log
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (error) {
            return { raw: line };
          }
        }),
      assistant_text: assistantText,
      openrouter_response: parsed,
    },
    null,
    2,
  );

  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  if (chain) headers.set('X-Hop-Chain', chain);
  if (log) headers.set('X-Hop-Log', log);

  return new Response(responseBody, {
    status: 200,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(html, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/hop') {
      const hopName = env.HOP_NAME || 'unknown-hop';
      const direction = request.headers.get('X-Muttr-Direction') || 'forward';
      const incomingChain = request.headers.get('X-Hop-Chain') || '';
      const incomingLog = request.headers.get('X-Hop-Log') || '';
      const rawBody = await request.text();
      const contentType = request.headers.get('content-type') || 'text/plain; charset=utf-8';

      const chain = appendChain(incomingChain, hopName, direction);
      const logEntry = makeLogEntry({ hopName, direction, request });
      const log = appendLog(incomingLog, logEntry);

      if (direction === 'forward') {
        return handleForward({ rawBody, env, request, chain, log, contentType });
      }

      if (direction === 'return') {
        return handleReturn({ rawBody, env, request, chain, log });
      }

      return new Response('Invalid direction', { status: 400 });
    }

    return new Response('Not found', { status: 404 });
  },
};
