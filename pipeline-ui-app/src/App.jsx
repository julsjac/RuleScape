import { useEffect, useMemo, useState } from "react";
import rulescapeLogoFull from "./assets/rulescape_logo.png";
import rulescapeLogoCrop from "./assets/rulescape_logo_crop.png";
import {
  BridgeStage,
  createEmptyKnoxBundleInputs,
  createEmptyKnoxBundleNames,
  createEmptyKnoxRuleInputs,
  createEmptyKnoxRuleNames,
} from "./stages/KnoxStage";
import {
  CelloStage,
  celloInputBundle,
  createEmptyCelloInputs,
  createEmptyImportedNames,
} from "./stages/CelloStage";
import { MlStage } from "./stages/MlStage";
import { ReportStage } from "./stages/ResultStage";

const CELLO_PIPELINE_API_URL =
  import.meta.env.VITE_PIPELINE_API_URL ||
  "http://127.0.0.1:8051/api/pipeline/cello-knox/run";
const CELLO_HEALTH_URL =
  import.meta.env.VITE_PIPELINE_HEALTH_URL ||
  CELLO_PIPELINE_API_URL.replace("/api/pipeline/cello-knox/run", "/api/pipeline/health");
const KNOX_PIPELINE_API_URL =
  import.meta.env.VITE_KNOX_API_URL || "http://127.0.0.1:8051/api/pipeline/knox/run";
const KNOX_HEALTH_URL =
  import.meta.env.VITE_KNOX_HEALTH_URL ||
  KNOX_PIPELINE_API_URL.replace("/api/pipeline/knox/run", "/api/pipeline/knox/health");

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
    subtitle: "Import and evaluate rules",
    summary: "Choose a Knox bundle, import it into Knox, then evaluate it against Goldbar rules.",
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

const celloRunParameterFields = [
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

const knoxRunParameterFields = [
  {
    id: "outputSpacePrefix",
    label: "Output prefix",
    type: "text",
    value: "rulescape_knox",
    fullWidth: true,
  },
  {
    id: "designGroupId",
    label: "Design group",
    type: "text",
    value: "rulescape_knox_designs",
    fullWidth: true,
  },
  {
    id: "ruleSpaceId",
    label: "Rule space",
    type: "text",
    value: "rulescape_knox_rules",
    fullWidth: true,
  },
  {
    id: "rulesGroupId",
    label: "Rules group",
    type: "text",
    value: "rulescape_knox_rule_group",
    fullWidth: true,
  },
  {
    id: "evaluationName",
    label: "Evaluation name",
    type: "text",
    value: "rulescape_knox_eval",
    fullWidth: true,
  },
  {
    id: "labelingMethod",
    label: "Labeling",
    type: "select",
    value: "median",
    options: ["median", "sign"],
    fullWidth: true,
  },
];

const initialCelloRunParams = Object.fromEntries(
  celloRunParameterFields.map((item) => [item.id, item.value])
);
const initialKnoxRunParams = Object.fromEntries(
  knoxRunParameterFields.map((item) => [item.id, item.value])
);

const serviceStatusMeta = {
  cello: {
    checking: {
      label: "Checking Cello service",
      tone: "checking",
      note: "Checking whether the Cello pipeline server is reachable.",
    },
    online: {
      label: "Cello online",
      tone: "online",
      note: "",
    },
    offline: {
      label: "Cello server offline",
      tone: "offline",
      note: "Start the Cello pipeline server locally, then Run Cello becomes available.",
    },
  },
  knox: {
    checking: {
      label: "Checking Knox service",
      tone: "checking",
      note: "Checking whether the Knox server is reachable.",
    },
    online: {
      label: "Knox online",
      tone: "online",
      note: "",
    },
    offline: {
      label: "Knox server offline",
      tone: "offline",
      note: "Start the Knox Spring server on port 8080, then Run Knox becomes available.",
    },
  },
};

const runStatusMeta = {
  idle: {
    label: "Idle",
    progress: 0,
    tone: "idle",
  },
  initializing: {
    label: "Started / Initializing",
    progress: 18,
    tone: "initializing",
  },
  running: {
    label: "Running",
    progress: 68,
    tone: "running",
  },
  completed: {
    label: "Completed",
    progress: 100,
    tone: "completed",
  },
  error: {
    label: "Error",
    progress: 100,
    tone: "error",
  },
};

function buildServiceView(kind, status) {
  return serviceStatusMeta[kind]?.[status] || serviceStatusMeta[kind]?.checking;
}

function buildRunStatusView(phase, serviceStatus) {
  const base = runStatusMeta[phase] || runStatusMeta.idle;

  if (phase === "idle") {
    return {
      ...base,
      label: serviceStatus === "online" ? "Ready" : "Idle",
      tone: serviceStatus === "online" ? "ready" : "idle",
    };
  }

  return base;
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
  return message || "Pipeline run failed.";
}

function createIdleRunState() {
  return {
    phase: "idle",
    result: null,
    error: "",
    action: "",
  };
}

export default function App() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const [celloRunParams, setCelloRunParams] = useState(initialCelloRunParams);
  const [knoxRunParams, setKnoxRunParams] = useState(initialKnoxRunParams);

  const [celloServiceStatus, setCelloServiceStatus] = useState("checking");
  const [knoxServiceStatus, setKnoxServiceStatus] = useState("checking");

  const [celloInputs, setCelloInputs] = useState(createEmptyCelloInputs);
  const [importedNames, setImportedNames] = useState(createEmptyImportedNames);
  const [celloViewMode, setCelloViewMode] = useState("inputs");
  const [runState, setRunState] = useState({
    phase: "idle",
    result: null,
    error: "",
  });
  const [selectedKnoxContext, setSelectedKnoxContext] = useState({
    evalName: "",
    groupId: null,
    ruleGroupId: null,
  });
  const [mlRunState, setMlRunState] = useState({
    phase: "idle",
    result: null,
    error: "",
  });

  const [knoxBundleSource, setKnoxBundleSource] = useState("generated");
  const [knoxBundleInputs, setKnoxBundleInputs] = useState(createEmptyKnoxBundleInputs);
  const [knoxBundleNames, setKnoxBundleNames] = useState(createEmptyKnoxBundleNames);
  const [knoxRuleInputs, setKnoxRuleInputs] = useState(createEmptyKnoxRuleInputs);
  const [knoxRuleNames, setKnoxRuleNames] = useState(createEmptyKnoxRuleNames);

  const [celloRunState, setCelloRunState] = useState(createIdleRunState);
  const [knoxRunState, setKnoxRunState] = useState(createIdleRunState);
  const [mlRunState, setMlRunState] = useState(createIdleRunState);
  const [mlParams, setMlParams] = useState({
    trainSplit: 70,
    topNFeatures: 10,
    threshold: 0.5,
  });

  const currentStep = steps[activeIndex];
  const ActiveStage = stageComponents[currentStep.id];
  const logoSrc = sidebarCollapsed ? rulescapeLogoCrop : rulescapeLogoFull;
  const progressPercent = ((activeIndex + 1) / steps.length) * 100;

  const isCelloRunning =
    celloRunState.phase === "initializing" || celloRunState.phase === "running";
  const isKnoxRunning = knoxRunState.phase === "initializing" || knoxRunState.phase === "running";
  const isMlRunning = mlRunState.phase === "initializing" || mlRunState.phase === "running";

  const celloServiceView = buildServiceView("cello", celloServiceStatus);
  const knoxServiceView = buildServiceView("knox", knoxServiceStatus);
  const celloStatusView = buildRunStatusView(celloRunState.phase, celloServiceStatus);
  const knoxStatusView = buildRunStatusView(knoxRunState.phase, knoxServiceStatus);
  const mlStatusView = buildRunStatusView(mlRunState.phase, "online");

  const runRailMode =
    currentStep.id === "cello"
      ? "cello"
      : currentStep.id === "bridge"
        ? "knox"
        : currentStep.id === "ml"
          ? "ml"
          : null;

  const missingCelloInputs = useMemo(
    () => celloInputBundle.filter((item) => !String(celloInputs[item.id] || "").trim()),
    [celloInputs]
  );
  const canRunCello =
    celloServiceStatus === "online" && missingCelloInputs.length === 0 && !isCelloRunning;
  const celloActionLabel =
    celloServiceStatus !== "online"
      ? "Launch Cello"
      : isCelloRunning
        ? "Running Cello..."
        : "Run Cello";

  const generatedKnoxBundleReady = Boolean(celloRunState.result?.requestId);
  const uploadedKnoxBundleReady = Boolean(
    String(knoxBundleInputs.designs || "").trim() &&
      String(knoxBundleInputs.partLibrary || "").trim()
  );
  const knoxBundleReady =
    knoxBundleSource === "generated" ? generatedKnoxBundleReady : uploadedKnoxBundleReady;
  const hasKnoxRules =
    Boolean(String(knoxRuleInputs.goldbar || "").trim()) &&
    Boolean(String(knoxRuleInputs.categories || "").trim());
  const importedKnoxGroupId = knoxRunState.result?.import?.designGroupId || "";
  const importedKnoxOutputPrefix = knoxRunState.result?.import?.outputSpacePrefix || "";
  const hasImportedKnoxBundle = Boolean(importedKnoxGroupId);
  const importedKnoxGroupMatchesCurrent =
    hasImportedKnoxBundle &&
    importedKnoxGroupId === knoxRunParams.designGroupId &&
    importedKnoxOutputPrefix === knoxRunParams.outputSpacePrefix;
  const canImportKnox = knoxServiceStatus === "online" && knoxBundleReady && !isKnoxRunning;
  const canEvaluateKnox =
    knoxServiceStatus === "online" &&
    hasImportedKnoxBundle &&
    importedKnoxGroupMatchesCurrent &&
    hasKnoxRules &&
    !isKnoxRunning;

  useEffect(() => {
    let active = true;

    const checkCelloService = async () => {
      try {
        const response = await fetch(CELLO_HEALTH_URL);
        if (!response.ok) {
          throw new Error("Health check failed.");
        }
        const payload = await response.json();
        if (!active) {
          return;
        }
        setCelloServiceStatus(payload.status === "ok" ? "online" : "offline");
      } catch {
        if (!active) {
          return;
        }
        setCelloServiceStatus("offline");
      }
    };

    checkCelloService();
    const intervalId = window.setInterval(checkCelloService, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const checkKnoxService = async () => {
      try {
        const response = await fetch(KNOX_HEALTH_URL);
        if (!response.ok) {
          throw new Error("Health check failed.");
        }
        const payload = await response.json();
        if (!active) {
          return;
        }
        setKnoxServiceStatus(payload.status === "ok" ? "online" : "offline");
      } catch {
        if (!active) {
          return;
        }
        setKnoxServiceStatus("offline");
      }
    };

    checkKnoxService();
    const intervalId = window.setInterval(checkKnoxService, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleCelloRunParamChange = (id, nextValue) => {
    setCelloRunParams((current) => ({ ...current, [id]: nextValue }));
  };

  const handleKnoxRunParamChange = (id, nextValue) => {
    setKnoxRunParams((current) => ({ ...current, [id]: nextValue }));
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

  const handleKnoxBundleInputChange = (id, nextValue) => {
    setKnoxBundleInputs((current) => ({ ...current, [id]: nextValue }));
  };

  const handleKnoxBundleNameChange = (id, nextValue) => {
    setKnoxBundleNames((current) => ({ ...current, [id]: nextValue }));
  };

  const handleKnoxRuleInputChange = (id, nextValue) => {
    setKnoxRuleInputs((current) => ({ ...current, [id]: nextValue }));
  };

  const handleKnoxRuleNameChange = (id, nextValue) => {
    setKnoxRuleNames((current) => ({ ...current, [id]: nextValue }));
  };

  const goPrevious = () => setActiveIndex((value) => Math.max(0, value - 1));
  const goNext = () => setActiveIndex((value) => Math.min(steps.length - 1, value + 1));

  const handleRunCello = async () => {
    if (celloServiceStatus !== "online") {
      setCelloRunState({
        phase: "error",
        result: null,
        error: "Cello pipeline server is offline.",
      });
      setCelloViewMode("summary");
      return;
    }

    if (missingCelloInputs.length > 0) {
      setCelloRunState({
        phase: "error",
        result: null,
        error: `Missing required inputs: ${missingCelloInputs.map((item) => item.title).join(", ")}`,
      });
      setCelloViewMode("summary");
      return;
    }

    setCelloViewMode("summary");
    setCelloRunState({ phase: "initializing", result: null, error: "" });

    const formData = new FormData();
    for (const item of celloInputBundle) {
      const filename = importedNames[item.id] || defaultFilename(item.id, celloRunParams.runLabel);
      const mimeType = item.accept === ".json" ? "application/json" : "text/plain";
      const file = new File([celloInputs[item.id]], filename, { type: mimeType });
      formData.append(formFieldName(item.id), file, filename);
    }

    formData.append("topN", celloRunParams.topN);
    formData.append("iterations", celloRunParams.iterations);
    formData.append("search", celloRunParams.search);
    formData.append("runLabel", celloRunParams.runLabel);

    const runningTimer = window.setTimeout(() => {
      setCelloRunState((current) =>
        current.phase === "initializing" ? { ...current, phase: "running" } : current
      );
    }, 250);

    try {
      const response = await fetch(CELLO_PIPELINE_API_URL, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      window.clearTimeout(runningTimer);

      if (!response.ok) {
        throw new Error(payload.error || "Pipeline run failed.");
      }

      setCelloServiceStatus("online");
      setCelloRunState({
        phase: "completed",
        result: payload,
        error: "",
      });
    } catch (error) {
      window.clearTimeout(runningTimer);
      setCelloRunState({
        phase: "error",
        result: null,
        error: formatPipelineError(error),
      });
    }
  };

  const handleRunML = async (incoming) => {
  // --- VALIDATION ---
  if (!mlParams.trainSplit || !mlParams.topNFeatures) {
  const handleRunML = async (nextPayload = null) => {
    const resolvedParams = {
      trainSplit: Number(nextPayload?.trainSplit ?? mlParams.trainSplit),
      topNFeatures: Number(nextPayload?.topNFeatures ?? mlParams.topNFeatures),
      threshold: Number(nextPayload?.threshold ?? mlParams.threshold),
      models: Array.isArray(nextPayload?.models) ? nextPayload.models : [],
    };

    if (!resolvedParams.trainSplit || !resolvedParams.topNFeatures) {
      setMlRunState({
        phase: "error",
        result: null,
        error: "Missing required ML parameters.",
        action: "",
      });
      return;
    }

    setMlRunState({
      phase: "initializing",
      result: null,
      error: "",
      action: "",
    });

  // --- KNOX SELECTION VALIDATION ---
  if (
    !selectedKnoxContext.evalName ||
    selectedKnoxContext.groupId == null ||
    selectedKnoxContext.ruleGroupId == null
  ) {
    setMlRunState({
      phase: "error",
      result: null,
      error: "No Knox selection provided.",
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

    // Knox Context
    eval_name: selectedKnoxContext.evalName,
    group_id: selectedKnoxContext.groupId,
    rule_group_id: selectedKnoxContext.ruleGroupId,

    // <-- coming from MlStage
    models: incoming.models || [],

    const payload = {
      train_split: resolvedParams.trainSplit,
      top_n_features: resolvedParams.topNFeatures,
      threshold: resolvedParams.threshold,
      models: resolvedParams.models,
    };

    const runningTimer = window.setTimeout(() => {
      setMlRunState((current) =>
        current.phase === "initializing" ? { ...current, phase: "running" } : current
      );
    }, 250);

    try {
      const response = await fetch("http://127.0.0.1:8000/run-ml", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      window.clearTimeout(runningTimer);

      if (!response.ok) {
        throw new Error(data.error || "ML run failed.");
      }

      setMlRunState({
        phase: "completed",
        result: data,
        error: "",
        action: "",
      });
    } catch (error) {
      window.clearTimeout(runningTimer);
      setMlRunState({
        phase: "error",
        result: null,
        error: formatPipelineError(error),
        action: "",
      });
    }
  };

  const handleRunKnox = async (action) => {
    if (knoxServiceStatus !== "online") {
      setKnoxRunState({
        phase: "error",
        result: knoxRunState.result,
        error: "Knox server is offline.",
        action,
      });
      return;
    }

    if (action === "import" && !knoxBundleReady) {
      setKnoxRunState({
        phase: "error",
        result: knoxRunState.result,
        error:
          knoxBundleSource === "generated"
            ? "Run Cello first, or switch the Knox bundle source to Uploaded."
            : "Upload designs.csv and part_library.csv before importing.",
        action,
      });
      return;
    }

    if (action === "evaluate" && !hasImportedKnoxBundle) {
      setKnoxRunState({
        phase: "error",
        result: knoxRunState.result,
        error: "Import the Knox bundle first before evaluating rules.",
        action,
      });
      return;
    }

    if (action === "evaluate" && !importedKnoxGroupMatchesCurrent) {
      setKnoxRunState({
        phase: "error",
        result: knoxRunState.result,
        error: "The Knox import settings changed. Re-import the bundle before evaluating rules.",
        action,
      });
      return;
    }

    if (action === "evaluate" && !hasKnoxRules) {
      setKnoxRunState({
        phase: "error",
        result: knoxRunState.result,
        error: "Goldbar and categories are required before evaluating rules.",
        action,
      });
      return;
    }

    setKnoxRunState({
      phase: "initializing",
      result: action === "evaluate" ? knoxRunState.result : null,
      error: "",
      action,
    });

    const requestPayload = {
      action,
      bundleSource: knoxBundleSource,
      celloRequestId: celloRunState.result?.requestId || "",
      uploadedBundle:
        knoxBundleSource === "uploaded"
          ? {
              designs: knoxBundleInputs.designs,
              partLibrary: knoxBundleInputs.partLibrary,
              weight: knoxBundleInputs.weight,
            }
          : undefined,
      outputSpacePrefix: knoxRunParams.outputSpacePrefix,
      designGroupId: knoxRunParams.designGroupId,
      ruleSpaceId: knoxRunParams.ruleSpaceId,
      rulesGroupId: knoxRunParams.rulesGroupId,
      evaluationName: knoxRunParams.evaluationName,
      labelingMethod: knoxRunParams.labelingMethod,
      goldbar: action === "evaluate" ? knoxRuleInputs.goldbar : "",
      categories: action === "evaluate" ? knoxRuleInputs.categories : "",
    };

    const runningTimer = window.setTimeout(() => {
      setKnoxRunState((current) =>
        current.phase === "initializing" ? { ...current, phase: "running", action } : current
      );
    }, 250);

    try {
      const response = await fetch(KNOX_PIPELINE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
      const payload = await response.json();
      window.clearTimeout(runningTimer);

      if (!response.ok) {
        throw new Error(payload.error || "Knox run failed.");
      }

      setKnoxServiceStatus("online");
      setKnoxRunState({
        phase: "completed",
        result: payload,
        error: "",
        action,
      });
    } catch (error) {
      window.clearTimeout(runningTimer);
      setKnoxRunState({
        phase: "error",
        result: action === "evaluate" ? knoxRunState.result : null,
        error: formatPipelineError(error),
        action,
      });
    }
  };

  const knoxReadyNote =
    knoxBundleSource === "generated"
      ? "This path uses the CSV bundle generated by the latest Cello run."
      : "This path uses the uploaded Knox CSV files instead of the generated Cello bundle.";

  const knoxImportNote =
    knoxBundleSource === "generated" && !generatedKnoxBundleReady
      ? "Run Cello first, or switch the Knox bundle source to Uploaded."
      : knoxBundleSource === "uploaded" && !uploadedKnoxBundleReady
        ? "Upload designs.csv and part_library.csv before importing."
        : hasImportedKnoxBundle && importedKnoxGroupMatchesCurrent
          ? `Bundle imported into ${importedKnoxGroupId}.`
          : "Import Bundle will create the Knox design group for this step.";

  const knoxEvaluateNote = !hasImportedKnoxBundle
    ? "Import the bundle first. Evaluate Rules unlocks after a successful import."
    : !importedKnoxGroupMatchesCurrent
      ? "Knox import settings changed after the last import. Re-import before evaluating rules."
      : !hasKnoxRules
        ? "Add both Goldbar and categories to enable Evaluate Rules."
        : "Evaluate Rules will run Knox rule evaluation on the imported design group.";

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

        <div className={`content-grid${runRailMode ? "" : " single-column"}`}>
          <section className="stage-view">
            <ActiveStage
              {...(currentStep.id === "cello" && {
                celloInputs,
                importedNames,
                onCelloInputChange: handleCelloInputChange,
                onImportedNameChange: handleImportedNameChange,
                runState: celloRunState,
                runResult: celloRunState.result,
                viewMode: celloViewMode,
                onEditInputs: () => setCelloViewMode("inputs"),
                isRunning: isCelloRunning,
              })}
              {...(currentStep.id === "bridge" && {
                runResult: celloRunState.result,
                knoxRunResult: knoxRunState.result,
                knoxBundleSource,
                onKnoxBundleSourceChange: setKnoxBundleSource,
                knoxBundleInputs,
                knoxBundleNames,
                onKnoxBundleInputChange: handleKnoxBundleInputChange,
                onKnoxBundleNameChange: handleKnoxBundleNameChange,
                knoxRuleInputs,
                knoxRuleNames,
                onKnoxRuleInputChange: handleKnoxRuleInputChange,
                onKnoxRuleNameChange: handleKnoxRuleNameChange,
                knoxRunParams,
              })}
              {...(currentStep.id === "ml" && {
                mlParams,
                onMlParamChange: handleMlParamChange,
                onRunML: handleRunML,
                mlRunState,
              })}
              runParams={celloRunParams}
              runParameterFields={celloRunParameterFields}
              onRunParamChange={handleCelloRunParamChange}
            />
          </section>

          {runRailMode === "cello" ? (
            <aside className="preview-rail">
              <section className="card preview-card">
                <span className="sidebar-label">Run parameters</span>
                <div className="config-grid compact-config-grid">
                  {celloRunParameterFields.map((field) => (
                    <ConfigField
                      key={field.id}
                      field={field}
                      value={celloRunParams[field.id]}
                      onChange={handleCelloRunParamChange}
                    />
                  ))}
                </div>

                <div className="run-control-stack">
                  <div className="status-meta-grid">
                    <div className="status-meta-block">
                      <span className="sidebar-label">Cello service</span>
                      <span className={`chip status-chip service-chip ${celloServiceView.tone}`}>
                        {celloServiceView.label}
                      </span>
                    </div>
                    <div className="status-meta-block">
                      <span className="sidebar-label">Run status</span>
                      <span className={`chip status-chip run-chip ${celloStatusView.tone}`}>
                        {celloStatusView.label}
                      </span>
                    </div>
                  </div>

                  <div
                    className="status-progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={celloStatusView.progress}
                    aria-label={`Cello status ${celloStatusView.label}`}
                  >
                    <span
                      className={`status-progress-fill ${celloRunState.phase}`}
                      style={{ width: `${celloStatusView.progress}%` }}
                    />
                  </div>

                  {celloRunState.error ? <p className="error-text compact">{celloRunState.error}</p> : null}

                  <button
                    className="primary-button wide"
                    type="button"
                    onClick={handleRunCello}
                    disabled={!canRunCello}
                  >
                    {celloActionLabel}
                  </button>

                  {celloServiceView.note ? <p className="muted compact">{celloServiceView.note}</p> : null}
                  {celloServiceStatus === "online" && !canRunCello && !isCelloRunning ? (
                    <p className="muted compact">
                      Complete all four Cello inputs before launching the pipeline.
                    </p>
                  ) : null}
                </div>
              </section>
            </aside>
          ) : null}

          {runRailMode === "knox" ? (
            <aside className="preview-rail">
              <section className="card preview-card">
                <span className="sidebar-label">Knox parameters</span>
                <div className="config-grid compact-config-grid">
                  {knoxRunParameterFields.map((field) => (
                    <ConfigField
                      key={field.id}
                      field={field}
                      value={knoxRunParams[field.id]}
                      onChange={handleKnoxRunParamChange}
                    />
                  ))}
                </div>

                <div className="run-control-stack">
                  <div className="status-meta-grid">
                    <div className="status-meta-block">
                      <span className="sidebar-label">Knox service</span>
                      <span className={`chip status-chip service-chip ${knoxServiceView.tone}`}>
                        {knoxServiceView.label}
                      </span>
                    </div>
                    <div className="status-meta-block">
                      <span className="sidebar-label">Run status</span>
                      <span className={`chip status-chip run-chip ${knoxStatusView.tone}`}>
                        {knoxStatusView.label}
                      </span>
                    </div>
                  </div>

                  <div
                    className="status-progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={knoxStatusView.progress}
                    aria-label={`Knox status ${knoxStatusView.label}`}
                  >
                    <span
                      className={`status-progress-fill ${knoxRunState.phase}`}
                      style={{ width: `${knoxStatusView.progress}%` }}
                    />
                  </div>

                  {knoxRunState.error ? <p className="error-text compact">{knoxRunState.error}</p> : null}

                  <div className="action-button-stack">
                    <button
                      className="ghost-button wide"
                      type="button"
                      onClick={() => handleRunKnox("import")}
                      disabled={!canImportKnox}
                    >
                      {isKnoxRunning && knoxRunState.action === "import"
                        ? "Importing Bundle..."
                        : "Import Bundle"}
                    </button>
                    <button
                      className="primary-button wide"
                      type="button"
                      onClick={() => handleRunKnox("evaluate")}
                      disabled={!canEvaluateKnox}
                    >
                      {isKnoxRunning && knoxRunState.action === "evaluate"
                        ? "Evaluating Rules..."
                        : "Evaluate Rules"}
                    </button>
                  </div>

                  <p className="muted compact">{knoxReadyNote}</p>
                  <p className="muted compact">{knoxImportNote}</p>
                  <p className="muted compact">{knoxEvaluateNote}</p>
                  {knoxServiceView.note ? <p className="muted compact">{knoxServiceView.note}</p> : null}
                </div>
              </section>
            </aside>
          ) : null}

          {runRailMode === "ml" ? (
            <aside className="preview-rail">
              <section className="card preview-card">
                <span className="sidebar-label">ML Configuration</span>

                <div className="status-meta-grid">
                  <div className="status-meta-block">
                    <span className="sidebar-label">Run status</span>
                    <span className={`chip status-chip run-chip ${mlStatusView.tone}`}>
                      {mlStatusView.label}
                    </span>
                  </div>
                </div>

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
                    onChange={(event) =>
                      handleMlParamChange("trainSplit", Number(event.target.value))
                    }
                  />
                  <span className="ml-param-value">{mlParams.trainSplit}%</span>
                </div>

                <div className="ml-param-block">
                  <div className="ml-param-header">
                    <span className="ml-param-label">Top N Features</span>
                  </div>
                  <input
                    type="number"
                    className="config-control"
                    value={mlParams.topNFeatures}
                    onChange={(event) =>
                      handleMlParamChange("topNFeatures", Number(event.target.value))
                    }
                  />
                  <span className="ml-param-value">{mlParams.topNFeatures}</span>
                </div>

                <div className="ml-param-block">
                  <div className="ml-param-header">
                    <span className="ml-param-label">Threshold</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    className="config-control"
                    value={mlParams.threshold}
                    onChange={(event) =>
                      handleMlParamChange("threshold", Number(event.target.value))
                    }
                  />
                  <span className="ml-param-value">{mlParams.threshold}</span>
                </div>

                <div className="run-control-stack">
                  <button
                    className="primary-button wide"
                    type="button"
                    onClick={() => handleRunML()}
                    disabled={isMlRunning}
                  >
                    {isMlRunning ? "Running ML..." : "Run ML"}
                  </button>

                  {mlRunState.error ? <p className="error-text compact">{mlRunState.error}</p> : null}
                </div>
              </section>
            </aside>
          ) : null}
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
