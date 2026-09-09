"use client";

import { useState, useId } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import type { Task, TaskPriority } from "@/domain/types";
import { toLocalDate, nowUtc } from "@/domain/date-time";

type ActiveTab = "quests" | "character" | "vault";

export default function HomeDashboard() {
  const {
    state,
    isHydrated,
    error,
    metrics,
    levelProgress,
    addTask,
    editTask,
    removeTask,
    finishTask,
    addHabit,
    finishHabit,
    removeHabit,
    assignSkillPoint,
    exportData,
    importData,
    resetDefaults,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>("quests");

  // Task creation state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskXp, setTaskXp] = useState<number>(50);
  const [taskDueDate, setTaskDueDate] = useState("");

  // Habit creation state
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [habitTitle, setHabitTitle] = useState("");
  const [habitXp, setHabitXp] = useState<number>(35);

  // Task edit state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("medium");
  const [editXp, setEditXp] = useState(50);
  const [editDueDate, setEditDueDate] = useState("");

  // Confirmation modal state
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Status message
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const titleId = useId();
  const priorityId = useId();
  const xpId = useId();
  const dueDateId = useId();

  const todayDate = state ? toLocalDate(nowUtc(), state.settings.timeZone) : "";

  // -----------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const statRewards: Record<string, number> = {};
    if (taskPriority === "urgent" || taskPriority === "high") {
      statRewards.discipline = 10;
    } else {
      statRewards.discipline = 5;
    }

    const ok = addTask({
      title: taskTitle.trim(),
      priority: taskPriority,
      xpReward: taskXp,
      dueDate: taskDueDate || undefined,
      statRewards,
    });

    if (ok) {
      setTaskTitle("");
      setTaskPriority("medium");
      setTaskXp(50);
      setTaskDueDate("");
      setFeedbackMsg({ type: "success", text: "Quest assigned successfully." });
    }
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditXp(task.xpReward);
    setEditDueDate(task.dueDate || "");
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    const ok = editTask(editingTask.id, {
      title: editTitle.trim(),
      priority: editPriority,
      xpReward: editXp,
      dueDate: editDueDate || undefined,
    });

    if (ok) {
      setEditingTask(null);
      setFeedbackMsg({ type: "success", text: "Quest updated." });
    }
  };

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitTitle.trim()) return;

    const ok = addHabit({
      title: habitTitle.trim(),
      xpReward: habitXp,
      statRewards: { vitality: 5, discipline: 5 },
    });

    if (ok) {
      setHabitTitle("");
      setHabitXp(35);
      setShowAddHabit(false);
      setFeedbackMsg({ type: "success", text: "Daily ritual established." });
    }
  };

  const handleExportBackup = () => {
    const json = exportData();
    if (!json) return;

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personal_progression_backup_${todayDate || "export"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedbackMsg({ type: "success", text: "Backup export downloaded." });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPendingImportFile(content);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmImport = () => {
    if (!pendingImportFile) return;

    const res = importData(pendingImportFile, true);
    setPendingImportFile(null);

    if (res.ok) {
      setFeedbackMsg({ type: "success", text: "Backup restored successfully." });
    } else {
      setFeedbackMsg({ type: "error", text: `Import failed: ${res.error.message}` });
    }
  };

  // -----------------------------------------------------------------
  // Render Guards
  // -----------------------------------------------------------------

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

  const statEntries = state.statDefinitions.map((def) => {
    const val = state.stats[def.id]?.current ?? 0;
    return { id: def.id, name: def.name, value: val };
  });

  return (
    <main className="app-viewport">
      {/* ------------------------------------------------------------ */}
      {/* Anime / Game HUD Header                                      */}
      {/* ------------------------------------------------------------ */}
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
            <span>Total: {state.progression.totalXp} XP</span>
            <span>Next Level: {levelProgress.nextLevelXp} XP</span>
          </div>
        </div>

        {/* Top 3 Stats Bar */}
        <div className="stats-grid">
          {statEntries.slice(0, 3).map((stat) => (
            <div key={stat.id} className="stat-item">
              <span className="stat-name">{stat.name}</span>
              <span className="stat-val">+{stat.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Tab Navigation                                               */}
      {/* ------------------------------------------------------------ */}
      <nav className="nav-tabs" aria-label="Main Navigation">
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === "quests" ? "active" : ""}`}
          onClick={() => setActiveTab("quests")}
        >
          ⚔️ Quests
        </button>
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === "character" ? "active" : ""}`}
          onClick={() => setActiveTab("character")}
        >
          📜 Status
        </button>
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === "vault" ? "active" : ""}`}
          onClick={() => setActiveTab("vault")}
        >
          🛡️ Vault
        </button>
      </nav>

      {/* Temporary feedback banner */}
      {feedbackMsg && (
        <div
          className={`status-banner ${feedbackMsg.type === "success" ? "status-success" : "status-error"}`}
          onClick={() => setFeedbackMsg(null)}
          style={{ cursor: "pointer", marginBottom: "12px", marginTop: "0" }}
          role="status"
        >
          {feedbackMsg.text} (tap to dismiss)
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* TAB 1: QUESTS & RITUALS                                      */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "quests" && (
        <>
          {/* Daily Rituals (Habits) */}
          <section style={{ marginBottom: "20px" }}>
            <div className="section-header">
              <h2 className="section-title">Daily Rituals ({state.habits.length})</h2>
              <button
                type="button"
                className="btn-secondary"
                style={{ minHeight: "36px", padding: "0 10px", fontSize: "0.75rem" }}
                onClick={() => setShowAddHabit(!showAddHabit)}
              >
                {showAddHabit ? "Cancel" : "+ New Ritual"}
              </button>
            </div>

            {showAddHabit && (
              <form className="task-form" onSubmit={handleCreateHabit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="habit-title">Ritual Name</label>
                  <input
                    id="habit-title"
                    type="text"
                    className="input-field"
                    placeholder="e.g. 30m Morning Reading"
                    value={habitTitle}
                    onChange={(e) => setHabitTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row">
                  <select
                    className="select-field"
                    value={habitXp}
                    onChange={(e) => setHabitXp(Number(e.target.value))}
                    aria-label="Ritual XP Reward"
                  >
                    <option value={20}>+20 XP</option>
                    <option value={35}>+35 XP</option>
                    <option value={50}>+50 XP</option>
                  </select>
                  <button type="submit" className="btn-primary" disabled={!habitTitle.trim()}>
                    Establish
                  </button>
                </div>
              </form>
            )}

            {state.habits.length === 0 ? (
              <div className="empty-state">
                No daily rituals yet. Establish a habit to build recurring daily streaks!
              </div>
            ) : (
              <div className="task-list">
                {state.habits.map((habit) => {
                  const isDoneToday = habit.lastCompletedDate === todayDate;
                  return (
                    <div key={habit.id} className={`task-card ${isDoneToday ? "completed" : ""}`}>
                      <div className="task-info">
                        <div className="task-title">{habit.title}</div>
                        <div className="task-meta">
                          <span className="habit-streak-badge">
                            🔥 {habit.streakCurrent} {habit.streakCurrent === 1 ? "day" : "days"}
                          </span>
                          <span className="reward-chip">+{habit.xpReward} XP</span>
                          {habit.streakBest > 0 && (
                            <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                              Best: {habit.streakBest}d
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="card-actions">
                        <button
                          type="button"
                          className="btn-complete"
                          onClick={() => finishHabit(habit.id)}
                          disabled={isDoneToday}
                          aria-label={isDoneToday ? "Ritual already completed today" : `Check in for ${habit.title}`}
                        >
                          {isDoneToday ? "✓ Done Today" : "⚡ Check In"}
                        </button>
                        <button
                          type="button"
                          className="btn-action-icon"
                          onClick={() => setHabitToDelete(habit.id)}
                          aria-label={`Delete ${habit.title}`}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quest Creation Form */}
          <section>
            <div className="section-header">
              <h2 className="section-title">Assign Quest</h2>
            </div>
            <form className="task-form" onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="form-label" htmlFor={titleId}>Quest Title</label>
                <input
                  id={titleId}
                  type="text"
                  className="input-field"
                  placeholder="Quest objective (e.g. Finish compiler assignment)"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div style={{ flex: "1 1 120px" }}>
                  <label className="form-label" htmlFor={priorityId}>Priority</label>
                  <select
                    id={priorityId}
                    className="select-field"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div style={{ flex: "1 1 100px" }}>
                  <label className="form-label" htmlFor={xpId}>Reward</label>
                  <select
                    id={xpId}
                    className="select-field"
                    value={taskXp}
                    onChange={(e) => setTaskXp(Number(e.target.value))}
                  >
                    <option value={25}>+25 XP</option>
                    <option value={50}>+50 XP</option>
                    <option value={100}>+100 XP</option>
                    <option value={200}>+200 XP</option>
                  </select>
                </div>

                <div style={{ flex: "1 1 140px" }}>
                  <label className="form-label" htmlFor={dueDateId}>Due Date</label>
                  <input
                    id={dueDateId}
                    type="date"
                    className="input-field"
                    style={{ minHeight: "44px", padding: "6px 8px" }}
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%", marginTop: "12px" }}
                disabled={!taskTitle.trim()}
              >
                Accept Quest
              </button>
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
                {pendingTasks.map((task) => {
                  const isOverdue = task.dueDate && task.dueDate < todayDate;
                  return (
                    <div key={task.id} className="task-card">
                      <div className="task-info">
                        <div className="task-title">{task.title}</div>
                        <div className="task-meta">
                          <span className={`priority-tag priority-${task.priority}`}>
                            {task.priority}
                          </span>
                          <span className="reward-chip">+{task.xpReward} XP</span>
                          {task.dueDate && (
                            <span className={`due-chip ${isOverdue ? "overdue" : ""}`}>
                              {isOverdue ? "⚠️ Overdue: " : "Due: "}{task.dueDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="card-actions">
                        <button
                          type="button"
                          className="btn-complete"
                          onClick={() => finishTask(task.id)}
                          aria-label={`Complete ${task.title}`}
                        >
                          ✓ Complete
                        </button>
                        <button
                          type="button"
                          className="btn-action-icon"
                          onClick={() => handleOpenEdit(task)}
                          aria-label={`Edit ${task.title}`}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="btn-action-icon"
                          onClick={() => setTaskToDelete(task.id)}
                          aria-label={`Delete ${task.title}`}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Completed Tasks Section */}
          {completedTasks.length > 0 && (
            <section style={{ marginTop: "24px" }}>
              <div className="section-header">
                <h2 className="section-title">Completed Log ({completedTasks.length})</h2>
                <button
                  type="button"
                  onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                  className="btn-secondary"
                  style={{ minHeight: "32px", padding: "0 8px", fontSize: "0.75rem" }}
                >
                  {showCompletedTasks ? "Hide Log" : "Show Log"}
                </button>
              </div>

              {showCompletedTasks && (
                <div className="task-list">
                  {completedTasks.map((task) => (
                    <div key={task.id} className="task-card completed">
                      <div className="task-info">
                        <div className="task-title">{task.title}</div>
                        <div className="task-meta">
                          <span className="priority-tag priority-low">Completed</span>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                            +{task.xpReward} XP awarded
                          </span>
                        </div>
                      </div>
                      <button type="button" className="btn-complete" disabled>
                        Done
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* ------------------------------------------------------------ */}
      {/* TAB 2: CHARACTER & ATTRIBUTES                                */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "character" && (
        <>
          {/* Skill points alert banner */}
          {state.progression.availableSkillPoints > 0 && (
            <div
              className="status-banner status-success"
              style={{ marginBottom: "16px", marginTop: "0", textAlign: "left" }}
            >
              ⚡ <strong>{state.progression.availableSkillPoints} Skill Point(s) Available!</strong> Allocate points to level up skills and increase your core attributes.
            </div>
          )}

          {/* Skills Section */}
          <section style={{ marginBottom: "24px" }}>
            <div className="section-header">
              <h2 className="section-title">Skills & Masteries</h2>
            </div>

            <div className="task-list">
              {state.skills.map((skill) => (
                <div key={skill.id} className="skill-card">
                  <div className="skill-info">
                    <div className="skill-name">
                      <span>{skill.name}</span>
                      <span className="skill-level-badge">LV. {skill.level}</span>
                    </div>
                    <div className="skill-desc">{skill.description}</div>
                    <div className="skill-links">
                      {skill.linkedStatIds.map((statId) => (
                        <span key={statId} className="skill-link-tag">
                          +{state.stats[statId]?.current ?? 0} {statId}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    style={{ minHeight: "44px", padding: "0 12px", whiteSpace: "nowrap" }}
                    onClick={() => assignSkillPoint(skill.id)}
                    disabled={state.progression.availableSkillPoints <= 0}
                    aria-label={`Rank up skill ${skill.name}`}
                  >
                    +1 Rank
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Core Attributes Breakdown */}
          <section>
            <div className="section-header">
              <h2 className="section-title">Status Attributes</h2>
            </div>

            <div className="task-list">
              {state.statDefinitions.map((def) => {
                const statVal = state.stats[def.id] ?? { current: 0, lifetimeEarned: 0 };
                return (
                  <div key={def.id} className="task-card">
                    <div className="task-info">
                      <div className="task-title" style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{def.name}</span>
                        <span style={{ color: "#38bdf8", fontWeight: 700 }}>+{statVal.current}</span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "2px" }}>
                        {def.description}
                      </p>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginTop: "4px" }}>
                        Lifetime Earned: +{statVal.lifetimeEarned} pts
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ------------------------------------------------------------ */}
      {/* TAB 3: VAULT & DATA OWNERSHIP                                */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "vault" && (
        <>
          {/* Storage Meter */}
          <section className="meter-card">
            <div className="meter-header">
              <span>LOCAL BROWSER STORAGE</span>
              <span>
                {metrics ? `${metrics.formattedSize} / 5 MB` : "Checking..."}
              </span>
            </div>
            <div className="meter-track">
              <div
                className="meter-fill"
                style={{
                  width: metrics
                    ? `${Math.max(2, Math.min(100, (metrics.estimatedBytesUsed / (5 * 1024 * 1024)) * 100))}%`
                    : "2%",
                }}
              />
            </div>
            <p style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "8px", lineHeight: "1.4" }}>
              All progress is persisted securely in your browser&apos;s isolated namespaced storage. No external servers or telemetry are used.
            </p>
          </section>

          {/* Backup & Restore Controls */}
          <section>
            <div className="section-header">
              <h2 className="section-title">Data Backup & Restore</h2>
            </div>

            <div className="task-card" style={{ flexDirection: "column", gap: "12px", alignItems: "stretch" }}>
              <div>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>Export Data Vault</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Download a validated JSON backup containing all tasks, rituals, progression, and history.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleExportBackup}
                style={{ width: "100%" }}
              >
                📥 Download JSON Backup
              </button>
            </div>

            <div className="task-card" style={{ flexDirection: "column", gap: "12px", alignItems: "stretch", marginTop: "12px" }}>
              <div>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>Restore Data Vault</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Select a backup file to restore. The system validates and snapshots existing state before applying.
                </p>
              </div>
              <label className="btn-secondary" style={{ width: "100%", textAlign: "center", cursor: "pointer" }}>
                <span>📤 Choose Backup File</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {/* Storage Reset */}
            <div className="task-card" style={{ flexDirection: "column", gap: "12px", alignItems: "stretch", marginTop: "12px" }}>
              <div>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--rose-accent)" }}>Danger Zone</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Reset application data back to initial seed defaults. Requires confirmation.
                </p>
              </div>
              <button
                type="button"
                className="btn-danger"
                onClick={() => setConfirmResetOpen(true)}
              >
                ⚠️ Reset to Initial Defaults
              </button>
            </div>
          </section>
        </>
      )}

      {/* ------------------------------------------------------------ */}
      {/* MODALS & CONFIRMATION DIALOGS                                */}
      {/* ------------------------------------------------------------ */}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-quest-title">
          <div className="modal-content">
            <h3 id="edit-quest-title" style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "12px", color: "#38bdf8" }}>
              Edit Quest
            </h3>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-title">Title</label>
                <input
                  id="edit-title"
                  type="text"
                  className="input-field"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div style={{ flex: "1" }}>
                  <label className="form-label" htmlFor="edit-priority">Priority</label>
                  <select
                    id="edit-priority"
                    className="select-field"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div style={{ flex: "1" }}>
                  <label className="form-label" htmlFor="edit-xp">Reward</label>
                  <select
                    id="edit-xp"
                    className="select-field"
                    value={editXp}
                    onChange={(e) => setEditXp(Number(e.target.value))}
                  >
                    <option value={25}>+25 XP</option>
                    <option value={50}>+50 XP</option>
                    <option value={100}>+100 XP</option>
                    <option value={200}>+200 XP</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "10px" }}>
                <label className="form-label" htmlFor="edit-due">Due Date</label>
                <input
                  id="edit-due"
                  type="date"
                  className="input-field"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  Save Changes
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingTask(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Task Confirmation */}
      {taskToDelete && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--rose-accent)", marginBottom: "8px" }}>
              Discard Quest?
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.4" }}>
              Are you sure you want to delete this pending quest? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-danger"
                style={{ flex: 1 }}
                onClick={() => {
                  removeTask(taskToDelete);
                  setTaskToDelete(null);
                  setFeedbackMsg({ type: "success", text: "Quest discarded." });
                }}
              >
                Yes, Discard
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setTaskToDelete(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Habit Confirmation */}
      {habitToDelete && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--rose-accent)", marginBottom: "8px" }}>
              Remove Daily Ritual?
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.4" }}>
              Removing this habit will remove its active daily streak. Lifetime aggregates will remain safe.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-danger"
                style={{ flex: 1 }}
                onClick={() => {
                  removeHabit(habitToDelete);
                  setHabitToDelete(null);
                  setFeedbackMsg({ type: "success", text: "Ritual removed." });
                }}
              >
                Remove
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setHabitToDelete(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      {pendingImportFile && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#38bdf8", marginBottom: "8px" }}>
              Confirm Vault Restoration
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.4" }}>
              Restoring this backup will replace current tasks, habits, and attributes. A pre-import safety backup will be created automatically. Proceed?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={handleConfirmImport}
              >
                Yes, Restore Vault
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPendingImportFile(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {confirmResetOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--rose-accent)", marginBottom: "8px" }}>
              Confirm Full Reset
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.4" }}>
              Are you completely sure you want to reset all tasks, habits, levels, and attributes back to initial seed state?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-danger"
                style={{ flex: 1 }}
                onClick={() => {
                  resetDefaults();
                  setConfirmResetOpen(false);
                  setFeedbackMsg({ type: "success", text: "Reset to initial defaults complete." });
                }}
              >
                Yes, Reset Everything
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmResetOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* Footer                                                       */}
      {/* ------------------------------------------------------------ */}
      <footer style={{ marginTop: "auto", paddingTop: "20px" }}>
        <div className="status-banner status-normal">
          Local Storage · {state.progression.lifetimeCompletedTasks} Quests · {state.progression.lifetimeHabitCompletions} Rituals
        </div>
      </footer>
    </main>
  );
}
