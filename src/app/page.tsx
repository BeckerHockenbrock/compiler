"use client";

import { useState, useId } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import type { Task, TaskPriority } from "@/domain/types";
import { toLocalDate, nowUtc } from "@/domain/date-time";
import { RankBadge } from "@/components/rank-badge";
import {
  formatRankLabel,
  getDaysRemainingInSeason,
  findLadderIndex,
  getRankRung,
} from "@/domain/season-rank";

type ActiveTab = "home" | "progress" | "health" | "data";

/* ------------------------------------------------------------------ */
/* Accessible Inline Navigation & Action SVGs                         */
/* ------------------------------------------------------------------ */

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
      <line x1="12" y1="22" x2="12" y2="15.5" />
      <polyline points="22 8.5 12 15.5 2 8.5" />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function DataIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* SVG Radar / Polygon Chart Component                                */
/* ------------------------------------------------------------------ */

interface RadarChartProps {
  entries: readonly { id: string; name: string; value: number }[];
}

// Fixed benchmark maximum for the Radar Chart polygon visualization (Level 10 benchmark)
const RADAR_BENCHMARK_MAX = 100;

function ProgressionRadarChart({ entries }: RadarChartProps) {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 90;
  const count = entries.length;

  if (count < 3) {
    return (
      <div style={{ color: "var(--text-dim)", fontSize: "0.85rem", padding: "24px" }}>
        Need at least 3 attributes to display progression polygon.
      </div>
    );
  }

  // Calculate polygon points anchored strictly to RADAR_BENCHMARK_MAX = 100.
  // Uniform increases across attributes visibly expand the polygon toward the outer boundary.
  const points = entries.map((entry, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    // Normalized distance: 15% baseline min radius, clamped strictly to 100% boundary
    const ratio = 0.15 + 0.85 * Math.min(1, Math.max(0, entry.value / RADAR_BENCHMARK_MAX));
    const r = maxRadius * ratio;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const isMaxed = entry.value >= RADAR_BENCHMARK_MAX;
    return { x, y, angle, entry, isMaxed };
  });

  const polygonPath = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Grid level rings at 25%, 50%, 75%, 100%
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="radar-svg-container" role="img" aria-label="Core attributes progression radar chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <title>Core Attributes Progression Radar</title>
        <desc>
          {entries.map((e) => `${e.name}: ${e.value}`).join(", ")}
        </desc>

        {/* Concentric Grid Rings */}
        {gridLevels.map((level) => {
          const ringPoints = entries
            .map((_, i) => {
              const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
              const r = maxRadius * level;
              return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
            })
            .join(" ");

          return (
            <polygon
              key={`ring-${level}`}
              points={ringPoints}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={level === 1.0 ? 1.5 : 1}
              strokeDasharray={level < 1.0 ? "2,3" : undefined}
            />
          );
        })}

        {/* Radial Spoke Lines */}
        {entries.map((_, i) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
          const outerX = cx + maxRadius * Math.cos(angle);
          const outerY = cy + maxRadius * Math.sin(angle);
          return (
            <line
              key={`spoke-${i}`}
              x1={cx}
              y1={cy}
              x2={outerX}
              y2={outerY}
              stroke="rgba(255, 255, 255, 0.10)"
              strokeWidth="1"
            />
          );
        })}

        {/* Shaded Data Polygon */}
        <polygon
          points={polygonPath}
          fill="rgba(0, 144, 255, 0.22)"
          stroke="#0090ff"
          strokeWidth="2"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 8px rgba(0, 144, 255, 0.4))" }}
        />

        {/* Vertex Data Dots & Axis Labels */}
        {points.map(({ x, y, angle, entry }, i) => {
          const labelDist = maxRadius + 24;
          const lx = cx + labelDist * Math.cos(angle);
          const ly = cy + labelDist * Math.sin(angle) + 4;

          return (
            <g key={`vertex-${i}`}>
              <circle cx={x} cy={y} r="3.5" fill="#ffffff" stroke="#0090ff" strokeWidth="2" />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                letterSpacing="0.04em"
                fill="var(--text-muted)"
              >
                {entry.name}
              </text>
              <text
                x={lx}
                y={ly + 11}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="var(--accent-blue-bright)"
              >
                +{entry.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Application Dashboard                                         */
/* ------------------------------------------------------------------ */

export default function HomeDashboard() {
  const {
    state,
    isHydrated,
    error,
    metrics,
    levelProgress,
    promotionTrial,
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

  const [activeTab, setActiveTab] = useState<ActiveTab>("home");

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
  const [whoopModalOpen, setWhoopModalOpen] = useState(false);

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
        <div className="hero-card" style={{ textAlign: "center" }}>
          <h2 style={{ color: "var(--status-danger-text)", marginBottom: "8px", fontSize: "1.1rem" }}>
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

  const statEntries = state.statDefinitions.map((def) => {
    const val = state.stats[def.id]?.current ?? 0;
    return { id: def.id, name: def.name, value: val };
  });

  return (
    <main className="app-viewport">
      {/* Visually hidden primary heading for accessible document outline */}
      <h1 className="sr-only">Personal Focus & Progression Dashboard</h1>

      {/* Temporary Feedback Banner */}
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
      {/* DESTINATION 1: HOME (Dashboard, Tasks, Habits, Progression)  */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "home" && (
        <>
          {/* Hero Progression Card */}
          <section className="hero-card" aria-label="Progression Overview">
            <div className="hero-top-bar">
              <div className="level-badge">
                <span>Level {levelProgress.level}</span>
                <span className="level-badge-tag">Tier {Math.floor((levelProgress.level - 1) / 5) + 1}</span>
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
                <span style={{ color: "var(--accent-blue-bright)", fontWeight: 600 }}>
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
                <span className="focus-metric-val" style={{ fontSize: "0.85rem", color: "var(--accent-blue-bright)" }}>Ready</span>
              </div>
            </div>
          </section>

          {/* Compact Season Rank Card */}
          <section className="season-card" aria-label="Season Rank Overview">
            <div className="season-card-top">
              <div className="season-badge-col">
                <RankBadge
                  tier={state.seasonRank.tier}
                  division={state.seasonRank.division}
                  size={52}
                  glow={true}
                />
              </div>
              <div className="season-header-info">
                <div className="season-label-row">
                  <span className="season-number-tag">{state.seasonRank.currentSeasonLabel}</span>
                  <span className="season-days-left">
                    {getDaysRemainingInSeason(nowUtc(), state.settings.timeZone)}d left
                  </span>
                </div>
                <div className="season-rank-title-row">
                  <h3 className="season-rank-title">
                    {formatRankLabel(state.seasonRank.tier, state.seasonRank.division)}
                  </h3>
                  {state.seasonRank.isProvisional ? (
                    <span className="provisional-pill">
                      Provisional ({state.seasonRank.provisionalActivitiesCount}/3)
                    </span>
                  ) : (
                    <span className="season-confirmed-pill">Active Standing</span>
                  )}
                </div>
              </div>
            </div>

            {/* Division SR Progress */}
            <div className="progress-container" style={{ marginTop: "12px", marginBottom: "12px" }}>
              <div className="progress-label-row">
                <span>Division Progress</span>
                <span style={{ color: "var(--accent-blue-bright)", fontWeight: 600 }}>
                  {state.seasonRank.sr} / 100 SR
                </span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.max(3, Math.min(100, state.seasonRank.sr))}%` }}
                />
              </div>
            </div>

            {/* Weekly Ranked Mission Status */}
            <div className="season-mission-strip">
              <div className="season-mission-content">
                <div className="season-mission-title">
                  <span>{state.seasonRank.weeklyMission.title}</span>
                  <span className="reward-chip">+{state.seasonRank.weeklyMission.srReward} SR</span>
                </div>
                <div className="season-mission-desc">
                  {state.seasonRank.weeklyMission.description}
                </div>
              </div>
              <span className={`mission-status-chip ${state.seasonRank.weeklyMission.completed ? "completed" : ""}`}>
                {state.seasonRank.weeklyMission.completed
                  ? "Completed"
                  : `${state.seasonRank.weeklyMission.currentCount} / ${state.seasonRank.weeklyMission.targetCount}`}
              </span>
            </div>
          </section>

          {/* Daily Habits Section */}
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
                            🔥 {habit.streakCurrent} {habit.streakCurrent === 1 ? "day streak" : "day streak"}
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

          {/* New Task Creation Form */}
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

          {/* Active Tasks List */}
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

          {/* Completed Tasks Archive */}
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
      {/* DESTINATION 2: PROGRESS (Radar Chart, Attributes, Skills)    */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "progress" && (
        <>
          {/* Permanent Progression Guarantee Notice */}
          <div
            className="status-banner status-normal"
            style={{ marginBottom: "16px", marginTop: "0", textAlign: "left" }}
          >
            <span style={{ fontSize: "0.76rem", lineHeight: "1.4" }}>
              <strong>Permanent Progression Guarantee:</strong> Lifetime XP, character level, skill points, habits, and stats never reset. Season Rank resets on the 1st of each month to measure monthly consistency.
            </span>
          </div>

          {/* Full Season Rank Progression Card */}
          <section className="season-hero-card" aria-label="Monthly Season Rank Details">
            <div className="season-hero-header">
              <div className="season-hero-badge-wrap">
                <RankBadge
                  tier={state.seasonRank.tier}
                  division={state.seasonRank.division}
                  size={84}
                  glow={true}
                />
              </div>

              <div className="season-hero-meta">
                <div className="season-label-row">
                  <span className="season-number-tag">{state.seasonRank.currentSeasonLabel}</span>
                  <span className="season-days-left">
                    {getDaysRemainingInSeason(nowUtc(), state.settings.timeZone)} days remaining
                  </span>
                </div>

                <h2 className="season-hero-rank-title">
                  {formatRankLabel(state.seasonRank.tier, state.seasonRank.division)}
                </h2>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                  {state.seasonRank.isProvisional ? (
                    <span className="provisional-pill">
                      Provisional ({state.seasonRank.provisionalActivitiesCount}/3)
                    </span>
                  ) : (
                    <span className="season-confirmed-pill">Confirmed Rank</span>
                  )}
                  <span className="season-peak-chip">
                    Peak: {formatRankLabel(state.seasonRank.seasonalPeakTier, state.seasonRank.seasonalPeakDivision)}
                  </span>
                  {state.seasonRank.allTimePeakTier && (
                    <span className="season-peak-chip" style={{ color: "var(--accent-blue-bright)" }}>
                      All-Time: {formatRankLabel(state.seasonRank.allTimePeakTier, state.seasonRank.allTimePeakDivision)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Division SR Progress */}
            <div className="progress-container" style={{ marginTop: "16px", marginBottom: "8px" }}>
              <div className="progress-label-row">
                <span>
                  {state.seasonRank.tier === "apex" ? "Apex Pinnacle" : "Division Progress"}
                </span>
                <span style={{ color: "var(--accent-blue-bright)", fontWeight: 700 }}>
                  {state.seasonRank.sr} / 100 SR
                </span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.max(3, Math.min(100, state.seasonRank.sr))}%` }}
                />
              </div>
              <div className="progress-meta-row">
                <span>Daily Caps: Task {state.seasonRank.dailyCaps.taskSrEarned}/25 · Habit {state.seasonRank.dailyCaps.habitSrEarned}/10</span>
                <span>{state.seasonRank.tier === "apex" ? "Apex Reached" : `Next: ${formatRankLabel(getRankRung(findLadderIndex(state.seasonRank.tier, state.seasonRank.division) + 1).tier, getRankRung(findLadderIndex(state.seasonRank.tier, state.seasonRank.division) + 1).division)}`}</span>
              </div>
            </div>

            {/* Promotion Trial Checklist (Hidden for Apex since Apex is maximum rank) */}
            {state.seasonRank.tier === "apex" ? (
              <div className="promotion-trial-card" style={{ borderColor: "rgba(255, 255, 255, 0.25)" }}>
                <div className="trial-header">
                  <h3 className="trial-title">Pinnacle Rank Achieved</h3>
                  <span className="trial-badge status-ready">Apex Pinnacle</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  You hold the highest rank on the ladder for {state.seasonRank.currentSeasonLabel}. Maintain your weekly consistency and complete weekly missions until the season rollover.
                </p>
              </div>
            ) : (
              <div className="promotion-trial-card">
                <div className="trial-header">
                  <h3 className="trial-title">Promotion Trial Requirements</h3>
                  <span className={`trial-badge ${promotionTrial?.allMet ? "status-ready" : "status-pending"}`}>
                    {promotionTrial?.allMet ? "Eligible" : "In Progress"}
                  </span>
                </div>

                {state.seasonRank.isProvisional && (
                  <div className="provisional-warning-callout">
                    Promotion is gated during provisional placement. Complete 3 qualifying activities in this season ({state.seasonRank.provisionalActivitiesCount}/3) to unlock promotions.
                  </div>
                )}

                <div className="trial-checklist">
                  <div className={`trial-item ${state.seasonRank.sr >= 100 ? "item-met" : "item-unmet"}`}>
                    <span className="trial-check-icon">{state.seasonRank.sr >= 100 ? "✓" : "○"}</span>
                    <div className="trial-item-info">
                      <span className="trial-item-label">100 Season Rank Points (SR)</span>
                      <span className="trial-item-sub">Current: {state.seasonRank.sr} / 100 SR</span>
                    </div>
                  </div>

                  <div className={`trial-item ${(promotionTrial?.qualifyingSessionsCount ?? 0) >= 3 ? "item-met" : "item-unmet"}`}>
                    <span className="trial-check-icon">{(promotionTrial?.qualifyingSessionsCount ?? 0) >= 3 ? "✓" : "○"}</span>
                    <div className="trial-item-info">
                      <span className="trial-item-label">3 Qualifying Productivity Sessions (Last 7 Days)</span>
                      <span className="trial-item-sub">Completed: {promotionTrial?.qualifyingSessionsCount ?? 0} / 3 sessions</span>
                    </div>
                  </div>

                  <div className={`trial-item ${(promotionTrial?.activeDaysCount ?? 0) >= (promotionTrial?.activeDaysTarget ?? 4) ? "item-met" : "item-unmet"}`}>
                    <span className="trial-check-icon">{(promotionTrial?.activeDaysCount ?? 0) >= (promotionTrial?.activeDaysTarget ?? 4) ? "✓" : "○"}</span>
                    <div className="trial-item-info">
                      <span className="trial-item-label">{promotionTrial?.activeDaysTarget ?? 4} Active Days (Last 7 Days)</span>
                      <span className="trial-item-sub">Active Days: {promotionTrial?.activeDaysCount ?? 0} / {promotionTrial?.activeDaysTarget ?? 4} days</span>
                    </div>
                  </div>

                  <div className={`trial-item ${state.seasonRank.weeklyMission.completed ? "item-met" : "item-unmet"}`}>
                    <span className="trial-check-icon">{state.seasonRank.weeklyMission.completed ? "✓" : "○"}</span>
                    <div className="trial-item-info">
                      <span className="trial-item-label">One Completed Weekly Ranked Mission</span>
                      <span className="trial-item-sub">
                        {state.seasonRank.weeklyMission.completed
                          ? "Completed (+25 SR credited)"
                          : `Progress: ${state.seasonRank.weeklyMission.currentCount} / ${state.seasonRank.weeklyMission.targetCount} qualifying activities`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Previous Season Summary */}
            <div className="previous-season-row">
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Previous Season Final:</span>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>
                {state.seasonRank.previousSeasonSummary
                  ? `${state.seasonRank.previousSeasonSummary.label}: ${formatRankLabel(state.seasonRank.previousSeasonSummary.finalTier, state.seasonRank.previousSeasonSummary.finalDivision)} (${state.seasonRank.previousSeasonSummary.finalSr} SR)`
                  : "First active season in progress"}
              </span>
            </div>

            {/* Season History Records */}
            {state.seasonRank.history.length > 0 && (
              <div className="season-history-section">
                <h4 className="season-history-title">Archived Season History</h4>
                <div className="season-history-list">
                  {state.seasonRank.history.map((record) => (
                    <div key={record.seasonId} className="season-history-item">
                      <div className="season-history-item-left">
                        <RankBadge tier={record.finalTier} division={record.finalDivision} size={28} showDivision={false} />
                        <div>
                          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-main)" }}>
                            {record.label}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                            Final: {formatRankLabel(record.finalTier, record.finalDivision)} ({record.finalSr} SR) · Peak: {formatRankLabel(record.peakTier, record.peakDivision)}
                          </div>
                        </div>
                      </div>
                      <span className="season-history-tag">
                        {record.completedAt.slice(0, 10)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Skill points alert banner */}
          {state.progression.availableSkillPoints > 0 && (
            <div
              className="status-banner status-success"
              style={{ marginBottom: "16px", marginTop: "0", textAlign: "left" }}
            >
              <strong>{state.progression.availableSkillPoints} Skill Point(s) Available.</strong> Allocate points to advance focus skills and increase core attributes.
            </div>
          )}

          {/* Hex / Radar Progression Visualizer */}
          <section className="radar-card">
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h2 className="section-title" style={{ margin: 0 }}>Progression Polygon</h2>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Level {levelProgress.level} · Milestone Benchmark: 100 pts</span>
            </div>

            <ProgressionRadarChart entries={statEntries} />

            <p style={{ fontSize: "0.72rem", color: "var(--text-dim)", textAlign: "center", marginTop: "8px", maxWidth: "280px", lineHeight: "1.4" }}>
              Visualizes holistic balance across attributes against a fixed 100-point benchmark. Completing tasks and ranking up skills visibly expands the polygon toward mastery.
            </p>
          </section>

          {/* Color-Accented Core Attributes Grid */}
          <section>
            <div className="section-header">
              <h2 className="section-title">Core Attributes ({state.statDefinitions.length})</h2>
            </div>

            <div className="attrs-grid">
              {state.statDefinitions.map((def) => {
                const statVal = state.stats[def.id] ?? { current: 0, lifetimeEarned: 0 };
                return (
                  <div key={def.id} className={`attr-card attr-${def.id}`}>
                    <div className="attr-header">
                      <span className="attr-name">{def.name}</span>
                      <span className="attr-val">+{statVal.current}</span>
                    </div>
                    <p className="attr-desc">{def.description}</p>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginTop: "6px" }}>
                      Lifetime: +{statVal.lifetimeEarned} pts
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

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
        </>
      )}

      {/* ------------------------------------------------------------ */}
      {/* DESTINATION 3: HEALTH (Future WHOOP Wearable Dashboard)       */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "health" && (
        <>
          <section className="health-hero-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>Wearable Integration</h2>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Physiological recovery, sleep, and strain tracking
                </p>
              </div>
              <span className="health-status-badge">Not Connected</span>
            </div>

            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: "1.5", marginTop: "10px" }}>
              Connect your WHOOP strap in future releases to view daily recovery, sleep efficiency, and cardiovascular strain. Physiological wearable data provides personal readiness context and suggested missions only; health metrics never affect Season Rank, award or deduct XP/SR, or penalize your standing.
            </p>

            {/* Empty-State Wearable Metrics Preview */}
            <div className="health-metrics-grid">
              <div className="health-metric-box">
                <span className="health-metric-label">Recovery</span>
                <span className="health-metric-val">--%</span>
                <span className="health-metric-sub">Awaiting device</span>
              </div>
              <div className="health-metric-box">
                <span className="health-metric-label">Sleep Score</span>
                <span className="health-metric-val">--%</span>
                <span className="health-metric-sub">Awaiting device</span>
              </div>
              <div className="health-metric-box">
                <span className="health-metric-label">Day Strain</span>
                <span className="health-metric-val">0.0</span>
                <span className="health-metric-sub">Awaiting device</span>
              </div>
            </div>

            <div style={{ marginTop: "18px" }}>
              <button
                type="button"
                className="btn-primary"
                style={{ width: "100%" }}
                onClick={() => setWhoopModalOpen(true)}
              >
                Connect WHOOP
              </button>
            </div>
          </section>

          {/* Provider Architecture Guarantee Card */}
          <section className="task-card" style={{ flexDirection: "column", gap: "10px", alignItems: "stretch" }}>
            <h3 style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-main)" }}>
              Zero Client Credential Transmission
            </h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: "1.45" }}>
              This web application operates strictly as a static, local-first client. WHOOP OAuth tokens, client secrets, and physiological data are never stored in plain browser storage or transmitted without explicit secure backend mediation.
            </p>
          </section>
        </>
      )}

      {/* ------------------------------------------------------------ */}
      {/* DESTINATION 4: DATA (Backup, Restore, Storage Metrics)       */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "data" && (
        <>
          {/* Storage Meter */}
          <section className="meter-card">
            <div className="meter-header">
              <span>LOCAL BROWSER STORAGE</span>
              <span style={{ color: "var(--accent-blue-bright)", fontWeight: 600 }}>
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
                <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--status-danger-text)" }}>Reset Workspace</h3>
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
      {/* FLOATING LIQUID GLASS BOTTOM NAVIGATION BAR                  */}
      {/* ------------------------------------------------------------ */}
      <nav className="liquid-glass-nav" aria-label="Primary Navigation">
        <button
          type="button"
          className={`nav-item ${activeTab === "home" ? "active" : ""}`}
          onClick={() => setActiveTab("home")}
          aria-current={activeTab === "home" ? "page" : undefined}
          aria-label="Home"
        >
          <HomeIcon />
          <span className="nav-label">Home</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === "progress" ? "active" : ""}`}
          onClick={() => setActiveTab("progress")}
          aria-current={activeTab === "progress" ? "page" : undefined}
          aria-label="Progress"
        >
          <ProgressIcon />
          <span className="nav-label">Progress</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === "health" ? "active" : ""}`}
          onClick={() => setActiveTab("health")}
          aria-current={activeTab === "health" ? "page" : undefined}
          aria-label="Health"
        >
          <HealthIcon />
          <span className="nav-label">Health</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === "data" ? "active" : ""}`}
          onClick={() => setActiveTab("data")}
          aria-current={activeTab === "data" ? "page" : undefined}
          aria-label="Data"
        >
          <DataIcon />
          <span className="nav-label">Data</span>
        </button>
      </nav>

      {/* ------------------------------------------------------------ */}
      {/* MODALS & CONFIRMATION DIALOGS                                */}
      {/* ------------------------------------------------------------ */}

      {/* WHOOP Informational Modal */}
      {whoopModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="whoop-modal-heading">
          <div className="modal-content">
            <h3 id="whoop-modal-heading" style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "10px", color: "var(--text-main)" }}>
              WHOOP Wearable Connection
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "14px", lineHeight: "1.5" }}>
              WHOOP connection will be enabled in a future secure update.
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "18px", lineHeight: "1.45" }}>
              This application is currently running as a static export entirely within your browser. Securing wearable OAuth 2.0 credentials and continuous sync requires server-side token handling, which will be introduced in an upcoming privacy-first update.
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%" }}
              onClick={() => setWhoopModalOpen(false)}
            >
              Understood
            </button>
          </div>
        </div>
      )}

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
            <h3 id="reset-heading" style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--status-danger-text)", marginBottom: "8px" }}>
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
    </main>
  );
}
