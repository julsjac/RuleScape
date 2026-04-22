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
  { bg: "rgba(134, 242, 255, 0.16)", border: "rgba(134, 242, 255, 0.28)", text: "#86f2ff" },
  { bg: "rgba(141, 245, 214, 0.14)", border: "rgba(141, 245, 214, 0.26)", text: "#8df5d6" },
  { bg: "rgba(255, 211, 126, 0.14)", border: "rgba(255, 211, 126, 0.26)", text: "#ffd37e" },
  { bg: "rgba(210, 182, 255, 0.14)", border: "rgba(210, 182, 255, 0.26)", text: "#d2b6ff" },
  { bg: "rgba(255, 159, 159, 0.14)", border: "rgba(255, 159, 159, 0.26)", text: "#ffb199" },
];

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

function buildPreviewRules(candidates) {
  if (!candidates.length) {
    return [];
  }

  const scores = candidates
    .map((candidate) => Number(candidate.score))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const medianScore = scores[Math.floor(scores.length / 2)] ?? 0;
  const fullPartCount = Math.max(
    ...candidates.map((candidate) => candidate.selected_parts?.length ?? 0),
    0
  );

  return [
    {
      id: "input-mapped",
      label: "Input mapped",
      evaluate: (candidate) => (candidate.input_assignments?.length ?? 0) > 0,
    },
    {
      id: "output-mapped",
      label: "Output mapped",
      evaluate: (candidate) => (candidate.output_assignments?.length ?? 0) > 0,
    },
    {
      id: "full-chain",
      label: `${fullPartCount} parts`,
      evaluate: (candidate) => (candidate.selected_parts?.length ?? 0) === fullPartCount,
    },
    {
      id: "above-median",
      label: "Above median",
      evaluate: (candidate) => {
        const score = Number(candidate.score);
        return Number.isFinite(score) && score >= medianScore;
      },
    },
    {
      id: "top-rank",
      label: "Top rank",
      evaluate: (candidate) => Number(candidate.rank) === 1,
    },
  ];
}

function buildPreviewMatrixRows(candidates, rules) {
  return candidates.map((candidate) => ({
    designId: candidate.designId,
    title: candidate.selected_gate,
    score: candidate.score,
    results: rules.map((rule) => ({
      ruleId: rule.id,
      pass: rule.evaluate(candidate),
      rawStatus: rule.evaluate(candidate) ? 0 : 1,
    })),
  }));
}

function buildRealMatrixRows(evaluation) {
  return (evaluation?.designs ?? []).map((design) => ({
    designId: design.designId,
    title: design.designId,
    score: design.score,
    results: (evaluation?.rules ?? []).map((rule) => {
      const rawStatus = design.ruleStatuses?.[rule.id];
      return {
        ruleId: rule.id,
        pass: rawStatus === 0,
        rawStatus,
      };
    }),
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

function selectRuleResults(selectedDesignId, evaluation, previewRules, previewCandidates) {
  if (evaluation?.executed) {
    const design = evaluation.designs.find((item) => item.designId === selectedDesignId);
    if (!design) {
      return { kept: [], eliminated: [] };
    }

    const kept = [];
    const eliminated = [];
    evaluation.rules.forEach((rule) => {
      const status = design.ruleStatuses?.[rule.id];
      if (status === 0) {
        kept.push(rule);
      } else if (status === 1) {
        eliminated.push(rule);
      }
    });
    return { kept, eliminated };
  }

  const candidate = previewCandidates.find((item) => item.designId === selectedDesignId);
  if (!candidate) {
    return { kept: [], eliminated: [] };
  }

  const kept = [];
  const eliminated = [];
  previewRules.forEach((rule) => {
    if (rule.evaluate(candidate)) {
      kept.push(rule);
    } else {
      eliminated.push(rule);
    }
  });

  return { kept, eliminated };
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
  const candidateByDesignId = useMemo(
    () => Object.fromEntries(sourceCandidates.map((candidate) => [candidate.designId, candidate])),
    [sourceCandidates]
  );

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

  const previewRules = useMemo(() => buildPreviewRules(sourceCandidates), [sourceCandidates]);
  const previewMatrixRows = useMemo(
    () => buildPreviewMatrixRows(sourceCandidates, previewRules),
    [previewRules, sourceCandidates]
  );
  const evaluation = knoxRunResult?.evaluation || null;
  const matrixRows = useMemo(
    () => (evaluation?.executed ? buildRealMatrixRows(evaluation) : previewMatrixRows),
    [evaluation, previewMatrixRows]
  );
  const ruleColumns = evaluation?.executed ? evaluation.rules : previewRules;
  const candidateCards = useMemo(
    () => buildCandidateCards(evaluation, sourceCandidates),
    [evaluation, sourceCandidates]
  );
  const ruleSummary = useMemo(() => buildRuleMetricSummary(evaluation), [evaluation]);
  const availableDesignIds = useMemo(
    () =>
      evaluation?.executed
        ? evaluation.designs.map((design) => design.designId)
        : sourceCandidates.map((candidate) => candidate.designId),
    [evaluation, sourceCandidates]
  );

  useEffect(() => {
    setSelectedDesignId((current) =>
      current && availableDesignIds.includes(current) ? current : availableDesignIds[0] || null
    );
  }, [availableDesignIds]);

  const selectedCandidate =
    candidateByDesignId[selectedDesignId] ||
    sourceCandidates.find((candidate) => candidate.designId === selectedDesignId) ||
    sourceCandidates[0] ||
    null;
  const selectedModules = useMemo(() => buildDesignModules(selectedCandidate), [selectedCandidate]);
  const selectedRuleResults = useMemo(
    () => selectRuleResults(selectedDesignId, evaluation, previewRules, sourceCandidates),
    [evaluation, previewRules, selectedDesignId, sourceCandidates]
  );
  const selectedRealDesign =
    evaluation?.designs?.find((design) => design.designId === selectedDesignId) || evaluation?.designs?.[0];
  const maxScore = Math.max(
    ...candidateCards
      .map((candidate) => Number(candidate.score))
      .filter((value) => Number.isFinite(value)),
    1
  );

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
            <span className="chip ready">{evaluation?.executed ? "evaluation ready" : "import ready"}</span>
          </div>

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
        </section>
      ) : null}

      <section className="card full-span">
        <div className="card-header-row">
          <div>
            <h3>Selected design preview</h3>
            <p className="muted compact">
              {evaluation?.executed
                ? "This design strip stays aligned with the imported Knox bundle while the detail panel reflects real Knox rule results."
                : "This is still a structural preview of the imported design. Use Evaluate Rules to replace the preview logic with actual Knox rule results."}
            </p>
          </div>
          {selectedCandidate ? (
            <span className="chip ready mono">{selectedCandidate.designId}</span>
          ) : null}
        </div>

        {selectedCandidate ? (
          <div className="knox-visual-grid">
            <div className="knox-panel">
              <div className="knox-stat-grid">
                <div className="mini-card">
                  <span className="mini-card-label">Design</span>
                  <strong className="mini-card-value">{selectedCandidate.selected_gate}</strong>
                </div>
                <div className="mini-card">
                  <span className="mini-card-label">Score</span>
                  <strong className="mini-card-value">
                    {Number.isFinite(Number(selectedRealDesign?.score ?? selectedCandidate.score))
                      ? Number(selectedRealDesign?.score ?? selectedCandidate.score).toFixed(4)
                      : "—"}
                  </strong>
                </div>
                <div className="mini-card">
                  <span className="mini-card-label">Parts</span>
                  <strong className="mini-card-value">{selectedCandidate.selected_parts.length}</strong>
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
                          <span className="design-module-step">{String(module.step).padStart(2, "0")}</span>
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
              ) : (
                <p className="muted empty-state">
                  Part ordering is not available for the current design source.
                </p>
              )}
            </div>

            <aside className="knox-panel detail-panel">
              <div className="detail-group">
                <span className="sidebar-label">Rules keeping this design</span>
                <div className="detail-chip-list">
                  {selectedRuleResults.kept.length > 0 ? (
                    selectedRuleResults.kept.map((rule) => (
                      <span key={rule.id} className="detail-chip pass">
                        {rule.label || rule.id}
                      </span>
                    ))
                  ) : (
                    <span className="detail-chip neutral">No keeping rules recorded yet</span>
                  )}
                </div>
              </div>

              <div className="detail-group">
                <span className="sidebar-label">Rules eliminating this design</span>
                <div className="detail-chip-list">
                  {selectedRuleResults.eliminated.length > 0 ? (
                    selectedRuleResults.eliminated.map((rule) => (
                      <span key={rule.id} className="detail-chip fail">
                        {rule.label || rule.id}
                      </span>
                    ))
                  ) : (
                    <span className="detail-chip neutral">No eliminating rules for this design</span>
                  )}
                </div>
              </div>

              <div className="detail-group">
                <span className="sidebar-label">Involved parts</span>
                <div className="detail-part-list">
                  {selectedCandidate.selected_parts.length > 0 ? (
                    selectedCandidate.selected_parts.map((part) => (
                      <span key={part} className="part-pill">
                        {part}
                      </span>
                    ))
                  ) : (
                    <span className="detail-chip neutral">Part list unavailable</span>
                  )}
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <p className="muted empty-state">
            The selected design will appear here after Cello generates a bundle or you upload a
            manual Knox bundle.
          </p>
        )}
      </section>

      <section className="card full-span">
        <h3>{evaluation?.executed ? "Knox design ranking" : "Ranked bundle preview"}</h3>
        {candidateCards.length > 0 ? (
          <div className="candidate-card-grid">
            {candidateCards.map((candidate) => {
              const numericScore = Number(candidate.score);
              const width = Number.isFinite(numericScore)
                ? `${Math.max((numericScore / maxScore) * 100, 6)}%`
                : "12%";
              const isSelected = candidate.designId === selectedDesignId;

              return (
                <button
                  key={candidate.key}
                  type="button"
                  className={`candidate-card${isSelected ? " selected" : ""}`}
                  onClick={() => setSelectedDesignId(candidate.designId)}
                >
                  <div className="candidate-card-top">
                    <span className="candidate-rank mono">{candidate.designId}</span>
                    <strong>{candidate.title}</strong>
                  </div>
                  <div className="candidate-card-score-row">
                    <span className="muted mono">
                      {Number.isFinite(numericScore) ? numericScore.toFixed(4) : "no score"}
                    </span>
                    <span className="muted">{candidate.subtitle}</span>
                  </div>
                  <div className="candidate-bar-track" aria-hidden="true">
                    <span className="candidate-bar-fill" style={{ width }} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted empty-state">
            No design bundle is ready yet. Generate one from Cello or upload a Knox CSV bundle.
          </p>
        )}
      </section>

      <section className="card full-span">
        <div className="card-header-row">
          <div>
            <h3>Rule compliance matrix</h3>
            <p className="muted compact">
              {evaluation?.executed
                ? "Rows are imported Knox designs. A check means the rule keeps the design; an x means the rule eliminates it."
                : "Until Knox runs, this stays in preview mode using the current adapter outputs."}
            </p>
          </div>
        </div>

        {matrixRows.length > 0 && ruleColumns.length > 0 ? (
          <div className="table-shell">
            <table className="results-table rule-matrix-table">
              <thead>
                <tr>
                  <th>Design</th>
                  {ruleColumns.map((rule) => (
                    <th key={rule.id}>{rule.label || rule.id}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row) => {
                  const isSelected = row.designId === selectedDesignId;
                  return (
                    <tr
                      key={row.designId}
                      className={isSelected ? "matrix-row-selected" : ""}
                      onClick={() => setSelectedDesignId(row.designId)}
                    >
                      <td>
                        <div className="matrix-design-cell">
                          <strong className="mono">{row.designId}</strong>
                          <span className="muted">
                            {Number.isFinite(Number(row.score)) ? Number(row.score).toFixed(4) : row.title}
                          </span>
                        </div>
                      </td>
                      {row.results.map((result) => (
                        <td key={`${row.designId}-${result.ruleId}`}>
                          <span className={`matrix-status ${result.pass ? "pass" : "fail"}`}>
                            <i
                              className={`fa-solid ${result.pass ? "fa-check" : "fa-xmark"}`}
                              aria-hidden="true"
                            />
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted empty-state">
            Import the bundle first, then use Evaluate Rules with Goldbar plus categories to
            generate a real Knox rule matrix.
          </p>
        )}
      </section>
    </div>
  );
}
