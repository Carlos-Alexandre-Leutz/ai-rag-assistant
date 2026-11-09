# 03 – Guest Flow (Decision)

Decision for PBI task T22: how people use the app without creating an account.

## 1. Context

This project is also a portfolio piece, so a recruiter must be able to try it **without signing up**. The current guest chat is a separate flow and has three problems:

- The PDF is sent to Gemini again with every question; nothing is stored, so the document is lost if it is not re-attached.
- The 10-question limit is counted by the browser (`messagesCount`) and trusted by the BFF, so it can be bypassed.
- The guest id (`x-guest-id`) is invented by the browser and never verified.

## 2. Decision

Guests get the **same experience as logged-in users** (several chats, stored chunks, streaming, retry), with limits. Guests are **not removed**, and they do not get a separate code path.

A guest is a **temporary anonymous account**:

- A "Try without signing up" button asks the server to create an anonymous user and returns a normal JWT.
- From then on the guest uses the same routes, screens and chats as any user.
- Anonymous accounts are **deleted from the database** when they expire. Deleting the user cascades to documents, chats, messages and vector chunks.

## 3. Limits (enforced on the server)

| Limit | Value |
|---|---|
| Documents | 1 |
| File size | 10 MB |
| Questions | 20 in total |
| Lifetime | 24 hours, then everything is deleted |
| Account creation | rate-limited per IP, plus a global cap on active guests |

Logged-in users keep their current limits (20 MB file, no question cap).

## 4. Visibility of the limits

Guests must know the limits before and while using the app:

- The "Try without signing up" button on the login and register pages lists them.
- Inside the app, a guest sees a small bar with usage and time left (documents, questions, hours until deletion) and a "Create account" button.
- When a limit is reached, the message says which one and offers to create an account.

## 5. Cleanup

Nothing from a guest stays in the database after it expires:

- A job in api-tasks (`GuestCleanupService`) runs at startup and every 10 minutes (`GUEST_CLEANUP_INTERVAL_MS`) and deletes expired anonymous users, which removes their data by cascade.
- An "End session" button in the guest bar calls `DELETE /auth/guest` and deletes the guest data immediately. The endpoint only ever deletes anonymous accounts.

## 6. Consequences for the other tasks

- **T23:** the whole-file upload to Gemini on every guest question disappears, together with the old `/chat` guest path and `GuestChat`.
- **T24:** cleanup is the expiry job above, not a separate chunk-cleanup system.
- **Schema:** `User.email` and `User.password` become optional; `User.isGuest` and `User.expiresAt` are added.
