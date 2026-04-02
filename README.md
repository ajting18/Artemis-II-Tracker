# 🚀 Artemis II Mission Tracker

A real-time daily tracker for NASA's Artemis II Moon Mission — the first crewed lunar mission since Apollo 17 in 1972.

## Live Demo
**[https://artemis-ii-tracker.onrender.com](https://artemis-ii-tracker.onrender.com)**

## Features

- **Mission Clock** — Live Mission Elapsed Time (MET) counter from launch
- **Orion Location Tracker** — Animated orbital map showing real-time spacecraft position, distance from Earth/Moon, and velocity
- **NASA TV Live Stream** — Embedded YouTube live feed with links to NASA TV and Twitch
- **Mission Updates** — Timestamped updates covering launch milestones, crew status, navigation, and systems
- **Photo Gallery** — Live pulls from the NASA Images API
- **Mission Timeline** — Full chronology from wet dress rehearsals through splashdown
- **Crew Profiles** — All 4 astronauts: Wiseman, Glover, Koch, and Hansen

## Crew

| Name | Role | Agency |
|------|------|--------|
| Reid Wiseman | Commander | NASA |
| Victor Glover | Pilot | NASA |
| Christina Koch | Mission Specialist | NASA |
| Jeremy Hansen | Mission Specialist | CSA |

## Tech Stack

- **Node.js** + **Express** — server and API routes
- **EJS** — server-side templating
- **Vanilla JS** — client-side clock, canvas orbit tracker, NASA API fetching
- **NASA Images API** — public photo library (no key required)
- **HTML5 Canvas** — animated free-return trajectory visualization

## Getting Started

```bash
git clone https://github.com/ajting18/Artemis-II-Tracker.git
cd Artemis-II-Tracker
npm install
npm start
```

Then open [http://localhost:3001](http://localhost:3001)

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Main tracker page |
| `GET /api/status` | Real-time orbital state (distance, speed, phase) |
| `GET /api/updates` | Mission update feed |

## Mission

**Launch:** April 1, 2026 at 6:24 PM EDT from Launch Complex 39B, Kennedy Space Center
**Duration:** ~10 days
**Objective:** First crewed flight of the Orion spacecraft beyond low Earth orbit — validating systems for future Artemis lunar landing missions.

---

*Not an official NASA product. Data sourced from [NASA Artemis II Mission](https://www.nasa.gov/mission/artemis-ii/).*
