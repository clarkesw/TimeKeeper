from flask import Flask, request, jsonify, render_template
import csv
import os
from datetime import datetime
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