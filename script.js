// --- Initial Default Values (Constants) ---
// These are used for initial load if no data exists, and for the reset function.
const INITIAL_DEFAULT_TASKS = [
    { id: crypto.randomUUID(), name: "Narrator", totalTime: 0, bestRecord: Infinity, completed: false, color: '#f0f4c3' },
    { id: crypto.randomUUID(), name: "AZfoot 11", totalTime: 0, bestRecord: Infinity, completed: false, color: '#c5e1a5' },
    { id: crypto.randomUUID(), name: "Animal Iq", totalTime: 0, bestRecord: Infinity, completed: false, color: '#a7d9b9' },
    { id: crypto.randomUUID(), name: "Amando Keeps It Raal", totalTime: 0, bestRecord: Infinity, completed: false, color: '#a7d9b9' },
    { id: crypto.randomUUID(), name: "My Twisted Mind", totalTime: 0, bestRecord: Infinity, completed: false, color: '#a7d9b9' }
];

const INITIAL_DEFAULT_SETTINGS = {
    blinkSpeed: 500, // ms
    disableBlink: false,
    breakTimes: [], // [{ start: "HH:MM", end: "HH:MM", name: "Break Name" }]
    colors: {
        section1Bg: '#f0f0f0',
        section2Bg: '#e0e0e0',
        textColor: '#333333',
        borderColor: '#cccccc',
        taskSpecific: {} // { taskId: "hexColor" }
    }
};

// --- Global State Variables ---
let tasks = []; // Array of task objects
let currentTaskIndex = -1; // Index of the currently active task in the 'tasks' array
let breakCheckIntervalId = null; // Interval for constantly checking break status and updating display
let elapsedTime = 0; // Time in milliseconds for the current task
let isPaused = false; // Indicates if the task timer is manually paused by the user
let blinkIntervalId = null;
let settings = {}; // Object to hold user settings

// State variables for break display
let isCurrentlyInBreak = false;
let currentBreakName = '';

// --- DOM Elements ---
const clockDisplay = document.getElementById('clock-display');
const currentTaskNameDisplay = document.getElementById('current-task-name');
const nextTaskBtn = document.getElementById('next-task-btn');
const bestRecordDisplay = document.getElementById('best-record-display');
const taskListUl = document.getElementById('task-list');
const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeModalBtn = settingsModal.querySelector('.close-button');
const blinkSpeedInput = document.getElementById('blink-speed');
const disableBlinkCheckbox = document.getElementById('disable-blink');
const breakTimesContainer = document.getElementById('break-times-container');
const addBreakTimeBtn = document.getElementById('add-break-time-btn');
const bgColorSection1Input = document.getElementById('bg-color-section1');
const bgColorSection2Input = document.getElementById('bg-color-section2');
const textColorInput = document.getElementById('text-color');
const borderColorInput = document.getElementById('border-color');
const taskColorSettingsDiv = document.getElementById('task-color-settings');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingsTaskList = document.getElementById('settings-task-list');
const saveTaskOrderBtn = document.getElementById('save-task-order-btn');
const resetAllDataBtn = document.getElementById('reset-all-data-btn'); // New button
const sectionOne = document.querySelector('.section-one');
const sectionTwo = document.querySelector('.section-two');
const hourHand = document.getElementById('hour-hand');
const minuteHand = document.getElementById('minute-hand');
const secondHand = document.getElementById('second-hand');
const digitalClock = document.getElementById('digital-clock');

// --- Utility Functions ---

/**
 * Formats milliseconds into HH:MM:SS.
 * @param {number} ms - Time in milliseconds.
 * @returns {string} Formatted time string.
 */
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
        .map(unit => String(unit).padStart(2, '0'))
        .join(':');
}

/**
 * Saves current state (tasks and settings) to localStorage.
 */
function saveState() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
    localStorage.setItem('settings', JSON.stringify(settings));
}

/**
 * Loads state from localStorage or initializes with defaults.
 */
function loadState() {
    const savedTasks = localStorage.getItem('tasks');
    const savedSettings = localStorage.getItem('settings');

    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
        // Ensure necessary properties exist for older saves (migration logic)
        tasks = tasks.map(task => ({
            id: task.id || crypto.randomUUID(),
            name: task.name,
            totalTime: task.totalTime || 0,
            bestRecord: task.bestRecord || Infinity,
            completed: task.completed || false,
            color: task.color || '#ffffff'
        }));
    } else {
        // Deep copy default tasks to ensure new IDs are generated and no reference issues
        tasks = JSON.parse(JSON.stringify(INITIAL_DEFAULT_TASKS));
    }

    if (savedSettings) {
        Object.assign(settings, JSON.parse(savedSettings));
        // Ensure break names are present for older saves (migration logic)
        settings.breakTimes = settings.breakTimes.map(bt => ({
            start: bt.start,
            end: bt.end,
            name: bt.name || 'Unnamed Break'
        }));
    } else {
        // Deep copy default settings
        Object.assign(settings, JSON.parse(JSON.stringify(INITIAL_DEFAULT_SETTINGS)));
    }
}

/**
 * Updates the real-time analog and digital clock.
 */
function updateRealTimeClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Calculate rotation angles for analog clock hands
    const hourAngle = (hours % 12 + minutes / 60) * 30; // 360/12 = 30 degrees per hour
    const minuteAngle = (minutes + seconds / 60) * 6; // 360/60 = 6 degrees per minute
    const secondAngle = seconds * 6; // 360/60 = 6 degrees per second

    hourHand.style.transform = `rotate(${hourAngle}deg)`;
    minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
    secondHand.style.transform = `rotate(${secondAngle}deg)`;

    // Format digital clock in 12-hour format
    const hours12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedTime = `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`;
    digitalClock.textContent = formattedTime;
}

// --- Timer and Break Logic ---

/**
 * Checks if current time is within any defined break period.
 * @returns {object | null} The break object if currently in a break, null otherwise.
 */
function getCurrentBreak() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const breakTime of settings.breakTimes) {
        const [startHour, startMinute] = breakTime.start.split(':').map(Number);
        const [endHour, endMinute] = breakTime.end.split(':').map(Number);

        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;

        if (startTotalMinutes < endTotalMinutes) {
            // Normal break within the same day
            if (currentMinutes >= startTotalMinutes && currentMinutes < endTotalMinutes) {
                return breakTime;
            }
        } else {
            // Break crosses midnight (e.g., 23:00 - 01:00)
            if (currentMinutes >= startTotalMinutes || currentMinutes < endTotalMinutes) {
                return breakTime;
            }
        }
    }
    return null; // Not during any break
}

/**
 * Main function called every second to update the display and manage timer state.
 */
function updateMainDisplay() {
    const breakInfo = getCurrentBreak();

    if (breakInfo) {
        // We are in a break
        if (!isCurrentlyInBreak) { // Just entered a break
            isCurrentlyInBreak = true;
            currentBreakName = breakInfo.name;

            // Pause the task timer display effects
            currentTaskNameDisplay.classList.remove('blinking');
            clearInterval(blinkIntervalId);
            currentTaskNameDisplay.style.opacity = '1'; // Ensure visible

            // Update display to show break info
            clockDisplay.textContent = "BREAK";
            currentTaskNameDisplay.textContent = currentBreakName;
            currentTaskNameDisplay.classList.add('on-break');
            clockDisplay.classList.add('on-break');
        }
        // Keep displaying break info (in case it changes)
        clockDisplay.textContent = "BREAK";
        currentTaskNameDisplay.textContent = currentBreakName;

    } else {
        // Not in a break
        if (isCurrentlyInBreak) { // Just exited a break
            isCurrentlyInBreak = false;
            currentBreakName = '';

            // Restore task name display
            if (currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
                currentTaskNameDisplay.textContent = tasks[currentTaskIndex].name;
                currentTaskNameDisplay.style.color = settings.colors.taskSpecific[tasks[currentTaskIndex].id] || settings.colors.textColor;
            } else {
                currentTaskNameDisplay.textContent = "No Task Selected";
            }
            // Remove break styling
            currentTaskNameDisplay.classList.remove('on-break');
            clockDisplay.classList.remove('on-break');

            // IMPORTANT: Immediately update clock display with preserved elapsedTime
            clockDisplay.textContent = formatTime(elapsedTime);

            updateBlinkEffect(); // Re-apply blink settings
        }

        // If a task is active and not manually paused, increment and update its timer
        if (currentTaskIndex !== -1 && !isPaused) {
            elapsedTime += 1000;
            clockDisplay.textContent = formatTime(elapsedTime);
        } else if (currentTaskIndex !== -1 && isPaused) {
             // If paused, ensure current task time is displayed, not break
            clockDisplay.textContent = formatTime(elapsedTime);
        } else {
            // No task selected, not in break, and not timing
            clockDisplay.textContent = "00:00:00";
        }
    }
}

/**
 * Starts the main loop that continuously checks for breaks and updates the display/task timer.
 */
function startMainLoop() {
    if (breakCheckIntervalId) return; // Loop already running
    breakCheckIntervalId = setInterval(updateMainDisplay, 1000);
    updateMainDisplay(); // Initial call to set display immediately
}

/**
 * Pauses the current task timer and stops blinking.
 * This marks the user-intended pause state, which the `updateMainDisplay` respects.
 */
function pauseTimer() {
    isPaused = true; // Mark as paused
    currentTaskNameDisplay.classList.remove('blinking');
    clearInterval(blinkIntervalId); // Stop blinking interval if set
    currentTaskNameDisplay.style.opacity = '1'; // Ensure visible when paused
}

// --- Task Management Logic ---

/**
 * Renders the list of tasks in Section Two.
 */
function renderTaskList() {
    taskListUl.innerHTML = ''; // Clear existing list
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.dataset.taskId = task.id;
        li.dataset.taskIndex = index;
        li.innerHTML = `
            <span>${task.name}</span>
            ${task.completed ? '<span class="task-status">(Completed)</span>' : ''}
        `;
        if (task.completed) {
            li.classList.add('completed');
        }
        if (settings.colors.taskSpecific[task.id]) {
            li.style.backgroundColor = settings.colors.taskSpecific[task.id];
        }
        taskListUl.appendChild(li);
    });
}

/**
 * Selects and sets the current task.
 * @param {number} index - The index of the task to set as current.
 */
function setCurrentTask(index) {
    pauseTimer(); // Mark as paused, the main loop will continue to run but won't increment time immediately.

    // If there was a previous task, record its time
    if (currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
        const prevTask = tasks[currentTaskIndex];
        prevTask.totalTime += elapsedTime;

        // Update best record if this completion was faster
        if (!prevTask.completed && elapsedTime > 0) { // Only update best record if time was recorded
            if (elapsedTime < prevTask.bestRecord || prevTask.bestRecord === Infinity) {
                prevTask.bestRecord = elapsedTime;
            }
        }
        prevTask.completed = false; // Reset completed status when it leaves current task slot
    }

    currentTaskIndex = index;
    const newTask = tasks[currentTaskIndex];

    if (newTask) {
        currentTaskNameDisplay.textContent = newTask.name;
        currentTaskNameDisplay.style.color = settings.colors.textColor; // Reset current task name color
        if (settings.colors.taskSpecific[newTask.id]) {
            currentTaskNameDisplay.style.color = settings.colors.taskSpecific[newTask.id];
        }

        bestRecordDisplay.textContent = newTask.bestRecord === Infinity ? '--:--:--' : formatTime(newTask.bestRecord);
        elapsedTime = 0; // Reset timer for the new task
        clockDisplay.textContent = formatTime(elapsedTime); // Update immediately
        isPaused = false; // Unpause so it can start counting (if not in break)
        updateMainDisplay(); // Force an immediate display update
        saveState(); // Save state after task switch
    } else {
        currentTaskNameDisplay.textContent = "No Task Selected";
        bestRecordDisplay.textContent = "--:--:--";
        elapsedTime = 0;
        clockDisplay.textContent = formatTime(elapsedTime);
        isPaused = true; // No tasks to run, so keep paused
        updateMainDisplay(); // Force an immediate display update
        saveState(); // Save state (e.g., if last task was removed)
    }

    renderTaskList(); // Re-render task list to reflect changes
}

/**
 * Adds a new task to the list.
 */
function addTask() {
    const taskName = newTaskInput.value.trim();
    if (taskName) {
        tasks.push({
            id: crypto.randomUUID(),
            name: taskName,
            totalTime: 0,
            bestRecord: Infinity,
            completed: false,
            color: '#ffffff' // Default color
        });
        newTaskInput.value = '';
        renderTaskList();
        renderSettingsTaskList(); // Update settings list too
        saveState();
        if (currentTaskIndex === -1 && tasks.length === 1) {
            setCurrentTask(0); // If it's the first task, set it as current
        }
    }
}

/**
 * Handles the "Next Task" button click.
 * Asks for completion confirmation, records time, and moves task.
 */
async function handleNextTask() {
    if (currentTaskIndex === -1 || tasks.length === 0) {
        alert("No tasks to switch. Please add a task first.");
        return;
    }

    pauseTimer(); // This will mark isPaused=true. Main loop continues, but elapsedTime won't increment.

    const isCompleted = confirm("Is the current task completed?");

    if (isCompleted) {
        // Mark current task as completed (for visual cue and best record logic)
        tasks[currentTaskIndex].completed = true;
        tasks[currentTaskIndex].totalTime += elapsedTime; // Add current session time
        if (elapsedTime > 0 && (elapsedTime < tasks[currentTaskIndex].bestRecord || tasks[currentTaskIndex].bestRecord === Infinity)) {
             tasks[currentTaskIndex].bestRecord = elapsedTime;
        }

        // Move completed task to the bottom of the list
        const [completedTask] = tasks.splice(currentTaskIndex, 1);
        tasks.push(completedTask);

        // Determine the next task index
        const nextIndex = (currentTaskIndex < tasks.length) ? currentTaskIndex : 0;
        setCurrentTask(nextIndex); // This will unpause isPaused and update display.

    } else {
        // If not completed, just move to next task without marking as completed
        // Still record time spent for the session
        tasks[currentTaskIndex].totalTime += elapsedTime;

        const nextIndex = (currentTaskIndex + 1) % tasks.length;
        setCurrentTask(nextIndex); // This will unpause isPaused and update display.
    }
    saveState();
    renderTaskList(); // Re-render to show new order/status
}

// --- Settings Logic ---

/**
 * Toggles the visibility of the settings modal.
 */
function toggleSettingsModal() {
    if (settingsModal.style.display === 'flex') {
        settingsModal.style.display = 'none';
        // When closing settings, if not currently in a break, and a task is selected, resume timing.
        // We set isPaused to false if a task is active and not in a break.
        if (currentTaskIndex !== -1 && !getCurrentBreak()) {
            isPaused = false;
        }
        updateMainDisplay(); // Force update to show task time if just unpaused
    } else {
        settingsModal.style.display = 'flex';
        // When opening settings, always pause the task timer.
        pauseTimer();
        renderSettings(); // Populate settings fields
        renderSettingsTaskList(); // Populate task list in settings
    }
}

/**
 * Populates settings fields from the `settings` object.
 */
function renderSettings() {
    blinkSpeedInput.value = settings.blinkSpeed;
    disableBlinkCheckbox.checked = settings.disableBlink;

    bgColorSection1Input.value = settings.colors.section1Bg;
    bgColorSection2Input.value = settings.colors.section2Bg;
    textColorInput.value = settings.colors.textColor;
    borderColorInput.value = settings.colors.borderColor;

    applyColors(); // Apply current settings colors

    renderBreakTimes();
    renderTaskColorSettings();
    updateBlinkEffect(); // Re-apply blink settings
}

/**
 * Renders break time inputs in settings.
 */
function renderBreakTimes() {
    breakTimesContainer.innerHTML = '';
    settings.breakTimes.forEach((bt, index) => {
        const div = document.createElement('div');
        div.classList.add('break-time-entry');
        div.innerHTML = `
            <input type="text" class="break-name" placeholder="Break Name" value="${bt.name || ''}">
            <input type="time" class="break-start" value="${bt.start}">
            <span>-</span>
            <input type="time" class="break-end" value="${bt.end}">
            <button class="remove-break-btn" data-index="${index}">Remove</button>
        `;
        breakTimesContainer.appendChild(div);
    });

    // Add event listeners for new remove buttons
    document.querySelectorAll('.remove-break-btn').forEach(button => {
        button.onclick = (e) => {
            const index = parseInt(e.target.dataset.index);
            settings.breakTimes.splice(index, 1);
            renderBreakTimes();
            saveState(); // Save after removing
        };
    });
}

/**
 * Renders the task list for renaming/reordering in settings.
 */
function renderSettingsTaskList() {
    settingsTaskList.innerHTML = '';
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.dataset.taskId = task.id;
        li.draggable = true; // Make tasks draggable
        li.innerHTML = `
            <span class="handle">☰</span>
            <input type="text" value="${task.name}" data-task-id="${task.id}" class="task-name-input">
            <button class="remove-task-btn" data-task-id="${task.id}">Remove</button>
        `;
        settingsTaskList.appendChild(li);
    });

    // Add event listeners for renaming and removing
    settingsTaskList.querySelectorAll('.task-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const taskId = e.target.dataset.taskId;
            const newName = e.target.value.trim();
            const task = tasks.find(t => t.id === taskId);
            if (task && newName) {
                task.name = newName;
                if (currentTaskIndex !== -1 && tasks[currentTaskIndex].id === taskId) {
                    currentTaskNameDisplay.textContent = newName; // Update current task display instantly
                }
                renderTaskList(); // Update main task list
                saveState(); // Save state on name change
            }
        });
    });

    settingsTaskList.querySelectorAll('.remove-task-btn').forEach(button => {
        button.onclick = (e) => {
            const taskIdToRemove = e.target.dataset.taskId;
            const taskIndex = tasks.findIndex(t => t.id === taskIdToRemove);
            if (taskIndex !== -1) {
                if (confirm(`Are you sure you want to remove "${tasks[taskIndex].name}"?`)) {
                    tasks.splice(taskIndex, 1);
                    if (currentTaskIndex === taskIndex) {
                        // If current task is removed, reset
                        currentTaskIndex = -1;
                        setCurrentTask(-1); // Resets display and pauses
                    } else if (currentTaskIndex > taskIndex) {
                        // If a task before current is removed, adjust current index
                        currentTaskIndex--;
                    }
                    renderSettingsTaskList(); // Re-render settings list
                    renderTaskList(); // Re-render main list
                    saveState();
                }
            }
        };
    });

    // --- Drag and Drop for Reordering ---
    let draggedItem = null;

    settingsTaskList.addEventListener('dragstart', (e) => {
        draggedItem = e.target;
        e.dataTransfer.effectAllowed = 'move';
        // Add a small delay to prevent immediate opacity change preventing the drag image
        setTimeout(() => draggedItem.classList.add('dragging'), 0);
    });

    settingsTaskList.addEventListener('dragover', (e) => {
        e.preventDefault(); // Necessary to allow drop
        const afterElement = getDragAfterElement(settingsTaskList, e.clientY);
        const currentDraggable = e.target.closest('li');

        if (currentDraggable && currentDraggable !== draggedItem) {
            if (afterElement == null) {
                settingsTaskList.appendChild(draggedItem);
            } else {
                settingsTaskList.insertBefore(draggedItem, afterElement);
            }
        }
    });

    settingsTaskList.addEventListener('dragend', () => {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: -Infinity }).element;
    }
}

/**
 * Saves the reordered tasks from the settings list.
 */
function saveTaskOrder() {
    const orderedTaskIds = Array.from(settingsTaskList.children).map(li => li.dataset.taskId);
    const newOrderedTasks = orderedTaskIds.map(id => tasks.find(task => task.id === id));

    // Update currentTaskIndex if the current task's position changed
    if (currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
        const currentTaskId = tasks[currentTaskIndex].id;
        currentTaskIndex = newOrderedTasks.findIndex(task => task.id === currentTaskId);
    } else {
        currentTaskIndex = -1; // No task selected, or current was removed
    }

    tasks = newOrderedTasks.filter(Boolean); // Filter out any nulls if a task was somehow not found
    saveState();
    renderTaskList();
    renderSettingsTaskList(); // Re-render to reflect new order
    // Ensure display reflects correct state after reorder
    if(tasks.length > 0 && currentTaskIndex === -1) {
        setCurrentTask(0); // If tasks exist but none selected, select the first
    } else if (tasks.length === 0) {
        setCurrentTask(-1); // No tasks left
    } else {
        updateMainDisplay(); // Just refresh the display without changing task
    }
}

/**
 * Renders task-specific color settings.
 */
function renderTaskColorSettings() {
    taskColorSettingsDiv.innerHTML = '<h4>Task Specific Colors</h4>';
    tasks.forEach(task => {
        const div = document.createElement('div');
        div.innerHTML = `
            <label for="task-color-${task.id}">${task.name}:</label>
            <input type="color" id="task-color-${task.id}" value="${settings.colors.taskSpecific[task.id] || '#ffffff'}" data-task-id="${task.id}"><br>
        `;
        taskColorSettingsDiv.appendChild(div);
    });

    taskColorSettingsDiv.querySelectorAll('input[type="color"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const taskId = e.target.dataset.taskId;
            settings.colors.taskSpecific[taskId] = e.target.value;
            applyColors();
            renderTaskList(); // Update task list background immediately
            // Optionally update current task display if it's the current one
            if (currentTaskIndex !== -1 && tasks[currentTaskIndex].id === taskId) {
                currentTaskNameDisplay.style.color = e.target.value;
            }
            saveState();
        });
    });
}

/**
 * Applies color settings to the UI.
 */
function applyColors() {
    document.documentElement.style.setProperty('--section1-bg-color', settings.colors.section1Bg);
    document.documentElement.style.setProperty('--section2-bg-color', settings.colors.section2Bg);
    document.documentElement.style.setProperty('--text-color', settings.colors.textColor);
    document.documentElement.style.setProperty('--border-color', settings.colors.borderColor);

    // Apply specific color to current task name if set and not on break
    if (!isCurrentlyInBreak && currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
        const currentTask = tasks[currentTaskIndex];
        currentTaskNameDisplay.style.color = settings.colors.taskSpecific[currentTask.id] || settings.colors.textColor;
    }
}

/**
 * Updates the blinking effect based on settings.
 */
function updateBlinkEffect() {
    clearInterval(blinkIntervalId); // Clear any existing blink interval

    if (settings.disableBlink || isPaused || isCurrentlyInBreak) { // If disabled, paused, or on break, stop blinking
        currentTaskNameDisplay.classList.remove('blinking');
        currentTaskNameDisplay.style.opacity = '1'; // Ensure visible
    } else {
        currentTaskNameDisplay.classList.add('blinking'); // Add class for CSS animation
        document.documentElement.style.setProperty('--blink-speed', `${settings.blinkSpeed / 1000}s`); // Update CSS variable
    }
}

/**
 * Resets all application data (tasks, settings, timers) to their initial default states.
 */
function resetToDefault() {
    if (!confirm("Are you sure you want to reset ALL data (tasks, settings, and timers) to their default states? This cannot be undone.")) {
        return;
    }

    // Clear localStorage entries
    localStorage.removeItem('tasks');
    localStorage.removeItem('settings');

    // Reset global state variables by deep copying defaults
    tasks = JSON.parse(JSON.stringify(INITIAL_DEFAULT_TASKS));
    settings = JSON.parse(JSON.stringify(INITIAL_DEFAULT_SETTINGS));

    currentTaskIndex = -1;
    elapsedTime = 0;
    isPaused = true; // Start in paused state after reset
    isCurrentlyInBreak = false; // Ensure break state is reset
    currentBreakName = '';

    saveState(); // Save the new default state to localStorage

    // Update UI elements
    applyColors();
    updateBlinkEffect();
    renderTaskList();
    renderSettings(); // Re-render settings modal content to show defaults
    setCurrentTask(-1); // This will update main clock, task name, and best record to default "No Task Selected" state.

    alert("All data has been reset to default. Please note: tasks have new default IDs.");
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    applyColors();
    updateBlinkEffect();
    renderTaskList();

    // Start the single, continuous main loop that updates the display and checks for breaks
    startMainLoop();

    // Initialize the current task display based on loaded state
    if (tasks.length > 0) {
        if (currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
            // Restore previous current task
            currentTaskNameDisplay.textContent = tasks[currentTaskIndex].name;
            currentTaskNameDisplay.style.color = settings.colors.taskSpecific[tasks[currentTaskIndex].id] || settings.colors.textColor;
            bestRecordDisplay.textContent = tasks[currentTaskIndex].bestRecord === Infinity ? '--:--:--' : formatTime(tasks[currentTaskIndex].bestRecord);
            elapsedTime = 0; // Start fresh for current session for this task
            isPaused = false; // Ensure it starts counting if not already in break
        } else {
            // No task was active, select the first one if tasks exist
            setCurrentTask(0); // This will set isPaused to false and update display
        }
    } else {
        // No tasks at all after load (e.g., first run or previous data corrupted/empty)
        currentTaskNameDisplay.textContent = "No Task Selected";
        bestRecordDisplay.textContent = "--:--:--";
        clockDisplay.textContent = "00:00:00";
        isPaused = true; // Keep paused as there's nothing to time
    }

    // Start real-time clock
    updateRealTimeClock();
    setInterval(updateRealTimeClock, 1000);
});

nextTaskBtn.addEventListener('click', handleNextTask);
addTaskBtn.addEventListener('click', addTask);
newTaskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // Prevent default form submission if any
        addTask();
    }
});

settingsBtn.addEventListener('click', toggleSettingsModal);
closeModalBtn.addEventListener('click', toggleSettingsModal);
window.addEventListener('click', (event) => {
    if (event.target == settingsModal) {
        toggleSettingsModal();
    }
});

// Event delegation for break time inputs (since they are dynamic)
breakTimesContainer.addEventListener('change', (e) => {
    const parentDiv = e.target.closest('.break-time-entry');
    if (parentDiv) {
        const index = Array.from(breakTimesContainer.children).indexOf(parentDiv);
        if (index !== -1) {
            settings.breakTimes[index].name = parentDiv.querySelector('.break-name').value.trim();
            settings.breakTimes[index].start = parentDiv.querySelector('.break-start').value;
            settings.breakTimes[index].end = parentDiv.querySelector('.break-end').value;
            saveState();
            updateMainDisplay(); // Force a display update if break times changed
        }
    }
});

bgColorSection1Input.addEventListener('input', (e) => {
    settings.colors.section1Bg = e.target.value;
    applyColors();
    saveState();
});
bgColorSection2Input.addEventListener('input', (e) => {
    settings.colors.section2Bg = e.target.value;
    applyColors();
    saveState();
});
textColorInput.addEventListener('input', (e) => {
    settings.colors.textColor = e.target.value;
    applyColors();
    saveState();
});
borderColorInput.addEventListener('input', (e) => {
    settings.colors.borderColor = e.target.value;
    applyColors();
    saveState();
});

saveSettingsBtn.addEventListener('click', () => {
    // All settings are saved on input change, but this button can trigger a final save and close
    saveState();
    toggleSettingsModal();
});

saveTaskOrderBtn.addEventListener('click', saveTaskOrder);

// New: Reset All Data button listener
resetAllDataBtn.addEventListener('click', resetToDefault);