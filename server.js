const express = require('express');
const path = require('path');
const missionRoutes = require('./routes/mission');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.use('/', missionRoutes);

// API: mission data
app.get('/api/status', (req, res) => {
  const state = getMissionState();
  res.json(state);
});

app.get('/api/updates', (req, res) => {
  res.json(getUpdates());
});

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
    crew: [
      { name: 'Reid Wiseman', role: 'Commander', agency: 'NASA', initials: 'RW' },
      { name: 'Victor Glover', role: 'Pilot', agency: 'NASA', initials: 'VG' },
      { name: 'Christina Koch', role: 'Mission Specialist', agency: 'NASA', initials: 'CK' },
      { name: 'Jeremy Hansen', role: 'Mission Specialist', agency: 'CSA', initials: 'JH' },
    ],
    launchTime: '2026-04-01T22:24:00Z',
    status: 'nominal',
  };
}

function getUpdates() {
  return [
    {
      time: 'MET +00:18', tag: 'launch', tagLabel: 'Launch',
      title: 'SLS Core Stage Separation Confirmed',
      body: 'The Space Launch System core stage successfully separated from the Interim Cryogenic Propulsion Stage (ICPS). Orion spacecraft and crew are healthy.'
    },
    {
      time: 'MET +00:26', tag: 'systems', tagLabel: 'Systems',
      title: 'Solar Array Wings Fully Deployed',
      body: 'All four solar array wings on the Orion spacecraft have deployed and are generating power. Electrical systems nominal across all channels.'
    },
    {
      time: 'MET +02:10', tag: 'nav', tagLabel: 'Navigation',
      title: 'Trans-Lunar Injection Burn Complete',
      body: 'The ICPS performed a successful TLI burn lasting approximately 18 minutes, placing Orion on a free-return trajectory toward the Moon. Spacecraft velocity: ~39,000 km/h.'
    },
    {
      time: 'MET +03:45', tag: 'crew', tagLabel: 'Crew',
      title: 'Crew Completes Initial Systems Checkout',
      body: 'Commander Reid Wiseman confirmed all four crew members are healthy and in good spirits. Life support systems operating nominally. Crew settling into lunar transit phase.'
    },
    {
      time: 'MET +06:00', tag: 'comms', tagLabel: 'Comms',
      title: 'Deep Space Network Handover',
      body: 'Communications handed from Kennedy Space Center to the Deep Space Network (DSN). Signal quality excellent via the Goldstone complex in California.'
    },
    {
      time: 'MET +08:30', tag: 'mission', tagLabel: 'Mission',
      title: 'First Mission Milestone: Earth Departure',
      body: 'Orion has passed 100,000 km from Earth — farther than any crewed spacecraft since Apollo 17 in 1972. Systems continue performing nominally as the crew heads toward the Moon.'
    },
    {
      time: 'MET +12:00', tag: 'systems', tagLabel: 'Systems',
      title: 'Thermal Control & Life Support Nominal',
      body: 'Environmental Control and Life Support System (ECLSS) maintaining cabin pressure, temperature, and atmospheric composition within nominal ranges. Crew rest cycle underway.'
    },
    {
      time: 'MET +18:00', tag: 'crew', tagLabel: 'Crew',
      title: 'Victor Glover Conducts Navigation Test',
      body: "Pilot Glover performed manual navigation exercises using Orion's optical navigation system, cross-checking against automated star trackers. Results exceeding expectations."
    },
  ];
}

app.listen(PORT, () => {
  console.log(`Artemis II Tracker running at http://localhost:${PORT}`);
});
