"use client";

import { useState } from "react";
import type { LoggedSet, WorkoutSession } from "../../lib/session";
import { createSession, sessionTotals } from "../../lib/session";
import styles from "./WorkoutFlow.module.css";

type Exercise = { name: string; sets: number; reps: number; type: string };
type Workout = { name: string; exercises: Exercise[] };

export function ManualWorkout({
  workout,
  onFinish,
  onExit,
}: {
  workout: Workout;
  onFinish: (session: WorkoutSession) => void;
  onExit: () => void;
}) {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(1);
  const [reps, setReps] = useState(0);
  const [completed, setCompleted] = useState<LoggedSet[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);
  const exercise = workout.exercises[exerciseIndex];
  const totalSets = workout.exercises.reduce((sum, item) => sum + item.sets, 0);
  const progress = Math.round(100 * completed.length / Math.max(totalSets, 1));

  function logSet() {
    if (reps < 1) return;
    const next = [...completed, {
      exercise: exercise.name,
      set: setIndex,
      reps,
      target: exercise.reps,
      flaggedReps: 0,
    }];
    const lastSet = setIndex >= exercise.sets;
    const lastExercise = exerciseIndex >= workout.exercises.length - 1;
    if (lastSet && lastExercise) {
      onFinish(createSession(workout.name, "manual", next));
      return;
    }
    setCompleted(next);
    setReps(0);
    if (lastSet) {
      setExerciseIndex((index) => index + 1);
      setSetIndex(1);
    } else {
      setSetIndex((index) => index + 1);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.phone}>
        <header className={styles.top}>
          <button className={styles.back} onClick={() => setConfirmExit(true)} aria-label="Exit workout">←</button>
          <span className={styles.brand}>upform<span className={styles.brandDot}>.</span></span>
          <span className={styles.mode}>MANUAL LOG</span>
        </header>

        <div className={styles.body}>
          <p className={styles.eyebrow}>YOUR SESSION</p>
          <h1 className={styles.title}>{workout.name}</h1>
          <div className={styles.track}><div style={{ width: progress + "%" }} /></div>
          <div className={styles.trackMeta}>
            <span>{completed.length} of {totalSets} sets logged</span>
            <span>{progress}%</span>
          </div>

          <section className={styles.exerciseCard} aria-label="Current exercise">
            <div className={styles.exerciseTop}>
              <span>EXERCISE {exerciseIndex + 1} / {workout.exercises.length}</span>
              <span>SET {setIndex} / {exercise.sets}</span>
            </div>
            <h2>{exercise.name}</h2>
            <p>Target: {exercise.reps} controlled reps</p>
            <div className={styles.counterRow}>
              <button onClick={() => setReps((value) => Math.max(0, value - 1))} aria-label="Remove one rep">−</button>
              <div className={styles.counter} aria-live="polite" aria-atomic="true">
                <span>{reps}</span><small>REPS</small>
              </div>
              <button onClick={() => setReps((value) => Math.min(999, value + 1))} aria-label="Add one rep">+</button>
            </div>
            <button className={styles.target} onClick={() => setReps(exercise.reps)}>
              Use target · {exercise.reps} reps
            </button>
          </section>

          <p className={styles.note}>No camera needed. Log what you actually completed — you can use UpForm even when tracking isn’t available.</p>
        </div>

        <div className={styles.footer}>
          <button className={styles.primary} onClick={logSet} disabled={reps === 0}>
            {exerciseIndex === workout.exercises.length - 1 && setIndex === exercise.sets
              ? "Finish & save workout" : "Save set & continue"}
            <span>→</span>
          </button>
        </div>

        {confirmExit && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Discard workout">
              <h2>Leave this workout?</h2>
              <p>Your unfinished manual sets haven’t been saved.</p>
              <button className={styles.primary} onClick={() => setConfirmExit(false)}>Keep training</button>
              <button className={styles.textButton} onClick={onExit}>Discard workout</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkoutSummary({
  session,
  onDone,
}: {
  session: WorkoutSession;
  onDone: () => void;
}) {
  const totals = sessionTotals(session);
  const exercises = Array.from(new Set(session.sets.map((item) => item.exercise)));

  return (
    <div className={styles.shell}>
      <div className={styles.phone}>
        <header className={styles.top}>
          <span className={styles.brand}>upform<span className={styles.brandDot}>.</span></span>
          <span className={styles.mode}>SESSION SAVED</span>
        </header>
        <main className={styles.body}>
          <div className={styles.completeIcon} aria-hidden="true">✓</div>
          <p className={styles.eyebrow}>NICE WORK</p>
          <h1 className={styles.summaryTitle}>One workout<br />stronger.</h1>
          <p className={styles.summarySub}>{session.workoutName} · {session.mode === "manual" ? "Manual log" : "Phone camera"}</p>
          <div className={styles.stats}>
            <div><strong>{totals.sets}</strong><span>SETS</span></div>
            <div><strong>{totals.reps}</strong><span>REPS</span></div>
            <div><strong>{totals.exercises}</strong><span>MOVES</span></div>
          </div>
          <p className={styles.eyebrow}>YOUR SESSION</p>
          <div className={styles.summaryList}>
            {exercises.map((name) => {
              const sets = session.sets.filter((item) => item.exercise === name);
              return (
                <div key={name} className={styles.summaryItem}>
                  <div><strong>{name}</strong><small>{sets.length} sets · {sets.reduce((sum, item) => sum + item.reps, 0)} reps</small></div>
                  <span aria-hidden="true">✓</span>
                </div>
              );
            })}
          </div>
          {session.mode === "camera" && (
            <p className={styles.note}>Pose cues are movement estimates, not a guarantee of safe form. Stop if an exercise causes pain.</p>
          )}
          <p className={styles.savedNote}>Saved on this device. Your camera video is not stored.</p>
        </main>
        <div className={styles.footer}>
          <button className={styles.primary} onClick={onDone}>Back to home <span>→</span></button>
        </div>
      </div>
    </div>
  );
}
