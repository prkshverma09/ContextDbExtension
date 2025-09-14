// Content script for handling text selection and right-side panel integration

let selectedText = '';
let sidePanel = null;
let serverUrl = 'http://127.0.0.1:8000';
let enableContextMenu = true;
let selectedDatabase = null;
let isPanelOpen = false;

// New: panel/search state
let activePanelTab = 'add'; // 'add' | 'search'
let searchSelectedResults = new Set();
let searchMinScore = 0.3;
let searchLimit = 10;

// Initialize content script
(function() {
    loadSettings();
    setupEventListeners();
    createSidePanel();
})();

// Load settings from extension storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['serverUrl', 'enableContextMenu', 'selectedDatabase', 'activePanelTab', 'searchMinScore', 'searchLimit']);
        serverUrl = result.serverUrl || 'http://127.0.0.1:8000';
        enableContextMenu = result.enableContextMenu !== false;
        selectedDatabase = result.selectedDatabase;
        activePanelTab = result.activePanelTab || 'add';
        if (typeof result.searchMinScore === 'number') searchMinScore = result.searchMinScore;
        if (typeof result.searchLimit === 'number') searchLimit = result.searchLimit;
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
        // Don't react to Escape while typing in inputs/our panel widgets
        const target = e.target;
        const isInputLike = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (isInputLike) return;

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
    // Debug: log keyup targets and skip when typing in inputs/our panel
    try {
        const target = e && e.target;
        const isInputLike = !!(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable));
        const isInsidePanel = !!(sidePanel && target && sidePanel.contains(target));
        if (isInputLike || isInsidePanel) {
            // Do not run selection logic while user is typing in the side panel or any input field
            // console.log('[ContextDB] handleTextSelection: skip (typing)', target && target.id);
            return;
        }
    } catch {}

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

    // Load databases for dropdowns
        loadDatabasesForPanel();
        loadDatabasesForSearch();
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
                <!-- Add Content -->
                <div class="contextdb-tab-content" id="contextdb-tab-content-add">
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


                        <button id="contextdb-save-btn" class="contextdb-btn contextdb-btn-primary" disabled>
                            Save Selected Text
                        </button>
                        <div id="contextdb-save-status" style="margin-top: 8px; font-size: 13px; font-weight: 500; display: none;"></div>
                    </div>
                </div>

                <!-- Search Content -->
                <div class="contextdb-tab-content" id="contextdb-tab-content-search">
                    <div class="contextdb-section-header">Search Context</div>
                    <div class="contextdb-form-group">
                        <label for="contextdb-search-db">Choose database:</label>
                        <select id="contextdb-search-db">
                            <option value="">Select database to search</option>
                        </select>
                    </div>

                    <div class="contextdb-form-group">
                        <input type="text" id="contextdb-search-query" placeholder="Type to search (Cmd/Ctrl+K to focus)">
                    </div>

                    <div class="contextdb-form-group" style="display:flex; gap:8px; align-items:center;">
                        <select id="contextdb-search-limit" style="flex:0 0 120px;">
                            <option value="5">5 results</option>
                            <option value="10" selected>10 results</option>
                            <option value="20">20 results</option>
                        </select>
                        <select id="contextdb-search-minscore" style="flex:0 0 140px;">
                            <option value="0.3" selected>≥ 30% match</option>
                            <option value="0.5">≥ 50% match</option>
                            <option value="0.7">≥ 70% match</option>
                        </select>
                    </div>

                    <div class="contextdb-form-group" style="display:flex; gap:8px;">
                        <button id="contextdb-search-btn" class="contextdb-btn contextdb-btn-primary">Search</button>
                        <button id="contextdb-clear-results-btn" class="contextdb-btn" style="background:#e5e7eb; color:#374151; margin:0;">Clear Results</button>
                    </div>

                    <div id="contextdb-search-summary" style="padding: 0 20px 8px 20px; color:#6b7280; font-size:12px;"></div>

                    <div id="contextdb-search-results" style="padding: 0 20px 16px 20px;"></div>

                    <div id="contextdb-context-actions" style="padding: 0 20px 16px 20px; display:none;">
                        <div style="margin-bottom:8px; color:#374151; font-weight:500;">Selected: <span id="contextdb-selected-count">0</span> results</div>
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <button id="contextdb-select-all" class="contextdb-btn contextdb-btn-secondary" style="margin:0;">Select All</button>
                            <button id="contextdb-clear-selection" class="contextdb-btn" style="margin:0; background:#e5e7eb; color:#374151;">Clear</button>
                            <button id="contextdb-create-context" class="contextdb-btn contextdb-btn-primary" style="margin:0;" disabled>Create Context Text</button>
                        </div>
                        <div id="contextdb-context-output" style="display:none;">
                            <textarea id="contextdb-context-text" rows="8" style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px;"></textarea>
                            <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                                <button id="contextdb-copy-context" class="contextdb-btn contextdb-btn-secondary" style="margin:0; width:auto;">Copy Context</button>
                            </div>
                        </div>
                    </div>
                </div>
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
    const dbSelect = sidePanel.querySelector('#contextdb-database-select');

    if (selectedText) {
        const preview = selectedText.length > 200
            ? selectedText.substring(0, 200) + '...'
            : selectedText;

        textPreview.innerHTML = `"${escapeHtml(preview)}"`;
        selectedTextDiv.style.display = 'block';
        // Enable only if a database is selected
        if (saveBtn) {
            const hasDb = !!(dbSelect && dbSelect.value);
            saveBtn.disabled = !hasDb;
            saveBtn.textContent = 'Save Selected Text';
        }
    }
}

// Clear selected text
function clearSelectedText() {
    selectedText = '';
    if (!sidePanel) return;

    const selectedTextDiv = sidePanel.querySelector('#contextdb-selected-text');
    const textPreview = sidePanel.querySelector('#contextdb-text-preview');
    const saveBtn = sidePanel.querySelector('#contextdb-save-btn');
    const dbSelect = sidePanel.querySelector('#contextdb-database-select');

    // Hide selected text section
    if (selectedTextDiv) selectedTextDiv.style.display = 'none';
    if (textPreview) textPreview.innerHTML = '';

    // Reset save button
    if (saveBtn) {
        // Disabled regardless of DB when there is no selected text
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
    const dbSelect = sidePanel.querySelector('#contextdb-database-select');

    // Tabs
    const tabAdd = sidePanel.querySelector('#contextdb-tab-add');
    const tabSearch = sidePanel.querySelector('#contextdb-tab-search');
    if (tabAdd) {
        tabAdd.addEventListener('click', () => {
            console.log('Tab click: add');
            switchPanelTab('add');
        });
    }
    if (tabSearch) {
        tabSearch.addEventListener('click', () => {
            console.log('Tab click: search');
            switchPanelTab('search');
        });
    }
    // Apply initial tab
    switchPanelTab(activePanelTab);

    saveBtn.addEventListener('click', saveTextToDatabase);
    closeBtn.addEventListener('click', hideSidePanel);
    minimizeBtn.addEventListener('click', togglePanelMinimized);
    clearTextBtn.addEventListener('click', clearSelectedText);

    // Enable/disable save based on DB selection + presence of selected text
    if (dbSelect) {
        dbSelect.addEventListener('change', () => {
            const saveBtn2 = sidePanel.querySelector('#contextdb-save-btn');
            const hasDb = !!dbSelect.value;
            const hasText = !!(selectedText && selectedText.trim());
            if (saveBtn2) saveBtn2.disabled = !(hasDb && hasText);
        });
    }

    // Search tab listeners
    const searchDb = sidePanel.querySelector('#contextdb-search-db');
    const searchQuery = sidePanel.querySelector('#contextdb-search-query');
    const searchBtn = sidePanel.querySelector('#contextdb-search-btn');
    const limitSelect = sidePanel.querySelector('#contextdb-search-limit');
    const minScoreSelect = sidePanel.querySelector('#contextdb-search-minscore');

    // Load DBs for search dropdown
    loadDatabasesForSearch();

    // Persist controls
    limitSelect.value = String(searchLimit);
    minScoreSelect.value = String(searchMinScore);
    limitSelect.addEventListener('change', () => {
        searchLimit = parseInt(limitSelect.value, 10) || 10;
        chrome.storage.sync.set({ searchLimit }).catch(() => {});
    });
    minScoreSelect.addEventListener('change', () => {
        searchMinScore = parseFloat(minScoreSelect.value) || 0.3;
        chrome.storage.sync.set({ searchMinScore }).catch(() => {});
    });

    // Keyboard: Cmd/Ctrl+K focus search (only when not already focused)
    document.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
            // Do not steal focus if user is typing anywhere inside the panel already
            const target = e.target;
            const typingInPanel = !!(sidePanel && target && sidePanel.contains(target) && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable));
            if (typingInPanel) return;

            if (activePanelTab === 'search' && document.activeElement !== searchQuery) {
                e.preventDefault();
                searchQuery.focus();
            }
        }
    });

    // Search only on button click or Enter key
    searchBtn.addEventListener('click', (e) => {
        console.log('[ContextDB] Search button clicked');
        performPanelSearch();
    });
    searchQuery.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            console.log('[ContextDB] Enter pressed in search input');
            performPanelSearch();
        }
    });

    // Clear results button
    const clearResultsBtn = sidePanel.querySelector('#contextdb-clear-results-btn');
    if (clearResultsBtn) {
        clearResultsBtn.addEventListener('click', () => {
            console.log('[ContextDB] Clear results button clicked');
            clearSearchResults();
        });
    }
}

// Switch tabs
function switchPanelTab(tab) {
    console.log('switchPanelTab called with', tab);
    activePanelTab = tab;
    const addBtn = sidePanel.querySelector('#contextdb-tab-add');
    const searchBtn = sidePanel.querySelector('#contextdb-tab-search');
    const addContent = sidePanel.querySelector('#contextdb-tab-content-add');
    const searchContent = sidePanel.querySelector('#contextdb-tab-content-search');

    // If markup isn't present (older panel or single-pane), fail gracefully
    if (!addContent || !searchContent) {
        console.warn('Tab content containers not found; skipping tab switch');
        return;
    }

    if (tab === 'add') {
        if (addBtn) addBtn.classList.add('active');
        if (searchBtn) searchBtn.classList.remove('active');
        addContent.style.display = 'block';
        searchContent.style.display = 'none';
    } else {
        if (searchBtn) searchBtn.classList.add('active');
        if (addBtn) addBtn.classList.remove('active');
        searchContent.style.display = 'block';
        addContent.style.display = 'none';
        // Ensure search inputs are populated
        loadDatabasesForSearch();
    }
    chrome.storage.sync.set({ activePanelTab: tab }).catch(() => {});
}

// Load DBs for search dropdown
async function loadDatabasesForSearch() {
    const select = sidePanel.querySelector('#contextdb-search-db');
    const searchQuery = sidePanel.querySelector('#contextdb-search-query');

    if (!select) return;

    // Don't reload if user is currently typing in search box
    if (searchQuery && document.activeElement === searchQuery) {
        console.log('Skipping loadDatabasesForSearch - user is typing');
        return;
    }

    try {
        const response = await fetch(`${serverUrl}/databases`);
        if (!response.ok) throw new Error('Failed to fetch databases');
        const databases = await response.json();
        const options = [
            '<option value="">Select database to search</option>',
            '<option value="__ALL__">All databases</option>'
        ]
            .concat(databases.map(db => `<option value="${db.name}">${db.name}</option>`))
            .join('');
        select.innerHTML = options;
        if (selectedDatabase) select.value = selectedDatabase;
    } catch (e) {
        console.error('Error loading search databases:', e);
        select.innerHTML = '<option value="">Error loading databases</option>';
    }
}

// Perform search in panel
async function performPanelSearch() {
    const queryInput = sidePanel.querySelector('#contextdb-search-query');
    const dbSelect = sidePanel.querySelector('#contextdb-search-db');
    const resultsDiv = sidePanel.querySelector('#contextdb-search-results');
    const summaryDiv = sidePanel.querySelector('#contextdb-search-summary');
    const limitSelect = sidePanel.querySelector('#contextdb-search-limit');
    const minScoreSelect = sidePanel.querySelector('#contextdb-search-minscore');

    const query = queryInput.value.trim();
    if (!query) {
        resultsDiv.innerHTML = '<div style="color:#6b7280;">Enter a query to search.</div>';
        return;
    }

    const selectedDb = dbSelect.value;
    if (!selectedDb) {
        resultsDiv.innerHTML = '<div style="color:#6b7280;">Please select a database to search.</div>';
        return;
    }

    const limit = parseInt(limitSelect.value, 10) || 10;
    const minScore = parseFloat(minScoreSelect.value) || 0.3;

    resultsDiv.innerHTML = '<div style="color:#6b7280;">Searching...</div>';
    searchSelectedResults.clear();
    updateSearchSelectionUI();

    try {
        let allResults = [];
        if (selectedDb === '__ALL__') {
            // fetch DBs
            const dbResp = await fetch(`${serverUrl}/databases`);
            const dbs = dbResp.ok ? await dbResp.json() : [];
            const perDb = Math.max(5, Math.ceil(limit / Math.max(1, dbs.length)) + 1);
            const promises = dbs.map(async (db) => {
                try {
                    const resp = await fetch(`${serverUrl}/search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ database_name: db.name, query, limit: perDb, min_score: minScore })
                    });
                    if (!resp.ok) return [];
                    const res = await resp.json();
                    return res.map(r => ({ ...r, database_name: db.name }));
                } catch { return []; }
            });
            const resultsByDb = await Promise.all(promises);
            allResults = resultsByDb.flat();
        } else {
            // Search single database
            const resp = await fetch(`${serverUrl}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ database_name: selectedDb, query, limit, min_score: minScore })
            });
            allResults = resp.ok ? await resp.json() : [];
        }

        // sort & limit
        allResults.sort((a, b) => b.score - a.score);
        const limited = allResults.slice(0, limit);
        const searchAllDb = selectedDb === '__ALL__';
        summaryDiv.textContent = `Found ${limited.length} result${limited.length === 1 ? '' : 's'} with ≥ ${(minScore*100).toFixed(0)}% similarity${searchAllDb ? ' across all databases' : ''}.`;
        renderPanelSearchResults(limited, searchAllDb);
    } catch (e) {
        console.error('Panel search failed:', e);
        summaryDiv.textContent = '';
        resultsDiv.innerHTML = '<div style="color:#b91c1c;">Search failed. Please try again.</div>';
    }
}

function renderPanelSearchResults(results, searchedAll) {
    const resultsDiv = sidePanel.querySelector('#contextdb-search-results');
    const actions = sidePanel.querySelector('#contextdb-context-actions');
    if (!results || results.length === 0) {
        actions.style.display = 'none';
        resultsDiv.innerHTML = '<div style="color:#6b7280;">No results.</div>';
        return;
    }

    const html = results.map((r, idx) => {
        const textPreview = r.text.length > 180 ? `${escapeHtml(r.text.substring(0, 180))}…` : escapeHtml(r.text);
        const dbBadge = searchedAll && r.database_name ? `<span style=\"margin-left:8px; color:#3730a3; font-weight:600;\">DB: ${escapeHtml(r.database_name)}</span>` : '';
        return `
            <div class=\"contextdb-result-item\" data-result-index=\"${idx}\" data-full-text=\"${escapeHtml(r.text)}\">
                <div class=\"contextdb-result-header\">
                    <label style=\"display:flex; align-items:center; gap:8px;\">
                        <input type=\"checkbox\" class=\"contextdb-result-checkbox\" data-index=\"${idx}\">
                        <span class=\"contextdb-result-score\">Match: ${(r.score*100).toFixed(1)}%</span>
                        ${dbBadge}
                    </label>
                    <div class=\"contextdb-result-actions\">
                        <button class=\"contextdb-btn-sm contextdb-expand\" data-index=\"${idx}\">Show Full</button>
                        <button class=\"contextdb-btn-sm contextdb-copy\" data-text=\"${escapeHtml(r.text)}\">Copy</button>
                    </div>
                </div>
                <div class=\"contextdb-result-text\" id=\"contextdb-result-text-${idx}\">${textPreview}</div>
            </div>
        `;
    }).join('');
    resultsDiv.innerHTML = html;
    actions.style.display = '';

    // wire interactions
    resultsDiv.querySelectorAll('.contextdb-result-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const i = parseInt(e.target.dataset.index, 10);
            if (e.target.checked) searchSelectedResults.add(i); else searchSelectedResults.delete(i);
            updateSearchSelectionUI();
        });
    });
    resultsDiv.querySelectorAll('.contextdb-expand').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const i = parseInt(e.target.dataset.index, 10);
            const textEl = sidePanel.querySelector(`#contextdb-result-text-${i}`);
            const fullText = textEl.closest('.contextdb-result-item').getAttribute('data-full-text');
            const isExpanded = btn.textContent === 'Show Less';
            if (isExpanded) {
                const short = fullText.length > 180 ? `${escapeHtml(fullText.substring(0, 180))}…` : escapeHtml(fullText);
                textEl.innerHTML = short;
                btn.textContent = 'Show Full';
            } else {
                textEl.innerHTML = escapeHtml(fullText);
                btn.textContent = 'Show Less';
            }
        });
    });
    resultsDiv.querySelectorAll('.contextdb-copy').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const t = e.target.getAttribute('data-text');
            try { await navigator.clipboard.writeText(t); showPanelNotification('Text copied', 'success'); } catch {}
        });
    });

    // context actions
    sidePanel.querySelector('#contextdb-select-all').onclick = () => {
        searchSelectedResults.clear();
        resultsDiv.querySelectorAll('.contextdb-result-checkbox').forEach(cb => { cb.checked = true; searchSelectedResults.add(parseInt(cb.dataset.index, 10)); });
        updateSearchSelectionUI();
    };
    sidePanel.querySelector('#contextdb-clear-selection').onclick = () => {
        searchSelectedResults.clear();
        resultsDiv.querySelectorAll('.contextdb-result-checkbox').forEach(cb => { cb.checked = false; });
        updateSearchSelectionUI();
    };
    sidePanel.querySelector('#contextdb-create-context').onclick = () => {
        const textareas = [];
        const nodes = resultsDiv.querySelectorAll('.contextdb-result-item');
        let idx = 1;
        let ctx = '# Context Information\n\n';
        searchSelectedResults.forEach(i => {
            const item = nodes[i];
            if (!item) return;
            const fullText = item.getAttribute('data-full-text');
            const score = item.querySelector('.contextdb-result-score').textContent;
            ctx += `## Context ${idx}\n**Relevance**: ${score}\n\n${fullText}\n\n---\n\n`;
            idx += 1;
        });
        const out = sidePanel.querySelector('#contextdb-context-output');
        const ta = sidePanel.querySelector('#contextdb-context-text');
        ta.value = ctx;
        out.style.display = '';
        showPanelNotification(`Context created from ${searchSelectedResults.size} results`, 'success');
    };
    sidePanel.querySelector('#contextdb-copy-context').onclick = async () => {
        const ta = sidePanel.querySelector('#contextdb-context-text');
        try { await navigator.clipboard.writeText(ta.value); showPanelNotification('Context copied', 'success'); } catch {}
    };
}

function updateSearchSelectionUI() {
    const countEl = sidePanel.querySelector('#contextdb-selected-count');
    const createBtn = sidePanel.querySelector('#contextdb-create-context');
    if (countEl) countEl.textContent = String(searchSelectedResults.size);
    if (createBtn) createBtn.disabled = searchSelectedResults.size === 0;
}

// Clear all search results
function clearSearchResults() {
    if (!sidePanel) return;

    const resultsDiv = sidePanel.querySelector('#contextdb-search-results');
    const summaryDiv = sidePanel.querySelector('#contextdb-search-summary');
    const actions = sidePanel.querySelector('#contextdb-context-actions');

    // Clear results display
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
    }

    // Clear summary
    if (summaryDiv) {
        summaryDiv.textContent = '';
    }

    // Hide context actions
    if (actions) {
        actions.style.display = 'none';
    }

    // Clear selected results
    searchSelectedResults.clear();
    updateSearchSelectionUI();

    console.log('[ContextDB] Search results cleared');
}

// Show save status message under the save button
function showSaveStatus(message, type = 'success') {
    if (!sidePanel) return;

    const statusDiv = sidePanel.querySelector('#contextdb-save-status');
    if (!statusDiv) return;

    // Clear any existing status
    statusDiv.style.display = 'none';
    statusDiv.textContent = '';
    statusDiv.className = '';

    // Set new status with appropriate styling
    setTimeout(() => {
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';

        if (type === 'success') {
            statusDiv.style.color = '#059669'; // Green color
        } else if (type === 'error') {
            statusDiv.style.color = '#dc2626'; // Red color
        }

        console.log(`Save status: ${message} (${type})`);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
            statusDiv.textContent = '';
        }, 3000);
    }, 100);
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
    const panelBody = sidePanel.querySelector('.contextdb-panel-body');
    const saveBtn = sidePanel.querySelector('#contextdb-save-btn');

    if (!selectedText || !selectedText.trim()) {
        showPanelNotification('Please select some text first', 'error');
        return;
    }

    const databaseName = dbSelect.value;

    if (!databaseName) {
        showPanelNotification('Please select a database', 'error');
        return;
    }

    // Show saving state only via button and slight dimming (no modal)
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
                timestamp: new Date().toISOString()
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

        // Keep DB selection; just reset button based on selections

        // Show success message first
        showPanelNotification(`Text saved successfully to "${databaseName}" database!`, 'success');

        // Show green success message under save button
        showSaveStatus(`✓ Text saved successfully to "${databaseName}"`, 'success');

        // Clear selected text and hide section after showing success (with delay)
        setTimeout(() => {
            clearSelectedText();
        }, 2000); // Wait 2 seconds to let user see the notification

        // Refresh the databases list
        setTimeout(() => {
            loadDatabasesForPanel();
        }, 500);

    } catch (error) {
        console.error('Error saving text:', error);
        showPanelNotification(`Error saving text: ${error.message}`, 'error');
        showSaveStatus(`✗ Error: ${error.message}`, 'error');
    } finally {
        // Always hide loading state and restore UI
        console.log('Finally block: clearing loading state');
        console.log('panelBody found:', !!panelBody);
        console.log('saveBtn found:', !!saveBtn);

        if (panelBody) {
            panelBody.style.opacity = '1';
            console.log('Panel body opacity restored');
        }
        if (saveBtn) {
            const hasDb = !!(dbSelect && dbSelect.value);
            const hasText = !!(selectedText && selectedText.trim());
            saveBtn.disabled = !(hasDb && hasText);
            saveBtn.textContent = 'Save Selected Text';
            console.log('Save button restored');
        }
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
    statusDiv.style.setProperty('display', 'none', 'important');
    statusDiv.className = 'contextdb-panel-status';

    // Set new notification with small delay to ensure visibility
    setTimeout(() => {
        statusDiv.className = `contextdb-panel-status ${type}`;
        statusDiv.textContent = message;
        statusDiv.style.setProperty('display', 'block', 'important');

        console.log(`Panel notification: ${message} (${type})`);

        // Auto-remove notification after 4 seconds
        setTimeout(() => {
            statusDiv.style.setProperty('display', 'none', 'important');
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

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'refreshDatabases') {
        // Refresh database dropdowns if side panel is open
        if (isPanelOpen && sidePanel) {
            loadDatabasesForPanel();
            loadDatabasesForSearch();
        }
        sendResponse({ success: true });
    }
});

// Make force clear function globally available for debugging
// User can run: contextDbForceHideLoading() in console if loading gets stuck
window.contextDbForceHideLoading = forceHideLoadingState;

console.log('Context DB extension loaded. Use contextDbForceHideLoading() to clear stuck loading states.');

