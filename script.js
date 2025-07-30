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
let breakCheckIntervalId = null;
let currentTaskStartTime = 0; // Timestamp when the task started (real-world time)
let accumulatedTimeBeforeLastStart = 0; // Time accumulated before pause/break
let isPaused = false;
let blinkIntervalId = null;
let settings = {};
let isCurrentlyInBreak = false;
let currentBreakName = '';

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
 * Calculates the total duration of breaks between startTime and currentTime.
 * FIX 2: Improved logic to correctly handle partial overlaps where startTime or currentTime
 * fall within a break period, and breaks spanning across multiple days.
 * @param {number} startTime - Timestamp when the task started.
 * @param {number} currentTime - Current timestamp.
 * @returns {number} Total break time in milliseconds.
 */
function calculateTotalBreakTime(startTime, currentTime) {
    let totalBreakTime = 0;
    // Normalize to the start of the day for robust iteration
    const startOfDayMs = new Date(startTime).setHours(0, 0, 0, 0);
    const endOfDayMs = new Date(currentTime).setHours(0, 0, 0, 0);
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (const breakTime of settings.breakTimes) {
        const [startHour, startMinute] = breakTime.start.split(':').map(Number);
        const [endHour, endMinute] = breakTime.end.split(':').map(Number);

        // Iterate through each day that potentially contains the task's active period
        // Loop from the day *before* startTime to the day *after* currentTime
        // to correctly catch breaks that cross midnight at the boundaries of the task's duration.
        for (let currentDayTimestamp = startOfDayMs - oneDayMs; currentDayTimestamp <= endOfDayMs + oneDayMs; currentDayTimestamp += oneDayMs) {
            let breakStartToday = currentDayTimestamp + (startHour * 60 + startMinute) * 60 * 1000;
            let breakEndToday = currentDayTimestamp + (endHour * 60 + endMinute) * 60 * 1000;

            // Handle overnight breaks (e.g., 23:00 to 01:00)
            if (startHour * 60 + startMinute >= endHour * 60 + endMinute) {
                breakEndToday += oneDayMs; // Add a day to the end time
            }

            // Calculate the overlap between the current break instance and the task's active period [startTime, currentTime]
            const overlapStart = Math.max(startTime, breakStartToday);
            const overlapEnd = Math.min(currentTime, breakEndToday);

            // If there's a valid overlap, add its duration to totalBreakTime
            if (overlapEnd > overlapStart) {
                totalBreakTime += (overlapEnd - overlapStart);
            }
        }
    }
    return totalBreakTime;
}

/**
 * Calculates the current elapsed time for the active task based on real-world time.
 * @returns {number} Elapsed time in milliseconds.
 */
function calculateElapsedTime() {
    if (isPaused || currentTaskIndex === -1 || isCurrentlyInBreak || currentTaskStartTime === 0) {
        return accumulatedTimeBeforeLastStart;
    }

    const currentTime = Date.now();
    const totalTimeSinceStart = currentTime - currentTaskStartTime;
    const breakTime = calculateTotalBreakTime(currentTaskStartTime, currentTime);
    return totalTimeSinceStart - breakTime + accumulatedTimeBeforeLastStart;
}

/**
 * Saves current state to localStorage.
 */
function saveState() {
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
        // Ensure colors.taskSpecific is an object, not null/undefined
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

    if (currentTaskIndex !== -1 && !isPaused && !getCurrentBreak() && currentTaskStartTime !== 0) {
        console.log("Resuming task on load:", tasks[currentTaskIndex]?.name);
    } else if (getCurrentBreak()) {
        isCurrentlyInBreak = true;
        currentBreakName = getCurrentBreak().name;
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
 * @returns {object | null} The break object if currently in a break, null otherwise.
 */
function getCurrentBreak() {
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today

    for (const breakTime of settings.breakTimes) {
        const [startHour, startMinute] = breakTime.start.split(':').map(Number);
        const [endHour, endMinute] = breakTime.end.split(':').map(Number);

        let breakStartMs = today.getTime() + (startHour * 60 + startMinute) * 60 * 1000;
        let breakEndMs = today.getTime() + (endHour * 60 + endMinute) * 60 * 1000;

        // Handle overnight breaks (e.g., start 23:00, end 01:00)
        if (startHour * 60 + startMinute >= endHour * 60 + endMinute) {
            breakEndMs += 24 * 60 * 60 * 1000; // Add a day to end time
        }

        // Check if current time is within this specific break period
        if (now.getTime() >= breakStartMs && now.getTime() < breakEndMs) {
            return breakTime;
        }
    }
    return null;
}

/**
 * Main function called every second to update the display and manage timer state.
 */
function updateMainDisplay() {
    const breakInfo = getCurrentBreak();

    if (breakInfo) {
        if (!isCurrentlyInBreak) {
            isCurrentlyInBreak = true;
            currentBreakName = breakInfo.name;

            if (currentTaskIndex !== -1 && !isPaused && currentTaskStartTime !== 0) {
                accumulatedTimeBeforeLastStart = calculateElapsedTime();
                currentTaskStartTime = 0;
                console.log("Entering break. Task timer paused at:", formatTime(accumulatedTimeBeforeLastStart));
            }
            updateBlinkEffect(); // Re-evaluate blinking for break state
            currentTaskNameDisplay.style.opacity = '1'; // Ensure visible when break
            currentTaskNameDisplay.textContent = currentBreakName;
            clockDisplay.textContent = "BREAK";
            currentTaskNameDisplay.classList.add('on-break');
            clockDisplay.classList.add('on-break');
        }
    } else {
        if (isCurrentlyInBreak) {
            isCurrentlyInBreak = false;
            currentBreakName = '';
            console.log("Exiting break. Resuming timer logic.");

            if (currentTaskIndex !== -1 && !isPaused) {
                currentTaskStartTime = Date.now(); // Resume timer from accumulated time
                console.log("Task resumed from:", formatTime(accumulatedTimeBeforeLastStart));
            }

            if (currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
                currentTaskNameDisplay.textContent = tasks[currentTaskIndex].name;
                currentTaskNameDisplay.style.color = settings.colors.taskSpecific[tasks[currentTaskIndex].id] || settings.colors.textColor;
            } else {
                currentTaskNameDisplay.textContent = "No Task Selected";
            }
            currentTaskNameDisplay.classList.remove('on-break');
            clockDisplay.classList.remove('on-break');
            updateBlinkEffect(); // Re-evaluate blinking for task state
        }

        const elapsedTime = calculateElapsedTime();
        clockDisplay.textContent = formatTime(elapsedTime);
    }
}

/**
 * Starts the main loop that updates the display and checks for breaks.
 */
function startMainLoop() {
    if (breakCheckIntervalId) return;
    breakCheckIntervalId = setInterval(updateMainDisplay, 1000);
    updateMainDisplay(); // Call immediately to update display
}

/**
 * Pauses the current task timer and stops blinking.
 */
function pauseTimer() {
    if (!isPaused && currentTaskIndex !== -1 && !isCurrentlyInBreak) {
        accumulatedTimeBeforeLastStart = calculateElapsedTime();
        currentTaskStartTime = 0;
        console.log("Manual Pause: Task timer paused at:", formatTime(accumulatedTimeBeforeLastStart));
    }
    isPaused = true;
    updateBlinkEffect();
    currentTaskNameDisplay.style.opacity = '1'; // Ensure text is visible when paused
    saveState();
}

/**
 * Resumes the current task timer.
 */
function resumeTimer() {
    if (isPaused && currentTaskIndex !== -1 && !isCurrentlyInBreak) {
        currentTaskStartTime = Date.now();
        isPaused = false;
        console.log("Resume: Task timer resumed from:", formatTime(accumulatedTimeBeforeLastStart));
        updateBlinkEffect();
        saveState();
    }
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
    // If there was a previously selected task, save its current session time
    if (currentTaskIndex !== -1 && tasks[currentTaskIndex]) {
        const prevTask = tasks[currentTaskIndex];
        // Only add elapsed time if the timer was running before switching
        if (!isPaused && !isCurrentlyInBreak && currentTaskStartTime !== 0) {
            const prevTaskSessionTime = calculateElapsedTime();
            prevTask.totalTime += prevTaskSessionTime;
            console.log(`Previous task "${prevTask.name}" accumulated total time: ${formatTime(prevTask.totalTime)}`);
        }
    }

    currentTaskIndex = index;
    const newTask = tasks[currentTaskIndex];

    if (newTask) {
        currentTaskNameDisplay.textContent = newTask.name;
        currentTaskNameDisplay.style.color = settings.colors.taskSpecific[newTask.id] || settings.colors.textColor;
        bestRecordDisplay.textContent = newTask.bestRecord === Infinity ? '--:--:--' : formatTime(newTask.bestRecord);
        accumulatedTimeBeforeLastStart = 0; // Reset accumulated time for the new task
        currentTaskStartTime = Date.now(); // Start timer for the new task
        isPaused = false; // New task starts unpaused
        console.log(`Started task "${newTask.name}" at:`, new Date(currentTaskStartTime).toLocaleString());
        timerToggleBtn.textContent = "Pause Task"; // Update button text
    } else {
        currentTaskNameDisplay.textContent = "No Task Selected";
        bestRecordDisplay.textContent = "--:--:--";
        accumulatedTimeBeforeLastStart = 0;
        currentTaskStartTime = 0;
        isPaused = true; // No task selected means timer is paused
        timerToggleBtn.textContent = "Resume Task"; // Update button text
    }

    renderTaskList();
    updateMainDisplay();
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

    // Pause current timer before confirmation
    const currentSessionTime = calculateElapsedTime();
    accumulatedTimeBeforeLastStart = currentSessionTime;
    currentTaskStartTime = 0; // Stop the timer for this task
    isPaused = true;
    updateBlinkEffect(); // Stop blinking immediately
    currentTaskNameDisplay.style.opacity = '1'; // Ensure visible

    const taskToUpdate = tasks[currentTaskIndex];
    console.log(`--- Handling Next Task ---`);
    console.log(`Task: "${taskToUpdate.name}", Current Session Time: ${formatTime(currentSessionTime)}`);

    const isCompleted = confirm("Is the current task completed?");

    if (isCompleted) {
        taskToUpdate.completed = true;
        taskToUpdate.totalTime += currentSessionTime;
        if (currentSessionTime > 0 && (currentSessionTime < taskToUpdate.bestRecord || taskToUpdate.bestRecord === Infinity)) {
            taskToUpdate.bestRecord = currentSessionTime;
            console.log(`Updated Best Record for "${taskToUpdate.name}" to: ${formatTime(taskToUpdate.bestRecord)}`);
        }
        const [completedTask] = tasks.splice(currentTaskIndex, 1); // Remove from current position
        tasks.push(completedTask); // Add to end of the list

        // FIX 1: Corrected nextIndex calculation after a task is completed and moved.
        // If the task removed was the last one in the list, the next task is the first one (index 0).
        // Otherwise, the task that shifted into the currentTaskIndex position becomes the new current task.
        let nextIndexAfterCompletion;
        if (tasks.length === 0) { // No tasks left after removal
            nextIndexAfterCompletion = -1;
        } else if (currentTaskIndex >= tasks.length) { // The task removed was the last one (index N-1), so currentTaskIndex is now out of bounds (N). Wrap to 0.
            nextIndexAfterCompletion = 0;
        } else { // A task was removed from the middle, the next task is now at the same currentTaskIndex position.
            nextIndexAfterCompletion = currentTaskIndex;
        }
        setCurrentTask(nextIndexAfterCompletion);

    } else {
        // Task not completed, just switch to next task in sequence (circularly)
        taskToUpdate.totalTime += currentSessionTime; // Add session time even if not completed
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
 */
function toggleSettingsModal() {
    if (settingsModal.style.display === 'flex') {
        settingsModal.style.display = 'none';
        // When closing settings, resume timer if not in break
        if (currentTaskIndex !== -1 && !getCurrentBreak()) {
            resumeTimer();
        } else {
            // If no task selected or currently in break, ensure timer stays paused/on break display
            isPaused = true; // Ensure logic remains consistent
            updateMainDisplay();
        }
        saveState();
    } else {
        settingsModal.style.display = 'flex';
        pauseTimer(); // Pause timer when opening settings
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

    if (!settings.disableBlink && !isPaused && !isCurrentlyInBreak) {
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

    if (tasks.length > 0) {
        // If currentTaskIndex is invalid, default to the first task
        if (currentTaskIndex < 0 || currentTaskIndex >= tasks.length) {
            currentTaskIndex = 0;
            accumulatedTimeBeforeLastStart = 0;
            currentTaskStartTime = Date.now();
            isPaused = false; // When defaulting to a new task, start unpaused
        }
        // If tasks exist and currentTaskIndex is valid, its state (isPaused, accumulatedTime) is loaded by loadState().
        // So no need to force isPaused = false here.

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

    // FIX 3: Initialize timerToggleBtn text based on the loaded `isPaused` state
    if (timerToggleBtn) {
        timerToggleBtn.textContent = isPaused ? "Resume Task" : "Pause Task";
    }

    updateBlinkEffect();
    startMainLoop();
    updateRealTimeClock();
    setInterval(updateRealTimeClock, 1000);

    window.addEventListener('beforeunload', saveState);
});

nextTaskBtn.addEventListener('click', handleNextTask);

if (timerToggleBtn) { // Check if element exists before adding listener
    timerToggleBtn.addEventListener('click', () => {
        if (isCurrentlyInBreak) {
            alert("Cannot pause/resume timer during a break. Timer will resume automatically after break.");
            return;
        }
        if (currentTaskIndex === -1) {
            alert("Please select or add a task first.");
            return;
        }

        if (isPaused) {
            resumeTimer();
            timerToggleBtn.textContent = "Pause Task";
        } else {
            pauseTimer();
            timerToggleBtn.textContent = "Resume Task";
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
});

breakTimesContainer.addEventListener('change', (e) => {
    const target = e.target;
    // Use event delegation to catch changes within break time entries
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