// Local research pipeline on Ollama: plan queries -> search the web (Bing/DDG) -> read pages -> stream a briefing.
const web = require('./websearch');

const THINKING_MODELS = /qwen3|deepseek-r1|gpt-oss|magistral/i;

async function listModels(host) {
  const res = await fetch(`${host}/api/tags`);
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const { models } = await res.json();
  return models.map((m) => m.name).filter((n) => !/embed/i.test(n));
}

function chatBody(model, messages, extra = {}) {
  const body = { model, messages, options: { num_ctx: 12288, temperature: 0.4 }, ...extra };
  // Thinking makes small models slow without helping much here; only send the flag to models that support it.
  if (THINKING_MODELS.test(model)) body.think = false;
  return body;
}

async function planQueries(host, model, topic, signal) {
  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    signal,
    body: JSON.stringify(chatBody(model, [
      { role: 'system', content: 'You write web search queries. Reply with JSON only.' },
      { role: 'user', content: `Today is ${new Date().toDateString()}. Write 3 diverse, specific web search queries to research this topic: "${topic}". Return {"queries": ["...", "...", "..."]}` },
    ], {
      stream: false,
      format: { type: 'object', properties: { queries: { type: 'array', items: { type: 'string' } } }, required: ['queries'] },
    })),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const json = await res.json();
  try {
    const q = JSON.parse(json.message.content).queries.filter((s) => typeof s === 'string' && s.trim());
    if (q.length) return q.slice(0, 3);
  } catch { /* fall back to the raw topic */ }
  return [topic];
}

async function run({ host, model, topic, system, send, signal }) {
  send({ type: 'search', query: `planning with ${model}…` });
  const queries = await planQueries(host, model, topic, signal);

  // Search each query, de-duplicate by URL.
  const results = [];
  const seen = new Set();
  for (const q of queries) {
    send({ type: 'search', query: q });
    try {
      for (const r of await web.search(q, { limit: 6, signal })) {
        if (!seen.has(r.url)) { seen.add(r.url); results.push(r); }
      }
    } catch (e) {
      if (signal.aborted) throw e;
    }
  }
  if (!results.length) throw new Error('Web search returned nothing (offline, or the search engines are rate-limiting; try again shortly).');

  // Read the top pages in parallel; fall back to the search snippet when a page can't be read.
  const top = results.slice(0, 6);
  send({ type: 'search', query: `reading ${top.length} pages…` });
  const texts = await Promise.all(top.map((r) => web.pageText(r.url, { signal })));
  const sources = top.map((r, i) => ({ ...r, text: texts[i] || r.snippet }));
  send({ type: 'sources', sources: sources.map((s) => ({ title: s.title, url: s.url })) });

  const context = sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.text}`).join('\n\n---\n\n');
  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    signal,
    body: JSON.stringify(chatBody(model, [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Today is ${new Date().toDateString()}.\nResearch topic: ${topic}\n\nWeb sources:\n\n${context}\n\n` +
          'Write the briefing now using only these sources plus well-established background knowledge. ' +
          'Cite sources inline as markdown links like [1](URL). End with "## Sources" listing the sources you used as markdown links.',
      },
    ], { stream: true })),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);

  // Ollama streams newline-delimited JSON.
  const decoder = new TextDecoder();
  let buf = '';
  let usage = null;
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      if (msg.message && msg.message.content) send({ type: 'text', delta: msg.message.content });
      if (msg.done) usage = { input_tokens: msg.prompt_eval_count, output_tokens: msg.eval_count };
    }
  }
  return usage;
}

module.exports = { run, listModels };
