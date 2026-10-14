## Bearxus Project Specifications

🚀 **Centralized Personal Command Center** for notes, projects, finances, learning progress, and content creation.

---

## 📌 Problem (Core Idea)

Personal data, professional projects, and creative workflows are currently scattered across multiple disjointed tools:
- Notes & thoughts in random markdown files or apps
- Tasks and software projects in rigid trackers
- Content pipelines (videos, scripts, shorts timestamps) tracked manually or lost in video editing software
- Finances spread across bank statements or manual spreadsheets
- Learning resources and book takeaways siloed away from actual projects

This causes **fragmentation, context switching, and lost momentum**.

➡️ **Bearxus provides ONE fast, private, fully customizable workspace unifying all facets of a solo creator and developer's life.**

---

## 🧑‍💻 Users

| Persona | Needs |
| :--- | :--- |
| Solo Developer / Builder | Unified command center for tracking engineering projects, notes, and finances. |
| Content Creator (YouTube/Media) | Dedicated project workflows with custom statuses, screenplay outlines, and timestamp logs for clipping Shorts. |
| Lifelong Learner | Track books, courses, and technical documentation paired directly with structured takeaway notes. |

---

## ✨ Core Features

### A) Notes & Knowledge Base
- Markdown editor with code syntax highlighting, callouts, and task checklists.
- Quick capture global modal (`Cmd+K`) for instant thought logging.
- Bi-directional linking across projects, content, and learning resources.

### B) Projects & Dynamic Content Hub
- **Two-Tier Architecture:** High-level project index that drills down into dedicated project workspaces.
- **Dynamic Kanban Boards:** Customizable status columns per project (similar to GitHub Projects or Jira), allowing different workflows for software projects vs. media/content pipelines.
- **Content Studio Utilities:** Built-in screenplay/outline editor and session timestamp logger to easily extract YouTube Shorts and reels from long-form recordings.

### C) Financial Tracker
- Fast transaction logging for income and expenses.
- Customizable categories with monthly budget targets.
- Cash flow analytics and net savings rate calculations.

### D) Learning Progress
- Resource library tracking books, courses, and documentation (`To Start`, `In Progress`, `Completed`).
- Percentage completion meters.
- Direct linking from learning items to deep-dive summary notes.

### E) Global Command Palette (`Cmd+K`)
- Instant search and navigation across all notes, tasks, projects, and financial entries.

---

## 🗄️ Data Model
> This schema is a starting point and will evolve during implementation.

- User
  - Fields: id, email, password, createdAt, updatedAt
  - Relations: Has many Projects, Notes, Transactions, and Learning Resources.

- Project
  - Fields: id, name, description, type (e.g., software, content, client), status (e.g., active, completed, on-hold), progress, userId, timestamps.
  - Relations: Belongs to a User. Has many Columns and Tasks.

- ProjectColumn
  - Fields: id, name (e.g., "Outline / Script", "In Progress"), color, position, projectId
  - Relations: Belongs to a Project. Has many Tasks.

- Task
  - Fields: id, title, description (used for screenplays, outlines, or session logs), priority, dueDate, projectId, columnId, timestamps.
  - Relations: Belongs to a Project and a specific ProjectColumn.

- Note
  - Fields: id, title, content, tags (array), userId, timestamps.
  - Relations: Belongs to a User.

- Transaction
  - Fields: id, type (income or expense), amount, category, date, notes, userId, createdAt
  - Relations: Belongs to a User.

- LearningResource
  - Fields: id, title, type (book, course, doc), status (to-start, in-progress, completed), progressPct, userId, timestamps.
  - Relations: Belongs to a User.

## 🧱 Tech Stack

| Category | Choice |
| :--- | :--- |
| Framework | **Next.js (App Router)** |
| Language | TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Styling / UI | Tailwind CSS v4 + Shadcn UI components |
| Auth | NextAuth.js (Secure session cookies) |
| Deployment | Self-hosted Docker container / Vercel private instance |

## 🎨 UI / UX

- Dark Mode First: Optimized for low-light coding and editing sessions.
- Aesthetic: Clean, high-performance developer tool inspired by Linear, Raycast, and GitHub Projects.
- Layout: Collapsible sidebar navigation, high-signal dashboard overview, and a universal Cmd+K command palette.

## 🔌 API Architecture

```graph
Client <--> Next.API
  Next.API --> Postgres[(PostgreSQL DB)]
  Next.API --> Auth[Secure Session Auth]
```

## 🧭 Roadmap

### MVP (Phase 1)

- Core layout and sidebar navigation.
- Notes & Knowledge Base markdown editor.
- Financial Tracker (income/expense logging and category totals).
- Learning Resource tracker.

### Dynamic Projects & Content Hub (Phase 2)

- Two-tier project index.
- Customizable per-project status columns (Kanban engine).
- Content item drill-down with screenplay and timestamp clipping notes.

### Future Enhancements (Phase 3)

- Global Cmd+K command palette search across all modules.
- Automated Markdown exports and database JSON backups.
- Advanced cash flow charts and content analytics.

## 📌 Status

- Conceptual design & visual prototyping completed.
- Ready for schema setup & repository scaffolding.

Bearxus — Your Private Command Center.