/* ===========================================================
   Newsbox — briefing.js
   Builds the "Daily Briefing": top N stories per priority
   category, capped to a ~5 minute read (avg 200 wpm).
=========================================================== */
const BRIEFING_CATEGORIES = [
  {key:'sports', label:'Top Sports', count:3},
  {key:'india', label:'Top Indian News', count:3},
  {key:'trending', label:'Top Trending', count:2},
  {key:'ai', label:'Top AI News', count:2}
];
const WORDS_PER_MINUTE = 200;
const TARGET_MAX_MINUTES = 5;

function estimateReadMinutes(articles){
  const words = articles.reduce((sum,a)=> sum + ((a.summary||'').split(/\s+/).length), 0);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

async function buildDailyBriefing(){
  const sections = [];
  let picked = [];

  for(const cat of BRIEFING_CATEGORIES){
    let items = [];
    if(cat.key === 'trending'){
      const proxyUrl = (await DB.getSettings()).proxyUrl;
      items = (await getTrendingTopics(proxyUrl)).slice(0, cat.count).map(t=>({
        title:t.topic, summary:t.reason || t.source, source:t.source, category:'trending', isTrend:true
      }));
    } else {
      items = await DB.getByCategory(cat.key, cat.count);
    }
    sections.push({label:cat.label, key:cat.key, items});
    picked = picked.concat(items);
  }

  // trim if over target read time
  let minutes = estimateReadMinutes(picked);
  while(minutes > TARGET_MAX_MINUTES){
    // remove the last item from the largest section
    let largest = sections.reduce((a,b)=> (a.items.length > b.items.length ? a : b));
    if(largest.items.length <= 1) break;
    largest.items.pop();
    picked = sections.flatMap(s=>s.items);
    minutes = estimateReadMinutes(picked);
  }

  return {
    generatedAt: new Date().toISOString(),
    estMinutes: minutes,
    sections
  };
}
