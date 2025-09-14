// Global variables
let currentServerUrl = 'http://127.0.0.1:8000';
let databases = [];

// DOM elements
const serverStatus = document.getElementById('serverStatus');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const databaseList = document.getElementById('databaseList');
const newDbNameInput = document.getElementById('newDbName');
const createDbBtn = document.getElementById('createDbBtn');
// Removed search and settings elements

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await checkServerStatus();
    await loadDatabases();
    setupEventListeners();

    // Pending search data handled by side panel
});

// Event listeners
function setupEventListeners() {
    createDbBtn.addEventListener('click', createDatabase);

    newDbNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createDatabase();
    });
}

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['serverUrl', 'enableContextMenu']);

        if (result.serverUrl) {
            currentServerUrl = result.serverUrl;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Settings are now managed automatically

// Check server status
async function checkServerStatus() {
    updateServerStatus('checking', 'Checking server...');

    try {
        const response = await fetch(`${currentServerUrl}/health`, {
            method: 'GET',
            timeout: 5000
        });

        if (response.ok) {
            const data = await response.json();
            updateServerStatus('online', `Server online - ${data.version || 'Unknown version'}`);
            return true;
        } else {
            throw new Error(`Server responded with status ${response.status}`);
        }
    } catch (error) {
        console.error('Server check failed:', error);
        updateServerStatus('offline', 'Server offline - Check if local server is running');
        return false;
    }
}

// Update server status display
function updateServerStatus(status, message) {
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = message;
}

// Load databases from server
async function loadDatabases() {
    try {
        const response = await fetch(`${currentServerUrl}/databases`);
        if (!response.ok) throw new Error('Failed to fetch databases');

        databases = await response.json();
        renderDatabaseList();
    } catch (error) {
        console.error('Error loading databases:', error);
        renderDatabaseList([]); // Show empty state
    }
}

// Render database list
function renderDatabaseList(dbs = databases) {
    if (dbs.length === 0) {
        databaseList.innerHTML = `
            <div class="empty-state">
                <p>No databases found. Create your first database below.</p>
            </div>
        `;
        return;
    }

    const html = dbs.map(db => `
        <div class="database-item" data-name="${db.name}">
            <div class="database-info">
                <div class="database-name">${escapeHtml(db.name)}</div>
                <div class="database-count">${db.document_count || 0} documents</div>
            </div>
            <div class="database-actions">
                <button class="btn-delete" data-action="delete" data-db-name="${escapeHtml(db.name)}">Delete</button>
            </div>
        </div>
    `).join('');

    databaseList.innerHTML = html;

    // Add event delegation for database actions
    setupDatabaseEventListeners();
}

// Setup event delegation for database buttons
function setupDatabaseEventListeners() {
    // Remove existing listeners to avoid duplicates
    databaseList.removeEventListener('click', handleDatabaseAction);

    // Add event delegation
    databaseList.addEventListener('click', handleDatabaseAction);
}

// Handle database button clicks
function handleDatabaseAction(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const dbName = button.dataset.dbName;

    if (action === 'delete') {
        deleteDatabase(dbName);
    }
}

// Search functionality moved to side panel

// Create new database
async function createDatabase() {
    const name = newDbNameInput.value.trim();
    if (!name) {
        showNotification('Please enter a database name', 'error');
        return;
    }

    if (databases.some(db => db.name === name)) {
        showNotification('Database already exists', 'error');
        return;
    }

    try {
        createDbBtn.disabled = true;
        createDbBtn.textContent = 'Creating...';

        const response = await fetch(`${currentServerUrl}/databases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!response.ok) throw new Error('Failed to create database');

        newDbNameInput.value = '';
        showNotification('Database created successfully');
        await loadDatabases();

        // Notify side panel to refresh its database dropdowns
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, { action: 'refreshDatabases' });
        } catch (error) {
            console.log('Could not notify side panel:', error);
        }

    } catch (error) {
        console.error('Error creating database:', error);
        showNotification('Error creating database', 'error');
    } finally {
        createDbBtn.disabled = false;
        createDbBtn.textContent = 'Create Database';
    }
}

// Database selection removed - use side panel for saving text

// Delete database
async function deleteDatabase(dbName) {
    if (!confirm(`Are you sure you want to delete the database "${dbName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${currentServerUrl}/databases/${encodeURIComponent(dbName)}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete database');

        // Database selection removed

        showNotification('Database deleted successfully');
        await loadDatabases();

        // Notify side panel to refresh its database dropdowns
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, { action: 'refreshDatabases' });
        } catch (error) {
            console.log('Could not notify side panel:', error);
        }

    } catch (error) {
        console.error('Error deleting database:', error);
        showNotification('Error deleting database', 'error');
    }
}

// Search and context functionality moved to side panel

// Show notification
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 13px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
