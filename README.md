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

- `knox/` - Git submodule for storing, querying, and visualizing genetic design spaces.
- `cello/` - Git submodule for compiling logic designs into genetic circuit implementations.
- `dataio/` - Local scripts and datasets for preparing inputs, generating UCF files, and supporting analysis.

## <strong> Installation </strong>

This repo depends on Git submodules for the main application code. Clone it with:

```bash
git clone --recurse-submodules https://github.com/julsjac/RuleScape.git
cd RuleScape/pipeline-ui-app
./scripts/bootstrap.sh
```

If your system is Mac/Linux, the installer now sets up:

- Node.js and frontend `npm` dependencies
- Cello Python dependencies from `cello/requirements.txt`
- Cello system dependencies: `yosys`, `graphviz` (`dot`), and `java`

On macOS the script uses Homebrew. On Linux it uses Homebrew when available, otherwise `apt-get`.

For Windows, additionally users must:
- install node.js
- In the git bash:
```bash
cd RuleScape/pipeline-ui-app
npm install
```
- install Docker

For the ML scripts, you will also need to install the relevant Python packages.
- First, ensure you have Python 3.10+ installed
```bash
cd RuleScape
pip install -r dataio/ml/requirements.txt
```

## Launch apps
Each of these services must be launched in their own terminal.

To launch the frontend, run:
```bash
cd RuleScape/pipeline-ui-app
npm run dev
```

Then, to launch Cello:
```bash
cd RuleScape/cello
python3.10 cello_knox/pipeline_server.py
```
Then open: `http://127.0.0.1:5173`

If `python3.10` is not installed on your machine, use the Python 3.10+ interpreter that `./scripts/install_frontend.sh` selected and printed at the end of setup.


To launch Knox:
```bash
cd RuleScape/knox
docker-compose up --build
```

---

To use a simple example, examples files are located at:
- `RuleScape/examples/cello_input` - These are for the first stage, contains a .v, UCF, input/output.json
- `RuleScape/examples/knox_input` - This folder contains a simple goldbar rule, and a mapping layer (categories.json)
