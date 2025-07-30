// --- Initial Default Values (Constants) ---
const INITIAL_DEFAULT_TASKS = [
    { id: crypto.randomUUID(), name: "Narrator", totalTime: 0, bestRecord: Infinity, completed: false, color: '#f0f4c3' },
    { id: crypto.randomUUID(), name: "AZfoot 11", totalTime: 0, bestRecord: Infinity, completed: false, color: '#c5e1a5' },
    { id: crypto.randomUUID(), name: "Animal Iq", totalTime: 0, bestRecord: Infinity, completed: false, color: '#a7d9b9' },
    { id: crypto.randomUUID(), name: "Amando Keeps It Raal", totalTime: 0, bestRecord: Infinity, completed: false, color: '#a7d9b9' },
    { id: crypto.randomUUID(), name: "My Twisted Mind", totalTime: 0, bestRecord: Infinity, completed: false, color: '#a7d9b9' }
];

const INITIAL_DEFAULT_SETTINGS = {
    blinkSpeed: 500,
    disableBlink: false,
    breakTimes: [
        { start: "05:00", end: "07:00", name: "Nap break" },
        { start: "09:00", end: "10:00", name: "Free Time" },
        { start: "13:00", end: "14:00", name: "Free Time" },
        { start: "17:00", end: "19:00", name: "Coading Lessons" },
        { start: "19:00", end: "00:30", name: "Resting Break" }
    ],
    colors: {
        section1Bg: '#f0f0f0',
        section2Bg: '#e0e0e0',
        textColor: '#333333',
        borderColor: '#cccccc',
        taskSpecific: {}
    },
    currentTaskIndex: -1,
    currentTaskStartTime: 0,
    accumulatedTimeBeforeLastStart: 0,
    isPaused: false
};

// --- Global State Variables ---
let tasks = [];
let currentTaskIndex = -1;
let mainLoopIntervalId = null;
let currentTaskStartTime = 0; // Timestamp when the task started (real-world time)
let accumulatedTimeBeforeLastStart = 0; // Time accumulated before pause/resume
let isPaused = false; // Tracks if the user has manually paused the timer
let blinkIntervalId = null;
let settings = {};
let isCurrentlyInBreak = false; // Tracks if the *current real time* is within a defined break period
let currentBreakName = '';

// Global variables for break feature (independent from manual pause)
let breakCountdownIntervalId = null;
let currentBreakInstanceStartMs = 0; // The timestamp when the current active break instance started
let currentBreakInstanceEndMs = 0; // The timestamp when the current active break instance is scheduled to end
let previousMainLoopTime = 0; // Timestamp of the last time updateMainDisplay ran, for accurate deduction

// --- DOM Elements ---
const clockDisplay = document.getElementById('clock-display');
const currentTaskNameDisplay = document.getElementById('current-task-name');
const nextTaskBtn = document.getElementById('next-task-btn');
const timerToggleBtn = document.getElementById('timer-toggle-btn');
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

// New DOM elements for break display
const breakInfoDisplay = document.getElementById('break-info-display');
const breakCountdownName = document.getElementById('break-countdown-name');
const breakCountdownTimer = document.getElementById('break-countdown-timer');
const breakProgressBar = document.getElementById('break-progress-bar');

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
 * Calculates the current raw elapsed time for the active task based on real-world time.
 * This time includes any break periods if the timer is currently running.
 * @returns {number} Elapsed time in milliseconds.
 */
function calculateElapsedTime() {
    // The main clock pauses only if `isPaused` (user's manual pause) is true.
    if (isPaused || currentTaskIndex === -1 || currentTaskStartTime === 0) {
        return accumulatedTimeBeforeLastStart;
    }
    const currentTime = Date.now();
    return currentTime - currentTaskStartTime + accumulatedTimeBeforeLastStart;
}

/**
 * Saves current state to localStorage.
 */
function saveState() {
    settings.currentTaskIndex = currentTaskIndex;
    settings.currentTaskStartTime = currentTaskStartTime;
    settings.accumulatedTimeBeforeLastStart = accumulatedTimeBeforeLastStart;
    settings.isPaused = isPaused; // Save the current manual pause state

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
        tasks = tasks.map(task => ({
            id: task.id || crypto.randomUUID(),
            name: task.name,
            totalTime: task.totalTime || 0,
            bestRecord: task.bestRecord || Infinity,
            completed: task.completed || false,
            color: task.color || '#ffffff'
        }));
    } else {
        tasks = JSON.parse(JSON.stringify(INITIAL_DEFAULT_TASKS));
    }

    if (savedSettings) {
        Object.assign(settings, JSON.parse(savedSettings));
        settings.breakTimes = settings.breakTimes.map(bt => ({
            start: bt.start,
            end: bt.end,
            name: bt.name || 'Unnamed Break'
        }));
        settings.colors.taskSpecific = settings.colors.taskSpecific || {};

        currentTaskIndex = settings.currentTaskIndex !== undefined ? settings.currentTaskIndex : -1;
        currentTaskStartTime = settings.currentTaskStartTime !== undefined ? settings.currentTaskStartTime : 0;
        accumulatedTimeBeforeLastStart = settings.accumulatedTimeBeforeLastStart !== undefined ? settings.accumulatedTimeBeforeLastStart : 0;
        isPaused = settings.isPaused !== undefined ? settings.isPaused : false;
    } else {
        Object.assign(settings, JSON.parse(JSON.stringify(INITIAL_DEFAULT_SETTINGS)));
        currentTaskIndex = settings.currentTaskIndex;
        currentTaskStartTime = settings.currentTaskStartTime;
        accumulatedTimeBeforeLastStart = settings.accumulatedTimeBeforeLastStart;
        isPaused = settings.isPaused;
    }

    previousMainLoopTime = Date.now(); // Set for the first deduction calculation
}

/**
 * Updates the real-time analog and digital clock.
 */
function updateRealTimeClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const hourAngle = (hours % 12 + minutes / 60) * 30;
    const minuteAngle = (minutes + seconds / 60) * 6;
    const secondAngle = seconds * 6;

    hourHand.style.transform = `rotate(${hourAngle}deg)`;
    minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
    secondHand.style.transform = `rotate(${secondAngle}deg)`;

    const hours12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedTime = `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`;
    digitalClock.textContent = formattedTime;
}

// --- Timer and Break Logic ---

/**
 * Checks if current time is within any defined break period.
 * Returns the break object and its specific start/end timestamps for the current day/overnight instance.
 * @returns {{break: object, startMs: number, endMs: number} | null} The break object and its timestamps, or null.
 */
function getCurrentBreak() {
    const now = Date.now();
    const nowObj = new Date(now);
    const todayAtMidnight = new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate()).getTime();

    for (const breakTime of settings.breakTimes) {
        const [startHour, startMinute] = breakTime.start.split(':').map(Number);
        const [endHour, endMinute] = breakTime.end.split(':').map(Number);

        let breakStartCandidateMs = todayAtMidnight + (startHour * 60 + startMinute) * 60 * 1000;
        let breakEndCandidateMs = todayAtMidnight + (endHour * 60 + endMinute) * 60 * 1000;

        // Handle overnight breaks
        if (startHour * 60 + startMinute >= endHour * 60 + endMinute) { // Break crosses midnight
            // If current time is earlier than today's start, it might be the "tomorrow" part of yesterday's break
            if (now < breakStartCandidateMs) {
                // Check if it's after yesterday's start
                const yesterdayStart = breakStartCandidateMs - (24 * 60 * 60 * 1000);
                if (now >= yesterdayStart && now < breakEndCandidateMs) {
                    return { break: breakTime, startMs: yesterdayStart, endMs: breakEndCandidateMs };
                }
            }
            // If current time is after today's start, it means the break ends tomorrow
            breakEndCandidateMs += (24 * 60 * 60 * 1000);
        }

        if (now >= breakStartCandidateMs && now < breakEndCandidateMs) {
            return { break: breakTime, startMs: breakStartCandidateMs, endMs: breakEndCandidateMs };
        }
    }
    return null;
}


/**
 * Updates the break countdown timer and progress bar animation.
 * This runs independently of the task pause state.
 */
function updateBreakCountdown() {
    const now = Date.now();
    const remainingBreakTime = currentBreakInstanceEndMs - now;

    if (remainingBreakTime <= 0) {
        clearInterval(breakCountdownIntervalId);
        breakCountdownTimer.textContent = "00:00:00";
        breakProgressBar.style.width = '0%';
        // The `updateMainDisplay` function will handle the full transition out of break state
        return;
    }

    breakCountdownTimer.textContent = formatTime(Math.max(0, remainingBreakTime));

    const totalDurationOfThisBreakInstance = currentBreakInstanceEndMs - currentBreakInstanceStartMs;
    if (totalDurationOfThisBreakInstance > 0) {
        const progress = Math.max(0, remainingBreakTime / totalDurationOfThisBreakInstance);
        breakProgressBar.style.width = `${progress * 100}%`;
    } else {
        breakProgressBar.style.width = '0%'; // Handle case of instant break (0 duration)
    }
}

/**
 * Main function called frequently to update the display and manage timer state,
 * including break time deduction.
 */
function updateMainDisplay() {
    const now = Date.now();
    const breakResult = getCurrentBreak(); // Contains { break: object, startMs: number, endMs: number } or null

    // --- Break Time Deduction Logic ---
    // Deduction from totalTime only happens if a task is active, *not* manually paused,
    // and currently within a break.
    if (currentTaskIndex !== -1 && !isPaused && isCurrentlyInBreak && tasks[currentTaskIndex] && previousMainLoopTime > 0) {
        const timeElapsedSinceLastTick = now - previousMainLoopTime;
        if (timeElapsedSinceLastTick > 0) {
            const task = tasks[currentTaskIndex];
            task.totalTime = Math.max(0, task.totalTime - timeElapsedSinceLastTick); // Prevent negative time
            // console.log(`Deducting ${formatTime(timeElapsedSinceLastTick)} from task "${task.name}". New net total: ${formatTime(task.totalTime)}`);
        }
    }

    previousMainLoopTime = now; // Update for the next tick's deduction calculation

    // --- Break State Management (Visuals and Transitions) ---

    // Scenario 1: Entering a break
    if (breakResult && !isCurrentlyInBreak) {
        isCurrentlyInBreak = true;
        currentBreakName = breakResult.break.name;
        currentBreakInstanceStartMs = breakResult.startMs;
        currentBreakInstanceEndMs = breakResult.endMs;

        // Visual updates for entering break
        currentTaskNameDisplay.textContent = "BREAK";
        currentTaskNameDisplay.style.opacity = '1';
        currentTaskNameDisplay.classList.add('on-break');
        clockDisplay.classList.add('on-break');

        breakInfoDisplay.style.display = 'block';
        breakCountdownName.textContent = currentBreakName;

        // Start break countdown and animation (runs regardless of task pause state)
        clearInterval(breakCountdownIntervalId);
        breakCountdownIntervalId = setInterval(updateBreakCountdown, 100); // Faster update for smoother bar
        updateBreakCountdown(); // Initial call to set up display immediately

        // Blinking will be controlled by `isPaused`
        updateBlinkEffect();
        console.log(`Entering break "${currentBreakName}".`);
    }
    // Scenario 2: Exiting a break
    else if (!breakResult && isCurrentlyInBreak) { // Just exited a break
        isCurrentlyInBreak = false;
        clearInterval(breakCountdownIntervalId); // Stop break countdown
        breakInfoDisplay.style.display = 'none'; // Hide break elements
        currentBreakInstanceEndMs = 0; // Reset break end time
        currentBreakInstanceStartMs = 0;

        // Restore task display
        currentBreakName = '';
        console.log("Exiting break. Resuming normal timer display.");

        if (currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
            currentTaskNameDisplay.textContent = tasks[currentTaskIndex].name;
            currentTaskNameDisplay.style.color = settings.colors.taskSpecific[tasks[currentTaskIndex].id] || settings.colors.textColor;
        } else {
            currentTaskNameDisplay.textContent = "No Task Selected";
        }
        currentTaskNameDisplay.classList.remove('on-break');
        clockDisplay.classList.remove('on-break');

        // Blinking will be controlled by `isPaused`
        updateBlinkEffect();
    }
    // Scenario 3: Remaining in a break
    // Ensure the countdown continues if it was somehow stopped (e.g. by refresh during a break)
    else if (breakResult && isCurrentlyInBreak && !breakCountdownIntervalId) {
        clearInterval(breakCountdownIntervalId);
        breakCountdownIntervalId = setInterval(updateBreakCountdown, 100);
        updateBreakCountdown();
    }


    // Always update the main clock display based on `isPaused` state
    const elapsedTime = calculateElapsedTime();
    clockDisplay.textContent = formatTime(elapsedTime);
}

/**
 * Starts the main loop that updates the display and manages timer state.
 */
function startMainLoop() {
    if (mainLoopIntervalId) return; // Prevent multiple intervals
    mainLoopIntervalId = setInterval(updateMainDisplay, 1000); // Main display updates every second
    updateMainDisplay(); // Initial call to set up the display immediately
}

/**
 * Pauses the current task timer and stops blinking.
 * This can now be triggered even during a break.
 */
function pauseTimer() {
    if (currentTaskIndex === -1) {
        alert("No task is selected to pause.");
        return;
    }

    if (!isPaused) {
        // When pausing, capture the current raw elapsed time.
        // `totalTime` deduction stops because `isPaused` becomes true.
        accumulatedTimeBeforeLastStart = calculateElapsedTime();
        currentTaskStartTime = 0; // Stop accumulating time from Date.now()
        console.log("Manual Pause: Raw session time paused at:", formatTime(accumulatedTimeBeforeLastStart));
    }
    isPaused = true; // Set the manual pause state
    updateBlinkEffect(); // Blinking will stop if `isPaused` is true
    currentTaskNameDisplay.style.opacity = '1'; // Ensure text is visible when paused
    if (timerToggleBtn) {
        timerToggleBtn.textContent = "Resume Task";
    }
    saveState();
}

/**
 * Resumes the current task timer.
 * This can now be triggered even during a break.
 */
function resumeTimer() {
    if (currentTaskIndex === -1) {
        alert("No task is selected to resume.");
        return;
    }

    if (isPaused) {
        currentTaskStartTime = Date.now(); // Start accumulating time from now
        isPaused = false; // Set the manual resume state
        console.log("Resume: Raw session time resumed from:", formatTime(accumulatedTimeBeforeLastStart));
    }
    updateBlinkEffect(); // Blinking will resume if `isPaused` is false (and not disabled)
    if (timerToggleBtn) {
        timerToggleBtn.textContent = "Pause Task";
    }
    saveState();
    updateMainDisplay(); // Ensure immediate display update
}

// --- Task Management Logic ---

/**
 * Renders the list of tasks in Section Two.
 */
function renderTaskList() {
    taskListUl.innerHTML = '';
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
        // Add click listener for selecting task
        li.addEventListener('click', () => setCurrentTask(index));
        taskListUl.appendChild(li);
    });
}

/**
 * Selects and sets the current task.
 * @param {number} index - The index of the task to set as current.
 */
function setCurrentTask(index) {
    // If there was a previously selected task, its totalTime should already be accurate
    // due to continuous deduction in updateMainDisplay. No manual calculation needed here for previous task.
    if (currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
        console.log(`Switching from task "${tasks[currentTaskIndex].name}". Its net total time is: ${formatTime(tasks[currentTaskIndex].totalTime)}`);
    }

    currentTaskIndex = index;
    const newTask = tasks[currentTaskIndex];

    // Reset break display and state if we're manually setting a task
    if (isCurrentlyInBreak) {
        isCurrentlyInBreak = false; // Force exit break state
        clearInterval(breakCountdownIntervalId);
        breakInfoDisplay.style.display = 'none';
        currentBreakInstanceEndMs = 0;
        currentBreakInstanceStartMs = 0;
        // Restore styling if coming out of break
        currentTaskNameDisplay.classList.remove('on-break');
        clockDisplay.classList.remove('on-break');
    }

    if (newTask) {
        currentTaskNameDisplay.textContent = newTask.name;
        currentTaskNameDisplay.style.color = settings.colors.taskSpecific[newTask.id] || settings.colors.textColor;
        // Update best record display for the NEWLY selected task
        bestRecordDisplay.textContent = newTask.bestRecord === Infinity ? '--:--:--' : formatTime(newTask.bestRecord);
        accumulatedTimeBeforeLastStart = newTask.totalTime; // Load task's current net total time for raw clock display
        currentTaskStartTime = Date.now(); // Start tracking raw time from now
        isPaused = false; // New task starts unpaused by default
        console.log(`Started task "${newTask.name}" at:`, new Date(currentTaskStartTime).toLocaleString());
        if (timerToggleBtn) { timerToggleBtn.textContent = "Pause Task"; timerToggleBtn.disabled = false;}
    } else {
        currentTaskNameDisplay.textContent = "No Task Selected";
        bestRecordDisplay.textContent = "--:--:--";
        clockDisplay.textContent = "00:00:00"; // Reset main clock
        accumulatedTimeBeforeLastStart = 0;
        currentTaskStartTime = 0;
        isPaused = true; // No task selected means timer is paused
        if (timerToggleBtn) { timerToggleBtn.textContent = "Resume Task"; timerToggleBtn.disabled = true; } // Disable when no task
    }

    renderTaskList();
    updateMainDisplay(); // Force update immediately
    updateBlinkEffect(); // Update blinking based on new task state
    saveState();
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
            color: '#ffffff' // Default color for new tasks
        });
        newTaskInput.value = '';
        renderTaskList();
        renderSettingsTaskList(); // Also update settings task list
        saveState();
        if (currentTaskIndex === -1 && tasks.length === 1) {
            setCurrentTask(0); // Automatically select the first task if none selected
        }
    }
}

/**
 * Handles the "Next Task" button click.
 */
async function handleNextTask() {
    if (currentTaskIndex === -1 || tasks.length === 0) {
        alert("No tasks to switch. Please add a task first.");
        return;
    }

    const taskToUpdate = tasks[currentTaskIndex];
    // `taskToUpdate.totalTime` already holds the net time after deductions by `updateMainDisplay`.
    const finalNetTimeForCurrentTask = taskToUpdate.totalTime;

    console.log(`--- Handling Next Task ---`);
    console.log(`Task: "${taskToUpdate.name}", Final Net Time: ${formatTime(finalNetTimeForCurrentTask)}`);

    const isCompleted = confirm("Is the current task completed?");

    if (isCompleted) {
        taskToUpdate.completed = true;
        // Best record should be based on the *net* working time.
        if (finalNetTimeForCurrentTask > 0 && (finalNetTimeForCurrentTask < taskToUpdate.bestRecord || taskToUpdate.bestRecord === Infinity)) {
            taskToUpdate.bestRecord = finalNetTimeForCurrentTask;
            console.log(`Updated Best Record for "${taskToUpdate.name}" to: ${formatTime(taskToUpdate.bestRecord)}`);
        }
        const [completedTask] = tasks.splice(currentTaskIndex, 1); // Remove from current position
        tasks.push(completedTask); // Add to end of the list

        let nextIndexAfterCompletion;
        if (tasks.length === 0) {
            nextIndexAfterCompletion = -1;
        } else if (currentTaskIndex >= tasks.length) {
            nextIndexAfterCompletion = 0;
        } else {
            nextIndexAfterCompletion = currentTaskIndex;
        }
        setCurrentTask(nextIndexAfterCompletion);

    } else {
        // Task not completed, just switch to next task in sequence (circularly)
        taskToUpdate.completed = false; // Ensure it's not marked completed if not confirmed
        const nextIndex = (currentTaskIndex + 1) % tasks.length;
        setCurrentTask(nextIndex);
    }
    saveState();
    renderTaskList(); // Re-render task list in main view
}

// --- Settings Logic ---

/**
 * Toggles the visibility of the settings modal.
 * The timer will continue running when the settings modal is open.
 */
function toggleSettingsModal() {
    if (settingsModal.style.display === 'flex') {
        settingsModal.style.display = 'none';
        // When closing, simply update the display to reflect any changes made in settings
        // and ensure the timer is running/paused based on user's manual choice.
        updateMainDisplay();
        saveState();
    } else {
        settingsModal.style.display = 'flex';
        // DO NOT CALL pauseTimer() here. Timer continues to run.
        renderSettings();
        renderSettingsTaskList();
    }
}

/**
 * Populates settings fields from the settings object.
 */
function renderSettings() {
    blinkSpeedInput.value = settings.blinkSpeed;
    disableBlinkCheckbox.checked = settings.disableBlink;

    bgColorSection1Input.value = settings.colors.section1Bg;
    bgColorSection2Input.value = settings.colors.section2Bg;
    textColorInput.value = settings.colors.textColor;
    borderColorInput.value = settings.colors.borderColor;

    applyColors();
    renderBreakTimes();
    renderTaskColorSettings();
    updateBlinkEffect(); // Update blinking based on new settings
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

    document.querySelectorAll('.remove-break-btn').forEach(button => {
        button.onclick = (e) => {
            const index = parseInt(e.target.dataset.index);
            settings.breakTimes.splice(index, 1);
            renderBreakTimes();
            saveState();
            updateMainDisplay(); // Re-evaluate break status immediately
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
        li.draggable = true;
        li.innerHTML = `
            <span class="handle">☰</span>
            <input type="text" value="${task.name}" data-task-id="${task.id}" class="task-name-input">
            <button class="remove-task-btn" data-task-id="${task.id}">Remove</button>
        `;
        settingsTaskList.appendChild(li);
    });

    settingsTaskList.querySelectorAll('.task-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const taskId = e.target.dataset.taskId;
            const newName = e.target.value.trim();
            const task = tasks.find(t => t.id === taskId);
            if (task && newName) {
                task.name = newName;
                if (currentTaskIndex !== -1 && tasks[currentTaskIndex].id === taskId) {
                    currentTaskNameDisplay.textContent = newName;
                }
                renderTaskList(); // Update main task list display
                saveState();
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
                    // Adjust currentTaskIndex if the removed task affects it
                    if (currentTaskIndex === taskIndex) {
                        currentTaskIndex = -1; // Current task removed, set to none
                        setCurrentTask(-1);
                    } else if (currentTaskIndex > taskIndex) {
                        currentTaskIndex--; // A task before current was removed, shift index down
                    }
                    renderSettingsTaskList();
                    renderTaskList(); // Update main task list display
                    saveState();
                }
            }
        };
    });

    let draggedItem = null;

    settingsTaskList.addEventListener('dragstart', (e) => {
        draggedItem = e.target;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => draggedItem.classList.add('dragging'), 0);
    });

    settingsTaskList.addEventListener('dragover', (e) => {
        e.preventDefault();
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

    // Preserve currentTaskIndex if the current task still exists in the new order
    if (currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
        const currentTaskId = tasks[currentTaskIndex].id;
        currentTaskIndex = newOrderedTasks.findIndex(task => task.id === currentTaskId);
    } else {
        currentTaskIndex = -1; // No task selected or current task was removed
    }

    tasks = newOrderedTasks.filter(Boolean); // Filter out any undefineds if task was removed elsewhere
    saveState();
    renderTaskList();
    renderSettingsTaskList();
    if (tasks.length > 0 && currentTaskIndex === -1) {
        setCurrentTask(0); // If tasks exist but none selected, set first one
    } else if (tasks.length === 0) {
        setCurrentTask(-1); // No tasks left
    } else {
        updateMainDisplay(); // Ensure display is updated if task order changed but current task remains
    }
}

/**
 * Renders task-specific color settings.
 */
function renderTaskColorSettings() {
    taskColorSettingsDiv.innerHTML = '<h4>Task Specific Colors</h4>';
    if (tasks.length === 0) {
        taskColorSettingsDiv.innerHTML += '<p>No tasks to customize colors for. Add tasks first.</p>';
        return;
    }
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
            applyColors(); // Apply colors across the app
            renderTaskList(); // Update main task list to reflect new colors
            if (currentTaskIndex !== -1 && tasks[currentTaskIndex].id === taskId) {
                currentTaskNameDisplay.style.color = e.target.value; // Update current task display color
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

    // Apply color to current task name display only if not in a break (break has its own color)
    if (!isCurrentlyInBreak && currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
        const currentTask = tasks[currentTaskIndex];
        currentTaskNameDisplay.style.color = settings.colors.taskSpecific[currentTask.id] || settings.colors.textColor;
    }
}

/**
 * Updates the blinking effect based on settings.
 */
function updateBlinkEffect() {
    clearInterval(blinkIntervalId); // Clear any existing interval

    // Blinking only happens when not disabled and not manually paused
    // It will still blink during a break IF the timer is running and not manually paused.
    if (!settings.disableBlink && !isPaused) {
        currentTaskNameDisplay.classList.add('blinking');
        document.documentElement.style.setProperty('--blink-speed', `${settings.blinkSpeed / 1000}s`);
    } else {
        currentTaskNameDisplay.classList.remove('blinking');
        currentTaskNameDisplay.style.opacity = '1'; // Ensure text is fully visible when not blinking
    }
}

/**
 * Resets all application data to initial defaults.
 */
function resetToDefault() {
    if (!confirm("Are you sure you want to reset ALL data (tasks, settings, and timers) to their default states? This cannot be undone.")) {
        return;
    }

    localStorage.removeItem('tasks');
    localStorage.removeItem('settings');

    tasks = JSON.parse(JSON.stringify(INITIAL_DEFAULT_TASKS));
    settings = JSON.parse(JSON.stringify(INITIAL_DEFAULT_SETTINGS));

    currentTaskIndex = -1;
    currentTaskStartTime = 0;
    accumulatedTimeBeforeLastStart = 0;
    isPaused = true;
    isCurrentlyInBreak = false;
    currentBreakName = '';
    currentBreakInstanceStartMs = 0;
    currentBreakInstanceEndMs = 0;
    previousMainLoopTime = 0;

    clearInterval(breakCountdownIntervalId); // Stop break countdown
    breakInfoDisplay.style.display = 'none'; // Hide break display elements

    saveState();
    applyColors();
    updateBlinkEffect();
    renderTaskList();
    renderSettings(); // Re-render settings after reset
    setCurrentTask(-1); // Set to no task initially after reset

    alert("All data has been reset to default.");
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    applyColors();
    renderTaskList();

    // Initial setup for the main task display based on loaded state
    if (tasks.length > 0) {
        if (currentTaskIndex < 0 || currentTaskIndex >= tasks.length) {
            currentTaskIndex = 0; // Default to first task if index is invalid
            accumulatedTimeBeforeLastStart = tasks[0].totalTime; // Load its total time
            currentTaskStartTime = Date.now(); // Start new session
            isPaused = false;
        }

        const initialTask = tasks[currentTaskIndex];
        currentTaskNameDisplay.textContent = initialTask.name;
        currentTaskNameDisplay.style.color = settings.colors.taskSpecific[initialTask.id] || settings.colors.textColor;
        bestRecordDisplay.textContent = initialTask.bestRecord === Infinity ? '--:--:--' : formatTime(initialTask.bestRecord);
    } else {
        currentTaskIndex = -1;
        currentTaskNameDisplay.textContent = "No Task Selected";
        bestRecordDisplay.textContent = "--:--:--";
        clockDisplay.textContent = "00:00:00";
        accumulatedTimeBeforeLastStart = 0;
        currentTaskStartTime = 0;
        isPaused = true;
    }

    // Initialize timerToggleBtn text and disabled state based on the loaded `isPaused` and `currentTaskIndex`
    if (timerToggleBtn) {
        if (currentTaskIndex === -1) {
            timerToggleBtn.textContent = "Add Task"; // Suggest adding task
            timerToggleBtn.disabled = true; // Disable if no task to manage
        } else {
            // Button text reflects the loaded `isPaused` state
            timerToggleBtn.textContent = isPaused ? "Resume Task" : "Pause Task";
            timerToggleBtn.disabled = false; // Always enabled if a task exists
        }
    }

    // Set initial break display state on load if currently in a break
    const initialBreakCheck = getCurrentBreak();
    if (initialBreakCheck) {
        isCurrentlyInBreak = true;
        currentBreakName = initialBreakCheck.break.name;
        currentBreakInstanceStartMs = initialBreakCheck.startMs;
        currentBreakInstanceEndMs = initialBreakCheck.endMs;

        // Manually trigger break visuals on load if currently in a break
        currentTaskNameDisplay.textContent = "BREAK";
        currentTaskNameDisplay.classList.add('on-break');
        clockDisplay.classList.add('on-break');

        breakInfoDisplay.style.display = 'block';
        breakCountdownName.textContent = currentBreakName;
        clearInterval(breakCountdownIntervalId);
        breakCountdownIntervalId = setInterval(updateBreakCountdown, 100);
        updateBreakCountdown();
    } else {
        isCurrentlyInBreak = false;
        breakInfoDisplay.style.display = 'none';
    }

    updateBlinkEffect();
    startMainLoop(); // This calls updateMainDisplay for initial setup
    updateRealTimeClock();
    setInterval(updateRealTimeClock, 1000); // Analog/Digital clock updates

    window.addEventListener('beforeunload', saveState);
});

nextTaskBtn.addEventListener('click', handleNextTask);

if (timerToggleBtn) {
    timerToggleBtn.addEventListener('click', () => {
        if (currentTaskIndex === -1) {
            alert("Please select or add a task first to start the timer.");
            return;
        }
        // These calls now directly control the `isPaused` state regardless of break.
        if (isPaused) {
            resumeTimer();
        } else {
            pauseTimer();
        }
    });
}

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
    updateMainDisplay(); // Re-evaluate break status in case new break is active
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
                updateMainDisplay(); // Re-evaluate break status in case times changed
            }
        }
    }
});

blinkSpeedInput.addEventListener('input', (e) => {
    settings.blinkSpeed = parseInt(e.target.value) || 500; // Ensure it's a number, default if invalid
    updateBlinkEffect();
    saveState();
});

disableBlinkCheckbox.addEventListener('change', (e) => {
    settings.disableBlink = e.target.checked;
    updateBlinkEffect();
    saveState();
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
    toggleSettingsModal(); // Close modal after saving
});

saveTaskOrderBtn.addEventListener('click', saveTaskOrder);

resetAllDataBtn.addEventListener('click', resetToDefault);