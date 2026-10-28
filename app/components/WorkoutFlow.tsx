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
  const activeCompleted = completed.filter((item) => item.exercise === exercise.name);
  const lastSet = setIndex >= exercise.sets;
  const lastExercise = exerciseIndex >= workout.exercises.length - 1;

  function logSet() {
    if (reps < 1) return;
    const next = [...completed, {
      exercise: exercise.name,
      set: setIndex,
      reps,
      target: exercise.reps,
      flaggedReps: 0,
    }];
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
          <button className={styles.back} onClick={() => setConfirmExit(true)} aria-label="Leave workout">‹</button>
          <span className={styles.brand}>upform<span className={styles.brandDot}>.</span></span>
          <span className={styles.mode}>MANUAL</span>
        </header>

        <main className={styles.body}>
          <div className={styles.overline}>IN PROGRESS</div>
          <h1 className={styles.title}>{workout.name}</h1>
          <div className={styles.progressMeta}>
            <span>{completed.length} of {totalSets} sets complete</span>
            <strong>{progress}%</strong>
          </div>
          <div className={styles.track} role="progressbar" aria-label="Workout progress" aria-valuenow={completed.length} aria-valuemin={0} aria-valuemax={totalSets}>
            <div style={{ width: progress + "%" }} />
          </div>

          <section className={styles.exerciseOverview} aria-label="Workout exercises">
            {workout.exercises.map((item, index) => {
              const done = completed.filter((set) => set.exercise === item.name).length;
              const active = index === exerciseIndex;
              return (
                <div className={active ? styles.overviewActive : styles.overviewRow} key={index}>
                  <span className={styles.exerciseIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <div className={styles.overviewName}>
                    <strong>{item.name}</strong>
                    <small>{item.sets} sets · {item.reps} reps</small>
                  </div>
                  <span className={styles.overviewProgress}>{done === item.sets ? "✓" : active ? "NOW" : done + "/" + item.sets}</span>
                </div>
              );
            })}
          </section>

          <section className={styles.activeCard} aria-label="Log current set">
            <div className={styles.setTopline}>
              <span>SET {setIndex} OF {exercise.sets}</span>
              <span>{exercise.reps} REP TARGET</span>
            </div>
            <h2>{exercise.name}</h2>
            <div className={styles.counterLabel}>Repetitions completed</div>
            <div className={styles.counterRow}>
              <button type="button" onClick={() => setReps((value) => Math.max(0, value - 1))} aria-label="Remove one rep">−</button>
              <div className={styles.counter}>
                <input aria-label="Repetitions completed" type="number" min={0} max={999} inputMode="numeric"
                  value={reps} onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) setReps(Math.min(999, Math.max(0, Math.trunc(value))));
                  }} />
              </div>
              <button type="button" onClick={() => setReps((value) => Math.min(999, value + 1))} aria-label="Add one rep">+</button>
            </div>
            <button type="button" className={styles.target} onClick={() => setReps(exercise.reps)}>
              Set to target ({exercise.reps})
            </button>
            <div className={styles.setIndicators} aria-label="Set completion">
              {Array.from({ length: exercise.sets }, (_, index) => (
                <span key={index} className={index < activeCompleted.length ? styles.setDone : index === setIndex - 1 ? styles.setCurrent : styles.setPending}>
                  {index < activeCompleted.length ? "✓" : index + 1}
                </span>
              ))}
            </div>
          </section>
          <p className={styles.note}>Log what you actually completed. Camera tracking is optional.</p>
        </main>

        <footer className={styles.footer}>
          <button className={styles.primary} onClick={logSet} disabled={reps === 0}>
            {lastSet && lastExercise ? "Finish workout" : "Complete set"}
            <span aria-hidden="true">→</span>
          </button>
        </footer>

        {confirmExit && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Leave workout">
              <h2>Leave workout?</h2>
              <p>Your unfinished manual sets have not been saved.</p>
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
          <span className={styles.mode}>COMPLETED</span>
        </header>
        <main className={styles.body}>
          <div className={styles.completeIcon} aria-hidden="true">✓</div>
          <div className={styles.overline}>SESSION COMPLETE</div>
          <h1 className={styles.summaryTitle}>Workout done.</h1>
          <p className={styles.summarySub}>{session.workoutName} · {session.mode === "manual" ? "Manual log" : "Phone tracking"}</p>

          <div className={styles.stats} aria-label="Workout totals">
            <div><strong>{totals.sets}</strong><span>Sets</span></div>
            <div><strong>{totals.reps}</strong><span>Reps</span></div>
            <div><strong>{totals.exercises}</strong><span>Exercises</span></div>
          </div>

          <h2 className={styles.sectionTitle}>Session recap</h2>
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
            <p className={styles.note}>Form cues are movement estimates, not a guarantee of safe technique.</p>
          )}
          <p className={styles.savedNote}>Stored on this device. Camera video is not saved.</p>
        </main>
        <footer className={styles.footer}>
          <button className={styles.primary} onClick={onDone}>Done <span aria-hidden="true">→</span></button>
        </footer>
      </div>
    </div>
  );
}
