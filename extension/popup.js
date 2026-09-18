// Popup: ON/OFF toggle + current site verdict for ALL websites
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function render(enabled, data) {
  const toggle = document.getElementById('toggle');
  const onoff = document.getElementById('onoff');
  const badge = document.getElementById('badge');
  const urlEl = document.getElementById('url');
  const descEl = document.getElementById('desc');
  const reasonsEl = document.getElementById('reasons');

  toggle.classList.toggle('on', enabled);
  onoff.textContent = enabled ? '● ON — watching all websites' : '○ OFF — protection paused, browsing freely';

  if (!enabled) {
    badge.className = 'badge off';
    badge.textContent = 'OFF';
    urlEl.textContent = data?.url || '';
    descEl.textContent = 'Copilot is OFF. No checks, no blocks. Turn ON to auto-watch and auto-block suspicious sites.';
    reasonsEl.innerHTML = '';
    return;
  }

  if (!data) {
    badge.className = 'badge safe';
    badge.textContent = '…';
    descEl.textContent = 'Open any website — Copilot watches it automatically.';
    return;
  }

  urlEl.textContent = data.url || '';
  const v = data.verdict || 'safe';
  badge.className = 'badge ' + v;
  badge.textContent = v === 'safe' ? `SAFE ✅ (${data.score})` : v === 'suspicious' ? `SUSPICIOUS ⚠️ (${data.score})` : `HARMFUL ⛔ (${data.score})`;
  descEl.textContent = data.description || '';
  reasonsEl.innerHTML = '';
  (data.reasons || []).forEach((r) => {
    const li = document.createElement('li');
    li.textContent = r;
    reasonsEl.appendChild(li);
  });
}

async function load() {
  const tab = await getActiveTab();
  const res = await chrome.runtime.sendMessage({ type: 'GET_STATE', tabId: tab?.id, url: tab?.url });
  render(res.enabled, res.verdictData || (tab?.url ? { url: tab.url, verdict: 'safe', score: 90, reasons: [], description: 'New tab — open any website to get verdict.' } : null));

  document.getElementById('toggle').onclick = async () => {
    const next = !(res.enabled === true);
    await chrome.runtime.sendMessage({ type: 'SET_ENABLED', enabled: next });
    res.enabled = next;
    // refresh verdict display
    const fresh = await chrome.runtime.sendMessage({ type: 'GET_STATE', tabId: tab?.id, url: tab?.url });
    render(fresh.enabled, fresh.verdictData);
  };

  document.getElementById('recheck').onclick = async () => {
    if (!tab?.url) return;
    const live = await chrome.runtime.sendMessage({ type: 'CHECK_URL', url: tab.url });
    const cur = await chrome.runtime.sendMessage({ type: 'GET_STATE', tabId: tab?.id, url: tab?.url });
    render(cur.enabled, live);
  };
}

document.addEventListener('DOMContentLoaded', load);
