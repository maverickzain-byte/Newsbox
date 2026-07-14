/* ===========================================================
   Newsbox — app.js
   Router + view rendering + interactions. Vanilla JS, no
   framework, no build step — deployable as static files.
=========================================================== */
let SETTINGS = null;
let CURRENT_ROUTE = 'home';
let SPORTS_TAB = 'all';
let INDIA_TAB = 'all';

const viewRoot = document.getElementById('viewRoot');

// ---------- Utilities ----------
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function timeAgo(iso){
  const diff = (Date.now() - new Date(iso).getTime())/1000;
  if(diff < 60) return 'just now';
  if(diff < 3600) return Math.floor(diff/60)+'m ago';
  if(diff < 86400) return Math.floor(diff/3600)+'h ago';
  return Math.floor(diff/86400)+'d ago';
}
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.add('hidden'), 2200);
}
function setRoute(route){
  CURRENT_ROUTE = route;
  location.hash = '#'+route;
  document.querySelectorAll('.nav-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.route === route ||
      (route!=='home'&&route!=='sports'&&route!=='india'&&route!=='trending'&&b.dataset.route==='more'));
  });
  closeMenu();
  render();
}

// ---------- Card rendering ----------
function articleCard(a){
  const eyebrowClass = /breaking/i.test(a.title) ? 'card-eyebrow breaking' : 'card-eyebrow';
  const thumb = a.imageUrl
    ? `<img class="card-thumb" src="${a.imageUrl}" loading="lazy" alt="">`
    : `<div class="card-thumb">📰</div>`;
  return `
  <div class="card" data-id="${a.id}">
    <div class="card-row">
      ${thumb}
      <div class="card-body" data-open="${a.id}">
        <div class="${eyebrowClass}">${escapeHtml(a.source)} · ${escapeHtml(a.subcategory||CATEGORY_LABELS[a.category]||'')}</div>
        <p class="card-title ${a.read?'read':''}">${escapeHtml(a.title)}</p>
        <div class="card-meta"><span>${timeAgo(a.pubDate)}</span></div>
      </div>
    </div>
    <div class="card-actions">
      <button class="chip-btn bm-btn ${a.bookmarked?'active':''}" data-bm="${a.id}">${a.bookmarked?'🔖':'☐'} Save</button>
      <button class="chip-btn read-btn" data-read="${a.id}">${a.read?'✓ Read':'○ Unread'}</button>
      <button class="chip-btn share-btn" data-share="${a.id}">↗ Share</button>
    </div>
  </div>`;
}

function wireCardEvents(container){
  container.querySelectorAll('[data-open]').forEach(el=>{
    el.addEventListener('click', ()=> openArticle(el.dataset.open));
  });
  container.querySelectorAll('[data-bm]').forEach(el=>{
    el.addEventListener('click', async (e)=>{
      e.stopPropagation();
      const a = await DB.getById(el.dataset.bm);
      a.bookmarked = !a.bookmarked;
      await DB.updateArticle(a);
      toast(a.bookmarked ? 'Saved to bookmarks' : 'Removed from bookmarks');
      render();
    });
  });
  container.querySelectorAll('[data-read]').forEach(el=>{
    el.addEventListener('click', async (e)=>{
      e.stopPropagation();
      const a = await DB.getById(el.dataset.read);
      a.read = !a.read;
      await DB.updateArticle(a);
      render();
    });
  });
  container.querySelectorAll('[data-share]').forEach(el=>{
    el.addEventListener('click', async (e)=>{
      e.stopPropagation();
      const a = await DB.getById(el.dataset.share);
      if(navigator.share){ navigator.share({title:a.title, url:a.link}).catch(()=>{}); }
      else { navigator.clipboard?.writeText(a.link); toast('Link copied'); }
    });
  });
}

function emptyState(icon, msg, sub=''){
  return `<div class="empty-state"><span class="icon">${icon}</span>${msg}${sub?`<div style="font-size:12.5px;margin-top:6px;">${sub}</div>`:''}</div>`;
}
function spinner(){ return `<div class="spinner"></div>`; }

// ---------- Views ----------
async function renderHome(){
  viewRoot.innerHTML = spinner();
  const [sports, india, trending, ai, business, us, ohio] = await Promise.all(
    ['sports','india','trending','ai','business','us','ohio'].map(c=> c==='trending' ? [] : DB.getByCategory(c, 4))
  );
  const trendTopics = await getCachedTrendingOrFetch();

  let html = '';
  html += `<div class="section-title">Trending Now</div>`;
  html += trendTopics.length
    ? `<div class="trend-scroll">${trendTopics.slice(0,10).map(t=>`<span class="trend-pill">${escapeHtml((t.topic||'').slice(0,40))}</span>`).join('')}</div>`
    : emptyState('📈','No trending data yet','Set up your proxy in Settings, then pull to refresh');

  const sections = [
    ['🏏 Sports', sports, 'sports'], ['🇮🇳 India', india, 'india'],
    ['🤖 AI & Technology', ai, 'ai'], ['💼 Business & Finance', business, 'business'],
    ['🇺🇸 US News', us, 'us'], ['📍 Ohio News', ohio, 'ohio']
  ];
  sections.forEach(([label, items, key])=>{
    html += `<div class="section-title">${label} <span class="see-all" data-goto="${key}">See all →</span></div>`;
    html += items.length ? items.map(articleCard).join('') : emptyState('○','No headlines cached yet','Pull down to refresh');
  });

  viewRoot.innerHTML = html;
  wireCardEvents(viewRoot);
  viewRoot.querySelectorAll('[data-goto]').forEach(el=>{
    el.addEventListener('click', ()=> setRoute(el.dataset.goto));
  });
}

async function renderCategoryPage(category, tabState, setTab){
  const subs = ['all', ...new Set((FEED_SOURCES[category]||[]).map(s=>s.sub))];
  let items = await DB.getByCategory(category, 60);
  if(tabState !== 'all') items = items.filter(a=>a.subcategory === tabState);

  let html = `<div class="tab-row">`;
  subs.forEach(s=>{
    html += `<button class="tab-chip ${tabState===s?'active':''}" data-tab="${s}">${s==='all'?'All':s}</button>`;
  });
  html += `</div>`;
  html += items.length ? items.map(articleCard).join('') : emptyState('○','No headlines yet','Pull down to refresh, or check Settings → Proxy URL');

  viewRoot.innerHTML = html;
  wireCardEvents(viewRoot);
  viewRoot.querySelectorAll('[data-tab]').forEach(el=>{
    el.addEventListener('click', ()=>{ setTab(el.dataset.tab); renderRoute(); });
  });
}

let TRENDING_CACHE = null;
async function getCachedTrendingOrFetch(){
  if(TRENDING_CACHE) return TRENDING_CACHE;
  if(!SETTINGS.proxyUrl) return [];
  TRENDING_CACHE = await getTrendingTopics(SETTINGS.proxyUrl);
  return TRENDING_CACHE;
}

async function renderTrending(){
  viewRoot.innerHTML = spinner();
  const topics = await getCachedTrendingOrFetch();
  if(!topics.length){
    viewRoot.innerHTML = emptyState('📈','Nothing cached yet',
      SETTINGS.proxyUrl ? 'Pull down to refresh' : 'Add your proxy URL in Settings first');
    return;
  }
  let html = `<div class="section-title">Trending — ranked by activity</div>`;
  html += topics.map((t,i)=>`
    <div class="card">
      <div class="card-eyebrow">#${i+1} · ${escapeHtml(t.source)}</div>
      <p class="card-title">${escapeHtml(t.topic)}</p>
      ${t.reason ? `<div class="card-meta" style="margin-top:4px;">${escapeHtml(t.reason)}</div>` : ''}
      ${t.link ? `<div class="card-actions"><a class="chip-btn" href="${t.link}" target="_blank" rel="noopener">↗ Open discussion</a></div>` : ''}
    </div>`).join('');
  viewRoot.innerHTML = html;
}

async function renderXFeed(){
  const accounts = await DB.getXAccounts();
  const byCategory = {};
  accounts.forEach(a=>{ (byCategory[a.category] = byCategory[a.category]||[]).push(a); });

  let html = `<div class="card" style="background:var(--surface-2);">
    <p style="margin:0 0 8px;font-size:13.5px;">X's free API no longer allows reading posts, so this tab is a curated launcher: add accounts, tap to jump straight to their profile in the X app. If you keep a List on X, add its URL here for a one-tap combined feed.</p>
    <div class="settings-row" style="margin-top:8px;">
      <input type="text" id="xListUrlInput" placeholder="https://x.com/i/lists/…" value="${escapeHtml(SETTINGS.xListUrl||'')}" style="flex:1;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--surface);font-family:var(--font-mono);font-size:12.5px;">
    </div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="btn btn-primary" id="saveXListBtn">Save List URL</button>
      ${SETTINGS.xListUrl ? `<a class="btn btn-outline" href="${escapeHtml(SETTINGS.xListUrl)}" target="_blank">Open My List</a>` : ''}
    </div>
  </div>`;

  html += `<div class="section-title">Add account</div>
  <div class="card">
    <div style="display:flex;gap:8px;">
      <input type="text" id="xHandleInput" placeholder="@handle" style="flex:1;border:1px solid var(--border);border-radius:8px;padding:9px;background:var(--surface-2);font-family:var(--font-mono);">
      <select id="xCatInput" style="border:1px solid var(--border);border-radius:8px;background:var(--surface-2);">
        <option value="sports">Sports</option>
        <option value="india">India</option>
        <option value="trending">Trending</option>
        <option value="other">Other</option>
      </select>
      <button class="btn btn-primary" id="xAddBtn">Add</button>
    </div>
  </div>`;

  ['sports','india','trending','other'].forEach(cat=>{
    const list = byCategory[cat];
    if(!list || !list.length) return;
    html += `<div class="section-title">${cat[0].toUpperCase()+cat.slice(1)} accounts</div>`;
    list.forEach(a=>{
      html += `<div class="card x-card">
        <div class="card-row" style="align-items:center;">
          <div class="card-body">
            <div class="x-handle">@${escapeHtml(a.handle)}</div>
          </div>
          <a class="chip-btn" href="https://x.com/${escapeHtml(a.handle)}" target="_blank">↗ Open</a>
          <button class="chip-btn" data-rm="${a.id}">✕ Remove</button>
        </div>
      </div>`;
    });
  });

  if(!accounts.length){
    html += emptyState('𝕏','No accounts added yet','Add handles above to build your launcher list');
  }

  viewRoot.innerHTML = html;

  document.getElementById('xAddBtn').addEventListener('click', async ()=>{
    const handle = document.getElementById('xHandleInput').value.trim();
    const cat = document.getElementById('xCatInput').value;
    if(!handle) return;
    await DB.addXAccount(handle, cat);
    toast('Added @'+handle.replace('@',''));
    renderXFeed();
  });
  document.getElementById('saveXListBtn').addEventListener('click', async ()=>{
    SETTINGS.xListUrl = document.getElementById('xListUrlInput').value.trim();
    await DB.saveSettings(SETTINGS);
    toast('List URL saved');
    renderXFeed();
  });
  viewRoot.querySelectorAll('[data-rm]').forEach(el=>{
    el.addEventListener('click', async ()=>{
      await DB.removeXAccount(el.dataset.rm);
      renderXFeed();
    });
  });
}

async function renderBriefing(){
  viewRoot.innerHTML = spinner();
  const briefing = await buildDailyBriefing();
  let html = `<div class="card" style="text-align:center;background:var(--ink);color:var(--bg);">
    <div style="font-family:var(--font-display);font-style:italic;font-size:20px;">Today's Briefing</div>
    <div style="font-family:var(--font-mono);font-size:12px;margin-top:6px;opacity:0.8;">${new Date().toDateString()} · ~${briefing.estMinutes} min read</div>
  </div>`;

  briefing.sections.forEach(sec=>{
    html += `<div class="section-title">${sec.label}</div>`;
    if(!sec.items.length){ html += emptyState('○','Nothing cached for this yet'); return; }
    sec.items.forEach(a=>{
      html += `<div class="card" ${a.id?`data-open="${a.id}"`:''}>
        <div class="card-eyebrow">${escapeHtml(a.source||'')}</div>
        <p class="card-title ${a.read?'read':''}">${escapeHtml(a.title)}</p>
        <div class="card-meta">${escapeHtml((a.summary||'').slice(0,110))}${(a.summary||'').length>110?'…':''}</div>
      </div>`;
    });
  });

  viewRoot.innerHTML = html;
  viewRoot.querySelectorAll('[data-open]').forEach(el=>{
    el.addEventListener('click', ()=> openArticle(el.dataset.open));
  });
}

async function renderBookmarks(){
  const items = await DB.getBookmarked();
  viewRoot.innerHTML = `<div class="section-title">Bookmarks</div>` +
    (items.length ? items.map(articleCard).join('') : emptyState('🔖','No bookmarks yet','Tap Save on any article'));
  wireCardEvents(viewRoot);
}

async function renderDashboard(){
  const history = await DB.getHistoryToday();
  const bookmarks = await DB.getBookmarked();
  const trending = await getCachedTrendingOrFetch();
  const catCounts = {};
  for(const h of history){
    const a = await DB.getById(h.articleId);
    if(a) catCounts[a.category] = (catCounts[a.category]||0)+1;
  }
  const topCat = Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0];
  const timeSpent = history.reduce((s,h)=>s+(h.timeSpentSec||0),0);

  viewRoot.innerHTML = `
    <div class="section-title">Today</div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">${history.length}</div><div class="stat-label">Articles read</div></div>
      <div class="stat-card"><div class="stat-num">${topCat?CATEGORY_LABELS[topCat[0]]||topCat[0]:'—'}</div><div class="stat-label">Top category</div></div>
      <div class="stat-card"><div class="stat-num">${bookmarks.length}</div><div class="stat-label">Saved articles</div></div>
      <div class="stat-card"><div class="stat-num">${trending.length}</div><div class="stat-label">Trending topics</div></div>
    </div>
    <div class="section-title">Time spent reading</div>
    <div class="card" style="text-align:center;">
      <div class="stat-num">${Math.round(timeSpent/60)} min</div>
      <div class="stat-label">today</div>
    </div>`;
}

async function renderSettings(){
  viewRoot.innerHTML = `
    <div class="settings-group">
      <div class="settings-label">Appearance</div>
      <div class="settings-row"><span>Dark mode</span><button class="toggle ${SETTINGS.theme==='dark'?'on':''}" id="themeToggle"></button></div>
    </div>
    <div class="settings-group">
      <div class="settings-label">Data source (required)</div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:8px;">
        <span style="font-size:12.5px;color:var(--ink-soft);">Cloudflare Worker URL — see README for 10‑minute setup</span>
        <input type="text" id="proxyInput" value="${escapeHtml(SETTINGS.proxyUrl||'')}" placeholder="https://your-worker.workers.dev">
        <button class="btn btn-primary" id="saveProxyBtn">Save</button>
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-label">Notifications</div>
      <div class="settings-row"><span>Breaking news</span><button class="toggle ${SETTINGS.notif.breaking?'on':''}" data-notif="breaking"></button></div>
      <div class="settings-row"><span>Trending topics</span><button class="toggle ${SETTINGS.notif.trending?'on':''}" data-notif="trending"></button></div>
      <div class="settings-row"><span>Cricket alerts</span><button class="toggle ${SETTINGS.notif.cricket?'on':''}" data-notif="cricket"></button></div>
      <div class="settings-row"><span>Daily briefing (8am)</span><button class="toggle ${SETTINGS.notif.dailyBriefing?'on':''}" data-notif="dailyBriefing"></button></div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:6px;">
        <span style="font-size:12.5px;color:var(--ink-soft);">Quiet hours (no alerts during this window)</span>
        <div style="display:flex;gap:8px;">
          <input type="text" id="quietStart" value="${SETTINGS.quietStart}" style="flex:1;text-align:center;">
          <span style="align-self:center;">to</span>
          <input type="text" id="quietEnd" value="${SETTINGS.quietEnd}" style="flex:1;text-align:center;">
        </div>
      </div>
      <p style="font-size:11.5px;color:var(--ink-faint);padding:4px 2px;">iOS delivers web-app notifications only while installed to your Home Screen, and timing isn't guaranteed the way native apps are.</p>
    </div>
    <div class="settings-group">
      <div class="settings-label">Data</div>
      <button class="btn btn-outline" id="sampleBtn" style="width:100%;margin-bottom:8px;">Load sample data (preview only)</button>
      <button class="btn btn-outline" id="refreshAllBtn" style="width:100%;margin-bottom:8px;">Refresh all feeds now</button>
      <button class="btn btn-danger" id="resetBtn" style="width:100%;">Clear all local data</button>
    </div>
    <div class="settings-group">
      <div class="settings-label">About</div>
      <p style="font-size:12.5px;color:var(--ink-faint);">Newsbox v1 — runs entirely on your device, free RSS sources, zero ongoing cost.</p>
    </div>`;

  document.getElementById('themeToggle').addEventListener('click', async ()=>{
    SETTINGS.theme = SETTINGS.theme==='dark' ? 'light' : 'dark';
    applyTheme();
    await DB.saveSettings(SETTINGS);
    renderSettings();
  });
  document.getElementById('saveProxyBtn').addEventListener('click', async ()=>{
    SETTINGS.proxyUrl = document.getElementById('proxyInput').value.trim();
    await DB.saveSettings(SETTINGS);
    toast('Proxy saved — pull to refresh on Home');
  });
  viewRoot.querySelectorAll('[data-notif]').forEach(el=>{
    el.addEventListener('click', async ()=>{
      const key = el.dataset.notif;
      SETTINGS.notif[key] = !SETTINGS.notif[key];
      await DB.saveSettings(SETTINGS);
      if(SETTINGS.notif[key] && 'Notification' in window && Notification.permission==='default'){
        Notification.requestPermission();
      }
      renderSettings();
    });
  });
  document.getElementById('quietStart').addEventListener('change', async (e)=>{ SETTINGS.quietStart=e.target.value; await DB.saveSettings(SETTINGS); });
  document.getElementById('quietEnd').addEventListener('change', async (e)=>{ SETTINGS.quietEnd=e.target.value; await DB.saveSettings(SETTINGS); });
  document.getElementById('sampleBtn').addEventListener('click', async ()=>{
    await loadSampleData();
    toast('Sample data loaded — check Home');
  });
  document.getElementById('refreshAllBtn').addEventListener('click', async ()=>{
    toast('Refreshing…');
    await refreshAllCategories(SETTINGS.proxyUrl);
    TRENDING_CACHE = null;
    toast('Feeds updated');
  });
  document.getElementById('resetBtn').addEventListener('click', async ()=>{
    if(confirm('This clears all cached articles, bookmarks, and history on this device. Continue?')){
      indexedDB.deleteDatabase(DB_NAME);
      location.reload();
    }
  });
}

async function renderSearch(query){
  const results = document.getElementById('searchResults');
  if(!query){ results.innerHTML = ''; return; }
  const items = await DB.search(query);
  results.innerHTML = items.length ? items.map(articleCard).join('') : emptyState('⌕','No matches in cached articles');
  wireCardEvents(results);
}

async function openArticle(id){
  const a = await DB.getById(id);
  if(!a) return;
  if(!a.read){ a.read = true; await DB.updateArticle(a); DB.logRead(a.id); }

  viewRoot.innerHTML = `
    <button class="btn btn-outline" id="backBtn" style="margin-bottom:14px;">← Back</button>
    <div class="reader-header">
      <div class="card-eyebrow">${escapeHtml(a.source)} · ${escapeHtml(a.subcategory||'')}</div>
      <h1 class="reader-title" id="readerTitle">${escapeHtml(a.title)}</h1>
      <div class="reader-meta">${timeAgo(a.pubDate)}</div>
    </div>
    <a href="${a.link}" target="_blank" rel="noopener" class="btn btn-primary" style="display:block;text-align:center;width:100%;margin-bottom:14px;font-size:15px;padding:14px;">
      Read full article on ${escapeHtml(a.source)} ↗
    </a>
    <div class="font-controls">
      <span style="font-size:12.5px;color:var(--ink-faint);">Text size</span>
      <button id="fontDown">A−</button><button id="fontUp">A+</button>
      <span style="flex:1;"></span>
      <button class="chip-btn" id="bmToggle">${a.bookmarked?'🔖 Saved':'☐ Save'}</button>
      <button class="chip-btn" id="shareBtn">↗ Share</button>
    </div>
    <div class="reader-body" id="readerBody" style="font-size:${SETTINGS.fontSize}px;">
      <p style="font-weight:600;">${escapeHtml(a.summary)}</p>
      ${a.content && a.content.length > a.summary.length ? '<p>'+escapeHtml(a.content.slice(0,1500))+'</p>' : ''}
      <p style="color:var(--ink-faint);font-size:13px;">This is the summary provided by ${escapeHtml(a.source)}'s feed — RSS sources only include a short excerpt, not the full story. Tap the button above for the complete article on their site.</p>
    </div>`;

  document.getElementById('backBtn').addEventListener('click', ()=> history.back());
  document.getElementById('bmToggle').addEventListener('click', async ()=>{
    a.bookmarked = !a.bookmarked; await DB.updateArticle(a);
    document.getElementById('bmToggle').textContent = a.bookmarked?'🔖 Saved':'☐ Save';
  });
  document.getElementById('shareBtn').addEventListener('click', ()=>{
    if(navigator.share) navigator.share({title:a.title, url:a.link}).catch(()=>{});
    else { navigator.clipboard?.writeText(a.link); toast('Link copied'); }
  });
  document.getElementById('fontUp').addEventListener('click', async ()=>{
    SETTINGS.fontSize = Math.min(24, SETTINGS.fontSize+1);
    document.getElementById('readerBody').style.fontSize = SETTINGS.fontSize+'px';
    await DB.saveSettings(SETTINGS);
  });
  document.getElementById('fontDown').addEventListener('click', async ()=>{
    SETTINGS.fontSize = Math.max(13, SETTINGS.fontSize-1);
    document.getElementById('readerBody').style.fontSize = SETTINGS.fontSize+'px';
    await DB.saveSettings(SETTINGS);
  });

  window.scrollTo(0,0);
  if(!location.hash.startsWith('#article')) history.pushState({article:id}, '', '#article/'+id);
}

// ---------- Router ----------
async function renderRoute(){
  switch(CURRENT_ROUTE){
    case 'home': return renderHome();
    case 'sports': return renderCategoryPage('sports', SPORTS_TAB, (t)=>SPORTS_TAB=t);
    case 'india': return renderCategoryPage('india', INDIA_TAB, (t)=>INDIA_TAB=t);
    case 'ai': return renderCategoryPage('ai','all',()=>{});
    case 'business': return renderCategoryPage('business','all',()=>{});
    case 'us': return renderCategoryPage('us','all',()=>{});
    case 'ohio': return renderCategoryPage('ohio','all',()=>{});
    case 'trending': return renderTrending();
    case 'xfeed': return renderXFeed();
    case 'briefing': return renderBriefing();
    case 'bookmarks': return renderBookmarks();
    case 'dashboard': return renderDashboard();
    case 'settings': return renderSettings();
    default: return renderHome();
  }
}
function render(){ renderRoute(); }

// ---------- Menu / search / theme wiring ----------
function openMenu(){ document.getElementById('sideMenu').classList.remove('hidden'); document.getElementById('menuOverlay').classList.remove('hidden'); }
function closeMenu(){ document.getElementById('sideMenu').classList.add('hidden'); document.getElementById('menuOverlay').classList.add('hidden'); }

function applyTheme(){
  document.documentElement.setAttribute('data-theme', SETTINGS.theme);
}

function initTicker(){
  const track = document.getElementById('tickerTrack');
  (async ()=>{
    const cricket = (await DB.getByCategory('sports', 20)).filter(a=>a.subcategory==='Cricket').slice(0,5);
    const trend = await getCachedTrendingOrFetch();
    const items = [
      ...cricket.map(a=>`🏏 <b>${escapeHtml(a.title.slice(0,60))}</b>`),
      ...trend.slice(0,6).map(t=>`📈 ${escapeHtml((t.topic||'').slice(0,50))}`)
    ];
    track.innerHTML = items.length
      ? items.map(i=>`<span class="ticker-item">${i}</span>`).join('')
      : `<span class="ticker-item">Add your proxy URL in Settings, then pull to refresh for live ticker data</span>`;
  })();
}

async function pullToRefresh(){
  toast('Refreshing…');
  if(CURRENT_ROUTE==='home'){ await refreshAllCategories(SETTINGS.proxyUrl); TRENDING_CACHE=null; }
  else if(['sports','india','ai','business','us','ohio'].includes(CURRENT_ROUTE)){ await refreshCategory(CURRENT_ROUTE, SETTINGS.proxyUrl); }
  else if(CURRENT_ROUTE==='trending'){ TRENDING_CACHE=null; }
  initTicker();
  render();
  toast('Updated');
}

function wirePullToRefresh(){
  let startY = 0, pulling = false;
  viewRoot.addEventListener('touchstart', (e)=>{
    if(window.scrollY===0){ startY = e.touches[0].clientY; pulling=true; }
  }, {passive:true});
  viewRoot.addEventListener('touchend', (e)=>{
    if(pulling){
      const dy = e.changedTouches[0].clientY - startY;
      if(dy > 80) pullToRefresh();
      pulling=false;
    }
  }, {passive:true});
}

function init(){
  window.addEventListener('hashchange', ()=>{
    const h = location.hash.replace('#','');
    if(h.startsWith('article/')){ openArticle(h.split('/')[1]); return; }
    if(h) { CURRENT_ROUTE = h; render(); }
  });

  document.getElementById('menuBtn').addEventListener('click', openMenu);
  document.getElementById('menuOverlay').addEventListener('click', closeMenu);
  document.querySelectorAll('.side-link').forEach(el=>{
    el.addEventListener('click', (e)=>{ e.preventDefault(); setRoute(el.dataset.route); });
  });
  document.querySelectorAll('.nav-btn').forEach(el=>{
    el.addEventListener('click', ()=>{
      if(el.dataset.route==='more') openMenu();
      else setRoute(el.dataset.route);
    });
  });
  document.getElementById('themeBtn').addEventListener('click', async ()=>{
    SETTINGS.theme = SETTINGS.theme==='dark' ? 'light':'dark';
    applyTheme(); await DB.saveSettings(SETTINGS);
  });
  document.getElementById('searchBtn').addEventListener('click', ()=>{
    document.getElementById('searchOverlay').classList.remove('hidden');
    document.getElementById('searchInput').focus();
  });
  document.getElementById('searchCloseBtn').addEventListener('click', ()=>{
    document.getElementById('searchOverlay').classList.add('hidden');
  });
  let searchDebounce;
  document.getElementById('searchInput').addEventListener('input', (e)=>{
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(()=>renderSearch(e.target.value.trim()), 250);
  });

  wirePullToRefresh();

  (async ()=>{
    SETTINGS = await DB.getSettings();
    applyTheme();
    initTicker();
    render();
    // background refresh on first load if proxy configured
    if(SETTINGS.proxyUrl){
      const all = await DB.getAll();
      if(all.length === 0){ await refreshAllCategories(SETTINGS.proxyUrl); TRENDING_CACHE=null; initTicker(); render(); }
    }
  })();

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }
}

init();