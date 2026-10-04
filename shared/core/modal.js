import { h } from './util.js';

const modal = () => document.getElementById('modal');

export function closeModal() {
  modal().hidden = true;
  modal().replaceChildren();
}

export function openModal(dialog) {
  modal().replaceChildren(dialog);
  modal().hidden = false;
  modal().onclick = (e) => e.target === modal() && closeModal();
  const first = dialog.querySelector('input, select, button');
  if (first) first.focus();
}

// Electron has no window.prompt(), so this is our own.
export function askText(title, value = '') {
  return new Promise((resolve) => {
    const input = h('input', { class: 'input', value });
    const done = (v) => { closeModal(); resolve(v); };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(input.value);
      if (e.key === 'Escape') done(null);
    });
    openModal(h('div', { class: 'dialog' }, h('h3', {}, title), input,
      h('div', { class: 'foot' },
        h('button', { class: 'btn', onclick: () => done(null) }, 'CANCEL'),
        h('button', { class: 'btn', onclick: () => done(input.value) }, 'OK'))));
    input.select();
  });
}

const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 (default, best quality)'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (faster, cheaper)'],
  ['claude-haiku-4-5', 'Claude Haiku 4.5 (fastest, cheapest)'],
];

export async function openSettings() {
  const s = await window.nexus.settings.get();
  const startup = await window.nexus.settings.startup();
  const skinInfo = await window.nexus.skins.list();
  const skin = h('select', {}, ...skinInfo.skins.map((sk) =>
    h('option', { value: sk.id, selected: sk.id === skinInfo.current }, `${sk.name}${sk.version ? ` v${sk.version}` : ''}: ${sk.description}`)));
  const keyInput = h('input', { class: 'input', type: 'password', placeholder: s.hasKey ? '•••••••• (saved, type to replace)' : 'sk-ant-…', spellcheck: 'false' });
  const keyState = h('span', { class: s.hasKey ? 'ok-text' : 'err-text' },
    s.keySource === 'saved' ? 'key saved (encrypted with Windows DPAPI)' : s.keySource === 'env' ? 'using ANTHROPIC_API_KEY env var' : 'no key set');
  const model = h('select', {}, ...MODELS.map(([id, label]) => h('option', { value: id, selected: id === s.model }, label)));
  const startupBox = h('input', { type: 'checkbox', checked: startup });
  const engine = h('select', {},
    h('option', { value: 'ollama', selected: s.provider === 'ollama' }, 'Local: Ollama + DuckDuckGo (free)'),
    h('option', { value: 'anthropic', selected: s.provider === 'anthropic' }, 'Cloud: Claude + web search (API key)'));
  const localModel = h('select', { disabled: !s.ollamaOnline },
    ...(s.ollamaOnline ? s.ollamaModels.map((m) => h('option', { value: m, selected: m === s.ollamaModel }, m)) : [h('option', {}, 'Ollama not running')]));
  const claudeBox = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    h('div', {}, h('div', { class: 'label' }, 'Anthropic API key'), keyInput),
    h('div', { class: 'note' }, keyState, ' · get one at console.anthropic.com'),
    h('div', {}, h('div', { class: 'label' }, 'Claude model'), h('div', { class: 'rowx' }, model)));
  const localBox = h('div', {},
    h('div', { class: 'label' }, 'Local model'), h('div', { class: 'rowx' }, localModel),
    h('div', { class: 'note', style: { marginTop: '6px' } }, s.ollamaOnline
      ? 'Runs on your GPU. Larger models write better briefings but run slower.'
      : h('span', { class: 'err-text' }, 'Ollama is not reachable at 127.0.0.1:11434. Start the Ollama app.')));
  const syncEngine = () => {
    claudeBox.style.display = engine.value === 'anthropic' ? 'flex' : 'none';
    localBox.style.display = engine.value === 'ollama' ? 'block' : 'none';
  };
  engine.addEventListener('change', syncEngine);
  syncEngine();

  async function saveAll() {
    if (keyInput.value.trim()) await window.nexus.settings.setApiKey(keyInput.value.trim());
    await window.nexus.settings.setModel(model.value);
    await window.nexus.settings.setEngine({ provider: engine.value, ollamaModel: s.ollamaOnline ? localModel.value : undefined });
    await window.nexus.settings.startup(startupBox.checked);
    closeModal();
    document.dispatchEvent(new CustomEvent('settings:changed'));
    if (skin.value !== skinInfo.current) window.nexus.skins.set(skin.value); // reloads into the new skin
  }

  openModal(h('div', { class: 'dialog' },
    h('h3', {}, 'SYSTEM CONFIG'),
    h('div', {}, h('div', { class: 'label' }, 'Skin'), h('div', { class: 'rowx' }, skin)),
    h('div', {}, h('div', { class: 'label' }, 'Research engine'), h('div', { class: 'rowx' }, engine)),
    localBox,
    claudeBox,
    h('label', { class: 'rowx' }, startupBox, 'Start NEXUS with Windows'),
    h('div', { class: 'note' }, 'Ctrl + Alt + Space toggles the HUD from anywhere. Closing hides it to the tray.'),
    h('div', { class: 'foot' },
      s.keySource === 'saved' ? h('button', { class: 'btn', onclick: async () => { await window.nexus.settings.setApiKey(''); closeModal(); } }, 'FORGET KEY') : null,
      h('button', { class: 'btn', onclick: closeModal }, 'CANCEL'),
      h('button', { class: 'btn', onclick: saveAll }, 'SAVE'))));
}
