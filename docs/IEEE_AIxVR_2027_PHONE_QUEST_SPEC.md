# UpForm IEEE AIxVR 2027 — Phone + Quest Demonstrator

Status: design/implementation specification. Nothing in this document implies the new capabilities are already implemented or tested.
Submission track: Demo / Video Paper, deadline October 29, 2026 AoE.

## Research framing
How can uncertainty-aware pose-based exercise feedback reduce ambiguity and interruption for novice users across phone and mixed-reality displays?
Claim only an implemented and measured contribution. MediaPipe pose estimation itself is existing research, not a new contribution.

## Evidence from original UpForm coursework
- Existing browser-camera prototype detects body landmarks with MediaPipe.
- Exercise-specific rule-based detection for squats, lateral raises, shoulder presses.
- Earlier user tests flagged excessive text, confusing rep feedback, and reluctance to set down a phone in a busy gym.
- Original design proposed glasses but did NOT integrate or validate glasses hardware.

## MVP — reviewers must be able to test without special hardware
1. **Phone live mode (required)**: HTTPS browser, explicit camera permission, tracking set-up wizard, one validated bodyweight exercise, real-time count and spoken/visual cue, set summary.
2. **Replay mode (required)**: same public URL on phone, desktop, or Quest 2D browser; a clearly labeled, prerecorded/fixture-backed demo with declared ground truth and deterministic timestamps. No mock telemetry presented as live data.
3. **Quest mixed-reality viewer (stretch, validate on physical Quest)**: WebXR `immersive-ar`, transparent passthrough background, legible world-anchored cues. Phone acts as external tracking sensor, sends only exercise event/quality telemetry with participant-controlled pairing. Quest browser alone is NOT a validated full-body tracking camera.
4. **Fallbacks**: WebXR feature-detection; if unsupported show 2D viewer; always allow simulator/replay.
5. Never require reviewers to install software solely to inspect app/replay; native headset application is outside this sprint.

## Product behavior — phone
1. Select demo/real session and exercise; default phone.
2. On-device body visibility, framing, and camera-angle checks.
3. Countdown and baseline calibration; three consecutive usable frames before activation (actual policy to be tuned).
4. Pose landmarks -> temporal smoothing -> phase detector -> valid/invalid/unknown event.
5. Missing joints, occlusion, confidence too low, or invalid frame: hold state/withhold correctness judgments, request reposition; do not count a rep from a gap.
6. During each rep: max one actionable coaching cue; color and audio convey the same semantic state.
7. On rejection explain observable reason without medical or absolute safety claims.
8. Summary includes total attempts, confirmed reps, uncertain attempts, and limitations. Do not fabricate performance data.

## Product behavior — headset
- Comfort-first passthrough panel positioned ~1.5m from eyes, text large and anchored; no small phone UI floating in space.
- State from phone through optional explicit pairing, not raw camera footage.
- Legibility and headset controls verified in Quest Browser; test input with hands/controllers.
- Users can exit XR at any time; no heavy weights or unsafe exercises while wearing headset.
- Before pairing is implemented, headset must say "preview only"; don't claim functional tracking.

## Technical fixes before XR pairing
P0: Extract and test shared exercise phase functions; camera/canvas coordinate registration with object-fit:cover mirror.
P0: Permission fallback for camera when microphone is denied; acknowledge browser SpeechRecognition variability.
P0: Correct unsupported "Meta Glasses" selection and demo analytics; default to honest phone-camera behavior.
P0: Event log for rep start/end, predicted validity, confidence, losses, timestamps, platform info; allow CSV/JSON export without video by default.
P1: Pose landmark quality gating and smoothing; phase reset on tracking loss; exercise-specific angle threshold calibration.
P1: Repeatable fixtures and tests for valid/incomplete/occluded movements.
P1: Shared session event schema: version, sessionId, timestamp, exerciseId, status, repCount, lastCue, confidenceBand. No user name or camera pixels.
P2: Quest WebXR experience and pairing protocol; select a reliable signaling backend and retention/privacy policy before implementation.

## Evaluation
- One exercise first (bodyweight squat or shoulder press), then add more if validated.
- Compare app rep counts against manually annotated movement attempts; report precision/recall or MAE and failure cases, never invented statistics.
- Compare tracking losses/false cues for frontal vs off-axis recording; measure feedback latency.
- Small usability test evaluates comprehension of accepted/rejected/unknown rep states on phone.
- Evaluate Quest display legibility and comfort only with a physical headset, as separate evidence.
- Record consent, ethics-review determination, testing conditions, participant count, and test software versions.

## Publication/disclosure
- 4 content pages + references, IEEE double-column, non-anonymous demo track.
- Consent/ethics statements as applicable. Confirm authorship with course-project team before reuse.
- Clearly separate currently implemented software from proposed XR mode.
- Keep a stable code revision, recording, experiment scripts and real results for reviewer reproduction.
- Do not misdescribe smart-glasses (e.g. Meta Ray-Bans) as Quest VR headset.

## Milestones / acceptance
- Day 1: existing source baseline and research framing confirmed; no rewrites of main.
- Phone MVP ready only when camera permits, one exercise runs, logs, and deterministic regression fixtures pass.
- Replay ready only when every output is backed by declared fixture data.
- Quest preview ready only after physically entering and exiting `immersive-ar` and checking positioning on target headset.
- Quest paired mode ready only after phone->Quest real event stream tested; otherwise use "preview only".
- Paper conclusions describe only tested capabilities.
