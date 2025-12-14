let entries = [];
let isRunning = false;
let currentStartTime = null;
let sessionInterval = null;
let currentSessionTasks = new Set(); // Track tasks for current session

const startBtn = document.getElementById('startBtn');
const endBtn = document.getElementById('endBtn');
const timelineDiv = document.getElementById('timeline');
const totalTimeDiv = document.getElementById('totalTime');
const saveStatusDiv = document.getElementById('saveStatus');
const currentSessionDiv = document.getElementById('currentSession');
const thermometerFill = document.getElementById('thermometerFill');
const goalProgress = document.getElementById('goalProgress');
const notesTextarea = document.getElementById('notesText');

const GOAL_HOURS = 5;

// Function to update favicon
function updateFavicon(running) {
    const favicon = document.getElementById('favicon');
    if (favicon) {
        if (running) {
            favicon.href = '/static/favicon-running.png';
        } else {
            favicon.href = '/static/favicon-stopped.png';
        }
    }
}

// Function to load checklist states from entries
function loadChecklistStates() {
    const checkboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
    
    console.log('=== Loading checklist states ===');
    console.log('isRunning:', isRunning);
    console.log('Total entries loaded:', entries.length);
    
    // Find all tasks that have been completed today (from entries array which only contains today's data)
    const completedTasks = new Set();
    
    entries.forEach(entry => {
        if (entry.type === 'END' && entry.tasks && Array.isArray(entry.tasks)) {
            entry.tasks.forEach(task => completedTasks.add(task));
            console.log('Found END entry with tasks:', entry.tasks);
        }
    });
    
    console.log('Completed tasks from today only:', Array.from(completedTasks));
    
    // Update checkboxes based on completed tasks
    checkboxes.forEach(checkbox => {
        const task = checkbox.dataset.task;
        const isCompleted = completedTasks.has(task);
        
        checkbox.checked = isCompleted;
        
        // If completed, permanently disable
        // If not completed, enable only when timer is running
        checkbox.disabled = isCompleted || !isRunning;
        
        console.log(`Task "${task}": completed=${isCompleted}, disabled=${checkbox.disabled}`);
    });
    
    // Clear the notes textarea at the start of each new day
    if (notesTextarea) {
        notesTextarea.value = '';
        const notesCounter = document.getElementById('notesCounter');
        if (notesCounter) {
            notesCounter.textContent = '0';
        }
        console.log('Cleared notes textarea for new day');
    }
    
    console.log('=== Checklist loading complete ===');
}

// Function to enable/disable checkboxes based on timer state
function updateCheckboxState(enabled) {
    const checkboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        // Don't enable if already checked (permanently completed for the day)
        if (checkbox.checked) {
            checkbox.disabled = true;
        } else {
            checkbox.disabled = !enabled;
        }
        
        if (!enabled && !checkbox.checked) {
            // Only reset unchecked items when timer stops
            checkbox.checked = false;
        }
    });
}

// Load today's entries on page load
async function loadTodayEntries() {
    console.log('=== loadTodayEntries called ===');
    try {
        const response = await fetch('/load_today');
        const data = await response.json();
        console.log('Received data from server:', data);
        console.log('Number of entries received:', data.entries ? data.entries.length : 0);
        
        if (data.entries && data.entries.length > 0) {
            entries = data.entries.map(entry => {
                const mappedEntry = {
                    type: entry.type,
                    timestamp: new Date(entry.timestamp)
                };
                
                // Only add tasks property for END entries
                if (entry.type === 'END' && entry.tasks) {
                    mappedEntry.tasks = entry.tasks;
                    console.log('Mapped END entry with tasks:', entry.tasks);
                }
                
                // Add note property if present
                if (entry.note) {
                    mappedEntry.note = entry.note;
                    console.log('Mapped entry with note:', entry.note);
                }
                
                return mappedEntry;
            });
            console.log('Loaded entries into memory:', entries);
            
            // Check if last entry was a START (meaning timer was running)
            const lastEntry = entries[entries.length - 1];
            console.log('Last entry:', lastEntry);
            console.log('Last entry type:', lastEntry.type);
            
            if (lastEntry.type === 'START') {
                console.log('Timer was running, resuming...');
                // Timer was running, resume it
                currentStartTime = lastEntry.timestamp;
                isRunning = true;
                startBtn.disabled = true;
                endBtn.disabled = false;
                
                console.log('isRunning is now:', isRunning);
                console.log('currentStartTime is now:', currentStartTime);
                
                // Update display AFTER setting state
                updateDisplay();
                
                // Start updating the session timer
                sessionInterval = setInterval(updateSessionTime, 1000);
                updateSessionTime();
                updateFavicon(true);
            } else {
                console.log('Timer was stopped');
                // Update display for stopped state
                updateDisplay();
                updateFavicon(false);
            }
            
            // Load checklist states AFTER everything else
            loadChecklistStates();
        } else {
            console.log('No entries found for today');
            entries = []; // Make sure entries is empty
            updateFavicon(false);
            // Still load checklist states to ensure everything is in default state
            loadChecklistStates();
        }
    } catch (error) {
        console.error('Error loading today entries:', error);
        updateFavicon(false);
    }
    console.log('=== loadTodayEntries complete ===');
}

// Call on page load - wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTodayEntries);
} else {
    loadTodayEntries();
}

// Add event listeners to checkboxes
document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const task = e.target.dataset.task;
            if (e.target.checked) {
                currentSessionTasks.add(task);
                console.log('Added task to session:', task);
                // Once checked, immediately disable it
                e.target.disabled = true;
            } else {
                // This shouldn't happen since we disable on check, but just in case
                currentSessionTasks.delete(task);
                console.log('Removed task from session:', task);
            }
            console.log('Current session tasks:', Array.from(currentSessionTasks));
        });
    });
    
    // Add character counter for notes
    const notesCounter = document.getElementById('notesCounter');
    if (notesTextarea && notesCounter) {
        notesTextarea.addEventListener('input', () => {
            notesCounter.textContent = notesTextarea.value.length;
        });
    }
});

function updateSessionTime() {
    if (currentStartTime) {
        const now = new Date();
        const elapsed = now - currentStartTime;
        
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        currentSessionDiv.textContent = timeString;
        
        // Also update the timeline to show current session duration
        updateTimeline();
    }
}

function updateThermometer(totalHours) {
    const percentage = Math.min((totalHours / GOAL_HOURS) * 100, 100);
    thermometerFill.style.height = percentage + '%';
    goalProgress.textContent = Math.round(percentage) + '%';
    
    if (percentage >= 100) {
        thermometerFill.classList.add('goal-reached');
    } else {
        thermometerFill.classList.remove('goal-reached');
    }
}

function showSaveStatus(message, isSuccess) {
    saveStatusDiv.textContent = message;
    saveStatusDiv.className = 'save-status ' + (isSuccess ? 'success' : 'error');
    saveStatusDiv.style.display = 'block';
    
    setTimeout(() => {
        saveStatusDiv.style.display = 'none';
    }, 3000);
}

async function saveEntry(type, timestamp, tasks = null, note = null) {
    try {
        const payload = {
            type: type,
            timestamp: timestamp.toISOString()
        };
        
        if (tasks && tasks.length > 0) {
            payload.tasks = tasks;
        }
        
        if (note) {
            payload.note = note;
        }
        
        console.log('Saving entry:', payload);
        
        const response = await fetch('/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Response data:', result);
        
        if (result.success) {
            showSaveStatus('Saved to Dropbox!', true);
        } else {
            showSaveStatus('Error saving: ' + result.error, false);
        }
    } catch (error) {
        console.error('Save error:', error);
        showSaveStatus('Error: ' + error.message, false);
    }
}

function checkForDuplicateNote(newNote) {
    // Check if any existing entry today has the same note
    for (let i = 0; i < entries.length; i++) {
        if (entries[i].note && entries[i].note === newNote) {
            return true;
        }
    }
    return false;
}

function findNoteToReplace(newNote) {
    // Check if the new note starts with any existing note
    // If so, we'll replace that entry's note
    for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].note && newNote.startsWith(entries[i].note)) {
            return i;
        }
    }
    return -1;
}

startBtn.addEventListener('click', async () => {
    const now = new Date();
    currentStartTime = now;
    currentSessionTasks.clear(); // Clear tasks for new session
    
    entries.push({
        type: 'START',
        timestamp: now
    });
    
    await saveEntry('START', now);
    
    isRunning = true;
    startBtn.disabled = true;
    endBtn.disabled = false;
    
    // Enable checkboxes
    updateCheckboxState(true);
    
    // Start updating the session timer
    sessionInterval = setInterval(updateSessionTime, 1000);
    updateSessionTime();
    updateFavicon(true);
    
    updateDisplay();
});

endBtn.addEventListener('click', async () => {
    const now = new Date();
    
    // Get the tasks that were checked during this session
    const tasksArray = Array.from(currentSessionTasks);
    console.log('Ending session with tasks:', tasksArray);
    
    // Get the note text (trimmed)
    const noteText = notesTextarea ? notesTextarea.value.trim() : '';
    console.log('Note text:', noteText);
    console.log('Note length:', noteText.length);
    
    // Check if this note already exists
    const isDuplicate = checkForDuplicateNote(noteText);
    console.log('Is duplicate note?', isDuplicate);
    
    // Check if new note starts with an existing note (replacement scenario)
    const replaceIndex = findNoteToReplace(noteText);
    console.log('Replace index:', replaceIndex);
    
    // If we found a note to replace, remove it
    if (replaceIndex !== -1 && noteText.length > 0) {
        console.log('Removing old note at index', replaceIndex);
        entries[replaceIndex].note = ''; // Clear the old note
    }
    
    // Add END entry BEFORE changing state
    const endEntry = {
        type: 'END',
        timestamp: now,
        tasks: tasksArray
    };
    
    // Only add note if it's not empty and not a duplicate
    if (noteText.length > 0 && !isDuplicate) {
        endEntry.note = noteText;
    }
    
    entries.push(endEntry);
    
    // Save to server with tasks and note
    await saveEntry('END', now, tasksArray, noteText.length > 0 && !isDuplicate ? noteText : null);
    
    // Now update UI state
    isRunning = false;
    currentStartTime = null;
    currentSessionTasks.clear();
    startBtn.disabled = false;
    endBtn.disabled = true;
    
    // Disable and reset checkboxes
    updateCheckboxState(false);
    
    // Stop updating the session timer
    if (sessionInterval) {
        clearInterval(sessionInterval);
        sessionInterval = null;
    }
    currentSessionDiv.textContent = '00:00:00';
    updateFavicon(false);
    
    // Update display to recalculate total time
    updateDisplay();
});

function updateDisplay() {
    console.log('=== updateDisplay called ===');
    console.log('isRunning:', isRunning);
    console.log('currentStartTime:', currentStartTime);
    console.log('Total entries:', entries.length);
    
    // Calculate total time
    let totalMs = 0;
    let currentStart = null;
    
    for (let i = 0; i < entries.length; i++) {
        console.log(`Entry ${i}: ${entries[i].type} at ${entries[i].timestamp}`);
        if (entries[i].type === 'START') {
            // If there's already a currentStart, this means we have two STARTs in a row
            // Use the most recent START
            if (currentStart) {
                console.log('  -> WARNING: Found START while already started, using new START time');
            }
            currentStart = entries[i].timestamp;
            console.log('  -> Set currentStart');
        } else if (entries[i].type === 'END') {
            if (currentStart) {
                const duration = entries[i].timestamp - currentStart;
                totalMs += duration;
                console.log(`  -> Found END, duration: ${duration}ms, totalMs now: ${totalMs}ms`);
                currentStart = null;
            } else {
                console.log('  -> WARNING: Found END without START, ignoring');
            }
        }
    }
    
    console.log('Final totalMs:', totalMs);
    
    // Format total time
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    
    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    console.log('Setting totalTimeDiv.textContent to:', formattedTime);
    totalTimeDiv.textContent = formattedTime;
    
    // Update thermometer
    const totalHours = totalMs / 3600000;
    console.log('Updating thermometer with hours:', totalHours);
    updateThermometer(totalHours);
    
    // Update timeline
    console.log('Calling updateTimeline()...');
    updateTimeline();
    console.log('=== updateDisplay complete ===');
}

function updateTimeline() {
    if (!timelineDiv) {
        return;
    }
    
    const sessions = [];
    let currentStart = null;
    let sessionNumber = 1;
    
    // Build sessions from entries
    for (let i = 0; i < entries.length; i++) {
        if (entries[i].type === 'START') {
            currentStart = entries[i].timestamp;
        } else if (entries[i].type === 'END' && currentStart) {
            sessions.push({
                number: sessionNumber++,
                start: currentStart,
                end: entries[i].timestamp,
                duration: entries[i].timestamp - currentStart
            });
            currentStart = null;
        }
    }
    
    // Check if there's an active session (only when timer is running)
    if (currentStart && isRunning) {
        sessions.push({
            number: sessionNumber,
            start: currentStart,
            end: null,
            duration: new Date() - currentStart,
            active: true
        });
    }
    
    if (sessions.length === 0) {
        timelineDiv.innerHTML = '<p style="text-align: center; color: #9ca3af;">No sessions yet</p>';
        return;
    }
    
    // Display sessions in reverse order (most recent first)
    timelineDiv.innerHTML = sessions.slice().reverse().map(session => {
        const startTime = session.start.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        
        const endTime = session.end ? session.end.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }) : 'In Progress';
        
        const hours = Math.floor(session.duration / 3600000);
        const minutes = Math.floor((session.duration % 3600000) / 60000);
        const seconds = Math.floor((session.duration % 60000) / 1000);
        const durationStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        return `
            <div class="timeline-session ${session.active ? 'active' : ''}">
                <div class="timeline-header">
                    <span class="session-number">Session ${session.number}</span>
                    <span class="session-duration">${durationStr}</span>
                </div>
                <div class="timeline-times">
                    <div class="timeline-time">
                        <span class="timeline-label start-label">Start:</span>
                        <span>${startTime}</span>
                    </div>
                    <div class="timeline-time">
                        <span class="timeline-label end-label">End:</span>
                        <span>${endTime}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}