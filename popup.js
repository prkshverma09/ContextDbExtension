// Global variables
let currentServerUrl = 'http://127.0.0.1:8000';
let selectedDatabase = null;
let databases = [];

// DOM elements
const serverStatus = document.getElementById('serverStatus');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const databaseList = document.getElementById('databaseList');
const newDbNameInput = document.getElementById('newDbName');
const createDbBtn = document.getElementById('createDbBtn');
const searchDbSelect = document.getElementById('searchDbSelect');
const searchQueryInput = document.getElementById('searchQuery');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const searchAllDbsCheckbox = document.getElementById('searchAllDbs');
const searchLimitSelect = document.getElementById('searchLimit');
const serverUrlInput = document.getElementById('serverUrl');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const enableContextMenuCheckbox = document.getElementById('enableContextMenu');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await checkServerStatus();
    await loadDatabases();
    setupEventListeners();

    // Check for pending search query from background script
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getPendingData' });
        if (response && response.searchQuery) {
            searchQueryInput.value = response.searchQuery;
            // Auto-select default database if available
            if (selectedDatabase) {
                searchDbSelect.value = selectedDatabase;
                // Auto-perform search after a brief delay
                setTimeout(() => {
                    performSearch();
                }, 500);
            }
        }
    } catch (error) {
        console.log('No pending search data');
    }
});

// Event listeners
function setupEventListeners() {
    createDbBtn.addEventListener('click', createDatabase);
    searchBtn.addEventListener('click', performSearch);
    saveSettingsBtn.addEventListener('click', saveSettings);

    newDbNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createDatabase();
    });

    searchQueryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Search all databases checkbox
    searchAllDbsCheckbox.addEventListener('change', (e) => {
        searchDbSelect.disabled = e.target.checked;
        if (e.target.checked) {
            searchDbSelect.style.opacity = '0.6';
        } else {
            searchDbSelect.style.opacity = '1';
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+K or Cmd+K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchQueryInput.focus();
        }

        // Escape to clear search
        if (e.key === 'Escape') {
            if (document.activeElement === searchQueryInput) {
                searchQueryInput.value = '';
                searchResults.innerHTML = '';
            }
        }
    });
}

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['serverUrl', 'enableContextMenu', 'selectedDatabase']);

        if (result.serverUrl) {
            currentServerUrl = result.serverUrl;
            serverUrlInput.value = currentServerUrl;
        }

        enableContextMenuCheckbox.checked = result.enableContextMenu !== false; // Default to true
        selectedDatabase = result.selectedDatabase || null;
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save settings to storage
async function saveSettings() {
    try {
        currentServerUrl = serverUrlInput.value || 'http://127.0.0.1:8000';
        const settings = {
            serverUrl: currentServerUrl,
            enableContextMenu: enableContextMenuCheckbox.checked,
            selectedDatabase: selectedDatabase
        };

        await chrome.storage.sync.set(settings);

        // Update context menu based on setting
        if (enableContextMenuCheckbox.checked) {
            chrome.runtime.sendMessage({ action: 'enableContextMenu' });
        } else {
            chrome.runtime.sendMessage({ action: 'disableContextMenu' });
        }

        showNotification('Settings saved successfully');
        await checkServerStatus();
        await loadDatabases();
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Error saving settings', 'error');
    }
}

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
        updateSearchDbSelect();
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
        <div class="database-item ${db.name === selectedDatabase ? 'active' : ''}" data-name="${db.name}">
            <div class="database-info">
                <div class="database-name">${escapeHtml(db.name)}</div>
                <div class="database-count">${db.document_count || 0} documents</div>
            </div>
            <div class="database-actions">
                <button class="btn-select" onclick="selectDatabase('${escapeHtml(db.name)}')">
                    ${db.name === selectedDatabase ? 'Selected' : 'Select'}
                </button>
                <button class="btn-delete" onclick="deleteDatabase('${escapeHtml(db.name)}')">Delete</button>
            </div>
        </div>
    `).join('');

    databaseList.innerHTML = html;
}

// Update search database select dropdown
function updateSearchDbSelect() {
    const options = databases.map(db =>
        `<option value="${escapeHtml(db.name)}">${escapeHtml(db.name)}</option>`
    ).join('');

    searchDbSelect.innerHTML = '<option value="">Select database to search</option>' + options;

    if (selectedDatabase) {
        searchDbSelect.value = selectedDatabase;
    }
}

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

    } catch (error) {
        console.error('Error creating database:', error);
        showNotification('Error creating database', 'error');
    } finally {
        createDbBtn.disabled = false;
        createDbBtn.textContent = 'Create Database';
    }
}

// Select database for text additions
async function selectDatabase(dbName) {
    selectedDatabase = dbName;
    await chrome.storage.sync.set({ selectedDatabase: dbName });
    renderDatabaseList();
    searchDbSelect.value = dbName;
    showNotification(`Selected database: ${dbName}`);
}

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

        if (selectedDatabase === dbName) {
            selectedDatabase = null;
            await chrome.storage.sync.set({ selectedDatabase: null });
        }

        showNotification('Database deleted successfully');
        await loadDatabases();

    } catch (error) {
        console.error('Error deleting database:', error);
        showNotification('Error deleting database', 'error');
    }
}

// Perform search
async function performSearch() {
    const query = searchQueryInput.value.trim();
    const searchAll = searchAllDbsCheckbox.checked;
    const dbName = searchDbSelect.value;
    const limit = parseInt(searchLimitSelect.value) || 10;

    if (!query) {
        showNotification('Please enter a search query', 'error');
        return;
    }

    if (!searchAll && !dbName) {
        showNotification('Please select a database to search or enable "Search all databases"', 'error');
        return;
    }

    try {
        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';
        searchResults.innerHTML = '<div class="empty-state">Searching...</div>';

        let allResults = [];

        if (searchAll) {
            // Search all databases
            const searchPromises = databases.map(async (db) => {
                try {
                    const response = await fetch(`${currentServerUrl}/search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            database_name: db.name,
                            query: query,
                            limit: Math.ceil(limit / databases.length) + 2,  // Get more per DB
                            min_score: 0.3  // 30% minimum similarity
                        })
                    });

                    if (response.ok) {
                        const results = await response.json();
                        return results.map(result => ({
                            ...result,
                            database_name: db.name
                        }));
                    }
                    return [];
                } catch (error) {
                    console.error(`Error searching database ${db.name}:`, error);
                    return [];
                }
            });

            const dbResults = await Promise.all(searchPromises);
            allResults = dbResults.flat()
                .sort((a, b) => b.score - a.score)  // Sort by relevance
                .slice(0, limit);  // Limit total results

        } else {
            // Search single database
            const response = await fetch(`${currentServerUrl}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    database_name: dbName,
                    query: query,
                    limit: limit,
                    min_score: 0.3  // 30% minimum similarity
                })
            });

            if (!response.ok) throw new Error('Search failed');

            allResults = await response.json();
        }

        renderSearchResults(allResults, searchAll);

    } catch (error) {
        console.error('Error performing search:', error);
        searchResults.innerHTML = '<div class="empty-state">Search failed. Please try again.</div>';
        showNotification('Search failed', 'error');
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Search';
    }
}

// Render search results
// Global variable to track selected results
let selectedResults = new Set();

// Setup event listeners for search results (replaces inline onclick handlers)
function setupSearchResultEventListeners() {
    // Context creation buttons
    const selectAllBtn = document.querySelector('.btn-select-all');
    const clearBtn = document.querySelector('.btn-clear-selection');
    const createContextBtn = document.getElementById('create-context-btn');
    const copyContextBtn = document.getElementById('copy-context-btn');

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const totalResults = parseInt(selectAllBtn.dataset.totalResults);
            selectAllResults(totalResults);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearSelection);
    }

    if (createContextBtn) {
        createContextBtn.addEventListener('click', createContextText);
    }

    if (copyContextBtn) {
        copyContextBtn.addEventListener('click', copyContextText);
    }

    // Result checkboxes
    document.querySelectorAll('[id^="result-checkbox-"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.resultIndex);
            toggleResultSelection(index);
        });
    });

    // Expand/collapse buttons
    document.querySelectorAll('.btn-expand').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('.btn-expand').dataset.resultIndex);
            toggleFullText(index);
        });
    });

    // Copy buttons
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fullText = e.target.dataset.fullText;
            copyToClipboard(fullText);
        });
    });
}

function renderSearchResults(results, searchedAll = false) {
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="empty-state">No results found (showing only results with 30%+ similarity).</div>';
        return;
    }

    // Create context creation section
    const contextSection = `
        <div class="context-creation-section" id="context-section">
            <div class="context-header">
                <h4>Create LLM Context</h4>
                <div class="context-actions">
                    <button class="btn-select-all" data-total-results="${results.length}">Select All</button>
                    <button class="btn-clear-selection">Clear</button>
                </div>
            </div>
            <div class="selected-count">
                Selected: <span id="selected-count">0</span> results
            </div>
            <div class="context-controls">
                <button class="btn-create-context" id="create-context-btn" disabled>
                    Create Context Text
                </button>
                <button class="btn-copy-context" id="copy-context-btn" style="display: none;">
                    Copy Context
                </button>
            </div>
            <div class="context-output" id="context-output" style="display: none;">
                <h5>Generated Context:</h5>
                <textarea id="context-textarea" readonly rows="8"></textarea>
            </div>
        </div>
    `;

    const html = results.map((result, index) => {
        const metadata = result.metadata || {};
        const textPreview = result.text.length > 200 ?
            result.text.substring(0, 200) + '...' : result.text;

        return `
            <div class="result-item" data-full-text="${escapeHtml(result.text)}" data-result-index="${index}">
                <div class="result-header">
                    <div class="result-checkbox">
                        <input type="checkbox" id="result-checkbox-${index}" data-result-index="${index}" />
                        <label for="result-checkbox-${index}"></label>
                    </div>
                    <div class="result-info">
                        <div class="result-score">Match: ${(result.score * 100).toFixed(1)}%</div>
                        ${searchedAll && result.database_name ?
                            `<div class="result-database">DB: ${escapeHtml(result.database_name)}</div>` : ''}
                    </div>
                    <div class="result-actions">
                        ${result.text.length > 200 ?
                            `<button class="btn-expand" data-result-index="${index}">
                                <span class="expand-text">Show Full</span>
                            </button>` : ''}
                        <button class="btn-copy" data-full-text="${escapeHtml(result.text)}">Copy</button>
                    </div>
                </div>

                <div class="result-content">
                    <div class="result-text" id="result-text-${index}">
                        ${escapeHtml(textPreview)}
                    </div>
                </div>

                ${metadata.url || metadata.title || metadata.domain || metadata.added_at || (metadata.tags && metadata.tags.length > 0) ? `
                    <div class="result-metadata">
                        ${metadata.title ? `<div class="metadata-item">
                            <strong>Page:</strong> ${escapeHtml(metadata.title)}
                        </div>` : ''}
                        ${metadata.domain ? `<div class="metadata-item">
                            <strong>Site:</strong> ${escapeHtml(metadata.domain)}
                        </div>` : ''}
                        ${metadata.url ? `<div class="metadata-item">
                            <strong>URL:</strong> <a href="${escapeHtml(metadata.url)}" target="_blank" class="result-link">
                                ${escapeHtml(metadata.url.length > 50 ? metadata.url.substring(0, 50) + '...' : metadata.url)}
                            </a>
                        </div>` : ''}
                        ${metadata.added_at ? `<div class="metadata-item">
                            <strong>Saved:</strong> ${new Date(metadata.added_at).toLocaleDateString()}
                        </div>` : ''}
                        ${metadata.tags && metadata.tags.length > 0 ? `<div class="metadata-item">
                            <strong>Tags:</strong> ${metadata.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ')}
                        </div>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    // Add results summary
    const searchSummary = searchedAll ?
        `<div class="search-summary">Found ${results.length} results with 30%+ similarity across all databases</div>` :
        `<div class="search-summary">Found ${results.length} results with 30%+ similarity</div>`;

    // Clear selected results when rendering new results
    selectedResults.clear();

    searchResults.innerHTML = contextSection + searchSummary + html;

    // Add event listeners after HTML is inserted
    setupSearchResultEventListeners();
}

// Toggle full text display
function toggleFullText(index) {
    const textElement = document.getElementById(`result-text-${index}`);
    const expandBtn = textElement.closest('.result-item').querySelector('.btn-expand .expand-text');
    const fullText = textElement.closest('.result-item').getAttribute('data-full-text');
    const shortText = fullText.length > 200 ? fullText.substring(0, 200) + '...' : fullText;

    if (expandBtn.textContent === 'Show Full') {
        textElement.innerHTML = escapeHtml(decodeHtml(fullText));
        expandBtn.textContent = 'Show Less';
    } else {
        textElement.innerHTML = escapeHtml(decodeHtml(shortText));
        expandBtn.textContent = 'Show Full';
    }
};

// Copy text to clipboard
async function copyToClipboard(text) {
    try {
        const decodedText = decodeHtml(text);
        await navigator.clipboard.writeText(decodedText);
        showNotification('Text copied to clipboard!');
    } catch (error) {
        console.error('Failed to copy text:', error);
        showNotification('Failed to copy text', 'error');
    }
};

// Toggle result selection
function toggleResultSelection(index) {
    const checkbox = document.getElementById(`result-checkbox-${index}`);
    const resultItem = document.querySelector(`[data-result-index="${index}"]`);

    if (checkbox && checkbox.checked) {
        selectedResults.add(index);
        if (resultItem) resultItem.classList.add('selected');
    } else if (checkbox) {
        selectedResults.delete(index);
        if (resultItem) resultItem.classList.remove('selected');
    }

    updateSelectionUI();
}

// Select all results
function selectAllResults(totalResults) {
    selectedResults.clear();

    // Find all checkboxes that actually exist
    const checkboxes = document.querySelectorAll('[id^="result-checkbox-"]');

    checkboxes.forEach((checkbox, index) => {
        const resultIndex = parseInt(checkbox.id.replace('result-checkbox-', ''));
        const resultItem = document.querySelector(`[data-result-index="${resultIndex}"]`);

        if (checkbox && resultItem) {
            checkbox.checked = true;
            selectedResults.add(resultIndex);
            resultItem.classList.add('selected');
        }
    });

    updateSelectionUI();
}

// Clear selection
function clearSelection() {
    selectedResults.clear();

    // Uncheck all checkboxes
    document.querySelectorAll('[id^="result-checkbox-"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Remove selected class
    document.querySelectorAll('.result-item.selected').forEach(item => {
        item.classList.remove('selected');
    });

    updateSelectionUI();

    // Hide context output
    const contextOutput = document.getElementById('context-output');
    const copyContextBtn = document.getElementById('copy-context-btn');
    if (contextOutput) contextOutput.style.display = 'none';
    if (copyContextBtn) copyContextBtn.style.display = 'none';
}

// Update selection UI
function updateSelectionUI() {
    const selectedCount = selectedResults.size;
    const selectedCountEl = document.getElementById('selected-count');
    const createContextBtn = document.getElementById('create-context-btn');

    if (selectedCountEl) selectedCountEl.textContent = selectedCount;
    if (createContextBtn) createContextBtn.disabled = selectedCount === 0;
}

// Create context text from selected results
function createContextText() {
    if (selectedResults.size === 0) {
        showNotification('Please select at least one result', 'error');
        return;
    }

    let contextText = "# Context Information\n\n";
    contextText += "The following information has been retrieved from your knowledge base:\n\n";

    let contextNumber = 1;
    selectedResults.forEach(index => {
        const resultItem = document.querySelector(`[data-result-index="${index}"]`);
        if (resultItem) {
            const fullText = resultItem.getAttribute('data-full-text');
            const scoreEl = resultItem.querySelector('.result-score');
            const score = scoreEl ? scoreEl.textContent : 'N/A';

            contextText += `## Context ${contextNumber}\n`;
            contextText += `**Relevance**: ${score}\n\n`;
            contextText += `${decodeHtml(fullText)}\n\n`;
            contextText += "---\n\n";

            contextNumber++;
        }
    });

    contextText += "Please use this context information to answer questions or provide insights.\n";

    // Display the context
    const contextOutput = document.getElementById('context-output');
    const contextTextarea = document.getElementById('context-textarea');
    const copyContextBtn = document.getElementById('copy-context-btn');

    if (contextTextarea) contextTextarea.value = contextText;
    if (contextOutput) contextOutput.style.display = 'block';
    if (copyContextBtn) copyContextBtn.style.display = 'inline-block';

    showNotification(`Context created from ${selectedResults.size} selected results`);
};

// Copy context text to clipboard
async function copyContextText() {
    const contextTextarea = document.getElementById('context-textarea');
    if (contextTextarea && contextTextarea.value) {
        try {
            await navigator.clipboard.writeText(contextTextarea.value);
            showNotification('Context text copied to clipboard');
        } catch (error) {
            console.error('Failed to copy context text:', error);
            showNotification('Failed to copy context text', 'error');
        }
    }
}

// Decode HTML entities
function decodeHtml(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

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
