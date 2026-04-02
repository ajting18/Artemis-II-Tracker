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
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;

  ctx.clearRect(0, 0, W, H);

  const traj = state.distFromEarth / MOON_DIST_KM;
  const earthX = W * 0.15, earthY = H / 2;
  const moonX = W * 0.85, moonY = H / 2;
  const cpX = W * 0.5, cpY = H * 0.1;
  const cp2X = W * 0.5, cp2Y = H * 0.9;

  // Outbound arc
  ctx.beginPath();
  ctx.moveTo(earthX, earthY);
  ctx.quadraticCurveTo(cpX, cpY, moonX, moonY);
  ctx.strokeStyle = 'rgba(245,158,11,0.15)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Return arc
  ctx.beginPath();
  ctx.moveTo(moonX, moonY);
  ctx.quadraticCurveTo(cp2X, cp2Y, earthX, earthY);
  ctx.strokeStyle = 'rgba(6,182,212,0.15)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Earth
  const earthGrad = ctx.createRadialGradient(earthX, earthY, 0, earthX, earthY, 30);
  earthGrad.addColorStop(0, 'rgba(30,130,255,0.9)');
  earthGrad.addColorStop(0.4, 'rgba(20,80,200,0.5)');
  earthGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(earthX, earthY, 30, 0, Math.PI * 2); ctx.fillStyle = earthGrad; ctx.fill();
  ctx.beginPath(); ctx.arc(earthX, earthY, 14, 0, Math.PI * 2); ctx.fillStyle = '#1a56db'; ctx.fill();
  ctx.beginPath(); ctx.arc(earthX, earthY, 14, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(100,180,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();

  // Moon
  const moonGrad = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 20);
  moonGrad.addColorStop(0, 'rgba(200,200,220,0.5)');
  moonGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(moonX, moonY, 20, 0, Math.PI * 2); ctx.fillStyle = moonGrad; ctx.fill();
  ctx.beginPath(); ctx.arc(moonX, moonY, 10, 0, Math.PI * 2); ctx.fillStyle = '#9ca3af'; ctx.fill();

  // Orion position
  const hrs = state.missionElapsedSeconds / 3600;
  let orionX, orionY;
  if (hrs < 120) {
    const tOut = Math.min(1, traj);
    orionX = (1 - tOut) * (1 - tOut) * earthX + 2 * (1 - tOut) * tOut * cpX + tOut * tOut * moonX;
    orionY = (1 - tOut) * (1 - tOut) * earthY + 2 * (1 - tOut) * tOut * cpY + tOut * tOut * moonY;
  } else {
    const tRet = Math.min(1, 1 - traj);
    orionX = (1 - tRet) * (1 - tRet) * moonX + 2 * (1 - tRet) * tRet * cp2X + tRet * tRet * earthX;
    orionY = (1 - tRet) * (1 - tRet) * moonY + 2 * (1 - tRet) * tRet * cp2Y + tRet * tRet * earthY;
  }

  // Orion glow + dot
  const orGrad = ctx.createRadialGradient(orionX, orionY, 0, orionX, orionY, 16);
  orGrad.addColorStop(0, 'rgba(245,158,11,0.8)');
  orGrad.addColorStop(0.5, 'rgba(245,158,11,0.3)');
  orGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(orionX, orionY, 16, 0, Math.PI * 2); ctx.fillStyle = orGrad; ctx.fill();
  ctx.beginPath(); ctx.arc(orionX, orionY, 5, 0, Math.PI * 2); ctx.fillStyle = '#f59e0b'; ctx.fill();
  ctx.beginPath(); ctx.arc(orionX, orionY, 5, 0, Math.PI * 2);
  ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();

  // Labels
  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('EARTH', earthX, earthY + 28);
  ctx.fillText('MOON', moonX, moonY + 24);
  ctx.font = '700 10px Orbitron, monospace';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('ORION', orionX, orionY - 14);
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
