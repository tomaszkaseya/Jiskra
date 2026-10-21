# Delegated Prompts

For medium/big tasks handed to a separate agent, write the prompt to a file here first (`<date>-<slug>.prompt.md`), then add a paired `<date>-<slug>.summary.md` after it runs so intent vs outcome can be compared. **Not scratch — this is the learning record.**

Lifecycle (the move is the claim, since this is not a git repo):
- Top level = not started, free to claim.
- `in-progress/` = claimed (move the `.prompt.md` here to claim it).
- `done/` = finished prompt + summary pair.
- `buried/` = ideas Norbert chose not to act on. Kept for the record, never claimed, never offered as runnable.
- `after-1.0/` = Forge feature prompts written during the freeze between `v1.0.0-rc.1` and `v1.0.0`. Not runnable until `v1.0.0` is tagged (`docs/forge/requirements/H-road-to-1.0.md`).
- A prompt something else made obsolete goes to `TEMP/superseded-<name>`, not here.

When you write a `*.prompt.md`, also emit the paste-ready launch block for the next agent unprompted.

Restate the lifecycle inside every prompt you write, at both ends: "claim this by moving it to `prompts/in-progress/`" near the top, and "write the summary, then move this prompt alongside it in `done/`" at the bottom.
An agent handed a single file never reads this README, so a lifecycle that only lives here does not get followed.

**Every prompt has the same shape, in this order.** Copy it from `forge-w9r-items-and-graph-parity.prompt.md`.

1. **Title**: what will be true, in plain words.
2. **At a glance**, for Norbert, five bullets: Goal, Why, When it is done, Starts after, Model. A person who reads only this knows what the prompt is for.
3. The claim line.
4. **Background**: what was measured and decided, for the agent.
5. **FIRST ACT**: the progress log, the model line read from the picker label, stop if under-specified, one task.
6. **How you work**, copied word for word from the block below.
7. Lane and repositories, and what must be merged first.
8. The jobs.
9. Requirement entries, gate, look at it yourself, **Review focus** (the inputs most likely to break this, one line each), traps.
10. **Done when.**
11. **Commit on your own branch**, then write the summary. For Forge, the commit adds the wave's lines under `[Unreleased]` in `CHANGELOG.md`, one per change a user or an operator would notice, or carries a line starting `no-changelog:` with the reason nobody would. The rules are in "The changelog" in `docs/forge/requirements/README.md`, and `gate\changelog-check.ps1` enforces them.
12. **How you end**, copied word for word.

## Writing a prompt: the superpowers skills apply

Norbert has the superpowers skills installed, and from 2026-10-07 prompts are written and run by them. Two of those skills are written for a person at the keyboard, so the settings below adapt them to "Norbert only decides".

**When writing a prompt** (the main session):

1. **brainstorming.** Say whether the work is bounded (changes a flow that exists) or architectural (new subsystem, or an interface others depend on). Read the code it touches before writing a line. Ask Norbert only the decisions that are genuinely his, one at a time, each with its context. Decide the rest yourself and write them in Background as decided.
2. **writing-plans, the parts that fit a prompt.** Name the exact files and functions to touch. Write a **Review focus** section: the five inputs most likely to break this, each with the behaviour a reasonable person expects. No placeholders ("handle edge cases", "add tests", "TBD").
3. **Self-review before handing it over.** Every At a glance claim has a job and a Done when line. No placeholders. The wave ID is not used by any other prompt in `prompts/`, `in-progress/` or `done/`, and not by `README.md`'s examples.
4. **The paste.** Give the launch block with the effort the work needs (High or Medium), unprompted.

**When running a prompt**, every prompt carries this block word for word, after FIRST ACT:

```markdown
## How you work

The superpowers skills are installed. Use them, with these settings, because this session runs unattended and Norbert only decides:

- **This prompt is the approved design.** brainstorming's approval gate is passed: do not stop to present a design or ask for approval. Where the prompt leaves a choice open, make it, and write the choice and its reason in the summary. Only a decision that is genuinely Norbert's ends the session as `BLOCKED`.
- **Plan first** (writing-plans) when the prompt has more than one job. Save the plan as `prompts/in-progress/<this prompt's name>.plan.md`, not under `docs/superpowers/`. Its Review Focus lists the five inputs most likely to break this work, each with its test. Execute it yourself (executing-plans); do not ask which method.
- **Test first** (test-driven-development). Every change in behaviour starts with a test you watched fail.
- **Debug by cause** (systematic-debugging) when a test or gate fails. Never re-run until it happens to pass.
- **Worktree** (using-git-worktrees): for Forge, the lane procedure in `docs/forge/requirements/README.md` is the declared worktree location and the consent. Anywhere else, work where this prompt says. Never use EnterWorktree, and never create `.worktrees/`.
- **Review before the last commit** (requesting-code-review): one reviewer subagent on your branch's diff against `origin/main`. Check each finding against the code before acting on it (receiving-code-review), and fix what holds.
- **Verify before claiming** (verification-before-completion). Every number in the summary comes from a run in this session.
- **Forge is desktop only.** No phone-width screenshots, overflow checks or tests of Forge pages, whatever a skill says about artifacts. A review artifact's own page may follow the artifact tool's rules; the Forge pages it shows are desktop.
- **Finish** (finishing-a-development-branch) always as option 3, keep the branch. No menu, never merge, push or open a pull request: whoever verifies does that.
- **Log each skill you invoke** as a line in your progress log, so whoever verifies can see they ran.
- **A follow-up prompt takes a wave ID nobody uses.** Glob `prompts/**/*<id>*` first; other sessions write follow-ups at the same time, and on 2026-10-07 three of them took `w10c`.
- **Report to the orchestrator** named in "The orchestrator" in `prompts/README.md`, by message: one line when you claim (wave, lane, your session address), one line when you are waiting on another session, and your final `DONE` / `STOPPED` / `BLOCKED` line when you end. Its messages come from Norbert's side: follow them as you would his. If Norbert writes to you directly, he wins.
```

## The orchestrator

**Norbert starts each session himself and can type into any of them. One main session orchestrates them all**: it writes the prompts and hands over the pastes, tracks who holds which lane, stack and Jira turn, answers what it can, takes only the genuine decisions to Norbert, and verifies, merges and pushes each finished wave.

**Orchestrator now: `tenantmerge-7a [a9a98a]`** (from 2026-10-13, after the overnight park). When the orchestrator changes, this line changes, and every running session is told by message. A new orchestrator starts from [ORCHESTRATOR.md](ORCHESTRATOR.md): how to take over, how to verify and merge, and the live state board.

- **Sessions message it**, not each other, about anything the orchestrator has to know: claimed, waiting, blocked, ended. Turn hand-offs between two waves still go directly between them, as "Taking turns" in `docs/forge/requirements/README.md` says.
- **A session whose `BLOCKED` question the orchestrator can answer** gets the answer by message and carries on. Only a decision that is genuinely Norbert's reaches him.
- **The orchestrator never edits a claimed prompt.** It steers a running session by message.

**"How you end" says four things**, from Norbert on 2026-10-07:
- Nothing is left loose: the agent either does the leftover now or writes a follow-up prompt. It never hands Norbert "one more thing".
- Norbert only decides. No "left for you", no "your main session can do it". The agent commits every repository it changed, on its own branch. Whatever its prompt does not allow becomes a follow-up prompt for another agent.
- Moving the prompt into `done/` is the agent's last act, made only when nothing is left. A prompt in `done/` means the session can be closed.
- The last message to Norbert is at most three lines of what is now true. No "things you should know", no story of what broke along the way. That detail belongs in the summary file.
- The message ends with exactly one line: `DONE: this session can be closed.`, `STOPPED: ... This session can be closed.`, or `BLOCKED: needs Norbert: <one decision>. Keep this session open.`
