# Database

The schema lives in the `zenflow` Supabase project (ap-south-1) and was applied
through migrations. What each one does:

| Migration | What it adds |
| --- | --- |
| `zenflow_core_schema` | profiles, plans, sessions, session_poses, session_corrections, form_snapshots, RLS on all six, and the trigger that creates a profile with each account |
| `save_session_rpc` | `save_session()` and `delete_my_practice_data()` |
| `harden_functions` | pins `search_path` on both RPCs and revokes public EXECUTE on the trigger function |

## Two things worth knowing

**RLS is the authorisation.** Every table is `user_id = auth.uid()`, and the
child tables reach their owner through their session, so a leaked session id
reveals nothing on its own. Nothing in the app checks ownership in code — if a
query returns a row, the database already decided it was allowed.

Test it with the anon key, never the service key. The service key bypasses RLS
entirely and will report that everything is fine when it is not.

**`save_session` is an RPC, not four inserts.** A session, its poses, its
correction tally and its form snapshots go in one statement so they cannot be
half-written. Four separate calls can fail between them and leave a session
with no poses attached, which would still be counted in the streak and would
render as an empty row in history.

`SECURITY INVOKER` is deliberate on both RPCs: RLS still applies, so neither
can write onto another user's account.

## Pose labels

`pose_label` is a domain with a CHECK listing the eight poses the server
implements. That is the database's half of the parity guarantee;
`web/lib/data/__tests__/catalog.test.ts` is the frontend's half. A label the
server does not know fails silently at runtime — the session sits in `idle`
forever with nothing on screen to explain why.
