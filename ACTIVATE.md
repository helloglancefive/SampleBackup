# How to Activate & Use GlanceFive

## Quick Start (One Command)

```bash
conda run -n glancefive python glancefive.py
```

That's it! No need to activate first.

## Or: Activate Environment First

### On Windows (Command Prompt)
```bash
conda activate glancefive
python glancefive.py
```

### On Windows (PowerShell)
```powershell
conda activate glancefive
python glancefive.py
```

### On macOS/Linux
```bash
conda activate glancefive
python glancefive.py
```

## After Running

Reports will be downloaded to:
```
GlanceFive/reports/
```

Each file is named: `{report_type}_{timestamp}.json`

Example:
```
reports/
├── spTargeting_20260509_120000.json
├── spSearchTerm_20260509_120100.json
├── spCampaigns_20260509_120200.json
└── ...
```

## Common Commands

```bash
# See all options
conda run -n glancefive python glancefive.py --help

# Specific date range
conda run -n glancefive python glancefive.py --start-date 2026-05-01 --end-date 2026-05-09

# Specific reports
conda run -n glancefive python glancefive.py --reports spTargeting spCampaigns

# Save results summary
conda run -n glancefive python glancefive.py --save-results

# Custom output directory
conda run -n glancefive python glancefive.py --output D:\my_reports
```

## Deactivate Environment

```bash
conda deactivate
```

## Check Environment

```bash
conda info --envs
```

You'll see:
```
...
glancefive            *  C:\Users\Sandeep\anaconda3\envs\glancefive
...
```

## Environment Details

**Name:** glancefive  
**Python:** 3.11.15  
**Location:** C:\Users\Sandeep\anaconda3\envs\glancefive  
**Size:** ~1 GB  
**Status:** Ready to use

## File Setup Checklist

Before running, make sure:

- [ ] `.env` file exists in GlanceFive folder
- [ ] `.env` contains real Amazon credentials:
  - AMAZON_CLIENT_ID
  - AMAZON_CLIENT_SECRET  
  - AMAZON_REFRESH_TOKEN
- [ ] `glancefive.py` exists in root folder
- [ ] `src/` folder exists with all modules
- [ ] `requirements.txt` exists
- [ ] Environment is installed: `glancefive`

## Troubleshooting

### "conda: command not found"
- Install Anaconda or Miniconda
- Or use `pip` instead of `conda`

### "glancefive environment not found"
- Create it: `conda create -n glancefive python=3.11 -y`
- Install deps: `conda run -n glancefive pip install -r requirements.txt`

### "No module named 'src'"
- Make sure you're in the `GlanceFive` folder when running
- Check `src/__init__.py` exists

### "Invalid credentials"
- Edit `.env` with real Amazon API credentials
- Credentials must be from Amazon Seller Central

## Need Help?

See:
- `QUICKSTART.md` - 3-minute setup
- `README.md` - Full documentation
- `TEST_RESULTS.md` - Test status

---

**Ready?** Run: `conda run -n glancefive python glancefive.py`
