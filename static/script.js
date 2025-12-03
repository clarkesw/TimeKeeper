let entries = [];
let isRunning = false;
let currentStartTime = null;
let sessionInterval = null;

const startBtn = document.getElementById('startBtn');
const endBtn = document.getElementById('endBtn');
const timelineDiv = document.getElementById('timeline');
const totalTimeDiv = document.getElementById('totalTime');
const saveStatusDiv = document.getElementById('saveStatus');
const currentSessionDiv = document.getElementById('currentSession');
const thermometerFill = document.getElementById('thermometerFill');
const goalProgress = document.getElementById('goalProgress');

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
    
    // Find all CHECK entries for today
    entries.forEach(entry => {
        if (entry.type === 'CHECK' && entry.task) {
            checkboxes.forEach(checkbox => {
                if (checkbox.dataset.task === entry.task) {
                    checkbox.checked = true;
                    checkbox.disabled = true;
                }
            });
        }
    });
}

// Load today's entries on page load
async function loadTodayEntries() {
    console.log('=== loadTodayEntries called ===');
    try {
        const response = await fetch('/load_today');
        const data = await response.json();
        console.log('Received data:', data);
        
        if (data.entries && data.entries.length > 0) {
            entries = data.entries.map(entry => ({
                type: entry.type,
                timestamp: new Date(entry.timestamp),
                task: entry.task || null
            }));
            console.log('Loaded entries:', entries);
            
            // Load checklist states
            loadChecklistStates();
            
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
        } else {
            console.log('No entries found');
            updateFavicon(false);
        }
    } catch (error) {
        console.error('Error loading today entries:', error);
        updateFavicon(false);
    }
    console.log('=== loadTodayEntries complete ===');
}

// Call on page load
loadTodayEntries();

// Add event listeners to checkboxes
document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const task = e.target.dataset.task;
                const now = new Date();
                
                // Add CHECK entry
                entries.push({
                    type: 'CHECK',
                    timestamp: now,
                    task: task
                });
                
                // Save to server
                await saveEntry('CHECK', now, task);
                
                // Disable the checkbox so it can't be unchecked
                e.target.disabled = true;
            }
        });
    });
});

function updateSessionTime() {
    console.log('updateSessionTime called, currentStartTime:', currentStartTime);
    if (currentStartTime) {
        const now = new Date();
        console.log('now:', now);
        const elapsed = now - currentStartTime;
        console.log('elapsed ms:', elapsed);
        
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        console.log('Setting currentSessionDiv to:', timeString);
        currentSessionDiv.textContent = timeString;
        
        // Also update the timeline to show current session duration
        updateTimeline();
    } else {
        console.log('currentStartTime is null/undefined');
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

async function saveEntry(type, timestamp, task = null) {
    try {
        const payload = {
            type: type,
            timestamp: timestamp.toISOString()
        };
        
        if (task) {
            payload.task = task;
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
            if (type === 'CHECK') {
                showSaveStatus(`${task} marked complete!`, true);
            } else {
                showSaveStatus('Saved to Dropbox!', true);
            }
        } else {
            showSaveStatus('Error saving: ' + result.error, false);
        }
    } catch (error) {
        console.error('Save error:', error);
        showSaveStatus('Error: ' + error.message, false);
    }
}

startBtn.addEventListener('click', async () => {
    const now = new Date();
    currentStartTime = now;
    entries.push({
        type: 'START',
        timestamp: now
    });
    
    await saveEntry('START', now);
    
    isRunning = true;
    startBtn.disabled = true;
    endBtn.disabled = false;
    
    // Start updating the session timer
    sessionInterval = setInterval(updateSessionTime, 1000);
    updateSessionTime();
    updateFavicon(true);
    
    updateDisplay();
});

endBtn.addEventListener('click', async () => {
    const now = new Date();
    
    // Add END entry BEFORE changing state
    entries.push({
        type: 'END',
        timestamp: now
    });
    
    // Save to server
    await saveEntry('END', now);
    
    // Now update UI state
    isRunning = false;
    currentStartTime = null;
    startBtn.disabled = false;
    endBtn.disabled = true;
    
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
            currentStart = entries[i].timestamp;
            console.log('  -> Set currentStart');
        } else if (entries[i].type === 'END' && currentStart) {
            const duration = entries[i].timestamp - currentStart;
            totalMs += duration;
            console.log(`  -> Found END, duration: ${duration}ms, totalMs now: ${totalMs}ms`);
            currentStart = null;
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
    console.log('=== updateTimeline called ===');
    console.log('isRunning in updateTimeline:', isRunning);
    console.log('currentStartTime in updateTimeline:', currentStartTime);
    
    if (!timelineDiv) {
        console.error('timelineDiv is null!');
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
    
    console.log('Built sessions:', sessions);
    console.log('currentStart after building sessions:', currentStart);
    
    // Check if there's an active session (only when timer is running)
    if (currentStart && isRunning) {
        console.log('Adding active session');
        sessions.push({
            number: sessionNumber,
            start: currentStart,
            end: null,
            duration: new Date() - currentStart,
            active: true
        });
    } else {
        console.log('NOT adding active session. currentStart:', currentStart, 'isRunning:', isRunning);
    }
    
    if (sessions.length === 0) {
        console.log('No sessions to display');
        timelineDiv.innerHTML = '<p style="text-align: center; color: #9ca3af;">No sessions yet</p>';
        return;
    }
    
    console.log('Rendering', sessions.length, 'sessions');
    
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
    
    console.log('=== updateTimeline complete ===');
}