# Journeyproof submission narration

Exactly 5:00. Ten fixed sections, using actual app footage and clearly labeled architecture and business boards. The finished video uses synthetic Mac narration. Proposed pricing, replay, deterministic action policy, and pending live account verification must remain labeled on screen. Invented cost budgets and margins are omitted from this video.

This script describes the implemented prototype and observed results recorded in [verification.md](verification.md), [public-site-check.md](public-site-check.md), [business-model.md](business-model.md), and [sources.md](sources.md). It makes no claim of customers, revenue, completed Stripe test Checkout, or successful live model access.

## 0:00–0:25 · A visible product can still be unreachable

A customer can see a product and still be unable to buy it. WebAIM found detectable accessibility failures on ninety-five point nine percent of the million home pages it analyzed in twenty twenty-six. Journeyproof asks a practical question: can a customer complete the journey using a keyboard and accessibility information?

## 0:25–0:55 · Watch the journey stop

This owned demo store has deliberately planted barriers. The tester chooses from accessible names, roles, states, and numbered navigation options. It cannot use pixels or selectors to choose its actions. Today it uses the clearly labeled deterministic keyboard policy, because no model key is configured. The size swatches are mouse-only elements. Medium is missing from the usable controls, so the journey stops.

## 0:55–1:30 · Review the source repair and repeat the task

The diagnosis leads to a reviewable source patch. Size swatches become native buttons. The add control gains a usable name, and the proposed image description is shown for review. Drafted wording requires owner approval before the repair can run. This demonstration approves the displayed wording and applies the patch to a copy of the owned source. Now the same task completes in five steps: Medium is available, the add control is named, and the cart announces Added.

## 1:30–1:55 · Preserve evidence with a specific claim

The report connects the original barrier to the exact patch, recorded approvals, and the successful repeat. It preserves announcements, timestamps, and a screenshot, with a downloadable evidence PDF. The claim is specific: the journey we tested passes in this dated page state. Human testing with people who use assistive technology remains essential.

## 1:55–2:20 · Replay the original observations offline

Each run also produces a replay tape. What you see here is saved evidence playing back offline. It makes no fresh browser visit and no model request. The original timestamps stay visible, and the interface labels replay explicitly. An owner can inspect what happened, while keeping recorded observations distinct from a new test.

## 2:20–2:50 · Show both menu success and a public-site limit

The second journey finds a restaurant menu. Our semantic fixture passes by announcing five named dishes with prices. We also tried the public Dishoom website. That run stopped at the read-only guard when a POST request was blocked. It did not complete menu discovery, and it does not establish that the menu is inaccessible. Public pages are never patched, and the stop is preserved as evidence.

## 2:50–3:35 · Explain the implemented system and its checks

TypeScript connects React to a Node and Fastify server, isolated Playwright browsers, and SQLite evidence storage. Guidepup and Chrome's accessibility tree simulate virtual announcements, not recordings of NVDA or VoiceOver. Actions use keys and focus moves. A two-worker queue handles concurrent jobs, with forty steps per run. Models receive only allowed accessibility text; live provider access is unverified. Scoped axe and clickable-element checks inform diagnosis. The contrast solver adjusts O K L C H lightness while preserving hue. Fourteen tests passed, including real-browser checks, and two clean clones passed end to end.

## 3:35–4:15 · Make the proposed business model concrete

Journeyproof starts with small stores and restaurants, where a blocked task has an obvious cost: a customer cannot choose a size or read the menu. Proposed monthly pricing is a free check, thirty-nine dollars for restaurants, forty-nine for stores, and two hundred ninety-nine for agencies. These prices are hypotheses; no customers or revenue are claimed. A free check would make the barrier visible, and reviewed repairs plus repeat evidence would support conversion. Stripe test Checkout is implemented, but the account key is absent. This setup message leaves billing verification pending and activates no plan.

## 4:15–4:45 · Validate costs and separate the roadmap

Before selling the forty-nine-dollar Store plan, Journeyproof must measure browser runtime, model retries, support, and processing costs, then validate usage limits. The roadmap adds isolated workers, Postgres, authenticated accounts, scheduled checks, and reviewed customer-source integrations. These are planned features. The current prototype runs checks on demand and repairs its owned demo.

## 4:45–5:00 · Close on the demonstrated loop

Journeyproof turns a silent dead end into a tested path forward. Try the journey, find the barrier, review the source repair, and repeat the task with dated evidence. Thank you.

## Editing and claim checks

- Keep the source patch and repaired rerun together as one continuous demonstration where possible. The capture uses UI automation to approve the controlled demo wording; do not imply an unrecorded human review took place. The product requires owner approval of drafted labels and descriptions.
- The public Dishoom result is a clean read-only stop after a blocked POST. It is neither a pass nor evidence that the menu is inaccessible.
- The working menu fixture is separate from the public website and announces five priced dishes.
- Replay uses original observations and is never a fresh test.
- Say and show that model calls and Stripe Checkout remain unverified without keys. Do not display secrets.
- Keep the WebAIM caption tied to its analyzed population and 2026 study. Source: [WebAIM Million 2026](https://webaim.org/projects/million/#wcag).
- The voice is synthetic narration, not an impersonation of the project owner.
