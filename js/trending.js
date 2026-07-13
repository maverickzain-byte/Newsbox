/* ===========================================================
   Newsbox — trending.js
   Free trending-topic sources (stand-in for X trends, since
   X's API is no longer free to read):
     - Google Trends daily RSS (India + US)
     - Reddit "hot" JSON for a curated subreddit list
   Ranked by a simple recency+popularity score.
=========================================================== */
const TRENDS_RSS = [
  {geo:'India', url:'https://trends.google.com/trends/trendingsearches/daily/rss?geo=IN'},
  {geo:'US', url:'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US'}
];

const REDDIT_SOURCES = [
  {sub:'cricket', label:'Cricket'},
  {sub:'india', label:'India'},
  {sub:'worldnews', label:'World'},
  {sub:'technology', label:'Tech'}
];

async function fetchGoogleTrends(proxyUrl){
  const out = [];
  for(const t of TRENDS_RSS){
    try{
      const res = await fetch(proxied(t.url, proxyUrl));
      if(!res.ok) continue;
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const items = [...xml.querySelectorAll('item')].slice(0,8);
      items.forEach((item,i)=>{
        const title = item.querySelector('title')?.textContent?.trim();
        const trafficEl = item.getElementsByTagName('ht:approx_traffic')[0];
        const traffic = trafficEl ? trafficEl.textContent : null;
        const newsItem = item.getElementsByTagName('ht:news_item_title')[0];
        const reason = newsItem ? newsItem.textContent : null;
        if(title){
          out.push({
            topic:title, source:'Google Trends '+t.geo,
            score: 100 - i*5, traffic, reason,
            fetchedAt:new Date().toISOString()
          });
        }
      });
    }catch(e){ console.warn('trends fetch failed', t.geo, e.message); }
  }
  return out;
}

async function fetchRedditHot(proxyUrl){
  const out = [];
  for(const r of REDDIT_SOURCES){
    try{
      const url = `https://www.reddit.com/r/${r.sub}/hot.json?limit=6`;
      const res = await fetch(proxied(url, proxyUrl));
      if(!res.ok) continue;
      const data = await res.json();
      const posts = data?.data?.children || [];
      posts.forEach(p=>{
        const d = p.data;
        if(d.stickied) return;
        out.push({
          topic:d.title, source:'r/'+r.sub, label:r.label,
          score: d.score, comments:d.num_comments,
          link:'https://reddit.com'+d.permalink,
          reason:`${d.num_comments} comments · ${d.score} upvotes on r/${r.sub}`,
          fetchedAt:new Date().toISOString()
        });
      });
    }catch(e){ console.warn('reddit fetch failed', r.sub, e.message); }
  }
  return out;
}

async function getTrendingTopics(proxyUrl){
  const [trends, reddit] = await Promise.all([
    fetchGoogleTrends(proxyUrl), fetchRedditHot(proxyUrl)
  ]);
  const combined = [...trends, ...reddit];
  // normalize + rank: recency (all fresh, so mainly by score) + upvotes/traffic
  combined.sort((a,b)=> (b.score||0) - (a.score||0));
  return combined;
}
