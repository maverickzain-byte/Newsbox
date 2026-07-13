/* ===========================================================
   Newsbox CORS proxy — deploy this on Cloudflare Workers (free tier)
   Free tier: 100,000 requests/day. Newsbox uses roughly 20-40/day.

   What it does: browsers block Newsbox from fetching RSS/JSON
   directly from news sites (a security rule called CORS). This
   worker fetches on the server side, where that rule doesn't
   apply, and returns the content with the right headers.

   Only allow-listed domains can be proxied, so this can't be
   abused as an open proxy for arbitrary sites.
=========================================================== */
const ALLOWED_HOSTS = [
  'espncricinfo.com','www.espncricinfo.com',
  'icc-cricket.com','www.icc-cricket.com',
  'cricbuzz.com','www.cricbuzz.com',
  'feeds.bbci.co.uk',
  'timesofindia.indiatimes.com',
  'feeds.feedburner.com',
  'economictimes.indiatimes.com',
  'indiatoday.in','www.indiatoday.in',
  'techcrunch.com',
  'theverge.com','www.theverge.com',
  'technologyreview.com','www.technologyreview.com',
  'feeds.reuters.com',
  'cnbc.com','www.cnbc.com',
  'feeds.npr.org',
  'rsshub.app',
  'news.google.com',
  'dispatch.com','www.dispatch.com',
  'trends.google.com',
  'www.reddit.com'
];

export default {
  async fetch(request){
    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url');

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if(request.method === 'OPTIONS'){
      return new Response(null, {headers: cors});
    }

    if(!target){
      return new Response('Missing ?url= parameter', {status:400, headers:cors});
    }

    let targetUrl;
    try{ targetUrl = new URL(target); } catch(e){
      return new Response('Invalid url', {status:400, headers:cors});
    }

    if(!ALLOWED_HOSTS.includes(targetUrl.hostname)){
      return new Response('Host not allow-listed: ' + targetUrl.hostname, {status:403, headers:cors});
    }

    try{
      const upstream = await fetch(targetUrl.toString(), {
        headers: {'User-Agent':'Mozilla/5.0 (compatible; NewsboxPersonalApp/1.0)'}
      });
      const body = await upstream.text();
      const contentType = upstream.headers.get('content-type') || 'text/plain';
      return new Response(body, {
        status: upstream.status,
        headers: {...cors, 'Content-Type': contentType, 'Cache-Control':'public, max-age=300'}
      });
    }catch(err){
      return new Response('Upstream fetch failed: ' + err.message, {status:502, headers:cors});
    }
  }
};
