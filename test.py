import pandas as pd

FILE_PATH = '/Users/charlesjoseph/Downloads/Zip Codes_Dated 04_26_25 - 04_26_26 (1).xlsx'

df = pd.read_excel(FILE_PATH)

zips = df['Location Zip'].dropna().astype(str).str.strip().str.split('-').str[0].str.zfill(5)
zip_counts = zips.value_counts().to_dict()

for zip_code, count in sorted(zip_counts.items(), key=lambda x: -x[1]):
    print(f"{zip_code}: {count}")

print(f"\nTotal unique zips: {len(zip_counts)}")
print(f"Total rows counted: {sum(zip_counts.values())}")
