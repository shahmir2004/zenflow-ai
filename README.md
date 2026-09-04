# ZenFlow AI

Real-time yoga form feedback from the camera you already have. Eight poses,
timed holds, and one spoken correction at a time — so you can close your eyes
and stay in the breath.

**No video ever leaves the device.** Pose estimation runs in the browser with
MediaPipe; only 33 anonymous joint coordinates per frame are sent for
evaluation. Nothing is recorded, and there is no account or database anywhere
in the system.

**Live:** https://web-kappa-liard.vercel.app

```
web/     Next.js 15 app        → Vercel   https://web-kappa-liard.vercel.app
server/  FastAPI yoga API      → Render   https://zenflow-api-mto8.onrender.com
docs/    YOGA_API.md — the wire protocol, in full
```

The API sleeps after ~15 minutes idle, so open `/` first — the landing page
pings it on mount and the wake-up happens while you read. Straight to
`/session` on a cold API means waiting. `/session?preview=1` needs neither the
API nor a camera.

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

## The voice

The coach's script is a **closed set**. Every pose introduction, hold cue,
transition and correction is fixed before the app ships, and the only numbers
spoken are the last three seconds of a hold — around sixty utterances in total.

So they are rendered once, offline, with
[Kokoro-82M](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)
(Apache 2.0) and committed as ~2MB of AAC. The app plays audio files. There is
no model download, no API key, no per-play cost, no network, and the voice is
identical every time — none of which is true of either browser speech synthesis
(free, instant, sounds like a train announcement) or an in-browser neural model
(90MB before it says a word).

```bash
cd tools/voice
npm install            # onnxruntime — deliberately not a devDependency of web/
npm run render         # writes web/public/voice/*.m4a + manifest.json
```

[`web/lib/hooks/useVoice.ts`](web/lib/hooks/useVoice.ts) plays a clip when one
exists and **falls back to the Web Speech API when one does not** — so a tree
with no audio rendered, or a line edited without re-running the renderer,
behaves exactly as the app did before this existed rather than going silent.

`tools/voice/render.mjs` imports the script from
[`web/lib/voice/lines.ts`](web/lib/voice/lines.ts) under plain Node, so the app
and the renderer cannot disagree about what to say. A vitest case reads the
Python source and asserts every correction the server can emit has a clip; that
is the test that catches the otherwise invisible failure, where one reworded
line quietly drops back to the robotic voice while everything around it sounds
fine.

## Two kinds of joint

`required_joints` are the joints without which a pose cannot be judged at all.
`preferred_joints` are checked when visible and skipped when not.

Warrior II used to require twelve joints, wrists included, so a wrist flickering
behind the torso invalidated an evaluation of the legs that was perfectly
readable — and told the user to step back when their stance was the thing being
judged. Tree Pose was worse: it required both ankles, and the entire point of
the pose is to tuck one foot behind the standing leg.

Visibility itself is debounced twice over in
[`server/pipeline/framing.py`](server/pipeline/framing.py) — a Schmitt trigger
per joint so a score hovering near the threshold settles instead of chattering,
and a run of consecutive bad frames before anything is said at all. The two
causes are also separated, because they take opposite advice: a body leaving
the picture is fixed by stepping back, and a body that is fully in shot but
unreadable is not.

The cue is spoken **once** per episode. It is a fact about the room, not a fault
the user can work on mid-pose, and repeating it every five seconds for as long
as it stays true is what made the coach feel like a nag.

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
cd server && pytest -q     # pose detection, framing gates, hold timing, WebSocket
cd web && npm test         # catalog parity, voice-script parity with the server
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
