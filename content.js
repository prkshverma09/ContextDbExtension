// Content script for handling text selection and right-side panel integration

let selectedText = '';
let sidePanel = null;
let serverUrl = 'http://127.0.0.1:8000';
let enableContextMenu = true;
let selectedDatabase = null;
let isPanelOpen = false;

// Initialize content script
(function() {
    loadSettings();
    setupEventListeners();
    createSidePanel();
})();

// Load settings from extension storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['serverUrl', 'enableContextMenu', 'selectedDatabase']);
        serverUrl = result.serverUrl || 'http://127.0.0.1:8000';
        enableContextMenu = result.enableContextMenu !== false;
        selectedDatabase = result.selectedDatabase;
    } catch (error) {
        console.error('Error loading settings in content script:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Listen for text selection
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', handleTextSelection);

    // Listen for clicks outside panel
    document.addEventListener('click', handleDocumentClick);

    // Listen for escape key to hide panel
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideSidePanel();
        }
    });

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            if (changes.serverUrl) serverUrl = changes.serverUrl.newValue;
            if (changes.enableContextMenu) enableContextMenu = changes.enableContextMenu.newValue;
            if (changes.selectedDatabase) selectedDatabase = changes.selectedDatabase.newValue;
        }
    });
}

// Handle text selection
function handleTextSelection(e) {
    // Small delay to ensure selection is complete
    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text && text.length > 3) { // Minimum 3 characters
            selectedText = text;
            showSidePanel();
            updatePanelWithSelectedText();
        } else if (!text) {
            // Don't auto-hide panel when deselecting - let user control it
            clearSelectedText();
        }
    }, 100);
}

// Handle clicks outside panel
function handleDocumentClick(e) {
    // Don't auto-hide to prevent re-opening issues
    if (sidePanel && !sidePanel.contains(e.target)) {
        // Optional: You can enable auto-hide here if needed
        // const selection = window.getSelection();
        // if (!selection.toString().trim() && e.clientX < window.innerWidth - 450) {
        //     hideSidePanel();
        // }
    }
}

// Create side panel (called once on page load)
function createSidePanel() {
    if (sidePanel) return; // Already exists

    if (!enableContextMenu) return;

    // Create panel element
    sidePanel = document.createElement('div');
    sidePanel.className = 'contextdb-side-panel';
    sidePanel.innerHTML = createPanelHTML();

    // Add to document
    document.body.appendChild(sidePanel);

    // Add event listeners to panel buttons
    setupPanelEventListeners();

    // Prevent panel from interfering with text selection
    sidePanel.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });

    sidePanel.addEventListener('mouseup', (e) => {
        e.stopPropagation();
    });

    sidePanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Show side panel
function showSidePanel() {
    if (!sidePanel) createSidePanel();

    if (!isPanelOpen) {
        sidePanel.classList.add('contextdb-panel-open');
        isPanelOpen = true;

        // Load databases for dropdown
        loadDatabasesForPanel();
    }
}

// Create panel HTML
function createPanelHTML() {
    return `
        <div class="contextdb-panel-content">
            <div class="contextdb-panel-header">
                <h3>Context DB Manager</h3>
                <div class="contextdb-panel-controls">
                    <button class="contextdb-minimize-btn" title="Minimize">−</button>
                    <button class="contextdb-close-btn" title="Close">&times;</button>
                </div>
            </div>

            <div class="contextdb-panel-body">
                <div class="contextdb-selected-text" id="contextdb-selected-text" style="display: none;">
                    <div class="contextdb-section-header">Selected Text</div>
                    <div class="contextdb-text-preview" id="contextdb-text-preview"></div>
                    <button class="contextdb-clear-text-btn" id="contextdb-clear-text">Clear Selection</button>
                </div>

                <div class="contextdb-form-section">
                    <div class="contextdb-section-header">Save to Database</div>

                    <div class="contextdb-form-group">
                        <label for="contextdb-database-select">Choose database:</label>
                        <select id="contextdb-database-select">
                            <option value="">Loading databases...</option>
                        </select>
                    </div>

                    <div class="contextdb-form-group">
                        <label for="contextdb-new-database">Or create new:</label>
                        <input type="text" id="contextdb-new-database" placeholder="New database name">
                    </div>

                    <div class="contextdb-form-group">
                        <label for="contextdb-tags">Tags (optional):</label>
                        <input type="text" id="contextdb-tags" placeholder="tag1, tag2, tag3">
                    </div>

                    <button id="contextdb-save-btn" class="contextdb-btn contextdb-btn-primary" disabled>
                        Save Selected Text
                    </button>
                </div>

                <div class="contextdb-quick-actions">
                    <div class="contextdb-section-header">Quick Actions</div>
                    <button id="contextdb-open-popup" class="contextdb-btn contextdb-btn-secondary">
                        Open Extension Popup
                    </button>
                </div>
            </div>

            <div class="contextdb-panel-loading" id="contextdb-loading" style="display: none;">
                <div class="contextdb-spinner"></div>
                <span>Saving...</span>
            </div>

            <div class="contextdb-panel-status" id="contextdb-status"></div>
        </div>
    `;
}

// Update panel with selected text
function updatePanelWithSelectedText() {
    if (!sidePanel) return;

    const selectedTextDiv = sidePanel.querySelector('#contextdb-selected-text');
    const textPreview = sidePanel.querySelector('#contextdb-text-preview');
    const saveBtn = sidePanel.querySelector('#contextdb-save-btn');

    if (selectedText) {
        const preview = selectedText.length > 200
            ? selectedText.substring(0, 200) + '...'
            : selectedText;

        textPreview.innerHTML = `"${escapeHtml(preview)}"`;
        selectedTextDiv.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Selected Text';
    }
}

// Clear selected text
function clearSelectedText() {
    selectedText = '';
    if (!sidePanel) return;

    const selectedTextDiv = sidePanel.querySelector('#contextdb-selected-text');
    const textPreview = sidePanel.querySelector('#contextdb-text-preview');
    const saveBtn = sidePanel.querySelector('#contextdb-save-btn');

    // Hide selected text section
    if (selectedTextDiv) selectedTextDiv.style.display = 'none';
    if (textPreview) textPreview.innerHTML = '';

    // Reset save button
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Save Selected Text';
    }

    // Clear text selection on page
    clearSelection();
}

// Hide side panel
function hideSidePanel() {
    if (sidePanel && isPanelOpen) {
        // Clear any stuck loading states when hiding panel
        forceHideLoadingState();

        sidePanel.classList.remove('contextdb-panel-open');
        isPanelOpen = false;
    }
}

// Setup panel event listeners
function setupPanelEventListeners() {
    const saveBtn = sidePanel.querySelector('#contextdb-save-btn');
    const closeBtn = sidePanel.querySelector('.contextdb-close-btn');
    const minimizeBtn = sidePanel.querySelector('.contextdb-minimize-btn');
    const clearTextBtn = sidePanel.querySelector('#contextdb-clear-text');
    const openPopupBtn = sidePanel.querySelector('#contextdb-open-popup');
    const newDbInput = sidePanel.querySelector('#contextdb-new-database');
    const dbSelect = sidePanel.querySelector('#contextdb-database-select');

    saveBtn.addEventListener('click', saveTextToDatabase);
    closeBtn.addEventListener('click', hideSidePanel);
    minimizeBtn.addEventListener('click', togglePanelMinimized);
    clearTextBtn.addEventListener('click', clearSelectedText);
    openPopupBtn.addEventListener('click', openExtensionPopup);

    // Clear new database input when selecting existing database
    dbSelect.addEventListener('change', () => {
        if (dbSelect.value) {
            newDbInput.value = '';
        }
    });

    // Clear select when typing in new database input
    newDbInput.addEventListener('input', () => {
        if (newDbInput.value.trim()) {
            dbSelect.value = '';
        }
    });

    // Save on Enter key in new database input
    newDbInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveTextToDatabase();
        }
    });
}

// Toggle panel minimized state
function togglePanelMinimized() {
    if (sidePanel) {
        sidePanel.classList.toggle('contextdb-panel-minimized');
    }
}

// Open extension popup
function openExtensionPopup() {
    // This will be handled by the background script
    chrome.runtime.sendMessage({ action: 'openPopup' });
}

// Load databases for panel dropdown
async function loadDatabasesForPanel() {
    const select = sidePanel.querySelector('#contextdb-database-select');

    try {
        const response = await fetch(`${serverUrl}/databases`);
        if (!response.ok) throw new Error('Failed to fetch databases');

        const databases = await response.json();

        select.innerHTML = '<option value="">Select existing database</option>';
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db.name;
            option.textContent = `${db.name} (${db.document_count} documents)`;
            select.appendChild(option);
        });

        // Pre-select if there's a selected database
        if (selectedDatabase) {
            select.value = selectedDatabase;
        }
    } catch (error) {
        console.error('Error loading databases:', error);
        select.innerHTML = '<option value="">Error loading databases</option>';
    }
}

// Save selected text to database
async function saveTextToDatabase() {
    const dbSelect = sidePanel.querySelector('#contextdb-database-select');
    const newDbInput = sidePanel.querySelector('#contextdb-new-database');
    const tagsInput = sidePanel.querySelector('#contextdb-tags');
    const loadingDiv = sidePanel.querySelector('#contextdb-loading');
    const panelBody = sidePanel.querySelector('.contextdb-panel-body');
    const saveBtn = sidePanel.querySelector('#contextdb-save-btn');

    if (!selectedText || !selectedText.trim()) {
        showPanelNotification('Please select some text first', 'error');
        return;
    }

    let databaseName = dbSelect.value || newDbInput.value.trim();

    if (!databaseName) {
        showPanelNotification('Please select a database or create a new one', 'error');
        return;
    }

    const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);

    // Show loading state
    loadingDiv.style.display = 'flex';
    panelBody.style.opacity = '0.6';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        // Get current page URL and title for metadata
        const pageUrl = window.location.href;
        const pageTitle = document.title;

        const requestData = {
            database_name: databaseName,
            text: selectedText,
            metadata: {
                url: pageUrl,
                title: pageTitle,
                timestamp: new Date().toISOString(),
                tags: tags
            }
        };

        const response = await fetch(`${serverUrl}/add-text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Save successful:', result);

        // Clear the form after successful save
        dbSelect.value = '';
        newDbInput.value = '';
        tagsInput.value = '';

        // Clear selected text and hide section
        clearSelectedText();

        // Show success message
        showPanelNotification(`Text saved successfully to "${databaseName}" database!`, 'success');

        // Refresh the databases list
        setTimeout(() => {
            loadDatabasesForPanel();
        }, 500);

    } catch (error) {
        console.error('Error saving text:', error);
        showPanelNotification(`Error saving text: ${error.message}`, 'error');
    } finally {
        // Always hide loading state and restore UI
        console.log('Finally block: clearing loading state');
        console.log('loadingDiv found:', !!loadingDiv);
        console.log('panelBody found:', !!panelBody);
        console.log('saveBtn found:', !!saveBtn);

        if (loadingDiv) {
            loadingDiv.style.display = 'none';
            console.log('Loading div hidden');
        }
        if (panelBody) {
            panelBody.style.opacity = '1';
            console.log('Panel body opacity restored');
        }
        if (saveBtn) {
            saveBtn.disabled = selectedText ? false : true;
            saveBtn.textContent = 'Save Selected Text';
            console.log('Save button restored');
        }

        // Force clear any stuck loading states
        const allLoadingDivs = document.querySelectorAll('#contextdb-loading');
        allLoadingDivs.forEach((div, index) => {
            console.log(`Forcing loading div ${index} to hide`);
            div.style.display = 'none';
        });
    }
}

// Force clear loading state (utility function)
function forceHideLoadingState() {
    console.log('forceHideLoadingState called');

    // Clear loading from current side panel
    if (sidePanel) {
        const loadingDiv = sidePanel.querySelector('#contextdb-loading');
        const panelBody = sidePanel.querySelector('.contextdb-panel-body');
        const saveBtn = sidePanel.querySelector('#contextdb-save-btn');

        if (loadingDiv) {
            loadingDiv.style.display = 'none';
            console.log('Current panel loading cleared');
        }
        if (panelBody) {
            panelBody.style.opacity = '1';
        }
        if (saveBtn) {
            saveBtn.disabled = selectedText ? false : true;
            saveBtn.textContent = 'Save Selected Text';
        }
    }

    // Force clear any orphaned loading divs
    const allLoadingDivs = document.querySelectorAll('#contextdb-loading');
    allLoadingDivs.forEach((div, index) => {
        console.log(`Clearing orphaned loading div ${index}`);
        div.style.display = 'none';
    });

    const allPanelBodies = document.querySelectorAll('.contextdb-panel-body');
    allPanelBodies.forEach((body, index) => {
        console.log(`Restoring panel body ${index} opacity`);
        body.style.opacity = '1';
    });
}

// Show notification within panel
function showPanelNotification(message, type = 'success') {
    if (!sidePanel) return;

    // Ensure loading state is cleared when showing notifications
    forceHideLoadingState();

    const statusDiv = sidePanel.querySelector('#contextdb-status');
    if (!statusDiv) return;

    // Clear any existing notification
    statusDiv.style.display = 'none';
    statusDiv.className = 'contextdb-panel-status';

    // Set new notification with small delay to ensure visibility
    setTimeout(() => {
        statusDiv.className = `contextdb-panel-status ${type}`;
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';

        console.log(`Panel notification: ${message} (${type})`);

        // Auto-remove notification after 4 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
            statusDiv.textContent = '';
            statusDiv.className = 'contextdb-panel-status';
        }, 4000);
    }, 100);
}

// Clear text selection
function clearSelection() {
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make force clear function globally available for debugging
// User can run: contextDbForceHideLoading() in console if loading gets stuck
window.contextDbForceHideLoading = forceHideLoadingState;

console.log('Context DB extension loaded. Use contextDbForceHideLoading() to clear stuck loading states.');

