/* ===========================================================
   Newsbox — sample-data.js
   Demo articles so you can preview the UI before setting up
   the Cloudflare proxy. Loaded on demand from Settings, never
   automatically — clearly separate from live data.
=========================================================== */
function buildSampleArticles(){
  const now = Date.now();
  const mins = (n)=> new Date(now - n*60000).toISOString();
  const raw = [
    {title:'India post 312 in warm-up clash as top order clicks into gear', source:'ESPNcricinfo', category:'sports', subcategory:'Cricket', pubDate:mins(20), summary:'A fluent half-century set the tone before the middle order accelerated in the final ten overs.'},
    {title:'IPL auction date confirmed for next season', source:'Cricbuzz', category:'sports', subcategory:'Cricket', pubDate:mins(80), summary:'Franchises will have an increased purse this cycle, with a shift in the retention rules.'},
    {title:'ICC updates DRS protocol ahead of the next World Cup cycle', source:'ICC Cricket', category:'sports', subcategory:'Cricket', pubDate:mins(160), summary:'The change addresses a long-running debate about umpire\u2019s call on marginal decisions.'},
    {title:'Premier League leaders held to a draw in a tense derby', source:'BBC Football', category:'sports', subcategory:'Football', pubDate:mins(240), summary:'A late equalizer denied the league leaders a chance to open a five-point gap at the top.'},
    {title:'Reserve Bank holds rates steady, cites easing inflation', source:'Economic Times', category:'india', subcategory:'Business', pubDate:mins(45), summary:'The central bank\u2019s tone was more dovish than analysts expected, hinting at cuts later this year.'},
    {title:'Parliament session to take up new data protection amendments', source:'India Today Politics', category:'india', subcategory:'Politics', pubDate:mins(95), summary:'The proposed changes would tighten consent requirements for consumer apps.'},
    {title:'Metro expansion approved for two more corridors', source:'Times of India', category:'india', subcategory:'National', pubDate:mins(130), summary:'Construction is expected to begin within the fiscal year, easing congestion on key routes.'},
    {title:'New model claims state-of-the-art reasoning benchmarks', source:'TechCrunch', category:'ai', subcategory:'Tech', pubDate:mins(30), summary:'Independent evaluators are still verifying the results, but early replications look consistent.'},
    {title:'Regulators open inquiry into AI training data practices', source:'The Verge AI', category:'ai', subcategory:'AI', pubDate:mins(190), summary:'The inquiry focuses on consent and licensing for large-scale web-scraped datasets.'},
    {title:'Markets close higher on strong jobs data', source:'CNBC', category:'business', subcategory:'Markets', pubDate:mins(60), summary:'Tech and industrials led the gains, while bond yields ticked up modestly.'},
    {title:'Senate committee advances infrastructure funding bill', source:'NPR News', category:'us', subcategory:'National', pubDate:mins(75), summary:'The bill now moves to a full floor vote expected later this month.'},
    {title:'Columbus announces new downtown transit investment', source:'Columbus Dispatch', category:'ohio', subcategory:'Columbus', pubDate:mins(50), summary:'The plan includes expanded bus rapid transit lines connecting to the Short North.'},
    {title:'Ohio State early enrollment numbers show modest growth', source:'Google News — Ohio', category:'ohio', subcategory:'Local', pubDate:mins(210), summary:'Admissions officials point to expanded outreach in-state as a key driver.'}
  ];
  return raw.map(a=>({
    id: hashId(a.title),
    title: a.title, link: 'https://example.com/sample/'+hashId(a.title),
    source: a.source, category: a.category, subcategory: a.subcategory,
    pubDate: a.pubDate, summary: a.summary, content: a.summary,
    imageUrl: null, read:false, bookmarked:false, savedOffline:false,
    fetchedAt: new Date().toISOString(), isSample:true
  }));
}

async function loadSampleData(){
  await DB.putArticles(buildSampleArticles());
}
