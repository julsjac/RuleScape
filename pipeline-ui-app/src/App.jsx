import { useMemo, useState } from "react";
import rulescapeLogoFull from "./assets/rulescape_logo.png";
import rulescapeLogoCrop from "./assets/rulescape_logo_crop.png";
import { BridgeStage } from "./stages/KnoxStage";
import {
  CelloStage,
  celloInputBundle,
  createEmptyCelloInputs,
  createEmptyImportedNames,
} from "./stages/CelloStage";
import { MlStage } from "./stages/MlStage";
import { ReportStage } from "./stages/ResultStage";

const PIPELINE_API_URL =
  import.meta.env.VITE_PIPELINE_API_URL ||
  "http://127.0.0.1:8051/api/pipeline/cello-knox/run";

const steps = [
  {
    id: "cello",
    number: "01",
    title: "Configure Cello",
    subtitle: "Define the synthesis bundle",
    summary: "Upload or author the Verilog, UCF, input JSON, and output JSON.",
  },
  {
    id: "bridge",
    number: "02",
    title: "Review Knox",
    subtitle: "Check the adapter package",
    summary: "Confirm how the selected Cello designs become Knox-ready CSV files.",
  },
  {
    id: "ml",
    number: "03",
    title: "Configure ML",
    subtitle: "Choose models and targets",
    summary: "Set the feature source, score target, and model family for training.",
  },
  {
    id: "report",
    number: "04",
    title: "Review Results",
    subtitle: "Inspect rankings and explanations",
    summary: "Read the ranked candidates, rule signals, and generated artifacts.",
  },
];

const stageComponents = {
  cello: CelloStage,
  bridge: BridgeStage,
  ml: MlStage,
  report: ReportStage,
};

const runParameterFields = [
  {
    id: "topN",
    label: "Top N",
    type: "number",
    value: "5",
    min: "1",
    step: "1",
  },
  {
    id: "iterations",
    label: "Iterations",
    type: "number",
    value: "25",
    min: "1",
    max: "25",
    step: "1",
  },
  {
    id: "search",
    label: "Search",
    type: "select",
    value: "Exhaustive",
    options: ["Exhaustive", "Annealing"],
    fullWidth: true,
  },
  {
    id: "runLabel",
    label: "Run label",
    type: "text",
    value: "classic_single_input_run",
    fullWidth: true,
  },
];

const initialRunParams = Object.fromEntries(
  runParameterFields.map((item) => [item.id, item.value])
);

const runStatusMeta = {
  idle: {
    label: "Idle",
    progress: 0,
  },
  initializing: {
    label: "Started / Initializing",
    progress: 18,
  },
  running: {
    label: "Running",
    progress: 68,
  },
  completed: {
    label: "Completed",
    progress: 100,
  },
  error: {
    label: "Error",
    progress: 100,
  },
};

function buildStatusView(phase, runLabel) {
  const base = runStatusMeta[phase] || runStatusMeta.idle;
  const label = phase === "completed" ? `${base.label} ${runLabel}` : base.label;

  return {
    ...base,
    label,
  };
}

function sanitizeBaseName(value) {
  const sanitized = (value || "rulescape_run")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || "rulescape_run";
}

function defaultFilename(id, runLabel) {
  const base = sanitizeBaseName(runLabel);

  switch (id) {
    case "verilog":
      return `${base}.v`;
    case "ucf":
      return `${base}.UCF.json`;
    case "inputJson":
      return `${base}.input.json`;
    case "outputJson":
      return `${base}.output.json`;
    default:
      return `${base}.txt`;
  }
}

function formFieldName(id) {
  switch (id) {
    case "verilog":
      return "verilog_file";
    case "ucf":
      return "ucf_file";
    case "inputJson":
      return "input_file";
    case "outputJson":
      return "output_file";
    default:
      return id;
  }
}

function formatPipelineError(error) {
  const message = error instanceof Error ? error.message : "Pipeline run failed.";

  if (message === "Failed to fetch") {
    return "Failed to fetch";
  }

  return message;
}

export default function App() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [runParams, setRunParams] = useState(initialRunParams);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [celloInputs, setCelloInputs] = useState(createEmptyCelloInputs);
  const [importedNames, setImportedNames] = useState(createEmptyImportedNames);
  const [celloViewMode, setCelloViewMode] = useState("inputs");
  const [runState, setRunState] = useState({
    phase: "idle",
    result: null,
    error: "",
  });
  const [mlRunState, setMlRunState] = useState({
  phase: "idle",
  result: null,
  error: "",
  });
  const [mlParams, setMlParams] = useState({
    trainSplit: 70,
    topNFeatures: 10,
    threshold: 0.5,
  });


  const currentStep = steps[activeIndex];
  const ActiveStage = stageComponents[currentStep.id];
  const logoSrc = sidebarCollapsed ? rulescapeLogoCrop : rulescapeLogoFull;
  const progressPercent = ((activeIndex + 1) / steps.length) * 100;
  const isRunning = runState.phase === "initializing" || runState.phase === "running";
  const statusView = buildStatusView(runState.phase, runParams.runLabel);

  const missingInputs = useMemo(
    () => celloInputBundle.filter((item) => !String(celloInputs[item.id] || "").trim()),
    [celloInputs]
  );
  const canRunCello = missingInputs.length === 0 && !isRunning;

  const handleRunParamChange = (id, nextValue) => {
    setRunParams((current) => ({ ...current, [id]: nextValue }));
  };

  const handleCelloInputChange = (id, nextValue) => {
    setCelloInputs((current) => ({ ...current, [id]: nextValue }));
  };

  const handleMlParamChange = (id, value) => {
    setMlParams((prev) => ({ ...prev, [id]: value }));
  };

  const handleImportedNameChange = (id, nextValue) => {
    setImportedNames((current) => ({ ...current, [id]: nextValue }));
  };

  const goPrevious = () => setActiveIndex((value) => Math.max(0, value - 1));
  const goNext = () => setActiveIndex((value) => Math.min(steps.length - 1, value + 1));

  const handleRunCello = async () => {
    if (missingInputs.length > 0) {
      setRunState({
        phase: "error",
        result: null,
        error: `Missing required inputs: ${missingInputs.map((item) => item.title).join(", ")}`,
      });
      setCelloViewMode("summary");
      return;
    }

    setCelloViewMode("summary");
    setRunState({ phase: "initializing", result: null, error: "" });

    const formData = new FormData();
    for (const item of celloInputBundle) {
      const filename = importedNames[item.id] || defaultFilename(item.id, runParams.runLabel);
      const mimeType = item.accept === ".json" ? "application/json" : "text/plain";
      const file = new File([celloInputs[item.id]], filename, { type: mimeType });
      formData.append(formFieldName(item.id), file, filename);
    }

    formData.append("topN", runParams.topN);
    formData.append("iterations", runParams.iterations);
    formData.append("search", runParams.search);
    formData.append("runLabel", runParams.runLabel);

    const runningTimer = window.setTimeout(() => {
      setRunState((current) =>
        current.phase === "initializing" ? { ...current, phase: "running" } : current
      );
    }, 250);

    try {
      const response = await fetch(PIPELINE_API_URL, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      window.clearTimeout(runningTimer);

      if (!response.ok) {
        throw new Error(payload.error || "Pipeline run failed.");
      }

      setRunState({
        phase: "completed",
        result: payload,
        error: "",
      });
    } catch (error) {
      window.clearTimeout(runningTimer);
      setRunState({
        phase: "error",
        result: null,
        error: formatPipelineError(error),
      });
    }
  };

  const handleRunML = async () => {
  // --- VALIDATION ---
  if (!mlParams.trainSplit || !mlParams.topNFeatures) {
    setMlRunState({
      phase: "error",
      result: null,
      error: "Missing required ML parameters.",
    });
    return;
  }

  // --- INITIALIZE STATE ---
  setMlRunState({
    phase: "initializing",
    result: null,
    error: "",
  });

  // --- BUILD PAYLOAD ---
  const payload = {
    train_split: mlParams.trainSplit,
    top_n_features: mlParams.topNFeatures,
    threshold: mlParams.threshold,
  };

  // --- PROGRESS TRANSITION ---
  const runningTimer = window.setTimeout(() => {
    setMlRunState((current) =>
      current.phase === "initializing"
        ? { ...current, phase: "running" }
        : current
    );
  }, 250);

  try {
    // --- API REQUEST ---
    const response = await fetch("http://127.0.0.1:8000/run-ml", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    window.clearTimeout(runningTimer);

    // --- ERROR CHECK ---
    if (!response.ok) {
      throw new Error(data.error || "ML run failed.");
    }

    // --- SUCCESS ---
    setMlRunState({
      phase: "completed",
      result: data,
      error: "",
    });
  } catch (error) {
    window.clearTimeout(runningTimer);

    // --- FAILURE ---
    setMlRunState({
      phase: "error",
      result: null,
      error: error.message || "ML execution failed.",
    });
  }
};

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className={`sidebar card${sidebarCollapsed ? " collapsed" : ""}`}>
        <div className="sidebar-header">
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={sidebarCollapsed ? "Expand pipeline steps" : "Collapse pipeline steps"}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            <i className="fa-solid fa-bars" aria-hidden="true" />
          </button>
          <div className="sidebar-brand">
            <img className="hero-logo" src={logoSrc} alt="RuleScape logo" />
          </div>
        </div>

        <section className="sidebar-section">
          <span className="sidebar-label">Pipeline Steps</span>
          <div className="side-step-list">
            {steps.map((step, index) => {
              const state =
                index === activeIndex ? "active" : index < activeIndex ? "complete" : "upcoming";

              return (
                <button
                  key={step.id}
                  type="button"
                  className={`side-step ${state}`}
                  onClick={() => setActiveIndex(index)}
                  title={step.title}
                  aria-label={step.title}
                >
                  <span className="step-number">{step.number}</span>
                  <div className="side-step-copy">
                    <strong>{step.title}</strong>
                    <p>{step.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      <main className="workspace">
        <header className="hero card">
          <div className="hero-topline">
            <span className="progress-kicker">Step {activeIndex + 1} of {steps.length}</span>
            <div className="hero-nav-inline">
              <button
                className="ghost-button nav-button"
                type="button"
                onClick={goPrevious}
                disabled={activeIndex === 0}
                aria-label="Previous step"
              >
                <i className="fa-solid fa-angle-left" aria-hidden="true" />
              </button>
              <button
                className="primary-button nav-button"
                type="button"
                onClick={goNext}
                disabled={activeIndex === steps.length - 1}
                aria-label="Next step"
              >
                <i className="fa-solid fa-angle-right" aria-hidden="true" />
              </button>
            </div>
          </div>

          <h1>{currentStep.title}</h1>
          <p className="muted hero-copy">{currentStep.summary}</p>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={activeIndex + 1}
            aria-label={`Step ${activeIndex + 1} of ${steps.length}`}
          >
            <span className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </header>

        <div className="content-grid">
          <section className="stage-view">
            <ActiveStage
              {...(currentStep.id === "cello" && {
                runParams,
                runParameterFields,
                onRunParamChange: handleRunParamChange,
                celloInputs,
                importedNames,
                onCelloInputChange: handleCelloInputChange,
                onImportedNameChange: handleImportedNameChange,
                runState,
                runResult: runState.result,
                viewMode: celloViewMode,
                onEditInputs: () => setCelloViewMode("inputs"),
                isRunning,
              })}
              {...(currentStep.id === "ml" && {
                mlParams,
                onMlParamChange: handleMlParamChange,
                onRunML: handleRunML,
                mlRunState,
              })}
            />
          </section>


          <aside className="preview-rail">
            <section className="card preview-card">
              {currentStep.id === "cello" && (  
              <>
              <span className="sidebar-label">Run parameters</span>
              <div className="config-grid compact-config-grid">
                {runParameterFields.map((field) => (
                  <ConfigField
                    key={field.id}
                    field={field}
                    value={runParams[field.id]}
                    onChange={handleRunParamChange}
                  />
                ))}
              </div>

              <div className="run-control-stack">
                <span className={`chip status-chip ${runState.phase}`}>{statusView.label}</span>
                <div
                  className="status-progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={statusView.progress}
                  aria-label={`Pipeline status ${statusView.label}`}
                >
                  <span
                    className={`status-progress-fill ${runState.phase}`}
                    style={{ width: `${statusView.progress}%` }}
                  />
                </div>
                {runState.error ? <p className="error-text compact">{runState.error}</p> : null}
                <button
                  className="primary-button wide"
                  type="button"
                  onClick={handleRunCello}
                  disabled={!canRunCello}
                >
                  {isRunning ? "Running Cello..." : "Run Cello"}
                </button>
                {!canRunCello && !isRunning ? (
                  <p className="muted compact">
                    Complete all four Cello inputs before launching the pipeline.
                  </p>
                ) : null}
              </div>
              </>
              )}

              {currentStep.id === "ml" && (
              <>
                <span className="sidebar-label">ML Configuration</span>
                
                {/* Train / Test Split */}
                <div className="ml-param-block">
                  <div className="ml-param-header">
                  <span className="ml-param-label">Train/Test Split</span>
                  </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  className="ml-slider"
                  value={mlParams.trainSplit}
                  onChange={(e) =>
                    handleMlParamChange("trainSplit", Number(e.target.value))
                  }
                />
                <span className="ml-param-value">
                  {mlParams.trainSplit}%
                </span>
                </div>
                  

                {/* Top N Features */}
                <div className="ml-param-block">
                  <div className="ml-param-header">
                  <span className="ml-param-label">Top N Features</span>
                  </div>
                  
                <input
                  type="number"
                  className="config-control"
                  value={mlParams.topNFeatures}
                  onChange={(e) =>
                    handleMlParamChange("topNFeatures", Number(e.target.value))
                  }
                />
                <span className="ml-param-value">
                  {mlParams.topNFeatures}
                </span>
                </div>


                {/* Threshold */}
                <div className="ml-param-block">
                  <div className="ml-param-header">
                  <span className="ml-param-label">Threshold</span>
                  </div>
                  
                <input
                  type="number"
                  step="0.01"
                  className="config-control"
                  value={mlParams.threshold}
                  onChange={(e) =>
                    handleMlParamChange("threshold", Number(e.target.value))
                  }
                />
                <span className="ml-param-value">
                  {mlParams.threshold}
                </span>
              </div>

            {/* Run Button + Error */}
            <div className="run-control-stack">
              <button className="primary-button wide" onClick={handleRunML}>
                {mlRunState?.phase === "running"
                  ? "Running ML..."
                  : "Run ML"}
              </button>

              {mlRunState?.error && (
                <p className="error-text compact">{mlRunState.error}</p>
              )}
            </div>
            </>
          )} 
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function ConfigField({ field, value, onChange }) {
  const handleNumberAdjust = (direction) => {
    const step = Number(field.step || 1);
    const min = field.min !== undefined ? Number(field.min) : undefined;
    const max = field.max !== undefined ? Number(field.max) : undefined;
    const numericValue = Number(value);
    const baseValue = Number.isFinite(numericValue) ? numericValue : min ?? 0;
    const nextValue = baseValue + direction * step;
    const lowerBoundValue = min !== undefined ? Math.max(min, nextValue) : nextValue;
    const constrainedValue =
      max !== undefined ? Math.min(max, lowerBoundValue) : lowerBoundValue;

    onChange(field.id, String(constrainedValue));
  };

  const handleNumberChange = (event) => {
    const nextValue = event.target.value;

    if (nextValue === "") {
      onChange(field.id, nextValue);
      return;
    }

    const numericValue = Number(nextValue);
    const min = field.min !== undefined ? Number(field.min) : undefined;
    const max = field.max !== undefined ? Number(field.max) : undefined;

    if (!Number.isFinite(numericValue)) {
      return;
    }

    const lowerBoundValue = min !== undefined ? Math.max(min, numericValue) : numericValue;
    const constrainedValue =
      max !== undefined ? Math.min(max, lowerBoundValue) : lowerBoundValue;

    onChange(field.id, String(constrainedValue));
  };

  return (
    <label className={`config-item${field.fullWidth ? " full-width" : ""}`}>
      <span>{field.label}</span>
      {field.type === "select" ? (
        <select
          className="config-control"
          value={value}
          onChange={(event) => onChange(field.id, event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "number" ? (
        <div className="number-control-shell">
          <input
            className="config-control number-control-input"
            type="number"
            value={value}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={handleNumberChange}
          />
          <div className="number-stepper" aria-hidden="true">
            <button
              className="number-stepper-button"
              type="button"
              tabIndex={-1}
              onClick={() => handleNumberAdjust(1)}
              aria-label={`Increase ${field.label}`}
            >
              <i className="fa-solid fa-angle-up" aria-hidden="true" />
            </button>
            <button
              className="number-stepper-button"
              type="button"
              tabIndex={-1}
              onClick={() => handleNumberAdjust(-1)}
              aria-label={`Decrease ${field.label}`}
            >
              <i className="fa-solid fa-angle-down" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <input
          className="config-control"
          type={field.type}
          value={value}
          min={field.min}
          step={field.step}
          onChange={(event) => onChange(field.id, event.target.value)}
        />
      )}
    </label>
  );
}
