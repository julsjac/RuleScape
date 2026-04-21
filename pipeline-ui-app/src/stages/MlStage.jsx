const modelChoices = [
  {
    title: "Explainable Boosting Machine",
    badge: "Recommended",
    note: "Best fit for interpretable rule features.",
    active: true,
  },
  {
    title: "Random Forest",
    badge: "Baseline",
    note: "Strong baseline for tabular feature matrices.",
    active: false,
  },
  {
    title: "Decision Tree",
    badge: "Binary Classification",
    note: "Classify as good or bad designs.",
    active: false,
  },
  {
    title: "Decision Tree",
    badge: "Regression",
    note: "Predict performance score of designs.",
    active: false,
  },
];

export function MlStage({ mlParams, onMlParamChange, onRunML, mlRunState }) {
  if (!mlParams || !mlRunState) return null;
  return (
    <div className="stage-grid">
      <section className="card">
        <h3>Model choice</h3>
        <p className="muted">
          Keep this step focused on training inputs, not general UI controls.
        </p>

        <div className="choice-list">
          {modelChoices.map((choice) => (
            <ChoiceCard
              key={choice.title}
              title={choice.title}
              badge={choice.badge}
              note={choice.note}
              active={choice.active}
            />
          ))}
        </div>
      </section>
    {/* RIGHT SIDE (THIS IS WHERE YOUR BUTTON GOES) */}
    <aside className="card preview-card">
      <h3>ML Configuration</h3>
      
      {/* Train/Test Split */}
        <label className="config-item">
          <span>Train/Test Split: {mlParams.trainSplit}%</span>
          <input
            type="range"
            min="50"
            max="90"
            value={mlParams.trainSplit}
            onChange={(e) =>
              onMlParamChange("trainSplit", Number(e.target.value))
            }
          />
        </label>

        {/* Top N Features */}
        <label className="config-item">
          <span>Top N Features</span>
          <input
            type="number"
            value={mlParams.topNFeatures}
            min="1"
            onChange={(e) =>
              onMlParamChange("topNFeatures", Number(e.target.value))
            }
          />
        </label>

        {/* Threshold */}
        <label className="config-item">
          <span>Classification Threshold</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={mlParams.threshold}
            onChange={(e) =>
              onMlParamChange("threshold", Number(e.target.value))
            }
          />
        </label>

        {/* RUN BUTTON (your code goes here) */}
        <button className="primary-button wide" onClick={onRunML}>
          {mlRunState?.phase === "running" ? "Running ML..." : "Run ML"}
        </button>

        {/* ERROR DISPLAY (your code goes here) */}
        {mlRunState?.error && (
          <p className="error-text compact">{mlRunState.error}</p>
        )}
      </aside>
    </div>
  );
}

function ChoiceCard({ title, badge, note, active = false }) {
  return (
    <div className={`choice-card ${active ? "active" : ""}`}>
      <span className="badge">{badge}</span>
      <strong>{title}</strong>
      <p className="muted">{note}</p>
    </div>
  );
}

function ConfigItem({ label, value }) {
  return (
    <div className="config-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
