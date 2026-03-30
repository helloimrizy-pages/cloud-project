# Appendix: Manual Testing Procedures

These 29 test cases require manual browser interaction and could not be executed via CLI. They are documented here as structured test procedures for manual verification.

**Test Date:** 2026-03-22
**Environment:** Chrome 133+ / Safari 18+, `http://localhost:5173` (dev) or S3 production URL

---

## 1. Authentication Tests (Browser)

### AUTH-06: Route Protection

| Field | Value |
|-------|-------|
| **Description** | Unauthenticated users cannot access protected routes |
| **Preconditions** | User is not signed in |
| **Steps** | 1. Navigate directly to `/`, `/timeline`, `/alerts`, or `/analytics` |
| **Expected Result** | All routes redirect to `/login` |
| **Status** | Not Tested |

### AUTH-07: Token Injection in API Requests

| Field | Value |
|-------|-------|
| **Description** | All API requests include the Cognito ID token as an Authorization header |
| **Preconditions** | User is signed in |
| **Steps** | 1. Open browser DevTools → Network tab <br> 2. Navigate to any dashboard page <br> 3. Inspect outgoing API requests |
| **Expected Result** | Every request to the API Gateway includes an `Authorization` header containing the JWT ID token |
| **Status** | Not Tested |

### AUTH-08: Invalid Credentials

| Field | Value |
|-------|-------|
| **Description** | Sign-in with wrong password shows an error message |
| **Preconditions** | User account exists |
| **Steps** | 1. Navigate to `/login` <br> 2. Enter correct email with wrong password <br> 3. Click "Sign In" |
| **Expected Result** | Error message displayed (e.g., "Incorrect username or password"); user remains on login page |
| **Status** | Not Tested |

### AUTH-09: Password Policy Enforcement

| Field | Value |
|-------|-------|
| **Description** | Sign-up rejects passwords that do not meet the policy |
| **Preconditions** | None |
| **Steps** | 1. Navigate to `/login` → Sign Up tab <br> 2. Enter email with a weak password (e.g., "abc") <br> 3. Click "Create Account" |
| **Expected Result** | Error message from Cognito indicating password requirements (min 8 chars, uppercase, lowercase, number) |
| **Status** | Not Tested |

---

## 2. Frontend Integration Tests

### FE-01: Live Controls -- Service Health Display

| Field | Value |
|-------|-------|
| **Description** | Live Controls page displays all 5 services with real-time status |
| **Preconditions** | User is authenticated; API returns service data |
| **Steps** | 1. Navigate to `/` <br> 2. Observe the service health card grid |
| **Expected Result** | 5 service cards displayed in a grid, each showing: service name, type, status badge (healthy/warning/critical with color coding), current metric value with unit, metric name |
| **Status** | Not Tested |

### FE-02: Live Controls -- Simulation Start/Stop

| Field | Value |
|-------|-------|
| **Description** | User can start and stop simulations from the UI |
| **Preconditions** | User is authenticated |
| **Steps** | 1. Select a scenario from the dropdown <br> 2. Click "Start" <br> 3. Observe status indicator changes to "Running" <br> 4. Click "Stop" <br> 5. Observe status returns to "Stopped" |
| **Expected Result** | Start button sends POST with scenario; status indicator updates; summary cards refresh; Stop button halts simulation |
| **Status** | Not Tested |

### FE-03: Live Controls -- Summary Cards

| Field | Value |
|-------|-------|
| **Description** | Summary cards display current simulation metadata |
| **Preconditions** | Simulation state data available from API |
| **Steps** | 1. Navigate to `/` <br> 2. Observe the 4 summary cards |
| **Expected Result** | Cards show: Scenario name, Current Phase, Tick Progress (current/total), Predictions count |
| **Status** | Not Tested |

### FE-04: KPI Timeline -- Service Tab Navigation

| Field | Value |
|-------|-------|
| **Description** | Switching service tabs fetches and displays the correct KPI data |
| **Preconditions** | User is authenticated; KPI data exists for services |
| **Steps** | 1. Navigate to `/timeline` <br> 2. Click each service tab <br> 3. Observe charts update |
| **Expected Result** | Each tab triggers `GET /kpi/{service_id}`; KPI value chart and prediction score chart update with the selected service's data |
| **Status** | Not Tested |

### FE-05: KPI Timeline -- All Services View

| Field | Value |
|-------|-------|
| **Description** | "All Services" tab displays overlaid data from all 5 services |
| **Preconditions** | KPI data exists for all services |
| **Steps** | 1. Click "All Services" tab <br> 2. Observe charts show multiple colored lines |
| **Expected Result** | Frontend fetches all 5 services in parallel via `Promise.all`; both charts display 5 lines with legend; each line uses a distinct color |
| **Status** | Not Tested |

### FE-06: KPI Timeline -- Horizon Toggle

| Field | Value |
|-------|-------|
| **Description** | Changing the horizon updates the threshold reference line |
| **Preconditions** | KPI Timeline page loaded with data |
| **Steps** | 1. Click "5m", "10m", "15m" horizon buttons <br> 2. Observe the threshold line on the prediction score chart |
| **Expected Result** | Threshold reference line updates to the value for the selected horizon (5m: 0.912, 10m: 0.867, 15m: 0.847) |
| **Status** | Not Tested |

### FE-07: Alerts -- Active Alert Display

| Field | Value |
|-------|-------|
| **Description** | Active alerts are displayed with severity-coded styling |
| **Preconditions** | Active alerts exist in the database |
| **Steps** | 1. Navigate to `/alerts` <br> 2. Observe the active alerts section |
| **Expected Result** | Each alert displays: service name, severity badge (CRITICAL/WARNING/INFO with color), description, prediction score, threshold, horizon, lead time, fired-at timestamp, and Acknowledge/Dismiss buttons |
| **Status** | Not Tested |

### FE-08: Alerts -- Acknowledge Flow

| Field | Value |
|-------|-------|
| **Description** | Acknowledging an alert calls the API and updates the UI |
| **Preconditions** | At least one unacknowledged alert exists |
| **Steps** | 1. Click "Acknowledge" on an alert card <br> 2. Observe the alert state change |
| **Expected Result** | POST `/alerts/{id}/acknowledge` is sent; alert card shows "Acknowledged" label; Acknowledge/Dismiss buttons are replaced |
| **Status** | Not Tested |

### FE-09: Alerts -- Dismiss Flow

| Field | Value |
|-------|-------|
| **Description** | Dismissing an alert removes it from the active list (client-side only) |
| **Preconditions** | At least one alert is displayed |
| **Steps** | 1. Click "Dismiss" on an alert card |
| **Expected Result** | Alert removed from the visible list; no API call made (dismiss is local); active alert count in header updates |
| **Status** | Not Tested |

### FE-10: Alerts -- History Section

| Field | Value |
|-------|-------|
| **Description** | Alert history is accessible via a collapsible section |
| **Preconditions** | Historical alerts exist |
| **Steps** | 1. Click "Alert History" toggle <br> 2. Observe historical alerts expand |
| **Expected Result** | Historical alerts displayed with same card format; no action buttons (already resolved) |
| **Status** | Not Tested |

### FE-11: Alerts -- Incident Timeline

| Field | Value |
|-------|-------|
| **Description** | Incident groups display with a colored phase timeline bar |
| **Preconditions** | At least one incident exists |
| **Steps** | 1. Navigate to `/alerts` <br> 2. Observe the "Incident Groups" section |
| **Expected Result** | Incident card shows: ID, title, status badge, horizontal timeline bar with colored phases, phase legend, lead time, and affected services list |
| **Status** | Not Tested |

### FE-12: Analytics -- Summary Statistics

| Field | Value |
|-------|-------|
| **Description** | Analytics page displays model performance summary cards |
| **Preconditions** | Analytics data available from API |
| **Steps** | 1. Navigate to `/analytics` <br> 2. Observe the 4 stat cards |
| **Expected Result** | Cards display: Best Precision (0.91), Mean Lead Time (36m), False Alarm Rate (<=1/day), Detection Rate (8.7%) |
| **Status** | Not Tested |

### FE-13: Analytics -- Precision vs Detection Rate Chart

| Field | Value |
|-------|-------|
| **Description** | Scatter chart visualizes model comparison across horizons |
| **Preconditions** | Methods data available from API |
| **Steps** | 1. Observe the scatter chart on the Analytics page <br> 2. Hover over data points |
| **Expected Result** | Multiple methods plotted as colored scatter points; axes labeled correctly; tooltip shows precision and detection rate values |
| **Status** | Not Tested |

### FE-14: Analytics -- Lead Time Distribution Chart

| Field | Value |
|-------|-------|
| **Description** | Box-plot bar chart shows lead time distribution per horizon |
| **Preconditions** | Lead time data available from API |
| **Steps** | 1. Observe the Lead Time Distribution chart <br> 2. Hover over a bar group |
| **Expected Result** | 3 bar groups (H=5, H=10, H=15); hover tooltip shows Min, Q1, Median (bold), Q3, Max values in minutes |
| **Status** | Not Tested |

### FE-15: Analytics -- Feature Importance Chart

| Field | Value |
|-------|-------|
| **Description** | Horizontal bar chart shows ranked feature importances |
| **Preconditions** | Feature data available from API |
| **Steps** | 1. Observe the Feature Importance chart |
| **Expected Result** | 8 features ranked by importance; KPI features in blue, Log features in red; hover tooltip shows exact importance value |
| **Status** | Not Tested |

### FE-16: Sidebar -- Alert Badge

| Field | Value |
|-------|-------|
| **Description** | Sidebar navigation shows unacknowledged alert count on the Alerts link |
| **Preconditions** | Active unacknowledged alerts exist |
| **Steps** | 1. Observe the Alerts navigation item in the sidebar |
| **Expected Result** | Red badge displays the count of unacknowledged active alerts; badge hidden when count is 0; shows "99+" if count exceeds 99 |
| **Status** | Not Tested |

### FE-17: Sidebar -- Simulation Status

| Field | Value |
|-------|-------|
| **Description** | Sidebar shows live simulation status and progress |
| **Preconditions** | User is authenticated |
| **Steps** | 1. Observe the simulation status section in the sidebar |
| **Expected Result** | Pulsing green dot when running, grey dot when stopped; tick progress displayed (e.g., "Tick 6/15 -- Degrading") |
| **Status** | Not Tested |

---

## 3. Cross-Cutting Tests

### XC-01: Theme Toggle -- Dark to Light

| Field | Value |
|-------|-------|
| **Description** | Theme toggle switches all UI elements from dark to light mode |
| **Preconditions** | Dashboard loaded in dark mode |
| **Steps** | 1. Click "Light Mode" in the sidebar <br> 2. Observe background, cards, text, charts, sidebar |
| **Expected Result** | All CSS variable-driven elements switch to light palette; chart grids, axes, tooltips update colors; preference saved to localStorage |
| **Status** | Not Tested |

### XC-02: Theme Toggle -- Light to Dark

| Field | Value |
|-------|-------|
| **Description** | Theme toggle switches back from light to dark mode |
| **Preconditions** | Dashboard in light mode |
| **Steps** | 1. Click "Dark Mode" in the sidebar |
| **Expected Result** | All elements revert to dark palette; charts update; preference persisted |
| **Status** | Not Tested |

### XC-03: Theme Persistence Across Reload

| Field | Value |
|-------|-------|
| **Description** | Selected theme survives browser refresh without flash |
| **Preconditions** | Theme set to light mode |
| **Steps** | 1. Refresh the page |
| **Expected Result** | Page loads directly in light mode; no dark-to-light flash (inline script in `index.html` applies `data-theme` before first paint) |
| **Status** | Not Tested |

### XC-04: Theme Toggle on Login Page

| Field | Value |
|-------|-------|
| **Description** | Theme can be toggled on the login page before authentication |
| **Preconditions** | User is not signed in |
| **Steps** | 1. On the login page, click the theme toggle link |
| **Expected Result** | Login page switches between dark and light mode |
| **Status** | Not Tested |

### XC-05: Loading States

| Field | Value |
|-------|-------|
| **Description** | Skeleton loading states appear while data is being fetched |
| **Preconditions** | None |
| **Steps** | 1. Navigate to each page <br> 2. Observe the initial render before data loads |
| **Expected Result** | Animated skeleton placeholders (pulsing grey blocks) appear matching the expected layout; no blank screens or layout shifts when data arrives |
| **Status** | Not Tested |

### XC-06: Error Handling -- API Failure

| Field | Value |
|-------|-------|
| **Description** | API errors are handled gracefully without crashing the app |
| **Preconditions** | Simulate API failure (e.g., disconnect network) |
| **Steps** | 1. Open browser DevTools <br> 2. Throttle network to "Offline" <br> 3. Navigate between pages |
| **Expected Result** | Error messages displayed where data would appear; no unhandled exceptions; app remains navigable |
| **Status** | Not Tested |

### XC-07: 401 Response Handling

| Field | Value |
|-------|-------|
| **Description** | Expired or invalid tokens trigger redirect to login |
| **Preconditions** | User has an expired session token |
| **Steps** | 1. Manually clear Cognito tokens from localStorage <br> 2. Trigger an API call (navigate to a new page) |
| **Expected Result** | API returns 401; frontend automatically redirects to `/login` |
| **Status** | Not Tested |

---

## 4. Production Deployment Tests (Browser)

### PROD-03: Production API Connectivity

| Field | Value |
|-------|-------|
| **Description** | Frontend connects to the production API Gateway (no proxy) |
| **Preconditions** | `.env.production` has `VITE_API_BASE_URL` set |
| **Steps** | 1. Sign in on the production site <br> 2. Check Network tab for API requests |
| **Expected Result** | Requests go directly to `https://p9fpx4nhh6.execute-api.ca-central-1.amazonaws.com`; no CORS errors; data loads correctly |
| **Status** | Not Tested |

---

## Summary

| Category | Total | Status |
|----------|-------|--------|
| Authentication (Browser) | 4 | Not Tested |
| Frontend Integration | 17 | Not Tested |
| Cross-Cutting | 7 | Not Tested |
| Production Deployment (Browser) | 1 | Not Tested |
| **Total** | **29** | **Not Tested** |

These tests require manual execution in a web browser with access to the running application. They verify UI rendering, user interactions, theme behavior, and production deployment connectivity that cannot be validated through CLI commands alone.
