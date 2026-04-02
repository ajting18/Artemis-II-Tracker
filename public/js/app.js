const LAUNCH_UTC = new Date('2026-04-01T22:24:00Z');
const MOON_DIST_KM = 384400;

// ─── MET CLOCK ───────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const elapsed = now - LAUNCH_UTC;
  if (elapsed < 0) {
    document.getElementById('metClock').innerHTML = 'T– Awaiting Launch';
    return;
  }
  const s = Math.floor(elapsed / 1000) % 60;
  const m = Math.floor(elapsed / 60000) % 60;
  const h = Math.floor(elapsed / 3600000) % 24;
  const d = Math.floor(elapsed / 86400000);
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('metClock').innerHTML =
    `T+ <span>${pad(d)}</span>d <span>${pad(h)}</span>h <span>${pad(m)}</span>m <span>${pad(s)}</span>s`;
}

// ─── LOCATION (fetches from API) ─────────────────────────────────────────────
async function updateLocation() {
  try {
    const res = await fetch('/api/status');
    const state = await res.json();
    const fmt = n => n.toLocaleString();
    document.getElementById('distEarth').textContent = fmt(state.distFromEarth);
    document.getElementById('distMoon').textContent = fmt(state.distFromMoon);
    document.getElementById('velocity').textContent = fmt(state.speed);
    document.getElementById('missionPhase').textContent = state.phase;
    document.getElementById('statusPhase').textContent = 'Phase: ' + state.phase;
    drawOrbit(state);
  } catch (e) {
    console.error('Failed to fetch mission status', e);
  }
}

// ─── UPDATES (fetches from API) ──────────────────────────────────────────────
async function loadUpdates() {
  try {
    const res = await fetch('/api/updates');
    const updates = await res.json();
    const grid = document.getElementById('updatesGrid');
    grid.innerHTML = updates.map(u => `
      <div class="update-card">
        <div class="update-meta">
          <div class="update-time">${u.time}</div>
          <span class="update-tag tag-${u.tag}">${u.tagLabel}</span>
        </div>
        <div class="update-title">${u.title}</div>
        <div class="update-body">${u.body}</div>
      </div>
    `).join('');
    document.getElementById('updateTimestamp').textContent =
      'Last refresh: ' + new Date().toLocaleTimeString();
  } catch (e) {
    console.error('Failed to load updates', e);
  }
}

// ─── ORBIT CANVAS ────────────────────────────────────────────────────────────
function drawOrbit(state) {
  const canvas = document.getElementById('orbitCanvas');
  const ctx    = canvas.getContext('2d');
  const dpr    = window.devicePixelRatio || 1;
  const rect   = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  ctx.clearRect(0, 0, W, H);

  const hrs      = Math.max(0, state.missionElapsedSeconds / 3600);
  const clampHrs = Math.min(hrs, 240);

  // ── Body positions ─────────────────────────────────────────────────────────
  const eX = W * 0.12, eY = H * 0.50;   // Earth centre
  const mX = W * 0.77, mY = H * 0.50;   // Moon centre
  // Flyby arc radius (spacecraft swings ~8,900 km from Moon surface at scale)
  const flyR = Math.max(30, Math.min(46, W * 0.072));

  // ── Outbound bezier (high arc) → Moon approach from upper-left ────────────
  const o1x = W * 0.30, o1y = H * 0.05;   // CP1 – launches steeply
  const o2x = W * 0.63, o2y = H * 0.09;   // CP2 – curves toward Moon
  // Approach / departure points sit on the flyby circle at ±2.18 rad (≈±125°)
  const maX = mX + Math.cos(-2.18) * flyR; // upper-left of Moon
  const maY = mY + Math.sin(-2.18) * flyR;
  const mdX = mX + Math.cos( 2.18) * flyR; // lower-left of Moon
  const mdY = mY + Math.sin( 2.18) * flyR;

  // ── Return bezier (low arc) from Moon departure → Earth ───────────────────
  const r1x = W * 0.63, r1y = H * 0.91;
  const r2x = W * 0.30, r2y = H * 0.95;

  // ── Helper: point on cubic bezier at t ────────────────────────────────────
  function bezPt(x0,y0,x1,y1,x2,y2,x3,y3,t) {
    const u = 1 - t;
    return {
      x: u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3,
      y: u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3
    };
  }

  // ── Mission phase times (hours) ────────────────────────────────────────────
  const OUTBOUND_END = 88;   // ~3.7 days Earth→Moon approach
  const FLYBY_END    = 113;  // ~25 h for lunar flyby
  const MISSION_END  = 240;  // ~10-day mission

  // ── Orion's current position on the correct trajectory segment ─────────────
  let orionX, orionY;
  if (clampHrs <= OUTBOUND_END) {
    const p = bezPt(eX,eY,o1x,o1y,o2x,o2y,maX,maY, clampHrs / OUTBOUND_END);
    orionX = p.x; orionY = p.y;
  } else if (clampHrs <= FLYBY_END) {
    const t     = (clampHrs - OUTBOUND_END) / (FLYBY_END - OUTBOUND_END);
    const angle = -2.18 + 4.36 * t;          // sweeps through 0 = far side
    orionX = mX + Math.cos(angle) * flyR;
    orionY = mY + Math.sin(angle) * flyR;
  } else {
    const p = bezPt(mdX,mdY,r1x,r1y,r2x,r2y,eX,eY, (clampHrs - FLYBY_END) / (MISSION_END - FLYBY_END));
    orionX = p.x; orionY = p.y;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DRAW ORDER: dim full path first → bright traveled path on top → bodies → labels
  // ─────────────────────────────────────────────────────────────────────────

  // ── 1. Dim full trajectory backdrop ───────────────────────────────────────
  ctx.setLineDash([4, 7]);
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(eX, eY);
  ctx.bezierCurveTo(o1x,o1y,o2x,o2y,maX,maY);
  ctx.strokeStyle = 'rgba(245,158,11,0.14)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(mX, mY, flyR, -2.18, 2.18, false);
  ctx.strokeStyle = 'rgba(6,182,212,0.14)';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(mdX, mdY);
  ctx.bezierCurveTo(r1x,r1y,r2x,r2y,eX,eY);
  ctx.strokeStyle = 'rgba(6,182,212,0.11)';
  ctx.stroke();

  ctx.setLineDash([]);

  // ── 2. Bright traveled path ────────────────────────────────────────────────
  const STEPS = 60;

  // Traveled outbound
  if (clampHrs > 0) {
    const tEnd = Math.min(clampHrs / OUTBOUND_END, 1);
    ctx.beginPath();
    ctx.moveTo(eX, eY);
    for (let i = 1; i <= Math.ceil(STEPS * tEnd); i++) {
      const p = bezPt(eX,eY,o1x,o1y,o2x,o2y,maX,maY, i / STEPS);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(245,158,11,0.80)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Traveled flyby arc
  if (clampHrs > OUTBOUND_END) {
    const flyT  = Math.min((clampHrs - OUTBOUND_END) / (FLYBY_END - OUTBOUND_END), 1);
    const endA  = -2.18 + 4.36 * flyT;
    ctx.beginPath();
    ctx.arc(mX, mY, flyR, -2.18, endA, false);
    ctx.strokeStyle = 'rgba(6,182,212,0.90)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Traveled return arc
  if (clampHrs > FLYBY_END) {
    const retT = Math.min((clampHrs - FLYBY_END) / (MISSION_END - FLYBY_END), 1);
    ctx.beginPath();
    ctx.moveTo(mdX, mdY);
    for (let i = 1; i <= Math.ceil(STEPS * retT); i++) {
      const p = bezPt(mdX,mdY,r1x,r1y,r2x,r2y,eX,eY, i / STEPS);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(6,182,212,0.70)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ── 3. Milestone markers ───────────────────────────────────────────────────
  // TLI Burn (~2.5 h = 2.8% outbound)
  const tliPt = bezPt(eX,eY,o1x,o1y,o2x,o2y,maX,maY, 2.5 / OUTBOUND_END);
  const tliDone = clampHrs >= 2.5;
  ctx.beginPath(); ctx.arc(tliPt.x, tliPt.y, 3.5, 0, Math.PI*2);
  ctx.fillStyle = tliDone ? '#f59e0b' : 'rgba(245,158,11,0.25)'; ctx.fill();
  ctx.font = '500 8px Inter, sans-serif';
  ctx.fillStyle = tliDone ? 'rgba(245,158,11,0.85)' : 'rgba(245,158,11,0.25)';
  ctx.textAlign = 'left';
  ctx.fillText('TLI', tliPt.x + 5, tliPt.y - 4);

  // Closest approach (far side of Moon = rightmost point of flyby arc)
  const closestDone = clampHrs >= (OUTBOUND_END + FLYBY_END) / 2;
  ctx.beginPath(); ctx.arc(mX + flyR, mY, 3.5, 0, Math.PI*2);
  ctx.fillStyle = closestDone ? '#06b6d4' : 'rgba(6,182,212,0.25)'; ctx.fill();
  ctx.font = '500 8px Inter, sans-serif';
  ctx.fillStyle = closestDone ? 'rgba(6,182,212,0.85)' : 'rgba(6,182,212,0.25)';
  ctx.textAlign = 'left';
  ctx.fillText('CLOSEST', mX + flyR + 5, mY - 4);
  ctx.fillText('APPROACH', mX + flyR + 5, mY + 6);

  // Midpoint-return marker
  const midRetPt = bezPt(mdX,mdY,r1x,r1y,r2x,r2y,eX,eY, 0.5);
  const midRetDone = clampHrs >= FLYBY_END + (MISSION_END - FLYBY_END) * 0.5;
  ctx.beginPath(); ctx.arc(midRetPt.x, midRetPt.y, 3, 0, Math.PI*2);
  ctx.fillStyle = midRetDone ? '#06b6d4' : 'rgba(6,182,212,0.2)'; ctx.fill();

  // ── 4. Earth ───────────────────────────────────────────────────────────────
  const eGrad = ctx.createRadialGradient(eX,eY,0,eX,eY,34);
  eGrad.addColorStop(0,   'rgba(30,130,255,0.9)');
  eGrad.addColorStop(0.45,'rgba(20,80,200,0.45)');
  eGrad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(eX,eY,34,0,Math.PI*2);
  ctx.fillStyle = eGrad; ctx.fill();
  ctx.beginPath(); ctx.arc(eX,eY,14,0,Math.PI*2);
  ctx.fillStyle = '#1a56db'; ctx.fill();
  ctx.beginPath(); ctx.arc(eX,eY,14,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(100,180,255,0.55)'; ctx.lineWidth = 2; ctx.stroke();

  // ── 5. Moon ────────────────────────────────────────────────────────────────
  const mGrad = ctx.createRadialGradient(mX,mY,0,mX,mY,26);
  mGrad.addColorStop(0, 'rgba(200,200,220,0.6)');
  mGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(mX,mY,26,0,Math.PI*2);
  ctx.fillStyle = mGrad; ctx.fill();
  ctx.beginPath(); ctx.arc(mX,mY,11,0,Math.PI*2);
  ctx.fillStyle = '#9ca3af'; ctx.fill();
  // Craters
  [[-3,-4,2.2],[4,-2,1.6],[1,5,1.6],[-5,3,1.2]].forEach(([cx,cy,cr]) => {
    ctx.beginPath(); ctx.arc(mX+cx, mY+cy, cr, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  });

  // ── 6. Orion spacecraft ────────────────────────────────────────────────────
  const orGrad = ctx.createRadialGradient(orionX,orionY,0,orionX,orionY,18);
  orGrad.addColorStop(0,   'rgba(245,158,11,0.9)');
  orGrad.addColorStop(0.5, 'rgba(245,158,11,0.3)');
  orGrad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(orionX,orionY,18,0,Math.PI*2);
  ctx.fillStyle = orGrad; ctx.fill();
  ctx.beginPath(); ctx.arc(orionX,orionY,5,0,Math.PI*2);
  ctx.fillStyle = '#f59e0b'; ctx.fill();
  ctx.beginPath(); ctx.arc(orionX,orionY,5,0,Math.PI*2);
  ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();

  // ── 7. Labels ──────────────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.font = '600 10px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('EARTH', eX, eY + 30);
  ctx.fillText('MOON',  mX, mY + 30);

  ctx.font = '700 9.5px Orbitron, monospace';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('ORION', orionX, orionY - 14);

  // Arc direction hint: "FAR SIDE" label above Moon
  if (clampHrs > OUTBOUND_END - 15 && clampHrs < FLYBY_END + 15) {
    ctx.font = '500 8px Inter, sans-serif';
    ctx.fillStyle = 'rgba(6,182,212,0.7)';
    ctx.fillText('─── LUNAR FLYBY ───', mX, mY - 34);
  }

  // Phase label bottom-right
  ctx.font = '500 8.5px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'right';
  ctx.fillText(state.phase.toUpperCase(), W - 8, H - 8);
}

// ─── PHOTOS (via server /api/photos → NASA Images API) ───────────────────────
async function loadPhotos() {
  const gallery = document.getElementById('photoGallery');
  try {
    const res = await fetch('/api/photos');
    const data = await res.json();
    if (!data.items || data.items.length === 0) throw new Error('No photos');
    const SOURCE_COLORS = { SpaceX: '#005288', NASA: '#1a56db' };
    gallery.innerHTML = data.items.map(p => {
      const title  = (p.title  || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      const desc   = (p.desc   || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      const source = p.source || '';
      const badgeColor = SOURCE_COLORS[source] || '#1a56db';
      const sourceBadge  = source ? `<div class="photo-source-badge" style="background:${badgeColor}">${source}</div>` : '';
      const launchBadge  = p.pinned ? `<div class="photo-launch-badge">${p.badge || '🚀 LAUNCH'}</div>` : '';
      const pinnedClass  = p.pinned ? ' photo-item--pinned' : '';
      return `
        <div class="photo-item${pinnedClass}" onclick="openLightbox('${p.url}','${title}','${desc}')">
          <img src="${p.url}" alt="${title}" loading="lazy" onerror="this.parentElement.style.display='none'"/>
          ${launchBadge}${sourceBadge}
          <div class="photo-overlay"><div class="photo-caption">${title}</div></div>
        </div>`;
    }).join('') + `
      <div style="grid-column:1/-1;text-align:center;margin-top:0.5rem">
        <a href="https://images.nasa.gov/search?q=artemis+launch+rocket" target="_blank" style="color:var(--cyan);font-size:0.8rem;text-decoration:none">Browse full NASA Image Library →</a>
      </div>`;
  } catch {
    gallery.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:2rem;font-size:0.85rem">
      Photos loading… <a href="https://images.nasa.gov/search?q=artemis+II" target="_blank" style="color:var(--cyan)">Browse NASA Image Library →</a>
    </div>`;
  }
}

// ─── LIGHTBOX ────────────────────────────────────────────────────────────────
function openLightbox(url, title, desc) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightboxImg').alt = title;
  document.getElementById('lightboxCaption').textContent = desc;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeLightbox();
});

// ─── VIDEO PLAYER ────────────────────────────────────────────────────────────
function playFeatured(id, title, desc, badge, meta) {
  document.getElementById('featuredIframe').src =
    `https://www.youtube.com/embed/${id}?rel=0&autoplay=1`;
  document.querySelector('.video-featured-title').textContent = title;
  document.querySelector('.video-featured-desc').textContent = desc;
  document.querySelector('.video-badge').textContent = badge;
  document.querySelector('.video-meta').innerHTML =
    meta.split('·').map(s => `<span>${s.trim()}</span>`).join('');
  document.getElementById('videos').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── LAST UPDATED ────────────────────────────────────────────────────────────
function updateTimestamp() {
  document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
}

// ─── CANVAS RESIZE ───────────────────────────────────────────────────────────
const ro = new ResizeObserver(() => updateLocation());
ro.observe(document.getElementById('orbitCanvas').parentElement);

// ─── INIT ────────────────────────────────────────────────────────────────────
loadUpdates();
loadPhotos();
updateTimestamp();
updateClock();
updateLocation();

setInterval(updateClock, 1000);
setInterval(updateLocation, 5000);
setInterval(updateTimestamp, 60000);
setInterval(loadUpdates, 5 * 60 * 1000);   // refresh updates every 5 min
setInterval(loadPhotos,  30 * 60 * 1000);  // refresh photos every 30 min
