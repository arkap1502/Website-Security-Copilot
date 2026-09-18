// Content script: runs on EVERY website you open, shows Copilot verdict badge.
// Only displays when Copilot is ON. Works for all websites, not just one.
(async () => {
  try {
    if (location.href.startsWith('chrome') || location.href.startsWith('about')) return;

    const res = await chrome.runtime.sendMessage({ type: 'GET_STATE', url: location.href });
    if (!res?.enabled) return; // OFF = silent

    const data = res.verdictData;
    if (!data) return;

    // avoid duplicates
    if (document.getElementById('wsc-copilot-badge')) return;

    const div = document.createElement('div');
    div.id = 'wsc-copilot-badge';
    const color = data.verdict === 'safe' ? '#16a34a' : data.verdict === 'suspicious' ? '#f59e0b' : '#dc2626';
    const label = data.verdict === 'safe' ? 'Safe ✅' : data.verdict === 'suspicious' ? 'Suspicious ⚠️' : 'Harmful ⛔';
    div.setAttribute('style', `position:fixed;top:12px;right:12px;z-index:2147483647;background:${color};color:#fff;font:700 13px Arial;padding:8px 12px;border-radius:20px;box-shadow:0 2px 10px rgba(0,0,0,.4);cursor:pointer;max-width:300px;`);
    div.textContent = `Copilot: ${label} — ${data.score}/100`;
    div.title = data.description || '';
    div.onclick = () => alert(`Website Security Copilot\n\n${location.hostname}\nVerdict: ${label}\nScore: ${data.score}/100\n\n${data.description}\n\n${(data.reasons || []).join('\n')}\n\nTurn OFF Copilot from extension popup to force-open blocked sites.`);
    document.documentElement.appendChild(div);
    setTimeout(() => { if (data.verdict === 'safe') div.style.opacity = '0.85'; }, 100);
  } catch { /* extension context invalidated */ }
})();
