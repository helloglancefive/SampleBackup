"""Utility functions for GlanceFive."""
from datetime import datetime, timedelta
from pathlib import Path
import json


def validate_date_format(date_str: str) -> bool:
    """Validate date is in YYYY-MM-DD format."""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def get_date_range(days_back: int = 7) -> tuple:
    """Get start and end dates."""
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days_back)
    return (start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))


def format_results(results: dict) -> str:
    """Format download results for display."""
    output = []
    output.append("\n" + "="*80)
    output.append("DOWNLOAD RESULTS")
    output.append("="*80)
    output.append(f"Date Range: {results['start_date']} to {results['end_date']}")
    output.append(f"Successful: {len(results['successful'])}")
    output.append(f"Empty: {len(results['empty'])}")
    output.append(f"Failed: {len(results['failed'])}")
    output.append("="*80)

    if results["successful"]:
        output.append("\nSUCCESSFUL DOWNLOADS:")
        output.append("-"*80)
        for report in results["successful"]:
            output.append(f"  {report['type']}")
            output.append(f"    Records: {report['records']}")
            output.append(f"    Size: {report['size_mb']:.2f} MB")
            output.append(f"    Path: {report['file_path']}")

    if results["empty"]:
        output.append("\nEMPTY REPORTS (No Data):")
        output.append("-"*80)
        for report in results["empty"]:
            output.append(f"  {report['type']}")

    if results["failed"]:
        output.append("\nFAILED REPORTS:")
        output.append("-"*80)
        for report in results["failed"]:
            output.append(f"  {report['type']}: {report['error']}")

    output.append("\n" + "="*80)
    return "\n".join(output)


def save_results(results: dict, output_path: Path = None) -> None:
    """Save results to JSON file."""
    if output_path is None:
        output_path = Path("download_results.json")

    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    print(f"\nResults saved to: {output_path}")
