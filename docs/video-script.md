# Video Script — CloudWatch AI Demo

**Target length:** 3–5 minutes
**Tone:** Natural, conversational — like you're showing a friend your project, not reading a teleprompter. Use this as a guide, not word-for-word. Rephrase in your own voice.

---

## INTRO (~30 seconds)

> Hey, so this is CloudWatch AI — it's basically a platform we built that predicts when cloud services are about to go down, before they actually do. The idea is, instead of waiting for something to break and then scrambling to fix it, the system watches your metrics in real time and says "hey, this service is probably going to have an incident in the next 15 minutes."
>
> It's fully serverless on AWS — Cognito for auth, Lambda functions for the backend, DynamoDB for storage, and a React frontend. Let me walk you through it.

---

## SECTION 1: AUTHENTICATION (~40 seconds)

*Show the login page*

> So first thing, the app is protected — you can't just go in without an account. We're using AWS Cognito for authentication.

*Either show sign-up flow or just sign in*

**If demoing sign-up:**
> Let me create a new account real quick. I'll put in an email and a password — and you can see it enforces a password policy: at least 8 characters, uppercase, lowercase, numbers. That's all configured through Cognito.
>
> Now it's asking for a verification code — that just got sent to my email. Let me grab it... [enter code] ...and we're in.

**If just signing in:**
> I already have an account set up, so I'll just sign in. It uses secure SRP authentication through Cognito — so passwords never go over the wire in plain text. And... we're in.

*Dashboard loads*

> You can also see we've got a dark mode toggle here — just a nice UI touch.

---

## SECTION 2: LIVE CONTROLS — Starting a Simulation (~50 seconds)

*You're now on the Live Controls page*

> Alright, so this is the main control panel. We have five simulated cloud services — a Web API, a Database Pool, a Message Queue, an Auth Service, and an ML Pipeline. Each one reports different metrics, like response time or queue depth.

*Point to the service health cards*

> Right now everything's green — all services are healthy. But let me start a simulation to show what happens when things go wrong.

*Select "Web API Degradation" from the dropdown*

> I'm going to pick the "Web API Degradation" scenario. What this does is — it starts normal, then gradually degrades the Web API's response time, and eventually triggers a full incident. The simulator runs on a one-minute tick through EventBridge.

*Click Start Simulation*

> So I'll hit start... and now the simulator is running. Every minute, it generates new metric data for all five services, pushes it to DynamoDB, and then our Lambda pipeline picks it up — does feature engineering, runs the ML model, and if the prediction score crosses the threshold, it fires an alert.

*Watch for a moment as cards update*

> You can already see the status updating here. Let me let this run and come back to it — in the meantime, let me show you the data from a simulation we ran earlier.

---

## SECTION 3: KPI TIMELINE (~45 seconds)

*Navigate to KPI Timeline*

> This is the KPI Timeline. It's basically the heart of the monitoring. Each tab is a different service, and the chart shows the actual metric values over time.

*Click on "Web API" tab*

> So for the Web API, we're looking at response time in milliseconds. You can see here it was cruising along normally, then it started climbing — that shaded area is where an actual incident was happening.

*Toggle prediction horizon*

> And this is the cool part — these are the prediction horizons. I can switch between 5-minute, 10-minute, and 15-minute predictions. See this orange line? That's the model's confidence score. When it crosses that threshold line, it means the model is saying "this service is going to have a problem."

*Switch to another service*

> If I flip to the Database Pool, you can see the cascade effect — when the Web API started struggling, the database queries started getting slower too. The model picked that up across both services.

---

## SECTION 4: ALERTS (~40 seconds)

*Navigate to Alerts page*

> Alright, alerts. So whenever the prediction score crosses the threshold, the system creates an alert. You can see these are tagged by severity — critical, warning, info.

*Point to an alert card*

> Each alert tells you the service, the prediction score, which horizon triggered it, and the lead time — so this one gave us about 12 minutes of warning before the actual incident.

*Click Acknowledge on an alert*

> And operators can acknowledge alerts — like, "okay I've seen this, I'm on it." That clears it from the active view.

*Show the incidents section if available*

> Down here, related alerts get grouped into incidents. So if the Web API and the Database both fired alerts around the same time, the system knows they're probably connected and groups them together with a timeline showing the phases — normal, degrading, incident, recovery.

---

## SECTION 5: ANALYTICS (~45 seconds)

*Navigate to Analytics page*

> Last page — analytics. This is where you see how well the model is actually performing.

*Point to the summary cards*

> So overall, our model hits 0.91 precision — meaning when it says "there's going to be an incident," it's right 91% of the time. The mean lead time is around 36 minutes, so you've got a solid half-hour heads-up. And the false alarm rate is less than one per service per day — which is critical because if you're getting spammed with false alerts, operators just start ignoring them.

*Point to the scatter plot*

> This scatter plot compares different model approaches — precision versus detection rate. You can see our gradient boosting classifier with log features sits in a sweet spot here.

*Point to the feature importance chart*

> And this bar chart shows which features matter most. Rolling mean of the KPI value is the biggest signal at 31%, followed by error rate from the logs at 27%. This makes sense — if the average response time is trending up and errors are increasing, something's probably about to break.

---

## SECTION 6: REAL-TIME CHECK-IN & WRAP UP (~30 seconds)

*Navigate back to Live Controls*

> Let me go back to Live Controls real quick — you can see the simulation has been running this whole time. The Web API is starting to show elevated response times...

*Point to the changing status*

> ...and it's moving into the degrading phase. If we wait a bit longer, we'd see alerts start firing on the Alerts page. That whole pipeline — simulator to feature engineering to inference to alert — it's all event-driven through DynamoDB Streams. No polling, no cron jobs on the prediction side, just Lambda functions triggering each other through the data.

*Stop simulation*

> Let me stop this for now.

> So yeah — that's CloudWatch AI. Serverless, real-time, ML-powered incident prediction. The whole thing scales automatically through AWS, the model gives you 15 to 36 minutes of lead time with 91% precision, and the dashboard gives operators everything they need in one place. Thanks for watching.

---

## TIMING SUMMARY

| Section | Duration | Running Total |
|---------|----------|---------------|
| Intro | ~30s | 0:30 |
| Authentication | ~40s | 1:10 |
| Live Controls | ~50s | 2:00 |
| KPI Timeline | ~45s | 2:45 |
| Alerts | ~40s | 3:25 |
| Analytics | ~45s | 4:10 |
| Wrap Up | ~30s | 4:40 |

**Total: ~4 minutes 40 seconds**

This leaves buffer for natural pauses, loading screens, and ad-libbing. If you're running long, the easiest sections to trim are the sign-up flow (just sign in instead) and the real-time check-in (end after analytics).

---

## TIPS FOR SOUNDING NATURAL

1. **Don't read this script word for word.** Read each section once, understand the points, then say it in your own words.
2. **It's okay to say "um" and "so."** That's how people actually talk. Removing every filler word makes you sound robotic.
3. **Talk to the screen, not at it.** Imagine you're showing this to a classmate sitting next to you.
4. **If something breaks, roll with it.** "Oh, looks like that's still loading — that's the Lambda cold start, give it a sec" sounds way more authentic than awkward silence.
5. **Point with your cursor.** Move your mouse to whatever you're talking about so viewers can follow along.
6. **Vary your pace.** Slow down on the impressive stats (precision, lead time), speed up on navigation.
7. **Record in one take if you can.** A few imperfections make it sound real. You can always do a second take if the first one is rough.
