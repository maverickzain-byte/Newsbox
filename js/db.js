/* ===========================================================
   Newsbox — db.js
   All local persistence via IndexedDB. No server, no cost.
   Stores:
     articles     { id, title, link, source, category, subcategory,
                    pubDate, summary, content, imageUrl, read,
                    bookmarked, savedOffline, fetchedAt }
     settings     single row, key='app' -> {theme, proxyUrl,
                    categoryOrder, favoriteTopics, favoriteSources,
                    fontSize, quietStart, quietEnd, notifPrefs}
     xaccounts    { id (handle), handle, category }
     history      { id (auto), articleId, readAt, timeSpentSec }
=========================================================== */
const DB_NAME = 'newsbox';
const DB_VERSION = 1;
let _dbPromise = null;

function openDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains('articles')){
        const s = db.createObjectStore('articles', {keyPath:'id'});
        s.createIndex('category', 'category');
        s.createIndex('pubDate', 'pubDate');
        s.createIndex('bookmarked', 'bookmarked');
        s.createIndex('read', 'read');
      }
      if(!db.objectStoreNames.contains('settings')){
        db.createObjectStore('settings', {keyPath:'key'});
      }
      if(!db.objectStoreNames.contains('xaccounts')){
        db.createObjectStore('xaccounts', {keyPath:'id'});
      }
      if(!db.objectStoreNames.contains('history')){
        const h = db.createObjectStore('history', {keyPath:'id', autoIncrement:true});
        h.createIndex('readAt', 'readAt');
      }
    };
    req.onsuccess = (e)=>resolve(e.target.result);
    req.onerror = (e)=>reject(e.target.error);
  });
  return _dbPromise;
}

function tx(storeName, mode='readonly'){
  return openDB().then(db=>db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  // ---- Articles ----
  async putArticles(articles){
    const store = await tx('articles','readwrite');
    return new Promise((resolve,reject)=>{
      let remaining = articles.length;
      if(remaining===0) return resolve();
      articles.forEach(a=>{
        const getReq = store.get(a.id);
        getReq.onsuccess = ()=>{
          const existing = getReq.result;
          if(existing){
            // preserve user state (read/bookmarked/offline) on refresh
            a.read = existing.read;
            a.bookmarked = existing.bookmarked;
            a.savedOffline = existing.savedOffline;
          }
          const putReq = store.put(a);
          putReq.onsuccess = ()=>{ if(--remaining===0) resolve(); };
          putReq.onerror = ()=>{ if(--remaining===0) resolve(); };
        };
        getReq.onerror = ()=>{ if(--remaining===0) resolve(); };
      });
    });
  },
  async getByCategory(category, limit=50){
    const store = await tx('articles');
    return new Promise((resolve,reject)=>{
      const idx = store.index('category');
      const results = [];
      const req = idx.openCursor(IDBKeyRange.only(category), 'prev');
      req.onsuccess = (e)=>{
        const cur = e.target.result;
        if(cur && results.length < limit){ results.push(cur.value); cur.continue(); }
        else resolve(results.sort((a,b)=> new Date(b.pubDate) - new Date(a.pubDate)));
      };
      req.onerror = ()=>resolve([]);
    });
  },
  async getAll(){
    const store = await tx('articles');
    return new Promise((resolve)=>{
      const req = store.getAll();
      req.onsuccess = ()=>resolve(req.result||[]);
      req.onerror = ()=>resolve([]);
    });
  },
  async getById(id){
    const store = await tx('articles');
    return new Promise((resolve)=>{
      const req = store.get(id);
      req.onsuccess = ()=>resolve(req.result||null);
      req.onerror = ()=>resolve(null);
    });
  },
  async updateArticle(article){
    const store = await tx('articles','readwrite');
    return new Promise((resolve)=>{
      const req = store.put(article);
      req.onsuccess = ()=>resolve(true);
      req.onerror = ()=>resolve(false);
    });
  },
  async getBookmarked(){
    const all = await DB.getAll();
    return all.filter(a=>a.bookmarked).sort((a,b)=> new Date(b.pubDate)-new Date(a.pubDate));
  },
  async search(query){
    const all = await DB.getAll();
    const q = query.toLowerCase();
    return all.filter(a=>
      (a.title && a.title.toLowerCase().includes(q)) ||
      (a.summary && a.summary.toLowerCase().includes(q)) ||
      (a.category && a.category.toLowerCase().includes(q))
    ).sort((a,b)=> new Date(b.pubDate)-new Date(a.pubDate));
  },

  // ---- Settings ----
  async getSettings(){
    const store = await tx('settings');
    return new Promise((resolve)=>{
      const req = store.get('app');
      req.onsuccess = ()=>resolve(req.result ? req.result.value : DB.defaultSettings());
      req.onerror = ()=>resolve(DB.defaultSettings());
    });
  },
  async saveSettings(settings){
    const store = await tx('settings','readwrite');
    return new Promise((resolve)=>{
      const req = store.put({key:'app', value:settings});
      req.onsuccess = ()=>resolve(true);
      req.onerror = ()=>resolve(false);
    });
  },
  defaultSettings(){
    return {
      theme:'light',
      proxyUrl:'',
      categoryOrder:['sports','india','trending','ai','business','us','ohio'],
      favoriteTopics:[],
      favoriteSources:[],
      fontSize:16,
      quietStart:'22:00',
      quietEnd:'07:00',
      notif:{breaking:true, trending:true, cricket:true, dailyBriefing:false}
    };
  },

  // ---- X accounts ----
  async getXAccounts(){
    const store = await tx('xaccounts');
    return new Promise((resolve)=>{
      const req = store.getAll();
      req.onsuccess = ()=>resolve(req.result||[]);
      req.onerror = ()=>resolve([]);
    });
  },
  async addXAccount(handle, category){
    handle = handle.replace('@','').trim();
    const store = await tx('xaccounts','readwrite');
    return new Promise((resolve)=>{
      const req = store.put({id:handle.toLowerCase(), handle, category});
      req.onsuccess = ()=>resolve(true);
      req.onerror = ()=>resolve(false);
    });
  },
  async removeXAccount(id){
    const store = await tx('xaccounts','readwrite');
    return new Promise((resolve)=>{
      const req = store.delete(id);
      req.onsuccess = ()=>resolve(true);
      req.onerror = ()=>resolve(false);
    });
  },

  // ---- History ----
  async logRead(articleId, timeSpentSec=0){
    const store = await tx('history','readwrite');
    return new Promise((resolve)=>{
      const req = store.add({articleId, readAt:new Date().toISOString(), timeSpentSec});
      req.onsuccess = ()=>resolve(true);
      req.onerror = ()=>resolve(false);
    });
  },
  async getHistoryToday(){
    const store = await tx('history');
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    return new Promise((resolve)=>{
      const req = store.getAll();
      req.onsuccess = ()=>{
        const rows = (req.result||[]).filter(r=> new Date(r.readAt) >= startOfDay);
        resolve(rows);
      };
      req.onerror = ()=>resolve([]);
    });
  }
};
