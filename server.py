#!/usr/bin/env python3
from flask import Flask, render_template, request, jsonify # Changed import to render_template
import csv
import os
from datetime import datetime
import pytz

app = Flask(__name__, template_folder='Templates')

# Dropbox directory path
DROPBOX_DIR = "/home/clarke/Dropbox"
CSV_FILE = os.path.join(DROPBOX_DIR, "time_tracker.csv")

# Use pytz for timezone handling
EST_TZ = pytz.timezone('America/New_York')

# Removed HTML_TEMPLATE variable

@app.route('/')
def index():
    # Changed to render_template and specifies the file name
    return render_template('index.html')

@app.route('/load_today', methods=['GET'])
def load_today():
    try:
        if not os.path.isfile(CSV_FILE):
            return jsonify({'entries': []})
        
        # Get current EST date
        now_utc = datetime.utcnow().replace(tzinfo=pytz.utc)
        now_est = now_utc.astimezone(EST_TZ)
        today_est = now_est.date()
        today_entries = []
        
        with open(CSV_FILE, 'r', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Parse the timestamp
                timestamp_str = row['Timestamp']
                
                # Handle both old UTC format and new EST format
                if timestamp_str.endswith('Z'):
                    # Old UTC format - convert to EST
                    dt_utc = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S.%fZ').replace(tzinfo=pytz.utc)
                    dt_est = dt_utc.astimezone(EST_TZ)
                else:
                    # Try to parse as ISO format with timezone
                    try:
                        # Remove timezone suffix and parse
                        if '+' in timestamp_str or timestamp_str.count('-') > 2:
                            dt_est = datetime.fromisoformat(timestamp_str).astimezone(EST_TZ)
                        else:
                            # Assume EST if no timezone
                            dt_naive = datetime.fromisoformat(timestamp_str)
                            dt_est = EST_TZ.localize(dt_naive)
                    except:
                        # Fallback
                        dt_naive = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S.%f')
                        dt_est = EST_TZ.localize(dt_naive)
                
                # Check if entry is from today in EST
                if dt_est.date() == today_est:
                    # Return timestamp that JavaScript can parse
                    today_entries.append({
                        'type': row['Type'],
                        'timestamp': dt_est.isoformat()
                    })
        
        return jsonify({'entries': today_entries})
    
    except Exception as e:
        return jsonify({'entries': [], 'error': str(e)})

@app.route('/save', methods=['POST'])
def save_entry():
    try:
        data = request.json
        entry_type = data['type']
        timestamp_iso = data['timestamp']
        
        # Parse the timestamp from the client
        if timestamp_iso.endswith('Z'):
            dt_utc = datetime.strptime(timestamp_iso, '%Y-%m-%dT%H:%M:%S.%fZ').replace(tzinfo=pytz.utc)
        else:
            dt_utc = datetime.fromisoformat(timestamp_iso.replace('+00:00', '')).replace(tzinfo=pytz.utc)
        
        # Convert to EST
        dt_est = dt_utc.astimezone(EST_TZ)
        
        # Create CSV file with headers if it doesn't exist
        file_exists = os.path.isfile(CSV_FILE)
        
        with open(CSV_FILE, 'a', newline='') as f:
            writer = csv.writer(f)
            
            if not file_exists:
                writer.writerow(['Type', 'Timestamp', 'Date', 'Time'])
            
            # Store everything in EST (without timezone suffix for cleaner look)
            timestamp_clean = dt_est.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3]
            
            writer.writerow([
                entry_type,
                timestamp_clean,
                dt_est.strftime('%Y-%m-%d'),
                dt_est.strftime('%H:%M:%S')
            ])
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Ensure Dropbox directory exists
    if not os.path.exists(DROPBOX_DIR):
        print(f"Warning: Dropbox directory {DROPBOX_DIR} does not exist!")
    
    print(f"Time Tracker Server Starting (EST timezone)...")
    print(f"Saving to: {CSV_FILE}")
    print(f"Open your browser to: http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
