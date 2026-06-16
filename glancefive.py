#!/usr/bin/env python3
"""
GlanceFive - Amazon Advertising Report Downloader

A minimal, standalone application for downloading Amazon Ads reports.
"""
import sys
import argparse
from pathlib import Path
from datetime import datetime

from src import get_downloader, setup_logger
from src.report import REPORT_TYPES
from src.utils import format_results, save_results, validate_date_format, get_date_range

logger = setup_logger(__name__)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="GlanceFive - Download Amazon Advertising Reports"
    )
    parser.add_argument(
        "--start-date",
        help="Start date in YYYY-MM-DD format (default: 7 days ago)",
        default=None
    )
    
    
    
    
    
    
    parser.add_argument(
        "--end-date",
        help="End date in YYYY-MM-DD format (default: today)",
        default=None
    )
    parser.add_argument(
        "--reports",
        nargs="+",
        choices=REPORT_TYPES,
        help="Specific reports to download (default: all)",
        default=None
    )
    parser.add_argument(
        "--output",
        help="Output directory for reports (default: ./reports)",
        default="./reports"
    )
    parser.add_argument(
        "--save-results",
        action="store_true",
        help="Save results to JSON file"
    )

    args = parser.parse_args()

    # Validate dates if provided
    if args.start_date and not validate_date_format(args.start_date):
        logger.error("Invalid start-date format. Use YYYY-MM-DD")
        sys.exit(1)

    if args.end_date and not validate_date_format(args.end_date):
        logger.error("Invalid end-date format. Use YYYY-MM-DD")
        sys.exit(1)

    # Get date range
    if not args.start_date or not args.end_date:
        start_date, end_date = get_date_range()
        if not args.start_date:
            args.start_date = start_date
        if not args.end_date:
            args.end_date = end_date

    # Print header
    print("\n" + "="*80)
    print("GLANCEFIVE - AMAZON REPORT DOWNLOADER")
    print("="*80)
    print(f"Start Date: {args.start_date}")
    print(f"End Date: {args.end_date}")
    print(f"Reports: {len(args.reports or REPORT_TYPES)} report types")
    print(f"Output Dir: {args.output}")
    print("="*80 + "\n")

    try:
        downloader = get_downloader()

        # Download reports
        results = downloader.download_all(
            start_date=args.start_date,
            end_date=args.end_date,
            report_types=args.reports
        )

        # Display results
        print(format_results(results))

        # Save results if requested
        if args.save_results:
            save_results(results, Path("download_results.json"))

        # Exit code based on results
        if results["failed"]:
            logger.warning(f"{len(results['failed'])} reports failed to download")
            return 1
        else:
            logger.info("Download completed successfully")
            return 0

    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
