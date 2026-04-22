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

import { useState } from "react";

export function MlStage({ mlParams, onMlParamChange, onRunML, mlRunState }) {
  const [selectedModels, setSelectedModels] = useState(new Set());
  
  if (!mlParams || !mlRunState) return null;

  function toggleModel(id) {
    setSelectedModels(prev => {
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
    </div>
  );
}

function ChoiceCard({ title, badge, note, active = false, onClick }) {
  return (
    <div className={`choice-card ${active ? "active" : ""}`}
      onClick={onClick}
      role="button"
      >
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
