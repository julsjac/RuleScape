const fileNotes = {
  designs: "ordered selected parts per exported design",
  partLibrary: "all part IDs and roles resolved from the UCF",
  weight: "Cello circuit score for each exported design",
  summary: "human-readable summary of the ranked adapter output",
};

export function BridgeStage({ runResult }) {
  const candidates = runResult?.summary?.candidates ?? [];
  const selectedParts = candidates[0]?.selected_parts ?? [];
  const generatedFiles = runResult
    ? [
        { key: "designs", name: "designs.csv", path: runResult.files.designs },
        { key: "partLibrary", name: "part_library.csv", path: runResult.files.partLibrary },
        { key: "weight", name: "weight.csv", path: runResult.files.weight },
        { key: "summary", name: "adapter_result.json", path: runResult.files.summary },
      ]
    : [];

  return (
    <div className="stage-grid">
      <section className="card">
        <h3>Adapter mapping</h3>
        <p className="muted">
          This step should explain the handoff, not hide it. Users need to see
          exactly what is being translated.
        </p>
        <div className="mapping-list">
          <MappingItem
            left="selected parts from the resolved design_assignment"
            right="designs.csv"
          />
          <MappingItem
            left="all part IDs and roles derived from the UCF"
            right="part_library.csv"
          />
          <MappingItem
            left="Cello circuit score for each exported design"
            right="weight.csv"
          />
        </div>
      </section>

      <section className="card compact-card">
        <h3>Generated package</h3>
        {runResult ? (
          <>
            <p className="muted">
              Review the exported bundle before wiring it into Knox import and rule evaluation.
            </p>
            <div className="file-list">
              {generatedFiles.map((file) => (
                <div className="file-row file-row-stacked" key={file.name}>
                  <div>
                    <strong>{file.name}</strong>
                    <p className="muted">{fileNotes[file.key]}</p>
                    <code className="file-path mono">{file.path}</code>
                  </div>
                  <span className="chip ready">ready</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="muted empty-state">
            Run Cello first. The adapter-generated Knox bundle will appear here.
          </p>
        )}
      </section>

      <section className="card compact-card">
        <h3>Selected design preview</h3>
        {selectedParts.length > 0 ? (
          <div className="part-strip">
            {selectedParts.map((part) => (
              <span key={part} className="part-pill">
                {part}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted empty-state">
            The top-ranked design will appear here after the Cello run completes.
          </p>
        )}
      </section>

      <section className="card">
        <h3>Ranked export preview</h3>
        {candidates.length > 0 ? (
          <table className="results-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Gate</th>
                <th>Score</th>
                <th>Input</th>
                <th>Output</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={`${candidate.rank}-${candidate.selected_gate}`}>
                  <td>{candidate.rank}</td>
                  <td>{candidate.selected_gate}</td>
                  <td>{Number(candidate.score).toFixed(4)}</td>
                  <td>{candidate.input_assignments?.[0]?.sensor || "—"}</td>
                  <td>{candidate.output_assignments?.[0]?.device || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted empty-state">
            No ranked candidates yet. Step 1 needs to generate the adapter output first.
          </p>
        )}
      </section>
    </div>
  );
}

function MappingItem({ left, right }) {
  return (
    <div className="mapping-row">
      <span>{left}</span>
      <code>{right}</code>
    </div>
  );
}