// TEMPO Slider - popup script

const ext = (typeof browser !== 'undefined') ? browser : chrome;
const BUILTIN = ['bandcamp.com', 'beatport.com', 'traxsource.com'];

const $ = (sel) => document.querySelector(sel);

async function getCurrentTab() {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch { return null; }
}

function reduceToRoot(hostname) {
  // example.subdomain.com → example.com (最大2階層)
  if (!hostname) return hostname;
  const parts = hostname.split('.');
  if (parts.length >= 2) return parts.slice(-2).join('.');
  return hostname;
}

function isBuiltin(host) {
  if (!host) return false;
  return BUILTIN.some(b => host === b || host.endsWith('.' + b));
}

function setStatus(msg, isError) {
  const el = $('#status');
  el.textContent = msg || '';
  el.classList.toggle('is-error', !!isError);
}

async function bg(payload) {
  return ext.runtime.sendMessage({ target: 'tempo-slider-bg', ...payload });
}

async function init() {
  const tab = await getCurrentTab();
  const host = tab && tab.url ? extractHostname(tab.url) : null;
  const root = host ? reduceToRoot(host) : null;
  const isHttp = tab && tab.url && /^https?:/.test(tab.url);

  $('#currentHost').textContent = host || '(no site)';

  const btn = $('#addCurrent');
  if (!isHttp || !root) {
    btn.disabled = true;
    btn.textContent = 'Not a regular page';
  } else if (isBuiltin(root)) {
    btn.disabled = true;
    btn.textContent = 'Already supported (built-in)';
  } else {
    btn.disabled = false;
    btn.textContent = `+ Add ${root}`;
    btn.addEventListener('click', () => addSite(root, tab.id));
  }

  await renderList();
}

async function addSite(hostname, tabId) {
  setStatus('Requesting permission...');
  const origins = [`https://*.${hostname}/*`, `https://${hostname}/*`];
  let granted = false;
  try {
    granted = await ext.permissions.request({ origins });
  } catch (e) {
    setStatus(`Permission request failed: ${e.message || e}`, true);
    return;
  }
  if (!granted) {
    setStatus('Permission denied', true);
    return;
  }
  setStatus('Registering...');
  const res = await bg({ type: 'addSite', hostname });
  if (res && res.ok) {
    setStatus(`Added ${hostname} — reload tab to start`);
    // タブを自動リロード
    if (tabId) {
      try { await ext.tabs.reload(tabId); } catch (e) {}
    }
  } else {
    setStatus(`Failed: ${res && res.error ? res.error : 'unknown'}`, true);
  }
  await renderList();
}

async function removeSite(hostname) {
  setStatus('Removing...');
  const res = await bg({ type: 'removeSite', hostname });
  if (res && res.ok) {
    setStatus(`Removed ${hostname}`);
  } else {
    setStatus('Remove failed', true);
  }
  await renderList();
}

async function renderList() {
  const res = await bg({ type: 'listSites' });
  const sites = (res && res.sites) || [];
  const ul = $('#siteList');
  ul.replaceChildren();
  if (sites.length === 0) {
    const li = document.createElement('li');
    li.className = 'ts-popup__empty';
    li.textContent = '(none yet)';
    ul.appendChild(li);
    return;
  }
  for (const site of sites) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = site;
    const btn = document.createElement('button');
    btn.textContent = '×';
    btn.title = `Remove ${site}`;
    btn.addEventListener('click', () => removeSite(site));
    li.appendChild(span);
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

init();
