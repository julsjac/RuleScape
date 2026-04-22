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

export function MlStage({ mlParams, onMlParamChange, onRunML, mlRunState, knoxRunState }) {
    const [selectedModels, setSelectedModels] = useState(new Set());

  if (!mlParams || !mlRunState) return null;

  const evaluationName = knoxRunState?.result?.evaluation?.evaluationName || "";
    const designGroupId = knoxRunState?.result?.import?.designGroupId || "";
    const hasKnoxContext = Boolean(evaluationName || designGroupId);

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

  const isRunning = mlRunState.phase === "running" || mlRunState.phase === "initializing";

  return (
        <div className="stage-grid">
          {hasKnoxContext && (
                  <section className="card full-span">
                            <h3>Knox context</h3>
                            <p className="muted">
                                        The ML run will re-evaluate designs using the Knox evaluation below.
                            </p>
                            <div className="mini-grid">
                              {evaluationName && (
                                  <div className="mini-card">
                                                  <span className="mini-card-label">Evaluation name</span>
                                                  <strong className="mini-card-value mono">{evaluationName}</strong>
                                  </div>
                                        )}
                              {designGroupId && (
                                  <div className="mini-card">
                                                  <span className="mini-card-label">Design group ID</span>
                                                  <strong className="mini-card-value mono">{designGroupId}</strong>
                                  </div>
                                        )}
                            </div>
                  </section>
              )}
        
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
                                                            min="0.1"
                                                            max="0.95"
                                                            step="0.05"
                                                            value={mlParams.trainSplit ?? 0.8}
                                                            onChange={(e) =>
                                                                              onMlParamChange("trainSplit", Number(e.target.value))
                                                            }
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
                                                            onChange={(e) =>
                                                                              onMlParamChange("topNFeatures", Number(e.target.value))
                                                            }
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
                                            <p className="muted">
                                              {selectedModels.size === 0
                                                                ? "Select at least one model above to run."
                                                                : `${selectedModels.size} model${selectedModels.size > 1 ? "s" : ""} selected.`}
                                            </p>
                                </div>
                                <button
                                              type="button"
                                              className="primary-button"
                                              disabled={isRunning || selectedModels.size === 0}
                                              onClick={handleRun}
                                            >
                                  {isRunning ? "Running..." : "Run ML"}
                                </button>
                      </div>
              
                {mlRunState.phase === "completed" && mlRunState.result && (
                    <div className="result-section">
                                <p className="muted compact">ML run complete.</p>
                      {Object.entries(mlRunState.result.results || {}).map(([modelId, res]) => (
                                    <div key={modelId} className="mini-card">
                                                    <span className="mini-card-label">{modelId}</span>
                                                    <strong className="mini-card-value">
                                                      {res.accuracy != null
                                                                            ? `Accuracy: ${(res.accuracy * 100).toFixed(1)}%`
                                                                            : res.r2 != null
                                                                            ? `R\u00b2: ${res.r2.toFixed(4)}`
                                                                            : "Done"}
                                                    </strong>
                                      {res.top_n_rules && res.top_n_rules.length > 0 && (
                                                        <ul className="top-rules-list">
                                                          {res.top_n_rules.map((rule, i) => (
                                                                                <li key={i} className="mono">
                                                                                  {rule.feature} \u2014 {Number(rule.importance).toFixed(4)}
                                                                                  </li>
                                                                              ))}
                                                        </ul>
                                                    )}
                                    </div>
                                  ))}
                    </div>
                      )}
              
                {mlRunState.phase === "error" && mlRunState.error && (
                    <p className="error-text">{mlRunState.error}</p>
                      )}
              </section>
        </div>
      );
}

function ChoiceCard({ title, badge, note, active = false, onClick }) {
    return (
          <div
                  className={`choice-card ${active ? "active" : ""}`}
                  onClick={onClick}
                  role="button"
                >
                <span className="badge">{badge}</span>
                <strong>{title}</strong>
                <p className="muted">{note}</p>
          </div>
        );
}
