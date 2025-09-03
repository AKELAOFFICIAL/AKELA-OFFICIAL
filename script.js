// Server communication functions
async function fetchFromServer(endpoint) {
    try {
        const response = await fetch(`${SERVER_URL}${endpoint}`);
        return await response.json();
    } catch (error) {
        console.error('Server error:', error);
        showNotification('Server connection failed', 'error');
        return null;
    }
}

async function saveToServer(endpoint, data) {
    try {
        const response = await fetch(`${SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Server save error:', error);
        return null;
    }
}

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notification-message');
const saveTelegramBtn = document.getElementById('save-telegram-settings');
const fetchedDataTable = document.getElementById('fetched-data-table').querySelector('tbody');
const lastUpdatedEl = document.getElementById('last-updated');
const progressBar = document.getElementById('progress-bar');
const predictionHistoryTable = document.getElementById('prediction-history').querySelector('tbody');
const autoSessionToggleBtn = document.getElementById('session-toggle');
const clearPredictionsBtn = document.getElementById('clear-predictions-btn');
const clearFetchedBtn = document.getElementById('clear-fetched-btn');
const refreshBtn = document.getElementById('refresh-btn');
const sessionStatsPopup = document.getElementById('session-stats-popup');
const popupTotalEl = document.getElementById('popup-total');
const popupWinsEl = document.getElementById('popup-wins');
const popupLossesEl = document.getElementById('popup-losses');
const sessionEndCountInput = document.getElementById('session-end-count');
const toggleScheduledBtn = document.getElementById('toggle-scheduled-btn');
const toggleFullscreenBtn = document.getElementById('toggle-fullscreen-btn');

// Splash screen elements
const splashScreen = document.getElementById('splash-screen');
const mainContent = document.getElementById('main-content');

// Global variables
let fetchedData = [];
let predictions = [];
let isAutoSessionActive = false;
let isScheduledMessagesActive = false;
let updateTimer;
let scheduledMessagesTimer;
let sessionStats = { wins: 0, losses: 0, total: 0 };
let sessionEndLimit = 10;
let telegramSettings = {
    botToken: '',
    channelId: '',
    messageTemplate: 'PERIOD ➪ {issueNumber}\nRESULT ➪ {size} / {number}',
    scheduledMessages: []
};
let scheduledMessages = [];
let lastProcessedPeriod = null;
let newPredictionSent = false;
let sentMessagesForMinute = {};
let lastSentMinute = -1;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadSavedData();
    await startSystem();
});

// Setup event listeners
function setupEventListeners() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            if (tabId === 'game') {
                const gameIframe = document.getElementById('game-iframe');
                gameIframe.src = 'https://www.6club.win/#/register?invitationCode=438172851706';
            }
            switchTab(tabId);
        });
    });

    saveTelegramBtn.addEventListener('click', saveTelegramSettings);
    refreshBtn.addEventListener('click', fetchData);
    clearPredictionsBtn.addEventListener('click', clearPredictionData);
    clearFetchedBtn.addEventListener('click', clearFetchedData);
    autoSessionToggleBtn.addEventListener('click', toggleAutoSession);
    toggleScheduledBtn.addEventListener('click', toggleScheduledMessages);
    toggleFullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Make session stats popup draggable
    makeDraggable(sessionStatsPopup);
}

// Switch tab function
function switchTab(tabId) {
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
}

// Toggle fullscreen function
function toggleFullscreen() {
    const isFullscreen = document.body.classList.toggle('full-screen-mode');
    toggleFullscreenBtn.innerHTML = isFullscreen ? 
        '<i class="fas fa-compress"></i> Exit Full Screen' : 
        '<i class="fas fa-expand"></i> Full Screen';
}

// Load saved data function
async function loadSavedData() {
    try {
        // Load settings from server
        const serverSettings = await fetchFromServer('/api/settings');
        if (serverSettings) {
            telegramSettings.botToken = serverSettings.botToken || '';
            telegramSettings.channelId = serverSettings.channelId || '';
            telegramSettings.messageTemplate = serverSettings.messageTemplate || 'PERIOD ➪ {issueNumber}\nRESULT ➪ {size} / {number}';
            telegramSettings.scheduledMessages = serverSettings.scheduledMessages || [];
            
            document.getElementById('bot-token').value = telegramSettings.botToken;
            document.getElementById('channel-id').value = telegramSettings.channelId;
            document.getElementById('message-template').value = telegramSettings.messageTemplate;
        }

        // Load predictions from server
        const serverPredictions = await fetchFromServer('/api/predictions');
        if (serverPredictions) {
            predictions = serverPredictions;
        }

        // Load data from server
        const serverData = await fetchFromServer('/api/data');
        if (serverData) {
            fetchedData = serverData;
        }

        // Update UI
        updatePredictionHistoryTable();
        updateStats();
        updateFetchedDataTable();
        updateLastUpdated();
    } catch (error) {
        console.error('Failed to load data from server:', error);
    }
}

// Fetch data function
async function fetchData() {
    try {
        const timestamp = Date.now();
        const apiUrl = `https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?ts=${timestamp}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data && data.data && data.data.list) {
            const formattedData = data.data.list.map(item => ({
                issueNumber: item.issueNumber,
                number: item.winNumber || item.number || '0',
                size: parseInt(item.winNumber || item.number || '0') >= 5 ? 'BIG' : 'SMALL'
            }));
            
            // Send to server for processing
            await saveToServer('/api/process-data', formattedData);
            
            // Reload data from server
            const serverData = await fetchFromServer('/api/data');
            if (serverData) {
                fetchedData = serverData;
                updateFetchedDataTable();
                updateLastUpdated();
            }
            
            showNotification('Data fetched successfully', 'success');
        } else {
            showNotification('Failed to fetch data: Invalid response format', 'error');
        }
    } catch (error) {
        showNotification('Failed to fetch data: ' + error.message, 'error');
    }
}

// Update fetched data table function
function updateFetchedDataTable() {
    fetchedDataTable.innerHTML = '';
    const dataToShow = fetchedData.slice(0, 100);
    dataToShow.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td title="${item.issueNumber}">${item.issueNumber.slice(-4)}</td>
            <td>${item.number}</td>
            <td>${item.size}</td>
        `;
        fetchedDataTable.appendChild(row);
    });
    document.getElementById('total-records').textContent = fetchedData.length;
}

// Update last updated function
function updateLastUpdated() {
    lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;
}

// Update prediction history table function
function updatePredictionHistoryTable() {
    predictionHistoryTable.innerHTML = '';
    const predictionsToShow = predictions.slice(0, 100);
    predictionsToShow.forEach(pred => {
        const row = document.createElement('tr');
        let resultColor = 'inherit';
        if (pred.result === 'win') {
            resultColor = 'var(--success)';
        } else if (pred.result === 'loss') {
            resultColor = 'var(--danger)';
        }
        row.innerHTML = `
            <td>${pred.issueNumber.slice(-4)}</td>
            <td>${pred.numberPrediction || '--'}</td>
            <td>${pred.sizePrediction || '--'}</td>
            <td style="color:${resultColor};">${pred.result ? pred.result.toUpperCase() : '--'}</td>
        `;
        predictionHistoryTable.appendChild(row);
    });
    updateStats();
}

// Update stats function
function updateStats() {
    const completedPredictions = predictions.filter(p => p.result !== null);
    if (completedPredictions.length > 0) {
        const wins = completedPredictions.filter(p => p.result === 'win').length;
        const sizeCorrect = completedPredictions.filter(p => p.sizePrediction === p.actualSize).length;

        document.getElementById('accuracy-rate').textContent = `${((wins / completedPredictions.length) * 100).toFixed(2)}%`;
        document.getElementById('size-accuracy').textContent = `${((sizeCorrect / completedPredictions.length) * 100).toFixed(2)}%`;
        
        // Calculate win streak
        let winStreak = 0;
        for (let i = 0; i < completedPredictions.length; i++) {
            if (completedPredictions[i].result === 'win') {
                winStreak++;
            } else {
                break;
            }
        }
        document.getElementById('win-streak').textContent = winStreak;
    }
}

// Update session stats popup function
function updateSessionStatsPopup() {
    popupTotalEl.textContent = sessionStats.total;
    popupWinsEl.textContent = sessionStats.wins;
    popupLossesEl.textContent = sessionStats.losses;
}

// Toggle auto session function
function toggleAutoSession() {
    if (isAutoSessionActive) {
        endAutoSession();
    } else {
        startAutoSession();
    }
}

// Start auto session function
async function startAutoSession() {
    if (!telegramSettings.botToken || !telegramSettings.channelId) {
        showNotification('Please configure Telegram settings first.', 'warning');
        return;
    }
    if (isAutoSessionActive) return;
    
    isAutoSessionActive = true;
    sessionStats = { wins: 0, losses: 0, total: 0 };
    sessionEndLimit = parseInt(sessionEndCountInput.value) || 10;
    sessionStatsPopup.classList.add('show');
    updateSessionStatsPopup();
    autoSessionToggleBtn.innerHTML = '<i class="fas fa-stop"></i> End Auto Session';
    autoSessionToggleBtn.classList.remove('btn-primary');
    autoSessionToggleBtn.classList.add('btn-danger');
    
    showNotification('New auto prediction session started', 'success');
    
    // Start the update timer
    startUpdateTimer();
}

// End auto session function
async function endAutoSession() {
    isAutoSessionActive = false;
    sessionStatsPopup.classList.remove('show');
    autoSessionToggleBtn.innerHTML = '<i class="fas fa-play"></i> Start Auto Session';
    autoSessionToggleBtn.classList.remove('btn-danger');
    autoSessionToggleBtn.classList.add('btn-primary');
    
    showNotification('Auto prediction session ended', 'info');
    
    // Clear the update timer
    clearInterval(updateTimer);
    progressBar.style.width = '0%';
    progressBar.textContent = 'Session Ended';
}

// Start update timer function
function startUpdateTimer() {
    clearInterval(updateTimer);
    let lastFetchSecond = -1;

    updateTimer = setInterval(async () => {
        const now = new Date();
        const currentSecond = now.getSeconds();
        
        // Fetch data every 10 seconds
        if (currentSecond % 10 === 0 && currentSecond !== lastFetchSecond) {
            lastFetchSecond = currentSecond;
            await fetchData();
        }
        
        // Update progress bar
        const progressPercent = (currentSecond / 60) * 100;
        progressBar.style.width = `${progressPercent}%`;
        progressBar.textContent = `Next update in ${60 - currentSecond}s`;
        
    }, 1000);
}

// Save Telegram settings function
function saveTelegramSettings() {
    const botToken = document.getElementById('bot-token').value;
    const channelId = document.getElementById('channel-id').value;
    const messageTemplate = document.getElementById('message-template').value;

    if (!botToken || !channelId) {
        showNotification('Please enter both Bot Token and Channel ID', 'error');
        return;
    }

    telegramSettings.botToken = botToken;
    telegramSettings.channelId = channelId;
    telegramSettings.messageTemplate = messageTemplate;

    saveSettingsToLocalStorage();
    showNotification('Telegram settings saved successfully!', 'success');
}

// Save settings to local storage function
function saveSettingsToLocalStorage() {
    const settingsToSave = {
        botToken: telegramSettings.botToken,
        channelId: telegramSettings.channelId,
        messageTemplate: telegramSettings.messageTemplate,
        scheduledMessages: telegramSettings.scheduledMessages
    };

    // Save to server
    saveToServer('/api/save-settings', settingsToSave);
}

// Toggle scheduled messages function
function toggleScheduledMessages() {
    isScheduledMessagesActive = !isScheduledMessagesActive;
    if (isScheduledMessagesActive) {
        toggleScheduledBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Scheduled Messages';
        toggleScheduledBtn.classList.remove('btn-primary');
        toggleScheduledBtn.classList.add('btn-danger');
        scheduledMessagesTimer = setInterval(checkScheduledMessages, 1000);
        showNotification('Scheduled messages activated!', 'success');
    } else {
        toggleScheduledBtn.innerHTML = '<i class="fas fa-clock"></i> Start Scheduled Messages';
        toggleScheduledBtn.classList.remove('btn-danger');
        toggleScheduledBtn.classList.add('btn-primary');
        clearInterval(scheduledMessagesTimer);
        showNotification('Scheduled messages stopped.', 'info');
    }
}

// Check scheduled messages function
async function checkScheduledMessages() {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    // Check if we've already sent a message this minute
    if (currentMinute !== lastSentMinute) {
        sentMessagesForMinute = {};
        lastSentMinute = currentMinute;
    }

    // Check each scheduled message
    for (let i = 0; i < scheduledMessages.length; i++) {
        const scheduledTime = scheduledMessages[i].time;
        if (scheduledTime === currentTime && !sentMessagesForMinute[scheduledTime]) {
            sentMessagesForMinute[scheduledTime] = true;
            await sendTelegramPlainMessage(scheduledMessages[i].message);
        }
    }
}

// Send Telegram plain message function
async function sendTelegramPlainMessage(message) {
    if (!telegramSettings.botToken || !telegramSettings.channelId) {
        showNotification('Telegram settings not configured.', 'warning');
        return;
    }

    const telegramApiUrl = `https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`;
    
    try {
        const response = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: telegramSettings.channelId,
                text: message
            })
        });
        
        const data = await response.json();
        if (data.ok) {
            showNotification('Scheduled message sent successfully', 'success');
        } else {
            showNotification(`Telegram API Error: ${data.description}`, 'error');
        }
    } catch (error) {
        showNotification('Failed to send scheduled message', 'error');
    }
}

// Add scheduled message function
function addScheduledMessage(id) {
    const time = document.getElementById(`scheduled-time-${id}`).value;
    const message = document.getElementById(`scheduled-message-${id}`).value;

    if (time && message) {
        scheduledMessages.push({ time, message });
        showNotification('Scheduled message added!', 'success');
        
        // Clear inputs
        document.getElementById(`scheduled-time-${id}`).value = '';
        document.getElementById(`scheduled-message-${id}`).value = '';
    } else {
        showNotification('Please enter both time and message', 'error');
    }
}

// Start system function
async function startSystem() {
    // Hide splash screen after 3 seconds
    setTimeout(() => {
        splashScreen.classList.add('hidden');
    }, 3000);
    
    // Load initial data
    await fetchData();
    
    // Start update timer
    startUpdateTimer();
    
    showNotification('AKELA AI System initialized', 'info');
}

// Show notification function
function showNotification(message, type) {
    notificationMessage.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Clear prediction data function
async function clearPredictionData() {
    predictions = [];
    updatePredictionHistoryTable();
    updateStats();
    
    // Clear from server
    await saveToServer('/api/save-predictions', []);
    
    showNotification('Prediction data cleared successfully', 'success');
}

// Clear fetched data function
async function clearFetchedData() {
    fetchedData = [];
    updateFetchedDataTable();
    
    // Clear from server
    await saveToServer('/api/save-data', []);
    
    showNotification('Fetched data cleared successfully', 'success');
}

// Make draggable function
function makeDraggable(element) {
    let isDragging = false;
    let offsetX, offsetY;

    element.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - element.getBoundingClientRect().left;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        element.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            element.style.left = `${e.clientX - offsetX}px`;
            element.style.top = `${e.clientY - offsetY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        element.style.cursor = 'grab';
    });
}

// Initialize draggable popup
makeDraggable(sessionStatsPopup);
