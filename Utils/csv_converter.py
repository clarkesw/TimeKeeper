#!/usr/bin/env python3
"""
Script to convert existing time_tracker.csv from UTC to EST timezone
This will fix the timezone issue and ensure all dates/times are in EST
"""

import csv
from datetime import datetime
import pytz

# File paths
INPUT_FILE = "/home/clarke/Dropbox/time_tracker.csv"
OUTPUT_FILE = "/home/clarke/Dropbox/time_tracker_est.csv"
BACKUP_FILE = "/home/clarke/Dropbox/time_tracker_backup.csv"

# Timezone
EST_TZ = pytz.timezone('America/New_York')

def convert_csv():
    """Convert UTC timestamps to EST in the CSV file"""
    
    # First, create a backup
    print(f"Creating backup: {BACKUP_FILE}")
    try:
        import shutil
        shutil.copy2(INPUT_FILE, BACKUP_FILE)
        print("✓ Backup created successfully")
    except Exception as e:
        print(f"Warning: Could not create backup: {e}")
        response = input("Continue anyway? (yes/no): ")
        if response.lower() != 'yes':
            return
    
    # Read and convert
    converted_rows = []
    
    print(f"\nReading and converting: {INPUT_FILE}")
    with open(INPUT_FILE, 'r', newline='') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            entry_type = row['Type']
            timestamp_utc_str = row['Timestamp']
            
            # Parse UTC timestamp (format: 2025-10-17T18:31:41.133Z)
            dt_utc = datetime.strptime(timestamp_utc_str, '%Y-%m-%dT%H:%M:%S.%fZ').replace(tzinfo=pytz.utc)
            
            # Convert to EST
            dt_est = dt_utc.astimezone(EST_TZ)
            
            # Format without timezone suffix for cleaner look
            timestamp_clean = dt_est.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3]
            
            converted_rows.append({
                'Type': entry_type,
                'Timestamp': timestamp_clean,
                'Date': dt_est.strftime('%Y-%m-%d'),
                'Time': dt_est.strftime('%H:%M:%S')
            })
    
    # Write converted data
    print(f"Writing converted data: {OUTPUT_FILE}")
    with open(OUTPUT_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['Type', 'Timestamp', 'Date', 'Time'])
        writer.writeheader()
        writer.writerows(converted_rows)
    
    print(f"✓ Converted {len(converted_rows)} entries")
    
    # Show summary
    print("\n--- Conversion Summary ---")
    dates = {}
    for row in converted_rows:
        date = row['Date']
        dates[date] = dates.get(date, 0) + 1
    
    print("\nEntries by date (EST):")
    for date in sorted(dates.keys()):
        print(f"  {date}: {dates[date]} entries")
    
    # Show sample of before/after for first few entries
    print("\n--- Sample Conversions (first 5 entries) ---")
    with open(INPUT_FILE, 'r', newline='') as f:
        reader = csv.DictReader(f)
        original_rows = list(reader)[:5]
    
    for i, (orig, conv) in enumerate(zip(original_rows, converted_rows[:5])):
        print(f"\nEntry {i+1}:")
        print(f"  UTC:  {orig['Timestamp']} ({orig['Date']} {orig['Time']})")
        print(f"  EST:  {conv['Timestamp']} ({conv['Date']} {conv['Time']})")
    
    print("\n--- Next Steps ---")
    print("1. Review the converted file:")
    print(f"   head -20 {OUTPUT_FILE}")
    print("\n2. If everything looks good, replace the original:")
    print(f"   mv {OUTPUT_FILE} {INPUT_FILE}")
    print("\n3. Your backup is saved at:")
    print(f"   {BACKUP_FILE}")
    print("\n4. Then start the new server:")
    print("   python3 server.py")

if __name__ == '__main__':
    print("=" * 60)
    print("Time Tracker CSV Converter: UTC → EST")
    print("=" * 60)
    
    try:
        convert_csv()
        print("\n✓ Conversion completed successfully!")
    except FileNotFoundError:
        print(f"\n✗ Error: Could not find {INPUT_FILE}")
        print("Make sure the file path is correct.")
    except Exception as e:
        print(f"\n✗ Error during conversion: {e}")
        import traceback
        traceback.print_exc()
        print("\nYour original file has not been modified.")
        print(f"A backup was saved to: {BACKUP_FILE}")
