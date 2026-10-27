(() => {
  'use strict';
  const { normalizeState } = globalThis.PurpleBook;
  let state = normalizeState(null);
  const toggle = document.getElementById('toggle');
  const slash = document.getElementById('slash-toggle');
  const status = document.getElementById('status');
  function render() {
    for (const [button, on] of [[toggle, state.pureMode], [slash, state.features.slashSearch]]) {
      button.classList.toggle('on', on);
      button.setAttribute('aria-checked', String(on));
    }
  }
  async function save(next) {
    try {
      await chrome.storage.sync.set(next);
      status.textContent = '';
    } catch (error) {
      status.textContent = '保存失败，请重试。';
      console.warn('[PurpleBook Lite] 保存设置失败。', error);
    }
  }
  toggle.addEventListener('click', () => save({ pureMode: !state.pureMode }));
  slash.addEventListener('click', () => save({ features: { slashSearch: !state.features.slashSearch } }));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    state = normalizeState({
      pureMode: changes.pureMode ? changes.pureMode.newValue : state.pureMode,
      features: changes.features ? changes.features.newValue : state.features,
    });
    render();
  });
  chrome.storage.sync.get(null).then((raw) => {
    state = normalizeState(raw);
    render();
  }).catch(() => { status.textContent = '读取设置失败，请重新打开。'; });
  render();
})();
