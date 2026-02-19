export function html(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dokploy Viewer</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
  h1 { margin-bottom: 1rem; color: #38bdf8; }
  h2 { margin: 1.5rem 0 0.5rem; color: #7dd3fc; font-size: 1.1rem; }
  .token-input { margin-bottom: 1.5rem; }
  .token-input input { background: #1e293b; border: 1px solid #334155; color: #e2e8f0; padding: 0.5rem 1rem; border-radius: 6px; width: 300px; }
  .token-input button { background: #2563eb; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-left: 0.5rem; }
  .project { background: #1e293b; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  .project-name { font-weight: 600; font-size: 1.1rem; color: #38bdf8; }
  .app { background: #334155; border-radius: 6px; padding: 0.75rem; margin: 0.5rem 0; cursor: pointer; }
  .app:hover { background: #475569; }
  .app-name { font-weight: 500; }
  .app-status { font-size: 0.85rem; opacity: 0.7; }
  .detail-panel { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-top: 1rem; display: none; }
  .detail-panel.active { display: block; }
  .tab-bar { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .tab { padding: 0.4rem 1rem; background: #334155; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
  .tab.active { background: #2563eb; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  pre { background: #0f172a; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; max-height: 400px; overflow-y: auto; white-space: pre-wrap; }
  .loading { color: #94a3b8; font-style: italic; }
  .error { color: #f87171; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.4rem 0.75rem; border-bottom: 1px solid #334155; }
  th { color: #94a3b8; font-weight: 500; }
</style>
</head>
<body>
<h1>🔍 Dokploy Viewer</h1>
<div class="token-input">
  <input type="password" id="token" placeholder="Bearer token" />
  <button onclick="loadProjects()">Connect</button>
</div>
<div id="projects"><p class="loading">Enter your token and click Connect</p></div>
<div id="detail" class="detail-panel"></div>

<script>
let TOKEN = '';
const API = window.location.origin;

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (TOKEN) h['Authorization'] = 'Bearer ' + TOKEN;
  return h;
}

async function api(path) {
  const res = await fetch(API + path, { headers: headers() });
  if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
  return res.json();
}

async function loadProjects() {
  TOKEN = document.getElementById('token').value;
  const el = document.getElementById('projects');
  el.innerHTML = '<p class="loading">Loading...</p>';
  try {
    const projects = await api('/api/projects');
    if (projects.error) { el.innerHTML = '<p class="error">API Error: ' + esc(projects.error) + '</p>'; return; }
    if (!Array.isArray(projects) || !projects.length) { el.innerHTML = '<p>No projects found (got: ' + esc(typeof projects) + ' ' + esc(JSON.stringify(projects).slice(0,200)) + ')</p>'; return; }
    el.innerHTML = projects.map(p => {
      const apps = [];
      (p.environments || []).forEach(env => {
        (env.applications || []).forEach(a => apps.push(a));
      });
      (p.applications || []).forEach(a => apps.push(a));
      return '<div class="project"><div class="project-name">' + esc(p.name) + '</div>' +
        (apps.length ? apps.map(a =>
          '<div class="app" onclick="showApp(\\'' + a.applicationId + '\\')">' +
          '<div class="app-name">' + esc(a.name || a.appName || a.applicationId) + '</div>' +
          '<div class="app-status">' + esc(a.applicationStatus || '') + '</div></div>'
        ).join('') : '<p style="margin-top:0.5rem;opacity:0.5">No applications</p>') +
        '</div>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
  }
}

async function showApp(id) {
  const el = document.getElementById('detail');
  el.className = 'detail-panel active';
  el.innerHTML = '<p class="loading">Loading application...</p>';
  try {
    const app = await api('/api/applications/' + id);
    el.innerHTML = '<h2>' + esc(app.name || app.appName || id) + '</h2>' +
      '<div class="tab-bar">' +
      '<div class="tab active" onclick="switchTab(this,\\'info\\')">Info</div>' +
      '<div class="tab" onclick="switchTab(this,\\'deployments\\')">Deployments</div>' +
      '<div class="tab" onclick="switchTab(this,\\'logs\\')">Logs</div>' +
      '<div class="tab" onclick="switchTab(this,\\'env\\')">Env</div>' +
      '</div>' +
      '<div id="tab-info" class="tab-content active"><pre>' + esc(JSON.stringify(app, null, 2)) + '</pre></div>' +
      '<div id="tab-deployments" class="tab-content"><p class="loading">Click to load...</p></div>' +
      '<div id="tab-logs" class="tab-content"><p class="loading">Click to load...</p></div>' +
      '<div id="tab-env" class="tab-content"><p class="loading">Click to load...</p></div>';
    // Auto-load deployments
    loadDeployments(id);
  } catch(e) {
    el.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
  }
}

function switchTab(tabEl, name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  const content = document.getElementById('tab-' + name);
  if (content) content.classList.add('active');
  // Lazy load
  const id = document.querySelector('.detail-panel h2')?.textContent;
  if (name === 'deployments') loadDeployments(getAppId());
  if (name === 'logs') loadLogs(getAppId());
  if (name === 'env') loadEnv(getAppId());
}

let currentAppId = '';
function getAppId() { return currentAppId; }

async function loadDeployments(id) {
  currentAppId = id;
  const el = document.getElementById('tab-deployments');
  if (!el) return;
  try {
    const deps = await api('/api/applications/' + id + '/deployments');
    const list = Array.isArray(deps) ? deps : [];
    if (!list.length) { el.innerHTML = '<p>No deployments</p>'; return; }
    el.innerHTML = '<table><tr><th>Status</th><th>Date</th><th>Title</th></tr>' +
      list.slice(0, 50).map(d =>
        '<tr><td>' + esc(d.status || '') + '</td><td>' + esc(d.createdAt || '') + '</td><td>' + esc(d.title || d.description || '') + '</td></tr>'
      ).join('') + '</table>';
  } catch(e) { el.innerHTML = '<p class="error">' + esc(e.message) + '</p>'; }
}

async function loadLogs(id) {
  const el = document.getElementById('tab-logs');
  if (!el) return;
  try {
    const logs = await api('/api/applications/' + id + '/logs');
    el.innerHTML = '<pre>' + esc(typeof logs === 'string' ? logs : JSON.stringify(logs, null, 2)) + '</pre>';
  } catch(e) { el.innerHTML = '<p class="error">' + esc(e.message) + '</p>'; }
}

async function loadEnv(id) {
  const el = document.getElementById('tab-env');
  if (!el) return;
  try {
    const data = await api('/api/applications/' + id + '/env');
    el.innerHTML = '<pre>' + esc(data.env || 'No environment variables') + '</pre>';
  } catch(e) { el.innerHTML = '<p class="error">' + esc(e.message) + '</p>'; }
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Fix the showApp to track currentAppId
const origShowApp = showApp;
showApp = async function(id) { currentAppId = id; return origShowApp(id); };
</script>
</body>
</html>`;
}
