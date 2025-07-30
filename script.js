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
    breakTimes: [
        { start: "05:00", end: "07:00", name: "Nap break" },
        { start: "09:00", end: "10:00", name: "Free Time" },
        { start: "13:00", end: "14:00", name: "Free Time" }, // 1 PM is 13:00
        { start: "17:00", end: "19:00", name: "Coading Lessons" }, // 5 PM is 17:00, 7 PM is 19:00
        { start: "19:00", end: "00:30", name: "Resting Break" } // 7 PM is 19:00, 12:30 AM next day is 00:30
    ],
    colors: {
        section1Bg: '#f0f0f0',
        section2Bg: '#e0e0e0',
        textColor: '#333333',
        borderColor: '#cccccc',
        taskSpecific: {} // { taskId: "hexColor" }
    },
    // UPDATED: Properties to save current session state for "offline" tracking
    currentTaskIndex: -1,
    currentTaskStartTime: 0, // Timestamp when the current task last started/resumed (0 if not running)
    accumulatedTimeBeforeLastStart: 0, // Time accumulated before currentTaskStartTime
    isPaused: false // Indicates if the user manually paused the timer
};

// --- Global State Variables ---
let tasks = [];
let currentTaskIndex = -1;
let breakCheckIntervalId = null;
let elapsedTime = 0; // Calculated on the fly now, not incremented by setInterval
let currentTaskStartTime = 0; // Tracks the JS timestamp when the current segment of the task began
let accumulatedTimeBeforeLastStart = 0; // Sum of all previous segments for the current task
let isPaused = false; // Indicates if the task timer is manually paused by the user
let blinkIntervalId = null;
let settings = {};

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
const resetAllDataBtn = document.getElementById('reset-all-data-btn');
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
 * Calculates the current elapsed time for the active task based on timestamps.
 * This is now the core way `elapsedTime` is determined.
 */
function calculateElapsedTime() {
    if (isPaused || currentTaskIndex === -1 || isCurrentlyInBreak || currentTaskStartTime === 0) {
        // If manually paused, no task, in break, or no start time recorded,
        // elapsed time is just the accumulated time from previous segments.
        return accumulatedTimeBeforeLastStart;
    }
    // If running, calculate time passed since currentTaskStartTime and add to accumulated.
    return (Date.now() - currentTaskStartTime) + accumulatedTimeBeforeLastStart;
}


/**
 * Saves current state (tasks and settings, including current timer state) to localStorage.
 */
function saveState() {
    // Before saving settings, update them with the current timer state
    settings.currentTaskIndex = currentTaskIndex;
    settings.currentTaskStartTime = currentTaskStartTime;
    settings.accumulatedTimeBeforeLastStart = accumulatedTimeBeforeLastStart;
    settings.isPaused = isPaused;

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
        // Load persisted current task state
        currentTaskIndex = settings.currentTaskIndex !== undefined ? settings.currentTaskIndex : -1;
        currentTaskStartTime = settings.currentTaskStartTime !== undefined ? settings.currentTaskStartTime : 0;
        accumulatedTimeBeforeLastStart = settings.accumulatedTimeBeforeLastStart !== undefined ? settings.accumulatedTimeBeforeLastStart : 0;
        isPaused = settings.isPaused !== undefined ? settings.isPaused : false;
    } else {
        // Deep copy default settings
        Object.assign(settings, JSON.parse(JSON.stringify(INITIAL_DEFAULT_SETTINGS)));
        currentTaskIndex = settings.currentTaskIndex;
        currentTaskStartTime = settings.currentTaskStartTime;
        accumulatedTimeBeforeLastStart = settings.accumulatedTimeBeforeLastStart;
        isPaused = settings.isPaused;
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

            // When entering break, stop task timer effectively by updating accumulated time
            // Only capture if a task was actively running and not manually paused
            if (currentTaskIndex !== -1 && !isPaused && currentTaskStartTime !== 0) {
                accumulatedTimeBeforeLastStart = calculateElapsedTime(); // Store the current time
                currentTaskStartTime = 0; // Reset start time, indicates not actively counting
                console.log("Entering break. Task timer paused at:", formatTime(accumulatedTimeBeforeLastStart));
            } else {
                console.log("Entering break. Task was already paused or no task selected.");
            }

            updateBlinkEffect(); // Update blinking state immediately
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

            console.log("Exiting break. Resuming timer logic.");
            // If the task was NOT manually paused, resume its timing by setting a new start timestamp
            if (currentTaskIndex !== -1 && !isPaused) {
                currentTaskStartTime = Date.now(); // Start counting from now
                console.log("Task was not manually paused. Timer resuming from accumulated:", formatTime(accumulatedTimeBeforeLastStart));
            } else {
                console.log("Task was manually paused or no task selected. Timer will remain frozen until unpaused.");
            }
            
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

            updateBlinkEffect(); // Re-apply blink settings
        }

        // Always update displayed time based on current state (even if paused or no task)
        elapsedTime = calculateElapsedTime();
        clockDisplay.textContent = formatTime(elapsedTime);
        // console.log("Displaying current calculated elapsed time:", formatTime(elapsedTime)); // Too noisy for continuous display
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
    if (!isPaused && currentTaskIndex !== -1 && !isCurrentlyInBreak) {
        accumulatedTimeBeforeLastStart = calculateElapsedTime(); // Capture current elapsed time
        currentTaskStartTime = 0; // Stop live tracking by resetting start time
        console.log("Manual Pause: Task timer paused at:", formatTime(accumulatedTimeBeforeLastStart));
    } else if (currentTaskIndex === -1) {
        console.log("Manual Pause: No task selected, nothing to pause.");
    } else if (isCurrentlyInBreak) {
        console.log("Manual Pause: Already in break, task timer is implicitly paused.");
    }

    isPaused = true; // Mark as paused
    updateBlinkEffect(); // Update blinking state immediately
    currentTaskNameDisplay.style.opacity = '1'; // Ensure visible when paused
    saveState(); // Save state on pause
}

/**
 * Resumes the current task timer.
 */
function resumeTimer() {
    if (isPaused && currentTaskIndex !== -1 && !isCurrentlyInBreak) {
        currentTaskStartTime = Date.now(); // Start live tracking from now
        isPaused = false; // Mark as running
        console.log("Resume: Task timer resumed from:", formatTime(accumulatedTimeBeforeLastStart));
        updateBlinkEffect(); // Re-apply blinking
        saveState(); // Save state on resume
    } else if (isCurrentlyInBreak) {
        console.log("Resume: Cannot resume, currently in break.");
    } else if (currentTaskIndex === -1) {
        console.log("Resume: No task selected, cannot resume.");
    }
    updateMainDisplay(); // Force display update
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
    // Before switching, ensure time for the PREVIOUS task is correctly accumulated
    if (currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
        const prevTask = tasks[currentTaskIndex];
        const prevTaskSessionTime = calculateElapsedTime(); // Get current calculated time for prev task
        prevTask.totalTime += prevTaskSessionTime; // Add to total
        console.log(`Previous task "${prevTask.name}" accumulated total time: ${formatTime(prevTask.totalTime)} (session: ${formatTime(prevTaskSessionTime)})`);
    }

    currentTaskIndex = index;
    const newTask = tasks[currentTaskIndex];

    if (newTask) {
        currentTaskNameDisplay.textContent = newTask.name;
        currentTaskNameDisplay.style.color = settings.colors.textColor;
        if (settings.colors.taskSpecific[newTask.id]) {
            currentTaskNameDisplay.style.color = settings.colors.taskSpecific[newTask.id];
        }

        bestRecordDisplay.textContent = newTask.bestRecord === Infinity ? '--:--:--' : formatTime(newTask.bestRecord);
        console.log(`Setting current task to: "${newTask.name}". Its best record is: ${bestRecordDisplay.textContent}`);
        
        // Initialize for NEW task session
        accumulatedTimeBeforeLastStart = 0; // New task starts fresh for its current session
        currentTaskStartTime = Date.now(); // Start counting from now for this new task
        isPaused = false; // Assume new task starts unpaused

        updateMainDisplay(); // Force an immediate display update
        saveState(); // Save state after task switch
    } else {
        // No task selected (e.g., after all tasks removed or reset)
        currentTaskNameDisplay.textContent = "No Task Selected";
        bestRecordDisplay.textContent = "--:--:--";
        console.log("No task selected. Best record display set to --:--:--");
        
        // Reset timer values
        accumulatedTimeBeforeLastStart = 0;
        currentTaskStartTime = 0;
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
            color: '#ffffff'
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

    // Capture the time for the *current* task before asking for confirmation or switching.
    // This is the session time for the task that's just finishing/switching.
    const currentSessionTime = calculateElapsedTime();
    
    // Temporarily pause timer calculation logic to present the confirmation.
    // We update accumulatedTimeBeforeLastStart to freeze the time for now.
    accumulatedTimeBeforeLastStart = currentSessionTime;
    currentTaskStartTime = 0; // Stop live tracking
    isPaused = true; // Make sure the timer doesn't run during the confirmation dialog.

    const taskToUpdate = tasks[currentTaskIndex]; // Reference to the task that was just active

    console.log(`--- Handling Next Task ---`);
    console.log(`Task: "${taskToUpdate.name}", Current Session Time (before dialog): ${formatTime(currentSessionTime)}`);
    console.log(`Previous Best Record for "${taskToUpdate.name}": ${formatTime(taskToUpdate.bestRecord)}`);

    const isCompleted = confirm("Is the current task completed?");

    if (isCompleted) {
        // Mark current task as completed
        taskToUpdate.completed = true;
        taskToUpdate.totalTime += currentSessionTime; // Add current session time to total

        // Update best record IF this session's time is better
        if (currentSessionTime > 0 && (currentSessionTime < taskToUpdate.bestRecord || taskToUpdate.bestRecord === Infinity)) {
            taskToUpdate.bestRecord = currentSessionTime;
            console.log(`Updated Best Record for "${taskToUpdate.name}" to: ${formatTime(taskToUpdate.bestRecord)}`);
        } else {
            console.log(`Best Record for "${taskToUpdate.name}" not updated (current time not better or 0).`);
        }

        // Move completed task to the bottom of the list
        const [completedTask] = tasks.splice(currentTaskIndex, 1);
        tasks.push(completedTask);

        // Determine the next task index
        const nextIndex = (currentTaskIndex < tasks.length) ? currentTaskIndex : 0;
        setCurrentTask(nextIndex); // This will initiate the new task's timer.

    } else {
        // If not completed, just accumulate time and move to next task
        taskToUpdate.totalTime += currentSessionTime;
        taskToUpdate.completed = false; // Ensure it's not marked completed if user chose not to
        console.log(`Task "${taskToUpdate.name}" not marked completed. Total time accumulated.`);

        const nextIndex = (currentTaskIndex + 1) % tasks.length;
        setCurrentTask(nextIndex); // This will initiate the new task's timer.
    }
    saveState(); // Save state after task switch and record update
    renderTaskList(); // Re-render to show new order/status
    console.log(`--- End Next Task Handling ---`);
}

// --- Settings Logic ---

/**
 * Toggles the visibility of the settings modal.
 */
function toggleSettingsModal() {
    if (settingsModal.style.display === 'flex') {
        settingsModal.style.display = 'none';
        // When closing settings, try to resume the timer if not in break
        if (currentTaskIndex !== -1 && !getCurrentBreak()) {
            resumeTimer(); // Attempt to resume if it was running before opening settings
        } else if (currentTaskIndex === -1 || getCurrentBreak()) {
            // If no task selected or currently in break, ensure it remains paused.
            isPaused = true;
            updateMainDisplay(); // Update display immediately
        }
        saveState(); // Save current state when closing settings
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

    // Add event listeners for new remove buttons (since they are dynamically created)
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

    // Blinking should be active if:
    // 1. Not disabled by user settings
    // 2. Not manually paused by the user (i.e., isPaused is false)
    // 3. Not currently in a break
    if (!settings.disableBlink && !isPaused && !isCurrentlyInBreak) {
        currentTaskNameDisplay.classList.add('blinking'); // Add class for CSS animation
        document.documentElement.style.setProperty('--blink-speed', `${settings.blinkSpeed / 1000}s`); // Update CSS variable
    } else {
        currentTaskNameDisplay.classList.remove('blinking');
        currentTaskNameDisplay.style.opacity = '1'; // Ensure visible when not blinking
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

    currentTaskIndex = -1; // Reset to no task
    currentTaskStartTime = 0; // Reset timestamps
    accumulatedTimeBeforeLastStart = 0;
    isPaused = true; // Start in paused state after reset
    isCurrentlyInBreak = false; // Ensure break state is reset
    currentBreakName = '';

    saveState(); // Save the new default state to localStorage

    // Update UI elements
    applyColors();
    updateBlinkEffect();
    renderTaskList();
    renderSettings(); // Re-render settings modal content to show defaults
    setCurrentTask(-1); // This will re-initialize the main clock and best record.

    alert("All data has been reset to default. Please note: tasks have new default IDs.");
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    loadState(); // Loads tasks, settings, currentTaskIndex, and elapsedTime/timestamps from localStorage
    applyColors();
    renderTaskList();

    // Initialize the current task display based on loaded state
    if (tasks.length > 0) {
        // If currentTaskIndex was saved and is a valid index, use it.
        // Otherwise, default to the first task.
        if (currentTaskIndex < 0 || currentTaskIndex >= tasks.length) {
            currentTaskIndex = 0;
            // When defaulting to the first task, assume a fresh start for its timer
            accumulatedTimeBeforeLastStart = 0;
            currentTaskStartTime = Date.now(); // Start tracking from now
            isPaused = false; // Start running by default if a task is available
        } else {
            // If we loaded a valid currentTaskIndex and it was NOT paused,
            // then set currentTaskStartTime to now to resume calculation.
            // If it was paused, currentTaskStartTime will remain 0 (or its last value)
            // and `calculateElapsedTime` will correctly use `accumulatedTimeBeforeLastStart`.
            if (!isPaused && !isCurrentlyInBreak) { // Ensure it wasn't paused *or* in break when closed
                 currentTaskStartTime = Date.now();
                 console.log("App reloaded, resuming timer for task:", tasks[currentTaskIndex].name);
            } else {
                console.log("App reloaded, timer for task:", tasks[currentTaskIndex].name, " remains paused or in break.");
            }
        }
        
        const initialTask = tasks[currentTaskIndex];
        currentTaskNameDisplay.textContent = initialTask.name;
        currentTaskNameDisplay.style.color = settings.colors.taskSpecific[initialTask.id] || settings.colors.textColor;
        bestRecordDisplay.textContent = initialTask.bestRecord === Infinity ? '--:--:--' : formatTime(initialTask.bestRecord);
        
        // Calculate and display elapsed time based on loaded timestamps
        elapsedTime = calculateElapsedTime();
        clockDisplay.textContent = formatTime(elapsedTime);

    } else {
        // No tasks at all (after reset or initial load with no data)
        currentTaskIndex = -1;
        currentTaskNameDisplay.textContent = "No Task Selected";
        bestRecordDisplay.textContent = "--:--:--";
        clockDisplay.textContent = "00:00:00";
        accumulatedTimeBeforeLastStart = 0;
        currentTaskStartTime = 0;
        isPaused = true; // Keep paused as there's nothing to time
    }

    // Apply blinking after initial display setup
    updateBlinkEffect();

    // Start the single, continuous main loop that updates the display and checks for breaks
    startMainLoop();

    // Start real-time clock
    updateRealTimeClock();
    setInterval(updateRealTimeClock, 1000);

    // Attach event listener for the "beforeunload" event to save state before leaving the page
    window.addEventListener('beforeunload', saveState);
});

// Add a pause/resume button (optional, but good for testing and user control)
// You would need to add this button to your HTML if you want to use it:
// <button id="timer-toggle-btn">Pause/Resume Task</button>
// For now, let's just make sure the `pauseTimer` and `resumeTimer` functions are callable.
/*
const timerToggleBtn = document.getElementById('timer-toggle-btn');
if (timerToggleBtn) {
    timerToggleBtn.addEventListener('click', () => {
        if (isPaused) {
            resumeTimer();
        } else {
            pauseTimer();
        }
    });
}
*/

nextTaskBtn.addEventListener('click', handleNextTask);
addTaskBtn.addEventListener('click', addTask);
newTaskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addTask();
    }
});

settingsBtn.addEventListener('click', toggleSettingsModal);
closeModalBtn.addEventListener('click', toggleSettingsModal);
window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
        toggleSettingsModal();
    }
});

addBreakTimeBtn.addEventListener('click', () => {
    settings.breakTimes.push({ start: '09:00', end: '10:00', name: 'New Break' });
    renderBreakTimes();
    saveState();
});

breakTimesContainer.addEventListener('change', (e) => {
    const target = e.target;
    if (target.classList.contains('break-name') || target.classList.contains('break-start') || target.classList.contains('break-end')) {
        const parentDiv = target.closest('.break-time-entry');
        if (parentDiv) {
            const index = Array.from(breakTimesContainer.children).indexOf(parentDiv);
            if (index !== -1) {
                settings.breakTimes[index].name = parentDiv.querySelector('.break-name').value.trim();
                settings.breakTimes[index].start = parentDiv.querySelector('.break-start').value;
                settings.breakTimes[index].end = parentDiv.querySelector('.break-end').value;
                saveState();
                updateMainDisplay(); // Re-evaluate break status
            }
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
    saveState();
    toggleSettingsModal();
});

saveTaskOrderBtn.addEventListener('click', saveTaskOrder);

resetAllDataBtn.addEventListener('click', resetToDefault);