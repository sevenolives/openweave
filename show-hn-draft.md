# Show HN: OpenWeave – State machines that enforce what AI agents can do

**URL:** https://openweave.dev

We built OpenWeave because we kept running into the same problem: AI agents that do unexpected things in production. Monitoring tools tell you *what happened* after the fact. We wanted something that prevents bad things from happening in the first place.

OpenWeave is execution governance for autonomous systems. At its core, it's a state machine that controls what actions AI agents can take and when.

**How it works:**

- Define states for your workflow (Open → In Spec → In Dev → Testing → Review → Done)
- Set which transitions bots can make vs. which require humans
- Mark states as "approval gated" — bots literally cannot enter them without human sign-off
- Every state change is enforced server-side. No exceptions.

**Example:** A coding agent can move a ticket from "In Dev" to "Testing" (automated), but it cannot mark it "Completed" — that requires human approval. The API rejects the request. Not a warning, not a log entry. A hard 403.

**What makes this different from LangSmith/Guardrails AI/AgentOps:**

Those tools observe and monitor. OpenWeave enforces. The state machine is the source of truth, and agents discover their allowed transitions from the API at runtime.

**Stack:** Django + Next.js, deployed on Railway. The state machine is visualized with React Flow so you can see your entire agent workflow at a glance.

**Live demo:** https://openweave.dev/demo (no signup required)

We're using it ourselves — our support bot runs through OpenWeave and can only perform actions its state machine allows.

Would love feedback from anyone building with AI agents. What governance patterns are you using?
