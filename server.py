from flask import Flask, request, jsonify, render_template
import csv
import os
from datetime import datetime, timedelta
import pytz

app = Flask(__name__)

EST = pytz.timezone('America/New_York')

def get_today_filename():
    """Get filename for today's CSV"""
    today = datetime.now(EST)
    month_year = today.strftime('%b_%Y')  # e.g., Dec_2025
    return f'/home/clarke/Dropbox/time_tracker_{month_year}.csv'

def read_csv_from_file(filename):
    """Read CSV file from local filesystem"""
    try:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                return f.read()
        return None
    except Exception as e:
        print(f"Error reading file: {e}")
        return None

def write_csv_to_file(filename, content):
    """Write CSV content to local filesystem"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Successfully wrote to {filename}")
        return True
    except Exception as e:
        print(f"Error writing file: {e}")
        return False

@app.route('/')
def index():
    """Serve the main page"""
    return render_template('index.html')

@app.route('/load_today')
def load_today():
    """Load today's entries from CSV"""
    filename = get_today_filename()
    print(f"Loading from: {filename}")
    content = read_csv_from_file(filename)
    
    # Get today's date in EST
    today = datetime.now(EST).date()
    print(f"Today's date: {today}")
    
    entries = []
    
    if content:
        lines = content.strip().split('\n')
        print(f"Total lines in CSV: {len(lines)}")
        if len(lines) > 1:  # Has header + data
            # Print the header to see column names
            header_line = lines[0]
            print(f"CSV Header: {header_line}")
            
            reader = csv.DictReader(lines)
            for idx, row in enumerate(reader):
                print(f"\n--- Row {idx} ---")
                print(f"Full row: {dict(row)}")
                
                # Parse the date from the CSV
                entry_date_str = row.get('Date', '')
                if entry_date_str:
                    try:
                        entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d').date()
                        
                        # Only include entries from today
                        if entry_date != today:
                            print(f"  Skipping - not today's date")
                            continue
                            
                    except ValueError:
                        print(f"Could not parse date: {entry_date_str}")
                        continue
                
                # Add START/END entries with tasks
                if row['Type'] in ['START', 'END']:
                    entry = {
                        'type': row['Type'],
                        'timestamp': row['Timestamp']
                    }
                    
                    # For END entries, collect which tasks were marked
                    if row['Type'] == 'END':
                        tasks = []
                        task_columns = ['Java Study', 'Code Practice', 'Interview Ques.', 'Business Idea', 'Church Work']
                        for task in task_columns:
                            task_value = row.get(task, '').strip()
                            print(f"  Checking task '{task}': value='{task_value}'")
                            if task_value.lower() == 'x':
                                tasks.append(task)
                                print(f"    -> Added task '{task}' to list")
                        # Always include tasks array for END entries, even if empty
                        entry['tasks'] = tasks
                        if tasks:
                            print(f"Loaded END entry with tasks: {tasks}")
                        else:
                            print(f"Loaded END entry with NO tasks")
                        
                        # Also load the note if present
                        note_value = row.get('Notes', '').strip()
                        if note_value:
                            entry['note'] = note_value
                            print(f"Loaded END entry with note: {note_value}")
                    
                    print(f"Adding entry to list: {entry}")
                    entries.append(entry)
    
    print(f"\nFinal entries list: {entries}")
    print(f"Loaded {len(entries)} entries for today")
    
    result = {'entries': entries}
    print(f"About to return JSON: {result}")
    return jsonify(result)

@app.route('/load_six_days')
def load_six_days():
    """Load time totals for the last 6 days"""
    try:
        today = datetime.now(EST).date()
        filename = get_today_filename()
        
        print(f"\n{'='*60}")
        print(f"Loading 6-day histogram")
        print(f"Today's date: {today}")
        print(f"Reading from file: {filename}")
        print(f"{'='*60}")
        
        content = read_csv_from_file(filename)
        
        if not content:
            print("ERROR: No content found in CSV file!")
            return jsonify({'days': []})
        
        # Dictionary to store total time per day
        day_totals = {}
        
        lines = content.strip().split('\n')
        print(f"Total lines in CSV: {len(lines)}")
        
        if len(lines) <= 1:
            print("ERROR: CSV only has header, no data!")
            return jsonify({'days': []})
        
        reader = csv.DictReader(lines)
        
        # Track sessions per day
        sessions_by_day = {}
        all_dates_found = set()
        
        for idx, row in enumerate(reader):
            entry_date_str = row.get('Date', '')
            if not entry_date_str:
                continue
            
            try:
                entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d').date()
                date_key = entry_date.isoformat()
                all_dates_found.add(date_key)
                
                if date_key not in sessions_by_day:
                    sessions_by_day[date_key] = []
                
                entry_type = row.get('Type', '').strip()
                
                if entry_type == 'START':
                    # Parse timestamp - handle both with and without timezone
                    timestamp_str = row['Timestamp'].strip()
                    try:
                        # Try parsing with timezone info first
                        if timestamp_str.endswith('Z') or '+' in timestamp_str or '-' in timestamp_str[-6:]:
                            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            # Parse as naive datetime and localize to EST
                            if '.' in timestamp_str:
                                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S.%f')
                            else:
                                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S')
                            timestamp = EST.localize(timestamp)
                    except Exception as e:
                        print(f"Error parsing START timestamp '{timestamp_str}': {e}")
                        continue
                    
                    sessions_by_day[date_key].append({
                        'type': 'START',
                        'timestamp': timestamp
                    })
                    
                elif entry_type == 'END':
                    # Parse timestamp - handle both with and without timezone
                    timestamp_str = row['Timestamp'].strip()
                    try:
                        # Try parsing with timezone info first
                        if timestamp_str.endswith('Z') or '+' in timestamp_str or '-' in timestamp_str[-6:]:
                            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            # Parse as naive datetime and localize to EST
                            if '.' in timestamp_str:
                                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S.%f')
                            else:
                                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S')
                            timestamp = EST.localize(timestamp)
                    except Exception as e:
                        print(f"Error parsing END timestamp '{timestamp_str}': {e}")
                        continue
                    
                    sessions_by_day[date_key].append({
                        'type': 'END',
                        'timestamp': timestamp
                    })
                    
            except (ValueError, KeyError) as e:
                print(f"Error parsing row {idx}: {e}, row: {row}")
                continue
        
        print(f"\nAll dates found in CSV: {sorted(all_dates_found)}")
        print(f"Dates with sessions: {sorted(sessions_by_day.keys())}")
        
        # Calculate totals for each day
        for date_key, entries in sessions_by_day.items():
            print(f"\n{'='*60}")
            print(f"Calculating for {date_key}")
            print(f"Total entries: {len(entries)}")
            
            total_ms = 0
            current_start = None
            session_num = 1
            
            for entry in entries:
                if entry['type'] == 'START':
                    current_start = entry['timestamp']
                    print(f"  Session {session_num} START: {current_start}")
                elif entry['type'] == 'END' and current_start:
                    duration = (entry['timestamp'] - current_start).total_seconds() * 1000
                    total_ms += duration
                    print(f"  Session {session_num} END: {entry['timestamp']}")
                    print(f"    Duration: {duration/1000/60:.1f} min | Running total: {total_ms/1000/60:.1f} min")
                    current_start = None
                    session_num += 1
                elif entry['type'] == 'END' and not current_start:
                    print(f"  WARNING: Found END without START at {entry['timestamp']}")
            
            print(f"Final total for {date_key}: {total_ms/1000/60:.1f} minutes ({total_ms/1000/3600:.2f} hours)")
            day_totals[date_key] = total_ms
        
        # Get last 6 days
        result = []
        print(f"\n{'='*60}")
        print("Building result for last 6 days:")
        
        for i in range(5, -1, -1):
            date = today - timedelta(days=i)
            date_key = date.isoformat()
            total_ms = day_totals.get(date_key, 0)
            
            result.append({
                'date': date_key,
                'total_ms': total_ms,
                'is_today': (date == today)
            })
            
            print(f"  {date_key} ({'TODAY' if date == today else 'past'}): {total_ms/1000/3600:.2f} hours")
        
        print(f"{'='*60}\n")
        
        return jsonify({'days': result})
        
    except Exception as e:
        print(f"ERROR in load_six_days: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'days': []}), 500

@app.route('/save', methods=['POST'])
def save():
    """Save a new entry to CSV"""
    try:
        data = request.json
        entry_type = data['type']
        timestamp_str = data['timestamp']
        tasks = data.get('tasks', [])  # Get tasks array (for END entries)
        note = data.get('note', '')  # Get note text (for END entries)
        
        print(f"Received save request: type={entry_type}, tasks={tasks}, note={note}")
        
        # Parse timestamp
        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        timestamp_est = timestamp.astimezone(EST)
        
        filename = get_today_filename()
        print(f"Saving to: {filename}")
        content = read_csv_from_file(filename)
        
        # Define the new fieldnames with task columns and Notes
        fieldnames = ['Type', 'Timestamp', 'Date', 'Time', 'Java Study', 'Code Practice', 'Interview Ques.', 'Business Idea', 'Church Work', 'Notes']
        
        # Read existing rows
        rows = []
        if content:
            lines = content.strip().split('\n')
            if len(lines) > 1:  # Has header + data
                reader = csv.DictReader(lines)
                # Convert existing rows to include new columns
                for row in reader:
                    new_row = {
                        'Type': row.get('Type', ''),
                        'Timestamp': row.get('Timestamp', ''),
                        'Date': row.get('Date', ''),
                        'Time': row.get('Time', ''),
                        'Java Study': row.get('Java Study', ''),
                        'Code Practice': row.get('Code Practice', ''),
                        'Interview Ques.': row.get('Interview Ques.', ''),
                        'Business Idea': row.get('Business Idea', ''),
                        'Church Work': row.get('Church Work', ''),
                        'Notes': row.get('Notes', '')
                    }
                    
                    # If we have a note to save and this row's note matches the beginning of our new note,
                    # clear this row's note (we're replacing it)
                    if note and new_row['Notes'] and note.startswith(new_row['Notes']):
                        print(f"Clearing old note: '{new_row['Notes']}' to be replaced by: '{note}'")
                        new_row['Notes'] = ''
                    
                    rows.append(new_row)
        
        # Prepare new row
        new_row = {
            'Type': entry_type,
            'Timestamp': timestamp_est.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3],  # EST time without Z
            'Date': timestamp_est.strftime('%Y-%m-%d'),
            'Time': timestamp_est.strftime('%H:%M:%S'),
            'Java Study': '',
            'Code Practice': '',
            'Interview Ques.': '',
            'Business Idea': '',
            'Church Work': '',
            'Notes': ''
        }
        
        # If it's an END entry with tasks, mark the task columns with 'x'
        if entry_type == 'END' and tasks:
            print(f"Processing END entry with tasks: {tasks}")
            for task in tasks:
                print(f"Checking task: '{task}'")
                if task in fieldnames:  # Make sure task name matches a column
                    new_row[task] = 'x'
                    print(f"✓ Marked task '{task}' with 'x' on END entry")
                else:
                    print(f"✗ Task '{task}' not found in columns: {fieldnames}")
        
        # If it's an END entry with a note, add it
        if entry_type == 'END' and note:
            print(f"Note received: '{note}'")
            # Check if this exact note already exists in any row
            duplicate_found = False
            for row in rows:
                if row['Notes'] == note:
                    duplicate_found = True
                    print(f"Duplicate note found, not adding: '{note}'")
                    break
            
            if not duplicate_found:
                new_row['Notes'] = note
                print(f"✓ Adding note to END entry: '{note}'")
            else:
                print(f"✗ Skipping duplicate note")
        elif entry_type == 'END':
            print(f"No note provided for END entry")
        
        rows.append(new_row)
        
        # Write back to CSV with all columns
        from io import StringIO
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        
        csv_content = output.getvalue()
        print(f"Writing {len(rows)} rows to file")
        
        success = write_csv_to_file(filename, csv_content)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Failed to write to file'}), 500
            
    except Exception as e:
        print(f"Error in save: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)