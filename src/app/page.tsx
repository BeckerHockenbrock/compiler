"use client";

import { useState } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import type { TaskPriority } from "@/domain/types";

export default function HomeDashboard() {
  const { state, isHydrated, error, levelProgress, addTask, finishTask } =
    useAppStore();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [xpReward, setXpReward] = useState<number>(50);
  const [showCompleted, setShowCompleted] = useState(true);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Link priority to sensible stat reward attribution
    const statRewards: Record<string, number> = {};
    if (priority === "urgent" || priority === "high") {
      statRewards.discipline = 10;
    } else {
      statRewards.discipline = 5;
    }

    const success = addTask({
      title: title.trim(),
      priority,
      xpReward,
      statRewards,
    });

    if (success) {
      setTitle("");
      setPriority("medium");
      setXpReward(50);
    }
  };

  if (!isHydrated) {
    return (
      <main className="app-viewport" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Initializing progression system...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-viewport" style={{ justifyContent: "center" }}>
        <div className="hud-card" style={{ textAlign: "center" }}>
          <h2 style={{ color: "var(--rose-accent)", marginBottom: "8px" }}>Storage Unavailable</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: "1.5" }}>
            {error.message}
          </p>
        </div>
      </main>
    );
  }

  if (!state || !levelProgress) {
    return null;
  }

  const pendingTasks = state.tasks.filter((t) => t.status === "pending");
  const completedTasks = state.tasks.filter((t) => t.status === "completed");

  const statEntries = state.statDefinitions.slice(0, 3).map((def) => {
    const val = state.stats[def.id]?.current ?? 0;
    return { name: def.name, value: val };
  });

  return (
    <main className="app-viewport">
      {/* Anime / Game HUD Header */}
      <section className="hud-card">
        <div className="hud-top-bar">
          <span className="level-badge">LV. {levelProgress.level} Adventurer</span>
          <span className="points-pill">
            {state.progression.availableSkillPoints} Skill Points
          </span>
        </div>

        {/* Level XP Gauge */}
        <div className="xp-container">
          <div className="xp-label-row">
            <span>EXP PROGRESS</span>
            <span>
              {levelProgress.currentLevelXp} / {levelProgress.requiredLevelXp} ({Math.round(levelProgress.progressRatio * 100)}%)
            </span>
          </div>
          <div className="xp-bar-track">
            <div
              className="xp-bar-fill"
              style={{ width: `${Math.max(4, Math.min(100, levelProgress.progressRatio * 100))}%` }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.7rem",
              color: "var(--text-dim)",
              marginTop: "4px",
            }}
          >
            <span>Total Earned: {state.progression.totalXp} XP</span>
            <span>Next Rank: {levelProgress.nextLevelXp} XP</span>
          </div>
        </div>

        {/* Primary Stats Grid */}
        <div className="stats-grid">
          {statEntries.map((stat) => (
            <div key={stat.name} className="stat-item">
              <span className="stat-name">{stat.name}</span>
              <span className="stat-val">+{stat.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Task Creation Form */}
      <section>
        <div className="section-header">
          <h2 className="section-title">Assign Quest</h2>
        </div>
        <form className="task-form" onSubmit={handleAddTask}>
          <input
            type="text"
            className="input-field"
            placeholder="Quest title (e.g. Study algorithms 45m)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="form-row">
            <select
              className="select-field"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              aria-label="Priority"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>

            <select
              className="select-field"
              value={xpReward}
              onChange={(e) => setXpReward(Number(e.target.value))}
              aria-label="XP Reward"
            >
              <option value={25}>+25 XP</option>
              <option value={50}>+50 XP</option>
              <option value={100}>+100 XP</option>
              <option value={200}>+200 XP</option>
            </select>

            <button type="submit" className="btn-primary" disabled={!title.trim()}>
              Accept
            </button>
          </div>
        </form>
      </section>

      {/* Pending Tasks Section */}
      <section>
        <div className="section-header">
          <h2 className="section-title">Active Quests ({pendingTasks.length})</h2>
        </div>

        {pendingTasks.length === 0 ? (
          <div className="empty-state">
            No active quests. Assign a task above to begin progression.
          </div>
        ) : (
          <div className="task-list">
            {pendingTasks.map((task) => (
              <div key={task.id} className="task-card">
                <div className="task-info">
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta">
                    <span className={`priority-tag priority-${task.priority}`}>
                      {task.priority}
                    </span>
                    <span className="reward-chip">+{task.xpReward} XP</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-complete"
                  onClick={() => finishTask(task.id)}
                  aria-label={`Complete ${task.title}`}
                >
                  ✓ Complete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <section style={{ marginTop: "20px" }}>
          <div className="section-header">
            <h2 className="section-title">Completed Log ({completedTasks.length})</h2>
            <button
              type="button"
              onClick={() => setShowCompleted(!showCompleted)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-dim)",
                fontSize: "0.75rem",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              {showCompleted ? "Hide" : "Show"}
            </button>
          </div>

          {showCompleted && (
            <div className="task-list">
              {completedTasks.map((task) => (
                <div key={task.id} className="task-card completed">
                  <div className="task-info">
                    <div className="task-title">{task.title}</div>
                    <div className="task-meta">
                      <span className="priority-tag priority-low">Done</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                        +{task.xpReward} XP awarded
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-complete"
                    disabled
                    aria-label="Completed"
                  >
                    Done
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Persistence Status */}
      <footer style={{ marginTop: "auto", paddingTop: "24px" }}>
        <div className="status-banner status-normal">
          Local Storage Active · {state.progression.lifetimeCompletedTasks} Quests Completed
        </div>
      </footer>
    </main>
  );
}
