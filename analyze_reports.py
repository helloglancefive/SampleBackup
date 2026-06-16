import json

files = {
    'spTargeting': 'D:/claude_code_experiments/GlanceFive/reports/spTargeting_20260509_141534.json',
    'spSearchTerm': 'D:/claude_code_experiments/GlanceFive/reports/spSearchTerm_20260509_142841.json',
    'spCampaigns': 'D:/claude_code_experiments/GlanceFive/reports/spCampaigns_20260509_143941.json',
    'spProductAds': 'D:/claude_code_experiments/GlanceFive/reports/spProductAds_20260509_145250.json',
    'sbSearchTerm': 'D:/claude_code_experiments/GlanceFive/reports/sbSearchTerm_20260509_150850.json',
    'sbTargeting': 'D:/claude_code_experiments/GlanceFive/reports/sbTargeting_20260509_160733.json',
    'sdAdvertising': 'D:/claude_code_experiments/GlanceFive/reports/sdAdvertising_20260509_152526.json',
    'sdTargeting': 'D:/claude_code_experiments/GlanceFive/reports/sdTargeting_20260509_153711.json',
}

for name, path in files.items():
    with open(path) as f:
        data = json.load(f)
    records = data if isinstance(data, list) else data.get('data', data.get('records', [data]))
    count = len(records)
    keys = sorted(records[0].keys()) if count > 0 else []
    print(f'=== {name} ({count} records) ===')
    for k in keys:
        v = records[0][k]
        print(f'  {k}: {type(v).__name__} = {repr(v)[:80]}')
    print()
