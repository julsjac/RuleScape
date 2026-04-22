import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState } from "react";

export const knoxBundleSpecs = [
  {
    id: "designs",
    name: "designs.csv",
    note: "ordered selected parts per imported design",
    accept: ".csv",
  },
  {
    id: "partLibrary",
    name: "part_library.csv",
    note: "part IDs and roles used during Knox CSV import",
    accept: ".csv",
  },
  {
    id: "weight",
    name: "weight.csv",
    note: "optional design scores used for Knox labeling",
    accept: ".csv",
    optional: true,
  },
];

export const knoxRuleSpecs = [
  {
    id: "goldbar",
    title: "Goldbar",
    note: "rule expression to import into Knox, or a CSV with a goldbar column",
    accept: ".txt,.goldbar,.gb,.csv",
    placeholder: "Write or import the Goldbar rule specification",
  },
  {
    id: "categories",
    title: "categories.json",
    note: "category mapping JSON for the Goldbar rules",
    accept: ".json",
    placeholder: "Write or import the categories JSON",
  },
];

const generatedFileNotes = {
  designs: "ordered selected parts per exported design",
  partLibrary: "all part IDs and roles resolved from the UCF",
  weight: "Cello circuit score for each exported design",
  summary: "human-readable summary of the ranked adapter output",
};

const rolePalette = [
  { bg: "rgba(134, 242, 255, 0.12)", border: "rgba(134, 242, 255, 0.2)", text: "#86f2ff" },
  { bg: "rgba(141, 245, 214, 0.12)", border: "rgba(141, 245, 214, 0.2)", text: "#8df5d6" },
  { bg: "rgba(255, 211, 126, 0.12)", border: "rgba(255, 211, 126, 0.2)", text: "#ffd37e" },
  { bg: "rgba(210, 182, 255, 0.12)", border: "rgba(210, 182, 255, 0.2)", text: "#d2b6ff" },
  { bg: "rgba(255, 177, 153, 0.12)", border: "rgba(255, 177, 153, 0.2)", text: "#ffb199" },
];

const rawJsonEditorOptions = {
  automaticLayout: true,
  readOnly: true,
  domReadOnly: true,
  fontFamily: "IBM Plex Mono, monospace",
  fontSize: 13,
  lineHeight: 20,
  minimap: { enabled: false },
  padding: { top: 16, bottom: 16 },
  scrollBeyondLastLine: false,
  tabSize: 2,
  wordWrap: "off",
  lineNumbers: "on",
  lineNumbersMinChars: 3,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  folding: true,
  renderLineHighlight: "line",
  renderLineHighlightOnlyWhenFocus: true,
};

export function createEmptyKnoxBundleInputs() {
  return {
    designs: "",
    partLibrary: "",
    weight: "",
  };
}

export function createEmptyKnoxBundleNames() {
  return {
    designs: "",
    partLibrary: "",
    weight: "",
  };
}

export function createEmptyKnoxRuleInputs() {
  return {
    goldbar: "",
    categories: "",
  };
}

export function createEmptyKnoxRuleNames() {
  return {
    goldbar: "",
    categories: "",
  };
}

function hashString(value = "") {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }
  return Math.abs(hash);
}

function colorForRole(role, index) {
  const paletteIndex = role ? hashString(role) % rolePalette.length : index % rolePalette.length;
  return rolePalette[paletteIndex];
}

function humanizeRole(role, index) {
  if (!role) {
    return `Part ${index + 1}`;
  }

  return role.replace(/_/g, " ");
}

function matchesAcceptedExtension(fileName, accept) {
  const accepted = accept
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return accepted.some((suffix) => fileName.toLowerCase().endsWith(suffix));
}

function parseCsvRow(line = "") {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function extractGoldbarExpression(text = "") {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return "";
  }

  const headers = parseCsvRow(lines[0]).map((header) => header.trim());
  const goldbarIndex = headers.findIndex((header) => header.toLowerCase() === "goldbar");

  if (goldbarIndex < 0) {
    return "";
  }

  const values = lines
    .slice(1)
    .map((line) => parseCsvRow(line)[goldbarIndex] || "")
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return "";
  }

  return values.sort((left, right) => right.length - left.length)[0];
}

function parseCsv(text = "") {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

function parseWeightScores(text = "") {
  const rows = parseCsv(text);
  if (rows.length <= 1) {
    return [];
  }

  return rows
    .slice(1)
    .map((row) => Number(row[0]))
    .filter((value) => Number.isFinite(value));
}

function buildPartRoleLookup(text = "") {
  const rows = parseCsv(text);
  if (rows.length <= 1) {
    return {};
  }

  const lookup = {};
  rows.slice(1).forEach((row) => {
    if (row[0]) {
      lookup[row[0]] = row[1] || "";
    }
  });
  return lookup;
}

function buildUploadedCandidates(bundleInputs, outputSpacePrefix) {
  const rows = parseCsv(bundleInputs.designs);
  if (rows.length <= 1) {
    return [];
  }

  const partRoleLookup = buildPartRoleLookup(bundleInputs.partLibrary);
  const scores = parseWeightScores(bundleInputs.weight);
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell));

  return dataRows.map((row, index) => {
    const selectedParts = row.filter(Boolean);
    const rank = index + 1;
    return {
      rank,
      designId: buildDesignId(outputSpacePrefix, rank),
      selected_gate: `Manual design ${rank}`,
      score: scores[index] ?? null,
      selected_parts: selectedParts,
      selected_roles: selectedParts.map((part) => partRoleLookup[part] || ""),
      input_assignments: [],
      output_assignments: [],
    };
  });
}

function buildGeneratedCandidates(candidates, outputSpacePrefix) {
  return (candidates || []).map((candidate) => ({
    ...candidate,
    designId: buildDesignId(outputSpacePrefix, candidate.rank),
  }));
}

function buildDesignId(outputSpacePrefix, rank) {
  return `${outputSpacePrefix}_design_(${rank})`;
}

function buildDesignModules(candidate) {
  const parts = candidate?.selected_parts ?? [];
  const roles = candidate?.selected_roles ?? [];

  return parts.map((part, index) => ({
    id: `${candidate?.designId ?? candidate?.rank ?? "design"}-${part}-${index}`,
    part,
    role: roles[index] || "",
    palette: colorForRole(roles[index], index),
    step: index + 1,
  }));
}

function buildCandidateCards(evaluation, fallbackCandidates) {
  if (evaluation?.executed) {
    return evaluation.designs.map((design) => ({
      key: design.designId,
      designId: design.designId,
      title: design.designId,
      score: Number(design.score),
      subtitle: `${design.passedCount}/${evaluation.ruleCount} rules keep this design`,
    }));
  }

  return fallbackCandidates.map((candidate) => ({
    key: candidate.designId,
    designId: candidate.designId,
    title: candidate.selected_gate,
    score: Number(candidate.score),
    subtitle: `${candidate.selected_parts.length} parts`,
  }));
}

function formatCandidateScore(score) {
  const numericScore = Number(score);
  return Number.isFinite(numericScore) ? numericScore.toFixed(4) : "no score";
}

function buildRuleMetricSummary(evaluation) {
  if (!evaluation?.executed || evaluation.rules.length === 0) {
    return {
      topImpact: "—",
      evaluatedRules: "0",
    };
  }

  const topRule = evaluation.topRule || evaluation.rules[0];
  const impactValue = Number(topRule?.impact);
  return {
    topImpact: Number.isFinite(impactValue) ? impactValue.toFixed(0) : "—",
    evaluatedRules: String(evaluation.ruleCount),
  };
}

export function BridgeStage({
  runResult,
  knoxRunResult,
  knoxBundleSource,
  onKnoxBundleSourceChange = () => {},
  knoxBundleInputs = createEmptyKnoxBundleInputs(),
  knoxBundleNames = createEmptyKnoxBundleNames(),
  onKnoxBundleInputChange = () => {},
  onKnoxBundleNameChange = () => {},
  knoxRuleInputs = createEmptyKnoxRuleInputs(),
  knoxRuleNames = createEmptyKnoxRuleNames(),
  onKnoxRuleInputChange = () => {},
  onKnoxRuleNameChange = () => {},
  knoxRunParams,
}) {
  const [openGeneratedName, setOpenGeneratedName] = useState(null);
  const [openBundleName, setOpenBundleName] = useState(null);
  const [openRuleName, setOpenRuleName] = useState(null);
  const [selectedDesignId, setSelectedDesignId] = useState(null);
  const [latestOutputTab, setLatestOutputTab] = useState("summary");
  const bundleFileInputs = useRef({});
  const ruleFileInputs = useRef({});

  const generatedOutputPrefix =
    knoxRunResult?.import?.outputSpacePrefix || knoxRunParams?.outputSpacePrefix || "rulescape_knox";

  const generatedCandidates = useMemo(
    () => buildGeneratedCandidates(runResult?.summary?.candidates ?? [], generatedOutputPrefix),
    [generatedOutputPrefix, runResult]
  );
  const uploadedCandidates = useMemo(
    () => buildUploadedCandidates(knoxBundleInputs, generatedOutputPrefix),
    [generatedOutputPrefix, knoxBundleInputs]
  );
  const sourceCandidates = knoxBundleSource === "uploaded" ? uploadedCandidates : generatedCandidates;

  const hasGeneratedBundle = Boolean(runResult);
  const filePreviews = runResult?.filePreviews ?? {};
  const generatedFiles = runResult
    ? [
        {
          key: "designs",
          name: "designs.csv",
          path: runResult.files.designs,
          downloadUrl: runResult.downloads?.designs || "",
          preview: filePreviews.designs,
        },
        {
          key: "partLibrary",
          name: "part_library.csv",
          path: runResult.files.partLibrary,
          downloadUrl: runResult.downloads?.partLibrary || "",
          preview: filePreviews.partLibrary,
        },
        {
          key: "weight",
          name: "weight.csv",
          path: runResult.files.weight,
          downloadUrl: runResult.downloads?.weight || "",
          preview: filePreviews.weight,
        },
        {
          key: "summary",
          name: "adapter_result.json",
          path: runResult.files.summary,
          downloadUrl: runResult.downloads?.summary || "",
          preview: filePreviews.summary,
        },
      ]
    : [];

  const evaluation = knoxRunResult?.evaluation || null;
  const candidateCards = useMemo(
    () => buildCandidateCards(evaluation, sourceCandidates),
    [evaluation, sourceCandidates]
  );
  const ruleSummary = useMemo(() => buildRuleMetricSummary(evaluation), [evaluation]);
  const rawKnoxPayload = useMemo(
    () => evaluation?.raw || knoxRunResult || null,
    [evaluation, knoxRunResult]
  );
  const rawKnoxOutputText = useMemo(
    () => (rawKnoxPayload ? JSON.stringify(rawKnoxPayload, null, 2) : ""),
    [rawKnoxPayload]
  );
  const rawKnoxOutputLabel = evaluation?.executed
    ? "Raw Knox /rule/evaluate response"
    : "Current Knox pipeline payload";
  const availableDesignIds = useMemo(
    () => candidateCards.map((candidate) => candidate.designId),
    [candidateCards]
  );

  useEffect(() => {
    setSelectedDesignId((current) =>
      current && availableDesignIds.includes(current) ? current : availableDesignIds[0] || null
    );
  }, [availableDesignIds]);

  useEffect(() => {
    setLatestOutputTab("summary");
  }, [knoxRunResult?.requestId, knoxRunResult?.action]);

  const selectedCandidate =
    sourceCandidates.find((candidate) => candidate.designId === selectedDesignId) || sourceCandidates[0] || null;
  const selectedModules = useMemo(() => buildDesignModules(selectedCandidate), [selectedCandidate]);
  const selectedRealDesign =
    evaluation?.designs?.find((design) => design.designId === selectedDesignId) || evaluation?.designs?.[0];

  const toggleGeneratedOpen = (name) => {
    setOpenGeneratedName((current) => (current === name ? null : name));
  };

  const toggleBundleOpen = (name) => {
    setOpenBundleName((current) => (current === name ? null : name));
  };

  const toggleRuleOpen = (name) => {
    setOpenRuleName((current) => (current === name ? null : name));
  };

  const triggerBundleFilePicker = (id) => {
    bundleFileInputs.current[id]?.click();
  };

  const triggerRuleFilePicker = (id) => {
    ruleFileInputs.current[id]?.click();
  };

  const handleBundleFileImport = (fileSpec, event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!matchesAcceptedExtension(file.name, fileSpec.accept)) {
      window.alert(`Please upload a ${fileSpec.accept} file for ${fileSpec.name}.`);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onKnoxBundleInputChange(fileSpec.id, String(reader.result ?? ""));
      onKnoxBundleNameChange(fileSpec.id, file.name);
      setOpenBundleName(fileSpec.name);
    };
    reader.readAsText(file);
  };

  const handleRuleFileImport = (fileSpec, event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!matchesAcceptedExtension(file.name, fileSpec.accept)) {
      window.alert(`Please upload a ${fileSpec.accept} file for ${fileSpec.title}.`);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const importedText = String(reader.result ?? "");
      const normalizedText =
        fileSpec.id === "goldbar" && file.name.toLowerCase().endsWith(".csv")
          ? extractGoldbarExpression(importedText) || importedText
          : importedText;

      onKnoxRuleInputChange(fileSpec.id, normalizedText);
      onKnoxRuleNameChange(fileSpec.id, file.name);
      setOpenRuleName(fileSpec.title);
    };
    reader.readAsText(file);
  };

  return (
    <div className="stage-grid">
      <section className="card full-span">
        <div className="card-header-row">
          <div>
            <h3>Knox bundle</h3>
            <p className="muted">Use the bundle generated from Cello, or upload your own.</p>
          </div>
          <div className="source-toggle" role="tablist" aria-label="Knox bundle source">
            <button
              type="button"
              className={`source-toggle-button${knoxBundleSource === "generated" ? " active" : ""}`}
              onClick={() => onKnoxBundleSourceChange("generated")}
            >
              Generated
            </button>
            <button
              type="button"
              className={`source-toggle-button${knoxBundleSource === "uploaded" ? " active" : ""}`}
              onClick={() => onKnoxBundleSourceChange("uploaded")}
            >
              Uploaded
            </button>
          </div>
        </div>

        {knoxBundleSource === "generated" ? (
          hasGeneratedBundle ? (
            <div className="input-list accordion-list">
              {generatedFiles.map((file) => (
                <article
                  key={file.name}
                  className={`input-card${openGeneratedName === file.name ? " open" : ""}`}
                >
                  <div className="input-header">
                    <button
                      className="input-toggle"
                      type="button"
                      onClick={() => toggleGeneratedOpen(file.name)}
                      aria-expanded={openGeneratedName === file.name}
                    >
                      <span
                        className={`input-chevron${openGeneratedName === file.name ? " open" : ""}`}
                      >
                        <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                      </span>
                      <div>
                        <strong>{file.name}</strong>
                        <p className="muted">{generatedFileNotes[file.key]}</p>
                      </div>
                    </button>

                    <div className="input-header-meta">
                      <span className="chip ready">ready</span>
                      {file.downloadUrl ? (
                        <a
                          className="ghost-button upload-button"
                          href={file.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Download ${file.name}`}
                          title={`Download ${file.name}`}
                        >
                          <i className="fa-solid fa-download" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="input-body" aria-hidden={openGeneratedName !== file.name}>
                    <div className="input-panel">
                      <code className="file-path mono">{file.path}</code>
                      {file.preview ? (
                        <>
                          <p className="muted preview-meta">
                            Previewing {Math.min(file.preview.lineCount, 20)} of {file.preview.lineCount} lines
                            {file.preview.truncated ? " (truncated)" : ""}
                          </p>
                          <textarea className="code-box preview-box" value={file.preview.text} readOnly />
                        </>
                      ) : (
                        <p className="muted preview-meta">
                          Preview unavailable in this response. Rerun Cello to refresh the generated file previews.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted empty-state">
              No generated Knox bundle yet. Run Cello first, or switch this step to Uploaded.
            </p>
          )
        ) : (
          <div className="input-list accordion-list">
            {knoxBundleSpecs.map((fileSpec) => {
              const isOpen = openBundleName === fileSpec.name;
              const importedName = knoxBundleNames[fileSpec.id];
              const status = importedName ? "ready" : fileSpec.optional ? "optional" : "pending";

              return (
                <article key={fileSpec.id} className={`input-card${isOpen ? " open" : ""}`}>
                  <div className="input-header">
                    <button
                      className="input-toggle"
                      type="button"
                      onClick={() => toggleBundleOpen(fileSpec.name)}
                      aria-expanded={isOpen}
                    >
                      <span className={`input-chevron${isOpen ? " open" : ""}`}>
                        <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                      </span>
                      <div>
                        <strong>{fileSpec.name}</strong>
                        <p className="muted">{fileSpec.note}</p>
                      </div>
                    </button>

                    <div className="input-header-meta">
                      <span className={`chip ${status === "optional" ? "pending" : status}`}>{status}</span>
                      {importedName ? <span className="chip pending mono">{importedName}</span> : null}

                      <input
                        ref={(element) => {
                          bundleFileInputs.current[fileSpec.id] = element;
                        }}
                        className="hidden-file-input"
                        type="file"
                        accept={fileSpec.accept}
                        onChange={(event) => handleBundleFileImport(fileSpec, event)}
                      />

                      <button
                        className="ghost-button upload-button"
                        type="button"
                        onClick={() => triggerBundleFilePicker(fileSpec.id)}
                        aria-label={`Import ${fileSpec.name}`}
                      >
                        <i className="fa-solid fa-upload" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="input-body" aria-hidden={!isOpen}>
                    <div className="input-panel">
                      <textarea
                        className="code-box"
                        value={knoxBundleInputs[fileSpec.id]}
                        onChange={(event) => onKnoxBundleInputChange(fileSpec.id, event.target.value)}
                        placeholder={`Import or paste ${fileSpec.name}`}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="card full-span">
        <h3>Rule inputs</h3>
        <p className="muted">
          Goldbar and categories stay separate from the Knox bundle. Use them when you want Knox
          to evaluate the imported designs against a rule set.
        </p>

        <div className="input-list accordion-list">
          {knoxRuleSpecs.map((fileSpec) => {
            const isOpen = openRuleName === fileSpec.title;
            const importedName = knoxRuleNames[fileSpec.id];
            const hasContent = Boolean(String(knoxRuleInputs[fileSpec.id] || "").trim());

            return (
              <article key={fileSpec.id} className={`input-card${isOpen ? " open" : ""}`}>
                <div className="input-header">
                  <button
                    className="input-toggle"
                    type="button"
                    onClick={() => toggleRuleOpen(fileSpec.title)}
                    aria-expanded={isOpen}
                  >
                    <span className={`input-chevron${isOpen ? " open" : ""}`}>
                      <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{fileSpec.title}</strong>
                      <p className="muted">{fileSpec.note}</p>
                    </div>
                  </button>

                  <div className="input-header-meta">
                    <span className={`chip ${hasContent ? "ready" : "pending"}`}>
                      {hasContent ? "ready" : "pending"}
                    </span>
                    {importedName ? <span className="chip pending mono">{importedName}</span> : null}

                    <input
                      ref={(element) => {
                        ruleFileInputs.current[fileSpec.id] = element;
                      }}
                      className="hidden-file-input"
                      type="file"
                      accept={fileSpec.accept}
                      onChange={(event) => handleRuleFileImport(fileSpec, event)}
                    />

                    <button
                      className="ghost-button upload-button"
                      type="button"
                      onClick={() => triggerRuleFilePicker(fileSpec.id)}
                      aria-label={`Import ${fileSpec.title}`}
                    >
                      <i className="fa-solid fa-upload" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="input-body" aria-hidden={!isOpen}>
                  <div className="input-panel">
                    <textarea
                      className="code-box"
                      value={knoxRuleInputs[fileSpec.id]}
                      onChange={(event) => onKnoxRuleInputChange(fileSpec.id, event.target.value)}
                      placeholder={fileSpec.placeholder}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {knoxRunResult ? (
        <section className="card full-span">
          <div className="card-header-row">
            <div>
              <h3>Latest Knox output</h3>
              <p className="muted compact">
                {evaluation?.executed
                  ? "Knox imported the bundle and evaluated the active Goldbar rules."
                  : knoxRunResult?.action === "import"
                    ? "Knox imported the bundle. Rule evaluation has not been run yet."
                    : "Knox imported the bundle, but no Knox rule evaluation output is available yet."}
              </p>
            </div>
            <div className="card-header-actions">
              <div className="source-toggle" role="tablist" aria-label="Knox output view">
                <button
                  type="button"
                  className={`source-toggle-button${latestOutputTab === "summary" ? " active" : ""}`}
                  onClick={() => setLatestOutputTab("summary")}
                >
                  Summary
                </button>
                <button
                  type="button"
                  className={`source-toggle-button${latestOutputTab === "raw" ? " active" : ""}`}
                  onClick={() => setLatestOutputTab("raw")}
                >
                  Raw JSON
                </button>
              </div>
              <span className="chip ready">{evaluation?.executed ? "evaluation ready" : "import ready"}</span>
            </div>
          </div>

          {latestOutputTab === "summary" ? (
            <>
              <div className="mini-grid result-mini-grid">
                <div className="mini-card">
                  <span className="mini-card-label">Design group</span>
                  <strong className="mini-card-value">{knoxRunResult.import.designGroupId}</strong>
                </div>
                <div className="mini-card">
                  <span className="mini-card-label">Imported designs</span>
                  <strong className="mini-card-value">{knoxRunResult.import.designCount}</strong>
                </div>
                <div className="mini-card">
                  <span className="mini-card-label">Evaluated rules</span>
                  <strong className="mini-card-value">{ruleSummary.evaluatedRules}</strong>
                </div>
                <div className="mini-card">
                  <span className="mini-card-label">Top impact</span>
                  <strong className="mini-card-value">{ruleSummary.topImpact}</strong>
                </div>
              </div>

              {evaluation?.executed ? (
                <p className="muted compact">
                  Evaluation name: <span className="mono">{evaluation.evaluationName}</span>
                </p>
              ) : (
                <p className="muted compact">{evaluation?.reason}</p>
              )}
            </>
          ) : (
            <>
              <p className="muted preview-meta">{rawKnoxOutputLabel}</p>
              <RawJsonViewer value={rawKnoxOutputText} />
            </>
          )}
        </section>
      ) : null}

      <section className="card full-span">
        <div className="card-header-row">
          <div>
            <p className="muted compact">
              {evaluation?.executed
                ? "Review the imported designs ranked against the active Knox rule evaluation."
                : "Review the imported bundle before running Knox rule evaluation."}
            </p>
          </div>
        </div>

        {candidateCards.length > 0 ? (
          <div className="knox-selector-block">
            <label className="knox-selector-label" htmlFor="knox-design-selector">
              Design selection
            </label>
            <select
              id="knox-design-selector"
              className="config-control knox-design-select"
              value={selectedDesignId || ""}
              onChange={(event) => setSelectedDesignId(event.target.value)}
            >
              {candidateCards.map((candidate, index) => (
                <option key={candidate.key} value={candidate.designId}>
                  {`${index + 1}. ${candidate.title} • ${formatCandidateScore(candidate.score)}`}
                </option>
              ))}
            </select>

            {selectedCandidate ? (
              <div className="knox-selector-summary">
                <div className="knox-selected-design">
                  <div className="knox-selected-design-meta">
                    <div className="knox-inline-stat knox-inline-stat-design">
                      <span className="mini-card-label">Design</span>
                      <strong
                        className="knox-inline-value"
                        title={selectedCandidate.selected_gate}
                      >
                        {selectedCandidate.selected_gate}
                      </strong>
                    </div>
                    <div className="knox-inline-stat">
                      <span className="mini-card-label">Score</span>
                      <strong className="knox-inline-value">
                        {Number.isFinite(Number(selectedRealDesign?.score ?? selectedCandidate.score))
                          ? Number(selectedRealDesign?.score ?? selectedCandidate.score).toFixed(4)
                          : "—"}
                      </strong>
                    </div>
                    <div className="knox-inline-stat">
                      <span className="mini-card-label">Parts</span>
                      <strong className="knox-inline-value">{selectedCandidate.selected_parts.length}</strong>
                    </div>
                  </div>

                  {selectedModules.length > 0 ? (
                    <div className="design-track-shell">
                      <div className="design-track">
                        {selectedModules.map((module, index) => (
                          <div className="design-module-wrap" key={module.id}>
                            <div
                              className="design-module"
                              style={{
                                background: module.palette.bg,
                                borderColor: module.palette.border,
                              }}
                            >
                              <span className="design-module-step">
                                {String(module.step).padStart(2, "0")}
                              </span>
                              <strong className="design-module-part">{module.part}</strong>
                              <span className="design-module-role" style={{ color: module.palette.text }}>
                                {humanizeRole(module.role, index)}
                              </span>
                            </div>
                            {index < selectedModules.length - 1 ? (
                              <span className="design-module-link" aria-hidden="true">
                                <i className="fa-solid fa-angle-right" />
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted empty-state">
            No design bundle is ready yet. Generate one from Cello or upload a Knox CSV bundle.
          </p>
        )}
      </section>

    </div>
  );
}

function RawJsonViewer({ value }) {
  const [isFocused, setIsFocused] = useState(false);

  const handleMount = (editor) => {
    editor.onDidFocusEditorWidget(() => setIsFocused(true));
    editor.onDidBlurEditorWidget(() => setIsFocused(false));
  };

  return (
    <div className={`editor-shell raw-json-box${isFocused ? " focused" : ""}`}>
      <Editor
        height="320px"
        language="json"
        onMount={handleMount}
        options={rawJsonEditorOptions}
        path="knox-raw-output.json"
        theme="vs-dark"
        value={value || "{}"}
      />
    </div>
  );
}
