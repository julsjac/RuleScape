<div align="center">
  <img src="assets/rulescape_logo.png" alt="logo", width=600> 
</div> 
<div align="center">

  ![Python](https://img.shields.io/badge/python-3.10-blue)  ![License](https://img.shields.io/badge/license-MIT-green) ![Status](https://img.shields.io/badge/status-active-brightgreen) 

</div>

___

RuleScape is a comprehensive integration pipeline for Knox and Cello that helps manage combinitorial explosion through rule rankings, powered by various machine learning algorithms





## <strong>Rank-based Approach to Design</strong>
RuleScape's Rule-Ranking system is what sets it apart from other design workflows. Through RuleScape's host of Machine Learning models trained on genetic designs and their rules, designs are ranked and high-throughput rules are put center stage to help guide designs. 

## <strong>Seamless UI</strong>

<div align="center">
  <img src="assets/Pipeline.png" alt="pipeline" width="600">
</div>

RuleScape aims to streamline circuit design by integrating Knox and Cello and centralizing commands and controls for the design process in one place. 

Through the modernized UI, RuleScape guides users through design consideration decisions and allows for custom libraries. 

## <strong>Under the Hood</strong>

RuleScape's adapter layer drives the integration of Knox and Cello, allowing the two to communicate quickly and effectively and removing the friction between design development and expression modeling

## What's here

- `knox/` - Git submodule for storing, querying, and visualizing genetic design spaces.
- `cello/` - Git submodule for compiling logic designs into genetic circuit implementations.
- `dataio/` - Local scripts and datasets for preparing inputs, generating UCF files, and supporting analysis.

## <strong> Installation </strong>

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