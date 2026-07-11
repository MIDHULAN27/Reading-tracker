# Presentation Slides: Booklyn – AI Powered Reading Tracker & Digital Library Platform

This document contains the slide structure and content for the presentation based on the Booklyn project, structured exactly according to the required headings.

---

## Slide 1: Booklyn – AI Powered Reading Tracker & Digital Library Platform
* **Title:** BOOKLYN – AI Powered Reading Tracker & Digital Library Platform
* **Sub-title:** Capstone Project Presentation
* **Key Details:**
  * **Presented By:** MIDHULAN J (Reg No: 23BCS123)
  * **Course:** B.Sc. Computer Science with Cognitive Systems
  * **Institution:** Sri Krishna Arts and Science College, Coimbatore
  * **Project Guide:** DEEPA B (Assistant Professor, Dept of IT & Cognitive Systems)
  * **Collaborator Organization:** REZILYENS (Industry Partner)

### Speaker Notes:
> "Good morning/afternoon everyone. Today, I am presenting my final year project, Booklyn, which is a cloud-synchronized, AI-powered reading tracker and digital library platform. It is designed to combine cataloging, reading, goal tracking, and AI recommendations into a single, unified cognitive workspace."

---

## Slide 2: Table of Contents
* **Presentation Outline:**
  1. **Organizational Profile:** Collaborating partner Rezilyens.
  2. **The Problem:** Key limitations in existing digital library ecosystems.
  3. **Our Solution:** The Booklyn unified workspace approach.
  4. **Tech Stack & System Architecture:** Frontend, backend, database layers, and APIs.
  5. **Features Matrix:** User & Admin panel functionalities.
  6. **AI Recommendation & Reading Analytics:** Streaks, charts, and OpenAI prompt structures.

### Speaker Notes:
> "This presentation is structured as follows. I will begin with the profile of my industry collaborator, Rezilyens. Then, I will outline the core problems that motivated this project, explain our unified solution, dive into the tech stack and system architecture, highlight key user and admin features, show our AI recommendation engine, and conclude with Q&A."

---

## Slide 3: Organizational Profile
* **Industry Partner:** REZILYENS
* **Profile:** A global cognitive systems engineering and technology consultancy specializing in software architectures, artificial intelligence deployment, and cybersecurity.
* **Core Objectives:**
  * **Vision:** Harmonize human cognitive processes with raw computational intelligence.
  * **Mission:** Design high-performance, secure software ecosystems while fostering academic-industry partnerships.
  * **Capabilities:** end-to-end security compliance, Row Level Security (RLS) integration, LLM implementations, and serverless architectures.

### Speaker Notes:
> "My project was developed under the guidance and infrastructure support of Rezilyens. They specialize in modern web architectures, cybersecurity, and artificial intelligence, helping bridge the gap between academic research and commercial software implementation."

---

## Slide 4: The Problem
* **Fragmented Reading Systems:** Users hop between downloading portals, local e-book viewers, and tracking spreadsheets.
* **Manual logging friction:** Traditional tracking systems (e.g., Goodreads) require users to manually input current pages or calculate percentages.
* **Closed Ecosystems:** Popular platforms (e.g., Kindle) lock users into proprietary book catalogs and file formats.
* **Generic Recommendations:** Recommendations rely on simple popularity counts or sponsored books rather than reading patterns.
* **No Academic Integration:** Standard apps support leisure books but fail to catalog academic research papers in the same catalog.

### Speaker Notes:
> "Contemporary digital reading is heavily fragmented. Traditional platforms either lock readers into closed environments, rely on manual progress logging, or push generic ads as suggestions. There is no unified system that caters to both leisure books and scientific literature while offering automated progress saving."

---

## Slide 5: Our Solution
* **Unified Reading Workspace:** Integrates catalog search, in-browser e-book reading, progress tracking, and academic cataloging.
* **Automated Syncing:** Saves progress coordinates (EPUB CFI/PDF pages) to the cloud on page turn.
* **Dynamic Shelf Management:** Visualizes completion percentages for *Want to Read*, *Currently Reading*, and *Completed* shelves.
* **Gamified Habits:** Motivates daily reading with streaks, customizable target rings, and notifications.
* **Public Domain cataloging:** Direct, free legal access to over 70,000 classics from Project Gutenberg.

### Speaker Notes:
> "Booklyn solves these challenges by combining discovery, storage, reading, and analytics. It automates progress tracking by monitoring user page turns, aggregates Gutenberg classics, cataloges academic papers, and uses gamification to encourage daily reading habits."

---

## Slide 6: Tech Stack
* **Presentation Layer (Frontend):** React.js (v18), TypeScript, Tailwind CSS, Vite.
* **Application Layer (Backend Server):** Node.js, Express.js.
* **Database & Cloud Services:** PostgreSQL (Supabase Cloud).
* **Identity Management:** Supabase Auth (Secure JWT credentials).
* **Core Interfaces (APIs):**
  * **Gutendex API:** Project Gutenberg search and retrieval.
  * **Semantic Scholar API:** Academic paper metadata queries.
  * **OpenAI API:** Custom next-read generation.

### Speaker Notes:
> "Our selected technology stack ensures scalability, performance, and security. We use React with TypeScript and Vite for a highly responsive user experience, Node.js and Express.js on the backend, and Supabase PostgreSQL for persistent cloud storage."

---

## Slide 7: System Architecture
* **Frontend-Backend Orchestration:**
  * Single Page Client communicates with the backend via secure HTTPS using JWTs.
  * Express server queries APIs and caches resources locally.
* **Server-Side Caching:**
  * Implemented an in-memory cache (30-minute expiration) to prevent Gutenberg API rate limits.
* **Database Level Security:**
  * Row Level Security (RLS) policies prevent unauthorized read/write access to user libraries.
  * Automated Postgres triggers sync user sign-up profiles.

### Speaker Notes:
> "Booklyn is organized as a three-tier system. The frontend handles visual displays, the backend server handles caching and third-party API orchestration, and the Supabase database manages secure data sync using PostgreSQL Row Level Security to isolate each user's records."

---

## Slide 8: User Features
* **Custom Profile Management:** Secure registration, token verification, and custom avatars.
* **Book Discovery & Search:** Unified search interface filtering public-domain books and categories.
* **Embedded Browser Reader:** Paginated EPUB rendering with customizable font sizes, dark/light themes, and offline session buffering.
* **Research Paper Library:** Search academic articles, view abstracts, download PDF files, and bookmark metadata.
* **Progress Logging:** Interactive sliders to log reading sessions (pages read and minutes spent).

### Speaker Notes:
> "For the user, the app offers secure login, a catalog discover page, an embedded reader that runs directly in the browser without plugins, academic search via Semantic Scholar, and progress logging to record pages read and session lengths."

---

## Slide 9: Admin Panel Features
* **System Health Dashboard:** Live monitoring of page load speeds and API latencies.
* **Cache Management:** Tools to inspect server-side memory caches and force-clear Gutenberg API entries.
* **User Account Supervision:** View active registration counts, database records, and system usage statistics.
* **Database Metrics:** Monitor query response durations and Row Level Security verification performance.

### Speaker Notes:
> "The administrative dashboard allows system administrators to monitor overall platform health. Admins can view API latency metrics, manage cached results to avoid Gutenberg timeouts, and view user engagement statistics securely."

---

## Slide 10: AI Recommendation & Reading Analytics
* **Reading Streak Engine:**
  * Analyzes consecutive session timestamps in `reading_sessions`.
  * Computes and displays the current daily reading streak counter on the dashboard.
* **Custom Charts & Analytics:**
  * Tracks pages-per-minute speed and monthly goal completion metrics.
* **AI Recommendations:**
  * Sends user’s reading history, shelf contents, and reviews to Express backend.
  * Backend compiles a structured prompt for OpenAI API (JSON Mode).
  * Returns 5 customized next-read book recommendations with contextual explanations.

### Speaker Notes:
> "The core differentiator of Booklyn is our analytics and recommendation system. We process reading logs to plot reading speed charts and maintain daily streaks. We also send the user's genre history and rating preferences to OpenAI to generate 5 highly personalized next-reads."

---

## Slide 11: Thank You
* **Concluding Remarks:**
  * Open to questions and discussions.
  * Sincere appreciation to:
    * **Deepa B** (Project Guide)
    * **Sri Krishna Arts and Science College**
    * **Rezilyens Group**
* **Project Documents Reference:**
  * Report: [BOOKLYN_PROJECT_REPORT.md](file:///Users/midhulanj/Reading%20tracker/docs/BOOKLYN_PROJECT_REPORT.md)
  * Schema: [schema.sql](file:///Users/midhulanj/Reading%20tracker/schema.sql)

### Speaker Notes:
> "That concludes my presentation on Booklyn. I would like to express my gratitude to my project guide Deepa B, Sri Krishna Arts and Science College, and my industry partner Rezilyens for their invaluable support. I am now open to any questions you may have. Thank you."
