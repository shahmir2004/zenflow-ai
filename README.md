# ZenFlow AI

Real-time yoga form feedback from the camera you already have. Eight poses,
timed holds, and one spoken correction at a time — so you can close your eyes
and stay in the breath.

**No video ever leaves the device.** Pose estimation runs in the browser with
MediaPipe; only 33 anonymous joint coordinates per frame are sent for
evaluation. Nothing is recorded, and there is no account or database anywhere
in the system.

```
web/     Next.js 15 app        → Vercel
server/  FastAPI yoga API      → Render   https://zenflow-api-mto8.onrender.com
docs/    YOGA_API.md — the wire protocol, in full
```

## How it fits together

```
Browser
├── getUserMedia ─────────────────────────────────────────┐
├── MediaPipe PoseLandmarker (WASM, GPU)                   │
│     └── 33 landmarks {x, y, z, visibility} @ 12fps       │
│                                                          ▼
└── WebSocket ───────────────────────► /api/ws/yoga/{client_id}
      { landmarks, pose, timestamp }        │  BaseYogaPose.evaluate()
                                            │  HoldTimer.update()
      ◄─────────────────────────────────────┘
      state · hold_progress · corrections · joint_colors

  → skeleton overlay, hold ring, spoken cue, chime on completion
```

The client names the pose on every frame, so the server never has to guess what
you are doing: there is no classifier, no warm-up, and feedback starts on frame
one. Sequencing is the client's job too — the server answers one question per
frame and remembers nothing between connections.

## Quick start

Two terminals.

```bash
# API
cd server
pip install -r requirements.txt
python -m uvicorn main:app --port 8000

# App
cd web
npm install
npm run dev          # http://localhost:3000
```

`web/.env.local`:

```env
NEXT_PUBLIC_FORM_COACH_URL=http://localhost:8000
```

`http://localhost:3000` is already an allowed origin, so local development
needs no server configuration.

**`/session?preview=1`** runs the entire live UI against a scripted coach with
no camera and no backend. It is the fastest way to see the session view, and it
labels itself as a preview rather than pretending to be real feedback.

## The eight poses

| Pose | Sanskrit | Camera | Hold |
| --- | --- | --- | --- |
| Mountain | Tadasana | front | 15s |
| Tree | Vrksasana | front | 20s |
| Warrior I | Virabhadrasana I | front | 20s |
| Warrior II | Virabhadrasana II | front | 25s |
| Chair | Utkatasana | front | 20s |
| Triangle | Trikonasana | front | 20s |
| Downward Dog | Adho Mukha Svanasana | **side** | 20s |
| Cobra | Bhujangasana | **side** | 15s |

Floor poses are read from a side view at floor height and detect less reliably
than standing poses — the app surfaces the required camera view rather than
letting you blame your form.

The catalog in [`web/lib/data/poses.ts`](web/lib/data/poses.ts) must agree with
[`server/exercises/yoga_registry.py`](server/exercises/yoga_registry.py) on
labels, camera views and hold targets. `web/lib/data/__tests__/catalog.test.ts`
asserts it, and the app re-checks against the live catalog in development.

## Testing

```bash
cd server && pytest -q     # pose detection, hold timing, WebSocket, extraction guards
cd web && npm test         # catalog parity
cd web && npm run build    # type-checks as it builds
```

## Origins

The server is the yoga half of
[shahmir2004/exercise-form-correction](https://github.com/shahmir2004/exercise-form-correction),
extracted so this app deploys on its own. The exercise pipeline — HMM/k-NN
movement classification, rep counting, chunked video upload — is not here, and
neither are its dependencies (~117 MB of them, scipy included, which upstream
declares but never imports).

`server/tests/test_slim_server.py` fails if any of it comes back. That test
exists because nothing else would notice: the server works perfectly either
way, it would just quietly install and load a classifier it never calls.

Deployment: [`web/DEPLOYMENT.md`](web/DEPLOYMENT.md).
Protocol: [`docs/YOGA_API.md`](docs/YOGA_API.md).
