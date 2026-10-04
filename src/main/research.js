// Research agent, streamed to the renderer. Two engines:
//  - "ollama": local model + DuckDuckGo search + page reading (free, offline-capable model)
//  - "anthropic": Claude with server-side web search (needs an API key)
// The answer is markdown; each "## " section is rendered as its own HUD pane.
const Anthropic = require('@anthropic-ai/sdk');
const { safeStorage } = require('electron');
const store = require('./store');
const ollama = require('./ollama');

const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';
const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';
const PREFERRED_OLLAMA = [/qwen3/i, /llama3/i, /gemma/i, /mistral/i];
const MAX_CONTINUATIONS = 4;

const SYSTEM = `You are the research core of a personal heads-up display. The user gives you a topic; research it on the web and brief them.

Output GitHub-flavoured markdown only, structured so each section can be shown as a separate panel:
- Start with a single "# " title line (short, punchy).
- Then 4-8 sections, each starting with "## " and a short heading. Always begin with "## TL;DR" (3-5 bullets) and end with "## Sources" (a bulleted list of markdown links you actually used).
- Pick the middle sections to fit the topic: e.g. Key Facts, How It Works, Timeline, Players, Numbers, Comparison (use a markdown table), Controversies, What To Watch, Practical Takeaways.
- Keep each section tight: bullets, short paragraphs, tables where data compares well. Bold the key numbers and names.
- Cite inline with markdown links to the source pages. Prefer recent, primary sources and say when information may be out of date.
Do not narrate your search process in the answer.`;

const running = new Map();

function settings() {
  return store.get('settings') || {};
}

function updateSettings(patch) {
  store.set('settings', { ...settings(), ...patch });
}

function apiKey() {
  const s = settings();
  if (s.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(s.apiKeyEnc, 'base64'));
    } catch { /* fall through to env */ }
  }
  return process.env.ANTHROPIC_API_KEY || null;
}

async function ollamaModels() {
  try {
    return await ollama.listModels(settings().ollamaHost || DEFAULT_OLLAMA_HOST);
  } catch {
    return null; // Ollama not running
  }
}

function pickOllamaModel(models) {
  const saved = settings().ollamaModel;
  if (saved && models.includes(saved)) return saved;
  for (const re of PREFERRED_OLLAMA) {
    const m = models.find((x) => re.test(x));
    if (m) return m;
  }
  return models[0] || null;
}

// Engine: explicit choice, else Claude if a key exists, else Ollama.
function provider() {
  return settings().provider || (apiKey() ? 'anthropic' : 'ollama');
}

async function getPublicSettings() {
  const s = settings();
  const models = await ollamaModels();
  const prov = provider();
  const ollamaModel = models ? pickOllamaModel(models) : null;
  const hasKey = Boolean(apiKey());
  return {
    provider: prov,
    ready: prov === 'anthropic' ? hasKey : Boolean(ollamaModel),
    engineLabel: prov === 'anthropic' ? (s.model || DEFAULT_CLAUDE_MODEL) : `ollama · ${ollamaModel || 'offline'}`,
    hasKey,
    keySource: s.apiKeyEnc ? 'saved' : process.env.ANTHROPIC_API_KEY ? 'env' : 'none',
    model: s.model || DEFAULT_CLAUDE_MODEL,
    ollamaOnline: Boolean(models),
    ollamaModels: models || [],
    ollamaModel,
  };
}

function setApiKey(key) {
  const s = settings();
  if (!key) delete s.apiKeyEnc;
  else s.apiKeyEnc = safeStorage.encryptString(key.trim()).toString('base64');
  store.set('settings', s);
  return getPublicSettings();
}

function setModel(model) {
  updateSettings({ model: model || DEFAULT_CLAUDE_MODEL });
  return getPublicSettings();
}

function setResearchEngine({ provider: prov, ollamaModel }) {
  const patch = {};
  if (prov === 'anthropic' || prov === 'ollama') patch.provider = prov;
  if (ollamaModel) patch.ollamaModel = ollamaModel;
  updateSettings(patch);
  return getPublicSettings();
}

async function runClaude(topic, send, signal) {
  const key = apiKey();
  if (!key) throw new Error('No Anthropic API key. Open settings (gear icon) to add one or switch to Ollama.');
  const client = new Anthropic({ apiKey: key });
  const messages = [{ role: 'user', content: `Research topic: ${topic}` }];
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const stream = client.beta.messages.stream({
      model: settings().model || DEFAULT_CLAUDE_MODEL,
      max_tokens: 32000,
      system: SYSTEM,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
      messages,
    }, { signal });

    stream.on('text', (delta) => send({ type: 'text', delta }));
    stream.on('contentBlock', (block) => {
      if (block.type === 'server_tool_use' && block.input && block.input.query) {
        send({ type: 'search', query: block.input.query });
      } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        send({ type: 'sources', sources: block.content.map((r) => ({ title: r.title, url: r.url })) });
      }
    });

    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw new Error('The model declined this topic.');
    // Long server-tool turns pause; resend the partial turn so Claude continues.
    if (msg.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: msg.content });
      continue;
    }
    return msg.usage;
  }
  return null;
}

async function runOllama(topic, send, signal) {
  const host = settings().ollamaHost || DEFAULT_OLLAMA_HOST;
  const models = await ollamaModels();
  if (!models) throw new Error('Ollama is not running. Start it (Ollama app in the tray) and try again.');
  const model = pickOllamaModel(models);
  if (!model) throw new Error('No Ollama chat models installed. Try: ollama pull qwen3:8b');
  return ollama.run({ host, model, topic, system: SYSTEM, send, signal });
}

async function run(sender, id, topic) {
  const send = (evt) => !sender.isDestroyed() && sender.send('research:event', { id, ...evt });
  const controller = new AbortController();
  running.set(id, controller);
  try {
    const usage = provider() === 'anthropic'
      ? await runClaude(topic, send, controller.signal)
      : await runOllama(topic, send, controller.signal);
    send({ type: 'done', usage });
  } catch (err) {
    if (controller.signal.aborted) send({ type: 'cancelled' });
    else if (err instanceof Anthropic.AuthenticationError) send({ type: 'error', message: 'API key rejected (401). Check it in settings.' });
    else if (err instanceof Anthropic.RateLimitError) send({ type: 'error', message: 'Rate limited (429). Try again in a minute.' });
    else if (err instanceof Anthropic.APIError) send({ type: 'error', message: `API error ${err.status ?? ''}: ${err.message}` });
    else send({ type: 'error', message: String(err && err.message ? err.message : err) });
  } finally {
    running.delete(id);
  }
}

function cancel(id) {
  const c = running.get(id);
  if (c) c.abort();
}

module.exports = { run, cancel, getPublicSettings, setApiKey, setModel, setResearchEngine };
