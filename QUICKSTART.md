# GlanceFive Quick Start

Get started downloading Amazon reports in 3 minutes.

## Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 2: Configure Credentials

Create `.env` file in project root:

```env
AMAZON_CLIENT_ID=your_client_id_here
AMAZON_CLIENT_SECRET=your_client_secret_here
AMAZON_REFRESH_TOKEN=your_refresh_token_here
```

Get these from your Amazon Seller Central → Advertising → API console.

## Step 3: Run Download

```bash
python glancefive.py
```

That's it! Reports will download to `reports/` directory.

## Common Commands

### Download specific date range
```bash
python glancefive.py --start-date 2026-05-01 --end-date 2026-05-09
```

### Download only Sponsored Products reports
```bash
python glancefive.py --reports spTargeting spSearchTerm spCampaigns spProductAds
```

### Save results summary
```bash
python glancefive.py --save-results
```

### View all options
```bash
python glancefive.py --help
```

## Folder Structure After First Run

```
GlanceFive/
├── .env
├── glancefive.py
├── requirements.txt
├── README.md
├── src/
└── reports/                    ← Reports downloaded here
    ├── spTargeting_*.json
    ├── spSearchTerm_*.json
    └── ...
```

## Expected Output

```
================================================================================
GLANCEFIVE - AMAZON REPORT DOWNLOADER
================================================================================
Start Date: 2026-05-02
End Date: 2026-05-09
Reports: 8 report types
Output Dir: ./reports
================================================================================

[1/8] Downloading spTargeting
[2/8] Downloading spSearchTerm
...

================================================================================
DOWNLOAD RESULTS
================================================================================
Successful: 6
Empty: 2
Failed: 0

SUCCESSFUL DOWNLOADS:
  spTargeting (26 records, 0.04 MB)
  spSearchTerm (69 records, 0.10 MB)
  ...
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No profile found" | Check .env credentials |
| "Token refresh failed" | Verify AMAZON_REFRESH_TOKEN |
| "Network error" | Check internet connection |
| Reports empty | Expected for unused ad types (SD) |

## Next Steps

1. ✅ Download reports
2. 📊 Parse JSON files (use standard JSON tools)
3. 📈 Analyze data as needed
4. 🔄 Schedule regular downloads (cron/Task Scheduler)

## Need Help?

See full documentation in `README.md`

---

**Ready?** Run: `python glancefive.py`
