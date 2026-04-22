import { useState } from "react";

const MODEL_LABELS = {
  xgb: "XGBoost",
  rf: "Random Forest",
  dt_bin: "Decision Tree (Binary)",
  dt_reg: "Decision Tree (Regression)",
};

// Pandas DataFrames serialize either as records [{feature, importance}]
// or as column-dict {"feature": {"0": ...}, "importance": {"0": ...}}
function normalizeTopRules(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const featureCol = raw.feature;
    const importanceCol = raw.importance;
    if (featureCol && importanceCol) {
      return Object.keys(featureCol).map((k) => ({
        feature: featureCol[k],
        importance: importanceCol[k],
      }));
    }
  }
  return [];
}

function deriveRankedDesigns(knoxRunResult) {
  const designs = knoxRunResult?.evaluation?.designs;
  if (!Array.isArray(designs) || designs.length === 0) return [];
  return [...designs]
    .sort((a, b) => Number(b.score) - Number(a.score))
    .map((d, i) => ({ ...d, rank: i + 1 }));
}

function deriveModelFeatures(mlRunState) {
  const results = mlRunState?.result?.results;
  if (!results || typeof results !== "object") return {};
  return Object.fromEntries(
    Object.entries(results)
      .filter(([, v]) => v?.top_n_rules)
      .map(([key, v]) => [key, normalizeTopRules(v.top_n_rules)])
  );
}

export function ReportStage({ mlRunState, knoxRunResult }) {
  const rankedDesigns = deriveRankedDesigns(knoxRunResult);
  const modelFeatures = deriveModelFeatures(mlRunState);
  const modelKeys = Object.keys(modelFeatures);

  const [selectedModel, setSelectedModel] = useState(null);
  const effectiveModel = selectedModel && modelKeys.includes(selectedModel)
    ? selectedModel
    : modelKeys[0] ?? null;

  const features = effectiveModel ? modelFeatures[effectiveModel] : [];
  const maxImportance = Math.max(...features.map((f) => Number(f.importance)), 1);
  const accuracy = effectiveModel
    ? mlRunState?.result?.results?.[effectiveModel]?.accuracy
    : null;

  const ruleCount = knoxRunResult?.evaluation?.ruleCount ?? 0;

  return (
    <div className="stage-grid">
      <section className="card">
        <h3>Ranked designs</h3>
        <p className="muted">
          Final review should prioritize outcomes: which designs ranked highest
          and what the model thinks matters.
        </p>

        {rankedDesigns.length > 0 ? (
          <table className="results-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Design</th>
                <th>Score</th>
                <th>Rules passed</th>
              </tr>
            </thead>
            <tbody>
              {rankedDesigns.map((row) => (
                <tr key={row.designId}>
                  <td>{row.rank}</td>
                  <td>
                    <code>{row.designId}</code>
                  </td>
                  <td>
                    {Number.isFinite(Number(row.score))
                      ? Number(row.score).toFixed(4)
                      : "—"}
                  </td>
                  <td>
                    <span className={`chip ${row.rank === 1 ? "ready" : "pending"}`}>
                      {row.passedCount ?? "—"}{ruleCount > 0 ? ` / ${ruleCount}` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted empty-state">
            No ranked designs yet. Run Knox evaluation to populate this table.
          </p>
        )}
      </section>

      <section className="card compact-card">
        <div className="card-header-row">
          <h3>Top explanations</h3>
          {modelKeys.length > 1 && (
            <div className="source-toggle" role="tablist" aria-label="Model selector">
              {modelKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`source-toggle-button${effectiveModel === key ? " active" : ""}`}
                  onClick={() => setSelectedModel(key)}
                >
                  {MODEL_LABELS[key] ?? key}
                </button>
              ))}
            </div>
          )}
        </div>

        {accuracy != null && (
          <p className="muted compact">
            {MODEL_LABELS[effectiveModel] ?? effectiveModel} — accuracy{" "}
            <strong>{(Number(accuracy) * 100).toFixed(1)}%</strong>
          </p>
        )}

        {features.length > 0 ? (
          <div className="bar-list">
            {features.map((row) => {
              const pct = Math.round((Number(row.importance) / maxImportance) * 100);
              return (
                <div className="bar-row" key={row.feature}>
                  <span>{row.feature}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <strong>{Number(row.importance).toFixed(0)}</strong>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted empty-state">
            No feature importances yet. Run ML to see which rules matter most.
          </p>
        )}
      </section>
    </div>
  );
}
