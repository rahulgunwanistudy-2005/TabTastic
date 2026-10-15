# TabTastic five-minute recording plan

**Find the block. Fix the flow !!**

Record actual app behavior. The outcome of a public-site test may be a clean stop; do not edit it into a pass. Keep the strongest thirty seconds (the source repair and successful rerun) uninterrupted. Do not show API keys or the .env file.

| Time | Screen | Narration |
| --- | --- | --- |
| 0:00–0:25 | Landing page. Briefly show WebAIM source caption. | “A customer can see the product and still be unable to buy it. WebAIM found detectable accessibility failures on 95.9% of the million home pages it tested in 2026. TabTastic asks a practical question: can someone navigate the journey using a keyboard and screen-reader information?” |
| 0:25–0:55 | Run the owned demo. Live keyboard transcript; missing Medium control; diagnosis. | “This is a working store with deliberately planted barriers. Our tester receives only accessible names, roles, states, and numbered navigation choices. It cannot see pixels or selectors. The size swatches are mouse-only divs, so Medium is missing from its usable controls. The journey stops instead of claiming success.” |
| 0:55–1:25 | Open source diff. Read and approve drafted labels/alt. Apply and rerun. Keep this section uninterrupted. | “Here is the exact source patch. The swatches become native buttons; the icon gains a reviewed name. The image description is a draft I approve. Now we rerun the same journey. Medium is announced, the add button is named, and the cart announces Added. The outcome comes from the page state, not the model saying it succeeded.” |
| 1:25–1:50 | Evidence report, before/after announcements, timestamps, screenshot, PDF export. | “The evidence preserves the barrier, source diff, owner approvals, and the new result. Our claim is specific: the journey we tested passes, with dated evidence. This does not replace testing with people who use assistive technology.” |
| 1:50–2:20 | Replay from the successful run with model networking disabled. Show mode label and original dated steps. | “Every run produces a replay tape. This is recorded evidence playing back without a browser visit or model request. Replay makes the demo reliable and lets an owner inspect the original behavior; it is clearly labeled and is never treated as a fresh test.” |
| 2:20–2:50 | Public restaurant URL, find-menu run. Show at least five priced readouts or the clean stop reason. | “The second journey looks for a menu. Public sites are read-only: forms and checkout are blocked. If the menu is available in the accessibility tree, we read named dishes with prices. If the menu is an inaccessible image or PDF, we stop and show why.” |
| 2:50–3:40 | README architecture, then engine, announcer, fixes, schema. Briefly show test output. | “The monorepo uses TypeScript throughout: React and Vite, Fastify, Playwright Chromium, axe-core, and SQLite. The virtual announcer has an explicit CDP fallback. Actions are limited to keys and focus moves. A two-worker queue isolates browser contexts; the forty-step budget bounds runs. On a barrier we combine scoped rules with a check for click handlers on elements without a usable role or name. Fixes apply only to our owned demo source. The contrast solver keeps hue fixed and makes the smallest lightness change it can verify. The repeatable end-to-end test checks broken failure, repaired success, menu readouts, replay and evidence export.” |
| 3:40–4:20 | Pricing; Stripe test Checkout if configured; verified test-active state after completing test checkout. | “We start with small stores and restaurants, where a blocked journey directly loses a customer. The proposed model is a free check, restaurant at $39 a month, store at $49, and agencies at $299. This checkout is test mode. Nothing here claims paying customers. The differentiator is the closed loop from a task failure to a source repair and a successful repeat of that task.” |
| 4:20–4:45 | README scaling and limitations; optional sourced EcomBack count. | “To grow, browser jobs move to isolated workers and the portable tables move to Postgres. Scheduled checks, tenant accounts, billing webhooks and reviewed customer-source integrations come next. The current prototype runs on demand and repairs the owned demo. Human accessibility testing remains essential.” |
| 4:45–5:00 | Before/after report beside landing page. | “TabTastic turns a silent dead end into a tested path forward: try the journey, find the barrier, fix the source, and prove the journey works.” |

## Recording gates

- Run `npm run build`, `npm test`, and the clean-clone check before recording.
- Start `npm run dev`, open http://localhost:5173, and use a fresh demo run.
- Do not call the swatches “button, button, button” in the broken version: no-role divs can be absent from the accessibility tree. Show their actual silence and the missing-control diagnosis.
- Approve the actual wording shown by the app. Check Medium and Added in the successful transcript.
- Download evidence PDF and JSON tape. Keep both with the recording.
- If Stripe is not configured, show the truthful setup state and say “test billing is implemented; account verification is pending.” Do not fake checkout success.
- Use the real-site result as observed. A clean stop is a valid demonstration of the runner's limits.
- Submit the recorded video manually to Devpost before 02:30 IST on October 16. This repository does not submit to Devpost.
