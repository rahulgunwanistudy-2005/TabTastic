# Verification record

October 15, 2026. Source implementation commit: `132e636`.

- TypeScript checks and production build passed.
- All 14 tests passed (13 in the initial full suite plus the additional model-boundary test). These include a real Chromium end-to-end flow.
- `npm run test:clean` created two independent temporary clones from the committed source, installed each from the lockfile, built each, and passed the end-to-end gate in each. Both reported: broken store stuck; fixed store passed in five steps; menu fixture passed; offline replay passed; PDF export passed.
- The offline replay test rejected all non-local fetches while replaying a saved successful run; zero external attempts were observed.
- The model-boundary test verified that DOM, selectors and backend node IDs do not enter the model payload. Provider responses were mocked for this test; it does not establish live account access.
- Source scan found no mouse-click execution calls in the runner or frontend, and no prohibited whole-site success claim in product copy.
- The app's own desktop and 390px mobile Home, Pricing, stuck run, fixed run, and report states had zero axe violations in the observed snapshots. The replay report was also checked. No horizontal overflow or browser errors were observed. These results do not cover every possible state.
- A public Dishoom home page run stopped safely at the non-GET request guard. It did not complete menu discovery. See [observed outcome](public-site-check.md).
- Real keyboard UI capture completed: original `a1ace21c-bbc8-4108-9e28-d7e0ad1dfbd2`; repaired `10afa2bc-75e1-4ac5-89f8-22ec95f7d41e`. Source evidence is stored locally under `data/` and exported under `output/` (both ignored by Git).
- All seven pages of the exported evidence PDF were rendered and visually reviewed. The silent capture, PDF and replay JSON are in `output/`.
- The installed dependency audit reported zero known vulnerabilities after updating the static file dependency.

Not verified: live model provider calls and a completed Stripe test Checkout, because account keys are not configured. Without model keys, the app identifies its deterministic keyboard policy. Missing Stripe keys return a setup message and never activate a plan. No five-minute narrated video has been submitted; the silent footage and [recording plan](video-script.md) support that final step.
