"""
Fetch real Amazon Advertising data directly — no Celery/Redis required.
Runs the full pipeline synchronously and stores results in dev.db.

Usage:
    python fetch_real_data.py                         # last 30 days, all report types
    python fetch_real_data.py --days 7                # last 7 days
    python fetch_real_data.py --start 2024-01-01 --end 2024-01-31
    python fetch_real_data.py --types spCampaigns     # single report type
    python fetch_real_data.py --types spCampaigns spTargeting
"""
import argparse
import sys
from datetime import date, timedelta

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days",  type=int, default=30, help="Fetch last N days (default 30)")
    parser.add_argument("--start", help="Start date YYYY-MM-DD (overrides --days)")
    parser.add_argument("--end",   help="End date YYYY-MM-DD (default today)")
    parser.add_argument("--types", nargs="+", help="Report types to fetch (default: all 8)")
    args = parser.parse_args()

    ALL_TYPES = [
        "spCampaigns", "spTargeting", "spSearchTerm", "spProductAds",
        "sbSearchTerm", "sbTargeting", "sdAdvertising", "sdTargeting",
    ]
    report_types = args.types if args.types else ALL_TYPES

    end_date   = args.end   or date.today().isoformat()
    start_date = args.start or (date.today() - timedelta(days=args.days)).isoformat()

    print(f"\n=== GlanceFive Real Data Fetch ===")
    print(f"Date range : {start_date} → {end_date}")
    print(f"Report types: {', '.join(report_types)}\n")

    from app.dependencies import get_db
    from app.models import User, ClientAmazonCredentials
    from app.security.encryption import decrypt_credential
    from app.services.amazon_auth_service import AmazonAuthService
    from app.services.profile_service import ProfileService
    from app.services.report_service import ReportService
    from app.models import ReportFetch
    from config import get_settings
    from datetime import datetime

    settings = get_settings()
    db = next(get_db())

    # Find the demo user / first user
    user = db.query(User).filter(User.email == "demo@glancefive.com").first()
    if not user:
        user = db.query(User).first()
    if not user:
        print("ERROR: No user found. Run setup_fresh.py first.")
        sys.exit(1)

    print(f"User: {user.email} (client_id={user.client_id})")

    if not user.client_id:
        print("ERROR: User has no client_id. Re-run setup_fresh.py.")
        sys.exit(1)

    creds = db.query(ClientAmazonCredentials).filter(
        ClientAmazonCredentials.client_id == user.client_id
    ).first()

    if not creds:
        print("\nERROR: No Amazon credentials found for this account.")
        print("  → Go to http://localhost:5173/settings and save your credentials first.")
        sys.exit(1)

    if not settings.encryption_key:
        print("ERROR: ENCRYPTION_KEY not set in .env")
        sys.exit(1)

    # Decrypt credentials
    try:
        amazon_client_id     = decrypt_credential(creds.amazon_client_id, settings.encryption_key)
        amazon_client_secret = decrypt_credential(creds.amazon_client_secret, settings.encryption_key)
        amazon_refresh_token = decrypt_credential(creds.amazon_refresh_token, settings.encryption_key)
    except Exception as e:
        print(f"ERROR: Failed to decrypt credentials: {e}")
        print("  → Re-save your credentials in Settings.")
        sys.exit(1)

    print("Credentials decrypted OK.\n")

    # Auth
    auth = AmazonAuthService(amazon_client_id, amazon_client_secret, amazon_refresh_token, settings)
    try:
        token = auth.get_access_token(force_refresh=True)
        print(f"Amazon token obtained: {token[:20]}...\n")
    except RuntimeError as e:
        print(f"ERROR: Could not get Amazon access token:\n  {e}")
        print("\nCheck that your Client ID, Client Secret, and Refresh Token are correct.")
        sys.exit(1)

    # Profile
    profile_id = str(creds.amazon_profile_id) if creds.amazon_profile_id else None
    if not profile_id:
        print("No profile_id saved — auto-detecting from Amazon API...")
        try:
            profile_svc = ProfileService(auth, settings)
            profile_id = profile_svc.get_primary_profile_id()
        except Exception as e:
            print(f"ERROR: Could not detect profile: {e}")
            sys.exit(1)
        print(f"Profile detected: {profile_id}\n")
    else:
        print(f"Using saved profile_id: {profile_id}\n")

    # Fetch each report type
    report_svc = ReportService(user.client_id, auth, profile_id, settings)
    results = {}

    for report_type in report_types:
        print(f"[{report_type}] Requesting report...", flush=True)

        fetch = ReportFetch(
            client_id=user.client_id,
            report_type=report_type,
            status="running",
            start_date=datetime.strptime(start_date, "%Y-%m-%d"),
            end_date=datetime.strptime(end_date, "%Y-%m-%d"),
            triggered_by="manual_script",
            triggered_by_user_id=user.id,
        )
        db.add(fetch)
        db.commit()
        db.refresh(fetch)

        try:
            result = report_svc.fetch_and_store(db, report_type, start_date, end_date, fetch.id)
            results[report_type] = result
            records = result.get("records", 0)
            if result.get("empty"):
                print(f"[{report_type}] ✓ Completed — no data (empty report, normal for SD types)\n")
            else:
                print(f"[{report_type}] ✓ Completed — {records} records stored\n")
        except RuntimeError as e:
            results[report_type] = {"error": str(e)}
            print(f"[{report_type}] ✗ Failed: {e}\n")

    print("\n=== FETCH COMPLETE ===")
    for rt, r in results.items():
        if "error" in r:
            print(f"  {rt:20s} FAILED: {r['error'][:60]}")
        elif r.get("empty"):
            print(f"  {rt:20s} empty (no data returned by Amazon)")
        else:
            print(f"  {rt:20s} {r.get('records', 0):>6} records stored")

    print("\nRefresh your dashboard at http://localhost:5173/dashboard")
    db.close()


if __name__ == "__main__":
    main()
