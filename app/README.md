# Launchpad

A working personal job and internship search application. The architecture is:

```
Greenhouse public boards ─┐
                         ├─ normalize + deduplicate ─ resume matcher ─ Cloudflare D1 ─ React dashboard
Apify saved task dataset ─┘                           │
                                            GPT-4o, or explicit
                                            keyword fallback
```

The frontend uses React with a Next.js-compatible Vinext router. Server routes run in a Cloudflare Worker; D1 provides durable SQLite storage. Apify performs scheduled scraping independently. The original ingestion → backend → LLM → database → dashboard design is preserved.

## What works

- Edit a resume, target roles, locations, skills, minimum score, and remote preference.
- Paste resume text or import a UTF-8 .txt/.md file. PDF/Word text can be pasted.
- Fetch current public Greenhouse company boards without API credentials.
- Import an Apify saved task's latest successful dataset, with common LinkedIn/Indeed actor field aliases.
- Score jobs with GPT-4o strict structured output: match, fit_score (1–100), two-sentence reason, supported skills, and gaps.
- Use visibly labeled, evidence-based keyword scoring when no OpenAI key is configured. Provider errors never silently become keyword results.
- Deduplicate normalized application URLs. Preserve saved/applied/interview/archive status across refreshes.
- Reassess changed listings and changed profiles; warn about stale assessments.
- Search, filter by job type/location, sort, bookmark, and track applications.
- Open the original application URL. Opening a link never submits an application or marks it applied.
- Generate an editable, downloadable cover-letter draft for scores above 80 when OpenAI is configured.
- Keep resume data and listing state scoped to the signed-in user.
- Explore clearly labeled fictional samples independently of real data.

## Local start

Requires Node.js 22.13+ and npm.

```powershell
cd app
npm ci
Copy-Item .env.example .env
npm run db:generate # Only after changing db/schema.ts; initial migration is already included.
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_funny_wrecker.sql
npm run dev
```

Apply the initial migration only once per local database. Open the URL printed by the dev server (normally http://localhost:5173). Use **Sign in to save your work**. Local development simulates a test identity; hosted sign-in is handled by the private Sites gateway. Never expose the development server publicly.

On this Windows machine, the npm shim can misresolve its installation directory when spawned by another helper. The working equivalents are:

```powershell
node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run install:ci
node scripts/run-framework.mjs build
node scripts/run-framework.mjs dev
```

Local database files are stored under .wrangler/state and excluded from source control.

## First real search

1. Sign in and open **My profile**. Replace the sample preferences and paste your resume.
2. Open **Connections** and enter Greenhouse board tokens, for example `figma` or `stripe`. Tokens come from company careers URLs; up to four are supported.
3. Save sources, then choose **Find new matches**.
4. Review the reason, gaps, and original listing. Save a role or update its application status.

The integration test collected 154 actual listings from the Figma Greenhouse board. This is a test observation, not a guarantee of current vacancies.

## Enable OpenAI

Set the server-only `OPENAI_API_KEY`. `OPENAI_MODEL` defaults to `gpt-4o`.

Local configuration goes in the ignored .env file. Hosted configuration belongs in Sites environment secrets, followed by a deployment to apply the new environment revision. Do not prefix secrets with NEXT_PUBLIC_ or put them in the browser.

The OpenAI Developers plugin can provision a key through its approved flow if enabled. No key was supplied in this workspace, so live GPT-4o calls and cover-letter output have not been verified with an account. The request/response validation and missing-key behavior are implemented and tested.

Resume matching sends the resume and job description to OpenAI. Resume claims are treated as evidence, while listing and resume instructions are treated as untrusted input. Scores are guidance, not hiring decisions.

## Apify and daily collection

1. Choose an Apify jobs actor supporting the boards you want.
2. Save an Actor Task with your job-search URLs, locations, and actor-specific filters. Task input formats differ between actors; configure these in Apify rather than assuming a universal input schema.
3. Set `APIFY_TOKEN` and `APIFY_TASK_ID` as server secrets. In Connections, enable Apify import.
4. Run the task once in Apify to populate its dataset.
5. Create a daily schedule in the Apify console, or run:
   ```powershell
   node scripts/schedule-apify.mjs --enable
   ```

The helper creates or updates one consistently named task schedule for 08:00 Asia/Kolkata. It uses the task's saved input, and Apify usage charges can apply. Running without --enable only describes the action. No paid task or schedule has been activated by this project setup.

Daily scraping runs on Apify even when your browser is closed. **Import and scoring happen when you click Find new matches**. Greenhouse is refreshed on demand. This release does not claim an unattended, daily server-side scoring worker; private Sites access prevents a generic unauthenticated webhook from invoking your user-specific workspace.

Normalization accepts title/jobTitle/positionName, companyName/company, location/jobLocation, description/content/descriptionText/jobDescription, and applicationUrl/applyUrl/jobUrl/url/link/absolute_url. Unsupported rows with missing descriptions or unsafe URLs are skipped. Adapt lib/matching.ts for an actor with a different schema.

## Processing and operational limits

- One active search per user; a 15-minute lease prevents simultaneous runs. Interrupted searches can be retried after the lease expires.
- A search scores at most 12 new/changed jobs with OpenAI, or 100 with the local keyword matcher. Remaining work is reported and processed on the next search.
- Each Greenhouse response processes at most 2,000 rows, and an Apify import reads at most 500 dataset rows.
- The dashboard loads up to 1,000 stored jobs. This is a personal-search MVP, not a high-volume multi-tenant crawler.
- Resume/profile revisions invalidate earlier assessments. Saving a profile during a search cannot publish newly computed results against the wrong revision.
- Search history records partial failures. Existing matches and application statuses survive provider errors.
- Stored jobs are retained for application tracking; a previously seen listing may close later. Always verify availability at its original application link.
- There is no automatic application submission, email sending, PDF parsing, or resume fabrication.
- The app relies on trusted authentication headers supplied by the Sites gateway. A different hosting platform must replace this auth boundary; never trust arbitrary client-provided identity headers on a public server.

## Verification

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --experimental-strip-types --test tests/matching.test.mjs
node tests/api-smoke.mjs
node scripts/run-framework.mjs build
```

The API smoke test uses only the loopback development mock account, writes a synthetic profile, and fetches public Greenhouse listings. It never calls paid OpenAI or Apify APIs. Run with the local development server and migrated local database. It checks authentication, input validation, origin rejection, collection, persistence, duplicate prevention, unavailable OpenAI behavior, and stale-profile conflict protection.

A browser check covers the job search, detail drawer, responsive navigation, and the optional WebMCP search tool (valid and invalid input). WebMCP is feature-detected and shares the visible search state.

## Relevant files

- app/dashboard.tsx — dashboard, profile editor, saved jobs, application tracker
- app/api/workspace/route.ts — authenticated API
- lib/pipeline.ts — ingestion, matching, synchronization, cover letters
- lib/matching.ts — normalization, safe URLs, schemas, keyword matching
- lib/server.ts — storage and request validation
- db/schema.ts and drizzle/ — schema and versioned migrations
- scripts/schedule-apify.mjs — idempotent daily Apify task schedule
- .env.example — credential configuration
- tests/ — matching and real-source integration checks

## Primary references

- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-4o](https://developers.openai.com/api/docs/models/gpt-4o)
- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)
- [Apify dataset import](https://docs.apify.com/api/v2/actor-task-runs-last-dataset-items-get)
- [Apify schedules](https://docs.apify.com/api/v2/schedules-post)
