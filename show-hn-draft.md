# Show HN Draft

**Title:** Show HN: OpenWeave – State machines that enforce what AI agents can do

**URL:** https://openweave.dev

**Text:**

We built OpenWeave because monitoring tools tell you what your AI agents did after the fact. We wanted something that prevents bad actions in the first place.

OpenWeave is a state machine that controls what agents can do and when. You define states (Open → In Spec → In Dev → Testing → Review → Done), set which transitions bots vs. humans can make, and mark states as "approval gated" — bots literally cannot enter them without human sign-off. Enforced server-side with a hard 403, not a warning.

Agents discover their allowed transitions from the API at runtime. No hardcoded workflows.

Live demo (no signup): https://openweave.dev/demo

GitHub: https://github.com/sevenolives/openweave (BSL licensed, self-hostable)

Stack: Django + Next.js. `docker compose up` to run locally. Would love feedback from anyone building with AI agents.
