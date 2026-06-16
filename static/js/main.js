// Application State
let releaseNotes = [];
let filteredNotes = [];
let currentFilters = {
    search: '',
    type: 'all',
    sort: 'newest'
};
let selectedNoteForTweet = null;
let lastRefreshedTime = null;
let liveTimeInterval = null;
let remoteFeedUpdatedString = '';

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const exportBtn = document.getElementById('export-btn');
const lastUpdatedBadge = document.getElementById('last-updated-badge');
const updatesList = document.getElementById('updates-list');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const resultsCount = document.getElementById('results-count');
const toastContainer = document.getElementById('toast-container');

// Stats Counters
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statIssues = document.getElementById('stat-issues');
const statDeprecations = document.getElementById('stat-deprecations');
const statCards = document.querySelectorAll('.stat-card');

// Filter Chips
const filterChips = document.querySelectorAll('.filter-chip');

// Tweet Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charNow = document.getElementById('char-now');
const charMax = document.getElementById('char-max');
const charGaugeBar = document.getElementById('char-gauge-bar');
const tweetWarning = document.getElementById('tweet-warning');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSubmitBtn = document.getElementById('modal-submit-btn');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
    startAutoSync(); // Begin real-time background synchronization
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh Button
    refreshBtn.addEventListener('click', fetchReleaseNotes);

    // Export CSV Button
    exportBtn.addEventListener('click', exportToCSV);

    // Search Input
    searchInput.addEventListener('input', (e) => {
        currentFilters.search = e.target.value.trim().toLowerCase();
        applyFiltersAndRender();
    });

    // Sort Dropdown
    sortSelect.addEventListener('change', (e) => {
        currentFilters.sort = e.value || e.target.value;
        applyFiltersAndRender();
    });

    // Filter Chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilters.type = chip.dataset.type;
            applyFiltersAndRender();
        });
    });

    // Clickable Stats Cards (Filters by category)
    statCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            currentFilters.type = category;
            
            // Sync with filter chips
            filterChips.forEach(chip => {
                if (chip.dataset.type === category) {
                    chip.classList.add('active');
                } else {
                    chip.classList.remove('active');
                }
            });
            applyFiltersAndRender();
        });
    });

    // Modal Close Triggers
    modalCloseBtn.addEventListener('click', closeTweetModal);
    modalCancelBtn.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });

    // Tweet Textarea Typing Validation
    tweetTextarea.addEventListener('input', validateTweetLength);

    // Post to X Trigger
    modalSubmitBtn.addEventListener('click', submitTweet);
}

// Fetch Release Notes from Flask API
async function fetchReleaseNotes() {
    showLoadingState();
    try {
        const response = await fetch('/api/release-notes');
        if (!response.ok) throw new Error('API request failed');
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        releaseNotes = data.updates || [];
        lastRefreshedTime = new Date();
        remoteFeedUpdatedString = data.last_updated || '';
        startLiveTimeIndicator();
        calculateStatistics();
        applyFiltersAndRender();
        
        showToast('Successfully fetched BigQuery updates!', 'success');
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showToast('Error fetching updates. Please try again.', 'error');
        showErrorState();
    } finally {
        hideLoadingState();
    }
}

// Show skeleton loaders
function showLoadingState() {
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;
    
    updatesList.innerHTML = Array(4).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-header">
                <div class="skeleton-badge"></div>
                <div class="skeleton-date"></div>
            </div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-actions">
                <div class="skeleton-btn"></div>
                <div class="skeleton-btn"></div>
            </div>
        </div>
    `).join('');
}

function hideLoadingState() {
    refreshBtn.classList.remove('loading');
    refreshBtn.disabled = false;
}

// Show error state placeholder in UI
function showErrorState() {
    updatesList.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <h3>Unable to Load Updates</h3>
            <p>We encountered an issue connecting to the BigQuery feed. Please verify your connection and click Refresh to try again.</p>
        </div>
    `;
}

// Live relative timer lifecycle
function startLiveTimeIndicator() {
    if (liveTimeInterval) clearInterval(liveTimeInterval);
    updateLastUpdatedTime();
    liveTimeInterval = setInterval(updateLastUpdatedTime, 10000); // refresh relative counter every 10 seconds
}

// Update Last Refreshed and Google Feed Time in IST
function updateLastUpdatedTime() {
    if (!lastRefreshedTime) {
        lastUpdatedBadge.querySelector('.text').textContent = 'Live Feed Active';
        return;
    }
    
    try {
        const now = new Date();
        const diffMs = now - lastRefreshedTime;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);

        let relativeStr = '';
        if (diffSec < 10) {
            relativeStr = 'Just now';
        } else if (diffSec < 60) {
            relativeStr = `${diffSec}s ago`;
        } else if (diffMin < 60) {
            relativeStr = `${diffMin}m ago`;
        } else if (diffHour < 24) {
            relativeStr = `${diffHour}h ago`;
        } else {
            relativeStr = `${Math.floor(diffHour / 24)}d ago`;
        }

        // Format remote Google feed publish timestamp to IST
        let feedIstString = 'Unknown';
        if (remoteFeedUpdatedString) {
            const feedDate = new Date(remoteFeedUpdatedString);
            const feedOptions = {
                timeZone: 'Asia/Kolkata',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            };
            feedIstString = feedDate.toLocaleString('en-US', feedOptions) + ' IST';
        }
        
        lastUpdatedBadge.querySelector('.text').textContent = `Feed: ${feedIstString} • Checked: ${relativeStr}`;
    } catch (e) {
        console.error('Error in live time indicator:', e);
        lastUpdatedBadge.querySelector('.text').textContent = 'Live Feed Active';
    }
}

// Background Real-Time Synchronization Lifecycle
let autoSyncInterval = null;

function startAutoSync() {
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    // Poll the backend every 60 seconds to check for new updates
    autoSyncInterval = setInterval(fetchReleaseNotesSilent, 60000);
}

async function fetchReleaseNotesSilent() {
    try {
        const response = await fetch('/api/release-notes');
        if (!response.ok) throw new Error('API pull failed');
        
        const data = await response.json();
        if (data.error) return;

        const newUpdates = data.updates || [];
        
        // Compare data signatures using arrays of update IDs to see if feed changed
        const currentSignature = JSON.stringify(releaseNotes.map(n => n.id));
        const newSignature = JSON.stringify(newUpdates.map(n => n.id));

        if (currentSignature !== newSignature) {
            // New updates detected on Google servers
            releaseNotes = newUpdates;
            lastRefreshedTime = new Date();
            remoteFeedUpdatedString = data.last_updated || '';
            calculateStatistics();
            applyFiltersAndRender();
            showToast('New BigQuery updates synced in real time!', 'success');
        } else {
            // Sync current clock reference silently (feed is unchanged)
            lastRefreshedTime = new Date();
            updateLastUpdatedTime();
        }
    } catch (error) {
        console.warn('Background auto-sync checking paused:', error);
    }
}

// Statistics Calculation
function calculateStatistics() {
    const total = releaseNotes.length;
    const features = releaseNotes.filter(n => n.type.toLowerCase() === 'feature').length;
    const issues = releaseNotes.filter(n => n.type.toLowerCase() === 'issue').length;
    const deprecations = releaseNotes.filter(n => n.type.toLowerCase() === 'deprecation').length;

    statTotal.textContent = total;
    statFeatures.textContent = features;
    statIssues.textContent = issues;
    statDeprecations.textContent = deprecations;
}

// Filter and Sort Engine
function applyFiltersAndRender() {
    filteredNotes = releaseNotes.filter(note => {
        // Search Filter
        const matchesSearch = currentFilters.search === '' || 
            note.text.toLowerCase().includes(currentFilters.search) || 
            note.type.toLowerCase().includes(currentFilters.search) ||
            note.date.toLowerCase().includes(currentFilters.search);
        
        // Category Filter
        let matchesType = true;
        if (currentFilters.type !== 'all') {
            if (currentFilters.type === 'other') {
                const standardTypes = ['feature', 'issue', 'deprecation'];
                matchesType = !standardTypes.includes(note.type.toLowerCase());
            } else {
                matchesType = note.type.toLowerCase() === currentFilters.type;
            }
        }

        return matchesSearch && matchesType;
    });

    // Sorting logic (newest vs oldest)
    filteredNotes.sort((a, b) => {
        const dateA = new Date(a.raw_date || a.date);
        const dateB = new Date(b.raw_date || b.date);
        return currentFilters.sort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    renderUpdates();
}

// Render filtered cards to screen
function renderUpdates() {
    resultsCount.textContent = `Showing ${filteredNotes.length} update${filteredNotes.length === 1 ? '' : 's'}`;
    
    if (filteredNotes.length === 0) {
        updatesList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h3>No Updates Found</h3>
                <p>Try resetting your filters or modifying your search keywords.</p>
            </div>
        `;
        return;
    }

    updatesList.innerHTML = filteredNotes.map(note => {
        const typeClass = getCategoryClass(note.type);
        return `
            <article class="update-card type-${typeClass}" id="card-${note.id}">
                <div class="card-header-row">
                    <div class="badge-date-group">
                        <span class="category-badge">${escapeHtml(note.type)}</span>
                        <time class="card-date">${escapeHtml(note.date)}</time>
                    </div>
                </div>
                <div class="card-content">
                    ${note.html}
                </div>
                <div class="card-actions">
                    <button class="card-btn" onclick="copyCardLink('${note.id}', '${escapeHtml(note.link)}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        Copy Link
                    </button>
                    <button class="card-btn" onclick="copyCardText('${note.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy to Clipboard
                    </button>
                    <button class="card-btn btn-share-tweet" onclick="openTweetModal('${note.id}')">
                        <!-- Custom SVG for Twitter/X -->
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Draft Tweet
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

// Helpers
function getCategoryClass(type) {
    const t = type.toLowerCase();
    if (t === 'feature') return 'feature';
    if (t === 'issue') return 'issue';
    if (t === 'deprecation') return 'deprecation';
    return 'other';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// Clipboard Actions
function copyCardLink(id, link) {
    navigator.clipboard.writeText(link).then(() => {
        showToast('Link copied to clipboard!', 'success');
        highlightCardBorder(id);
    }).catch(err => {
        showToast('Failed to copy link.', 'error');
    });
}

function copyCardText(id) {
    const note = releaseNotes.find(n => n.id === id);
    if (!note) return;
    
    // Copy plain text representation
    const textToCopy = `BigQuery [${note.type.toUpperCase()}] (${note.date}):\n${note.text}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Update text copied!', 'success');
        highlightCardBorder(id);
    }).catch(err => {
        showToast('Failed to copy text.', 'error');
    });
}

// Highlight card border on success action
function highlightCardBorder(id) {
    const card = document.getElementById(`card-${id}`);
    if (card) {
        card.style.borderColor = 'var(--accent)';
        card.style.boxShadow = '0 0 15px var(--accent-glow)';
        setTimeout(() => {
            card.style.borderColor = '';
            card.style.boxShadow = '';
        }, 800);
    }
}

// Toast notification trigger
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 
        `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
         </svg>` : 
        `<svg class="toast-icon" style="color: var(--color-issue);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
         </svg>`;

    toast.innerHTML = `
        ${icon}
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Slide out and destroy
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}

// Modal actions: Social Share
function openTweetModal(id) {
    const note = releaseNotes.find(n => n.id === id);
    if (!note) return;
    
    selectedNoteForTweet = note;
    
    // Construct rich default Tweet layout
    const dateStr = note.date;
    const typeTag = note.type.toUpperCase();
    const actionEmoji = getCategoryEmoji(note.type);
    
    // Structure of base tweet
    const prefix = `BigQuery ${actionEmoji} [${typeTag}] (${dateStr}):\n`;
    const suffix = `\n\nDetails: ${note.link}`;
    
    // Maximum text length for content
    const baseLen = prefix.length + suffix.length;
    const maxDescLen = 280 - baseLen - 5; // 5 char buffer for safety
    
    let desc = note.text;
    if (desc.length > maxDescLen) {
        desc = desc.substring(0, maxDescLen - 3) + '...';
    }
    
    const draftText = `${prefix}${desc}${suffix}`;
    
    // Set text in area
    tweetTextarea.value = draftText;
    validateTweetLength();
    
    // Open modal
    tweetModal.classList.add('active');
    tweetTextarea.focus();
}

function getCategoryEmoji(type) {
    const t = type.toLowerCase();
    if (t === 'feature') return '🚀';
    if (t === 'issue') return '⚠️';
    if (t === 'deprecation') return '🛑';
    return '🔔';
}

function closeTweetModal() {
    tweetModal.classList.remove('active');
    selectedNoteForTweet = null;
}

// Real-time tweet length validation
function validateTweetLength() {
    const len = tweetTextarea.value.length;
    charNow.textContent = len;
    
    const percentage = Math.min((len / 280) * 100, 100);
    charGaugeBar.style.width = `${percentage}%`;
    
    if (len > 280) {
        charNow.classList.add('warning');
        charGaugeBar.classList.add('warning');
        tweetWarning.classList.remove('hidden');
    } else {
        charNow.classList.remove('warning');
        charGaugeBar.classList.remove('warning');
        tweetWarning.classList.add('hidden');
    }
}

// Open X Intent
function submitTweet() {
    const tweetText = tweetTextarea.value.trim();
    if (!tweetText) {
        showToast('Tweet content cannot be empty!', 'error');
        return;
    }
    
    const encodedText = encodeURIComponent(tweetText);
    const xIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    // Open in new tab
    window.open(xIntentUrl, '_blank', 'noopener,noreferrer');
    
    closeTweetModal();
    showToast('Redirected to X!', 'success');
}

// Client-Side CSV Export Function
function exportToCSV() {
    if (filteredNotes.length === 0) {
        showToast('No updates found to export.', 'error');
        return;
    }
    
    // CSV Header row
    const headers = ['ID', 'Date', 'Type', 'Content Text', 'Direct Link'];
    
    // Escape values helper
    const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        const stringVal = String(val);
        // Replace double quotes with escaped double quotes
        const escaped = stringVal.replace(/"/g, '""');
        return `"${escaped}"`;
    };
    
    // CSV content lines
    const csvRows = [
        headers.join(','),
        ...filteredNotes.map(note => [
            note.id,
            note.date,
            note.type,
            note.text,
            note.link
        ].map(escapeCSV).join(','))
    ];
    
    const csvContent = csvRows.join('\r\n');
    
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Dynamic file name with current date
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `bigquery_release_notes_${dateStr}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`Exported ${filteredNotes.length} updates successfully!`, 'success');
    } catch (err) {
        console.error('CSV Export Error:', err);
        showToast('Failed to export CSV file.', 'error');
    }
}
