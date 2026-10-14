# CustomAI Studio

CustomAI Studio is a college project for creating custom AI chatbots and chatting with them. The project uses a Next.js frontend and a FastAPI backend. It uses SQLite locally and can use a Supabase Postgres database when configured.

## Current phase

Phase 1 is complete:

- Next.js + TypeScript + Tailwind CSS frontend starter
- FastAPI backend with a `GET /health` endpoint
- Backend environment-variable template
- Backend health-check test

Phase 2 is complete:

- `POST /api/chat` endpoint backed by the Google Gemini API
- Interactive chat page with messages, loading feedback, and error feedback
- Mocked backend chat tests that do not use a real Gemini API key

Phase 3 is complete:

- Email/password registration, login, and revocable JWT logout
- SQLite database for users and chatbot settings
- Chatbot dashboard with create, edit, and delete actions
- Backend ownership checks on every chatbot route

Phase 4 is complete:

- Database-backed conversations and messages for each chatbot
- Conversation sidebar with open, rename, delete, and new-conversation actions
- Gemini requests receive only the 12 newest saved messages

Phase 5 is complete:

- Per-chatbot knowledge bases accepting UTF-8 TXT and text-based PDF files
- Text chunks and Gemini embeddings stored in SQLite, ranked with cosine similarity
- Source file/page citations displayed with each saved AI answer
- File-size/type checks, ownership checks, and cascading document-chunk deletion

Phase 6 is complete:

- Saved light/dark display preference and small-screen chat layout
- Basic validation for chat input and an in-memory chat rate limit

Supabase database support is complete:

- FastAPI/SQLAlchemy can connect to a Supabase Postgres database through a backend-only connection string
- Local SQLite remains the default so the project still runs without a Supabase account
- The application uses encrypted Postgres connections and creates its initial tables at startup

## Project structure

```text
customai-studio/
├── backend/             # FastAPI API and Python tests
│   ├── app/
│   ├── tests/
│   ├── .env.example
│   └── requirements.txt
├── frontend/            # Next.js web app
│   └── src/app/
└── README.md
```

## Prerequisites

- Node.js 20.9 or later
- Python 3.11 or later

## Run the backend

In PowerShell from the project root:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

The API is then available at `http://127.0.0.1:8000`.

- Health endpoint: `http://127.0.0.1:8000/health`
- Interactive API docs: `http://127.0.0.1:8000/docs`

Run the backend tests with:

```powershell
py -3 -m pytest
```

## Run the frontend

Open a second PowerShell window from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in a browser. The homepage confirms that the frontend is running. Chat functionality will be added in Phase 2.

## Environment variables

Copy `backend/.env.example` to `backend/.env` before adding local configuration. The `.env` file is ignored by Git. Keep real API keys only in this backend file—never in frontend code or Git.

Set `GEMINI_API_KEY` in `backend/.env` before sending chat messages. `GEMINI_MODEL` defaults to `gemini-3.8-flash` and can be changed if your Gemini account uses a different model.

For local development, keep the default SQLite `DATABASE_URL` and replace `JWT_SECRET` with a unique value of at least 32 characters. You can generate one with:

```powershell
py -3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Connect Supabase Postgres

This project connects to Supabase as a private FastAPI backend using SQLAlchemy. It does **not** send a Supabase URL, anon key, service-role key, or database password to the Next.js frontend.

1. Create a Supabase project.
2. In its dashboard, select **Connect** and copy the **Session pooler** connection string. This is normally the best option from an IPv4-only local computer. Use the exact host, user name, and port shown in the dashboard.
3. In `backend/.env`, set `SUPABASE_DB_URL` to that connection string, replacing `[YOUR-PASSWORD]` with your database password. Percent-encode reserved password characters such as `@`, `#`, and `?`.
4. Restart the FastAPI backend. On its first successful connection, the app creates the project tables in the Supabase database. This begins with an empty database; it does not copy existing local SQLite records.

Example format only—do not paste the placeholders literally:

```env
SUPABASE_DB_URL=postgresql://postgres.PROJECT_REF:YOUR_ENCODED_PASSWORD@YOUR_POOLER_HOST:5432/postgres
```

`SUPABASE_DB_URL` overrides `DATABASE_URL` when it is present. Remove or blank it to switch back to local SQLite. The backend adds `sslmode=require` automatically if the connection string does not already specify an SSL mode.

For a long-running deployment with IPv6 support, Supabase also recommends its direct connection string. See the [official connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres) for the right option for your host.

## Test the chat feature

With both servers running, open `http://localhost:3000`, enter a message, and select **Send**. The browser sends the message to the FastAPI backend, which calls Gemini and returns the reply. The browser never receives the Gemini API key.

You can also test the API directly in PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/chat `
  -ContentType 'application/json' `
  -Body '{"message":"Hello, Gemini!"}'
```

If the key is missing or Gemini is unavailable, the API returns a safe error message instead of an internal stack trace.

## Use the chatbot dashboard

1. Start the backend and frontend using the commands above.
2. Open `http://localhost:3000`.
3. Register with an email and password of at least eight characters, then create a chatbot.

The dashboard stores only the current JWT in this browser's local storage. Every chatbot API request includes that token, and the backend filters by the authenticated user's ID. Users cannot read, update, or delete another user's chatbot. The existing email/password login remains application-managed; connecting Supabase here provides the Postgres database, not Supabase Auth.

## Use conversation history

Open **Chat** on any chatbot card. The chatbot’s page has a sidebar of that chatbot’s past conversations. Create a new conversation, pick an older conversation to reopen it, or use its hover controls to rename or delete it.

Every completed turn stores both the user message and the AI reply in SQLite. For each new prompt, the backend sends the last 12 saved messages for that conversation to Gemini, together with that chatbot’s personality and temperature. This prevents the prompt from growing without limit while preserving recent context.

## Use a knowledge base

Open a chatbot’s **Chat** page and use the **Knowledge base** panel in its sidebar to upload a `.txt` or text-based `.pdf` file (maximum 5 MB). The backend extracts the text in memory, breaks it into small overlapping chunks, asks Gemini for embeddings, and stores only the metadata, chunks, and embeddings in SQLite—not the original file.

When that chatbot receives a question, the backend embeds the question, compares it with its stored chunk embeddings using cosine similarity, and gives only the closest passages to Gemini. The answer shows its file name and, for PDFs, page number. If no passage is relevant, the chatbot is instructed to say the uploaded documents do not contain the answer. A scanned PDF without selectable text is rejected; OCR is intentionally outside this simple college-project version.

Document upload and question retrieval need `GEMINI_API_KEY`, because they call Gemini's embedding model. `GEMINI_EMBEDDING_MODEL` defaults to `gemini-embedding-001`; keep it on the backend alongside the normal chat model setting.

## Interface and rate-limit defaults

Use the moon/sun button at the top-right of any page to select light or dark mode. The choice is saved in that browser. The dashboard and chat views stack their controls and sidebar cleanly on smaller screens.

For local development, chat requests are limited to **20 requests per minute**. The simple limiter is in memory, so it resets when the backend restarts and is appropriate for this single-process college project. If the limit is reached, the API returns HTTP 429 with a `Retry-After` header and a safe message for the UI.
