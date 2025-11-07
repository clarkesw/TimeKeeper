let entries = [];
let isRunning = false;
let currentStartTime = null;
let sessionInterval = null;

const startBtn = document.getElementById('startBtn');
const endBtn = document.getElementById('endBtn');
const entriesDiv = document.getElementById('entries');
const totalTimeDiv = document.getElementById('totalTime');
const statusDiv = document.getElementById('status');
const saveStatusDiv = document.getElementById('saveStatus');
const currentSessionDiv = document.getElementById('currentSession');
const thermometerFill = document.getElementById('thermometerFill');
const goalProgress = document.getElementById('goalProgress');

const GOAL_HOURS = 5;

// Load today's entries on page load
async function loadTodayEntries() {
    try {
        const response = await fetch('/load_today');
        const data = await response.json();
        
        if (data.entries && data.entries.length > 0) {
            entries = data.entries.map(entry => ({
                type: entry.type,
                timestamp: new Date(entry.timestamp)
            }));
            
            // Check if last entry was a START (meaning timer was running)
            const lastEntry = entries[entries.length - 1];
            if (lastEntry.type === 'START') {
                // Timer was running, resume it
                currentStartTime = lastEntry.timestamp;
                isRunning = true;
                startBtn.disabled = true;
                endBtn.disabled = false;
                statusDiv.textContent = 'Timer Running...';
                statusDiv.className = 'status running';
                
                // Start updating the session timer
                sessionInterval = setInterval(updateSessionTime, 1000);
                updateSessionTime();
            }
            
            updateDisplay();
        }
    } catch (error) {
        console.error('Error loading today entries:', error);
    }
}

// Call on page load
loadTodayEntries();

function updateSessionTime() {
    if (currentStartTime) {
        const now = new Date();
        const elapsed = now - currentStartTime;
        
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        currentSessionDiv.textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

async function saveEntry(type, timestamp) {
    try {
        const response = await fetch('/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: type,
                timestamp: timestamp.toISOString()
            })
        });
        
        const result = await response.json();
        if (result.success) {
            showSaveStatus('Saved to Dropbox!', true);
        } else {
            showSaveStatus('Error saving: ' + result.error, false);
        }
    } catch (error) {
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
    statusDiv.textContent = 'Timer Running...';
    statusDiv.className = 'status running';
    
    // Start updating the session timer
    sessionInterval = setInterval(updateSessionTime, 1000);
    updateSessionTime();
    
    updateDisplay();
});

endBtn.addEventListener('click', async () => {
    const now = new Date();
    entries.push({
        type: 'END',
        timestamp: now
    });
    
    await saveEntry('END', now);
    
    isRunning = false;
    currentStartTime = null;
    startBtn.disabled = false;
    endBtn.disabled = true;
    statusDiv.textContent = 'Timer Stopped';
    statusDiv.className = 'status stopped';
    
    // Stop updating the session timer
    if (sessionInterval) {
        clearInterval(sessionInterval);
        sessionInterval = null;
    }
    currentSessionDiv.textContent = '00:00:00';
    
    updateDisplay();
});

function updateDisplay() {
    // Update entries list
    if (entries.length === 0) {
        entriesDiv.innerHTML = '<p style="text-align: center; color: #9ca3af;">No entries yet</p>';
    } else {
        entriesDiv.innerHTML = entries.map(entry => {
            const displayTime = entry.timestamp.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            return `
                <div class="entry ${entry.type.toLowerCase()}">
                    <span class="entry-type">${entry.type}</span>
                    <span class="entry-time">${displayTime}</span>
                </div>
            `;
        }).reverse().join('');
    }
    
    // Calculate total time - handle orphaned entries robustly
    let totalMs = 0;
    let currentStart = null;
    
    for (let i = 0; i < entries.length; i++) {
        if (entries[i].type === 'START') {
            currentStart = entries[i].timestamp;
        } else if (entries[i].type === 'END' && currentStart) {
            totalMs += entries[i].timestamp - currentStart;
            currentStart = null;
        }
    }
    
    // Format total time
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    
    totalTimeDiv.textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Update thermometer
    const totalHours = totalMs / 3600000;
    updateThermometer(totalHours);
}
