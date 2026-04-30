<div align="center">
  <img src="assets/rulescape_logo.png" alt="logo", width=600> 
</div> 
<div align="center">

  ![Python](https://img.shields.io/badge/python-3.10-blue)  ![License](https://img.shields.io/badge/license-MIT-green) ![Status](https://img.shields.io/badge/status-active-brightgreen) 

</div>

___

RuleScape is an integrated pipeline that:
- Connects Cello and Knox into a single workflow
- Evaluates genetic designs against structural rules
- Uses machine learning to rank rules by their influence on design performance
- Helps guide design decisions by surfacing the highest-impact rules

## <strong>Seamless UI</strong>

<div align="center">
  <img src="assets/RuleScapeGUI.png" alt="pipeline" width="600">
</div>

RuleScape aims to streamline circuit design by integrating Knox and Cello and centralizing commands and controls for the design process in one place. 

Through the modernized UI, RuleScape guides users through design consideration decisions and allows for custom libraries. 

## What's here

- `code/knox/` - Git submodule for storing, querying, and visualizing genetic design spaces. (requires Neo4j)
- `code/cello/` - Git submodule for compiling logic designs into genetic circuit implementations.
- `code/dataio/` - Local scripts and datasets for preparing inputs, generating UCF files, and supporting analysis.
- `code/pipeline-ui-app/` – React frontend UI

Other directories:
- `assets/` – images and demo files
- `examples/` – example inputs/outputs
- `RuleScape Final Project Report.pdf` – final report

## <strong> Installation </strong>

This repo depends on Git submodules for the main application code. Clone it with:

```bash
git clone --recurse-submodules https://github.com/julsjac/RuleScape.git
cd code/pipeline-ui-app
./scripts/bootstrap.sh
```

On macOS and Linux, `bootstrap.sh` installs:

- Node.js and frontend `npm` dependencies
- Cello Python dependencies from `cello/requirements.txt`
- ML Python dependencies from `dataio/ml/requirements.txt`
- system dependencies used by the current stack: `yosys`, `graphviz` (`dot`), `Java 17+`, and `Maven`

On macOS the script uses Homebrew. On Linux it uses Homebrew when available, otherwise `apt-get`.

The bootstrap script does **not** install:

- Python itself
- Docker
- Neo4j for non-Docker Knox runs

So before running the script, make sure you already have:

- Python 3.10+
- Docker if you plan to run Knox with `docker-compose`


For Windows, the bootstrap script is not the supported setup path. Install the required dependencies manually.

## Launch apps
Each of these services must be launched in their own terminal.

Frontend:
```bash
cd code/pipeline-ui-app
npm run dev
```

Cello pipeline server:
```bash
cd code/cello
python3.10 cello_knox/pipeline_server.py
```

ML server:
```bash
cd code
python3.10 -m dataio.ml.ml_server
```

Then open: `http://127.0.0.1:5173`

If `python3.10` is not installed on your machine, use the Python 3.10+ interpreter that `./scripts/bootstrap.sh` selected and printed at the end of setup.

Knox can be launched in one of two ways.

Using Docker:
```bash
cd code/knox
docker-compose up --build
```

Using a local source build:
```bash
(open Neo4j)
cd code/knox
mvn clean install
mvn spring-boot:run
```

The local Knox source build still requires a running Neo4j instance.

---

To use a simple example, examples files are located at:
- `RuleScape/examples/cello_input` - These are for the first stage, contains a .v, UCF, input/output.json
- `RuleScape/examples/knox_input` - This folder contains a simple goldbar rule, and a mapping layer (categories.json)
