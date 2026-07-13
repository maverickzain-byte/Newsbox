/* ===========================================================
   Newsbox — feeds.js
   Free RSS sources, grouped by category. Cricket listed first
   under sports per spec. All fetches go through the user's
   Cloudflare Worker CORS proxy (set in Settings).
=========================================================== */
const FEED_SOURCES = {
  sports: [
    // Cricket first — priority per spec
    {name:'ESPNcricinfo', sub:'Cricket', url:'https://www.espncricinfo.com/rss/content/story/feeds/0.xml'},
    {name:'ICC Cricket', sub:'Cricket', url:'https://www.icc-cricket.com/rss/news'},
    {name:'Cricbuzz', sub:'Cricket', url:'https://www.cricbuzz.com/rss-feed/cricket-news'},
    {name:'BBC Football', sub:'Football', url:'https://feeds.bbci.co.uk/sport/football/rss.xml'},
    {name:'BBC Tennis', sub:'Tennis', url:'https://feeds.bbci.co.uk/sport/tennis/rss.xml'},
    {name:'BBC Sport', sub:'Other', url:'https://feeds.bbci.co.uk/sport/rss.xml'}
  ],
  india: [
    {name:'Times of India', sub:'National', url:'https://timesofindia.indiatimes.com/rssfeedstopstories.cms'},
    {name:'NDTV', sub:'National', url:'https://feeds.feedburner.com/ndtvnews-top-stories'},
    {name:'Economic Times', sub:'Business', url:'https://economictimes.indiatimes.com/rssfeedstopstories.cms'},
    {name:'NDTV Tech', sub:'Technology', url:'https://feeds.feedburner.com/gadgets360-latest'},
    {name:'India Today Politics', sub:'Politics', url:'https://www.indiatoday.in/rss/1206578'}
  ],
  ai: [
    {name:'TechCrunch', sub:'Tech', url:'https://techcrunch.com/feed/'},
    {name:'The Verge AI', sub:'AI', url:'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'},
    {name:'MIT Tech Review', sub:'AI', url:'https://www.technologyreview.com/feed/'}
  ],
  business: [
    {name:'Reuters Business', sub:'Global', url:'https://feeds.reuters.com/reuters/businessNews'},
    {name:'CNBC', sub:'Markets', url:'https://www.cnbc.com/id/10001147/device/rss/rss.html'}
  ],
  us: [
    {name:'NPR News', sub:'National', url:'https://feeds.npr.org/1001/rss.xml'},
    {name:'AP Top News', sub:'National', url:'https://rsshub.app/apnews/topics/ap-top-news'}
  ],
  ohio: [
    {name:'Google News — Ohio', sub:'Local', url:'https://news.google.com/rss/search?q=Ohio&hl=en-US&gl=US&ceid=US:en'},
    {name:'Columbus Dispatch', sub:'Columbus', url:'https://www.dispatch.com/arc/outboundfeeds/rss/'}
  ]
};

const CATEGORY_LABELS = {
  sports:'Sports', india:'India', trending:'Trending', ai:'AI & Technology',
  business:'Business & Finance', us:'US News', ohio:'Ohio News'
};

function proxied(url, proxyUrl){
  if(!proxyUrl) return url; // will fail without proxy; UI warns in Settings
  return proxyUrl.replace(/\/$/,'') + '?url=' + encodeURIComponent(url);
}

function hashId(str){
  let h = 0;
  for(let i=0;i<str.length;i++){ h = (Math.imul(31,h) + str.charCodeAt(i))|0; }
  return 'a' + Math.abs(h);
}

function stripHtml(html){
  if(!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

function firstImage(html){
  if(!html) return null;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function fetchFeed(source, category, proxyUrl){
  try{
    const res = await fetch(proxied(source.url, proxyUrl));
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    if(xml.querySelector('parsererror')) throw new Error('parse error');

    const items = [...xml.querySelectorAll('item, entry')].slice(0, 15);
    return items.map(item=>{
      const title = item.querySelector('title')?.textContent?.trim() || '(untitled)';
      let link = item.querySelector('link')?.textContent?.trim();
      if(!link){ link = item.querySelector('link')?.getAttribute('href') || ''; }
      const pubDate = item.querySelector('pubDate')?.textContent
                    || item.querySelector('published')?.textContent
                    || item.querySelector('updated')?.textContent
                    || new Date().toISOString();
      const rawDesc = item.querySelector('description')?.textContent
                    || item.querySelector('summary')?.textContent || '';
      const contentEnc = item.getElementsByTagName('content:encoded')[0]?.textContent || rawDesc;
      const summary = stripHtml(rawDesc).slice(0,220);
      const imageUrl = item.querySelector('media\\:content, media\\:thumbnail, enclosure')?.getAttribute('url')
                     || firstImage(contentEnc);

      return {
        id: hashId(link || title),
        title, link,
        source: source.name,
        category, subcategory: source.sub,
        pubDate: new Date(pubDate).toISOString(),
        summary,
        content: stripHtml(contentEnc),
        imageUrl,
        read:false, bookmarked:false, savedOffline:false,
        fetchedAt: new Date().toISOString()
      };
    }).filter(a=>a.link);
  }catch(err){
    console.warn('Feed failed:', source.name, err.message);
    return [];
  }
}

async function refreshCategory(category, proxyUrl){
  const sources = FEED_SOURCES[category] || [];
  const results = await Promise.all(sources.map(s=>fetchFeed(s, category, proxyUrl)));
  const flat = results.flat();
  if(flat.length) await DB.putArticles(flat);
  return flat;
}

async function refreshAllCategories(proxyUrl){
  const cats = Object.keys(FEED_SOURCES);
  const all = await Promise.all(cats.map(c=>refreshCategory(c, proxyUrl)));
  return all.flat();
}
