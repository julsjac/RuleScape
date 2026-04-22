import { useState } from "react";

const modelChoices = [
  {
    id: "xgb",
    title: "Explainable Boosting Machine",
    badge: "Recommended",
    note: "Best fit for interpretable rule features.",
  },
  {
    id: "rf",
    title: "Random Forest",
    badge: "Baseline",
    note: "Strong baseline for tabular feature matrices.",
  },
  {
    id: "dt_bin",
    title: "Decision Tree",
    badge: "Binary Classification",
    note: "Classify as good or bad designs.",
  },
  {
    id: "dt_reg",
    title: "Decision Tree",
    badge: "Regression",
    note: "Predict performance score of designs.",
  },
];

const modelTitleById = Object.fromEntries(modelChoices.map((choice) => [choice.id, choice.title]));

function normalizeFeatureRows(topRules = []) {
  if (Array.isArray(topRules)) {
    return topRules
      .map((row, index) => {
        if (row && typeof row === "object") {
          return {
            id: `${row.feature || row.name || index}`,
            feature: String(row.feature || row.name || `feature_${index + 1}`),
            score: Number(row.importance ?? row.score ?? row.weight ?? row.value ?? 0),
          };
        }

        return {
          id: `feature_${index + 1}`,
          feature: String(row),
          score: 0,
        };
      })
      .filter((row) => row.feature);
  }

  if (topRules && typeof topRules === "object") {
    return Object.entries(topRules).map(([feature, score]) => ({
      id: feature,
      feature,
      score: Number(score ?? 0),
    }));
  }

  return [];
}

function formatMetric(result = {}) {
  const accuracy = Number(result.accuracy);
  if (Number.isFinite(accuracy)) {
    return {
      label: "Accuracy",
      value: `${(accuracy * 100).toFixed(1)}%`,
    };
  }

  const r2 = Number(result.r2);
  if (Number.isFinite(r2)) {
    return {
      label: "R²",
      value: r2.toFixed(4),
    };
  }

  return {
    label: "Status",
    value: "Completed",
  };
}

function formatFeatureScore(score) {
  const numericScore = Number(score);
  return Number.isFinite(numericScore) ? numericScore.toFixed(4) : "—";
}

function describeFeatureSignal(featureRows) {
  if (featureRows.length === 0) {
    return "No feature scores were returned for this model in the current run.";
  }

  const strongestFeature = featureRows[0];
  const strongestScore = Number(strongestFeature.score);
  if (!Number.isFinite(strongestScore) || strongestScore === 0) {
    return "The returned feature scores are flat, so this run did not surface a strong differentiating rule.";
  }

  return `Highest-scoring feature in this run: ${strongestFeature.feature}.`;
}

export function MlStage({ mlParams, onMlParamChange, onRunML, mlRunState, knoxRunState }) {
  const [selectedModels, setSelectedModels] = useState(new Set());

  if (!mlParams || !mlRunState) return null;

  const evaluationName = knoxRunState?.result?.evaluation?.evaluationName || "";
  const designGroupId = knoxRunState?.result?.import?.designGroupId || "";
  const hasKnoxContext = Boolean(evaluationName || designGroupId);
  const isRunning = mlRunState.phase === "running" || mlRunState.phase === "initializing";
  const resultEntries = Object.entries(mlRunState.result?.results || {});
  const featurePoolCount = Array.isArray(mlRunState.result?.features)
    ? mlRunState.result.features.length
    : 0;

  function toggleModel(id) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRun() {
    onRunML({
      mlParams,
      models: Array.from(selectedModels),
    });
  }

  return (
    <div className="stage-grid">
      {hasKnoxContext ? (
        <section className="card full-span">
          <h3>Knox context</h3>
          <p className="muted">
            The ML run is using the Knox evaluation outputs as the feature source for training.
          </p>
          <div className="mini-grid result-mini-grid">
            {evaluationName ? (
              <div className="mini-card">
                <span className="mini-card-label">Evaluation name</span>
                <strong className="mini-card-value mono">{evaluationName}</strong>
              </div>
            ) : null}
            {designGroupId ? (
              <div className="mini-card">
                <span className="mini-card-label">Design group</span>
                <strong className="mini-card-value mono">{designGroupId}</strong>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="card">
        <h3>Training parameters</h3>
        <div className="config-list">
          <div className="config-row">
            <label className="config-label" htmlFor="ml-train-split">
              Train / test split
            </label>
            <input
              id="ml-train-split"
              className="config-control"
              type="number"
              min="10"
              max="90"
              step="1"
              value={mlParams.trainSplit ?? 70}
              onChange={(event) => onMlParamChange("trainSplit", Number(event.target.value))}
            />
          </div>
          <div className="config-row">
            <label className="config-label" htmlFor="ml-top-n">
              Top N features
            </label>
            <input
              id="ml-top-n"
              className="config-control"
              type="number"
              min="1"
              max="100"
              step="1"
              value={mlParams.topNFeatures ?? 10}
              onChange={(event) => onMlParamChange("topNFeatures", Number(event.target.value))}
            />
          </div>
          <div className="config-row">
            <label className="config-label" htmlFor="ml-threshold">
              Threshold
            </label>
            <input
              id="ml-threshold"
              className="config-control"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={mlParams.threshold ?? 0.5}
              onChange={(event) => onMlParamChange("threshold", Number(event.target.value))}
            />
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Model choice</h3>
        <div className="choice-list">
          {modelChoices.map((choice) => (
            <ChoiceCard
              key={choice.id}
              title={choice.title}
              badge={choice.badge}
              note={choice.note}
              active={selectedModels.has(choice.id)}
              onClick={() => toggleModel(choice.id)}
            />
          ))}
        </div>
      </section>

      <section className="card full-span">
        <div className="card-header-row">
          <div>
            <h3>Run ML</h3>
            <p className="muted compact">
              {selectedModels.size === 0
                ? "Select at least one model before running ML."
                : `${selectedModels.size} model${selectedModels.size > 1 ? "s" : ""} selected.`}
            </p>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={isRunning || selectedModels.size === 0}
            onClick={handleRun}
          >
            {isRunning ? "Running ML..." : "Run ML"}
          </button>
        </div>

        {mlRunState.phase === "completed" && mlRunState.result ? (
          resultEntries.length > 0 ? (
            <div className="ml-results-stack">
              {resultEntries.map(([modelId, result]) => {
                const metric = formatMetric(result);
                const featureRows = normalizeFeatureRows(result.top_n_rules);
                const strongestFeature = featureRows[0] || null;

                return (
                  <article key={modelId} className="ml-result-card">
                    <div className="card-header-row">
                      <div>
                        <strong className="ml-result-title">
                          {modelTitleById[modelId] || modelId}
                        </strong>
                        <p className="muted compact">{describeFeatureSignal(featureRows)}</p>
                      </div>
                      <span className="badge">{`${metric.label}: ${metric.value}`}</span>
                    </div>

                    <div className="mini-grid result-mini-grid">
                      <div className="mini-card">
                        <span className="mini-card-label">Top feature</span>
                        <strong className="mini-card-value mono">
                          {strongestFeature?.feature || "—"}
                        </strong>
                      </div>
                      <div className="mini-card">
                        <span className="mini-card-label">Feature score</span>
                        <strong className="mini-card-value mono">
                          {strongestFeature ? formatFeatureScore(strongestFeature.score) : "—"}
                        </strong>
                      </div>
                      <div className="mini-card">
                        <span className="mini-card-label">Feature rows</span>
                        <strong className="mini-card-value">{featureRows.length}</strong>
                      </div>
                      {featurePoolCount ? (
                        <div className="mini-card">
                          <span className="mini-card-label">Feature pool</span>
                          <strong className="mini-card-value">{featurePoolCount}</strong>
                        </div>
                      ) : null}
                    </div>

                    {featureRows.length > 0 ? (
                      <div className="table-shell report-subtable">
                        <table className="results-table ml-feature-table">
                          <thead>
                            <tr>
                              <th>Feature name</th>
                              <th>Feature score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {featureRows.map((row) => (
                              <tr key={`${modelId}-${row.id}`}>
                                <td className="mono">{row.feature}</td>
                                <td className="mono">{formatFeatureScore(row.score)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="muted empty-state">
                        No feature scores were returned for this model.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted empty-state">ML returned no model summaries for this run.</p>
          )
        ) : null}

        {mlRunState.phase === "error" && mlRunState.error ? (
          <p className="error-text empty-state">{mlRunState.error}</p>
        ) : null}
      </section>
    </div>
  );
}

function ChoiceCard({ title, badge, note, active = false, onClick }) {
  return (
    <div className={`choice-card ${active ? "active" : ""}`} onClick={onClick} role="button">
      <span className="badge">{badge}</span>
      <strong>{title}</strong>
      <p className="muted">{note}</p>
    </div>
  );
}
