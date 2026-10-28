export type TrackingMode = "camera" | "manual";

export type LoggedSet = {
  exercise: string;
  set: number;
  reps: number;
  target: number;
  flaggedReps: number;
};

export type WorkoutSession = {
  id: string;
  workoutName: string;
  completedAt: string;
  mode: TrackingMode;
  sets: LoggedSet[];
};

const STORAGE_KEY = "upform_sessions_v1";

export function createSession(
  workoutName: string,
  mode: TrackingMode,
  sets: LoggedSet[],
): WorkoutSession {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()) + "-" + Math.random().toString(36).slice(2),
    workoutName,
    completedAt: new Date().toISOString(),
    mode,
    sets: sets.map((set) => ({
      exercise: String(set.exercise),
      set: Math.max(1, Math.trunc(set.set)),
      reps: Math.max(0, Math.trunc(set.reps)),
      target: Math.max(1, Math.trunc(set.target)),
      flaggedReps: Math.max(0, Math.trunc(set.flaggedReps)),
    })),
  };
}

export function readSessions(): WorkoutSession[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is WorkoutSession => {
      if (!value || typeof value !== "object") return false;
      const session = value as Partial<WorkoutSession>;
      return typeof session.id === "string"
        && typeof session.workoutName === "string"
        && typeof session.completedAt === "string"
        && !Number.isNaN(Date.parse(session.completedAt))
        && (session.mode === "camera" || session.mode === "manual")
        && Array.isArray(session.sets)
        && session.sets.every((set) =>
          typeof set.exercise === "string"
          && Number.isFinite(set.reps)
          && Number.isFinite(set.target));
    }).slice(0, 100);
  } catch {
    return [];
  }
}

export function persistSession(session: WorkoutSession): WorkoutSession[] {
  const sessions = [session, ...readSessions()].slice(0, 100);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // The current session still appears in the UI if storage is unavailable.
  }
  return sessions;
}

export function workoutStreak(sessions: WorkoutSession[], now = new Date()): number {
  const localDay = (date: Date) =>
    date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") +
    "-" + String(date.getDate()).padStart(2, "0");
  const trained = new Set(sessions.map((session) => localDay(new Date(session.completedAt))));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!trained.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (trained.has(localDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function sessionTotals(session: WorkoutSession) {
  return {
    sets: session.sets.length,
    reps: session.sets.reduce((sum, set) => sum + set.reps, 0),
    exercises: new Set(session.sets.map((set) => set.exercise)).size,
  };
}
