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
        if len(lines) > 1:  # Has header + data
            reader = csv.DictReader(lines)
            for row in reader:
                # Parse the date from the CSV
                entry_date_str = row.get('Date', '')
                if entry_date_str:
                    try:
                        entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d').date()
                        
                        # Only include entries from today
                        if entry_date != today:
                            continue
                            
                    except ValueError:
                        print(f"Could not parse date: {entry_date_str}")
                        continue
                
                # Add START/END entries
                if row['Type'] in ['START', 'END']:
                    entries.append({
                        'type': row['Type'],
                        'timestamp': row['Timestamp']
                    })
                
                # Check for completed tasks (any column with 'x')
                for task in ['Java Study', 'Code Practice', 'Business Idea', 'Church Work']:
                    if row.get(task, '').strip().lower() == 'x':
                        entries.append({
                            'type': 'CHECK',
                            'timestamp': row['Timestamp'],
                            'task': task
                        })
    
    print(f"Loaded {len(entries)} entries for today")
    return jsonify({'entries': entries})

@app.route('/save', methods=['POST'])
def save():
    """Save a new entry to CSV"""
    try:
        data = request.json
        entry_type = data['type']
        timestamp_str = data['timestamp']
        task = data.get('task')
        
        print(f"Received save request: type={entry_type}, task={task}")
        
        # Parse timestamp
        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        timestamp_est = timestamp.astimezone(EST)
        
        filename = get_today_filename()
        print(f"Saving to: {filename}")
        content = read_csv_from_file(filename)
        
        # Read existing rows
        rows = []
        if content:
            lines = content.strip().split('\n')
            if len(lines) > 1:  # Has header + data
                reader = csv.DictReader(lines)
                rows = list(reader)
        
        # Prepare new row
        new_row = {
            'Type': entry_type,
            'Timestamp': timestamp_str,
            'Date': timestamp_est.strftime('%Y-%m-%d'),
            'Time': timestamp_est.strftime('%H:%M:%S'),
            'Java Study': '',
            'Code Practice': '',
            'Business Idea': '',
            'Church Work': ''
        }
        
        # If it's a CHECK entry, mark the task column with 'x'
        if entry_type == 'CHECK' and task:
            new_row[task] = 'x'
            print(f"Marking task '{task}' with 'x'")
        
        rows.append(new_row)
        
        # Write back to CSV
        output_lines = []
        fieldnames = ['Type', 'Timestamp', 'Date', 'Time', 'Java Study', 'Code Practice', 'Business Idea', 'Church Work']
        
        # Create CSV string
        from io import StringIO
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        
        csv_content = output.getvalue()
        print(f"Writing {len(rows)} rows to file")
        print(f"CSV content preview:\n{csv_content[:500]}")
        
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