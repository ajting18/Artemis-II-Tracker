const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const timeline = [
    { date: 'FEB 2, 2026', event: 'Wet Dress Rehearsal 1', desc: 'Liquid hydrogen leak identified during first WDR. Rocket returned to VAB for repairs.', status: 'done' },
    { date: 'FEB 19, 2026', event: 'Wet Dress Rehearsal 2', desc: 'Successful second WDR completed. All propellant loading verified.', status: 'done' },
    { date: 'MAR 20, 2026', event: 'Rollout to Launch Pad 39B', desc: 'SLS with Orion spacecraft rolled to LC-39B after resolving helium flow issue.', status: 'done' },
    { date: 'APR 1, 2026 — 6:24 PM EDT', event: 'LAUNCH — Artemis II Lifts Off!', desc: 'SLS lifted off from Kennedy Space Center. Core stage separation and solar array deployment confirmed.', status: 'done' },
    { date: 'APR 1, 2026', event: 'Trans-Lunar Injection (TLI)', desc: 'ICPS burn propelled Orion toward the Moon. Crew entering transit phase.', status: 'done' },
    { date: 'APR 1–5, 2026', event: '⚡ CURRENT — Lunar Transit', desc: 'Orion in free-return trajectory toward the Moon. Crew conducting systems checks and science activities.', status: 'active' },
    { date: 'APR 5–6, 2026', event: 'Lunar Flyby', desc: 'Orion will reach closest lunar approach and slingshot around the Moon for the return journey.', status: 'upcoming' },
    { date: 'APR 6–10, 2026', event: 'Return Transit', desc: 'Orion begins return trajectory to Earth. Crew completes mission objectives and prepares for re-entry.', status: 'upcoming' },
    { date: 'APR 10–11, 2026', event: 'Splashdown', desc: 'Orion capsule re-enters Earth\'s atmosphere and splashes down in the Pacific Ocean for recovery.', status: 'upcoming' },
  ];

  const crew = [
    { name: 'Reid Wiseman', role: 'Commander', initials: 'RW', flag: '🇺🇸', bio: 'NASA astronaut and Navy test pilot. Selected for Artemis II after commanding ISS Expedition 41/42. Leading humanity\'s return to the Moon.', gradient: 'linear-gradient(135deg, #1a56db, #06b6d4)' },
    { name: 'Victor Glover', role: 'Pilot', initials: 'VG', flag: '🇺🇸', bio: 'First person of color to travel beyond low Earth orbit. Navy test pilot and former ISS crew member on SpaceX Crew-1.', gradient: 'linear-gradient(135deg, #1a56db, #10b981)' },
    { name: 'Christina Koch', role: 'Mission Specialist', initials: 'CK', flag: '🇺🇸', bio: 'First woman to travel beyond low Earth orbit. Holds the record for longest spaceflight by a woman at 328 days aboard the ISS.', gradient: 'linear-gradient(135deg, #9146ff, #06b6d4)' },
    { name: 'Jeremy Hansen', role: 'Mission Specialist (CSA)', initials: 'JH', flag: '🇨🇦', bio: 'Canadian Space Agency astronaut — the first non-American to fly beyond low Earth orbit. Former CF-18 Hornet pilot.', gradient: 'linear-gradient(135deg, #dc2626, #f59e0b)' },
  ];

  res.render('index', { timeline, crew });
});

module.exports = router;
