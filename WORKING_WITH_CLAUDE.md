# Working with Claude — In-depth Guide

> Goal: go from "a Claude user" to "an AI engineer who knows how to leverage Claude properly".
>
> Read in order. Each section takes ~5-10 minutes. There's a hands-on example at the end of every section.

---

## Part 1 — Mental model: understand Claude before using it

Most prompting bugs come from **wrong assumptions about how Claude works**. The 5 most important facts:

### 1.1 The context window is EVERYTHING Claude "knows" within a conversation

Every time you send a message, Claude reads the **entire** chat history + system prompt + available tools + uploaded files. That's the "context window". Run out of context → Claude starts forgetting the beginning of the conversation.

**Consequences:**
- The longer the conversation, the more tokens it costs and the easier it is to "drift"
- Opening a new chat = Claude knows nothing about the old chat (unless Memory is enabled or you use Projects)
- Heavy file uploads consume a lot of context

**Rules:**
- Large task → split into separate conversations, each focused on one thing
- Don't paste 10000 lines of code then ask one small question — extract only the relevant part

### 1.2 Knowledge cutoff: Claude doesn't know current events

My version of Claude (Opus 4.7) has a cutoff of late January 2026. Anything after that — new products, news, new library versions — Claude **doesn't know** unless it searches.

**Tip:** If you're asking about a new library/framework, a new version, or something that changes fast → tell Claude to search first, or paste the docs in yourself.

### 1.3 Claude doesn't "know" — Claude "calls tools"

When Claude fetches news, reads files, runs code, or renders UI — it's not that Claude "knows". Claude **calls a tool** provided by the environment. On Claude.ai these are available out of the box: web_search, code execution, file creation, image generation, MCP connectors. On the API, the developer defines tools themselves.

**Consequence:** The same question can get a different answer from Claude on Claude.ai versus Claude on the API — because the tools differ.

### 1.4 Claude is stateless between conversations

By default, every conversation is a blank slate. If you taught Claude a convention yesterday, you have to teach it again today — UNLESS:
- **Memory**: an opt-in feature in Settings; Claude remembers information about you across chats
- **Projects**: create a project, write "project instructions" — every chat in the project uses those instructions
- **Search past chats**: Claude can search through old chats (Anthropic added this recently)

### 1.5 Claude can be "retrained" at runtime via skills, system prompts, MCP

This is the key to AI engineering: you do NOT fine-tune the model — you **shape behavior** through context. Skills, MCP, subagents, custom system prompts are all ways to do this. Later sections go deeper.

---

## Part 2 — The Anthropic ecosystem: 4 products, which to use when

| Product | Form | Use when |
|---|---|---|
| **Claude.ai** | Web/mobile chat | Everyday tasks: writing, brainstorming, research, code review |
| **Claude Desktop** | Desktop app | Same as Claude.ai + can install local MCP servers (read files, control desktop) |
| **Claude Code** | CLI tool | Agentic coding — Claude reads/edits code, runs tests, commits on its own. Requires Node.js |
| **Claude API** | REST API | Build your own app integrating Claude |

**When to use what:**
- Learning, writing, reasoning → **Claude.ai**
- Coding a real project (like this social media app) → **Claude Code** (run inside the project's terminal)
- Need to connect Claude with local Gmail/Slack/Notion → **Claude Desktop** with MCP
- Build a chatbot for users → **Claude API**

> This page: https://claude.com/product for product details.
> API docs: https://docs.claude.com
> Code docs: https://docs.claude.com/en/docs/claude-code/overview

---

## Part 3 — Skills: teach Claude a specific workflow

### 3.1 What a skill is

A **Skill** is a folder containing a `SKILL.md` file (and optional scripts/supporting docs) — Claude loads it automatically when it hits a matching task. Think of it as an "expansion pack" for Claude.

Example: Anthropic's pre-built `pdf` skill has:
- `SKILL.md`: instructs Claude how to handle PDFs (extract text, fill forms, merge)
- Python scripts for Claude to run
- Templates

When a user asks to "extract form fields from this PDF file", Claude reads the skill and knows how to do it. **It's not that Claude already "knew" — the skill taught it.**

### 3.2 The structure of a skill

```
my-skill/
├── SKILL.md              # required — instructions + metadata
├── scripts/              # optional — code Claude can run
│   └── helper.py
└── reference/            # optional — supporting docs
    └── examples.md
```

`SKILL.md` has YAML frontmatter at the top:

```markdown
---
name: my-skill
description: "Use this skill when user wants to [TASK]. Triggers on keywords X, Y, Z."
---

# My Skill

## When to use
- Task A
- Task B (NOT task C)

## Workflow
1. First, read the input file
2. Then run scripts/helper.py
3. Format output as JSON

## Constraints
- Never modify files outside /workspace
```

**Rules for writing a good skill:**
- `description` is extremely important — Claude relies on it to decide WHETHER to load the skill. State clearly WHEN to use it and WHEN not to.
- Keep instructions short and action-oriented
- Bundle scripts when the task is deterministic (parse PDF, validate JSON) — it costs fewer tokens and is more accurate

### 3.3 Anthropic's pre-built skills

On the Claude.ai paid plan and in Claude Code, these are available out of the box:
- **docx** — create/edit Word documents
- **pptx** — create PowerPoint
- **xlsx** — create Excel with formulas, charts
- **pdf** — create, fill, merge PDF
- **frontend-design** — design web UI
- **canvas-design** — design posters/art

When you say "create a slide deck introducing the product", Claude loads the `pptx` skill automatically — no teaching needed.

### 3.4 Create a custom skill for your team/project

Use case: you want Claude to always write commit messages following Conventional Commits. Instead of pasting the rule every time → create a skill.

**How to create:**
- **In Claude.ai**: Settings → Capabilities → Skills → Create new skill
- **In Claude Code**: write a `SKILL.md` file in `.claude/skills/<skill-name>/`
- **In the API**: pass skill files in the request

**A real-world skill example for the social media project:**

```markdown
---
name: prisma-schema-update
description: "Use when user asks to modify Prisma schema. Walks through migration safely."
---

# Prisma Schema Update Workflow

## When to use
- User says "add a field/model/relation to Prisma"
- User says "rename a column"
- User says "add an index"

## Steps
1. Read current `prisma/schema.prisma`
2. Make the change requested
3. Generate migration: `npx prisma migrate dev --name <descriptive_name>`
4. NEVER use `prisma db push` (skips migrations — dangerous in real teams)
5. After migration, regenerate client: `npx prisma generate`
6. Verify by running `npx prisma studio` if user wants visual check

## Naming conventions
- Models: PascalCase singular (User, Post, not Users)
- Fields: camelCase (createdAt, not created_at)
- Migrations: snake_case descriptive (add_user_bio, not migration_1)

## Constraints
- Never edit existing migration files in `prisma/migrations/`
- If schema change is destructive (drop column with data), warn user first
```

### 3.5 When to use a skill vs a prompt

| Situation | Approach |
|---|---|
| One-off task | Prompt directly |
| Task repeated 2-3 times | Project instructions |
| Repeated task with a complex procedure | Skill |
| Need to run deterministic code (parse, validate) | Skill with a bundled script |

> Anthropic has a sample skills repo: https://github.com/anthropics/skills
> Docs: https://docs.claude.com/en/docs/claude-code/skills

---

## Part 4 — MCP: give Claude access to external tools/data

### 4.1 What MCP is

The **Model Context Protocol** is an **open standard** Anthropic released in late 2024. Before MCP, every time you wanted Claude to access a service (Slack, GitHub, Postgres) you had to write custom code. MCP solves this by defining a standard protocol — write an MCP server once, and any AI client that supports MCP can use it (Claude, Cursor, Zed, ...).

Analogy: MCP is **the USB-C port for AI**. Before it, every tool had its own cable.

### 4.2 Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│  Host           │                    │  MCP Server     │
│  (Claude.ai,    │   MCP Protocol     │  (your tool)    │
│  Claude Desktop,│ ◄────────────────► │                 │
│  Claude Code,   │                    │  Exposes:       │
│  Cursor, ...)   │                    │  - tools        │
│                 │                    │  - resources    │
│                 │                    │  - prompts      │
└─────────────────┘                    └─────────────────┘
```

- **Host**: the app that contains Claude (Claude Desktop, Claude Code, ...)
- **MCP Server**: a separate process that exposes capabilities
- **3 kinds of "primitives"**:
  - **Tools**: actions Claude can call (`send_email`, `query_db`)
  - **Resources**: data Claude can read (`@gmail/inbox`, `@notion/page-123`)
  - **Prompts**: templates the user can trigger ("/review-pr")

### 4.3 Using a ready-made MCP (the easiest way)

**On Claude.ai web**:
- Settings → Connectors → enable the ones you need (Gmail, Notion, Slack, GitHub, Linear, ...)
- Then ask naturally: "Check Gmail for any new email from my boss"

**On Claude Desktop**:
1. Create the config file: `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
2. Structure:
   ```json
   {
     "mcpServers": {
       "filesystem": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/Documents"]
       },
       "github": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-github"],
         "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." }
       }
     }
   }
   ```
3. Restart Claude Desktop. The hammer icon 🔨 appearing in the bottom corner = MCP loaded.

**On Claude Code**:
```bash
claude mcp add github -- npx -y @modelcontextprotocol/server-github
```

### 4.4 Popular MCP servers

Pre-built: Filesystem, GitHub, GitLab, Postgres, SQLite, Slack, Google Drive, Puppeteer (browser automation), Brave Search, ...

Official repository: https://github.com/modelcontextprotocol/servers

Registry: https://github.com/modelcontextprotocol/registry

### 4.5 Build your own MCP server

Use the MCP SDK (Python, TypeScript). A simple server in TypeScript:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({ name: "my-mcp", version: "0.1.0" }, {
  capabilities: { tools: {} }
});

server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "get_weather",
    description: "Get the current weather",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"]
    }
  }]
}));

server.setRequestHandler("tools/call", async (req) => {
  if (req.params.name === "get_weather") {
    const { city } = req.params.arguments;
    // call the weather API...
    return { content: [{ type: "text", text: `Weather in ${city}: 28°C, sunny` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 4.6 Cautions when using MCP

- **Context cost**: each server adds tool descriptions to the context. 7 servers × 10 tools = ~3000 tokens just for Claude to know the tools exist. Only enable what you need.
- **Security**: an MCP server can access files/network. Don't install untrusted servers. Use read-only credentials when possible.
- **Tool descriptions must be clear**: if Claude isn't calling a tool when you think it should → the description isn't clear about "when to use it".

> Docs: https://modelcontextprotocol.io
> Free Anthropic course: https://anthropic.skilljar.com/introduction-to-model-context-protocol

---

## Part 5 — Subagents: dividing work in Claude Code

### 5.1 What a subagent is

A **Claude Code feature** (not Claude.ai). A subagent is a separate Claude instance:
- **Independent context window** — doesn't see the main conversation
- **Its own system prompt** — specialized
- **Its own tool access** — can be restricted (e.g. read-only)
- **Can run a different model** — e.g. a simple subagent uses Haiku to save cost

What gets returned to the main conversation is only a **summary** from the subagent — not the entire context it used.

**Why do you need it?** Two main benefits:

1. **Context isolation**: searching 100 files to find a bug? Having the main conversation read 100 files = context fills up immediately. A subagent reads, summarizes "bug in file X line Y" → the main conversation only receives one line.

2. **Specialization**: a code-reviewer subagent has its own system prompt, knows your style guide, focuses on quality. A test-runner subagent only runs tests and won't edit code itself.

### 5.2 Built-in subagents in Claude Code

Claude Code comes with 5 subagents it uses automatically:

| Subagent | Role |
|---|---|
| **Explore** | Search/read the codebase. Read-only. Runs Haiku → fast, cheap |
| **Plan** | Plans work (when you type `/plan`). Read-only |
| **General-purpose** | Complex tasks needing both search + modify |
| **Claude Code Guide** | Answers questions about Claude Code |
| **statusline-setup** | Terminal config helper |

You don't need to do anything — Claude Code invokes them automatically when appropriate.

### 5.3 Custom subagents

Create a markdown file in `.claude/agents/<name>.md` (project-level) or `~/.claude/agents/<name>.md` (global):

```markdown
---
name: prisma-reviewer
description: "MUST BE USED when reviewing Prisma schema changes. Checks naming, indexes, relations."
tools: Read, Grep
model: sonnet
---

You are a Prisma schema reviewer. When invoked:

1. Read the specified schema.prisma
2. Check:
   - Models PascalCase singular
   - Fields camelCase
   - Every foreign key has an index
   - onDelete is set when needed
   - Avoid @db.Text on fields that don't need it
3. Return:
   - ✅ What's OK
   - ⚠️ Warnings
   - ❌ Errors that must be fixed
   
Honest, critical, no empty praise.
```

Or create it via the `/agents` command in Claude Code (interactive).

### 5.4 When to use subagents

**DO use:**
- Search/explore tasks in a large codebase
- You repeat the same kind of task over and over (review code, gen tests, write docs) → create a specialized subagent
- You need parallel work (multiple subagents at once)
- You want to isolate "messy" tasks (debugging, log analysis) from the main conversation

**DON'T use:**
- Simple 1-2 step tasks
- Tasks that need the main conversation's context (a subagent does NOT see the history)
- You're just getting started — learn the main flow first

### 5.5 Skills vs Subagents — the distinction

| | Skill | Subagent |
|---|---|---|
| Where it's installed | Claude.ai, Code, API | Claude Code only |
| Context | Loaded into the main context | Separate, isolated context |
| When it loads | When a task triggers the description | When the main agent decides to delegate |
| Shares context | Yes | No |
| Used for | Guides/workflows + scripts | Division of labor + context isolation |

The two can be used together: a subagent can use skills.

> Docs: https://docs.claude.com/en/docs/claude-code/sub-agents
> Course: https://anthropic.skilljar.com/introduction-to-subagents
> 100+ subagent samples: https://github.com/VoltAgent/awesome-claude-code-subagents

---

## Part 6 — CLAUDE.md: project memory for Claude Code

### 6.1 What CLAUDE.md is

A special markdown file that **Claude Code reads automatically at the start of every session** in that project. Think of it as the project's "constitution" — rules Claude must follow in every conversation, every subagent, every time you run `claude` in this folder.

**Different from README.md:**
- README.md → written for **people** (new devs, contributors) — explains HOW
- CLAUDE.md → written for **Claude** — short, actionable rules, WHAT TO DO / NOT DO

### 6.2 The hierarchy (loaded in order, specific overrides general)

```
1. ~/.claude/CLAUDE.md                ← user-level (personal, all projects)
2. <project>/CLAUDE.md                ← project root (committed to git, shared with team)
3. <project>/<subdir>/CLAUDE.md       ← subdirectory (loaded when working in the subdir)
4. <project>/CLAUDE.local.md          ← personal override for this project (gitignored)
5. Managed policy CLAUDE.md           ← org-wide (set by admin, cannot be bypassed)
```

All of them **accumulate** — they don't replace each other. The specific level overrides the general one on conflict.

**Real-world case (the social media project):**
- Root `social-media/CLAUDE.md` — shared conventions (TypeScript everywhere, Vietnamese comments)
- `backend/CLAUDE.md` — Prisma rules, npm commands, service/route patterns
- `frontend/CLAUDE.md` — Tailwind rules, Zustand patterns

When Claude enters the `backend/` folder to code, it loads both the root + backend CLAUDE.md.

### 6.3 What CLAUDE.md should contain

✅ **DO include:**
- Build/test/lint commands (`npm run dev`, `npx prisma migrate dev`)
- The locked-in tech stack
- Naming conventions (kebab-case, PascalCase, ...)
- "Always do X" / "Never do Y" rules
- Project structure (brief, link to README for detail)
- Project-specific anti-patterns
- Tool quirks (e.g. "Prisma migration names must be snake_case")
- Existing endpoints / API contracts

❌ **DON'T include:**
- Generic best practices Claude already knows ("write clean code", "comment well")
- Things Claude can discover by reading the codebase (Claude will remember them via auto-memory)
- Long documentation for people — that's README's job
- Secrets (API keys, passwords) — NEVER
- Rules that change constantly — they'll go stale fast

### 6.4 The 150-200 instruction rule

AI models reliably follow ~150-200 distinct instructions in context. Claude Code's system prompt already takes ~50 slots. **Don't waste lines on platitudes.**

> A CLAUDE.md describing an architecture you migrated away from 18 months ago is **worse than no CLAUDE.md**. Outdated context = wrong guidance every time. Pruning periodically is mandatory maintenance.

### 6.5 Auto-memory (Claude Code v2.1.59+)

Newer Claude Code adds an **auto-memory** feature: Claude writes notes about its learnings to `~/.claude/projects/<project>/memory/` across sessions. You don't have to write them — Claude saves them itself when it spots something worth remembering (build command, naming pattern, gotcha).

**Consequence:** CLAUDE.md only needs to contain what **you know Claude WON'T discover on its own** (hard prohibitions, deliberate decisions). What Claude can learn for itself → leave to auto-memory.

Use the `/memory` command in a session to see what Claude has remembered.

### 6.6 CLAUDE.md skeleton (copy-ready)

```markdown
# [Project Name] — Project Memory

## Project identity
[1-2 sentences: what it does, who it's for, what stage]

## Tech stack (immutable)
- [specific list, with versions if it matters]

## Common commands
```
npm run dev
npx prisma migrate dev
docker compose up -d
```

## Conventions
- Naming: ...
- Code organization: ...
- Git workflow: ...

## Anti-patterns — DO NOT do
- ❌ ...
- ❌ ...

## Deeper context
See `README.md`, `ARCHITECTURE.md` for details.
```

### 6.7 Common mistakes

1. **Writing CLAUDE.md like a README** — verbose, prose-style. Claude follows specific rules better than flowery paragraphs.
2. **Forgetting to prune** — a feature that was dropped, a stack that changed, but CLAUDE.md still mentions it.
3. **No subfolder version** — a monorepo with only one root CLAUDE.md → the context is too broad.
4. **Duplicating auto-memory** — rewriting what Claude already remembered on its own.
5. **Not committing** — it should be shared with the team, but each person keeps their own version → inconsistency.

### 6.8 CLAUDE.md vs Skills vs Subagents — the distinction

| | CLAUDE.md | Skills | Subagents |
|---|---|---|---|
| Scope | Automatic every session in the folder | Triggered by task description | When the main agent decides to delegate |
| Format | Markdown rules | Folder + SKILL.md + scripts | Markdown with YAML frontmatter |
| Context | Loaded into the main context | Loaded on-demand | Separate, isolated context |
| Good for | Project rules, conventions | Repeated workflows, can bundle code | Division of labor, task isolation |
| Available in | Claude Code | Claude.ai, Code, API | Claude Code, API SDK |

All three can be used together. Example: CLAUDE.md sets shared conventions → the "prisma-reviewer" subagent inherits the rules → when reviewing a schema it uses the "prisma-schema-update" skill with scripts.

> Official docs: https://docs.claude.com/en/docs/claude-code/memory

---

## Part 7 — Prompt engineering: 7 principles you can use right now

### 6.1 Be specific to the point of being HARD TO MISREAD

❌ "Make it look nicer"
✅ "Reduce PostCard's padding from 24px to 16px, change the accent color from red to blue #2563EB, keep the Fraunces font"

### 6.2 Give input / output examples (few-shot)

```
Convert file names to PascalCase:
- user-profile.tsx → UserProfile.tsx
- new-post-modal.tsx → NewPostModal.tsx
- comment-tree.tsx → ?
```

Claude sees the pattern → outputs the correct format.

### 6.3 Use XML tags for complex structure

```
<task>Refactor the function below</task>

<requirements>
- Convert to TypeScript
- Add error handling
- Keep the signature
</requirements>

<code>
function doStuff(x) { ... }
</code>
```

Claude parses XML better than markdown when the prompt is complex.

### 6.4 "Think step by step" / Chain of thought

For complex reasoning tasks:
- "Before writing code, analyze: what's the input, the desired output, the edge cases."

Or use Claude's `extended thinking` feature — the model "thinks" before answering.

### 6.5 Assign a clear role

❌ "Review this code"
✅ "You are a senior backend engineer reviewing a junior's code. Focus on: security, performance, maintainability. Honest, no empty praise."

### 6.6 Negative examples — point out what you DON'T want

"Create a B2B SaaS landing page. DON'T use: purple-blue gradients, the Inter font, the words 'revolutionary' or 'cutting-edge', emoji icons."

### 6.7 Iterate, don't expect one-shot

Especially with UI/design: prompt 1 produces a v0.1. You look, give specific feedback. Prompt 2 produces v0.2. Repeat 3-5 times. That's the normal process, not a "bad" prompt.

---

## Part 8 — Real-world workflows

### When building a project (like this social media app)

| Situation | Best tool |
|---|---|
| Planning, design, discussion | Claude.ai (web) |
| Actual coding in the project | Claude Code (CLI in the project folder) |
| Connect Postgres so Claude can query the DB | Claude Code + MCP postgres server |
| Review PRs, generate tests, gen docs repeatedly | Claude Code + custom subagents |
| Project conventions (commit format, schema rules) | Skills + Project instructions |
| Build a feature that brings AI into the product | Claude API |

### Suggested workflow for the social media project

```
1. Plan in Claude.ai     → create ARCHITECTURE.md
2. Switch to Claude Code in the folder
3. Create .claude/agents/ with:
   - prisma-reviewer       (review schema changes)
   - api-tester            (gen curl tests)
   - migration-helper      (nicer than raw prisma commands)
4. Create .claude/skills/ with:
   - commit-style          (Conventional Commits)
   - vietnamese-comments   (force Vietnamese comments)
5. MCP postgres server → Claude queries the DB itself when debugging
6. MCP github server → Claude creates PRs, reviews issues
```

### Common anti-patterns

❌ **Asking Claude something then pushing back on every answer.** Claude isn't biased — you're teaching it "the answer you want". Better: state your criteria clearly and let Claude reason on its own.

❌ **Pasting a whole 5000-line file + "fix the bug for me".** Reduce context: "The bug is in function X, lines 200-250. The full file is attached for reference."

❌ **Giving Claude full permissions without checking.** Especially with MCP/Code — always review before running a dangerous command.

❌ **Using Claude.ai for everything.** Coding a project? Claude Code is better. Connecting tools? MCP. Long codebase? Subagents.

---

## Part 9 — Official docs worth reading

**Must-read if you're serious about Claude:**
- Anthropic Cookbook: https://github.com/anthropics/anthropic-cookbook (hands-on examples)
- Prompt Engineering Guide: https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview
- Building Effective Agents (official post): https://www.anthropic.com/research/building-effective-agents

**Reference docs:**
- Claude API: https://docs.claude.com
- Claude Code: https://docs.claude.com/en/docs/claude-code/overview
- Skills: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview
- MCP: https://modelcontextprotocol.io
- Subagents: https://docs.claude.com/en/docs/claude-code/sub-agents

**Free courses (Anthropic Academy):**
- https://anthropic.skilljar.com — has courses on prompt engineering, MCP, subagents, tool use

**Community:**
- Anthropic Discord: link in the docs
- r/ClaudeAI subreddit
- GitHub anthropics/skills, modelcontextprotocol/servers

---

## Part 10 — A suggested learning path for you

For a beginner like you (building social media + learning AI engineering):

**Weeks 1-2: Foundations**
- Finish reading this document
- Get comfortable with Claude.ai: projects, instructions, artifacts
- Complete Phase 1 backend (already done)
- Read the prompt engineering docs

**Weeks 3-4: Claude Code**
- Install Claude Code, use it for the project's phase 2 (posts core)
- Create 1-2 custom skills for the project (commit style, naming)
- Get comfortable with plan mode (`/plan`), the explore agent

**Weeks 5-6: MCP**
- Install Claude Desktop + filesystem MCP
- Install Postgres MCP for the project — Claude queries the DB directly
- Take Anthropic's MCP course

**Weeks 7-8: Subagents**
- Create 2-3 custom subagents (reviewer, test-gen, doc-gen)
- Learn when to delegate and when not to
- Take the subagents course

**Week 9+: Build with the API**
- When the social media project reaches the phase of integrating AI features (auto caption, content moderation)
- Learn function calling, structured outputs, tool use

---

## Closing thought

The most important thing as an AI engineer working with Claude is **not** memorizing every feature. It's knowing:

1. **When** to use which feature — context isolation needs a subagent, a repeated workflow needs a skill, external data needs MCP
2. **How to shape behavior** through context — since you don't fine-tune the model, everything is prompt + skills + system + tools
3. **Iterate & verify** — Claude gets things wrong frequently, especially on complex tasks. A good engineer doesn't trust Claude blindly

Everything else is just a tool. The right mental model → the right tool choice → good results.
