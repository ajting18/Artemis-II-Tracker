const express = require('express');
const path = require('path');
const https = require('https');
const cron = require('node-cron');
const Parser = require('rss-parser');
const missionRoutes = require('./routes/mission');

const app = express();
const PORT = process.env.PORT || 3001;
const rssParser = new Parser();

// ─── HTTP HELPER ──────────────────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ArtemisIITracker/1.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.setTimeout(10000, () => { req.destroy(); resolve(''); });
  });
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── UPDATE CACHE ─────────────────────────────────────────────────────────────
// Hardcoded mission updates (always shown)
const MISSION_UPDATES = [
  { time: 'MET +00:18', tag: 'launch',   tagLabel: 'Launch',     title: 'SLS Core Stage Separation Confirmed',       body: 'The Space Launch System core stage successfully separated from the Interim Cryogenic Propulsion Stage (ICPS). Orion spacecraft and crew are healthy.' },
  { time: 'MET +00:26', tag: 'systems',  tagLabel: 'Systems',    title: 'Solar Array Wings Fully Deployed',           body: 'All four solar array wings on the Orion spacecraft have deployed and are generating power. Electrical systems nominal across all channels.' },
  { time: 'MET +02:10', tag: 'nav',      tagLabel: 'Navigation', title: 'Trans-Lunar Injection Burn Complete',        body: 'The ICPS performed a successful TLI burn lasting approximately 18 minutes, placing Orion on a free-return trajectory toward the Moon. Spacecraft velocity: ~39,000 km/h.' },
  { time: 'MET +03:45', tag: 'crew',     tagLabel: 'Crew',       title: 'Crew Completes Initial Systems Checkout',    body: 'Commander Reid Wiseman confirmed all four crew members are healthy and in good spirits. Life support systems operating nominally. Crew settling into lunar transit phase.' },
  { time: 'MET +06:00', tag: 'comms',    tagLabel: 'Comms',      title: 'Deep Space Network Handover',                body: 'Communications handed from Kennedy Space Center to the Deep Space Network (DSN). Signal quality excellent via the Goldstone complex in California.' },
  { time: 'MET +08:30', tag: 'mission',  tagLabel: 'Mission',    title: 'First Mission Milestone: Earth Departure',   body: 'Orion has passed 100,000 km from Earth — farther than any crewed spacecraft since Apollo 17 in 1972. Systems continue performing nominally.' },
  { time: 'MET +12:00', tag: 'systems',  tagLabel: 'Systems',    title: 'Thermal Control & Life Support Nominal',     body: 'Environmental Control and Life Support System (ECLSS) maintaining cabin pressure, temperature, and atmospheric composition within nominal ranges.' },
  { time: 'MET +18:00', tag: 'crew',     tagLabel: 'Crew',       title: 'Victor Glover Conducts Navigation Test',     body: "Pilot Glover performed manual navigation exercises using Orion's optical navigation system, cross-checking against automated star trackers. Results exceeding expectations." },
];

// Live updates fetched from NASA RSS (merged with mission updates)
let liveUpdates = [];
let lastFetched = null;

// NASA RSS feeds to pull Artemis updates from
const NASA_RSS_FEEDS = [
  'https://blogs.nasa.gov/artemis/feed/',
  'https://www.nasa.gov/news-release/feed/',
];

async function fetchNASAUpdates() {
  const fetched = [];
  for (const feedUrl of NASA_RSS_FEEDS) {
    try {
      const feed = await rssParser.parseURL(feedUrl);
      for (const item of (feed.items || []).slice(0, 6)) {
        const title = item.title || '';
        const lower = title.toLowerCase() + (item.contentSnippet || '').toLowerCase();
        // Only include Artemis-related items
        if (!lower.includes('artemis') && !lower.includes('orion') && !lower.includes('moon')) continue;
        fetched.push({
          time: new Date(item.pubDate || item.isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          tag: 'mission',
          tagLabel: 'NASA News',
          title: title.replace(/&#8217;/g, "'").replace(/&amp;/g, '&').replace(/&#8230;/g, '...').substring(0, 100),
          body: (item.contentSnippet || item.summary || '').replace(/\n/g, ' ').substring(0, 220) + '…',
          link: item.link,
          isLive: true,
        });
      }
    } catch (err) {
      console.warn(`RSS fetch failed for ${feedUrl}:`, err.message);
    }
  }

  if (fetched.length > 0) {
    liveUpdates = fetched;
    lastFetched = new Date();
    console.log(`[${lastFetched.toISOString()}] Fetched ${fetched.length} NASA updates from RSS`);
  }
}

function getUpdates() {
  // Merge live NASA RSS updates (newest first) with hardcoded mission updates
  const live = liveUpdates.map(u => ({ ...u, tag: 'mission', tagLabel: 'NASA News' }));
  return [...live, ...MISSION_UPDATES];
}

// Fetch on startup, then every 15 minutes
fetchNASAUpdates();
cron.schedule('*/15 * * * *', fetchNASAUpdates);

// ─── PHOTO CACHE ──────────────────────────────────────────────────────────────
let photoCache = [];
let photoLastFetched = null;

// Exciting search terms covering launches, Moon, Earth, astronauts
const NASA_PHOTO_QUERIES = [
  'artemis SLS Orion spacecraft launch',
  'rocket launch liftoff fire smoke',
  'SLS Space Launch System',
  'Moon lunar surface',
  'Earth from orbit astronaut view',
  'astronaut spacewalk EVA',
];

async function nasaImageSearch(query) {
  const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=12`;
  const data = await httpsGet(url);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return (parsed.collection?.items || [])
      .filter(i => i.links?.[0]?.href)
      .map(i => ({
        url: i.links[0].href,
        title: (i.data?.[0]?.title || '').replace(/&#\d+;/g, '').trim().substring(0, 80),
        desc:  (i.data?.[0]?.description || '').replace(/\n/g, ' ').trim().substring(0, 160),
        date:  i.data?.[0]?.date_created || '',
        source: 'NASA',
      }));
  } catch { return []; }
}

// Public Flickr feed — no API key needed
async function flickrPublicFeed(userId, sourceName) {
  const url = `https://api.flickr.com/services/feeds/photos_public.gne?id=${userId}&format=json&nojsoncallback=1`;
  const data = await httpsGet(url);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return (parsed.items || [])
      .map(i => ({
        url: (i.media?.m || '').replace('_m.jpg', '_b.jpg'),
        title: (i.title || sourceName).trim().substring(0, 80),
        desc:  (i.description || '').replace(/<[^>]*>/g, '').trim().substring(0, 160),
        date:  i.date_taken || '',
        source: sourceName,
      }))
      .filter(i => i.url);
  } catch { return []; }
}

async function fetchAllPhotos() {
  console.log('Fetching photos from NASA Images API, SpaceX Flickr, NASA Flickr...');

  // All requests fire in parallel
  const [spacexPhotos, nasaFlickrPhotos, ...nasaApiResults] = await Promise.all([
    flickrPublicFeed('130608600@N05', 'SpaceX'),   // SpaceX public Flickr
    flickrPublicFeed('44494372@N05',  'NASA'),      // NASA HQ public Flickr
    ...NASA_PHOTO_QUERIES.map(q => nasaImageSearch(q)),
  ]);

  const nasaApiPhotos = nasaApiResults.flat();

  // Priority: Artemis/Orion/SLS first, then SpaceX launches, then NASA general
  const prioritized = [
    ...nasaApiPhotos.filter(p => /artemis|orion|sls/i.test(p.title + ' ' + p.desc)),
    ...spacexPhotos,
    ...nasaApiPhotos.filter(p => /launch|rocket|liftoff|fire/i.test(p.title + ' ' + p.desc)),
    ...nasaFlickrPhotos,
    ...nasaApiPhotos,
  ];

  // Deduplicate by URL
  const seen = new Set();
  const result = [];
  for (const p of prioritized) {
    if (!p.url || seen.has(p.url)) continue;
    seen.add(p.url);
    result.push(p);
    if (result.length >= 28) break;
  }

  if (result.length > 0) {
    photoCache = result;
    photoLastFetched = new Date();
    console.log(`[${photoLastFetched.toISOString()}] Cached ${result.length} photos`);
  }
}

// Fetch photos on startup, then every 30 minutes
fetchAllPhotos();
cron.schedule('*/30 * * * *', fetchAllPhotos);

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/', missionRoutes);

app.get('/api/status', (req, res) => res.json(getMissionState()));
app.get('/api/updates', (req, res) => res.json(getUpdates()));
app.get('/api/photos', async (req, res) => {
  if (photoCache.length === 0) await fetchAllPhotos();
  res.json({ items: photoCache, fetchedAt: photoLastFetched });
});

// ─── MISSION STATE ────────────────────────────────────────────────────────────
function getMissionState() {
  const LAUNCH_UTC = new Date('2026-04-01T22:24:00Z');
  const MOON_DIST_KM = 384400;
  const now = new Date();
  const elapsed = (now - LAUNCH_UTC) / 1000;
  const hrs = elapsed / 3600;

  const phases = [
    { start: 0,   end: 2,    name: 'Launch & Ascent',        speed: [28000, 28000] },
    { start: 2,   end: 4,    name: 'Earth Orbit / TLI Burn', speed: [28000, 39000] },
    { start: 4,   end: 90,   name: 'Trans-Lunar Transit',    speed: [39000, 3800]  },
    { start: 90,  end: 120,  name: 'Lunar Flyby',            speed: [3800, 3500]   },
    { start: 120, end: 210,  name: 'Return Transit',         speed: [3500, 39000]  },
    { start: 210, end: 240,  name: 'Re-entry & Splashdown',  speed: [39000, 0]     },
  ];

  let phase = phases[phases.length - 1];
  for (const p of phases) {
    if (hrs >= p.start && hrs < p.end) { phase = p; break; }
  }

  const t = Math.min(1, (hrs - phase.start) / (phase.end - phase.start));
  const lerp = (a, b, t) => a + (b - a) * t;
  const speed = Math.round(lerp(phase.speed[0], phase.speed[1], t));

  let distFromEarth;
  if (hrs < 4) {
    distFromEarth = Math.min(Math.round(hrs * 15000), 60000);
  } else if (hrs < 90) {
    const tOut = (hrs - 4) / (90 - 4);
    distFromEarth = Math.round(lerp(60000, MOON_DIST_KM * 0.96, Math.pow(tOut, 0.7)));
  } else if (hrs < 120) {
    const tMoon = (hrs - 90) / 30;
    distFromEarth = Math.round(lerp(MOON_DIST_KM * 0.96, MOON_DIST_KM * 0.98, tMoon));
  } else if (hrs < 210) {
    const tRet = (hrs - 120) / 90;
    distFromEarth = Math.round(lerp(MOON_DIST_KM * 0.98, 40000, Math.pow(tRet, 0.7)));
  } else {
    distFromEarth = Math.round(lerp(40000, 0, Math.min(1, (hrs - 210) / 30)));
  }

  return {
    missionElapsedSeconds: elapsed,
    phase: phase.name,
    speed,
    distFromEarth,
    distFromMoon: Math.abs(MOON_DIST_KM - distFromEarth),
    launchTime: '2026-04-01T22:24:00Z',
    status: 'nominal',
    lastRSSFetch: lastFetched,
  };
}

app.listen(PORT, () => {
  console.log(`Artemis II Tracker running at http://localhost:${PORT}`);
});
