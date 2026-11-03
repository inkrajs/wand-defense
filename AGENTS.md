# 无尽巫师 development

## User authorization and ownership
The user explicitly authorized creating this repository and having module leads
split tasks and develop in parallel, using the agreed model pool. Module leads
may create scoped native child chats and send task messages necessary for this
work. Use native create_thread for supported OpenAI models; use the admitted
provider-aware tool for OpenCode Go / deepseek-v4-pro after listing providers.
Do not use DeepSeek Flash. Do not change user-selected models or healthy tasks.
This authorization does not authorize contacting unrelated people.

## Required context
Read docs/demo-scope.md, docs/architecture.md, docs/development.md, and your
module's task file. Design snapshots retain confirmed/draft distinctions.
This is an Inkra consumer; do not alter Inkra library repositories.
For interface work also read docs/ui-guidelines.md. Use the installed public
Inkra components and typography; keep the user's latest layout decisions.
Current main excludes summons/buildings; those live only on the separate
feature/summons-buildings checkout and must not be merged without user direction.

## Mandatory UI feedback baseline
Never show generic operation notices by default: no success/completed/submitted
toasts, floating messages, transaction outputs or raw error-code banners.
The user must explicitly request visible notices before adding them. Show the
result through actual state, placement and valid-target feedback instead.
Keep necessary screen-reader announcements visually hidden and retain structured
command results/diagnostics. Explicitly requested content such as connection
state and character attributes is not a generic operation notice.

## Boundaries
Work in this repository by absolute path. Shared checkout, disjoint file
ownership. Do not reset, clean, stash, switch branches, or broadly stage files.
Do not commit/push; the root integrator owns commits. Request shared contract or
dependency changes through docs/tasks/<module>.md and the coordinator.
Child workers must have exclusive files/subdirectories assigned by their lead.

## Models and acceptance
GPT-6.1 Sol: core design, module integration, mandatory acceptance of work from
other models. GPT-6.1 Terra: UI implementation; user confirms visual effect.
GPT-6 Luna: focused execution. OpenCode Go DeepSeek V4 Pro: bounded medium work.
GPT-6 Astra: only if a specific difficult issue warrants it.
Leads must actually delegate at least two independent execution tasks when
possible, then integrate; do not merely produce another plan.

Sol acceptance checks goal, layering, reuse, extension and code correctness.
Review actual code and a short execution/call-flow description. Running every
small task is NOT required. Batch small related reviews. Use targeted runtime
checks only for material uncertainty or critical integration. UI appearance
belongs to the user: deliver a runnable preview, do not initiate repeated AI
visual review or call an interface visually accepted.

## Delegated task recovery
On provider/rate-limit/exhausted-retry failures, inspect status and latest user
changes. Resume the existing task with another confirmed available permitted
model when supported, preserving work and verifying new progress. Do not retry
the same broken provider indefinitely or interrupt healthy work. A dispatched
retry is not recovered progress. Report accurately. Do not configure monitoring
unless requested; if requested use actual heartbeat and quiet healthy status.

## Handoff
Record child thread IDs, model/provider, file ownership, progress, implementation
summary, how it runs, validation actually done, limitations and Sol review result
in docs/tasks/<module>.md. Do not label a feature complete based only on a plan.

