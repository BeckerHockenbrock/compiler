"use client";

import { useState, useId } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import type { Task, TaskPriority } from "@/domain/types";
import { toLocalDate, nowUtc } from "@/domain/date-time";

type ActiveTab = "tasks" | "progress" | "data";

function EditIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

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

  const [activeTab, setActiveTab] = useState<ActiveTab>("tasks");

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
  const habitTitleId = useId();
  const habitXpId = useId();

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
      setFeedbackMsg({ type: "success", text: "Task created." });
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
      setFeedbackMsg({ type: "success", text: "Task updated." });
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
      setFeedbackMsg({ type: "success", text: "Habit established." });
    }
  };

  const handleExportBackup = () => {
    const json = exportData();
    if (!json) return;

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `focus_app_backup_${todayDate || "export"}.json`;
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
        <h1 className="sr-only">Personal Focus & Progression Dashboard</h1>
        <div style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
          Loading workspace...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-viewport" style={{ justifyContent: "center" }}>
        <h1 className="sr-only">Personal Focus & Progression Dashboard</h1>
        <div className="overview-card" style={{ textAlign: "center" }}>
          <h2 style={{ color: "var(--text-main)", marginBottom: "8px", fontSize: "1.1rem" }}>
            Storage Unavailable
          </h2>
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
  const habitsDoneToday = state.habits.filter((h) => h.lastCompletedDate === todayDate);

  return (
    <main className="app-viewport">
      {/* Visually hidden primary heading for accessible document outline */}
      <h1 className="sr-only">Personal Focus & Progression Dashboard</h1>

      {/* ------------------------------------------------------------ */}
      {/* Overview & Progression Summary                               */}
      {/* ------------------------------------------------------------ */}
      <section className="overview-card" aria-label="Progression Overview">
        <div className="overview-top-bar">
          <div className="profile-badge">
            <span>Level {levelProgress.level}</span>
            <span className="profile-badge-sub">· Focus Progression</span>
          </div>
          {state.progression.availableSkillPoints > 0 ? (
            <span className="points-pill">
              {state.progression.availableSkillPoints} Skill Points Available
            </span>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              {todayDate}
            </span>
          )}
        </div>

        {/* Level Progress Gauge */}
        <div className="progress-container">
          <div className="progress-label-row">
            <span>Level Progress</span>
            <span>
              {levelProgress.currentLevelXp} / {levelProgress.requiredLevelXp} XP ({Math.round(levelProgress.progressRatio * 100)}%)
            </span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.max(3, Math.min(100, levelProgress.progressRatio * 100))}%` }}
            />
          </div>
          <div className="progress-meta-row">
            <span>Total XP: {state.progression.totalXp}</span>
            <span>Next Level: {levelProgress.nextLevelXp} XP</span>
          </div>
        </div>

        {/* Time-Centered Focus Metrics Grid */}
        <div className="focus-metrics-grid">
          <div className="focus-metric-item">
            <span className="focus-metric-label">Active Tasks</span>
            <span className="focus-metric-val">{pendingTasks.length}</span>
          </div>
          <div className="focus-metric-item">
            <span className="focus-metric-label">Daily Habits</span>
            <span className="focus-metric-val">{habitsDoneToday.length} / {state.habits.length}</span>
          </div>
          <div className="focus-metric-item">
            <span className="focus-metric-label">Focus Session</span>
            <span className="focus-metric-val" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Ready</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Navigation Tabs (Restrained, Monochrome)                     */}
      {/* ------------------------------------------------------------ */}
      <nav className="nav-tabs" aria-label="Main Navigation">
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === "tasks" ? "active" : ""}`}
          onClick={() => setActiveTab("tasks")}
        >
          Tasks
        </button>
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === "progress" ? "active" : ""}`}
          onClick={() => setActiveTab("progress")}
        >
          Progress
        </button>
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === "data" ? "active" : ""}`}
          onClick={() => setActiveTab("data")}
        >
          Data
        </button>
      </nav>

      {/* Feedback banner */}
      {feedbackMsg && (
        <div
          className={`status-banner ${feedbackMsg.type === "success" ? "status-success" : "status-error"}`}
          onClick={() => setFeedbackMsg(null)}
          style={{ cursor: "pointer", marginBottom: "16px", marginTop: "0" }}
          role="status"
        >
          {feedbackMsg.text} (tap to dismiss)
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* TAB 1: TASKS & DAILY PRACTICES                               */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "tasks" && (
        <>
          {/* Daily Habits */}
          <section style={{ marginBottom: "24px" }}>
            <div className="section-header">
              <h2 className="section-title">Daily Habits ({state.habits.length})</h2>
              <button
                type="button"
                className="btn-secondary"
                style={{ minHeight: "36px", padding: "0 10px", fontSize: "0.78rem" }}
                onClick={() => setShowAddHabit(!showAddHabit)}
              >
                {showAddHabit ? "Cancel" : "+ New Habit"}
              </button>
            </div>

            {showAddHabit && (
              <form className="task-form" onSubmit={handleCreateHabit}>
                <div className="form-group">
                  <label className="form-label" htmlFor={habitTitleId}>Habit Name</label>
                  <input
                    id={habitTitleId}
                    type="text"
                    className="input-field"
                    placeholder="e.g., 45m Focused Study"
                    value={habitTitle}
                    onChange={(e) => setHabitTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row">
                  <div style={{ flex: 1 }}>
                    <label className="form-label" htmlFor={habitXpId}>XP Reward</label>
                    <select
                      id={habitXpId}
                      className="select-field"
                      style={{ width: "100%" }}
                      value={habitXp}
                      onChange={(e) => setHabitXp(Number(e.target.value))}
                    >
                      <option value={20}>+20 XP</option>
                      <option value={35}>+35 XP</option>
                      <option value={50}>+50 XP</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button type="submit" className="btn-primary" disabled={!habitTitle.trim()}>
                      Add Habit
                    </button>
                  </div>
                </div>
              </form>
            )}

            {state.habits.length === 0 ? (
              <div className="empty-state">
                No habits yet. Establish a daily practice to build consistency.
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
                            {habit.streakCurrent} {habit.streakCurrent === 1 ? "day streak" : "day streak"}
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
                          aria-label={isDoneToday ? "Habit completed today" : `Check in for ${habit.title}`}
                        >
                          {isDoneToday ? "Completed" : "Check In"}
                        </button>
                        <button
                          type="button"
                          className="btn-action-icon"
                          onClick={() => setHabitToDelete(habit.id)}
                          aria-label={`Delete habit: ${habit.title}`}
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Task Creation Form */}
          <section>
            <div className="section-header">
              <h2 className="section-title">New Task</h2>
            </div>
            <form className="task-form" onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="form-label" htmlFor={titleId}>Task Title</label>
                <input
                  id={titleId}
                  type="text"
                  className="input-field"
                  placeholder="e.g., Read compiler chapter 4"
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
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
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

                <div style={{ flex: "1 1 130px" }}>
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
                style={{ width: "100%", marginTop: "14px" }}
                disabled={!taskTitle.trim()}
              >
                Add Task
              </button>
            </form>
          </section>

          {/* Pending Tasks Section */}
          <section>
            <div className="section-header">
              <h2 className="section-title">Active Tasks ({pendingTasks.length})</h2>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="empty-state">
                No active tasks. Add a task above to begin your focus session.
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
                              {isOverdue ? "Overdue: " : "Due: "}{task.dueDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="card-actions">
                        <button
                          type="button"
                          className="btn-complete"
                          onClick={() => finishTask(task.id)}
                          aria-label={`Complete task: ${task.title}`}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className="btn-action-icon"
                          onClick={() => handleOpenEdit(task)}
                          aria-label={`Edit task: ${task.title}`}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="btn-action-icon"
                          onClick={() => setTaskToDelete(task.id)}
                          aria-label={`Delete task: ${task.title}`}
                        >
                          <DeleteIcon />
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
                <h2 className="section-title">Completed Tasks ({completedTasks.length})</h2>
                <button
                  type="button"
                  onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                  className="btn-secondary"
                  style={{ minHeight: "32px", padding: "0 10px", fontSize: "0.75rem" }}
                >
                  {showCompletedTasks ? "Hide Completed" : "Show Completed"}
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
                            +{task.xpReward} XP
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
      {/* TAB 2: PROGRESS & ATTRIBUTES                                 */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "progress" && (
        <>
          {/* Skill points alert banner */}
          {state.progression.availableSkillPoints > 0 && (
            <div
              className="status-banner status-success"
              style={{ marginBottom: "16px", marginTop: "0", textAlign: "left" }}
            >
              <strong>{state.progression.availableSkillPoints} Skill Point(s) Available.</strong> Allocate points to advance focus skills and increase core attributes.
            </div>
          )}

          {/* Skills Section */}
          <section style={{ marginBottom: "24px" }}>
            <div className="section-header">
              <h2 className="section-title">Skills & Focus Areas</h2>
            </div>

            <div className="task-list">
              {state.skills.map((skill) => (
                <div key={skill.id} className="skill-card">
                  <div className="skill-info">
                    <div className="skill-name">
                      <span>{skill.name}</span>
                      <span className="skill-level-badge">Level {skill.level}</span>
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
                    className="btn-secondary"
                    style={{ minHeight: "44px", padding: "0 14px", whiteSpace: "nowrap" }}
                    onClick={() => assignSkillPoint(skill.id)}
                    disabled={state.progression.availableSkillPoints <= 0}
                    aria-label={`Advance skill ${skill.name}`}
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
              <h2 className="section-title">Core Attributes</h2>
            </div>

            <div className="task-list">
              {state.statDefinitions.map((def) => {
                const statVal = state.stats[def.id] ?? { current: 0, lifetimeEarned: 0 };
                return (
                  <div key={def.id} className="task-card">
                    <div className="task-info">
                      <div className="task-title" style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{def.name}</span>
                        <span style={{ fontWeight: 600, color: "var(--text-main)" }}>+{statVal.current}</span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "2px" }}>
                        {def.description}
                      </p>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginTop: "4px" }}>
                        Lifetime: +{statVal.lifetimeEarned} pts
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
      {/* TAB 3: DATA & BACKUP                                         */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "data" && (
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
              All application state is kept locally in browser storage. No external servers or remote telemetry are used.
            </p>
          </section>

          {/* Backup & Restore Controls */}
          <section>
            <div className="section-header">
              <h2 className="section-title">Data Backup & Restore</h2>
            </div>

            <div className="task-card" style={{ flexDirection: "column", gap: "12px", alignItems: "stretch" }}>
              <div>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>Export Local Data</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Download a validated JSON backup containing all tasks, habits, progression, and logs.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleExportBackup}
                style={{ width: "100%" }}
              >
                Download JSON Backup
              </button>
            </div>

            <div className="task-card" style={{ flexDirection: "column", gap: "12px", alignItems: "stretch", marginTop: "12px" }}>
              <div>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>Restore Local Data</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Select a backup file to restore. Existing state is automatically saved to a pre-import snapshot before restoration.
                </p>
              </div>
              <label className="btn-secondary" style={{ width: "100%", textAlign: "center", cursor: "pointer" }}>
                <span>Select Backup File</span>
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
                <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>Reset Workspace</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Reset application data back to initial defaults. All local state will be restored to initial values.
                </p>
              </div>
              <button
                type="button"
                className="btn-danger"
                onClick={() => setConfirmResetOpen(true)}
              >
                Reset to Initial Defaults
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
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-task-heading">
          <div className="modal-content">
            <h3 id="edit-task-heading" style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "14px", color: "var(--text-main)" }}>
              Edit Task
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
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-task-heading">
          <div className="modal-content">
            <h3 id="delete-task-heading" style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>
              Delete Task?
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.4" }}>
              Are you sure you want to delete this pending task? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-danger"
                style={{ flex: 1 }}
                onClick={() => {
                  removeTask(taskToDelete);
                  setTaskToDelete(null);
                  setFeedbackMsg({ type: "success", text: "Task deleted." });
                }}
              >
                Delete Task
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
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-habit-heading">
          <div className="modal-content">
            <h3 id="delete-habit-heading" style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>
              Delete Habit?
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.4" }}>
              Removing this habit will stop active streak tracking. Historical progression remains intact.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-danger"
                style={{ flex: 1 }}
                onClick={() => {
                  removeHabit(habitToDelete);
                  setHabitToDelete(null);
                  setFeedbackMsg({ type: "success", text: "Habit deleted." });
                }}
              >
                Delete Habit
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
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="restore-heading">
          <div className="modal-content">
            <h3 id="restore-heading" style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>
              Confirm Data Restore
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.4" }}>
              Restoring this backup will replace current tasks, habits, and attributes. A pre-import safety snapshot is created automatically before applying. Continue?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={handleConfirmImport}
              >
                Restore Backup
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
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-heading">
          <div className="modal-content">
            <h3 id="reset-heading" style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>
              Confirm Data Reset
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.4" }}>
              Are you sure you want to reset all tasks, habits, levels, and attributes back to initial defaults?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-danger"
                style={{ flex: 1 }}
                onClick={() => {
                  resetDefaults();
                  setConfirmResetOpen(false);
                  setFeedbackMsg({ type: "success", text: "Reset complete." });
                }}
              >
                Reset All Data
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
      <footer style={{ marginTop: "auto", paddingTop: "24px" }}>
        <div className="status-banner status-normal">
          Local Storage · {state.progression.lifetimeCompletedTasks} Tasks · {state.progression.lifetimeHabitCompletions} Habits
        </div>
      </footer>
    </main>
  );
}
