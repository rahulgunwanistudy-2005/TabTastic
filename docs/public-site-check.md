# Public restaurant check

- Website: https://www.dishoom.com/
- Journey: `find_menu`, live browser run through the existing local server.
- Run ID: `ba82ae1d-77e6-41da-8b57-c4df85764bbc`.
- Started: 15 October 2026, 17:51:55 IST (`2026-10-15T12:21:55.916Z`).
- Finished: 15 October 2026, 17:52:04 IST (`2026-10-15T12:22:04.995Z`).
- Actual result: **stuck; clean read-only stop**, not a journey pass.
- Recorded reason: “Blocked POST request: real-site checks are read-only.” The recorded data does not identify the POST endpoint or establish that it was a form submission.
- Observed actions: Tab, ArrowDown, ArrowDown; each announced “button, Explore”. A fourth transcript entry records the stop. No Enter, Space, typing, form submission or payment action was executed.
- Announcement backend: Guidepup virtual screen reader with CDP accessibility state and quick navigation. Action choice: deterministic keyboard policy; no model credentials.
- Scoped diagnosis recorded 40 findings. Those findings do not establish that the menu itself is inaccessible: this run stopped at the request guard before announcing five priced dishes.
- Screenshot: `/api/artifacts/ba82ae1d-77e6-41da-8b57-c4df85764bbc.png`.

The guard blocked a non-GET request and the runner produced dated evidence in about nine seconds. This check demonstrates a clean public-site stop, not successful menu completion.
