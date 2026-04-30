import Editor from "@monaco-editor/react";
import { useRef, useState } from "react";

const VERILOG_LANGUAGE_ID = "rulescape-verilog";

export const celloInputBundle = [
  {
    id: "verilog",
    title: "Verilog",
    note: "logic/function the circuit should implement",
    accept: ".v",
    placeholder: "Import or write the Verilog specification",
    language: VERILOG_LANGUAGE_ID,
  },
  {
    id: "ucf",
    title: "UCF",
    note: "gate library, part library, and gate behavior",
    accept: ".json",
    placeholder: "Import or write the UCF JSON",
    language: "json",
  },
  {
    id: "inputJson",
    title: "input.json",
    note: "allowed input sensors",
    accept: ".json",
    placeholder: "Import or write the input JSON",
    language: "json",
  },
  {
    id: "outputJson",
    title: "output.json",
    note: "allowed output reporters",
    accept: ".json",
    placeholder: "Import or write the output JSON",
    language: "json",
  },
];

const editorOptions = {
  automaticLayout: true,
  fontFamily: "IBM Plex Mono, monospace",
  fontSize: 13,
  lineHeight: 20,
  minimap: { enabled: false },
  padding: { top: 16, bottom: 16 },
  scrollBeyondLastLine: false,
  tabSize: 2,
  wordWrap: "on",
  lineNumbersMinChars: 3,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  folding: false,
  renderLineHighlight: "line",
};

export function createEmptyCelloInputs() {
  return Object.fromEntries(celloInputBundle.map((item) => [item.id, ""]));
}

export function createEmptyImportedNames() {
  return Object.fromEntries(celloInputBundle.map((item) => [item.id, ""]));
}

function ensureVerilogLanguage(monaco) {
  const exists = monaco.languages
    .getLanguages()
    .some((language) => language.id === VERILOG_LANGUAGE_ID);

  if (exists) {
    return;
  }

  monaco.languages.register({ id: VERILOG_LANGUAGE_ID });
  monaco.languages.setMonarchTokensProvider(VERILOG_LANGUAGE_ID, {
    keywords: [
      "always",
      "assign",
      "begin",
      "case",
      "default",
      "else",
      "end",
      "endmodule",
      "for",
      "if",
      "inout",
      "input",
      "module",
      "output",
      "parameter",
      "reg",
      "wire",
    ],
    operators: /[~!&|^+\-*/%=<>?:]+/,
    tokenizer: {
      root: [
        [/\/\/.*/, "comment"],
        [/\/\*/, { token: "comment", next: "@comment" }],
        [/\b\d+'[bdhoBDHO][0-9a-fA-FxXzZ_]+\b/, "number"],
        [/\b\d+\b/, "number"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, { token: "string.quote", next: "@string" }],
        [/[a-zA-Z_][\w$]*/, {
          cases: {
            "@keywords": "keyword",
            "@default": "identifier",
          },
        }],
        [/[{}()[\]]/, "delimiter.bracket"],
        [/[;,.]/, "delimiter"],
        [/@operators/, "operator"],
        [/\s+/, "white"],
      ],
      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, { token: "comment", next: "@pop" }],
        [/[/*]/, "comment"],
      ],
      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, { token: "string.quote", next: "@pop" }],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration(VERILOG_LANGUAGE_ID, {
    comments: {
      lineComment: "//",
      blockComment: ["/*", "*/"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
  });
}

function statusCopy(phase, errorMessage = "") {
  switch (phase) {
    case "initializing":
      return "Preparing the input bundle and opening the Cello run.";
    case "running":
      return "Cello is scoring candidate gate assignments and building the export package.";
    case "completed":
      return "The run completed. Review the ranked candidates or continue to the Knox handoff.";
    case "error":
      if (errorMessage === "Failed to fetch") {
        return "The run failed before a valid output package was generated. Launch the Cello pipeline server and try again.";
      }
      return errorMessage
        ? `The run failed before a valid output package was generated. ${errorMessage}`
        : "The run failed before a valid output package was generated.";
    default:
      return "Run Cello to generate the ranked candidates and Knox-ready export package.";
  }
}

export function CelloStage({
  celloInputs = createEmptyCelloInputs(),
  importedNames = createEmptyImportedNames(),
  onCelloInputChange = () => {},
  onImportedNameChange = () => {},
  runState,
  runResult,
  viewMode = "inputs",
  onEditInputs = () => {},
  isRunning = false,
}) {
  const [openId, setOpenId] = useState(null);
  const fileInputs = useRef({});
  const candidates = runResult?.summary?.candidates ?? [];
  const bestCandidate = candidates[0] ?? null;
  const showingSummary = viewMode === "summary";

  const toggleOpen = (id) => {
    setOpenId((current) => (current === id ? null : id));
  };

  const triggerFilePicker = (id) => {
    fileInputs.current[id]?.click();
  };

  const handleFileImport = (item, event) => {
    const id = item.id;
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(item.accept.toLowerCase())) {
      window.alert(`Please upload a ${item.accept} file for ${item.title}.`);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onCelloInputChange(id, String(reader.result ?? ""));
      onImportedNameChange(id, file.name);
      setOpenId(id);
    };
    reader.readAsText(file);
  };

  if (showingSummary) {
    return (
      <div className="stage-grid">
        <section className="card">
          <div className="card-header-row">
            <div>
              <h3>Latest Cello output</h3>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={onEditInputs}
              disabled={isRunning}
            >
              Edit input files
            </button>
          </div>

          {runResult ? (
            <>
              <p className="muted compact">{statusCopy(runState.phase, runState.error)}</p>
              <div className="mini-grid result-mini-grid">
                <div className="mini-card">
                  <span className="mini-card-label">Top N returned</span>
                  <strong className="mini-card-value">{runResult.returnedTopN}</strong>
                </div>
                <div className="mini-card">
                  <span className="mini-card-label">Best score</span>
                  <strong className="mini-card-value">{Number(runResult.bestScore).toFixed(4)}</strong>
                </div>
                <div className="mini-card">
                  <span className="mini-card-label">Best gate</span>
                  <strong className="mini-card-value">{bestCandidate?.selected_gate || "—"}</strong>
                </div>
                <div className="mini-card">
                  <span className="mini-card-label">Bundle</span>
                  <strong className="mini-card-value">CSV ready</strong>
                </div>
              </div>

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
                  {candidates.map((candidate) => (
                    <tr key={`${candidate.rank}-${candidate.selected_gate}`}>
                      <td>{candidate.rank}</td>
                      <td>{candidate.selected_gate}</td>
                      <td>{Number(candidate.score).toFixed(4)}</td>
                      <td>{candidate.selected_parts.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted empty-state">{statusCopy(runState.phase, runState.error)}</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="stage-grid">
      <section className="card">
        <h3>Input bundle</h3>
        <p className="muted">
          Keep the first step narrow: users should only think about the Cello
          run inputs and a few run parameters.
        </p>

        <div className="input-list accordion-list">
          {celloInputBundle.map((item) => {
            const isOpen = openId === item.id;
            const importedName = importedNames[item.id];

            return (
              <article key={item.id} className={`input-card${isOpen ? " open" : ""}`}>
                <div className="input-header">
                  <button
                    className="input-toggle"
                    type="button"
                    onClick={() => toggleOpen(item.id)}
                    aria-expanded={isOpen}
                  >
                    <span className={`input-chevron${isOpen ? " open" : ""}`}>
                      <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p className="muted">{item.note}</p>
                    </div>
                  </button>

                  <div className="input-header-meta">
                    {importedName ? <span className="chip pending mono">{importedName}</span> : null}

                    <input
                      ref={(element) => {
                        fileInputs.current[item.id] = element;
                      }}
                      className="hidden-file-input"
                      type="file"
                      accept={item.accept}
                      onChange={(event) => handleFileImport(item, event)}
                    />

                    <button
                      className="ghost-button upload-button"
                      type="button"
                      onClick={() => triggerFilePicker(item.id)}
                      aria-label={`Import ${item.title}`}
                    >
                      <i className="fa-solid fa-upload" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="input-body" aria-hidden={!isOpen}>
                  <div className="input-panel">
                    {isOpen ? (
                      <InputCodeEditor
                        item={item}
                        value={celloInputs[item.id]}
                        onChange={(nextValue) => onCelloInputChange(item.id, nextValue)}
                      />
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function InputCodeEditor({ item, value, onChange }) {
  const [isFocused, setIsFocused] = useState(false);
  const isEmpty = !value;
  const showPlaceholder = isEmpty;
  const resolvedOptions = {
    ...editorOptions,
    lineNumbers: isEmpty ? "off" : "on",
    lineNumbersMinChars: isEmpty ? 0 : editorOptions.lineNumbersMinChars,
    renderLineHighlight: isEmpty ? "none" : editorOptions.renderLineHighlight,
    renderLineHighlightOnlyWhenFocus: true,
  };

  const handleMount = (editor) => {
    editor.onDidFocusEditorText(() => setIsFocused(true));
    editor.onDidBlurEditorText(() => setIsFocused(false));
  };

  return (
    <div className={`editor-shell${isEmpty ? " empty" : ""}${isFocused ? " focused" : ""}`}>
      {showPlaceholder ? <span className="editor-placeholder">{item.placeholder}</span> : null}

      <Editor
        beforeMount={ensureVerilogLanguage}
        height="280px"
        language={item.language}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        onMount={handleMount}
        options={resolvedOptions}
        path={`${item.id}${item.accept}`}
        theme="vs-dark"
        value={value}
      />
    </div>
  );
}
