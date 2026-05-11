"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const WORKOUTS = [
  {
    name: "Shoulder & Squat Day",
    exercises: [
      { name: "Shoulder Press", sets: 3, reps: 12, type: "press"    as const },
      { name: "Lateral Raises", sets: 3, reps: 12, type: "raise"    as const },
      { name: "Squats",         sets: 3, reps: 12, type: "squat"    as const },
    ],
  },
  {
    name: "Legs & Core Day",
    exercises: [
      { name: "Leg Press",      sets: 3, reps: 12, type: "legpress" as const },
      { name: "Squats",         sets: 4, reps: 10, type: "squat"    as const },
      { name: "Lateral Raises", sets: 3, reps: 15, type: "raise"    as const },
    ],
  },
  {
    name: "Push & Legs Day",
    exercises: [
      { name: "Shoulder Press", sets: 4, reps: 10, type: "press"    as const },
      { name: "Lateral Raises", sets: 3, reps: 12, type: "raise"    as const },
      { name: "Squats",         sets: 2, reps: 12, type: "squat"    as const },
    ],
  },
  {
    name: "Full Body A",
    exercises: [
      { name: "Shoulder Press", sets: 3, reps: 10, type: "press" as const },
      { name: "Lateral Raises", sets: 2, reps: 12, type: "raise" as const },
      { name: "Squats",         sets: 3, reps: 12, type: "squat" as const },
    ],
  },
  {
    name: "Full Body B",
    exercises: [
      { name: "Lateral Raises", sets: 3, reps: 12, type: "raise" as const },
      { name: "Shoulder Press", sets: 2, reps: 10, type: "press" as const },
      { name: "Squats",         sets: 4, reps: 10, type: "squat" as const },
    ],
  },
];

const DEFAULT_DAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
};

const MODES = [
  { id: "manual",  icon: "✏️", label: "Manual Log",           sub: "Log sets yourself" },
  { id: "phone",   icon: "📱", label: "Check-in Phone",        sub: "Use your camera" },
  { id: "glasses", icon: "🥽", label: "Check-in Meta Glasses", sub: "Hands-free tracking" },
];

type Screen     = "home" | "routines" | "profile" | "workout" | "tutorial" | "camera";
type PermState  = "idle" | "granted" | "denied";
type RepFlash   = "good" | "bad" | null;
type FormStatus = "good" | "bad" | "neutral";
type PressPhase  = "READY_BOTTOM" | "PRESSING_UP" | "TOP_REACHED" | "LOWERING";
type SquatPhase  = "STANDING" | "DESCENDING" | "BOTTOM" | "ASCENDING";

function calcAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

function _LoaderScreen({ onDone }: { onDone: () => void }) {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const d = setInterval(() => setDots(p => p.length >= 3 ? "" : p + "."), 500);
    const t = setTimeout(onDone, 4500);
    return () => { clearInterval(d); clearTimeout(t); };
  }, [onDone]);
  return (
    <div className="app">
      <div className="mobile-frame" style={{
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        minHeight:"100vh", padding:"32px",
      }}>
        <div style={{
          width:64, height:64, borderRadius:"50%",
          border:"3px solid var(--color-stone)",
          borderTopColor:"var(--color-forest-canopy)",
          animation:"spin 0.9s linear infinite",
          marginBottom:36,
        }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ fontSize:20, fontWeight:700, color:"var(--color-ink)",
          textAlign:"center", margin:"0 0 10px", letterSpacing:"-.01em" }}>
          Building your plan
        </p>
        <p style={{ fontSize:15, color:"var(--color-muted-ash)",
          textAlign:"center", margin:0, minHeight:22 }}>
          Personalising your workout{dots}
        </p>
      </div>
    </div>
  );
}

export default function Page() {
  const today    = new Date();
  const todayIdx = today.getDay();

  const [onboarded,    setOnboarded]    = useState<boolean | null>(null); // null = checking
  const [onboardStep,  setOnboardStep]  = useState(0);                   // 0-3 intro, 4 name, 5-8 profile, 9 freq, 10 days, 11 loader
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // day-of-week indices
  const [daysPerWeek,  setDaysPerWeek]  = useState(3);
  const [userName,     setUserName]     = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem("upform_name") || "") : ""
  );
  const [heightVal,    setHeightVal]    = useState("");
  const [weightVal,    setWeightVal]    = useState("");
  const [ageVal,       setAgeVal]       = useState("");
  const [selectedGoals,setSelectedGoals]= useState<string[]>([]);
  const [heightUnit,   setHeightUnit]   = useState<"cm"|"ft">("cm");
  const [weightUnit,   setWeightUnit]   = useState<"kg"|"lbs">("kg");
  const [daysFullFlash, setDaysFullFlash] = useState(false);
  const [screen,       setScreen]       = useState<Screen>("home");
  const [mode,         setMode]         = useState("glasses");
  const [tutorialStep, setTutorialStep] = useState(1);
  const [permState,  setPermState]  = useState<PermState>("idle");
  const [exIdx,      setExIdx]      = useState(0);
  const [reps,       setReps]       = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [formCue,    setFormCue]    = useState("");
  const [formStatus, setFormStatus] = useState<FormStatus>("neutral");
  const [repFlash,   setRepFlash]   = useState<RepFlash>(null);
  const [mpLoading,  setMpLoading]  = useState(true);
  const [noBody,     setNoBody]     = useState(false);
  const [muted,        setMuted]        = useState(false);
  const [cornerStatus, setCornerStatus] = useState<"good"|"bad"|"neutral">("neutral");
  const [workoutCount,  setWorkoutCount]  = useState(0);
  const [streak,        setStreak]        = useState(0);
  const [restActive,        setRestActive]        = useState(false);
  const [restSeconds,       setRestSeconds]       = useState(60);
  const [lastSetStats,      setLastSetStats]      = useState<{ good: number; bad: number; target: number } | null>(null);
  const [showExerciseIntro, setShowExerciseIntro] = useState(false);
  const [paused,            setPaused]            = useState(false);
  const [voiceCmd,          setVoiceCmd]          = useState<{ label: string; icon: string } | null>(null);
  const [calSelectedDay,    setCalSelectedDay]    = useState(today.getDay());
  const [legPressIntro,     setLegPressIntro]     = useState(false);

  const activeWorkoutRef = useRef(WORKOUTS[0]);
  const importFileRef    = useRef<HTMLInputElement>(null);
  const prevScreenRef    = useRef<Screen>("home");

  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const animRef       = useRef<number | null>(null);
  const mutedRef        = useRef(false);
  const lastSpeakRef    = useRef({ text: "", time: 0 });
  const recognitionRef  = useRef<any>(null);
  const listenActiveRef = useRef(false);
  const repStateRef   = useRef({
    // raise fields
    phase: "down", upPhaseCued: false,
    // press fields
    pressPhase: "READY_BOTTOM" as PressPhase,
    topReached: false, topReachedAt: 0, topCueSpoken: false,
    peakWristY: 1.0,   // lowest y (= highest point) reached during the press
    // squat fields
    squatPhase: "STANDING" as SquatPhase,
    // common
    count: 0, badReps: 0, badFormThisRep: false, lastRepTime: 0, badFormSpoken: false,
    unevenFrames: 0,
    badFormType: "" as "" | "tooHigh" | "uneven" | "tooLow" | "incomplete" | "kneeCave",
  });
  const cornerStatusRef  = useRef<"good"|"bad"|"neutral">("neutral");
  const restActiveRef    = useRef(false);
  const pausedRef        = useRef(false);
  const voiceCmdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSetRef    = useRef(1);
  const exIdxRef         = useRef(0);
  const coachRef      = useRef({
    introSpoken: false, setupDone: false,
    introSpokenAt: 0,     // timestamp when intro speech was started
    readyToDetect: false, // true only after intro finishes speaking
    lastCueTime: 0, lastEncouragementRep: -1,
    positionCuesSaid: 0,  // max 2 "step back" voice cues per session
    faceCuesSaid: 0,      // max 2 "move back face" voice cues per session
  });
  // Prevents the displayed cue text from changing more than once every 4 s
  const cueLockRef    = useRef(0);

  const ex = activeWorkoutRef.current.exercises[exIdx];

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
  }, []);

  const stopVoiceRecognition = useCallback(() => {
    listenActiveRef.current = false;
    try { recognitionRef.current?.abort(); } catch {}
    recognitionRef.current = null;
  }, []);

  // startVoiceRecognition is defined after advanceAfterRest (needs it in closure)

  // immediate=true bypasses the between-text gap (used for rep counts + urgent form cues)
  const speak = useCallback((text: string, immediate = false) => {
    if (mutedRef.current || !("speechSynthesis" in window)) return;
    const now = Date.now();
    const { text: last, time: lastTime } = lastSpeakRef.current;
    if (text === last && now - lastTime < 4000) return;           // same phrase: 4 s cooldown
    if (!immediate && now - lastTime < 1800) return;              // different phrase: 1.8 s gap
    lastSpeakRef.current = { text, time: now };
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05; u.pitch = 1; u.volume = 1;
    window.speechSynthesis.speak(u);
  }, []);

  const resetRep = useCallback(() => {
    repStateRef.current = {
      phase: "down", upPhaseCued: false,
      pressPhase: "READY_BOTTOM", topReached: false, topReachedAt: 0, topCueSpoken: false,
      peakWristY: 1.0,
      squatPhase: "STANDING" as SquatPhase,
      count: 0, badReps: 0, badFormThisRep: false, lastRepTime: 0, badFormSpoken: false,
      unevenFrames: 0, badFormType: "",
    };
    // Preserve session-level cue counts across set changes
    coachRef.current = {
      introSpoken: false, setupDone: false,
      introSpokenAt: 0, readyToDetect: false,
      lastCueTime: 0, lastEncouragementRep: -1,
      positionCuesSaid: coachRef.current.positionCuesSaid,
      faceCuesSaid: coachRef.current.faceCuesSaid,
    };
    cueLockRef.current = 0;
    cornerStatusRef.current = "neutral";
    setReps(0); setFormCue(""); setFormStatus("neutral"); setRepFlash(null);
    setNoBody(false); setCornerStatus("neutral");
  }, []);

  const exitCamera = useCallback(() => {
    stopCamera();
    stopVoiceRecognition();
    if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; }
    restActiveRef.current = false;
    setRestActive(false);
    setPermState("idle"); setMpLoading(true); setExIdx(0); setCurrentSet(1);
    resetRep(); setScreen("workout");
  }, [stopCamera, stopVoiceRecognition, resetRep]);

  // Fresh camera session: reset cue counts so step-back prompts start from 0
  useEffect(() => {
    if (permState === "granted") {
      coachRef.current.positionCuesSaid = 0;
      coachRef.current.faceCuesSaid     = 0;
    }
  }, [permState]);

  const requestCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,   // request mic at the same time so one permission prompt covers both
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPermState("granted");
    } catch { setPermState("denied"); }
  }, []);

  useEffect(() => { if (screen !== "camera") stopCamera(); }, [screen, stopCamera]);

  // Check localStorage once on mount (safe from SSR because it's inside useEffect)
  useEffect(() => {
    // ?reset clears the flag so onboarding shows again (handy for demos/sharing)
    if (window.location.search.includes("reset")) {
      localStorage.removeItem("upform_onboarded");
      localStorage.removeItem("upform_name");
    }
    setOnboarded(localStorage.getItem("upform_onboarded") === "true");
    setUserName(localStorage.getItem("upform_name") || "");
    const savedDays = localStorage.getItem("upform_selected_days");
    if (savedDays) setSelectedDays(JSON.parse(savedDays));
    const savedDPW = localStorage.getItem("upform_days_per_week");
    if (savedDPW) setDaysPerWeek(parseInt(savedDPW));
    const savedCount = localStorage.getItem("upform_workout_count");
    if (savedCount) setWorkoutCount(parseInt(savedCount));
    const savedStreak = localStorage.getItem("upform_streak");
    if (savedStreak) setStreak(parseInt(savedStreak));
  }, []);

  // Keep refs in sync so async callbacks (intervals) read fresh values
  useEffect(() => { currentSetRef.current = currentSet; }, [currentSet]);
  useEffect(() => { exIdxRef.current = exIdx; },           [exIdx]);

  // Advance to the next set / exercise after rest
  const advanceAfterRest = useCallback(() => {
    if (restIntervalRef.current) { clearInterval(restIntervalRef.current); restIntervalRef.current = null; }
    restActiveRef.current = false;
    setRestActive(false);
    const curSet   = currentSetRef.current;
    const curExIdx = exIdxRef.current;
    const curEx    = activeWorkoutRef.current.exercises[curExIdx];
    resetRep();
    if (curSet < curEx.sets) {
      speak(`Set ${curSet + 1}. Let's go!`, true);
      setCurrentSet(s => s + 1);
    } else if (curExIdx < activeWorkoutRef.current.exercises.length - 1) {
      speak(`Next exercise: ${activeWorkoutRef.current.exercises[curExIdx + 1].name}. Let's go!`, true);
      setExIdx(i => i + 1);
      setCurrentSet(1);
    } else {
      speak("Workout complete! Great job today!", true);
      exitCamera();
    }
  }, [speak, resetRep, exitCamera]);

  const cancelVoiceCmd = useCallback(() => {
    if (voiceCmdTimerRef.current) { clearTimeout(voiceCmdTimerRef.current); voiceCmdTimerRef.current = null; }
    setVoiceCmd(null);
  }, []);

  const triggerVoiceCmd = useCallback((label: string, icon: string, action: () => void) => {
    if (voiceCmdTimerRef.current) clearTimeout(voiceCmdTimerRef.current);
    setVoiceCmd({ label, icon });
    voiceCmdTimerRef.current = setTimeout(() => {
      setVoiceCmd(null);
      action();
    }, 4000);
  }, []);

  const pauseWorkout = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
    speak("Paused. Say continue to resume.", true);
  }, [speak]);

  const resumeWorkout = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    speak("Resuming.", true);
  }, [speak]);

  const endWorkout = useCallback(() => {
    speak("Ending workout. Great job today!", true);
    setTimeout(() => exitCamera(), 1800);
  }, [speak, exitCamera]);

  const startVoiceRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || listenActiveRef.current) return;
    listenActiveRef.current = true;

    const listen = () => {
      if (!listenActiveRef.current) return;
      const r = new SR();
      r.continuous     = true;
      r.interimResults = false;
      r.lang           = "en-US";

      r.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            const text = e.results[i][0].transcript.toLowerCase();
            if (text.includes("skip")) {
              speak("Skipping set.", true);
              triggerVoiceCmd("Skipping set", "⏭", advanceAfterRest);
            } else if (text.includes("end workout") || text.includes("finish")) {
              speak("Ending workout.", true);
              triggerVoiceCmd("Ending workout", "🏁", exitCamera);
            } else if (text.includes("pause")) {
              speak("Pausing workout.", true);
              triggerVoiceCmd("Pausing workout", "⏸", pauseWorkout);
            } else if (text.includes("continue") || text.includes("resume") || text.includes("start")) {
              if (pausedRef.current) {
                speak("Resuming.", true);
                triggerVoiceCmd("Resuming", "▶", resumeWorkout);
              }
            }
          }
        }
      };

      r.onerror = (e: any) => {
        // If permission denied, stop trying
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          listenActiveRef.current = false;
        }
      };

      r.onend = () => {
        recognitionRef.current = null;
        // Auto-restart so we listen continuously (Chrome stops after ~60 s)
        if (listenActiveRef.current) setTimeout(listen, 300);
      };

      try {
        r.start();
        recognitionRef.current = r;
      } catch {
        // start() throws if already started; retry after a pause
        setTimeout(listen, 1000);
      }
    };

    listen();
  }, [speak, advanceAfterRest, pauseWorkout, resumeWorkout, exitCamera, triggerVoiceCmd]);

  // Show lateral-raises form tutorial when that exercise begins in the camera screen
  useEffect(() => {
    if (exIdx === 1 && screen === "camera" && permState === "granted") {
      setShowExerciseIntro(true);
      // Auto-hide once the voice intro + detection wait (~8 s) has elapsed
      const t = setTimeout(() => setShowExerciseIntro(false), 8500);
      return () => clearTimeout(t);
    } else {
      setShowExerciseIntro(false);
    }
  }, [exIdx, screen, permState]);

  // Show leg press muscle/placement intro when that exercise becomes active
  useEffect(() => {
    const curEx = activeWorkoutRef.current.exercises[exIdx];
    if (screen === "camera" && permState === "granted" && curEx?.type === "legpress") {
      setLegPressIntro(true);
    } else {
      setLegPressIntro(false);
    }
  }, [exIdx, screen, permState]);

  // Start voice recognition when camera is live; stop on exit
  useEffect(() => {
    if (screen === "camera" && permState === "granted") {
      startVoiceRecognition();
    } else {
      stopVoiceRecognition();
    }
    return () => stopVoiceRecognition();
  }, [screen, permState, startVoiceRecognition, stopVoiceRecognition]);

  // Trigger rest overlay once reps hit the target
  useEffect(() => {
    if (reps < ex.reps || restActive || screen !== "camera" || permState !== "granted") return;
    const t = setTimeout(() => {
      setLastSetStats({
        good:   repStateRef.current.count,
        bad:    repStateRef.current.badReps,
        target: ex.reps,
      });
      restActiveRef.current = true;
      setRestActive(true);
    }, 1400);
    return () => clearTimeout(t);
  }, [reps, ex.reps, restActive, screen, permState, ex.reps]);

  // Countdown timer
  useEffect(() => {
    if (!restActive) return;
    setRestSeconds(60);
    speak("Rest. One minute.", true);
    let secs = 60;
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      secs -= 1;
      setRestSeconds(secs);
      if (secs === 30) speak("30 seconds.", true);
      if (secs === 10) speak("Ten seconds.", true);
      if (secs <= 5 && secs > 0) speak(String(secs), true);
      if (secs <= 0) { clearInterval(interval); advanceAfterRest(); }
    }, 1000);
    restIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [restActive, advanceAfterRest, speak]);

  // Reset rep + coach state when exercise changes
  useEffect(() => {
    repStateRef.current   = {
      phase: "down", upPhaseCued: false,
      pressPhase: "READY_BOTTOM", topReached: false, topReachedAt: 0, topCueSpoken: false,
      peakWristY: 1.0,
      squatPhase: "STANDING" as SquatPhase,
      count: 0, badReps: 0, badFormThisRep: false, lastRepTime: 0, badFormSpoken: false,
      unevenFrames: 0, badFormType: "",
    };
    coachRef.current = {
      introSpoken: false, setupDone: false,
      introSpokenAt: 0, readyToDetect: false,
      lastCueTime: 0, lastEncouragementRep: -1,
      positionCuesSaid: coachRef.current.positionCuesSaid,
      faceCuesSaid: coachRef.current.faceCuesSaid,
    };
    cueLockRef.current      = 0;
    cornerStatusRef.current = "neutral";
    setCornerStatus("neutral");
  }, [exIdx]);

  // MediaPipe detection loop
  useEffect(() => {
    if (screen !== "camera" || permState !== "granted") return;
    let active = true;

    const analyze = (lm: any[], canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const exercise  = activeWorkoutRef.current.exercises[exIdx];
      if (exercise.type === "legpress") return; // manual counting, no pose detection
      const L         = { sh: lm[11], el: lm[13], wr: lm[15], hip: lm[23], kn: lm[25], ank: lm[27] };
      const R         = { sh: lm[12], el: lm[14], wr: lm[16], hip: lm[24], kn: lm[26], ank: lm[28] };
      const visible   = exercise.type === "squat"
        ? [L.sh, R.sh, L.hip, R.hip, L.kn, R.kn].every(p => p && p.visibility > 0.3)
        : [L.sh, R.sh, L.el, R.el, L.wr, R.wr].every(p => p && p.visibility > 0.35);
      // speak + coachRef are stable refs, safe in this closure
      const speakFn   = speak;
      const coach     = coachRef.current;
      const rs        = repStateRef.current;
      const nowMs     = performance.now();

      // Show cue text only if 4 s have passed since the last change
      const showCue = (text: string, status: FormStatus = "neutral") => {
        const nowD = Date.now();
        if (nowD > cueLockRef.current) {
          cueLockRef.current = nowD + 4000;
          setFormCue(text);
          setFormStatus(status);
        }
      };

      // ── STEP 1: Position & visibility guidance ─────────────────
      if (!visible) {
        setNoBody(true);
        showCue(exercise.type === "squat" ? "Step back, need to see full body" : "Keep upper body visible");
        if (nowMs - coach.lastCueTime > 5000 && coach.positionCuesSaid < 2) {
          coach.lastCueTime = nowMs;
          coach.positionCuesSaid++;
          speakFn(exercise.type === "squat"
            ? "Step back so I can see your full body. Hips and knees need to be visible."
            : "Step back and face the camera. I need to see your shoulders, arms, and hands.");
        }
        return;
      }
      setNoBody(false);

      // Check face visibility (nose landmark)
      const faceVisible = lm[0] && lm[0].visibility > 0.42;
      if (!faceVisible && !coach.setupDone) {
        if (nowMs - coach.lastCueTime > 4500 && coach.faceCuesSaid < 2) {
          coach.lastCueTime = nowMs;
          coach.faceCuesSaid++;
          speakFn("Move back a little, I need to see your face too.");
        }
        showCue("Move back so I can see your face");
        return;
      }

      // ── STEP 2: Exercise intro (once per exercise) ─────────────
      if (!coach.introSpoken) {
        coach.introSpoken   = true;
        coach.setupDone     = true;
        coach.introSpokenAt = nowMs;
        coach.readyToDetect = false;
        coach.lastCueTime   = nowMs;
        if (exercise.type === "press") {
          speakFn(
            "Great, I can see you. Starting Shoulder Press. " +
            "Hold weights at shoulder height, elbows out. " +
            "Press straight up until arms are extended, then lower slowly back to shoulder height. Go!"
          );
        } else if (exercise.type === "squat") {
          speakFn(
            "Squats. Feet shoulder-width apart, toes slightly out. " +
            "Sit back and down until thighs are parallel, then drive through your heels to stand. Go!"
          );
        } else {
          speakFn(
            "Lateral Raises. Arms at your sides. " +
            "Raise both arms out to shoulder height, slight bend in the elbows, then lower slowly. Go!"
          );
        }
        showCue("", "neutral");
        return;
      }

      // ── STEP 2.5: Wait for intro speech to finish ──────────────
      if (!coach.readyToDetect) {
        const sinceIntro = nowMs - coach.introSpokenAt;
        const speechDone = typeof window !== "undefined"
          && !window.speechSynthesis?.speaking;
        if (sinceIntro > 2000 && speechDone) {
          coach.readyToDetect = true;
          showCue("", "neutral");
        } else {
          // Still speaking the intro, no form lines yet
          showCue("", "neutral");
          return;
        }
      }

      // ── STEP 3: Form lines + detection ────────────────────────
      const W  = canvas.width, H = canvas.height;
      const wy = (L.wr.y + R.wr.y) / 2;
      const sy = (L.sh.y + R.sh.y) / 2;
      let rep  = false, cue = "", bad = false;
      const prevPhase = rs.phase;

      if (exercise.type === "raise") {
        // Only flag "too high" if wrists are clearly above shoulder, 0.08 gap
        const tooHigh = wy < sy - 0.08;
        const lineY   = sy * H;

        // Horizontal guide at shoulder height
        ctx.save();
        ctx.setLineDash([12, 8]);
        ctx.lineWidth   = 2;
        ctx.strokeStyle = tooHigh ? "rgba(255,80,80,.85)" : "rgba(255,200,80,.8)";
        ctx.beginPath();
        ctx.moveTo(W * 0.04, lineY);
        ctx.lineTo(W * 0.96, lineY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "bold 13px system-ui";
        ctx.fillStyle = tooHigh ? "rgba(255,80,80,.9)" : "rgba(255,200,80,.9)";
        ctx.fillText("shoulder height, stop here", W * 0.05, lineY - 8);
        ctx.restore();

        // Phase transitions
        if (rs.phase === "down" && wy < sy + 0.03) rs.phase = "up";
        if (rs.phase === "up"   && wy > sy + 0.18) { rep = true; rs.phase = "down"; }

        // Cue once when arms reach the up phase
        if (prevPhase === "down" && rs.phase === "up" && !rs.upPhaseCued) {
          rs.upPhaseCued = true;
          speakFn("Now lower slowly back down.", true);
        }

        if (tooHigh) {
          bad = true; rs.badFormThisRep = true; rs.badFormType = "tooHigh";
          cue = "Stop at shoulder height ↓";
          if (!rs.badFormSpoken) {
            rs.badFormSpoken = true;
            speakFn("Too high! Stop at shoulder height, then lower slowly.", true);
          }
        } else {
          cue = rs.phase === "up" ? "Now lower slowly" : "Raise arms to shoulder height";
        }

      } else if (exercise.type === "press") {
        // ── 5-STATE SHOULDER PRESS MACHINE ───────────────────────
        const angL   = calcAngle(L.sh, L.el, L.wr);
        const angR   = calcAngle(R.sh, R.el, R.wr);
        const angAvg = (angL + angR) / 2;

        // Frame-persistent uneven check (10 frames ≈ 0.33 s, threshold 0.10)
        const rawUneven = Math.abs(L.wr.y - R.wr.y) > 0.10;
        rs.unevenFrames = rawUneven ? rs.unevenFrames + 1 : Math.max(0, rs.unevenFrames - 2);
        const uneven = rs.unevenFrames >= 10;

        // Phase criteria
        // Bottom: elbows 65–112°, wrists within 8% below / 5% above shoulder
        const isValidBottom = angAvg >= 65 && angAvg <= 112
          && wy >= sy - 0.05 && wy <= sy + 0.08;
        // Top: elbows ≥ 145°, wrists ≥ 10% above shoulders
        const isTop = angAvg >= 145 && wy < sy - 0.10;
        // Danger: wrists dropped >9% below shoulder
        const tooLow = wy > sy + 0.09;

        const prevPressPhase = rs.pressPhase;

        // State machine
        switch (rs.pressPhase) {
          case "READY_BOTTOM":
            // Wrist-based: start tracking once wrists lift above shoulder
            if (wy < sy - 0.05 && angAvg > 85) {
              rs.pressPhase = "PRESSING_UP";
              rs.peakWristY = wy; // seed peak
            }
            break;

          case "PRESSING_UP":
            if (wy < rs.peakWristY) rs.peakWristY = wy; // track highest point
            if (isTop) {
              rs.pressPhase   = "TOP_REACHED";
              rs.topReached   = true;
              rs.topReachedAt = nowMs;
              rs.topCueSpoken = false;
            } else if (wy >= sy - 0.01 && angAvg < 120) {
              rs.pressPhase = "READY_BOTTOM";
              rs.peakWristY = 1.0;
              if (!rs.badFormSpoken) {
                rs.badFormSpoken = true; rs.badFormType = "incomplete";
                speakFn("Extend your arms fully before coming back down.", true);
              }
            }
            break;

          case "TOP_REACHED":
            if (wy < rs.peakWristY) rs.peakWristY = wy; // keep tracking peak
            if (!rs.topCueSpoken && nowMs - rs.topReachedAt >= 2000) {
              rs.topCueSpoken = true;
              speakFn("Okay, now lower it down slowly.", true);
            }
            // Move to LOWERING once wrist drops 6 % from its actual peak
            if (wy > rs.peakWristY + 0.06) rs.pressPhase = "LOWERING";
            break;

          case "LOWERING":
            // Rep counted once wrist drops 10 % from its peak.
            // For a strong press (peak ≈ 0.22 with sy=0.5) this fires at ≈ 0.32
            // well inside the visible top-zone box, "between the top line".
            if (wy > rs.peakWristY + 0.10 && rs.topReached) {
              rep             = true;
              rs.pressPhase   = "READY_BOTTOM";
              rs.topReached   = false;
              rs.topCueSpoken = false;
              rs.peakWristY   = 1.0;
            }
            break;
        }

        // Speak "Press up!" once when pressing starts
        if (prevPressPhase === "READY_BOTTOM" && rs.pressPhase === "PRESSING_UP") {
          speakFn("Press up!", true);
        }

        // Bad form cues (override cue text)
        if (tooLow) {
          bad = true; rs.badFormThisRep = true; rs.badFormType = "tooLow";
          cue = "Don't drop too low, return to shoulder height";
          if (!rs.badFormSpoken) {
            rs.badFormSpoken = true;
            speakFn("Too low! Return to shoulder height.", true);
          }
        } else if (uneven) {
          bad = true; rs.badFormThisRep = true; rs.badFormType = "uneven";
          cue = "Keep both arms even";
          if (!rs.badFormSpoken) {
            rs.badFormSpoken = true;
            speakFn("Your arms aren't level, press both hands evenly.", true);
          }
        } else {
          const cueMap: Record<PressPhase, string> = {
            "READY_BOTTOM" : "Weights at shoulder height, press up",
            "PRESSING_UP"  : "Keep pressing, extend fully",
            "TOP_REACHED"  : "Full extension, now lower slowly",
            "LOWERING"     : "Lower to shoulder height",
          };
          cue = cueMap[rs.pressPhase];
        }

        // ── CANVAS: target zones ──────────────────────────────────
        // Bottom zone band
        const bzTop = (sy - 0.03) * H;
        const bzBot = (sy + 0.08) * H;
        ctx.save();
        ctx.fillStyle   = isValidBottom ? "rgba(80,220,130,.18)" : "rgba(255,200,80,.09)";
        ctx.strokeStyle = isValidBottom ? "rgba(80,220,130,.55)" : "rgba(255,200,80,.38)";
        ctx.lineWidth   = 1.5; ctx.setLineDash([6, 4]);
        ctx.fillRect(W * 0.04, bzTop, W * 0.92, bzBot - bzTop);
        ctx.strokeRect(W * 0.04, bzTop, W * 0.92, bzBot - bzTop);
        ctx.setLineDash([]);
        ctx.font = "bold 11px system-ui";
        ctx.fillStyle = isValidBottom ? "rgba(80,220,130,.9)" : "rgba(255,200,80,.75)";
        ctx.fillText("lower to here", W * 0.06, bzTop - 5);
        ctx.restore();

        // Top zone band
        const tzBot = (sy - 0.10) * H;
        const tzTop = Math.max(0, (sy - 0.22) * H);
        ctx.save();
        ctx.fillStyle   = isTop ? "rgba(80,220,130,.16)" : "rgba(255,200,80,.07)";
        ctx.strokeStyle = isTop ? "rgba(80,220,130,.5)"  : "rgba(255,200,80,.28)";
        ctx.lineWidth   = 1.5; ctx.setLineDash([6, 4]);
        ctx.fillRect(W * 0.04, tzTop, W * 0.92, tzBot - tzTop);
        ctx.strokeRect(W * 0.04, tzTop, W * 0.92, tzBot - tzTop);
        ctx.setLineDash([]);
        ctx.font = "bold 11px system-ui";
        ctx.fillStyle = isTop ? "rgba(80,220,130,.9)" : "rgba(255,200,80,.65)";
        ctx.fillText("press to here", W * 0.06, tzTop + 14);
        ctx.restore();

        // ── CANVAS: arm lines along landmarks ────────────────────
        const armColor = (tooLow || uneven)
          ? "rgba(255,60,60,.92)"
          : (rs.pressPhase === "TOP_REACHED" || isValidBottom)
            ? "rgba(80,220,130,.92)"
            : "rgba(255,200,80,.92)";

        const drawArmLines = (sh: any, el: any, wr: any) => {
          ctx.save();
          ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.strokeStyle = armColor;
          ctx.beginPath(); ctx.moveTo(sh.x*W, sh.y*H); ctx.lineTo(el.x*W, el.y*H); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(el.x*W, el.y*H); ctx.lineTo(wr.x*W, wr.y*H); ctx.stroke();
          // Joints: shoulder + wrist white, elbow arm-color
          const joints = [{ pt: sh, r: 5, c: "white" }, { pt: el, r: 8, c: armColor }, { pt: wr, r: 5, c: "white" }];
          joints.forEach(({ pt, r, c }) => {
            ctx.beginPath(); ctx.fillStyle = c;
            ctx.arc(pt.x*W, pt.y*H, r, 0, Math.PI*2); ctx.fill();
          });
          ctx.restore();
        };
        drawArmLines(L.sh, L.el, L.wr);
        drawArmLines(R.sh, R.el, R.wr);

        // Elbow angle arcs on both sides
        const elbowPairs = [{ el: L.el, ang: angL }, { el: R.el, ang: angR }];
        elbowPairs.forEach(({ el, ang }) => {
          ctx.save();
          ctx.lineWidth   = 3;
          ctx.strokeStyle = ang >= 145 ? "rgba(80,220,130,.9)"
            : ang <= 110 ? "rgba(80,220,130,.85)" : "rgba(255,200,80,.9)";
          ctx.beginPath();
          ctx.arc(el.x*W, el.y*H, 22, -Math.PI/2, -Math.PI/2 + (ang*Math.PI)/180);
          ctx.stroke();
          ctx.font = "bold 12px system-ui"; ctx.fillStyle = "white";
          ctx.fillText(`${Math.round(ang)}°`, el.x*W + 26, el.y*H + 5);
          ctx.restore();
        });

      } else if (exercise.type === "squat") {
        // ── SQUAT DETECTION ──────────────────────────────────────
        const lowerVisible = [L.ank, R.ank].every(p => p && p.visibility > 0.25);
        if (!lowerVisible) {
          showCue("Step back, need to see ankles too");
          return;
        }

        const angL     = calcAngle(L.hip, L.kn, L.ank);
        const angR     = calcAngle(R.hip, R.kn, R.ank);
        const kneeAvg  = (angL + angR) / 2;

        // Knee cave: knees narrower than 75% of ankle width
        const kneesW   = Math.abs(L.kn.x - R.kn.x);
        const anksW    = Math.abs(L.ank.x - R.ank.x);
        const kneeCave = anksW > 0.05 && kneesW < anksW * 0.75;

        const prevSquatPhase = rs.squatPhase;
        switch (rs.squatPhase) {
          case "STANDING":
            if (kneeAvg < 145) rs.squatPhase = "DESCENDING";
            break;
          case "DESCENDING":
            if (kneeAvg < 110)  rs.squatPhase = "BOTTOM";
            else if (kneeAvg > 160) rs.squatPhase = "STANDING";
            break;
          case "BOTTOM":
            if (kneeAvg > 120)  rs.squatPhase = "ASCENDING";
            break;
          case "ASCENDING":
            if (kneeAvg > 145) { rep = true; rs.squatPhase = "STANDING"; }
            break;
        }

        if (prevSquatPhase !== "BOTTOM" && rs.squatPhase === "BOTTOM") {
          speakFn("Good depth, drive through your heels.", true);
        }

        if (kneeCave) {
          bad = true; rs.badFormThisRep = true; rs.badFormType = "kneeCave";
          cue = "Push knees out, track over toes";
          if (!rs.badFormSpoken) {
            rs.badFormSpoken = true;
            speakFn("Push your knees out, track them over your toes.", true);
          }
        } else {
          const cueMap: Record<SquatPhase, string> = {
            "STANDING"   : "Sit back and down, reach depth",
            "DESCENDING" : "Keep going, reach parallel",
            "BOTTOM"     : "Good depth, drive through heels",
            "ASCENDING"  : "Stand tall, squeeze glutes",
          };
          cue = cueMap[rs.squatPhase];
        }

        // ── CANVAS: depth target line at knee height ──────────────
        const kny      = (L.kn.y + R.kn.y) / 2;
        const atDepth  = rs.squatPhase === "BOTTOM" || rs.squatPhase === "ASCENDING";
        const lineY    = kny * H;
        ctx.save();
        ctx.setLineDash([12, 8]);
        ctx.lineWidth   = 2;
        ctx.strokeStyle = atDepth ? "rgba(80,220,130,.85)" : "rgba(255,200,80,.8)";
        ctx.beginPath();
        ctx.moveTo(W * 0.04, lineY); ctx.lineTo(W * 0.96, lineY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font      = "bold 13px system-ui";
        ctx.fillStyle = atDepth ? "rgba(80,220,130,.9)" : "rgba(255,200,80,.9)";
        ctx.fillText("squat to here", W * 0.05, lineY - 8);
        ctx.restore();

        // ── CANVAS: leg lines hip → knee → ankle ─────────────────
        const legColor = kneeCave ? "rgba(255,60,60,.92)"
          : atDepth ? "rgba(80,220,130,.92)" : "rgba(255,200,80,.92)";

        const drawLegLines = (hip: any, kn: any, ank: any) => {
          ctx.save();
          ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.strokeStyle = legColor;
          ctx.beginPath(); ctx.moveTo(hip.x*W, hip.y*H); ctx.lineTo(kn.x*W, kn.y*H); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(kn.x*W,  kn.y*H);  ctx.lineTo(ank.x*W, ank.y*H); ctx.stroke();
          [{ pt: hip, r: 5, c: "white" }, { pt: kn, r: 8, c: legColor }, { pt: ank, r: 5, c: "white" }]
            .forEach(({ pt, r, c }) => {
              ctx.beginPath(); ctx.fillStyle = c;
              ctx.arc(pt.x*W, pt.y*H, r, 0, Math.PI*2); ctx.fill();
            });
          ctx.restore();
        };
        drawLegLines(L.hip, L.kn, L.ank);
        drawLegLines(R.hip, R.kn, R.ank);

        // ── CANVAS: knee angle arcs ───────────────────────────────
        [{ kn: L.kn, ang: angL }, { kn: R.kn, ang: angR }].forEach(({ kn, ang }) => {
          ctx.save();
          ctx.lineWidth   = 3;
          ctx.strokeStyle = ang <= 92 ? "rgba(80,220,130,.9)" : "rgba(255,200,80,.9)";
          ctx.beginPath();
          ctx.arc(kn.x*W, kn.y*H, 22, -Math.PI/2, -Math.PI/2 + (ang * Math.PI) / 180);
          ctx.stroke();
          ctx.font = "bold 12px system-ui"; ctx.fillStyle = "white";
          ctx.fillText(`${Math.round(ang)}°`, kn.x*W + 26, kn.y*H + 5);
          ctx.restore();
        });
      }

      // Update corner vignette
      const newCorner: "good"|"bad"|"neutral" = bad
        ? "bad"
        : exercise.type === "raise"
          ? (rs.phase === "up" ? "good" : "neutral")
          : exercise.type === "squat"
            ? (rs.squatPhase === "BOTTOM" || rs.squatPhase === "ASCENDING" ? "good" : "neutral")
            : (rs.pressPhase === "TOP_REACHED" || rs.pressPhase === "PRESSING_UP" ? "good" : "neutral");
      if (newCorner !== cornerStatusRef.current) {
        cornerStatusRef.current = newCorner;
        setCornerStatus(newCorner);
      }

      showCue(cue, bad ? "bad" : "good");

      // ── STEP 4: Prompt when paused ─────────────────────────────
      const pressIdle = exercise.type === "press" && rs.pressPhase === "READY_BOTTOM";
      const raiseIdle = exercise.type === "raise" && rs.phase === "down";
      const squatIdle = exercise.type === "squat" && rs.squatPhase === "STANDING";
      if (!rep && (pressIdle || raiseIdle || squatIdle) && nowMs - coach.lastCueTime > 7000) {
        coach.lastCueTime = nowMs;
        speakFn(rs.count === 0
          ? (exercise.type === "press"
              ? "When you're ready, press those weights straight up above your head."
              : exercise.type === "squat"
                ? "When you're ready, sit back and squat down to parallel."
                : "When you're ready, raise your arms out to shoulder height.")
          : (exercise.type === "press"
              ? "Ready for the next rep? Brace your core and press up."
              : exercise.type === "squat"
                ? "Ready for the next rep? Brace your core and squat down."
                : "Next rep, lift your arms out to the sides."));
      }

      // ── STEP 5: Count rep + voice + milestones ─────────────────
      if (rep) {
        const now = performance.now();
        if (now - rs.lastRepTime > 500) {
          rs.lastRepTime = now;
          const wasBad  = rs.badFormThisRep;
          const badType = rs.badFormType;

          // Always reset form + press state for the next rep
          rs.badFormThisRep = false; rs.badFormSpoken = false;
          rs.badFormType    = ""; rs.upPhaseCued = false; rs.phase = "down";
          rs.pressPhase     = "READY_BOTTOM"; rs.topReached = false; rs.topCueSpoken = false; rs.peakWristY = 1.0;
          rs.squatPhase     = "STANDING";
          coach.lastCueTime = now;

          setRepFlash(wasBad ? "bad" : "good");
          setTimeout(() => setRepFlash(null), 800);

          if (wasBad) {
            // ── BAD REP: don't count, ask them to redo ──
            rs.badReps += 1;
            speakFn("Wrong rep. Try again.", true);
            // Counter stays the same, no setReps call
          } else {
            // ── GOOD REP: count it ──
            rs.count += 1;
            setReps(rs.count);
            speakFn("Good rep!", true);

            const half = Math.floor(exercise.reps / 2);
            if (rs.count === 3 && coach.lastEncouragementRep < 3) {
              coach.lastEncouragementRep = 3;
              setTimeout(() => speakFn("Good rhythm, keep going."), 1000);
            } else if (rs.count === half && coach.lastEncouragementRep < half) {
              coach.lastEncouragementRep = half;
              setTimeout(() => speakFn("Halfway! Keep it up."), 1000);
            } else if (rs.count === exercise.reps - 2 && coach.lastEncouragementRep < exercise.reps - 2) {
              coach.lastEncouragementRep = exercise.reps - 2;
              setTimeout(() => speakFn("Two more."), 1000);
            } else if (rs.count === exercise.reps - 1 && coach.lastEncouragementRep < exercise.reps - 1) {
              coach.lastEncouragementRep = exercise.reps - 1;
              setTimeout(() => speakFn("Last one, make it count!"), 1000);
            }

            if (rs.count >= exercise.reps) {
              speakFn("Set complete!", true);
            }
          }
        }
      }
    };

    const startLoop = (detector: any, PL: any, DU: any) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      const ctx = canvas.getContext("2d")!;
      const du = new DU(ctx);
      let lastTime = -1;

      const loop = () => {
        if (!active) return;
        if (video.readyState >= 2 && video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          canvas.width  = video.videoWidth  || 1280;
          canvas.height = video.videoHeight || 720;

          // During rest or pause: clear skeleton but don't run detection
          if (restActiveRef.current || pausedRef.current) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            animRef.current = requestAnimationFrame(loop);
            return;
          }

          const result = detector.detectForVideo(video, performance.now());
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (result.landmarks?.[0]) {
            du.drawConnectors(result.landmarks[0], PL.POSE_CONNECTIONS,
              { color: "rgba(101,199,131,.75)", lineWidth: 3 });
            du.drawLandmarks(result.landmarks[0], { color: "#ffffffcc", radius: 4 });
            analyze(result.landmarks[0], canvas, ctx);
          } else {
            if (active) {
              setNoBody(true); setFormCue("Step into frame");
              const coach = coachRef.current;
              const now = performance.now();
              if (now - coach.lastCueTime > 5000 && coach.positionCuesSaid < 2) {
                coach.lastCueTime = now;
                coach.positionCuesSaid++;
                speak("Step back and face the camera. I need to see your full upper body.");
              }
            }
          }
        }
        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);
    };

    (async () => {
      const w = window as any;

      // Suppress MediaPipe's TFLite XNNPACK info logs (expected, not errors)
      if (!w.__mpConsoleSuppressed) {
        w.__mpConsoleSuppressed = true;
        const _info = console.info.bind(console);
        console.info = (...args: any[]) => {
          const msg = String(args[0] ?? "");
          if (msg.includes("TensorFlow Lite") || msg.includes("XNNPACK") || msg.includes("delegate")) return;
          _info(...args);
        };
      }

      if (!w.__mpLoaded) {
        await new Promise<void>(resolve => {
          const s = document.createElement("script");
          s.type = "module";
          s.textContent = `
            import{PoseLandmarker,FilesetResolver,DrawingUtils}
              from'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
            window.__mpPL=PoseLandmarker;
            window.__mpFR=FilesetResolver;
            window.__mpDU=DrawingUtils;
            window.__mpLoaded=true;
            document.dispatchEvent(new Event('mpready'));
          `;
          document.addEventListener("mpready", () => resolve(), { once: true });
          document.head.appendChild(s);
        });
      }
      if (!active) return;

      const vision = await w.__mpFR.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      const detector = await w.__mpPL.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      if (!active) return;
      setMpLoading(false);
      startLoop(detector, w.__mpPL, w.__mpDU);
    })().catch(err => {
      console.error("MediaPipe load failed:", err);
      if (active) { setMpLoading(false); setFormCue("AI tracking unavailable"); }
    });

    return () => {
      active = false;
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    };
  }, [screen, permState, exIdx]);

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - todayIdx + i);
    return d;
  });

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.name && Array.isArray(data.exercises)) {
          localStorage.setItem("upform_custom_workout", JSON.stringify(data));
          activeWorkoutRef.current = data;
          alert(`Imported: ${data.name}`);
        } else {
          alert("Invalid format. Expected { name, exercises[] }.");
        }
      } catch { alert("Could not parse file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const startRoutine = useCallback((workout: typeof WORKOUTS[0], from: Screen = "home") => {
    prevScreenRef.current = from;
    activeWorkoutRef.current = workout;
    setScreen("workout");
  }, []);

  /* ─── ONBOARDING ───────────────────────────────────────── */
  if (onboarded === null) return null;

  if (!onboarded) {
    const finish = () => {
      if (userName.trim()) localStorage.setItem("upform_name", userName.trim());
      localStorage.setItem("upform_onboarded", "true");
      localStorage.setItem("upform_selected_days", JSON.stringify(selectedDays));
      localStorage.setItem("upform_days_per_week", String(daysPerWeek));
      setOnboarded(true);
    };

    // ── Loader (step 11): auto-advances after 4.5 s ──
    if (onboardStep === 11) {
      return (
        <_LoaderScreen onDone={finish} />
      );
    }

    // ── Profile screens (steps 5–8): height / weight / age / goals ──
    if (onboardStep >= 5 && onboardStep <= 8) {
      const profileIdx  = onboardStep - 5; // 0–3
      const isLastProf  = profileIdx === 3;
      const GOALS = ["Build Muscle","Lose Weight","Improve Endurance","Better Form","Stay Active"];

      const advanceProfile = () => {
        if (isLastProf) { setOnboardStep(9); }  // → schedule step
        else            { setOnboardStep(s => s + 1); }
      };

      const toggleGoal = (g: string) =>
        setSelectedGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

      return (
        <div className="app">
          <div className="mobile-frame" style={{
            display:"flex", flexDirection:"column",
            padding:"56px 32px 44px", justifyContent:"space-between", minHeight:"100vh",
          }}>
            {/* Header */}
            <div>
              <button onClick={() => setOnboardStep(s => s - 1)} style={{
                background:"none", border:"none", padding:0, marginBottom:32,
                color:"var(--color-muted-ash)", fontSize:22, cursor:"pointer",
              }}>←</button>

              <p style={{ fontSize:13, fontWeight:700, textTransform:"uppercase",
                letterSpacing:".12em", color:"var(--color-forest-canopy)",
                margin:"0 0 8px" }}>
                Hi {userName.trim() || "there"}
              </p>
              <h2 style={{ fontSize:28, fontWeight:700, letterSpacing:"-.02em",
                color:"var(--color-ink)", margin:"0 0 6px" }}>
                {profileIdx === 0 && "How tall are you?"}
                {profileIdx === 1 && "What do you weigh?"}
                {profileIdx === 2 && "How old are you?"}
                {profileIdx === 3 && "What are your main goals?"}
              </h2>
              <p style={{ fontSize:14, color:"var(--color-muted-ash)", margin:"0 0 36px" }}>
                {profileIdx === 0 && "We use this to calibrate your movement tracking."}
                {profileIdx === 1 && "This helps us set the right intensity for your workouts."}
                {profileIdx === 2 && "Age helps us tailor recovery time and exercise selection."}
                {profileIdx === 3 && "Select your goals and we'll build a custom plan around them."}
              </p>

              {/* ── Height ── */}
              {profileIdx === 0 && (
                <div>
                  <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                    {(["cm","ft"] as const).map(u => (
                      <button key={u} onClick={() => setHeightUnit(u)} style={{
                        flex:1, height:40, borderRadius:12, fontSize:14, fontWeight:600,
                        border:"1.5px solid",
                        borderColor: heightUnit === u ? "var(--color-forest-canopy)" : "var(--color-stone)",
                        background: heightUnit === u ? "var(--color-forest-canopy)" : "transparent",
                        color:"var(--color-ink)",
                      }}>{u}</button>
                    ))}
                  </div>
                  <input
                    type="number" value={heightVal}
                    onChange={e => setHeightVal(e.target.value)}
                    placeholder={heightUnit === "cm" ? "e.g. 175" : "e.g. 5.9"}
                    style={{
                      width:"100%", height:56, borderRadius:14, border:"1.5px solid var(--color-stone)",
                      padding:"0 18px", fontSize:18, fontWeight:500, outline:"none",
                      background:"transparent", color:"var(--color-ink)",
                    }}
                  />
                </div>
              )}

              {/* ── Weight ── */}
              {profileIdx === 1 && (
                <div>
                  <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                    {(["kg","lbs"] as const).map(u => (
                      <button key={u} onClick={() => setWeightUnit(u)} style={{
                        flex:1, height:40, borderRadius:12, fontSize:14, fontWeight:600,
                        border:"1.5px solid",
                        borderColor: weightUnit === u ? "var(--color-forest-canopy)" : "var(--color-stone)",
                        background: weightUnit === u ? "var(--color-forest-canopy)" : "transparent",
                        color:"var(--color-ink)",
                      }}>{u}</button>
                    ))}
                  </div>
                  <input
                    type="number" value={weightVal}
                    onChange={e => setWeightVal(e.target.value)}
                    placeholder={weightUnit === "kg" ? "e.g. 70" : "e.g. 154"}
                    style={{
                      width:"100%", height:56, borderRadius:14, border:"1.5px solid var(--color-stone)",
                      padding:"0 18px", fontSize:18, fontWeight:500, outline:"none",
                      background:"transparent", color:"var(--color-ink)",
                    }}
                  />
                </div>
              )}

              {/* ── Age ── */}
              {profileIdx === 2 && (
                <input
                  type="number" value={ageVal}
                  onChange={e => setAgeVal(e.target.value)}
                  placeholder="e.g. 28"
                  style={{
                    width:"100%", height:56, borderRadius:14, border:"1.5px solid var(--color-stone)",
                    padding:"0 18px", fontSize:18, fontWeight:500, outline:"none",
                    background:"transparent", color:"var(--color-ink)",
                  }}
                />
              )}

              {/* ── Goals ── */}
              {profileIdx === 3 && (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {GOALS.map(g => {
                    const active = selectedGoals.includes(g);
                    return (
                      <button key={g} onClick={() => toggleGoal(g)} style={{
                        width:"100%", height:52, borderRadius:14, fontSize:15, fontWeight:600,
                        textAlign:"left", padding:"0 18px",
                        border:"1.5px solid",
                        borderColor: active ? "var(--color-forest-canopy)" : "var(--color-stone)",
                        background: active ? "var(--color-forest-canopy)" : "transparent",
                        color:"var(--color-ink)", cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                      }}>
                        {g}
                        {active && <span style={{ fontSize:16 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Progress dots */}
            <div style={{ paddingTop:32 }}>
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:24 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    height:6, borderRadius:3, transition:"width .3s",
                    width: i === profileIdx ? 24 : 6,
                    background: i === profileIdx ? "var(--color-forest-canopy)" : "var(--color-stone)",
                  }}/>
                ))}
              </div>

              <button onClick={advanceProfile} style={{
                width:"100%", height:54, background:"var(--color-forest-canopy)",
                border:"none", borderRadius:16, fontSize:17, fontWeight:700,
                color:"var(--color-ink)", cursor:"pointer", marginBottom:12,
              }}>
                {isLastProf ? "Build My Plan" : "Continue"}
              </button>
              <button onClick={advanceProfile} style={{
                background:"none", border:"none", color:"var(--color-muted-ash)",
                fontSize:14, fontWeight:500, cursor:"pointer", width:"100%",
              }}>
                Skip for now
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Step 9: How many days a week? ──
    if (onboardStep === 9) {
      const handleFreqSelect = (n: number) => {
        setDaysPerWeek(n);
        setSelectedDays([]);
        localStorage.setItem("workoutDaysCount", String(n));
        localStorage.setItem("upform_days_per_week", String(n));
      };
      return (
        <div className="app">
          <div className="mobile-frame" style={{
            display:"flex", flexDirection:"column",
            padding:"56px 32px 44px", justifyContent:"space-between", minHeight:"100vh",
          }}>
            <div>
              <button onClick={() => setOnboardStep(8)} style={{
                background:"none", border:"none", padding:0, marginBottom:32,
                color:"var(--color-muted-ash)", fontSize:22, cursor:"pointer",
              }}>←</button>
              <h2 style={{ fontSize:28, fontWeight:700, letterSpacing:"-.02em",
                color:"var(--color-ink)", margin:"0 0 12px" }}>
                How many days a week do you want to train?
              </h2>
              <p style={{ fontSize:14, color:"var(--color-muted-ash)", margin:"0 0 36px", lineHeight:1.6 }}>
                We'll build a plan around your schedule.
              </p>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                {[2,3,4,5].map(n => (
                  <button key={n} onClick={() => handleFreqSelect(n)} style={{
                    height:64, borderRadius:16, fontSize:22, fontWeight:800, cursor:"pointer",
                    background: daysPerWeek === n ? "var(--color-forest-canopy)" : "transparent",
                    border:`1.5px solid ${daysPerWeek === n ? "var(--color-forest-canopy)" : "var(--color-stone)"}`,
                    color: daysPerWeek === n ? "var(--color-ink)" : "var(--color-muted-ash)",
                    transition:".15s",
                  }}>
                    {n}
                  </button>
                ))}
              </div>
              <p style={{ fontSize:12, color:"var(--color-muted-ash)", marginTop:10, textAlign:"center" }}>
                days per week
              </p>
            </div>

            <div style={{ paddingTop:32 }}>
              <button
                onClick={() => { setSelectedDays([]); setDaysFullFlash(false); setOnboardStep(10); }}
                style={{
                  width:"100%", height:54, background:"var(--color-forest-canopy)",
                  border:"none", borderRadius:16, fontSize:17, fontWeight:700,
                  color:"var(--color-ink)", cursor:"pointer", marginBottom:12,
                }}>
                Next
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Step 10: Which days work best? ──
    if (onboardStep === 10) {
      const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const toggleDay = (idx: number) => {
        setSelectedDays(prev => {
          if (prev.includes(idx)) return prev.filter(d => d !== idx);
          if (prev.length >= daysPerWeek) {
            setDaysFullFlash(true);
            setTimeout(() => setDaysFullFlash(false), 2000);
            return prev;
          }
          return [...prev, idx];
        });
      };
      const canContinue = selectedDays.length === daysPerWeek;
      return (
        <div className="app">
          <div className="mobile-frame" style={{
            display:"flex", flexDirection:"column",
            padding:"56px 32px 44px", justifyContent:"space-between", minHeight:"100vh",
          }}>
            <div>
              <button onClick={() => setOnboardStep(9)} style={{
                background:"none", border:"none", padding:0, marginBottom:32,
                color:"var(--color-muted-ash)", fontSize:22, cursor:"pointer",
              }}>←</button>
              <h2 style={{ fontSize:28, fontWeight:700, letterSpacing:"-.02em",
                color:"var(--color-ink)", margin:"0 0 12px" }}>
                Which days work best for you?
              </h2>
              <p style={{ fontSize:14, color:"var(--color-muted-ash)", margin:"0 0 8px", lineHeight:1.6 }}>
                Select {daysPerWeek} days. ({selectedDays.length}/{daysPerWeek} chosen)
              </p>
              <p style={{
                fontSize:12, color:"#e05c3a", margin:"0 0 24px", lineHeight:1.5,
                opacity: daysFullFlash ? 1 : 0, transition:"opacity .2s",
              }}>
                You&apos;ve selected {daysPerWeek} day{daysPerWeek !== 1 ? "s" : ""} max
              </p>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {DAY_LABELS.map((label, idx) => {
                  const on = selectedDays.includes(idx);
                  const full = selectedDays.length >= daysPerWeek && !on;
                  return (
                    <button key={idx} onClick={() => toggleDay(idx)} style={{
                      height:48, minWidth:58, padding:"0 14px", borderRadius:14,
                      fontSize:14, fontWeight:700, cursor: full ? "not-allowed" : "pointer",
                      background: on ? "var(--color-forest-canopy)" : "transparent",
                      border:`1.5px solid ${on ? "var(--color-forest-canopy)" : "var(--color-stone)"}`,
                      color: on ? "var(--color-ink)" : full ? "var(--color-stone)" : "var(--color-muted-ash)",
                      opacity: full ? 0.4 : 1, transition:".15s",
                    }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ paddingTop:32 }}>
              <button
                onClick={() => {
                  if (!canContinue) return;
                  localStorage.setItem("workoutDays", JSON.stringify(selectedDays));
                  localStorage.setItem("upform_selected_days", JSON.stringify(selectedDays));
                  setOnboardStep(11);
                }}
                disabled={!canContinue}
                style={{
                  width:"100%", height:54, background:"var(--color-forest-canopy)",
                  border:"none", borderRadius:16, fontSize:17, fontWeight:700,
                  color:"var(--color-ink)", cursor: canContinue ? "pointer" : "not-allowed",
                  opacity: canContinue ? 1 : 0.45, marginBottom:12,
                }}>
                Build My Plan
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Name screen (step 4) ──
    if (onboardStep === 4) {
      return (
        <div className="app">
          <div className="mobile-frame" style={{
            display:"flex", flexDirection:"column",
            padding:"80px 32px 44px", justifyContent:"space-between", minHeight:"100vh",
          }}>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://cdn.undraw.co/illustration/working-out_6ksl.svg?type=svg"
                alt="Welcome"
                style={{ width:"100%", maxWidth:220, margin:"0 auto 44px", display:"block" }}
              />
              <h2 style={{ fontSize:30, fontWeight:700, letterSpacing:"-.02em",
                color:"var(--color-ink)", margin:"0 0 10px" }}>
                What should we call you?
              </h2>
              <p style={{ fontSize:15, color:"var(--color-muted-ash)", margin:"0 0 28px", lineHeight:1.6 }}>
                We'll personalise your experience and keep you motivated.
              </p>
              <input
                type="text" value={userName} autoFocus
                onChange={e => setUserName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && userName.trim()) setOnboardStep(5); }}
                placeholder="Your first name"
                style={{
                  width:"100%", height:56, borderRadius:14, border:"1.5px solid var(--color-stone)",
                  padding:"0 18px", fontSize:18, fontWeight:500, outline:"none",
                  background:"transparent", color:"var(--color-ink)",
                }}
              />
            </div>

            <div style={{ paddingTop:32 }}>
              <button
                onClick={() => { if (userName.trim()) setOnboardStep(5); }}
                disabled={!userName.trim()}
                style={{
                  width:"100%", height:54, background:"var(--color-forest-canopy)",
                  border:"none", borderRadius:16, fontSize:17, fontWeight:700,
                  color:"var(--color-ink)", cursor: userName.trim() ? "pointer" : "not-allowed",
                  opacity: userName.trim() ? 1 : 0.45, marginBottom:12,
                }}
              >
                Continue
              </button>
              <button onClick={() => setOnboardStep(5)} style={{
                background:"none", border:"none", color:"var(--color-muted-ash)",
                fontSize:14, fontWeight:500, cursor:"pointer", width:"100%",
              }}>
                Skip
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Intro screens (steps 0–3) ──
    const INTRO = [
      {
        img: "https://cdn.undraw.co/illustration/working-out_6ksl.svg?type=svg",
        title: "UpForm",
        body: "Train smarter. Move better.",
        isSplash: true,
      },
      {
        img: "https://cdn.undraw.co/illustration/morning-workout_73u9.svg?type=svg",
        title: "Plan Your Workout",
        body: "Set your goals, pick your exercises, and build a routine that fits around your life.",
        isSplash: false,
      },
      {
        img: "https://cdn.undraw.co/illustration/athletes-training_koqa.svg?type=svg",
        title: "Perfect Your Form",
        body: "Real-time AI coaching watches every rep and gives instant feedback. Train safely, see results faster.",
        isSplash: false,
      },
      {
        img: "https://cdn.undraw.co/illustration/fitness-stats_bd09.svg?type=svg",
        title: "Track Every Rep",
        body: "Only clean reps count. Watch your consistency turn into measurable progress.",
        isSplash: false,
      },
    ];

    const intro = INTRO[onboardStep];

    return (
      <div className="app">
        <div className="mobile-frame" style={{
          display:"flex", flexDirection:"column",
          padding:"60px 32px 44px",
          minHeight:"100vh",
        }}>
          {/* Illustration: fixed top 45% area */}
          <div style={{
            height:"45vh", display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={intro.img}
              alt={intro.title}
              style={{ maxHeight:"100%", maxWidth:260, objectFit:"contain", display:"block" }}
            />
          </div>

          {/* Text: left-aligned for features, center for splash */}
          <div style={{
            flex:1, paddingTop:32,
            textAlign: intro.isSplash ? "center" : "left",
          }}>
            <h1 style={{
              fontSize: intro.isSplash ? 52 : 30,
              fontWeight: intro.isSplash ? 800 : 700,
              letterSpacing: intro.isSplash ? "-.03em" : "-.02em",
              color:"var(--color-ink)", margin:"0 0 14px",
            }}>
              {intro.title}
            </h1>
            <p style={{ fontSize:16, color:"var(--color-muted-ash)", lineHeight:1.65, margin:0 }}>
              {intro.body}
            </p>
          </div>

          {/* Bottom controls */}
          <div style={{ width:"100%", paddingTop:28 }}>
            {/* Dot indicators: all 4 intro screens */}
            <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:28 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  height:7, borderRadius:4, transition:"width .3s",
                  width: i === onboardStep ? 28 : 7,
                  background: i === onboardStep ? "var(--color-forest-canopy)" : "var(--color-stone)",
                }}/>
              ))}
            </div>

            <button
              onClick={() => onboardStep < 3 ? setOnboardStep(s => s + 1) : setOnboardStep(4)}
              style={{
                width:"100%", height:54, background:"var(--color-forest-canopy)",
                border:"none", borderRadius:16, fontSize:17, fontWeight:700,
                color:"var(--color-ink)", cursor:"pointer", marginBottom:14,
              }}
            >
              Next
            </button>

            {/* Existing user: skips all onboarding */}
            <button onClick={finish} style={{
              background:"none", border:"none", color:"var(--color-muted-ash)",
              fontSize:14, fontWeight:500, cursor:"pointer", width:"100%",
            }}>
              Existing user? Log in
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── SHARED UI ────────────────────────────────────────── */
  const activeTab: "home"|"routines"|"profile" =
    screen === "profile" ? "profile" : screen === "routines" ? "routines" : "home";

  const BottomNav = (
    <nav style={{
      display:"flex", alignItems:"stretch",
      borderTop:"1px solid var(--color-stone)",
      background:"var(--color-parchment)",
      padding:"6px 8px calc(6px + env(safe-area-inset-bottom, 0px))",
      gap:4,
    }}>
      {([
        { id:"home",     label:"Home",    path:"M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" },
        { id:"routines", label:"Workout", path:"M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43l-1.43-1.43-1.43 1.43 1.43 1.43L4 8.57 5.43 10l-1.43 1.43 1.43 1.43L9 9.29l8.57 8.57-3.57 3.57 1.43 1.43 1.43-1.43 1.43 1.43 1.43-1.43-1.43-1.43z" },
        { id:"profile",  label:"Profile", path:"M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" },
      ] as const).map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => setScreen(tab.id as Screen)} style={{
            flex:1, display:"flex", flexDirection:"column", alignItems:"center",
            gap:3, background:"none", border:"none", cursor:"pointer", padding:"6px 0",
            borderRadius:14,
          }}>
            <div style={{
              width:36, height:36, borderRadius:11, display:"grid", placeItems:"center",
              background: isActive ? "var(--color-forest-canopy)" : "transparent",
              transition:".15s",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24"
                fill={isActive ? "var(--color-ink)" : "var(--color-muted-ash)"}>
                <path d={tab.path}/>
              </svg>
            </div>
            <span style={{
              fontSize:10, fontWeight:700, letterSpacing:".04em", textTransform:"uppercase",
              color: isActive ? "var(--color-ink)" : "var(--color-muted-ash)",
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );

  const CHART_DATA = [0, 45, 0, 30, 0, 60, 0]; // Mon–Sun placeholder minutes
  const CHART_MAX  = Math.max(...CHART_DATA, 1);
  const RECENT = [
    { name: "Shoulder & Squat Day", date: "Today", sets: 9  },
    { name: "Legs & Core Day",      date: "Wed",   sets: 10 },
    { name: "Push & Legs Day",      date: "Mon",   sets: 9  },
  ];

  /* ─── HOME ─────────────────────────────────────────────── */
  const sortedSelectedDays = [...selectedDays].sort((a, b) => a - b);
  const getWorkoutForDay = (dayIdx: number) => {
    const pos = sortedSelectedDays.indexOf(dayIdx);
    return pos >= 0 ? WORKOUTS[pos % WORKOUTS.length] : null;
  };
  const todayWorkout     = getWorkoutForDay(todayIdx);
  const selectedWorkout  = getWorkoutForDay(calSelectedDay);
  const isSelectedToday  = calSelectedDay === todayIdx;

  if (screen === "home") return (
    <div className="app">
      <div className="mobile-frame">
        <div className="statusbar">
          <span>{String(today.getHours()).padStart(2,"0")}:{String(today.getMinutes()).padStart(2,"0")}</span>
          <div className="icons"><span className="dot"/><span className="dot"/><span className="pill"/></div>
        </div>
        <main style={{ paddingBottom:24 }}>

          {/* Stat banner */}
          <div style={{
            background:"var(--color-forest-canopy)", borderRadius:20,
            padding:"13px 18px", marginBottom:20,
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                letterSpacing:".1em", color:"rgba(26,26,26,.55)", marginBottom:2 }}>
                Total
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:"var(--color-ink)", lineHeight:1 }}>
                Workout {workoutCount || 1}
              </div>
            </div>
            <div style={{ width:1, height:32, background:"rgba(26,26,26,.12)" }}/>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                letterSpacing:".1em", color:"rgba(26,26,26,.55)", marginBottom:2 }}>
                Streak
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:"var(--color-ink)", lineHeight:1 }}>
                Week {streak || 1}
              </div>
            </div>
          </div>

          {/* Week date strip */}
          <div style={{ display:"flex", gap:6, marginBottom:24 }}>
            {week.map((d, i) => {
              const dayOfWeek    = d.getDay();
              const isToday      = dayOfWeek === todayIdx;
              const isSelected   = dayOfWeek === calSelectedDay;
              const isWorkoutDay = sortedSelectedDays.includes(dayOfWeek);
              return (
                <button key={i} onClick={() => setCalSelectedDay(dayOfWeek)} style={{
                  flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                  gap:4, padding:"10px 0", borderRadius:18,
                  background: isSelected ? "var(--color-forest-canopy)" : "transparent",
                  border:`1px solid ${isSelected ? "var(--color-forest-canopy)" : "var(--color-stone)"}`,
                  opacity: !isWorkoutDay && !isToday && !isSelected ? 0.3 : 1,
                  cursor: isWorkoutDay || isToday ? "pointer" : "default",
                  transition:".15s",
                }}>
                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:".08em",
                    textTransform:"uppercase",
                    color: isSelected ? "rgba(26,26,26,.6)" : "var(--color-muted-ash)" }}>
                    {DAYS[dayOfWeek]}
                  </span>
                  <span style={{ fontSize:20, fontWeight:700, lineHeight:1, color:"var(--color-ink)" }}>
                    {d.getDate()}
                  </span>
                  {isWorkoutDay && !isSelected && (
                    <div style={{ width:5, height:5, borderRadius:"50%",
                      background:"var(--color-forest-canopy)", marginTop:1 }}/>
                  )}
                </button>
              );
            })}
          </div>

          {/* Greeting */}
          <div style={{ marginBottom:20 }}>
            <p style={{ fontSize:13, color:"var(--color-muted-ash)", marginBottom:4 }}>
              {DAYS[todayIdx]}, {MONTHS[today.getMonth()]} {today.getDate()}
            </p>
            <h1 style={{ fontSize:34, fontWeight:800, letterSpacing:"-.02em",
              lineHeight:1.05, color:"#1A1A1A" }}>
              Hi {userName || "there"}
            </h1>
          </div>

          {/* Workout card: driven by selected calendar day */}
          {selectedWorkout ? (
            <>
              <div className="card pad">
                <div className="eyebrow">
                  {isSelectedToday ? "Today's Workout" : `${DAYS[calSelectedDay]}'s Workout`}
                </div>
                <h3 style={{ marginBottom:16 }}>{selectedWorkout.name}</h3>
                {selectedWorkout.exercises.map((e, i) => (
                  <div key={i} className="row" style={{ alignItems:"center" }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14, color:"var(--color-ink)" }}>{e.name}</div>
                      <div style={{ fontSize:12, color:"var(--color-muted-ash)", marginTop:2 }}>
                        {e.sets} sets · {e.reps} reps
                      </div>
                    </div>
                    <span className="badge">{e.sets}×{e.reps}</span>
                  </div>
                ))}
              </div>
              <div className="sticky-cta" style={{ marginTop:12 }}>
                <button className="btn dark" style={{ width:"100%", fontSize:16 }}
                  onClick={() => startRoutine(selectedWorkout, "home")}>
                  Start Workout
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="card pad">
                <div className="eyebrow">
                  {isSelectedToday ? "Today" : DAYS[calSelectedDay]}
                </div>
                <h3 style={{ marginBottom:8 }}>Rest Day</h3>
                <p style={{ fontSize:14, color:"var(--color-muted-ash)", margin:0, lineHeight:1.6 }}>
                  Recovery is part of the plan. Stay hydrated, sleep well, and come back stronger.
                </p>
              </div>
            </>
          )}
        </main>
        {BottomNav}
      </div>
    </div>
  );

  /* ─── ROUTINES ─────────────────────────────────────────── */
  if (screen === "routines") return (
    <div className="app">
      <div className="mobile-frame" style={{ display:"flex", flexDirection:"column" }}>
        <div className="statusbar">
          <span>{String(today.getHours()).padStart(2,"0")}:{String(today.getMinutes()).padStart(2,"0")}</span>
          <div className="icons"><span className="dot"/><span className="dot"/><span className="pill"/></div>
        </div>
        <main style={{ flex:1, overflowY:"auto", paddingBottom:16 }}>
          <h2 style={{ fontSize:28, fontWeight:800, color:"var(--color-ink)", marginBottom:4 }}>Routines</h2>
          <p style={{ fontSize:13, color:"var(--color-muted-ash)", marginBottom:16 }}>Pick a workout and start tracking</p>

          <input ref={importFileRef} type="file" accept=".json"
            style={{ display:"none" }} onChange={handleImport}/>
          <button onClick={() => importFileRef.current?.click()} style={{
            width:"100%", height:44, borderRadius:14, marginBottom:16,
            background:"transparent",
            border:"1.5px solid var(--color-stone)",
            fontSize:14, fontWeight:600, color:"var(--color-muted-ash)", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          }}>
            <span style={{ fontSize:16 }}>↑</span> Import Workout
          </button>

          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {WORKOUTS.map((w, i) => {
              const totalSets = w.exercises.reduce((s, e) => s + e.sets, 0);
              const estMin    = Math.round(totalSets * 2.5);
              return (
                <div key={w.name} className="card pad" style={{ borderRadius:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                        letterSpacing:".08em", color:"var(--color-muted-ash)", marginBottom:3 }}>
                        Day {i + 1}
                      </div>
                      <div style={{ fontSize:18, fontWeight:800, color:"var(--color-ink)" }}>{w.name}</div>
                    </div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--color-muted-ash)",
                      background:"var(--color-stone)", borderRadius:20, padding:"4px 10px" }}>
                      ~{estMin} min
                    </div>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
                    {w.exercises.map(ex => (
                      <span key={ex.name} style={{ fontSize:11, fontWeight:600,
                        background:"rgba(209,244,125,.25)", color:"var(--color-ink)",
                        borderRadius:20, padding:"3px 10px", border:"1px solid rgba(209,244,125,.5)" }}>
                        {ex.name} · {ex.sets}×{ex.reps}
                      </span>
                    ))}
                  </div>
                  <button className="btn dark" style={{ width:"100%", fontSize:14, height:42 }}
                    onClick={() => startRoutine(w, "routines")}>
                    Start Routine
                  </button>
                </div>
              );
            })}
          </div>
        </main>
        {BottomNav}
      </div>
    </div>
  );

  /* ─── PROFILE ───────────────────────────────────────────── */
  if (screen === "profile") return (
    <div className="app">
      <div className="mobile-frame" style={{ display:"flex", flexDirection:"column" }}>
        <div className="statusbar">
          <span>{String(today.getHours()).padStart(2,"0")}:{String(today.getMinutes()).padStart(2,"0")}</span>
          <div className="icons"><span className="dot"/><span className="dot"/><span className="pill"/></div>
        </div>
        <main style={{ flex:1, overflowY:"auto", paddingBottom:16 }}>
          {/* Avatar + name */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:24 }}>
            <div style={{ width:72, height:72, borderRadius:"50%",
              background:"var(--color-forest-canopy)",
              display:"grid", placeItems:"center",
              fontSize:28, fontWeight:800, color:"var(--color-ink)", marginBottom:10 }}>
              {(userName || "U")[0].toUpperCase()}
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:"var(--color-ink)" }}>{userName || "Athlete"}</div>
            <div style={{ fontSize:12, color:"var(--color-muted-ash)", marginTop:2 }}>Training with Upform</div>
          </div>

          {/* Stats banner */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            {[
              { label:"Total Workouts", value: workoutCount || 1 },
              { label:"Week Streak",    value: streak || 1 },
            ].map(s => (
              <div key={s.label} className="card pad" style={{ borderRadius:16, textAlign:"center" }}>
                <div style={{ fontSize:26, fontWeight:800, color:"var(--color-ink)" }}>{s.value}</div>
                <div style={{ fontSize:11, color:"var(--color-muted-ash)", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Weekly activity bar chart */}
          <div className="card pad" style={{ borderRadius:20, marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase",
              letterSpacing:".08em", color:"var(--color-muted-ash)", marginBottom:12 }}>
              This Week
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:56 }}>
              {["M","T","W","T","F","S","S"].map((d, i) => {
                const heights = [45, 0, 38, 0, 52, 0, 0];
                const h = heights[i];
                const isToday = i === (today.getDay() + 6) % 7;
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
                    alignItems:"center", gap:4 }}>
                    <div style={{ width:"100%", height:56, display:"flex", alignItems:"flex-end" }}>
                      <div style={{ width:"100%", height: h ? `${h}%` : 4, borderRadius:4,
                        background: h > 0
                          ? isToday ? "var(--color-forest-canopy)" : "rgba(209,244,125,.45)"
                          : "var(--color-stone)",
                        transition:".2s" }}/>
                    </div>
                    <span style={{ fontSize:9, fontWeight:700,
                      color: isToday ? "var(--color-ink)" : "var(--color-muted-ash)" }}>{d}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent workouts */}
          <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase",
            letterSpacing:".08em", color:"var(--color-muted-ash)", marginBottom:10 }}>
            Recent Workouts
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[
              { name:"Shoulder & Squat Day", date:"Today",      sets:9,  reps:108 },
              { name:"Legs & Core Day",     date:"3 days ago", sets:10, reps:100 },
              { name:"Push & Legs Day",     date:"5 days ago", sets:10, reps:110 },
            ].map(r => (
              <div key={r.name + r.date} className="card pad"
                style={{ borderRadius:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"var(--color-ink)" }}>{r.name}</div>
                  <div style={{ fontSize:11, color:"var(--color-muted-ash)", marginTop:1 }}>{r.date}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--color-ink)" }}>{r.sets} sets</div>
                  <div style={{ fontSize:11, color:"var(--color-muted-ash)" }}>{r.reps} reps</div>
                </div>
              </div>
            ))}
          </div>
        </main>
        {BottomNav}
      </div>
    </div>
  );

  /* ─── WORKOUT DETAIL ────────────────────────────────────── */
  if (screen === "workout") return (
    <div className="app">
      <div className="mobile-frame">
        <div className="statusbar">
          <span>{String(today.getHours()).padStart(2,"0")}:{String(today.getMinutes()).padStart(2,"0")}</span>
          <div className="icons"><span className="dot"/><span className="dot"/><span className="pill"/></div>
        </div>
        <main>
          {/* Back */}
          <button onClick={() => setScreen(prevScreenRef.current)} style={{
            background:"none", border:"none", cursor:"pointer", padding:0,
            display:"flex", alignItems:"center", gap:6, color:"var(--color-muted-ash)",
            fontSize:13, fontWeight:600, marginBottom:18,
          }}>← Back</button>

          {/* Form animation */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, marginBottom:20 }}>
            <span className="eyebrow" style={{ marginBottom:2 }}>Correct Form</span>

            {activeWorkoutRef.current.exercises[0]?.type === "legpress" ? (
              <svg viewBox="0 0 280 200" width="280" height="200" xmlns="http://www.w3.org/2000/svg">
                {/* Machine: footplate (vertical rect, left side) */}
                <rect x="18" y="42" width="14" height="85" rx="4" fill="#e0e0e0"/>
                {/* Machine: seat base (horizontal, lower right) */}
                <rect x="148" y="122" width="88" height="15" rx="4" fill="#e0e0e0"/>
                {/* Machine: reclined seat back pad */}
                <line x1="175" y1="130" x2="222" y2="75" stroke="#e0e0e0" strokeWidth="16" strokeLinecap="round"/>
                {/* Machine: diagonal guide rail */}
                <line x1="32" y1="62" x2="172" y2="125" stroke="#cccccc" strokeWidth="4" strokeLinecap="round"/>
                {/* Head */}
                <circle cx="228" cy="48" r="14" fill="none" stroke="#2a2a2a" strokeWidth="3"/>
                {/* Torso: shoulder to hip, reclined ~33° from vertical */}
                <line x1="220" y1="72" x2="188" y2="118" stroke="#2a2a2a" strokeWidth="4" strokeLinecap="round"/>
                {/* Arms resting on thighs */}
                <line x1="212" y1="87" x2="162" y2="90" stroke="#2a2a2a" strokeWidth="3" strokeLinecap="round"/>
                {/* Thighs: hip to knees, 45° upper-left, lime green = active muscle */}
                <line x1="188" y1="118" x2="133" y2="63" stroke="#AADD00" strokeWidth="5" strokeLinecap="round"/>
                {/* Knee joint */}
                <circle cx="133" cy="63" r="5" fill="#2a2a2a"/>
                {/* Shins: knees down-left to footplate */}
                <line x1="133" y1="63" x2="32" y2="83" stroke="#2a2a2a" strokeWidth="3" strokeLinecap="round"/>
                {/* Feet on footplate */}
                <line x1="32" y1="80" x2="32" y2="93" stroke="#2a2a2a" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            ) : activeWorkoutRef.current.exercises[0]?.type !== "press" ? (
              <svg viewBox="0 0 180 220" width="150" height="182" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Depth guide at hip-parallel */}
                <line x1="12" y1="122" x2="168" y2="122"
                  stroke="rgba(209,244,125,.45)" strokeWidth="1" strokeDasharray="5,4"/>

                {/* Ground */}
                <line x1="28" y1="208" x2="152" y2="208"
                  stroke="var(--color-stone)" strokeWidth="2" strokeLinecap="round"/>

                {/* Foot (side view, facing right): static */}
                <line x1="46" y1="208" x2="92" y2="208"
                  stroke="rgba(26,26,26,.5)" strokeWidth="3" strokeLinecap="round"/>

                {/* Shin: animates forward/down as knee travels forward at depth */}
                <line stroke="rgba(26,26,26,.7)" strokeWidth="3.5" strokeLinecap="round"
                  x1="64" y1="208">
                  <animate attributeName="x2" values="64;70;64" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="y2" values="162;176;162" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                </line>

                {/* Knee joint */}
                <circle r="5.5" fill="rgba(209,244,125,.75)">
                  <animate attributeName="cx" values="64;70;64" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="cy" values="162;176;162" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                </circle>

                {/* Thigh: standing nearly vertical; depth ~45° back and up */}
                <line stroke="rgba(26,26,26,.75)" strokeWidth="3.5" strokeLinecap="round">
                  <animate attributeName="x1" values="64;70;64" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="y1" values="162;176;162" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="x2" values="68;102;68" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="y2" values="110;124;110" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                </line>

                {/* Quad glow */}
                <ellipse rx="10" ry="22" fill="rgba(209,244,125,.18)">
                  <animate attributeName="cx" values="66;86;66" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="cy" values="136;150;136" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animateTransform attributeName="transform" type="rotate"
                    values="5 66 136;42 86 150;5 66 136" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                </ellipse>

                {/* Hip joint */}
                <circle r="4.5" fill="rgba(26,26,26,.45)">
                  <animate attributeName="cx" values="68;102;68" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="cy" values="110;124;110" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                </circle>

                {/* Torso/spine: slight forward lean increases at depth */}
                <line stroke="rgba(26,26,26,.85)" strokeWidth="4" strokeLinecap="round">
                  <animate attributeName="x1" values="68;102;68" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="y1" values="110;124;110" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="x2" values="72;114;72" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="y2" values="62;76;62" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                </line>

                {/* Arm: extends forward for balance at depth */}
                <line stroke="rgba(26,26,26,.7)" strokeWidth="3" strokeLinecap="round">
                  <animate attributeName="x1" values="72;112;72" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="y1" values="68;80;68" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="x2" values="90;144;90" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="y2" values="74;92;74" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                </line>

                {/* Neck */}
                <line stroke="rgba(26,26,26,.8)" strokeWidth="3" strokeLinecap="round">
                  <animate attributeName="x1" values="72;114;72" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="y1" values="62;76;62" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="x2" values="74;116;74" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="y2" values="48;62;48" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                </line>

                {/* Head */}
                <circle r="13" stroke="rgba(26,26,26,.8)" strokeWidth="2" fill="rgba(26,26,26,.06)">
                  <animate attributeName="cx" values="74;116;74" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  <animate attributeName="cy" values="35;49;35" dur="2.6s" repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                </circle>
              </svg>
            ) : (
            <svg viewBox="0 0 180 220" width="150" height="182" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Bench */}
              <rect x="36" y="132" width="108" height="7" rx="3.5"
                fill="var(--color-stone)" stroke="var(--color-muted-ash)" strokeWidth="1" strokeOpacity=".4"/>
              <line x1="52" y1="139" x2="52" y2="158" stroke="var(--color-stone)" strokeWidth="2" strokeLinecap="round"/>
              <line x1="128" y1="139" x2="128" y2="158" stroke="var(--color-stone)" strokeWidth="2" strokeLinecap="round"/>

              {/* Legs */}
              <line x1="72" y1="114" x2="52" y2="132" stroke="rgba(26,26,26,.55)" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="108" y1="114" x2="128" y2="132" stroke="rgba(26,26,26,.55)" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="52" y1="139" x2="52" y2="170" stroke="rgba(26,26,26,.5)" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="128" y1="139" x2="128" y2="170" stroke="rgba(26,26,26,.5)" strokeWidth="2.5" strokeLinecap="round"/>

              {/* Hip */}
              <line x1="72" y1="114" x2="108" y2="114" stroke="rgba(26,26,26,.6)" strokeWidth="2.5" strokeLinecap="round"/>

              {/* Torso */}
              <line x1="90" y1="46" x2="90" y2="114" stroke="rgba(26,26,26,.8)" strokeWidth="4" strokeLinecap="round"/>

              {/* Shoulder line */}
              <line x1="63" y1="60" x2="117" y2="60" stroke="rgba(26,26,26,.8)" strokeWidth="3.5" strokeLinecap="round"/>

              {/* Neck */}
              <line x1="90" y1="33" x2="90" y2="46" stroke="rgba(26,26,26,.8)" strokeWidth="3" strokeLinecap="round"/>

              {/* Head */}
              <circle cx="90" cy="20" r="13" stroke="rgba(26,26,26,.8)" strokeWidth="2" fill="rgba(26,26,26,.06)"/>

              {/* Deltoid glow */}
              <circle cx="63" cy="60" r="12" fill="rgba(255,140,40,.2)"/>
              <circle cx="117" cy="60" r="12" fill="rgba(255,140,40,.2)"/>

              {/* LEFT UPPER ARM: amber deltoid */}
              <line x1="63" y1="60" stroke="rgba(230,130,30,.9)" strokeWidth="5" strokeLinecap="round">
                <animate attributeName="x2" values="25;40;25" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <animate attributeName="y2" values="68;33;68" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
              </line>
              <circle cx="63" cy="60" r="5.5" fill="rgba(230,130,30,.9)"/>

              {/* LEFT FOREARM */}
              <line stroke="rgba(26,26,26,.75)" strokeWidth="4" strokeLinecap="round">
                <animate attributeName="x1" values="25;40;25" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <animate attributeName="y1" values="68;33;68" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <animate attributeName="x2" values="24;32;24" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <animate attributeName="y2" values="40;9;40"  dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
              </line>

              {/* Left elbow dot */}
              <circle r="4" fill="rgba(230,130,30,.85)">
                <animate attributeName="cx" values="25;40;25" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <animate attributeName="cy" values="68;33;68" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
              </circle>

              {/* Left dumbbell */}
              <g>
                <animateTransform attributeName="transform" type="translate"
                  values="24,38; 32,7; 24,38" dur="2.8s" repeatCount="indefinite"
                  calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <rect x="-10" y="-3"  width="20" height="6"  rx="2" fill="rgba(26,26,26,.35)"/>
                <rect x="-16" y="-7"  width="7"  height="14" rx="2" fill="rgba(26,26,26,.45)"/>
                <rect x="9"  y="-7"  width="7"  height="14" rx="2" fill="rgba(26,26,26,.45)"/>
              </g>

              {/* RIGHT UPPER ARM: amber */}
              <line x1="117" y1="60" stroke="rgba(230,130,30,.9)" strokeWidth="5" strokeLinecap="round">
                <animate attributeName="x2" values="155;140;155" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <animate attributeName="y2" values="68;33;68"    dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
              </line>
              <circle cx="117" cy="60" r="5.5" fill="rgba(230,130,30,.9)"/>

              {/* RIGHT FOREARM */}
              <line stroke="rgba(26,26,26,.75)" strokeWidth="4" strokeLinecap="round">
                <animate attributeName="x1" values="155;140;155" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <animate attributeName="y1" values="68;33;68"    dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <animate attributeName="x2" values="156;148;156" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <animate attributeName="y2" values="40;9;40"     dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
              </line>

              {/* Right elbow dot */}
              <circle r="4" fill="rgba(230,130,30,.85)">
                <animate attributeName="cx" values="155;140;155" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <animate attributeName="cy" values="68;33;68"    dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
              </circle>

              {/* Right dumbbell */}
              <g>
                <animateTransform attributeName="transform" type="translate"
                  values="156,38; 148,7; 156,38" dur="2.8s" repeatCount="indefinite"
                  calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                <rect x="-10" y="-3"  width="20" height="6"  rx="2" fill="rgba(26,26,26,.35)"/>
                <rect x="-16" y="-7"  width="7"  height="14" rx="2" fill="rgba(26,26,26,.45)"/>
                <rect x="9"  y="-7"  width="7"  height="14" rx="2" fill="rgba(26,26,26,.45)"/>
              </g>
            </svg>
            )}
          </div>

          {/* Header */}
          <div style={{ marginBottom:16 }}>
            <p className="eyebrow" style={{ marginBottom:4 }}>Ready to train</p>
            <h2 style={{ fontSize:32,
              fontWeight:400, color:"var(--color-ink)", lineHeight:1 }}>{activeWorkoutRef.current.name}</h2>
          </div>

          {/* Stats */}
          <div className="metric-row" style={{ marginBottom:20 }}>
            {[
              { label:"Est. Time", value:`~${Math.round(activeWorkoutRef.current.exercises.reduce((s,e)=>s+e.sets,0)*2.5)} min` },
              { label:"Exercises", value:`${activeWorkoutRef.current.exercises.length}` },
            ].map(s => (
              <div key={s.label} className="metric">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Track with */}
          <div className="eyebrow" style={{ marginBottom:10 }}>Track with</div>
          <div style={{ display:"grid", gap:8, marginBottom:8 }}>
            {MODES.map(m => {
              const isActive = mode === m.id;
              return (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                  borderRadius:16, cursor:"pointer", textAlign:"left", transition:".15s",
                  background: isActive ? "rgba(209,244,125,.3)" : "var(--color-parchment)",
                  border: isActive ? "1.5px solid var(--color-forest-canopy)" : "1px solid var(--color-stone)",
                }}>
                  <span style={{ fontSize:18, lineHeight:1 }}>{m.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14, color:"var(--color-ink)" }}>{m.label}</div>
                    <div style={{ fontSize:11, color:"var(--color-muted-ash)", marginTop:1 }}>{m.sub}</div>
                  </div>
                  {isActive && (
                    <div style={{ width:20, height:20, borderRadius:"50%",
                      background:"var(--color-forest-canopy)",
                      display:"grid", placeItems:"center", fontSize:11, color:"var(--color-ink)", fontWeight:700 }}>✓</div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="sticky-cta">
            <button className="btn dark" style={{ width:"100%", fontSize:16 }}
              onClick={() => { setTutorialStep(1); setScreen("tutorial"); }}>
              Start
            </button>
          </div>
        </main>
        {BottomNav}
      </div>
    </div>
  );

  /* ─── TUTORIAL: 3-step pre-workout guide ───────────────── */
  if (screen === "tutorial") {
    const STEPS = [
      {
        eyebrow: "FIND YOUR SPOT · 1 OF 3",
        heading: "Step back to fit the frame",
        body: "Stand far enough that your whole body is visible, head to feet. Green joints mean great form, red means adjust.",
        cta: "Got it",
        illustration: (
          <svg viewBox="0 0 275 285" width="240" height="249" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes tut-pulse1 {
                0%   { transform:scale(1);    opacity:.45; }
                16.7%{ transform:scale(1.38); opacity:.65; }
                33.3%{ transform:scale(1);    opacity:.45; }
                49%  { transform:scale(1);    opacity:0;   }
                95%  { transform:scale(1);    opacity:0;   }
                100% { transform:scale(1);    opacity:.45; }
              }
              @keyframes tut-pulse2 {
                0%   { transform:scale(1);   opacity:.2; }
                16.7%{ transform:scale(1.6); opacity:.3; }
                33.3%{ transform:scale(1);   opacity:.2; }
                49%  { transform:scale(1);   opacity:0;  }
                95%  { transform:scale(1);   opacity:0;  }
                100% { transform:scale(1);   opacity:.2; }
              }
              @keyframes tut-red-op {
                0%,33.3%{ opacity:1 }
                50%     { opacity:0 }
                95%,100%{ opacity:0 }
              }
              @keyframes tut-green-op {
                0%,33.3%{ opacity:0 }
                50%,95% { opacity:1 }
                100%    { opacity:0 }
              }
              @keyframes tut-ghalo-op {
                0%,33.3%{ opacity:0 }
                50%,95% { opacity:.55 }
                100%    { opacity:0 }
              }
              @keyframes tut-bad-op {
                0%,33.3%{ opacity:1 }
                50%     { opacity:0 }
                95%,100%{ opacity:0 }
              }
              @keyframes tut-good-op {
                0%,33.3%{ opacity:0 }
                50%,95% { opacity:1 }
                100%    { opacity:0 }
              }
              .th1{ transform-box:fill-box; transform-origin:center; animation:tut-pulse1 6s ease-in-out infinite; }
              .th2{ transform-box:fill-box; transform-origin:center; animation:tut-pulse2 6s ease-in-out infinite; }
              .tr { animation:tut-red-op   6s ease-in-out infinite; }
              .tg { animation:tut-green-op 6s ease-in-out infinite; }
              .tgh{ animation:tut-ghalo-op 6s ease-in-out infinite; }
              .tb { animation:tut-bad-op   6s ease-in-out infinite; }
              .tgd{ animation:tut-good-op  6s ease-in-out infinite; }
            `}</style>

            {/* Dashed oval */}
            <ellipse cx="104" cy="150" rx="84" ry="114" stroke="var(--color-forest-canopy)" strokeWidth="2.5" strokeDasharray="6 5" fill="rgba(209,244,125,.08)"/>

            {/* Ground shadow */}
            <ellipse cx="104" cy="254" rx="33" ry="6" fill="rgba(26,26,26,.07)"/>

            {/* Lower legs */}
            <line x1="77" y1="204" x2="75" y2="248" stroke="rgba(26,26,26,.75)" strokeWidth="4" strokeLinecap="round"/>
            <line x1="131" y1="204" x2="133" y2="248" stroke="rgba(26,26,26,.75)" strokeWidth="4" strokeLinecap="round"/>
            {/* Upper legs */}
            <line x1="84" y1="160" x2="77" y2="204" stroke="rgba(26,26,26,.82)" strokeWidth="4.5" strokeLinecap="round"/>
            <line x1="124" y1="160" x2="131" y2="204" stroke="rgba(26,26,26,.82)" strokeWidth="4.5" strokeLinecap="round"/>
            {/* Hips */}
            <line x1="84" y1="160" x2="124" y2="160" stroke="rgba(26,26,26,.7)" strokeWidth="4" strokeLinecap="round"/>
            {/* Torso */}
            <line x1="104" y1="84" x2="104" y2="160" stroke="rgba(26,26,26,.88)" strokeWidth="5" strokeLinecap="round"/>
            {/* Shoulders */}
            <line x1="64" y1="100" x2="144" y2="100" stroke="rgba(26,26,26,.88)" strokeWidth="4.5" strokeLinecap="round"/>
            {/* Neck */}
            <line x1="104" y1="68" x2="104" y2="84" stroke="rgba(26,26,26,.82)" strokeWidth="4.5" strokeLinecap="round"/>
            {/* Head */}
            <circle cx="104" cy="52" r="17" stroke="rgba(26,26,26,.8)" strokeWidth="2.5" fill="rgba(26,26,26,.05)"/>
            {/* Arms: angled down slightly */}
            <line x1="64"  y1="100" x2="42" y2="136" stroke="rgba(26,26,26,.72)" strokeWidth="4" strokeLinecap="round"/>
            <line x1="144" y1="100" x2="166" y2="136" stroke="rgba(26,26,26,.72)" strokeWidth="4" strokeLinecap="round"/>

            {/* ── LEFT KNEE joint layers ── */}
            <circle cx="77" cy="204" r="20" fill="#e05252" className="th2"/>
            <circle cx="77" cy="204" r="14" fill="#e05252" className="th1"/>
            <circle cx="77" cy="204" r="16" fill="rgba(209,244,125,1)" className="tgh"/>
            <circle cx="77" cy="204" r="8"  fill="#e05252" className="tr"/>
            <circle cx="77" cy="204" r="8"  fill="#5cb85c" className="tg"/>

            {/* ── RIGHT KNEE joint layers ── */}
            <circle cx="131" cy="204" r="20" fill="#e05252" className="th2"/>
            <circle cx="131" cy="204" r="14" fill="#e05252" className="th1"/>
            <circle cx="131" cy="204" r="16" fill="rgba(209,244,125,1)" className="tgh"/>
            <circle cx="131" cy="204" r="8"  fill="#e05252" className="tr"/>
            <circle cx="131" cy="204" r="8"  fill="#5cb85c" className="tg"/>

            {/* ── TOOLTIP: Adjust knees ── */}
            <g className="tb">
              <line x1="139" y1="204" x2="158" y2="204" stroke="#e05252" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round"/>
              <rect x="156" y="190" width="114" height="28" rx="14" fill="white" stroke="#f5c5c5" strokeWidth="1.5"/>
              <circle cx="172" cy="204" r="9" fill="#e05252"/>
              <text x="172" y="209" fontSize="13" fill="white" textAnchor="middle" fontFamily="Figtree,sans-serif" fontWeight="900">!</text>
              <text x="187" y="208.5" fontSize="10.5" fill="rgba(26,26,26,.82)" fontFamily="Figtree,sans-serif" fontWeight="600">Adjust knees</text>
            </g>

            {/* ── TOOLTIP: Good form ── */}
            <g className="tgd">
              <line x1="139" y1="204" x2="158" y2="204" stroke="#5cb85c" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round"/>
              <rect x="156" y="190" width="102" height="28" rx="14" fill="white" stroke="#c5e8c5" strokeWidth="1.5"/>
              <circle cx="172" cy="204" r="9" fill="#5cb85c"/>
              <polyline points="167,204 171,209 179,199" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <text x="187" y="208.5" fontSize="10.5" fill="rgba(26,26,26,.82)" fontFamily="Figtree,sans-serif" fontWeight="600">Good form</text>
            </g>
          </svg>
        ),
      },
      {
        eyebrow: "VOICE CUES · 2 OF 3",
        heading: "Your coach talks to you",
        body: "You\u2019ll hear audio cues when your form slips. Say \u201cnext\u201d to move to the next set, or \u201cstop\u201d to end the workout.",
        cta: "Next",
        illustration: (
          <svg viewBox="0 0 240 218" width="240" height="218" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Central mic body */}
            <rect x="104" y="46" width="32" height="52" rx="16" fill="rgba(209,244,125,.6)" stroke="rgba(26,26,26,.75)" strokeWidth="2.5"/>
            {/* Mic grille lines */}
            <line x1="111" y1="63" x2="129" y2="63" stroke="rgba(26,26,26,.25)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="111" y1="71" x2="129" y2="71" stroke="rgba(26,26,26,.25)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="111" y1="79" x2="129" y2="79" stroke="rgba(26,26,26,.25)" strokeWidth="1.5" strokeLinecap="round"/>
            {/* Mic stand arc */}
            <path d="M88,98 Q88,126 120,126 Q152,126 152,98" stroke="rgba(26,26,26,.7)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            {/* Stand pole + base */}
            <line x1="120" y1="126" x2="120" y2="144" stroke="rgba(26,26,26,.7)" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="104" y1="144" x2="136" y2="144" stroke="rgba(26,26,26,.65)" strokeWidth="2.5" strokeLinecap="round"/>
            {/* Sound waves: left */}
            <path d="M82,76 Q70,96 82,116"  stroke="rgba(209,244,125,.95)" strokeWidth="3"   strokeLinecap="round" fill="none"/>
            <path d="M68,62 Q48,96 68,130"  stroke="rgba(209,244,125,.55)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M54,48 Q24,96 54,144"  stroke="rgba(209,244,125,.22)" strokeWidth="2"   strokeLinecap="round" fill="none"/>
            {/* Sound waves: right */}
            <path d="M158,76 Q170,96 158,116"  stroke="rgba(209,244,125,.95)" strokeWidth="3"   strokeLinecap="round" fill="none"/>
            <path d="M172,62 Q192,96 172,130"  stroke="rgba(209,244,125,.55)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M186,48 Q216,96 186,144"  stroke="rgba(209,244,125,.22)" strokeWidth="2"   strokeLinecap="round" fill="none"/>

            {/* ── Speech bubble "next": top-right of mic, tail points bottom-left toward mic body ── */}
            <rect x="148" y="6" width="80" height="30" rx="12" fill="white" stroke="rgba(26,26,26,.13)" strokeWidth="1.5"/>
            {/* tail: bottom-left corner of bubble pointing toward mic top */}
            <path d="M160,34 L152,34 L140,50" fill="white" stroke="rgba(26,26,26,.13)" strokeWidth="1.5" strokeLinejoin="round"/>
            <line x1="153" y1="34" x2="160" y2="34" stroke="white" strokeWidth="2.5"/>
            <text x="188" y="26" fontSize="12" fill="rgba(26,26,26,.75)" textAnchor="middle" fontFamily="Figtree,sans-serif" fontWeight="700">&quot;next&quot;</text>

            {/* ── Speech bubble "stop": below mic base, tail points up toward base ── */}
            <rect x="80" y="158" width="80" height="30" rx="12" fill="white" stroke="rgba(26,26,26,.13)" strokeWidth="1.5"/>
            {/* tail: top-center pointing up to mic base */}
            <path d="M113,158 L127,158 L120,144" fill="white" stroke="rgba(26,26,26,.13)" strokeWidth="1.5" strokeLinejoin="round"/>
            <line x1="114" y1="158" x2="126" y2="158" stroke="white" strokeWidth="2.5"/>
            <text x="120" y="178" fontSize="12" fill="rgba(26,26,26,.75)" textAnchor="middle" fontFamily="Figtree,sans-serif" fontWeight="700">&quot;stop&quot;</text>
          </svg>
        ),
      },
      {
        eyebrow: "YOU'RE ALL SET · 3 OF 3",
        heading: "Put on your glasses and go",
        body: "Wear your Meta glasses, step into position, and the session starts automatically. Your coach is with you the whole way.",
        cta: "Start workout",
        illustration: (
          <div style={{ position:"relative", width:240, height:240, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <style>{`
              @keyframes cel3-ring {
                0%   { transform:scale(.72); opacity:.7; }
                100% { transform:scale(2.1); opacity:0;  }
              }
              @keyframes cel3-twinkle-a { 0%,100%{opacity:1;transform:scale(1) rotate(0deg)}   50%{opacity:.4;transform:scale(1.4) rotate(22deg)}  }
              @keyframes cel3-twinkle-b { 0%,100%{opacity:.8;transform:scale(1) rotate(0deg)}  50%{opacity:.3;transform:scale(1.3) rotate(-18deg)} }
              @keyframes cel3-twinkle-c { 0%,100%{opacity:.6;transform:scale(.8) rotate(0deg)} 50%{opacity:1;transform:scale(1.2) rotate(12deg)}   }
            `}</style>

            {/* Pulsing rings: 3 staggered */}
            {[0, 0.9, 1.8].map((d, i) => (
              <div key={i} style={{
                position:"absolute", inset:0, margin:"auto",
                width:180, height:180, borderRadius:"50%",
                border:"2.5px solid var(--color-forest-canopy)",
                animation:`cel3-ring 2.7s ease-out ${d}s infinite`,
              }}/>
            ))}

            {/* Soft glow disc behind image */}
            <div style={{
              position:"absolute", inset:0, margin:"auto",
              width:170, height:170, borderRadius:"50%",
              background:"radial-gradient(circle, rgba(209,244,125,.22) 0%, rgba(209,244,125,0) 70%)",
            }}/>

            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/glasses-nobg.png" alt="Person putting on AR glasses"
              style={{ width:210, height:210, objectFit:"contain", position:"relative", zIndex:1 }}/>

            {/* Sparkle overlay: 4-pointed stars at scattered positions */}
            <svg viewBox="0 0 240 240" width="240" height="240"
              style={{ position:"absolute", inset:0, zIndex:2, pointerEvents:"none", overflow:"visible" }}>
              {[
                { cx:22,  cy:30,  r:8,  anim:"cel3-twinkle-a", delay:"0s",    dur:"2s"   },
                { cx:218, cy:22,  r:6,  anim:"cel3-twinkle-b", delay:"0.5s",  dur:"1.8s" },
                { cx:232, cy:118, r:7,  anim:"cel3-twinkle-c", delay:"1.1s",  dur:"2.2s" },
                { cx:210, cy:216, r:5,  anim:"cel3-twinkle-a", delay:"1.6s",  dur:"1.9s" },
                { cx:20,  cy:210, r:6,  anim:"cel3-twinkle-b", delay:"0.8s",  dur:"2.3s" },
                { cx:8,   cy:112, r:5,  anim:"cel3-twinkle-c", delay:"0.3s",  dur:"2.1s" },
                { cx:116, cy:8,   r:5,  anim:"cel3-twinkle-a", delay:"1.3s",  dur:"1.7s" },
              ].map((s, i) => (
                <g key={i} transform={`translate(${s.cx},${s.cy})`}
                  style={{ animation:`${s.anim} ${s.dur} ease-in-out ${s.delay} infinite`,
                    transformBox:"fill-box", transformOrigin:"center" }}>
                  {/* 4-pointed star */}
                  <path d={`M0,${-s.r} L${s.r*.28},${-s.r*.28} L${s.r},0 L${s.r*.28},${s.r*.28} L0,${s.r} L${-s.r*.28},${s.r*.28} L${-s.r},0 L${-s.r*.28},${-s.r*.28} Z`}
                    fill="var(--color-forest-canopy)"/>
                </g>
              ))}
            </svg>
          </div>
        ),
      },
    ];

    const step = STEPS[tutorialStep - 1];
    const isLast = tutorialStep === 3;

    return (
      <div className="app">
        <div className="mobile-frame" style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
          {/* Status bar */}
          <div className="statusbar">
            <span>{String(today.getHours()).padStart(2,"0")}:{String(today.getMinutes()).padStart(2,"0")}</span>
            <div className="icons"><span className="dot"/><span className="dot"/><span className="pill"/></div>
          </div>

          {/* Back + step label */}
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 20px 4px" }}>
            <button
              onClick={() => tutorialStep > 1 ? setTutorialStep(s => s - 1) : setScreen("workout")}
              style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center", gap:6, color:"var(--color-ink)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              <span style={{ fontSize:14, fontWeight:500 }}>Back</span>
            </button>
          </div>

          {/* Step eyebrow */}
          <div style={{ padding:"0 20px 0" }}>
            <p style={{
              fontSize:10, fontWeight:700, letterSpacing:".12em", textTransform:"uppercase",
              color:"var(--color-muted-ash)", margin:0, display:"flex", alignItems:"center", gap:6,
            }}>
              <span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:"var(--color-forest-canopy)" }}/>
              {step.eyebrow}
            </p>
          </div>

          {/* Illustration */}
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 0 8px" }}>
            {step.illustration}
          </div>

          {/* Copy */}
          <div style={{ padding:"0 28px 28px" }}>
            <h2 style={{ fontSize:28, fontWeight:700, color:"var(--color-ink)", lineHeight:1.15, margin:"0 0 10px", letterSpacing:"-.02em" }}>
              {step.heading}
            </h2>
            <p style={{ fontSize:15, color:"var(--color-muted-ash)", lineHeight:1.65, margin:0 }}>
              {step.body}
            </p>
          </div>

          {/* Progress dots */}
          <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:20 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                height:6, borderRadius:4, transition:"width .3s, background .3s",
                width: i === tutorialStep ? 28 : 7,
                background: i === tutorialStep ? "var(--color-forest-canopy)" : "var(--color-stone)",
              }}/>
            ))}
          </div>

          {/* CTA */}
          <div style={{ padding:"0 20px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
            <button
              onClick={() => {
                if (isLast) { setScreen("camera"); }
                else { setTutorialStep(s => s + 1); }
              }}
              style={{
                width:"100%", height:54, background:"var(--color-forest-canopy)",
                border:"none", borderRadius:16, fontSize:17, fontWeight:700,
                color:"var(--color-ink)", cursor:"pointer",
              }}
            >
              {step.cta}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── CAMERA: fullscreen MediaPipe ────────────────────── */
  return (
    <>
      <style>{`
        @keyframes spin    { to { transform:rotate(360deg) } }
        @keyframes fadein  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulsedot{ 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes repgood { 0%{transform:scale(1)} 40%{transform:scale(1.18)} 100%{transform:scale(1)} }
        @keyframes repbad  { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)}
                             40%{transform:translateX(7px)} 60%{transform:translateX(-4px)}
                             80%{transform:translateX(4px)} }
      `}</style>

      <div style={{ position:"fixed", inset:0, zIndex:500, background:"#050605", overflow:"hidden" }}>

        {/* Live camera: mirrored */}
        <video ref={videoRef} autoPlay playsInline muted style={{
          position:"absolute", inset:0, width:"100%", height:"100%",
          objectFit:"cover", transform:"scaleX(-1)",
          display: permState === "granted" ? "block" : "none",
        }}/>

        {/* Skeleton + form-line canvas: same mirror as video */}
        <canvas ref={canvasRef} style={{
          position:"absolute", inset:0, width:"100%", height:"100%",
          transform:"scaleX(-1)", pointerEvents:"none",
          display: permState === "granted" && !mpLoading ? "block" : "none",
        }}/>

        {/* Vignette */}
        {permState === "granted" && (
          <div style={{ position:"absolute", inset:0, pointerEvents:"none",
            background:"radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.38) 100%)" }}/>
        )}

        {/* ── PERMISSION ── */}
        {permState === "idle" && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
            justifyContent:"center", padding:32,
            background:"linear-gradient(135deg,#0d1a18 0%,#091210 100%)" }}>
            <div style={{ background:"rgba(255,255,255,.07)", backdropFilter:"blur(24px)",
              WebkitBackdropFilter:"blur(24px)", border:"1px solid rgba(255,255,255,.14)",
              borderRadius:28, padding:"36px 28px", maxWidth:340, width:"100%", textAlign:"center" }}>
              <div style={{ display:"flex", gap:10, justifyContent:"center", margin:"0 auto 20px" }}>
                <div style={{ width:56, height:56, borderRadius:18, background:"rgba(255,255,255,.1)",
                  border:"1px solid rgba(255,255,255,.18)", display:"grid", placeItems:"center", fontSize:24 }}>📷</div>
                <div style={{ width:56, height:56, borderRadius:18, background:"rgba(255,255,255,.1)",
                  border:"1px solid rgba(255,255,255,.18)", display:"grid", placeItems:"center", fontSize:24 }}>🎤</div>
              </div>
              <h2 style={{ fontSize:20, fontWeight:700, color:"white", marginBottom:10, lineHeight:1.2 }}>
                Camera & Microphone
              </h2>
              <p style={{ fontSize:13, color:"rgba(255,255,255,.55)", lineHeight:1.6, marginBottom:28 }}>
                Camera tracks your form in real time. Microphone lets you say{" "}
                <strong style={{ color:"rgba(255,255,255,.85)" }}>"Skip"</strong>{" "}
                to move to the next set hands-free.
              </p>
              <button onClick={requestCamera} style={{ width:"100%", height:50, borderRadius:14,
                background:"white", color:"#1a1a1a", border:"none",
                fontWeight:700, fontSize:15, cursor:"pointer", marginBottom:12 }}>
                Allow Camera & Mic
              </button>
              <button onClick={exitCamera} style={{ width:"100%", height:40, borderRadius:14,
                background:"transparent", color:"rgba(255,255,255,.45)",
                border:"1px solid rgba(255,255,255,.14)", fontWeight:600,
                fontSize:13, cursor:"pointer" }}>
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* ── DENIED ── */}
        {permState === "denied" && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
            justifyContent:"center", padding:32,
            background:"linear-gradient(135deg,#0d1a18 0%,#091210 100%)" }}>
            <div style={{ background:"rgba(255,255,255,.07)", backdropFilter:"blur(24px)",
              border:"1px solid rgba(255,255,255,.14)", borderRadius:28,
              padding:"36px 28px", maxWidth:340, width:"100%", textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:16 }}>🚫</div>
              <h2 style={{ fontSize:24, fontWeight:400, color:"white", marginBottom:10 }}>Camera Blocked</h2>
              <p style={{ fontSize:13, color:"rgba(255,255,255,.5)", marginBottom:24 }}>
                Enable camera access in your browser settings to continue.
              </p>
              <button onClick={exitCamera} style={{ width:"100%", height:48, borderRadius:14,
                background:"white", color:"#1a1a1a", border:"none",
                fontWeight:700, fontSize:15, cursor:"pointer" }}>Go Back</button>
            </div>
          </div>
        )}

        {/* ── AI LOADING ── */}
        {permState === "granted" && mpLoading && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", gap:16, background:"rgba(0,0,0,.55)" }}>
            <div style={{ width:48, height:48, borderRadius:"50%",
              border:"3px solid rgba(255,255,255,.14)", borderTopColor:"white",
              animation:"spin .85s linear infinite" }}/>
            <p style={{ color:"white", fontSize:14, fontWeight:600,
              letterSpacing:".06em", margin:0 }}>Initializing AI tracking…</p>
          </div>
        )}

        {/* ── EXERCISE HUD ── */}
        {permState === "granted" && !mpLoading && (
          <div style={{ position:"absolute", inset:0, animation:"fadein .4s ease" }}>

            {/* Corner vignette: red = bad form, green = moving correctly */}
            <div style={{
              position:"absolute", inset:0, pointerEvents:"none",
              transition:"background .35s ease",
              background: cornerStatus === "bad"
                ? `radial-gradient(ellipse at 0% 0%,   rgba(255,40,40,.45) 0%, transparent 38%),
                   radial-gradient(ellipse at 100% 0%,  rgba(255,40,40,.45) 0%, transparent 38%),
                   radial-gradient(ellipse at 0% 100%,  rgba(255,40,40,.45) 0%, transparent 38%),
                   radial-gradient(ellipse at 100% 100%,rgba(255,40,40,.45) 0%, transparent 38%)`
                : cornerStatus === "good"
                  ? `radial-gradient(ellipse at 0% 0%,   rgba(40,220,100,.25) 0%, transparent 38%),
                     radial-gradient(ellipse at 100% 0%,  rgba(40,220,100,.25) 0%, transparent 38%),
                     radial-gradient(ellipse at 0% 100%,  rgba(40,220,100,.25) 0%, transparent 38%),
                     radial-gradient(ellipse at 100% 100%,rgba(40,220,100,.25) 0%, transparent 38%)`
                  : "none",
            }}/>

            {/* ── Lateral-raises form tutorial (shown while voice intro plays) ── */}
            {showExerciseIntro && (
              <div style={{
                position:"absolute", inset:0, zIndex:30,
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                background:"rgba(5,6,5,.78)", backdropFilter:"blur(6px)",
                animation:"fadein .5s ease",
              }}>
                <span style={{
                  fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".16em",
                  color:"rgba(255,255,255,.5)", background:"rgba(255,255,255,.08)",
                  padding:"4px 14px", borderRadius:8, marginBottom:12,
                  border:"1px solid rgba(255,255,255,.12)",
                }}>Correct Form: Lateral Raises</span>

                <svg viewBox="0 0 180 200" width="200" height="222" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Bench */}
                  <rect x="36" y="132" width="108" height="7" rx="3.5"
                    fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.2)" strokeWidth="1"/>
                  <line x1="52" y1="139" x2="52" y2="158" stroke="rgba(255,255,255,.15)" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="128" y1="139" x2="128" y2="158" stroke="rgba(255,255,255,.15)" strokeWidth="2" strokeLinecap="round"/>
                  {/* Legs */}
                  <line x1="72" y1="114" x2="52" y2="132" stroke="rgba(255,255,255,.55)" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="108" y1="114" x2="128" y2="132" stroke="rgba(255,255,255,.55)" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="52" y1="139" x2="52" y2="170" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="128" y1="139" x2="128" y2="170" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Hip */}
                  <line x1="72" y1="114" x2="108" y2="114" stroke="rgba(255,255,255,.6)" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Torso */}
                  <line x1="90" y1="46" x2="90" y2="114" stroke="rgba(255,255,255,.85)" strokeWidth="4" strokeLinecap="round"/>
                  {/* Shoulder line */}
                  <line x1="63" y1="60" x2="117" y2="60" stroke="rgba(255,255,255,.85)" strokeWidth="3.5" strokeLinecap="round"/>
                  {/* Neck */}
                  <line x1="90" y1="33" x2="90" y2="46" stroke="rgba(255,255,255,.85)" strokeWidth="3" strokeLinecap="round"/>
                  {/* Head */}
                  <circle cx="90" cy="20" r="13" stroke="rgba(255,255,255,.85)" strokeWidth="2" fill="rgba(255,255,255,.06)"/>
                  {/* Deltoid glows */}
                  <circle cx="63" cy="60" r="12" fill="rgba(255,140,40,.25)"/>
                  <circle cx="117" cy="60" r="12" fill="rgba(255,140,40,.25)"/>

                  {/* LEFT UPPER ARM: amber deltoid, sweeps from hanging to horizontal */}
                  <line x1="63" y1="60" stroke="rgba(230,130,30,.9)" strokeWidth="5" strokeLinecap="round">
                    <animate attributeName="x2" values="51;28;51" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <animate attributeName="y2" values="88;60;88" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  </line>
                  <circle cx="63" cy="60" r="5.5" fill="rgba(230,130,30,.9)"/>

                  {/* LEFT FOREARM: extends outward at the same height */}
                  <line stroke="rgba(255,255,255,.82)" strokeWidth="4" strokeLinecap="round">
                    <animate attributeName="x1" values="51;28;51" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <animate attributeName="y1" values="88;60;88" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <animate attributeName="x2" values="43;8;43"  dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <animate attributeName="y2" values="112;60;112" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  </line>
                  {/* Left elbow dot */}
                  <circle r="4" fill="rgba(230,130,30,.85)">
                    <animate attributeName="cx" values="51;28;51" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <animate attributeName="cy" values="88;60;88" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  </circle>
                  {/* Left dumbbell */}
                  <g>
                    <animateTransform attributeName="transform" type="translate"
                      values="43,112; 8,60; 43,112" dur="2.6s" repeatCount="indefinite"
                      calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <rect x="-9" y="-3" width="18" height="6" rx="2" fill="rgba(200,200,200,.75)"/>
                    <rect x="-15" y="-6" width="7" height="12" rx="2" fill="rgba(160,160,160,.85)"/>
                    <rect x="8"  y="-6" width="7" height="12" rx="2" fill="rgba(160,160,160,.85)"/>
                  </g>

                  {/* RIGHT UPPER ARM: amber deltoid (mirror) */}
                  <line x1="117" y1="60" stroke="rgba(230,130,30,.9)" strokeWidth="5" strokeLinecap="round">
                    <animate attributeName="x2" values="129;152;129" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <animate attributeName="y2" values="88;60;88"    dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  </line>
                  <circle cx="117" cy="60" r="5.5" fill="rgba(230,130,30,.9)"/>

                  {/* RIGHT FOREARM */}
                  <line stroke="rgba(255,255,255,.82)" strokeWidth="4" strokeLinecap="round">
                    <animate attributeName="x1" values="129;152;129" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <animate attributeName="y1" values="88;60;88"    dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <animate attributeName="x2" values="137;172;137" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <animate attributeName="y2" values="112;60;112"  dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  </line>
                  {/* Right elbow dot */}
                  <circle r="4" fill="rgba(230,130,30,.85)">
                    <animate attributeName="cx" values="129;152;129" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <animate attributeName="cy" values="88;60;88"    dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                  </circle>
                  {/* Right dumbbell */}
                  <g>
                    <animateTransform attributeName="transform" type="translate"
                      values="137,112; 172,60; 137,112" dur="2.6s" repeatCount="indefinite"
                      calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
                    <rect x="-9" y="-3" width="18" height="6" rx="2" fill="rgba(200,200,200,.75)"/>
                    <rect x="-15" y="-6" width="7" height="12" rx="2" fill="rgba(160,160,160,.85)"/>
                    <rect x="8"  y="-6" width="7" height="12" rx="2" fill="rgba(160,160,160,.85)"/>
                  </g>
                </svg>

                <p style={{
                  fontSize:13, color:"rgba(255,255,255,.45)", marginTop:8,
                  fontWeight:500, letterSpacing:".01em",
                }}>
                  Raise arms out to shoulder height, lower slowly
                </p>
              </div>
            )}

            {/* ── LEG PRESS INTRO OVERLAY ── */}
            {legPressIntro && (
              <div style={{
                position:"absolute", inset:0, zIndex:45,
                display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center",
                background:"rgba(5,6,5,.92)",
                backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
                padding:"0 28px",
                animation:"fadein .4s ease",
              }}>
                {/* Muscle target */}
                <span style={{
                  fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".16em",
                  color:"rgba(255,255,255,.5)", background:"rgba(255,255,255,.08)",
                  padding:"4px 14px", borderRadius:8, marginBottom:16,
                  border:"1px solid rgba(255,255,255,.12)",
                }}>Target Muscle</span>

                {/* Body silhouette with quad highlight */}
                <svg viewBox="0 0 120 200" width="100" height="166" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom:8 }}>
                  {/* Head */}
                  <circle cx="60" cy="16" r="12" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" fill="rgba(255,255,255,.05)"/>
                  {/* Neck */}
                  <line x1="60" y1="28" x2="60" y2="38" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeLinecap="round"/>
                  {/* Torso */}
                  <line x1="60" y1="38" x2="60" y2="95" stroke="rgba(255,255,255,.35)" strokeWidth="3.5" strokeLinecap="round"/>
                  {/* Shoulders */}
                  <line x1="32" y1="46" x2="88" y2="46" stroke="rgba(255,255,255,.35)" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Arms */}
                  <line x1="32" y1="46" x2="22" y2="80" stroke="rgba(255,255,255,.25)" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="88" y1="46" x2="98" y2="80" stroke="rgba(255,255,255,.25)" strokeWidth="2" strokeLinecap="round"/>
                  {/* Hips */}
                  <line x1="40" y1="95" x2="80" y2="95" stroke="rgba(255,255,255,.3)" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* QUAD HIGHLIGHT: left */}
                  <rect x="28" y="95" width="18" height="52" rx="9" fill="rgba(209,244,125,.65)"/>
                  {/* QUAD HIGHLIGHT: right */}
                  <rect x="74" y="95" width="18" height="52" rx="9" fill="rgba(209,244,125,.65)"/>
                  {/* Shins */}
                  <line x1="37" y1="147" x2="32" y2="192" stroke="rgba(255,255,255,.25)" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="83" y1="147" x2="88" y2="192" stroke="rgba(255,255,255,.25)" strokeWidth="2" strokeLinecap="round"/>
                </svg>

                <p style={{ fontSize:17, fontWeight:700, color:"white", margin:"0 0 4px" }}>Quadriceps</p>
                <p style={{ fontSize:12, color:"rgba(255,255,255,.45)", margin:"0 0 22px" }}>Front of thigh</p>

                {/* Foot placement diagram */}
                <div style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)",
                  borderRadius:16, padding:"14px 20px", marginBottom:20, width:"100%" }}>
                  <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:".1em", color:"rgba(255,255,255,.4)", margin:"0 0 10px", textAlign:"center" }}>
                    Foot Placement
                  </p>
                  <svg viewBox="0 0 200 90" width="100%" height="70" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Platform */}
                    <rect x="10" y="60" width="180" height="16" rx="4" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.2)" strokeWidth="1"/>
                    {/* Left foot */}
                    <rect x="52" y="38" width="28" height="22" rx="5"
                      fill="rgba(209,244,125,.35)" stroke="rgba(209,244,125,.7)" strokeWidth="1.5"
                      transform="rotate(-8 66 49)"/>
                    {/* Right foot */}
                    <rect x="120" y="38" width="28" height="22" rx="5"
                      fill="rgba(209,244,125,.35)" stroke="rgba(209,244,125,.7)" strokeWidth="1.5"
                      transform="rotate(8 134 49)"/>
                    {/* Hip-width indicator */}
                    <line x1="66" y1="28" x2="134" y2="28" stroke="rgba(255,255,255,.3)" strokeWidth="1" strokeDasharray="3,3"/>
                    <line x1="66" y1="24" x2="66" y2="32" stroke="rgba(255,255,255,.3)" strokeWidth="1"/>
                    <line x1="134" y1="24" x2="134" y2="32" stroke="rgba(255,255,255,.3)" strokeWidth="1"/>
                    <text x="100" y="22" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,.45)" fontFamily="sans-serif">hip-width</text>
                  </svg>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,.45)", margin:"6px 0 0", textAlign:"center", lineHeight:1.5 }}>
                    Mid-platform · toes slightly out
                  </p>
                </div>

                <button
                  onClick={() => setLegPressIntro(false)}
                  style={{
                    width:"100%", height:50, borderRadius:14,
                    background:"var(--color-forest-canopy)",
                    border:"none", fontWeight:700, fontSize:15,
                    color:"var(--color-ink)", cursor:"pointer",
                  }}>
                  Got it, Start
                </button>
              </div>
            )}

            {/* Step-into-frame nudge */}
            {noBody && (
              <div style={{ position:"absolute", inset:0, display:"grid",
                placeItems:"center", background:"rgba(0,0,0,.25)", pointerEvents:"none" }}>
                <div style={{ background:"rgba(0,0,0,.55)", backdropFilter:"blur(12px)",
                  border:"1px solid rgba(255,255,255,.15)", borderRadius:14,
                  padding:"10px 22px" }}>
                  <span style={{ color:"rgba(255,255,255,.85)", fontSize:14, fontWeight:600 }}>
                    Step into frame
                  </span>
                </div>
              </div>
            )}

            {/* REC + mute toggle */}
            <div style={{ position:"absolute", top:18, left:"50%", transform:"translateX(-50%)",
              display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:"#f23",
                  animation:"pulsedot 1.2s ease-in-out infinite" }}/>
                <span style={{ color:"rgba(255,255,255,.55)", fontSize:10,
                  fontWeight:700, letterSpacing:".12em" }}>REC</span>
              </div>
              <button
                onClick={() => {
                  const next = !muted;
                  mutedRef.current = next;
                  setMuted(next);
                  if (next) window.speechSynthesis?.cancel();
                  else speak("Voice on");
                }}
                title={muted ? "Unmute voice" : "Mute voice"}
                style={{
                  background:"rgba(0,0,0,.4)", backdropFilter:"blur(12px)",
                  border:"1px solid rgba(255,255,255,.18)", borderRadius:8,
                  width:32, height:32, display:"grid", placeItems:"center",
                  cursor:"pointer", fontSize:15, lineHeight:1,
                  color: muted ? "rgba(255,255,255,.35)" : "white",
                }}>
                {muted ? "🔇" : "🔊"}
              </button>
            </div>

            {/* Top bar: exercise name + set */}
            <div style={{ position:"absolute", top:14, left:18, right:18,
              display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
              <div style={{ background:"rgba(0,0,0,.45)", backdropFilter:"blur(18px)",
                WebkitBackdropFilter:"blur(18px)", borderRadius:14, padding:"10px 18px",
                border:"1px solid rgba(255,255,255,.15)" }}>
                <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                  letterSpacing:".1em", color:"rgba(255,255,255,.5)", margin:"0 0 3px" }}>Exercise</p>
                <span style={{ color:"white", fontSize:16, fontWeight:700,
                  letterSpacing:"-.01em" }}>{ex.name}</span>
              </div>
              <div style={{ background:"rgba(0,0,0,.45)", backdropFilter:"blur(18px)",
                WebkitBackdropFilter:"blur(18px)", borderRadius:14, padding:"10px 18px",
                border:"1px solid rgba(255,255,255,.15)", textAlign:"right" }}>
                <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                  letterSpacing:".1em", color:"rgba(255,255,255,.5)", margin:"0 0 3px" }}>Set</p>
                <span style={{ color:"white", fontSize:16, fontWeight:700 }}>
                  {currentSet} <span style={{ color:"rgba(255,255,255,.4)", fontSize:13 }}>/ {ex.sets}</span>
                </span>
              </div>
            </div>

            {/* Rep counter: auto for pose exercises, manual for leg press */}
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:18,
              pointerEvents: ex.type === "legpress" ? "auto" : "none" }}>

              {ex.type === "legpress" && !legPressIntro ? (
                /* ── MANUAL LEG PRESS COUNTER ── */
                <div style={{
                  background:"rgba(0,0,0,.55)", backdropFilter:"blur(24px)",
                  WebkitBackdropFilter:"blur(24px)",
                  border:"1px solid rgba(255,255,255,.15)",
                  borderRadius:28, padding:"20px 40px",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:12,
                }}>
                  <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:".14em", color:"rgba(255,255,255,.4)" }}>
                    Leg Press · Tap to count
                  </span>
                  <span style={{
                    fontSize:108, fontWeight:400, lineHeight:1, color:"white",
                    textShadow:"0 4px 32px rgba(0,0,0,.5)",
                  }}>
                    {reps}
                  </span>
                  <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:".14em",
                    color: reps >= ex.reps ? "rgba(80,220,130,.95)" : "rgba(255,255,255,.4)" }}>
                    {reps >= ex.reps ? "✓  Set Complete" : `of ${ex.reps} reps`}
                  </span>
                  <div style={{ display:"flex", gap:14, marginTop:4 }}>
                    <button
                      onClick={() => setReps(r => Math.max(0, r - 1))}
                      style={{
                        width:56, height:56, borderRadius:"50%",
                        background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)",
                        color:"white", fontSize:26, fontWeight:300, cursor:"pointer",
                        display:"grid", placeItems:"center", lineHeight:1,
                      }}>−</button>
                    <button
                      onClick={() => setReps(r => r + 1)}
                      style={{
                        width:56, height:56, borderRadius:"50%",
                        background:"rgba(209,244,125,.9)", border:"none",
                        color:"#1a1a1a", fontSize:26, fontWeight:700, cursor:"pointer",
                        display:"grid", placeItems:"center", lineHeight:1,
                      }}>+</button>
                  </div>
                </div>
              ) : ex.type !== "legpress" ? (
                /* ── AUTO POSE COUNTER ── */
                <div style={{
                  background:"rgba(0,0,0,.35)", backdropFilter:"blur(24px)",
                  WebkitBackdropFilter:"blur(24px)",
                  border: repFlash === "bad"
                    ? "1.5px solid rgba(255,80,80,.65)"
                    : repFlash === "good"
                      ? "1.5px solid rgba(80,220,130,.65)"
                      : "1px solid rgba(255,255,255,.15)",
                  borderRadius:24, padding:"16px 52px",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                  transition:"border-color .25s",
                }}>
                  <span style={{
                    fontSize:108, fontWeight:400, lineHeight:1,
                    color: repFlash === "bad" ? "#ff5050" : repFlash === "good" ? "#50dc80" : "white",
                    textShadow:"0 4px 32px rgba(0,0,0,.5)",
                    animation: repFlash === "good" ? "repgood .5s ease"
                      : repFlash === "bad" ? "repbad .4s ease" : "none",
                    transition:"color .25s",
                  }}>
                    {reps}
                  </span>
                  <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:".14em",
                    color: reps >= ex.reps ? "rgba(80,220,130,.95)" : "rgba(255,255,255,.4)" }}>
                    {reps >= ex.reps ? "✓  Set Complete" : `of ${ex.reps} reps`}
                  </span>
                </div>
              ) : null}

            </div>

            {/* Form cue pill */}
            {formCue && (
              <div style={{ position:"absolute", bottom:84, left:"50%",
                transform:"translateX(-50%)", whiteSpace:"nowrap" }}>
                <div style={{
                  background: formStatus === "bad" ? "rgba(180,40,40,.5)" : "rgba(0,0,0,.45)",
                  backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)",
                  border: formStatus === "bad"
                    ? "1px solid rgba(255,100,100,.45)"
                    : "1px solid rgba(255,255,255,.14)",
                  borderRadius:12, padding:"8px 18px",
                }}>
                  <span style={{
                    color: formStatus === "bad" ? "#ff8888" : "rgba(255,255,255,.85)",
                    fontSize:13, fontWeight:600,
                  }}>
                    {formStatus === "bad" ? "⚠️  " : ""}{formCue}
                  </span>
                </div>
              </div>
            )}

            {/* Bottom controls */}
            <div style={{ position:"absolute", bottom:24, left:18, right:18,
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <button onClick={exitCamera} style={{
                background:"rgba(0,0,0,.4)", backdropFilter:"blur(14px)",
                WebkitBackdropFilter:"blur(14px)",
                border:"1px solid rgba(255,255,255,.15)", borderRadius:12,
                padding:"10px 20px", color:"rgba(255,255,255,.75)",
                fontSize:13, fontWeight:600, cursor:"pointer" }}>← Back</button>

              <div style={{
                background:"rgba(0,0,0,.35)", backdropFilter:"blur(10px)",
                border:"1px solid rgba(255,255,255,.12)", borderRadius:10,
                padding:"6px 14px", display:"flex", alignItems:"center", gap:6,
              }}>
                <span style={{ fontSize:13 }}>🎤</span>
                <span style={{ fontSize:11, color:"rgba(255,255,255,.55)", fontWeight:600 }}>
                  "skip" · "pause" · "end workout"
                </span>
              </div>
            </div>

            {/* ── REST OVERLAY ── */}
            {restActive && (() => {
              const r = 72;
              const circ = 2 * Math.PI * r;
              const offset = circ * (1 - restSeconds / 60);
              const nextLabel = currentSet < ex.sets
                ? `Set ${currentSet + 1} of ${ex.sets}`
                : exIdx < activeWorkoutRef.current.exercises.length - 1
                  ? `Next: ${activeWorkoutRef.current.exercises[exIdx + 1].name}`
                  : "Last set done!";
              const statLine = lastSetStats
                ? lastSetStats.bad === 0
                  ? `${lastSetStats.good} / ${lastSetStats.target} · clean set`
                  : `${lastSetStats.good} / ${lastSetStats.target} · ${lastSetStats.bad} redo${lastSetStats.bad > 1 ? "s" : ""}`
                : null;
              return (
                <div style={{
                  position:"absolute", inset:0, zIndex:40,
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  background:"rgba(5,6,5,.86)",
                  backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
                }}>
                  {/* Label */}
                  <p style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:".2em", color:"rgba(255,255,255,.4)", margin:"0 0 24px" }}>
                    REST
                  </p>

                  {/* Circular countdown */}
                  <div style={{ position:"relative", width:176, height:176 }}>
                    <svg width="176" height="176" viewBox="0 0 176 176" style={{ position:"absolute", inset:0 }}>
                      <circle cx="88" cy="88" r={r} fill="none"
                        stroke="rgba(255,255,255,.08)" strokeWidth="4"/>
                      <circle cx="88" cy="88" r={r} fill="none"
                        stroke="rgba(255,255,255,.9)" strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        transform="rotate(-90 88 88)"
                        style={{ transition:"stroke-dashoffset 1s linear" }}
                      />
                    </svg>
                    <div style={{ position:"absolute", inset:0, display:"flex",
                      flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:64, fontWeight:300, lineHeight:1, color:"white" }}>
                        {restSeconds}
                      </span>
                      <span style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                        letterSpacing:".1em", color:"rgba(255,255,255,.35)", marginTop:4 }}>
                        sec
                      </span>
                    </div>
                  </div>

                  {/* Set stats */}
                  <div style={{ textAlign:"center", margin:"20px 0 6px" }}>
                    {statLine && (
                      <p style={{ fontSize:14, fontWeight:500,
                        color: lastSetStats?.bad === 0 ? "rgba(209,244,125,.85)" : "rgba(255,160,70,.85)",
                        margin:"0 0 6px" }}>
                        {statLine}
                      </p>
                    )}
                    <p style={{ fontSize:12, color:"rgba(255,255,255,.3)", margin:0, fontWeight:500 }}>
                      {nextLabel}
                    </p>
                  </div>

                  {/* Skip button */}
                  <button onClick={advanceAfterRest} style={{
                    marginTop:28,
                    background:"rgba(255,255,255,.1)",
                    border:"1px solid rgba(255,255,255,.18)", borderRadius:10,
                    padding:"10px 26px", color:"rgba(255,255,255,.7)",
                    fontSize:13, fontWeight:600, cursor:"pointer", letterSpacing:".02em",
                  }}>
                    Skip Rest
                  </button>
                </div>
              );
            })()}

            {/* ── VOICE COMMAND FEEDBACK OVERLAY ── */}
            {voiceCmd && (
              <div
                onClick={cancelVoiceCmd}
                style={{
                  position:"absolute", inset:0, zIndex:50,
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  background:"rgba(5,6,5,.88)",
                  backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
                  cursor:"pointer",
                }}
              >
                {/* Draining progress bar at top */}
                <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
                  background:"rgba(255,255,255,.12)" }}>
                  <div style={{
                    height:"100%", background:"var(--color-forest-canopy)",
                    animation:"vc-drain 4s linear forwards",
                    transformOrigin:"left",
                  }}/>
                </div>
                <style>{`@keyframes vc-drain { from { width:100% } to { width:0% } }`}</style>

                {/* Mic pulse ring */}
                <div style={{ position:"relative", marginBottom:28 }}>
                  <div style={{
                    width:64, height:64, borderRadius:"50%",
                    background:"rgba(209,244,125,.12)",
                    animation:"vc-pulse 1.2s ease-out infinite",
                    position:"absolute", inset:-10,
                  }}/>
                  <style>{`@keyframes vc-pulse { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(1.6);opacity:0} }`}</style>
                  <div style={{
                    width:64, height:64, borderRadius:"50%",
                    background:"rgba(209,244,125,.18)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:26,
                  }}>
                    {voiceCmd.icon}
                  </div>
                </div>

                <p style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                  letterSpacing:".18em", color:"rgba(255,255,255,.35)", margin:"0 0 10px" }}>
                  Voice command
                </p>
                <p style={{ fontSize:24, fontWeight:700, color:"white",
                  margin:"0 0 32px", letterSpacing:"-.01em" }}>
                  {voiceCmd.label}
                </p>

                <p style={{ fontSize:13, color:"rgba(255,255,255,.3)", margin:0 }}>
                  Tap anywhere to cancel
                </p>
              </div>
            )}

            {/* ── PAUSE OVERLAY ── */}
            {paused && (
              <div style={{
                position:"absolute", inset:0, zIndex:40,
                display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center", gap:0,
                background:"rgba(5,6,5,.82)",
                backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
              }}>
                <p style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                  letterSpacing:".18em", color:"rgba(255,255,255,.45)", margin:"0 0 28px" }}>
                  PAUSED
                </p>
                <span style={{ fontSize:72, lineHeight:1, marginBottom:28 }}>⏸</span>
                <p style={{ fontSize:14, color:"rgba(255,255,255,.45)", margin:"0 0 32px",
                  fontWeight:500 }}>
                  Say "continue" or tap to resume
                </p>
                <button onClick={resumeWorkout} style={{
                  background:"rgba(255,255,255,.12)",
                  border:"1px solid rgba(255,255,255,.22)", borderRadius:12,
                  padding:"11px 28px", color:"rgba(255,255,255,.8)",
                  fontSize:14, fontWeight:600, cursor:"pointer",
                  backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
                  marginBottom:16,
                }}>
                  Resume →
                </button>
                <button onClick={endWorkout} style={{
                  background:"transparent", border:"none",
                  color:"rgba(255,255,255,.35)", fontSize:13,
                  fontWeight:500, cursor:"pointer", padding:"8px 16px",
                }}>
                  End workout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
