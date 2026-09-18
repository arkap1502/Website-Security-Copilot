// Website Security Copilot - Background Service Worker (MV3)
// ON/OFF Guard: when ON, auto-watches ALL websites, gives Safe/Harmful verdict, auto-blocks suspicious.
// Force-open rule: blocked page can only be bypassed when Copilot is OFF.

const DEFAULT_ENABLED = true; // Copilot ON by default after install

// ---------- storage helpers ----------
async function isEnabled() {
  const data = await chrome.storage.local.get({ copilotEnabled: DEFAULT_ENABLED });
  return data.copilotEnabled === true;
}

// ---------- heuristic verdict engine (local fast check, replace with AI/backend later) ----------
// Returns { verdict: 'safe' | 'suspicious' | 'harmful', score: 0-100 (100=safe), reasons: [], description }
function quickCheck(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { verdict: 'safe', score: 90, reasons: [], description: 'Could not parse URL, treating as unknown.' };
  }

  const reasons = [];
  let risk = 0; // higher = more dangerous
  const host = url.hostname.toLowerCase();
  const full = rawUrl.toLowerCase();

  // skip internal pages
  if (url.protocol.startsWith('chrome') || url.protocol.startsWith('edge') || url.protocol.startsWith('about') || url.protocol.startsWith('chrome-extension')) {
    return { verdict: 'safe', score: 100, reasons: [], description: 'Browser internal page. No check needed.' };
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return { verdict: 'safe', score: 95, reasons: ['Local development address'], description: 'This looks Safe — local development address with no public threat signs.' };
  }

  // 1. No HTTPS
  if (url.protocol === 'http:') {
    risk += 30;
    reasons.push('No HTTPS (uses insecure http://, login/data can be stolen)');
  }

  // 2. IP address instead of domain
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    risk += 35;
    reasons.push('Uses raw IP address instead of domain name (common in phishing/malware)');
  }

  // 3. @ trick, excessive hyphens/subdomains
  if (full.includes('@')) { risk += 25; reasons.push("Contains '@' trick in URL (hides real destination)"); }
  const hyphenCount = (host.match(/-/g) || []).length;
  if (hyphenCount >= 3) { risk += 15; reasons.push('Too many hyphens in domain (typosquat/phishing pattern)'); }
  const parts = host.split('.');
  if (parts.length >= 5) { risk += 10; reasons.push('Excessive subdomains (possible phishing cloak)'); }
  if (host.startsWith('xn--') || host.includes('xn--')) { risk += 25; reasons.push('Punycode / look-alike characters (homograph attack)'); }

  // 4. Phishing / scam keywords
  const BAD_WORDS = ['free-prize', 'free_gift', 'login-verify', 'verify-login', 'bank-secure', 'account-suspended', 'urgent-update', 'crypto-double', 'airdrop-claim', 'password-reset-bonus', 'apple-id-lock'];
  for (const w of BAD_WORDS) {
    if (full.includes(w)) { risk += 40; reasons.push(`Suspicious keyword in URL: "${w}"`); break; }
  }
  const GENERIC_BAIT = ['free', 'prize', 'winner', 'claim-now', 'urgent', 'suspended', 'verify-now'];
  let baitHits = GENERIC_BAIT.filter((w) => full.includes(w)).length;
  if (baitHits >= 2) { risk += 20; reasons.push('Multiple bait words (free/prize/urgent/verify) — typical scam lures'); }

  // 5. Weird port / long URL
  if (url.port && !['80', '443', ''].includes(url.port)) { risk += 10; reasons.push(`Unusual port :${url.port}`); }
  if (rawUrl.length > 150) { risk += 10; reasons.push('Abnormally long URL (hides payload/redirect)'); }

  // 6. Non-standard TLD often abused (weak signal alone)
  const ABUSE_TLDS = ['.xyz', '.top', '.tk', '.ml', '.ga', '.cf', '.buzz', '.click'];
  if (ABUSE_TLDS.some((t) => host.endsWith(t))) { risk += 10; reasons.push('Cheap/abuse-prone domain ending — check carefully'); }

  risk = Math.min(100, risk);
  const score = 100 - risk; // 100 = safe

  let verdict = 'safe';
  let description = '';
  if (risk >= 50) {
    verdict = 'harmful';
    description = `This website looks Harmful and was blocked. ${reasons[0] || 'Matches phishing/malware patterns.'} Turn OFF Copilot to force-open (not recommended).`;
  } else if (risk >= 25) {
    verdict = 'suspicious';
    description = `This website looks Suspicious and was blocked for your safety. ${reasons[0] || 'Shows risky signs.'} Turn OFF Copilot to force-open (not recommended).`;
  } else {
    description = reasons.length === 0
      ? 'This website looks Safe — valid HTTPS, normal domain, no phishing signs found.'
      : `This website looks mostly Safe but note: ${reasons[0]}. No block needed.`;
  }

  return { verdict, score, reasons, description };
}

// ---------- badge ----------
async function setBadge(tabId, verdict) {
  try {
    const map = {
      safe: { text: 'OK', color: '#16a34a' },
      suspicious: { text: 'WARN', color: '#f59e0b' },
      harmful: { text: 'STOP', color: '#dc2626' },
      off: { text: 'OFF', color: '#6b7280' }
    };
    const m = map[verdict] || map.safe;
    await chrome.action.setBadgeText({ tabId, text: m.text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: m.color });
  } catch { /* tab may be gone */ }
}

// ---------- main guard: watch every navigation ----------
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ copilotEnabled: DEFAULT_ENABLED });
});

// Toggle from popup also updates all tabs badges
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes.copilotEnabled) {
    const enabled = changes.copilotEnabled.newValue === true;
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id) await setBadge(t.id, enabled ? 'safe' : 'off');
    }
  }
});

// Block before page loads
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  try {
    if (details.frameId !== 0) return; // only top frame
    const url = details.url;
    if (url.startsWith(chrome.runtime.getURL('block.html'))) return; // don't loop on block page

    const enabled = await isEnabled();
    if (!enabled) {
      if (details.tabId >= 0) await setBadge(details.tabId, 'off');
      return; // OFF = do nothing, let user browse freely
    }

    const result = quickCheck(url);

    // save last result for popup/content
    await chrome.storage.session.set({
      ['tab_' + details.tabId]: { url, ...result, time: Date.now() }
    });
    await setBadge(details.tabId, result.verdict);

    // Auto-block suspicious + harmful while ON. No click-through allowed while ON.
    if (result.verdict === 'suspicious' || result.verdict === 'harmful') {
      const blockUrl =
        chrome.runtime.getURL('block.html') +
        '?u=' + encodeURIComponent(url) +
        '&v=' + encodeURIComponent(result.verdict) +
        '&s=' + encodeURIComponent(String(result.score)) +
        '&r=' + encodeURIComponent(result.reasons.join(' | ').slice(0, 500));
      await chrome.tabs.update(details.tabId, { url: blockUrl });
    }
  } catch (e) {
    console.warn('Copilot guard error', e);
  }
});

// Allow popup/content to ask for verdict
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'GET_STATE') {
      const enabled = await isEnabled();
      let verdictData = null;
      const tabId = msg.tabId ?? sender?.tab?.id;
      if (tabId != null) {
        const s = await chrome.storage.session.get('tab_' + tabId);
        verdictData = s['tab_' + tabId] || null;
        // fallback: live-check current URL
        if (!verdictData && msg.url) verdictData = { url: msg.url, ...quickCheck(msg.url) };
      }
      sendResponse({ enabled, verdictData });
    }
    if (msg.type === 'SET_ENABLED') {
      await chrome.storage.local.set({ copilotEnabled: msg.enabled === true });
      sendResponse({ ok: true });
    }
    if (msg.type === 'CHECK_URL') {
      sendResponse({ url: msg.url, ...quickCheck(msg.url) });
    }
  })();
  return true; // async response
});
