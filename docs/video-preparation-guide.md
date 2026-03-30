# Video Preparation Guide — CloudWatch AI Demo

Everything you need to do **before** hitting record.

---

## 1. Environment Setup

### Browser
- [ ] Use **Chrome or Firefox** (clean profile or incognito recommended)
- [ ] **Disable all ad blockers** — uBlock Origin, AdBlock Plus, etc. The `/analytics/*` routes get blocked otherwise (`ERR_BLOCKED_BY_CLIENT`)
- [ ] Close unrelated tabs — keeps the screen clean and avoids notification popups
- [ ] Set browser zoom to **100%** (Cmd+0)
- [ ] Enable **dark mode** on the dashboard (looks better on video; toggle is on the login page and sidebar)

### Screen & Display
- [ ] Set resolution to **1920×1080** if possible (standard for video)
- [ ] Hide your macOS dock (System Settings → Desktop & Dock → Automatically hide and show the Dock)
- [ ] Turn on **Do Not Disturb** (Focus mode) — no notifications during recording
- [ ] Close Slack, Discord, Messages, Mail — anything that can pop up
- [ ] If using an external monitor, record on the one with better resolution

### Recording Software
- [ ] Use **OBS Studio** (free), **QuickTime** (built-in on Mac), or **Loom** (easy + webcam overlay)
- [ ] If using OBS: set output to 1080p, 30fps, `.mp4` format
- [ ] Do a 10-second test recording first — check audio levels and screen capture area
- [ ] If showing your face (recommended for presentations), position webcam overlay in bottom-right corner, small size

### Audio
- [ ] Use a **headset mic or external mic** if available — built-in laptop mics pick up fan noise
- [ ] Record in a quiet room
- [ ] Do a test recording and play it back — check for echo, background hum, keyboard clicks
- [ ] Speak at a normal conversational pace (not too fast)

---

## 2. AWS / Backend Checklist

### Verify Services Are Running
- [ ] Open the app in browser and confirm you can **log in**
- [ ] Navigate to each page and confirm data loads:
  - `/` — Live Controls: scenario dropdown visible, service cards render
  - `/timeline` — KPI Timeline: chart renders with some data
  - `/alerts` — Alerts page loads (may be empty if no simulation has run)
  - `/analytics` — All 4 stat cards + charts render (disable ad blocker!)
- [ ] If any page shows errors, check the browser console (F12 → Console) and fix before recording

### Pre-Seed Some Data
This is important — you don't want to demo on an empty dashboard.

- [ ] **Run a full simulation cycle before recording:**
  1. Go to Live Controls
  2. Select "Web API Degradation" scenario
  3. Click **Start Simulation**
  4. Wait ~15 minutes for it to go through Normal → Degrading → Incident → Recovery → Normal
  5. Click **Stop Simulation**
  6. This will populate KPI data, alerts, incidents, and analytics

- [ ] **Run a second scenario** (optional but recommended for richer data):
  1. Select "DB Cascade Failure"
  2. Start → wait 15 min → Stop

- [ ] After simulation runs, verify:
  - KPI Timeline shows line charts with incident shading
  - Alerts page has both active and historical alerts
  - Analytics page shows precision, lead time, detection rate stats

### Prepare a Fresh Simulation for Live Demo
- [ ] Make sure simulation is **stopped** before you start recording
- [ ] You'll start a new simulation live during the video to show real-time updates

---

## 3. Demo Account Setup

- [ ] Have **two accounts** ready:
  - **Account A:** Already logged in (your main demo account with pre-seeded data)
  - **Account B:** A fresh account you'll create live to demo the sign-up flow
    - Pick a real email you can access during recording (you need the verification code)
    - Or: create this account beforehand but demo the login flow instead of full sign-up (safer, less can go wrong)

- [ ] Write down the credentials somewhere off-screen so you don't fumble during recording

---

## 4. Plan Your Screen Flow

Rehearse the exact order you'll click through. Here's the recommended flow matching the script:

```
1. Login page (show sign-in or sign-up)
2. Live Controls → Start simulation → watch services update
3. KPI Timeline → switch services, toggle horizons
4. Alerts → show active alerts, acknowledge one
5. Analytics → walk through charts
6. (Optional) Show real-time: go back to Live Controls,
   show services changing as simulation progresses
7. Stop simulation
```

- [ ] Do one full dry run clicking through this flow while talking out loud
- [ ] Time yourself — aim for **3.5–4 minutes** of content (leaves room for editing)
- [ ] Note any spots where pages load slowly — you can cut these in editing or narrate over them

---

## 5. Load Testing Demo (Optional but Impressive)

If you want to show "system performance under load":

### Option A: Show Architecture Slide (Easiest)
- [ ] Prepare a simple architecture diagram showing the serverless stack
- [ ] Explain that Lambda auto-scales and there's no server to overload
- [ ] Mention free-tier numbers: 1M Lambda invocations/month, on-demand DynamoDB

### Option B: Show CloudWatch Metrics (More Convincing)
- [ ] Log into AWS Console → CloudWatch → Metrics
- [ ] Find Lambda invocation counts and duration metrics
- [ ] Show that inference Lambda stays under timeout, consistent response times
- [ ] Screenshot or screen-record this separately and splice it in

### Option C: Run Concurrent API Calls (Most Technical)
- [ ] Use a tool like `hey` or `ab` (Apache Bench) to hit an endpoint:
  ```bash
  # Install hey: brew install hey
  hey -n 200 -c 50 -H "Authorization: Bearer <your-jwt-token>" \
    https://p9fpx4nhh6.execute-api.ca-central-1.amazonaws.com/services
  ```
- [ ] Record the terminal output showing response times and success rate
- [ ] This proves the API handles concurrent requests

---

## 6. Backup Plan

Things that can go wrong during recording — and what to do:

| Problem | Fix |
|---------|-----|
| Page won't load | Refresh. If still broken, skip and narrate: "This page shows X, let me move on" |
| Simulation doesn't start | Check browser console. Worst case, show pre-seeded data and say "Here's what it looks like after running" |
| JWT expired mid-demo | You'll get redirected to login. Just log back in — this actually demos the auth redirect nicely |
| Analytics blocked | Ad blocker is on. Disable it and refresh |
| Slow API response | Keep talking through it — "While that loads, what this will show us is..." |
| Verification email doesn't arrive | Skip sign-up demo, just show sign-in with existing account |

---

## 7. Post-Recording Checklist

- [ ] Watch the full recording before submitting
- [ ] Trim dead air, long loading screens, and mistakes (if your tool supports editing)
- [ ] Check audio is clear throughout
- [ ] Verify final video is between **3–5 minutes**
- [ ] Export as `.mp4` (H.264 codec, most compatible)
- [ ] Filename: `CloudWatch-AI-Demo.mp4` or whatever your course requires
