Sample run files kept in this directory:

Cello input bundle (uses the 10k UCF):
- `cello_input/classic_not_test.v`
- `cello_input/CLASSIC_single_input_top_10000.UCF.json`
- `cello_input/CLASSIC_single_input.input.json`
- `cello_input/CLASSIC_single_input.output.json`

Knox bundle and rule inputs for a curated high-score subset of a real `top_10000` Cello adapter run:
- `knox_input/designs.csv`
- `knox_input/part_library.csv`
- `knox_input/weight.csv`
- `knox_input/adapter_result.json`
- `knox_input/cello-generated-columns-goldbar.csv`
- `knox_input/cello-generated-columns-categories.json`

The CSV bundle is a curated top-200 slice from a real exported Cello run, so `weight.csv` still contains real Cello scores but the sample starts from the strongest designs instead of the full long tail.
The Goldbar CSV contains 200 rules regenerated from that high-score subset so the Knox-to-ML path has a better chance of separating stronger versus weaker designs inside the sample bundle.
The categories file maps both generic column names (`col1`..`col9`) and concrete `design_col_*` tokens, which keeps the example usable for Knox import and a more meaningful ML smoke test without rerunning Cello first.
