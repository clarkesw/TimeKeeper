#!/usr/bin/env python3
"""
Script to migrate November 2024 entries from time_tracker.csv to time_tracker_2024_11.csv
and remove them from the original file.
"""

import csv
import os
from datetime import datetime
import pytz
import shutil

# Configuration
DROPBOX_DIR = "/home/clarke/Dropbox"
OLD_FILE = os.path.join(DROPBOX_DIR, "time_tracker.csv")
NOVEMBER_FILE = os.path.join(DROPBOX_DIR, "time_tracker_2025_11.csv")
BACKUP_FILE = os.path.join(DROPBOX_DIR, "time_tracker_backup.csv")

EST_TZ = pytz.timezone('America/New_York')

def parse_timestamp(timestamp_str):
    """Parse timestamp string and return datetime in EST"""
    if timestamp_str.endswith('Z'):
        # Old UTC format
        dt_utc = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S.%fZ').replace(tzinfo=pytz.utc)
        return dt_utc.astimezone(EST_TZ)
    else:
        try:
            # Try to parse as ISO format with timezone
            if '+' in timestamp_str or timestamp_str.count('-') > 2:
                return datetime.fromisoformat(timestamp_str).astimezone(EST_TZ)
            else:
                # Assume EST if no timezone
                dt_naive = datetime.fromisoformat(timestamp_str)
                return EST_TZ.localize(dt_naive)
        except:
            # Fallback for other formats
            try:
                dt_naive = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S.%f')
                return EST_TZ.localize(dt_naive)
            except:
                dt_naive = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S')
                return EST_TZ.localize(dt_naive)

def migrate_november_entries():
    """Extract November 2024 entries and create monthly file"""
    
    if not os.path.exists(OLD_FILE):
        print(f"Error: {OLD_FILE} not found!")
        return
    
    # Create backup
    print(f"Creating backup: {BACKUP_FILE}")
    shutil.copy2(OLD_FILE, BACKUP_FILE)
    
    november_entries = []
    other_entries = []
    
    # Read all entries and categorize them
    print(f"Reading entries from {OLD_FILE}...")
    with open(OLD_FILE, 'r', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                dt_est = parse_timestamp(row['Timestamp'])
                
                # Check if entry is from November 2024
                if dt_est.year == 2024 and dt_est.month == 11:
                    november_entries.append(row)
                else:
                    other_entries.append(row)
            except Exception as e:
                print(f"Warning: Could not parse row: {row}. Error: {e}")
                other_entries.append(row)  # Keep unparseable entries in original file
    
    print(f"Found {len(november_entries)} November 2024 entries")
    print(f"Found {len(other_entries)} entries from other months")
    
    # Write November entries to new file
    if november_entries:
        print(f"Writing November entries to {NOVEMBER_FILE}...")
        with open(NOVEMBER_FILE, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['Type', 'Timestamp', 'Date', 'Time'])
            writer.writeheader()
            writer.writerows(november_entries)
        print(f"Successfully created {NOVEMBER_FILE}")
    else:
        print("No November 2024 entries found to migrate")
    
    # Update original file with only non-November entries
    if other_entries:
        print(f"Updating {OLD_FILE} with remaining entries...")
        with open(OLD_FILE, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['Type', 'Timestamp', 'Date', 'Time'])
            writer.writeheader()
            writer.writerows(other_entries)
        print(f"Successfully updated {OLD_FILE}")
    else:
        print(f"All entries were from November. {OLD_FILE} would be empty.")
        print(f"Keeping backup at {BACKUP_FILE}")
    
    # Print summary
    print("\n" + "="*60)
    print("MIGRATION SUMMARY")
    print("="*60)
    print(f"Backup created at: {BACKUP_FILE}")
    print(f"November 2024 entries: {len(november_entries)} → {NOVEMBER_FILE}")
    print(f"Other entries remaining: {len(other_entries)} → {OLD_FILE}")
    print("="*60)
    
    if november_entries:
        print("\nFirst few November entries:")
        for entry in november_entries[:5]:
            print(f"  {entry['Type']:5} - {entry['Date']} {entry['Time']}")
        if len(november_entries) > 5:
            print(f"  ... and {len(november_entries) - 5} more")

if __name__ == '__main__':
    print("Time Tracker Migration Script")
    print("="*60)
    print("This script will:")
    print("1. Create a backup of time_tracker.csv")
    print("2. Extract all November 2024 entries")
    print("3. Create time_tracker_2024_11.csv with November entries")
    print("4. Update time_tracker.csv to remove November entries")
    print("="*60)
    
    response = input("\nProceed with migration? (yes/no): ")
    if response.lower() in ['yes', 'y']:
        migrate_november_entries()
        print("\nMigration complete!")
    else:
        print("Migration cancelled.")
