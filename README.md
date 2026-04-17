# RuleScape

RuleScape brings together Cello and Knox used for rule-based genetic design work in one repository.

## What's here

- `knox/` - Git submodule for storing, querying, and visualizing genetic design spaces.
- `cello/` - Git submodule for compiling logic designs into genetic circuit implementations.
- `dataio/` - Local scripts and datasets for preparing inputs, generating UCF files, and supporting analysis.

## Submodules

This repo depends on Git submodules for the main application code. Clone it with:

```bash
git clone --recurse-submodules https://github.com/julsjac/RuleScape.git
cd RuleScape/pipeline-ui-app
./scripts/install_frontend.sh
```

To launch the frontend, run:
```bash
npm run dev
```
Then open: `http://127.0.0.1:5173`