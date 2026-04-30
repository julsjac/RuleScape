import os
import scipy.io
import pandas as pd

class KnoxFormatGenerator:
    def __init__(self, file_name: str) -> None:
        self.file_name = file_name
        mat = scipy.io.loadmat(file_name)
        self.assign_df = pd.DataFrame(
            mat['eu_ordered_assign_split'],
            columns=['SynTF1', 'SynTF2', 'SynTF3', 'SynTF4', 'SynTF5', 'Rep1', 'Rep2', 'Rep3', 'System']
        )
        self.exp_df = pd.DataFrame(
            mat['ordered_eu_exp'],
            columns=['OffExp', 'OnExp', 'FoldChange', 'BarcodeCount']
        )

    def _build_part_library(self):
        role_map = {
            'SynTF': 'cds',
            'Rep': 'promoter',
            'System': 'operator'
        }
        dataframes = []
        for i, col in enumerate(self.assign_df.columns):
            prefix = ''.join([c for c in col if not c.isdigit()])
            role = role_map.get(prefix)
            dataframe = pd.DataFrame({
                'id': [f'design_col_{i}_{int(v)}' for v in self.assign_df[col].unique()],
                'role': role,
                'sequence': ''
            })
            dataframes.append(dataframe)
        return pd.concat(dataframes, ignore_index=True).dropna()

    def _build_designs(self):
        cols = list(enumerate(self.assign_df.columns))
        return self.assign_df.apply(
            lambda row: ','.join([f'design_col_{i}_{int(row[col])}' for i, col in cols]),
            axis=1
        )

    def generate(self, output_dir: str = 'data'):
        if not os.path.isdir(output_dir):
            os.mkdir(output_dir)
        self._build_part_library().to_csv(f'{output_dir}/part_library.csv', index=False)
        with open(f'{output_dir}/designs.csv', 'w') as f:
            f.write('design\n')
            for design in self._build_designs():
                f.write(design + '\n')

if __name__ == "__main__":
    generator = KnoxFormatGenerator("Single_input_measurements.mat")
    generator.generate()
