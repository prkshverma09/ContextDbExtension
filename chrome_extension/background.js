// Background script for Context DB Manager Chrome Extension

// Context menu IDs
const CONTEXT_MENU_ID = 'contextdb-add-text';
const SEARCH_MENU_ID = 'contextdb-search-text';

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Context DB Manager installed/updated');

    // Set default settings on first install
    if (details.reason === 'install') {
        setDefaultSettings();
    }

    // Create context menu
    createContextMenus();
});

// Extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Context DB Manager started');
    createContextMenus();
});

// Set default settings
async function setDefaultSettings() {
    try {
        const defaultSettings = {
            serverUrl: 'http://localhost:8000',
            enableContextMenu: true,
            selectedDatabase: null
        };

        await chrome.storage.sync.set(defaultSettings);
        console.log('Default settings set');
    } catch (error) {
        console.error('Error setting default settings:', error);
    }
}

// Create context menus
async function createContextMenus() {
    try {
        // Remove existing context menus
        await chrome.contextMenus.removeAll();

        // Check if context menu is enabled
        const result = await chrome.storage.sync.get(['enableContextMenu']);
        const enableContextMenu = result.enableContextMenu !== false; // Default to true

        if (!enableContextMenu) {
            console.log('Context menu disabled by user setting');
            return;
        }

        // Create "Add to Context DB" menu item
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID,
            title: 'Add to Context DB',
            contexts: ['selection'],
            documentUrlPatterns: ['<all_urls>']
        });

        // Create "Search in Context DB" menu item
        chrome.contextMenus.create({
            id: SEARCH_MENU_ID,
            title: 'Search "%s" in Context DB',
            contexts: ['selection'],
            documentUrlPatterns: ['<all_urls>']
        });

        console.log('Context menus created');
    } catch (error) {
        console.error('Error creating context menus:', error);
    }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID) {
        await handleAddToContextDB(info, tab);
    } else if (info.menuItemId === SEARCH_MENU_ID) {
        await handleSearchInContextDB(info, tab);
    }
});

// Handle "Add to Context DB" context menu click
async function handleAddToContextDB(info, tab) {
    try {
        const selectedText = info.selectionText?.trim();
        if (!selectedText) {
            console.error('No text selected');
            return;
        }

        // Get current settings
        const result = await chrome.storage.sync.get(['selectedDatabase', 'serverUrl']);
        const selectedDatabase = result.selectedDatabase;
        const serverUrl = result.serverUrl || 'http://localhost:8000';

        if (!selectedDatabase) {
            // Show popup to select database
            chrome.action.openPopup();

            // Store the selected text temporarily for the popup to use
            await chrome.storage.local.set({
                pendingText: selectedText,
                pendingUrl: tab.url,
                pendingTitle: tab.title
            });
            return;
        }

        // Add text directly to selected database
        await addTextToDatabase(selectedText, selectedDatabase, serverUrl, {
            url: tab.url,
            title: tab.title,
            timestamp: new Date().toISOString(),
            domain: new URL(tab.url).hostname
        });

        // Show notification
        showNotification('Text added to Context DB successfully!', 'success');

    } catch (error) {
        console.error('Error handling add to context DB:', error);
        showNotification('Error adding text to Context DB', 'error');
    }
}

// Handle "Search in Context DB" context menu click
async function handleSearchInContextDB(info, tab) {
    try {
        const searchText = info.selectionText?.trim();
        if (!searchText) {
            console.error('No text selected for search');
            return;
        }

        // Open popup with search pre-filled
        await chrome.storage.local.set({
            searchQuery: searchText
        });

        chrome.action.openPopup();

    } catch (error) {
        console.error('Error handling search in context DB:', error);
        showNotification('Error searching in Context DB', 'error');
    }
}

// Add text to database
async function addTextToDatabase(text, databaseName, serverUrl, metadata) {
    try {
        const response = await fetch(`${serverUrl}/add-text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                database_name: databaseName,
                text: text,
                metadata: metadata
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        console.log('Text added to database successfully');
        return await response.json();

    } catch (error) {
        console.error('Error adding text to database:', error);
        throw error;
    }
}

// Show notification to user
function showNotification(message, type = 'success') {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: type === 'success' ? 'icons/icon48.png' : 'icons/icon48.png',
        title: 'Context DB Manager',
        message: message
    });
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'enableContextMenu':
            createContextMenus();
            break;

        case 'disableContextMenu':
            chrome.contextMenus.removeAll();
            break;

        case 'getPendingData':
            // Return any pending data for popup
            chrome.storage.local.get(['pendingText', 'pendingUrl', 'pendingTitle', 'searchQuery'])
                .then(result => {
                    sendResponse(result);
                    // Clear pending data after retrieval
                    chrome.storage.local.remove(['pendingText', 'pendingUrl', 'pendingTitle', 'searchQuery']);
                })
                .catch(error => {
                    console.error('Error getting pending data:', error);
                    sendResponse({});
                });
            return true; // Keeps the message channel open for async response

        case 'addTextToDatabase':
            addTextToDatabase(request.text, request.databaseName, request.serverUrl, request.metadata)
                .then(result => {
                    showNotification('Text added to Context DB successfully!', 'success');
                    sendResponse({ success: true, result });
                })
                .catch(error => {
                    console.error('Error adding text:', error);
                    showNotification('Error adding text to Context DB', 'error');
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Keeps the message channel open for async response

        case 'openPopup':
            // Open extension popup
            chrome.action.openPopup()
                .then(() => {
                    console.log('Popup opened successfully');
                    sendResponse({ success: true });
                })
                .catch(error => {
                    console.error('Error opening popup:', error);
                    sendResponse({ success: false, error: error.message });
                });
            return true;

        default:
            console.log('Unknown action:', request.action);
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This will be handled by the popup, but we can add fallback logic here if needed
    console.log('Extension icon clicked');
});

// Listen for storage changes to update context menus
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.enableContextMenu) {
        createContextMenus();
    }
});

// Cleanup on extension uninstall/disable
chrome.runtime.onSuspend.addListener(() => {
    console.log('Context DB Manager suspended');
});

console.log('Background script loaded');
