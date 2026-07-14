/* ===========================================================
   Newsbox — trending.js  (v2)
   Trending sources, chosen for reliability from a Cloudflare
   Worker / browser context:
     - Wikipedia "most viewed articles" — genuine trending
       signal, free, and CORS-open so it's fetched directly,
       no proxy needed.
     - Google News top stories (India + US) — via the same
       proxy already used for RSS feeds.
   (Reddit and the old Google Trends daily RSS were tried first
   but are unreliable from server/proxy IPs: Reddit blocks
   cloud/proxy traffic outright, and Google retired that RSS
   URL. Swapped out for the above, which are stable.)
=========================================================== */

function ymdOffset(daysAgo){
  const d = new Date(Date.now() - daysAgo*24*60*60*1000);
  return {
    y: d.getFullYear(),
    m: String(d.getMonth()+1).padStart(2,'0'),
    d: String(d.getDate()).padStart(2,'0')
  };
}

async function fetchWikipediaTrending(){
  const out = [];
  // Wikimedia's pageview data can lag a day; try yesterday, then the day before.
  for(const daysAgo of [1,2]){
    try{
      const {y,m,d} = ymdOffset(daysAgo);
      const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${d}`;
      const res = await fetch(url);
      if(!res.ok) continue;
      const data = await res.json();
      const articles = data?.items?.[0]?.articles || [];
      articles
        .filter(a=> a.article && !a.article.startsWith('Special:') && a.article !== 'Main_Page')
        .slice(0,10)
        .forEach(a=>{
          out.push({
            topic: decodeURIComponent(a.article).replace(/_/g,' '),
            source: 'Wikipedia — most viewed',
            score: a.views,
            reason: `${a.views.toLocaleString()} page views yesterday`,
            link: 'https://en.wikipedia.org/wiki/' + a.article,
            fetchedAt: new Date().toISOString()
          });
        });
      if(out.length) break; // got usable data, stop trying older days
    }catch(e){ console.warn('wikipedia trending failed for daysAgo='+daysAgo, e.message); }
  }
  return out;
}

const NEWS_TRENDING_FEEDS = [
  {label:'India', url:'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en'},
  {label:'US', url:'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'}
];

async function fetchNewsTrending(proxyUrl){
  const out = [];
  for(const f of NEWS_TRENDING_FEEDS){
    try{
      const res = await fetch(proxied(f.url, proxyUrl));
      if(!res.ok) continue;
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const items = [...xml.querySelectorAll('item')].slice(0,6);
      items.forEach((item,i)=>{
        const title = item.querySelector('title')?.textContent?.trim();
        const link = item.querySelector('link')?.textContent?.trim();
        if(title){
          out.push({
            topic: title,
            source: 'Google News — ' + f.label,
            score: 55 - i*4,
            link,
            reason: `Top story right now — ${f.label}`,
            fetchedAt: new Date().toISOString()
          });
        }
      });
    }catch(e){ console.warn('news trending failed', f.label, e.message); }
  }
  return out;
}

async function getTrendingTopics(proxyUrl){
  const [wiki, news] = await Promise.all([
    fetchWikipediaTrending(),
    fetchNewsTrending(proxyUrl)
  ]);
  const combined = [...wiki, ...news];
  combined.sort((a,b)=> (b.score||0) - (a.score||0));
  return combined;
}