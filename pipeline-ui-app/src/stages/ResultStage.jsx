import { useEffect, useMemo, useState } from "react";

import { celloInputBundle } from "./CelloStage";
import { knoxBundleSpecs, knoxRuleSpecs } from "./KnoxStage";

const PIPELINE_RESULT_URL =
  import.meta.env.VITE_PIPELINE_RESULT_URL || "http://127.0.0.1:8051/api/pipeline/result";
const ML_RESULT_URL =
  import.meta.env.VITE_ML_RESULT_URL || "http://127.0.0.1:8000/ml/result/latest";

const modelTitleById = {
  xgb: "Explainable Boosting Machine",
  rf: "Random Forest",
  dt_bin: "Decision Tree Classifier",
  dt_reg: "Decision Tree Regressor",
};

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || payload?.detail || `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function isPendingFetchMessage(message) {
  const normalized = String(message || "").trim().toLowerCase();
  return (
    normalized === "not found" ||
    normalized.includes("request failed with status 404") ||
    normalized.includes("no ml results are available yet")
  );
}

function stageStatusLabel(runState) {
  switch (runState?.phase) {
    case "completed":
      return "Completed";
    case "running":
      return "Running";
    case "initializing":
      return "Initializing";
    case "error":
      return "Error";
    default:
      return "Not run";
  }
}

function describeInputSource(importedName, content) {
  if (importedName) {
    return importedName;
  }

  if (String(content || "").trim()) {
    return "written in app";
  }

  return "missing";
}

function formatNumber(value, digits = 4) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(digits) : "—";
}

function formatMetric(result = {}) {
  const accuracy = Number(result.accuracy);
  if (Number.isFinite(accuracy)) {
    return `Accuracy ${(accuracy * 100).toFixed(1)}%`;
  }

  const r2 = Number(result.r2);
  if (Number.isFinite(r2)) {
    return `R² ${r2.toFixed(4)}`;
  }

  return "Completed";
}

function normalizeFeatureRows(topRules = []) {
  if (Array.isArray(topRules)) {
    return topRules
      .map((row, index) => ({
        feature: String(row?.feature || row?.name || `feature_${index + 1}`),
        score: Number(row?.importance ?? row?.score ?? row?.weight ?? row?.value ?? 0),
      }))
      .filter((row) => row.feature);
  }

  if (topRules && typeof topRules === "object") {
    return Object.entries(topRules).map(([feature, score]) => ({
      feature,
      score: Number(score ?? 0),
    }));
  }

  return [];
}

function buildTopMlRows(mlResult) {
  return Object.entries(mlResult?.results || {}).map(([modelId, result]) => {
    const featureRows = normalizeFeatureRows(result.top_n_rules);
    return {
      modelId,
      modelTitle: modelTitleById[modelId] || modelId,
      metric: formatMetric(result),
      topFeature: featureRows[0]?.feature || "—",
      topScore: featureRows[0]?.score ?? null,
      featureRows,
    };
  });
}

function sourceLabel(mode) {
  if (mode === "fetched") {
    return "Fetched";
  }

  return "Pending";
}

export function ReportStage({
  celloInputs,
  importedNames,
  celloRunParams,
  celloRunState,
  celloRunResult,
  knoxBundleSource,
  knoxBundleInputs,
  knoxBundleNames,
  knoxRuleInputs,
  knoxRuleNames,
  knoxRunParams,
  knoxRunState,
  mlParams,
  mlRunState,
}) {
  const [reportFetchState, setReportFetchState] = useState({
    loading: false,
    error: "",
    cello: null,
    knox: null,
    ml: null,
    celloMode: "state",
    knoxMode: "state",
    mlMode: "state",
  });

  const celloRequestId = celloRunResult?.requestId || "";
  const knoxRequestId = knoxRunState?.result?.requestId || "";
  const shouldFetchMl = Boolean(mlRunState?.result?.results);

  useEffect(() => {
    let cancelled = false;

    async function loadReportData() {
      if (!celloRequestId && !knoxRequestId && !shouldFetchMl) {
        setReportFetchState({
          loading: false,
          error: "",
          cello: null,
          knox: null,
          ml: null,
          celloMode: "state",
          knoxMode: "state",
          mlMode: "state",
        });
        return;
      }

      setReportFetchState((current) => ({ ...current, loading: true, error: "" }));

      const [celloResult, knoxResult, mlResult] = await Promise.allSettled([
        celloRequestId
          ? fetchJson(
              `${PIPELINE_RESULT_URL}?requestId=${encodeURIComponent(celloRequestId)}&service=cello`
            )
          : Promise.resolve(null),
        knoxRequestId
          ? fetchJson(
              `${PIPELINE_RESULT_URL}?requestId=${encodeURIComponent(knoxRequestId)}&service=knox`
            )
          : Promise.resolve(null),
        shouldFetchMl ? fetchJson(ML_RESULT_URL) : Promise.resolve(null),
      ]);

      if (cancelled) {
        return;
      }

      const errors = [];
      if (celloRequestId && celloResult.status === "rejected") {
        const message = celloResult.reason?.message || celloResult.reason;
        if (!isPendingFetchMessage(message)) {
          errors.push(`Cello fetch: ${message}`);
        }
      }
      if (knoxRequestId && knoxResult.status === "rejected") {
        const message = knoxResult.reason?.message || knoxResult.reason;
        if (!isPendingFetchMessage(message)) {
          errors.push(`Knox fetch: ${message}`);
        }
      }
      if (shouldFetchMl && mlResult.status === "rejected") {
        const message = mlResult.reason?.message || mlResult.reason;
        if (!isPendingFetchMessage(message)) {
          errors.push(`ML fetch: ${message}`);
        }
      }

      setReportFetchState({
        loading: false,
        error: errors.join(" | "),
        cello: celloResult.status === "fulfilled" ? celloResult.value : null,
        knox: knoxResult.status === "fulfilled" ? knoxResult.value : null,
        ml: mlResult.status === "fulfilled" ? mlResult.value : null,
        celloMode: celloResult.status === "fulfilled" ? "fetched" : "state",
        knoxMode: knoxResult.status === "fulfilled" ? "fetched" : "state",
        mlMode: mlResult.status === "fulfilled" ? "fetched" : "state",
      });
    }

    loadReportData();
    return () => {
      cancelled = true;
    };
  }, [celloRequestId, knoxRequestId, shouldFetchMl]);

  const effectiveCelloResult = reportFetchState.cello || celloRunResult;
  const effectiveKnoxResult = reportFetchState.knox || knoxRunState?.result;
  const effectiveMlResult = reportFetchState.ml || mlRunState?.result;

  const celloCandidates = effectiveCelloResult?.summary?.candidates ?? [];
  const bestCelloCandidate = celloCandidates[0] || null;
  const knoxEvaluation = effectiveKnoxResult?.evaluation || null;
  const knoxRules = knoxEvaluation?.rules ?? [];
  const topKnoxRule = knoxEvaluation?.topRule || knoxRules[0] || null;
  const mlRows = useMemo(() => buildTopMlRows(effectiveMlResult), [effectiveMlResult]);
  const strongestMlRow = mlRows
    .filter((row) => Number.isFinite(Number(row.topScore)))
    .sort((left, right) => Math.abs(Number(right.topScore)) - Math.abs(Number(left.topScore)))[0] || null;

  const celloInputLines = celloInputBundle.map((item) => (
    <span key={item.id}>
      <strong>{item.title}:</strong> {describeInputSource(importedNames?.[item.id], celloInputs?.[item.id])}
    </span>
  ));

  const uploadedBundleLines = knoxBundleSpecs.map((file) => (
    <span key={file.id}>
      <strong>{file.name}:</strong> {describeInputSource(knoxBundleNames?.[file.id], knoxBundleInputs?.[file.id])}
    </span>
  ));

  const ruleInputLines = knoxRuleSpecs.map((file) => (
    <span key={file.id}>
      <strong>{file.title}:</strong> {describeInputSource(knoxRuleNames?.[file.id], knoxRuleInputs?.[file.id])}
    </span>
  ));

  return (
    <div className="stage-grid">
      <section className="card compact-card">
        <h3>Current run summary</h3>
        <div className="mini-grid result-mini-grid">
          <div className="mini-card">
            <span className="mini-card-label">Cello best score</span>
            <strong className="mini-card-value">{formatNumber(effectiveCelloResult?.bestScore)}</strong>
          </div>
          <div className="mini-card">
            <span className="mini-card-label">Knox imported designs</span>
            <strong className="mini-card-value">{effectiveKnoxResult?.import?.designCount ?? "—"}</strong>
          </div>
          <div className="mini-card">
            <span className="mini-card-label">Knox evaluated rules</span>
            <strong className="mini-card-value">{knoxEvaluation?.ruleCount ?? 0}</strong>
          </div>
          <div className="mini-card">
            <span className="mini-card-label">ML models completed</span>
            <strong className="mini-card-value">{mlRows.length}</strong>
          </div>
          <div className="mini-card">
            <span className="mini-card-label">Top ML feature</span>
            <strong className="mini-card-value mono">{strongestMlRow?.topFeature || "—"}</strong>
          </div>
          <div className="mini-card">
            <span className="mini-card-label">Top feature score</span>
            <strong className="mini-card-value mono">{formatNumber(strongestMlRow?.topScore)}</strong>
          </div>
        </div>
      </section>

      <section className="card full-span">
        <h3>Pipeline handoff</h3>
        <p className="muted">
          Each row shows what a stage consumed, what it produced, and how that output moved into the next stage.
        </p>

        <div className="table-shell report-subtable">
          <table className="results-table report-flow-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Inputs used</th>
                <th>Output produced</th>
                <th>Used next by</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>1. Configure Cello</strong>
                  <div className="muted compact">{stageStatusLabel(celloRunState)}</div>
                </td>
                <td>
                  <div className="report-cell-list">
                    {celloInputLines}
                    <span><strong>Candidates:</strong> {celloRunParams?.iterations || "—"}</span>
                    <span><strong>Top N:</strong> {celloRunParams?.topN || "—"}</span>
                    <span><strong>Search:</strong> {celloRunParams?.search || "—"}</span>
                  </div>
                </td>
                <td>
                  <div className="report-cell-list">
                    <span><strong>Returned candidates:</strong> {effectiveCelloResult?.returnedTopN ?? "—"}</span>
                    <span><strong>Best score:</strong> {formatNumber(effectiveCelloResult?.bestScore)}</span>
                    <span><strong>Best gate:</strong> {bestCelloCandidate?.selected_gate || "—"}</span>
                    <span><strong>Results source:</strong> {sourceLabel(reportFetchState.celloMode)}</span>
                  </div>
                </td>
                <td>
                  <div className="report-cell-list">
                    <span>Knox imports the generated CSV bundle as the design bundle for rule evaluation.</span>
                    <span>Goldbar and categories are then applied on top of that imported bundle.</span>
                  </div>
                </td>
              </tr>

              <tr>
                <td>
                  <strong>2. Review Knox</strong>
                  <div className="muted compact">{stageStatusLabel(knoxRunState)}</div>
                </td>
                <td>
                  <div className="report-cell-list">
                    <span><strong>Bundle source:</strong> {knoxBundleSource === "uploaded" ? "uploaded CSV files" : "Cello-generated CSV bundle"}</span>
                    {knoxBundleSource === "uploaded" ? uploadedBundleLines : null}
                    {ruleInputLines}
                    <span><strong>Design group:</strong> {knoxRunParams?.designGroupId || "—"}</span>
                    <span><strong>Evaluation name:</strong> {knoxRunParams?.evaluationName || "—"}</span>
                  </div>
                </td>
                <td>
                  <div className="report-cell-list">
                    <span><strong>Imported designs:</strong> {effectiveKnoxResult?.import?.designCount ?? "—"}</span>
                    <span><strong>Evaluated rules:</strong> {knoxEvaluation?.ruleCount ?? 0}</span>
                    <span><strong>Top rule:</strong> {topKnoxRule?.id || "—"}</span>
                    <span><strong>Results source:</strong> {sourceLabel(reportFetchState.knoxMode)}</span>
                  </div>
                </td>
                <td>
                  <div className="report-cell-list">
                    <span>ML uses the Knox design-to-rule evaluation as the feature matrix.</span>
                    <span>Scores and labels from Knox become the prediction targets for the selected models.</span>
                  </div>
                </td>
              </tr>

              <tr>
                <td>
                  <strong>3. Configure ML</strong>
                  <div className="muted compact">{stageStatusLabel(mlRunState)}</div>
                </td>
                <td>
                  <div className="report-cell-list">
                    <span><strong>Feature source:</strong> {knoxEvaluation?.evaluationName || knoxRunParams?.evaluationName || "Knox evaluation"}</span>
                    <span><strong>Train split:</strong> {mlParams?.trainSplit ?? "—"}%</span>
                    <span><strong>Top N features:</strong> {mlParams?.topNFeatures ?? "—"}</span>
                    <span><strong>Threshold:</strong> {mlParams?.threshold ?? "—"}</span>
                    <span><strong>Models:</strong> {mlRows.length > 0 ? mlRows.map((row) => row.modelTitle).join(", ") : "not run"}</span>
                  </div>
                </td>
                <td>
                  <div className="report-cell-list">
                    <span><strong>Models completed:</strong> {mlRows.length}</span>
                    <span><strong>Strongest feature:</strong> {strongestMlRow?.topFeature || "—"}</span>
                    <span><strong>Feature score:</strong> {formatNumber(strongestMlRow?.topScore)}</span>
                    <span><strong>Results source:</strong> {sourceLabel(reportFetchState.mlMode)}</span>
                  </div>
                </td>
                <td>
                  <div className="report-cell-list">
                    <span>Step 4 fetches the stored stage outputs and consolidates them into one review view.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card full-span">
        <h3>Cello candidate ranking</h3>
        {celloCandidates.length > 0 ? (
          <div className="table-shell report-subtable">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Gate</th>
                  <th>Score</th>
                  <th>Parts</th>
                </tr>
              </thead>
              <tbody>
                {celloCandidates.map((candidate) => (
                  <tr key={`${candidate.rank}-${candidate.selected_gate}`}>
                    <td>{candidate.rank}</td>
                    <td className="mono">{candidate.selected_gate}</td>
                    <td className="mono">{formatNumber(candidate.score)}</td>
                    <td>{candidate.selected_parts?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted empty-state">No stored Cello candidate ranking is available yet.</p>
        )}
      </section>

      <section className="card full-span">
        <h3>Knox bundle and rule evaluation</h3>
        <div className="mini-grid result-mini-grid">
          <div className="mini-card">
            <span className="mini-card-label">Design group</span>
            <strong className="mini-card-value mono">{effectiveKnoxResult?.import?.designGroupId || "—"}</strong>
          </div>
          <div className="mini-card">
            <span className="mini-card-label">Imported designs</span>
            <strong className="mini-card-value">{effectiveKnoxResult?.import?.designCount ?? "—"}</strong>
          </div>
          <div className="mini-card">
            <span className="mini-card-label">Evaluated rules</span>
            <strong className="mini-card-value">{knoxEvaluation?.ruleCount ?? 0}</strong>
          </div>
          <div className="mini-card">
            <span className="mini-card-label">Top rule impact</span>
            <strong className="mini-card-value">{formatNumber(topKnoxRule?.impact)}</strong>
          </div>
        </div>

        {knoxRules.length > 0 ? (
          <div className="table-shell report-subtable">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Impact</th>
                  <th>Poor Designs Eliminated</th>
                  <th>Total Designs Eliminated</th>
                </tr>
              </thead>
              <tbody>
                {knoxRules.slice(0, 8).map((rule) => (
                  <tr key={rule.id}>
                    <td className="mono">{rule.id}</td>
                    <td className="mono">{formatNumber(rule.impact)}</td>
                    <td>{rule.poorDesignsElim ?? "—"}</td>
                    <td>{rule.totalDesignsElim ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted empty-state">No stored Knox rule evaluation is available yet.</p>
        )}
      </section>

      <section className="card full-span">
        <h3>ML metrics and feature scores</h3>
        {mlRows.length > 0 ? (
          <div className="table-shell report-subtable">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Metric</th>
                  <th>Top feature</th>
                  <th>Feature score</th>
                </tr>
              </thead>
              <tbody>
                {mlRows.map((row) => (
                  <tr key={row.modelId}>
                    <td>{row.modelTitle}</td>
                    <td>{row.metric}</td>
                    <td className="mono">{row.topFeature}</td>
                    <td className="mono">{formatNumber(row.topScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted empty-state">No stored ML results are available yet.</p>
        )}
      </section>
    </div>
  );
}
