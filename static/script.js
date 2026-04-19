let entries = [];
let isRunning = false;
let currentStartTime = null;
let sessionInterval = null;
let currentSessionTasks = new Set(); // Tasks marked during the current session
let todayTaskCounts = {};            // Total press count per task across all saved sessions today

const startBtn = document.getElementById('startBtn');
const endBtn = document.getElementById('endBtn');
const timelineDiv = document.getElementById('timeline');
const totalTimeDiv = document.getElementById('totalTime');
const saveStatusDiv = document.getElementById('saveStatus');
const currentSessionDiv = document.getElementById('currentSession');
const thermometerFill = document.getElementById('thermometerFill');
const goalProgress = document.getElementById('goalProgress');
const notesTextarea = document.getElementById('notesText');
const histogramDiv = document.getElementById('histogram');

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
    console.log('=== Loading checklist states ===');
    
    // Tally how many sessions each task was completed in today
    todayTaskCounts = {};
    entries.forEach(entry => {
        if (entry.type === 'END' && Array.isArray(entry.tasks)) {
            entry.tasks.forEach(task => {
                todayTaskCounts[task] = (todayTaskCounts[task] || 0) + 1;
            });
        }
    });
    console.log('Today task counts:', todayTaskCounts);
    
    // Update all badge displays
    updateAllBadges();
    
    // Enable/disable buttons based on timer state
    updateCheckboxState(isRunning);
    
    // Clear the notes textarea
    if (notesTextarea) {
        notesTextarea.value = '';
        const notesCounter = document.getElementById('notesCounter');
        if (notesCounter) notesCounter.textContent = '0';
    }
    
    console.log('=== Checklist loading complete ===');
}

// Update badge counts on all task buttons
function updateAllBadges() {
    const taskBtns = document.querySelectorAll('.task-btn');
    taskBtns.forEach(btn => {
        const task = btn.dataset.task;
        const count = (todayTaskCounts[task] || 0) + (currentSessionTasks.has(task) ? 1 : 0);
        const badge = btn.querySelector('.task-badge');
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('zero', count === 0);
        }
    });
}

// Function to enable/disable task buttons based on timer state
function updateCheckboxState(enabled) {
    const taskBtns = document.querySelectorAll('.task-btn');
    taskBtns.forEach(btn => {
        if (!enabled) {
            btn.disabled = true;
            btn.classList.remove('active');
        } else {
            // When enabling, only lock buttons already pressed this session
            btn.disabled = currentSessionTasks.has(btn.dataset.task);
            if (currentSessionTasks.has(btn.dataset.task)) {
                btn.classList.add('active');
            }
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
    
    // Load histogram data
    loadHistogram();
    
    console.log('=== loadTodayEntries complete ===');
}

// Load and display 6-day histogram
async function loadHistogram() {
    try {
        const response = await fetch('/load_seven_days');
        const data = await response.json();
        
        if (data.days && data.days.length > 0) {
            renderHistogram(data.days);
        } else {
            histogramDiv.innerHTML = '<div class="histogram-loading">No data available</div>';
        }
    } catch (error) {
        console.error('Error loading histogram:', error);
        histogramDiv.innerHTML = '<div class="histogram-loading">Error loading data</div>';
    }
}

function renderHistogram(days) {
    console.log('=== Rendering histogram ===');
    console.log('Days data:', days);
    
    const maxMs = Math.max(...days.map(d => d.total_ms), GOAL_HOURS * 3600000);
    console.log('Max MS for scaling:', maxMs);
    
    histogramDiv.innerHTML = days.map(day => {
        // Parse date correctly to avoid timezone issues
        // Split the date string and create date in local timezone
        const dateParts = day.date.split('-');
        const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        
        const hours = day.total_ms / 3600000;
        const heightPercent = (day.total_ms / maxMs) * 100;
        
        console.log(`Date: ${day.date}, Total MS: ${day.total_ms}, Hours: ${hours.toFixed(2)}, Height: ${heightPercent.toFixed(1)}%`);
        
        const isToday = day.is_today;
        const metGoal = hours >= GOAL_HOURS;
        
        let barClass = 'histogram-bar';
        if (isToday) {
            barClass += ' today';
        } else if (metGoal) {
            barClass += ' goal-met';
        }
        
        return `
            <div class="histogram-bar-container">
                <div class="histogram-bar-wrapper">
                    <div class="histogram-value">${hours.toFixed(1)}h</div>
                    <div class="${barClass}" style="height: ${Math.max(heightPercent, 3)}%"></div>
                </div>
                <div class="histogram-label-text ${isToday ? 'today' : ''}">${dayName}<br>${monthDay}</div>
            </div>
        `;
    }).join('');
    
    console.log('=== Histogram rendered ===');
}

// Call on page load - wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTodayEntries);
} else {
    loadTodayEntries();
}

// Add event listeners to task buttons
document.addEventListener('DOMContentLoaded', () => {
    const taskBtns = document.querySelectorAll('.task-btn');
    
    taskBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const task = btn.dataset.task;
            currentSessionTasks.add(task);
            btn.classList.add('active');
            btn.disabled = true; // One press per session
            updateAllBadges();
            console.log('Marked task for session:', task);
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

    // Clear session notes for the new session
    if (notesTextarea) {
        notesTextarea.value = '';
        const notesCounter = document.getElementById('notesCounter');
        if (notesCounter) {
            notesCounter.textContent = '0';
        }
    }
    
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
    
    // Merge session tasks into today's running totals before clearing
    currentSessionTasks.forEach(task => {
        todayTaskCounts[task] = (todayTaskCounts[task] || 0) + 1;
    });
    currentSessionTasks.clear();
    startBtn.disabled = false;
    endBtn.disabled = true;
    
    // Disable buttons and update badges
    updateCheckboxState(false);
    updateAllBadges();
    
    // Stop updating the session timer
    if (sessionInterval) {
        clearInterval(sessionInterval);
        sessionInterval = null;
    }
    currentSessionDiv.textContent = '00:00:00';
    updateFavicon(false);
    
    // Update display to recalculate total time
    updateDisplay();
    
    // Reload histogram to show updated data
    loadHistogram();
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
    
    // Build sessions from entries, pairing START with the next END
    for (let i = 0; i < entries.length; i++) {
        if (entries[i].type === 'START') {
            currentStart = entries[i].timestamp;
        } else if (entries[i].type === 'END' && currentStart) {
            sessions.push({
                number: sessionNumber++,
                start: currentStart,
                end: entries[i].timestamp,
                duration: entries[i].timestamp - currentStart,
                tasks: entries[i].tasks || []
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
            tasks: Array.from(currentSessionTasks),
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
        
        const taskTags = session.tasks && session.tasks.length > 0
            ? `<div class="session-tasks">${session.tasks.map(t => `<span class="session-task-tag">${t}</span>`).join('')}</div>`
            : '';
        
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
                ${taskTags}
            </div>
        `;
    }).join('');
}