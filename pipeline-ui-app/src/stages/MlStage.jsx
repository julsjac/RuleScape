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

const trainingSetup = [
  { label: "Feature source", value: "Knox rule matrix" },
  { label: "Target", value: "Design score" },
  { label: "Train split", value: "70%" },
  { label: "Validation", value: "15%" },
];

export function MlStage() {
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

      <section className="card compact-card">
        <h3>Training setup</h3>
        <div className="config-grid">
          {trainingSetup.map((item) => (
            <ConfigItem key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </section>
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
