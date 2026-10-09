// ==================== PREVIEW CACHE ====================
const previewCache = {};
// ==================== Toast Notification ====================
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (isError) toast.classList.add('error');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ==================== Copy to Clipboard ====================
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!');
        }).catch((err) => {
            showToast('Failed to copy', true);
            console.error('Copy error:', err);
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('Copied to clipboard!');
        } catch (e) {
            showToast('Failed to copy', true);
        }
        document.body.removeChild(textarea);
    }
}

// ==================== Share Memory ====================
window.shareMemory = function(content, type) {
    if (navigator.share) {
        navigator.share({
            title: 'Memory',
            text: content,
            url: type === 'link' ? content : undefined
        }).catch(console.error);
    } else {
        copyToClipboard(content);
    }
};

// ==================== Image Compression ====================
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > 1200) {
                    height = (height * 1200) / width;
                    width = 1200;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Base64 স্ট্রিং রিটার্ন করবে
                const base64Image = canvas.toDataURL('image/jpeg', 0.8);
                resolve(base64Image);
            };
        };
    });
}

// ==================== Wait for Firebase ====================
function waitForFirebase() {
    return new Promise((resolve) => {
        if (window.firebaseReady && window.auth && window.db) {
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (window.firebaseReady && window.auth && window.db) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
            setTimeout(() => {
                clearInterval(checkInterval);
                console.error('Firebase failed to initialize');
                resolve();
            }, 5000);
        }
    });
}

// ==================== Main App ====================
async function initializeApp() {
    // ----- Element references -----
    const noteInput = document.getElementById('noteInput');
    const linkInput = document.getElementById('linkInput');
    const saveBtn = document.getElementById('saveBtn');
    const aiSearchInput = document.getElementById('aiSearchInput');
    const aiSearchBtn = document.getElementById('aiSearchBtn');
    const memoriesList = document.getElementById('memoriesList');
    const getStartedBtn = document.getElementById('getStartedBtn');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const uploadArea = document.getElementById('uploadArea');
    const screenshotInput = document.getElementById('screenshotInput');
    const uploadBtn = document.getElementById('uploadBtn');

    let memories = [];
    let currentUser = null;
    let currentFilter = 'all';

    async function login() {
        try {
            const provider = new window.GoogleAuthProvider();
            await window.signInWithPopup(window.auth, provider);
            showToast('Welcome back!');
        } catch (error) {
            showToast("Login failed: " + error.message, true);
            console.error('Login error:', error);
        }
    }

    async function logout() {
        try {
            await window.signOut(window.auth);
            showToast('Logged out successfully');
        } catch (error) {
            showToast("Logout failed", true);
            console.error('Logout error:', error);
        }
    }

    async function loadMemories() {
    if (!currentUser) return;
    
    // Skeleton দেখাই
    showSkeletonLoader();
    
    // Offline হলে localStorage থেকে দেখাই
    if (!navigator.onLine) {
        const cached = localStorage.getItem('vaenorix_memories_' + currentUser.uid);
        if (cached) {
            try {
                memories = JSON.parse(cached);
                memories.sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return new Date(b.timestamp) - new Date(a.timestamp);
                });
                if (memoriesList) memoriesList.classList.remove('skeleton-mode');
                renderMemories();
                return;
            } catch (e) {
                console.error('Cache parse error:', e);
            }
        }
        if (memoriesList) {
            memoriesList.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-wifi"></i></div><h3 class="empty-state-title">You\'re offline</h3><p class="empty-state-text">Connect to the internet to load your memories.</p></div>';
        }
        return;
    }
    
    try {
        const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
        const q = window.query(memoriesRef, window.orderBy("timestamp", "desc"));
        const querySnapshot = await window.getDocs(q);
        memories = [];
        querySnapshot.forEach((doc) => {
            memories.push({ id: doc.id, ...doc.data() });
        });
        
        // localStorage-এ ক্যাশ করি
        try {
            localStorage.setItem('vaenorix_memories_' + currentUser.uid, JSON.stringify(memories));
        } catch (e) {
            console.error('Cache save error:', e);
        }
        
        // Pinned items আগে, তারপর timestamp অনুযায়ী
        memories.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        if (memoriesList) {
            memoriesList.classList.remove('skeleton-mode');
        }
        renderMemories();
    } catch (error) {
        // Error হলে ক্যাশ থেকে দেখাই
        const cached = localStorage.getItem('vaenorix_memories_' + currentUser.uid);
        if (cached) {
            try {
                memories = JSON.parse(cached);
                if (memoriesList) memoriesList.classList.remove('skeleton-mode');
                renderMemories();
                showToast("Showing cached data", true);
                return;
            } catch (e) {}
        }
        if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">Error loading memories</div>';
        showToast("Failed to load memories", true);
    }
}
    function showSkeletonLoader() {
    if (!memoriesList) return;
    memoriesList.classList.add('skeleton-mode');
    memoriesList.innerHTML = `
        <div class="skeleton-card">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line medium"></div>
        </div>
        <div class="skeleton-card">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line short"></div>
        </div>
        <div class="skeleton-card">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line long"></div>
        </div>
    `;
}
    
    async function editMemory(id, newContent) {
        if (!currentUser) return;
        try {
            const memoryRef = window.doc(window.db, `users/${currentUser.uid}/memories`, id);
            await window.updateDoc(memoryRef, { content: newContent });
            showToast('Memory updated');
            await loadMemories();
        } catch (error) {
            showToast("Failed to edit", true);
        }
    }

    async function fetchLinkPreview(url) {
    // Cache এ থাকলে সরাসরি ফেরত দিই
    if (previewCache[url]) return previewCache[url];
    
    try {
        const response = await fetch('/api/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        previewCache[url] = data; // Cache করে রাখি
        return data;
    } catch (error) {
        return null;
    }
    }

    async function deleteAllMemories() {
        if (!currentUser) {
            showToast('Please sign in first!', true);
            return;
        }
        try {
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            const querySnapshot = await window.getDocs(memoriesRef);
            for (const doc of querySnapshot.docs) {
                await window.deleteDoc(window.doc(window.db, `users/${currentUser.uid}/memories`, doc.id));
            }
            showToast('All memories cleared!');
            await loadMemories();
        } catch (error) {
            showToast('Failed to clear memories', true);
        }
    }
window.deleteAllMemories = deleteAllMemories;
    function renderMemories(filterText = '') {
        if (!currentUser || !memoriesList) return;
        if (memories.length === 0) {
            memoriesList.innerHTML = `
    <div class="empty-state">
        <div class="empty-state-icon">
            <i class="fas fa-lightbulb"></i>
        </div>
        <h3 class="empty-state-title">Your Second Brain is empty</h3>
        <p class="empty-state-text">Start by saving your first note, link, or screenshot. Everything you save will be searchable forever.</p>
        <button class="empty-state-btn" onclick="document.getElementById('noteInput').focus(); document.querySelector('.save-section').scrollIntoView({behavior:'smooth'});">
            <i class="fas fa-plus"></i> Save Your First Memory
        </button>
    </div>
`;
            return;
        }
        let filteredMemories = memories;
        if (currentFilter !== 'all') {
            filteredMemories = filteredMemories.filter(m => m.type === currentFilter);
        }
        if (filterText) {
            filteredMemories = filteredMemories.filter(m =>
                m.content.toLowerCase().includes(filterText.toLowerCase())
            );
        }
        const counterSpan = document.getElementById('memoryCount');
        if (counterSpan) counterSpan.textContent = `(${filteredMemories.length})`;
        if (filteredMemories.length === 0) {
            memoriesList.innerHTML = '<div class="empty-message">No memories found</div>';
            return;
        }
        memoriesList.innerHTML = filteredMemories.map((memory) => `
                    <div class="memory-card ${memory.pinned ? 'pinned' : ''} ${isSelectMode && selectedIds.includes(memory.id) ? 'selected' : ''}" data-memory-id="${memory.id}">
<div class="memory-header">
    <div class="memory-checkbox ${selectedIds.includes(memory.id) ? 'checked' : ''}" data-id="${memory.id}">
        <i class="fas fa-check"></i>
    </div>
    ${memory.pinned ? '<div class="pinned-badge"><i class="fas fa-star"></i> Pinned</div>' : ''}
    <div class="memory-type">${memory.type === 'note' ? 'Note' : memory.type === 'link' ? 'Link' : 'Image'}</div>
    <div class="memory-header-actions">
        <button class="pin-btn ${memory.pinned ? 'pinned' : ''}" data-id="${memory.id}" title="Pin">
            <i class="fas fa-star"></i>
        </button>
        <div class="menu-container">
            <button class="three-dots" data-id="${memory.id}">⋯</button>
            <div class="dropdown-menu" id="menu-${memory.id}">
                <button class="edit-btn" data-id="${memory.id}">Edit</button>
                <button class="share-btn" data-id="${memory.id}">Share</button>
                <button class="delete-btn-menu" data-id="${memory.id}">Delete</button>
            </div>
        </div>
    </div>
</div>
                <div class="memory-content">
                    ${memory.type === 'link' ?
                        `<a href="${memory.content}" target="_blank" class="memory-link">${memory.content}</a>
                         <div class="link-preview-container" data-url="${memory.content}">
                            <div class="loading-preview">Loading preview...</div>
                         </div>` :
                        memory.type === 'image' ?
                        `<div style="position: relative;">
                            <img src="${memory.content}" alt="Screenshot" class="clickable-image" onclick="showImageModal('${memory.content}')">
                            <button class="download-btn" onclick="downloadImage('${memory.content}')"><i class="fas fa-download"></i> Download</button>
                        </div>` :
                                        memory.content
            }
        </div>
        ${memory.tags && memory.tags.length > 0 ? `
            <div class="memory-tags">
                ${memory.tags.map(tag => `
                    <span class="memory-tag" data-tag="${tag}">${tag}</span>
                `).join('')}
            </div>
        ` : ''}
    </div>
`).join('');

        document.querySelectorAll('.link-preview-container').forEach(async (container) => {
            const url = container.getAttribute('data-url');
            const preview = await fetchLinkPreview(url);
            if (preview && preview.title) {
                container.innerHTML = `
                    <a href="${url}" target="_blank" class="link-preview">
                        ${preview.image ? `<img src="${preview.image}" class="link-preview-img" onerror="this.style.display='none'">` : ''}
                        <div class="link-preview-content">
                            <div class="link-preview-title">${preview.title.substring(0, 60)}</div>
                            <div class="link-preview-desc">${preview.description ? preview.description.substring(0, 80) : 'No description'}</div>
                        </div>
                    </a>
                `;
            } else {
                container.innerHTML = '';
            }
        });

        document.querySelectorAll('.three-dots').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
                const menu = document.getElementById(`menu-${id}`);
                if (menu) menu.classList.toggle('show');
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
const memory = memories.find(m => m.id === id);
if (memory) {
    window.openEditModal(id, memory.content);
}
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            });
        });

        document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = this.getAttribute('data-id');
        const memory = memories.find(m => m.id === id);
        if (memory) window.shareMemoryPublic(memory);
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    });
});

        document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = this.getAttribute('data-id');
        const memory = memories.find(m => m.id === id);
        if (memory) window.shareMemoryPublic(memory);
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    });
});

// ==================== PIN / STAR ====================
document.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const id = this.getAttribute('data-id');
        const memory = memories.find(m => m.id === id);
        if (!memory || !currentUser) return;
        
        const newPinnedState = !memory.pinned;
        
        try {
            const memoryRef = window.doc(window.db, `users/${currentUser.uid}/memories`, id);
            await window.updateDoc(memoryRef, { pinned: newPinnedState });
            
            memory.pinned = newPinnedState;
            
            // অ্যানিমেশন
            if (newPinnedState) {
                this.classList.add('pinned');
                showToast('⭐ Pinned to top');
            } else {
                this.classList.remove('pinned');
                showToast('Unpinned');
            }
            
            // পুনরায় সর্ট করে রেন্ডার
            sortAndRenderMemories();
        } catch (error) {
            console.error('Pin error:', error);
            showToast('Failed to pin', true);
        }
    });
});

// Pinned গুলো আগে দেখানোর জন্য সর্টিং
function sortAndRenderMemories() {
    // pinned গুলো আগে
    memories.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    if (typeof renderMemories === 'function') {
        renderMemories();
    }
                    }
    
// ==================== TAG FILTER ====================
document.querySelectorAll('.memory-tag').forEach(tagEl => {
    tagEl.addEventListener('click', function(e) {
        e.stopPropagation();
        const tag = this.getAttribute('data-tag');
        const filtered = memories.filter(m => m.tags && m.tags.includes(tag));
        
        // Indicator দেখাই
        const section = document.querySelector('.memories-section');
        let indicator = document.getElementById('tagFilterIndicator');
        if (indicator) indicator.remove();
        indicator = document.createElement('div');
        indicator.id = 'tagFilterIndicator';
        indicator.className = 'tag-filter-active';
        indicator.innerHTML = `<span>🏷️ #${tag} (${filtered.length})</span><button class="tag-filter-clear" id="tagClearBtn">✕</button>`;
        const filterButtons = section.querySelector('.filter-buttons');
        if (filterButtons) {
            filterButtons.parentNode.insertBefore(indicator, filterButtons.nextSibling);
        }
        
        document.getElementById('tagClearBtn').onclick = () => {
            indicator.remove();
            renderMemories();
        };
        
        const counterSpan = document.getElementById('memoryCount');
        if (counterSpan) counterSpan.textContent = `(${filtered.length})`;
        
        if (filtered.length === 0) {
            memoriesList.innerHTML = '<div class="empty-message">No memories with #' + tag + '</div>';
        } else {
            renderMemoriesWithData(filtered);
        }
        
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});
        const clearAllBtn = document.getElementById('clearAllBtn');
if (clearAllBtn) {
    clearAllBtn.onclick = () => {
        if (!currentUser) { showToast('Please sign in first!', true); return; }
        if (memories.length === 0) { showToast('No memories to clear', true); return; }
        window.openClearAllModal();
    };
}
    
// ==================== EXPORT DATA ====================
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
    exportBtn.onclick = () => {
        if (!currentUser) { 
            showToast('Please sign in first!', true); 
            return; 
        }
        if (memories.length === 0) { 
            showToast('No memories to export', true); 
            return; 
        }
        
        try {
            // JSON ফাইল তৈরি
            const dataStr = JSON.stringify({
                exported_at: new Date().toISOString(),
                user: currentUser.email,
                total_memories: memories.length,
                memories: memories
            }, null, 2);
            
            // ডাউনলোড লিংক তৈরি
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vaenorix-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('✅ Exported ' + memories.length + ' memories!');
        } catch (error) {
            showToast('Export failed: ' + error.message, true);
            console.error(error);
        }
    };
}
}
function renderMemoriesWithData(data) {
    if (!memoriesList) return;
    
    if (data.length === 0) {
        memoriesList.innerHTML = '<div class="empty-message">No memories found</div>';
        return;
    }
    
    memoriesList.innerHTML = data.map((memory) => `
<div class="memory-card ${memory.pinned ? 'pinned' : ''} ${isSelectMode && selectedIds.includes(memory.id) ? 'selected' : ''}" data-memory-id="${memory.id}">
    <div class="memory-header">
        <div class="memory-checkbox ${selectedIds.includes(memory.id) ? 'checked' : ''}" data-id="${memory.id}">
            <i class="fas fa-check"></i>
        </div>
                <div class="memory-type">${memory.type === 'note' ? 'Note' : memory.type === 'link' ? 'Link' : 'Image'}</div>
                <div class="menu-container">
                    <button class="three-dots" data-id="${memory.id}">⋯</button>
                    <div class="dropdown-menu" id="menu-${memory.id}">
                        <button class="edit-btn" data-id="${memory.id}">Edit</button>
                        <button class="share-btn" data-id="${memory.id}">Share</button>
                        <button class="delete-btn-menu" data-id="${memory.id}">Delete</button>
                    </div>
                </div>
            </div>
            <div class="memory-content">
                ${memory.type === 'link' ?
                    `<a href="${memory.content}" target="_blank" class="memory-link">${memory.content}</a>` :
                    memory.type === 'image' ?
                    `<div style="position: relative;">
                        <img src="${memory.content}" alt="Screenshot" class="clickable-image" onclick="showImageModal('${memory.content}')">
                    </div>` :
                    memory.content
                }
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.three-dots').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            const menu = document.getElementById(`menu-${id}`);
            if (menu) menu.classList.toggle('show');
        });
    });
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
const memory = memories.find(m => m.id === id);
if (memory) {
    window.openEditModal(id, memory.content);
}
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        });
    });
    
    document.querySelectorAll('.delete-btn-menu').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            deleteMemory(id);
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        });
    });
    
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            const memory = memories.find(m => m.id === id);
            if (memory) window.shareMemory(memory.content, memory.type);
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        });
    });
            }
    async function addMemory() {
        if (!currentUser) {
            showToast('Please sign in first!', true);
            login();
            return;
        }
        const note = noteInput ? noteInput.value.trim() : '';
        const link = linkInput ? linkInput.value.trim() : '';
        if (!note && !link) {
            showToast('Please write a note or paste a link', true);
            return;
        }
        let type = '';
        let content = '';
        if (note) {
            type = 'note';
            content = note;
            if (noteInput) noteInput.value = '';
        } else if (link) {
            type = 'link';
            content = link;
            if (linkInput) linkInput.value = '';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
            }
        }
        try {
    // ট্যাগ এক্সট্রাক্ট করি
    const tagRegex = /#([\w\u0980-\u09FF]+)/g;
    const foundTags = content.match(tagRegex) || [];
    const tags = foundTags.map(t => t.substring(1).toLowerCase());
    const uniqueTags = [...new Set(tags)];
    
    const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
    await window.addDoc(memoriesRef, {
        type: type,
        content: content,
        tags: uniqueTags,
        timestamp: new Date().toISOString()
    });
    showToast('Memory saved!' + (uniqueTags.length > 0 ? ' 🏷️ ' + uniqueTags.length + ' tags' : ''));
    await loadMemories();
} catch (error) {
    showToast("Failed to save", true);
} finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save to Second Brain';
            }
        }
    }

    function searchMemories() {
    if (!aiSearchInput || !currentUser) return;
    
    const query = aiSearchInput.value.trim().toLowerCase();
    const resultBox = document.getElementById('aiSearchResult');
    
    if (!query) {
        renderMemories();
        if (resultBox) { resultBox.classList.remove('show'); resultBox.innerHTML = ''; }
        return;
    }
    
    let detectedType = 'all';
    if (query.includes('link') || query.includes('লিংক') || query.includes('url')) detectedType = 'link';
    else if (query.includes('note') || query.includes('নোট') || query.includes('লেখা')) detectedType = 'note';
    else if (query.includes('image') || query.includes('ছবি') || query.includes('photo')) detectedType = 'image';
    
    const now = new Date();
    let dateFilter = null;
    let dateLabel = '';
    
    if (query.includes('today') || query.includes('আজ')) {
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateLabel = 'today';
    } else if (query.includes('yesterday') || query.includes('গতকাল')) {
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        dateLabel = 'yesterday';
    } else if (query.includes('last week')) {
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateLabel = 'this week';
    } else if (query.includes('last month')) {
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateLabel = 'this month';
    }
    
    let results = memories;
    if (detectedType !== 'all') results = results.filter(m => m.type === detectedType);
    if (dateFilter) results = results.filter(m => new Date(m.timestamp) >= dateFilter);
    
    if (detectedType === 'all' && !dateFilter) {
        const cleanQuery = query.replace(/show me|find|get|from|last|this|week|month|today|yesterday/g, '').trim();
        if (cleanQuery) results = results.filter(m => m.content.toLowerCase().includes(cleanQuery));
    }
    
    const counterSpan = document.getElementById('memoryCount');
    if (counterSpan) counterSpan.textContent = `(${results.length})`;
    
    if (results.length === 0) {
        memoriesList.innerHTML = '<div class="empty-message">🔍 No memories found</div>';
    } else {
        renderMemoriesWithData(results);
    }
    
    if (resultBox) {
        let msg = `🤖 Found <span class="ai-result-count">${results.length}</span> ${detectedType === 'all' ? 'memories' : detectedType + 's'}`;
        if (dateLabel) msg += ` from ${dateLabel}`;
        resultBox.innerHTML = `<div class="ai-result-text">${msg}</div>`;
        resultBox.classList.add('show');
        setTimeout(() => resultBox.classList.remove('show'), 4000);
    }
    }

    function scrollToSave() {
        const saveSection = document.querySelector('.save-section');
        if (saveSection) saveSection.scrollIntoView({ behavior: 'smooth' });
    }

    function initFilters() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        if (filterBtns.length === 0) return;
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                filterBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.getAttribute('data-filter');
                if (aiSearchInput) renderMemories(aiSearchInput.value.trim());
                else renderMemories();
            });
        });
    }

    async function handleScreenshotUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!currentUser) {
            showToast('Please sign in first!', true);
            if (screenshotInput) screenshotInput.value = '';
            return;
        }
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<span class="spinner"></span> Uploading...';
        }
        try {
            const base64Image = await compressImage(file);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image.split(',')[1] })
            });
            
            const data = await response.json();
            if (!data.success) throw new Error(data.error.message || 'Upload failed');
            
            const imageUrl = data.data.url;
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            await window.addDoc(memoriesRef, {
                type: 'image',
                content: imageUrl,
                timestamp: new Date().toISOString()
            });
            showToast('Screenshot saved!');
            await loadMemories();
        } catch (error) {
            showToast('Failed: ' + error.message, true);
            console.error(error);
        } finally {
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fas fa-camera"></i> Upload Screenshot';
            }
            if (screenshotInput) screenshotInput.value = '';
        }
    }
    // ==================== TOP SEARCH BAR ====================
const topSearchBar = document.getElementById('topSearchBar');
const topSearchInput = document.getElementById('topSearchInput');
const topSearchClear = document.getElementById('topSearchClear');
let searchTimeout = null;

function performTopSearch(query) {
    const q = query.trim().toLowerCase();
    
    if (!q) {
        topSearchClear.style.display = 'none';
        renderMemories();
        return;
    }
    
    topSearchClear.style.display = 'flex';
    
    // memories লিস্ট থেকে টেক্সট সার্চ
    const results = memories.filter(m => 
        m.content.toLowerCase().includes(q)
    );
    
    const counterSpan = document.getElementById('memoryCount');
    if (counterSpan) counterSpan.textContent = `(${results.length})`;
    
    if (results.length === 0) {
        memoriesList.innerHTML = '<div class="empty-message">🔍 No memories match "' + query + '"</div>';
    } else {
        renderMemoriesWithData(results);
    }
}

if (topSearchInput) {
    topSearchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const value = this.value;
        searchTimeout = setTimeout(() => {
            performTopSearch(value);
            // রেজাল্ট সেকশনে স্ক্রল করি
            if (value.trim()) {
                const section = document.querySelector('.memories-section');
                if (section) {
                    const rect = section.getBoundingClientRect();
                    if (rect.top > window.innerHeight) {
                        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        }, 250);
    });
    
    // Enter চাপলে সাথে সাথে সার্চ
    topSearchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            performTopSearch(this.value);
        }
    });
}

if (topSearchClear) {
    topSearchClear.addEventListener('click', function() {
        topSearchInput.value = '';
        topSearchClear.style.display = 'none';
        renderMemories();
    });
}
    // ==================== SEARCH SUGGESTIONS ====================
const searchSuggestions = document.getElementById('searchSuggestions');

function buildSuggestions() {
    if (!searchSuggestions) return;
    
    // সব ট্যাগ বের করি
    const tagSet = new Set();
    memories.forEach(m => {
        if (m.tags && m.tags.length > 0) {
            m.tags.forEach(t => tagSet.add(t));
        }
    });
    
    const topTags = Array.from(tagSet).slice(0, 6);
    
    let html = '';
    
    // ট্যাগ সাজেশন
    if (topTags.length > 0) {
        html += `<div class="suggestion-label">🏷️ Your Tags</div>`;
        html += topTags.map(tag => 
            `<button class="suggestion-chip" data-search-type="tag" data-search-value="${tag}">
                <i class="fas fa-hashtag"></i> ${tag}
            </button>`
        ).join('');
    }
    
    // টাইপ সাজেশন
    html += `<div class="suggestion-label" style="margin-top:6px;">⚡ Quick Filters</div>`;
    html += `
        <button class="suggestion-chip type-chip" data-search-type="type" data-search-value="note">
            <i class="fas fa-sticky-note"></i> Notes
        </button>
        <button class="suggestion-chip type-chip" data-search-type="type" data-search-value="link">
            <i class="fas fa-link"></i> Links
        </button>
        <button class="suggestion-chip type-chip" data-search-type="type" data-search-value="image">
            <i class="fas fa-images"></i> Images
        </button>
        <button class="suggestion-chip type-chip" data-search-type="type" data-search-value="pinned">
            <i class="fas fa-star"></i> Pinned
        </button>
    `;
    
    searchSuggestions.innerHTML = html;
    
    // ক্লিক ইভেন্ট যোগ করি
    searchSuggestions.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', function(e) {
            e.preventDefault();
            const searchType = this.getAttribute('data-search-type');
            const searchValue = this.getAttribute('data-search-value');
            
            // সাজেশন লুকাই
            searchSuggestions.classList.remove('show');
            if (topSearchInput) topSearchInput.blur();
            
            // সার্চ করি
            if (searchType === 'tag') {
                // ট্যাগ সার্চ
                topSearchInput.value = '#' + searchValue;
                const filtered = memories.filter(m => m.tags && m.tags.includes(searchValue));
                const counterSpan = document.getElementById('memoryCount');
                if (counterSpan) counterSpan.textContent = `(${filtered.length})`;
                
                if (filtered.length === 0) {
                    memoriesList.innerHTML = '<div class="empty-message">No memories with #' + searchValue + '</div>';
                } else {
                    renderMemoriesWithData(filtered);
                }
            } else if (searchType === 'type') {
                if (searchValue === 'pinned') {
                    // শুধু পিন করা মেমোরি
                    const filtered = memories.filter(m => m.pinned);
                    topSearchInput.value = '⭐ Pinned';
                    const counterSpan = document.getElementById('memoryCount');
                    if (counterSpan) counterSpan.textContent = `(${filtered.length})`;
                    
                    if (filtered.length === 0) {
                        memoriesList.innerHTML = '<div class="empty-message">No pinned memories yet</div>';
                    } else {
                        renderMemoriesWithData(filtered);
                    }
                } else {
                    // টাইপ সার্চ
                    topSearchInput.value = searchValue + 's';
                    const filtered = memories.filter(m => m.type === searchValue);
                    const counterSpan = document.getElementById('memoryCount');
                    if (counterSpan) counterSpan.textContent = `(${filtered.length})`;
                    
                    if (filtered.length === 0) {
                        memoriesList.innerHTML = '<div class="empty-message">No ' + searchValue + 's found</div>';
                    } else {
                        renderMemoriesWithData(filtered);
                    }
                }
            }
            
            // সেকশনে স্ক্রল করি
            const section = document.querySelector('.memories-section');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// Search input এ ফোকাস করলে সাজেশন দেখাই
if (topSearchInput && searchSuggestions) {
    topSearchInput.addEventListener('focus', function() {
        if (!currentUser) return;
        buildSuggestions();
        if (searchSuggestions.innerHTML.trim()) {
            searchSuggestions.classList.add('show');
        }
    });
    
    // input ফাঁকা হলে সাজেশন দেখাই
    topSearchInput.addEventListener('input', function() {
        if (this.value.trim() === '') {
            buildSuggestions();
            if (searchSuggestions.innerHTML.trim()) {
                searchSuggestions.classList.add('show');
            }
        } else {
            searchSuggestions.classList.remove('show');
        }
    });
}

// বাইরে ক্লিক করলে সাজেশন লুকাই
document.addEventListener('click', function(e) {
    if (searchSuggestions && topSearchBar && !topSearchBar.contains(e.target)) {
        searchSuggestions.classList.remove('show');
    }
});
            
    // ==================== PROFILE MENU ====================
const profileContainer = document.getElementById('profileContainer');
const profileMenu = document.getElementById('profileMenu');
const menuSettings = document.getElementById('menuSettings');
const menuExport = document.getElementById('menuExport');
const menuSignOut = document.getElementById('menuSignOut');

if (profileContainer && profileMenu) {
    profileContainer.addEventListener('click', function(e) {
        if (e.target.closest('.profile-menu')) return;
        e.stopPropagation();
        profileMenu.classList.toggle('open');
    });
    
    document.addEventListener('click', function(e) {
        if (!profileContainer.contains(e.target)) {
            profileMenu.classList.remove('open');
        }
    });
}

// Settings modal তৈরি
function openSettings() {
    if (!currentUser) return;
    
    // পরিসংখ্যান হিসাব করি
    const totalMemories = memories.length;
    const notesCount = memories.filter(m => m.type === 'note').length;
    const linksCount = memories.filter(m => m.type === 'link').length;
    const imagesCount = memories.filter(m => m.type === 'image').length;
    const pinnedCount = memories.filter(m => m.pinned).length;
    
    // সব ট্যাগের ইউনিক লিস্ট
    const allTags = new Set();
    memories.forEach(m => {
        if (m.tags && m.tags.length > 0) {
            m.tags.forEach(t => allTags.add(t));
        }
    });
    const tagsCount = allTags.size;
    
    // Member since
    const memberSince = currentUser.metadata.creationTime 
        ? new Date(currentUser.metadata.creationTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : 'N/A';
    
    // পুরনো modal সরাই
    let modal = document.getElementById('settingsModal');
    if (modal) modal.remove();
    
    modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.className = 'settings-modal';
    modal.innerHTML = `
        <div class="settings-content">
            <div class="settings-profile-header">
                <img src="${currentUser.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.displayName || currentUser.email) + '&background=8b5cf6&color=ffffff'}" class="settings-avatar" alt="Profile">
                <h3 class="settings-name">${currentUser.displayName || 'User'}</h3>
                <p class="settings-email">${currentUser.email}</p>
            </div>
            
            <div class="settings-stats-grid">
                <div class="stat-card">
                    <div class="stat-icon" style="background: rgba(139, 92, 246, 0.15); color: #a855f7;">
                        <i class="fas fa-layer-group"></i>
                    </div>
                    <div class="stat-number">${totalMemories}</div>
                    <div class="stat-label">Total</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: rgba(236, 72, 153, 0.15); color: #ec4899;">
                        <i class="fas fa-sticky-note"></i>
                    </div>
                    <div class="stat-number">${notesCount}</div>
                    <div class="stat-label">Notes</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: rgba(34, 197, 94, 0.15); color: #22c55e;">
                        <i class="fas fa-link"></i>
                    </div>
                    <div class="stat-number">${linksCount}</div>
                    <div class="stat-label">Links</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6;">
                        <i class="fas fa-images"></i>
                    </div>
                    <div class="stat-number">${imagesCount}</div>
                    <div class="stat-label">Images</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24;">
                        <i class="fas fa-star"></i>
                    </div>
                    <div class="stat-number">${pinnedCount}</div>
                    <div class="stat-label">Pinned</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">
                        <i class="fas fa-hashtag"></i>
                    </div>
                    <div class="stat-number">${tagsCount}</div>
                    <div class="stat-label">Tags</div>
                </div>
            </div>
            
            <div class="settings-info-row">
                <i class="fas fa-calendar-alt"></i>
                <span>Member since <strong>${memberSince}</strong></span>
            </div>
            
            <button class="settings-close-btn" id="settingsClose">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#settingsClose').onclick = () => modal.classList.remove('open');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };
    
    modal.classList.add('open');
    profileMenu.classList.remove('open');
                                                                                 }
    if (menuSettings) {
    menuSettings.addEventListener('click', openSettings);
}

if (menuExport) {
    menuExport.addEventListener('click', () => {
        profileMenu.classList.remove('open');
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.click();
    });
}

if (menuSignOut) {
    menuSignOut.addEventListener('click', () => {
        profileMenu.classList.remove('open');
        logout();
    });
                    }
                                
// ==================== MEMORY BROWSER (FAB + Folder View) ====================
const fabMain = document.getElementById('fabMain');
const fabMenu = document.getElementById('fabMenu');
const folderView = document.getElementById('folderView');
const folderClose = document.getElementById('folderClose');
const folderTitle = document.getElementById('folderTitle');
const folderCount = document.getElementById('folderCount');
const folderContent = document.getElementById('folderContent');
const detailView = document.getElementById('detailView');
const detailClose = document.getElementById('detailClose');
const detailType = document.getElementById('detailType');
const detailActions = document.getElementById('detailActions');
const detailContent = document.getElementById('detailContent');

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// FAB toggle
if (fabMain && fabMenu) {
    fabMain.addEventListener('click', function(e) {
        e.stopPropagation();
        fabMenu.classList.toggle('open');
        fabMain.classList.toggle('rotated');
    });
    
    document.querySelectorAll('.fab-item').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const folder = this.getAttribute('data-folder');
            openFolderView(folder);
            fabMenu.classList.remove('open');
            fabMain.classList.remove('rotated');
        });
    });
}

// Folder View খোলা
function openFolderView(type) {
    if (!currentUser) {
        showToast('Please sign in first!', true);
        return;
    }

    const filtered = type === 'all' ? memories : memories.filter(m => m.type === type);
    
    const titles = {
        'all': 'All Memories',
        'image': 'Images',
        'note': 'Notes',
        'link': 'Links'
    };
    
    folderTitle.textContent = titles[type] || 'Memories';
    folderCount.textContent = `(${filtered.length})`;
    
    if (filtered.length === 0) {
    folderContent.className = 'folder-content list-view';
    const emptyIcons = {
        'all': 'fa-brain',
        'image': 'fa-images',
        'note': 'fa-sticky-note',
        'link': 'fa-link'
    };
    const emptyTitles = {
        'all': 'No memories yet',
        'image': 'No images yet',
        'note': 'No notes yet',
        'link': 'No links yet'
    };
    const emptyTexts = {
        'all': 'Save your first memory to get started. Anything you save will appear here.',
        'image': 'Upload a screenshot to see it here. Perfect for saving visual ideas.',
        'note': 'Write a note to capture your thoughts, ideas, and reminders.',
        'link': 'Save a link to keep your favorite websites and articles organized.'
    };
    folderContent.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">
                <i class="fas ${emptyIcons[type] || 'fa-folder-open'}"></i>
            </div>
            <h3 class="empty-state-title">${emptyTitles[type] || 'Nothing here yet'}</h3>
            <p class="empty-state-text">${emptyTexts[type] || 'Save something to get started.'}</p>
            <button class="empty-state-btn" onclick="document.getElementById('folderClose').click(); setTimeout(() => { document.querySelector('.save-section').scrollIntoView({behavior:'smooth'}); }, 400);">
                <i class="fas fa-plus"></i> Save Now
            </button>
        </div>
    `;
} else if (type === 'image') {
        folderContent.className = 'folder-content grid-view';
        folderContent.innerHTML = filtered.map(m => `
            <div class="memory-card" data-memory-id="${m.id}">
                <img src="${m.content}" alt="Screenshot">
            </div>
        `).join('');
    } else {
        folderContent.className = 'folder-content list-view';
        folderContent.innerHTML = filtered.map(m => `
            <div class="memory-card" data-memory-id="${m.id}">
                <div class="memory-header">
                    <div class="memory-type">${m.type === 'note' ? 'Note' : m.type === 'link' ? 'Link' : 'Image'}</div>
                </div>
                <div class="memory-content">
                    ${m.type === 'link' ? 
                        `<a href="${m.content}" target="_blank" class="memory-link">${m.content}</a>` : 
                        escapeHtml(m.content)
                    }
                </div>
            </div>
        `).join('');
    }
    
    // কার্ডে ক্লিক করলে ডিটেইল খুলবে
    folderContent.querySelectorAll('.memory-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') return;
            const id = this.getAttribute('data-memory-id');
            const memory = memories.find(m => m.id === id);
            if (memory) openDetailView(memory);
        });
    });
    
    folderView.classList.add('open');
}

// Detail View খোলা
function openDetailView(memory) {
    detailType.textContent = memory.type === 'note' ? 'Note' : memory.type === 'link' ? 'Link' : 'Image';
    
    detailActions.innerHTML = `
        <button class="edit-action" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="download-action" title="Download"><i class="fas fa-download"></i></button>
        <button class="delete-action danger" title="Delete"><i class="fas fa-trash"></i></button>
    `;
    
    if (memory.type === 'image') {
        detailContent.innerHTML = `<img src="${memory.content}" alt="Memory">`;
    } else if (memory.type === 'note') {
        detailContent.innerHTML = `<div class="note-text">${escapeHtml(memory.content)}</div>`;
    } else if (memory.type === 'link') {
        detailContent.innerHTML = `
            <div class="link-preview-full">
                <a href="${memory.content}" target="_blank">${memory.content}</a>
            </div>
        `;
    }
    
    detailActions.querySelector('.edit-action').onclick = () => {
        const newContent = prompt('Edit:', memory.content);
        if (newContent && newContent.trim()) {
            editMemory(memory.id, newContent.trim());
            detailView.classList.remove('open');
        }
    };
    
    detailActions.querySelector('.download-action').onclick = () => {
        if (memory.type === 'image') {
            window.downloadImage(memory.content);
        } else {
            const blob = new Blob([memory.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'vaenorix-' + memory.id + '.txt';
            a.click();
            URL.revokeObjectURL(url);
            showToast('Downloaded!');
        }
    };
    
    detailActions.querySelector('.delete-action').onclick = () => {
    window.openDeleteModal(memory.id, memory.content, memory.type);
};
    
    detailView.classList.add('open');
}

// Folder বন্ধ
if (folderClose) {
    folderClose.addEventListener('click', () => {
        folderView.classList.remove('open');
    });
}

// Detail বন্ধ
if (detailClose) {
    detailClose.addEventListener('click', () => {
        detailView.classList.remove('open');
    });
}

// Escape key দিয়ে বন্ধ
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (detailView && detailView.classList.contains('open')) {
            detailView.classList.remove('open');
        } else if (folderView && folderView.classList.contains('open')) {
            folderView.classList.remove('open');
        } else if (fabMenu && fabMenu.classList.contains('open')) {
            fabMenu.classList.remove('open');
            fabMain.classList.remove('rotated');
        }
    }
});
     // ==================== SORT OPTIONS ====================
const sortBtn = document.getElementById('sortBtn');
const sortMenu = document.getElementById('sortMenu');
let currentSort = localStorage.getItem('vaenorix_sort') || 'newest';

function applySort(type) {
    if (type === 'newest') {
        memories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (type === 'oldest') {
        memories.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (type === 'alpha') {
        memories.sort((a, b) => (a.content || '').toLowerCase().localeCompare((b.content || '').toLowerCase()));
    } else if (type === 'pinned') {
        memories.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
    }
    currentSort = type;
    localStorage.setItem('vaenorix_sort', type);
    
    // সব sort option থেকে active সরাই
    document.querySelectorAll('.sort-option').forEach(o => o.classList.remove('active'));
    const activeOption = document.querySelector(`.sort-option[data-sort="${type}"]`);
    if (activeOption) activeOption.classList.add('active');
    
    renderMemories();
}

if (sortBtn && sortMenu) {
    // Sort button এ ক্লিক করলে মেনু টগল
    sortBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        sortMenu.classList.toggle('open');
    });
    
    // প্রতিটা sort option এ ক্লিক
    document.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            const sortType = this.getAttribute('data-sort');
            applySort(sortType);
            sortMenu.classList.remove('open');
        });
    });
    
    // বাইরে ক্লিক করলে মেনু বন্ধ
    document.addEventListener('click', function(e) {
        if (!sortBtn.contains(e.target) && !sortMenu.contains(e.target)) {
            sortMenu.classList.remove('open');
        }
    });
    
    // আগের sort preference apply করি
    if (currentSort !== 'newest') {
        setTimeout(() => applySort(currentSort), 100);
    }
                          }
            // ==================== BULK ACTIONS ====================
// Checkbox click handler (inline)
document.addEventListener('click', function(e) {
    const checkbox = e.target.closest('.memory-checkbox');
    if (checkbox && isSelectMode) {
        e.preventDefault();
        e.stopPropagation();
        const id = checkbox.getAttribute('data-id');
        toggleMemorySelection(id);
    }
});

// Card click handler (bubbling) - for select mode
document.addEventListener('click', function(e) {
    if (!isSelectMode) return;
    if (e.target.closest('.memory-checkbox')) return;
    
    const card = e.target.closest('.memory-card[data-memory-id]');
    if (!card) return;
    
    // ignore clicks on links or action buttons
    if (e.target.tagName === 'A' || 
        e.target.closest('a') || 
        e.target.closest('.menu-container') ||
        e.target.closest('.pin-btn') ||
        e.target.closest('.download-btn')) {
        return;
    }
    
    e.preventDefault();
    const id = card.getAttribute('data-memory-id');
    toggleMemorySelection(id);
});
            
    
const selectBtn = document.getElementById('selectBtn');
const bulkActionBar = document.getElementById('bulkActionBar');
const bulkSelectedCount = document.getElementById('bulkSelectedCount');
const bulkPinBtn = document.getElementById('bulkPinBtn');
const bulkDownloadBtn = document.getElementById('bulkDownloadBtn');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const bulkCancelBtn = document.getElementById('bulkCancelBtn');
let isSelectMode = false;
let selectedIds = [];

function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    selectedIds = [];
    
    if (selectBtn) {
        selectBtn.classList.toggle('active', isSelectMode);
        selectBtn.innerHTML = isSelectMode 
            ? '<i class="fas fa-times"></i> Cancel' 
            : '<i class="fas fa-check-square"></i> Select';
    }
    
    if (memoriesList) {
        memoriesList.classList.toggle('select-mode', isSelectMode);
    }
    
    if (isSelectMode) {
        if (bulkActionBar) bulkActionBar.classList.add('show');
    } else {
        if (bulkActionBar) bulkActionBar.classList.remove('show');
    }
    
    updateBulkCount();
    renderMemories();
}

function updateBulkCount() {
    if (bulkSelectedCount) bulkSelectedCount.textContent = selectedIds.length;
    
    // Pin button state
    if (bulkPinBtn) {
        const selectedMemories = memories.filter(m => selectedIds.includes(m.id));
        const allPinned = selectedMemories.length > 0 && selectedMemories.every(m => m.pinned);
        bulkPinBtn.classList.toggle('active', allPinned);
    }
}

function toggleMemorySelection(id) {
    const index = selectedIds.indexOf(id);
    if (index > -1) {
        selectedIds.splice(index, 1);
    } else {
        selectedIds.push(id);
    }
    updateBulkCount();
    
    // UI আপডেট করি
    const checkbox = document.querySelector(`.memory-checkbox[data-id="${id}"]`);
    const card = document.querySelector(`.memory-card[data-memory-id="${id}"]`);
    if (checkbox) checkbox.classList.toggle('checked');
    if (card) card.classList.toggle('selected');
}

if (selectBtn) {
    selectBtn.addEventListener('click', toggleSelectMode);
}

if (bulkCancelBtn) {
    bulkCancelBtn.addEventListener('click', () => {
        if (isSelectMode) toggleSelectMode();
    });
}

// Bulk Pin
if (bulkPinBtn) {
    bulkPinBtn.addEventListener('click', async () => {
        if (selectedIds.length === 0) {
            if (typeof showToast === 'function') showToast('Nothing selected', true);
            return;
        }
        
        const user = window.currentUser || currentUser;
        if (!user) return;
        
        const selectedMemories = memories.filter(m => selectedIds.includes(m.id));
        const allPinned = selectedMemories.every(m => m.pinned);
        const newState = !allPinned;
        
        try {
            bulkPinBtn.disabled = true;
            for (const memory of selectedMemories) {
                const ref = window.doc(window.db, `users/${user.uid}/memories`, memory.id);
                await window.updateDoc(ref, { pinned: newState });
            }
            
            if (typeof showToast === 'function') {
                showToast(newState ? `⭐ Pinned ${selectedMemories.length}` : `Unpinned ${selectedMemories.length}`);
            }
            
            // Select mode বন্ধ করি
            toggleSelectMode();
            
            if (typeof window.loadMemories === 'function') {
                await window.loadMemories();
            }
        } catch (error) {
            console.error('Bulk pin error:', error);
            if (typeof showToast === 'function') showToast('Failed to pin', true);
        } finally {
            bulkPinBtn.disabled = false;
        }
    });
}

// Bulk Download
if (bulkDownloadBtn) {
    bulkDownloadBtn.addEventListener('click', () => {
        if (selectedIds.length === 0) {
            if (typeof showToast === 'function') showToast('Nothing selected', true);
            return;
        }
        
        const selectedMemories = memories.filter(m => selectedIds.includes(m.id));
        
        const dataStr = JSON.stringify({
            exported_at: new Date().toISOString(),
            user: (window.currentUser || currentUser).email,
            total_memories: selectedMemories.length,
            memories: selectedMemories
        }, null, 2);
        
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vaenorix-selected-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (typeof showToast === 'function') {
            showToast(`✅ Exported ${selectedMemories.length} memories`);
        }
    });
}

// Bulk Delete
if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', async () => {
        if (selectedIds.length === 0) {
            if (typeof showToast === 'function') showToast('Nothing selected', true);
            return;
        }
        
        const user = window.currentUser || currentUser;
        if (!user) return;
        
        if (!confirm(`Delete ${selectedIds.length} memories permanently?`)) return;
        
        try {
            bulkDeleteBtn.disabled = true;
            for (const id of selectedIds) {
                const ref = window.doc(window.db, `users/${user.uid}/memories`, id);
                await window.deleteDoc(ref);
            }
            
            if (typeof showToast === 'function') {
                showToast(`🗑️ Deleted ${selectedIds.length} memories`);
            }
            
            const count = selectedIds.length;
            selectedIds = [];
            
            // Select mode বন্ধ করি
            if (isSelectMode) toggleSelectMode();
            
            if (typeof window.loadMemories === 'function') {
                await window.loadMemories();
            }
        } catch (error) {
            console.error('Bulk delete error:', error);
            if (typeof showToast === 'function') showToast('Failed to delete', true);
        } finally {
            bulkDeleteBtn.disabled = false;
        }
    });
            }
    
    // ==================== ATTACH EVENT LISTENERS ====================
    if (saveBtn) saveBtn.addEventListener('click', addMemory);
    if (aiSearchBtn) aiSearchBtn.addEventListener('click', searchMemories);
    if (getStartedBtn) getStartedBtn.addEventListener('click', scrollToSave);
    if (loginBtn) loginBtn.addEventListener('click', login);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (aiSearchInput) {
        aiSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchMemories();
        });
    }
    if (uploadArea) uploadArea.addEventListener('click', () => screenshotInput && screenshotInput.click());
    if (uploadBtn) uploadBtn.addEventListener('click', () => screenshotInput && screenshotInput.click());
    if (screenshotInput) screenshotInput.addEventListener('change', handleScreenshotUpload);
    initFilters();

    // Hide open dropdown menus on outside click
    document.addEventListener('click', function() {
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    });

    // ==================== WAIT FOR FIREBASE ====================
    await waitForFirebase();
    if (!window.auth || !window.db) {
        console.error('Firebase not available');
        return;
    }

    window.onAuthStateChanged(window.auth, async (user) => {
    const profileContainer = document.getElementById('profileContainer');
    const avatarImg = document.getElementById('userAvatar');
    const menuAvatar = document.getElementById('menuAvatar');
    const menuName = document.getElementById('menuName');
    const menuEmail = document.getElementById('menuEmail');
    
    if (user) {
        currentUser = user;
        window.currentUser = user;
        if (loginBtn) loginBtn.style.display = 'none';
        if (profileContainer) profileContainer.style.display = 'block';
        
        const photoURL = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email) + '&background=00ffff&color=0a0a0f';
        
        if (avatarImg) {
            avatarImg.src = photoURL;
            avatarImg.title = user.displayName || user.email;
        }
        if (menuAvatar) menuAvatar.src = photoURL;
        if (menuName) menuName.textContent = user.displayName || 'User';
        if (menuEmail) menuEmail.textContent = user.email || '';
        if (topSearchBar) topSearchBar.style.display = 'block';
        await loadMemories();
    } else {
        currentUser = null;
        window.currentUser = null;
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (profileContainer) profileContainer.style.display = 'none';
        if (memoriesList) memoriesList.innerHTML = `
    <div class="empty-state">
        <div class="empty-state-icon">
            <i class="fas fa-brain"></i>
        </div>
        <h3 class="empty-state-title">Sign in to get started</h3>
        <p class="empty-state-text">Save notes, links, and screenshots to your personal AI Second Brain.</p>
        <button class="empty-state-btn" onclick="document.getElementById('loginBtn').click()">
            <i class="fas fa-sign-in-alt"></i> Sign in with Google
        </button>
    </div>
`;
        if (topSearchBar) topSearchBar.style.display = 'none';
    }
});
}
// ==================== Image Modal ====================
window.showImageModal = function(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="image-modal-content">
            <span class="image-modal-close">&times;</span>
            <img src="${imageUrl}" alt="Full size">
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.image-modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
};

// ==================== Download Image ====================
window.downloadImage = async function(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vaenorix-${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Image downloaded!');
    } catch (error) {
        showToast('Download failed', true);
    }
};

// ==================== START APP ====================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
                    }
// ==================== SHARE PUBLIC LINK ====================
window.shareMemoryPublic = async function(memory) {
    if (!memory) return;
    
    try {
        if (typeof showToast === 'function') showToast('⏳ Creating share link...');
        
        // ইউনিক শেয়ার আইডি
        const shareId = 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        
        // Firestore-এ পাবলিক কপি সেভ করি
        const publicRef = window.doc(window.db, 'public_memories', shareId);
        await window.updateDoc ? null : null; // placeholder
        
        // setDoc/updateDoc কাজ করবে না, তাই addDoc দিয়ে করতে হবে
        // তবে addDoc এর জন্য collection লাগে
        const { setDoc } = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js');
        
        await setDoc(publicRef, {
            type: memory.type,
            content: memory.content,
            tags: memory.tags || [],
            timestamp: memory.timestamp,
            shared_at: new Date().toISOString(),
            shared_by: currentUser ? currentUser.uid : 'anonymous'
        });
        
        // শেয়ার লিংক তৈরি
        const shareUrl = `${window.location.origin}/share.html?id=${shareId}`;
        
        // ক্লিপবোর্ডে কপি
        try {
            await navigator.clipboard.writeText(shareUrl);
            if (typeof showToast === 'function') showToast('✅ Share link copied!');
        } catch (err) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = shareUrl;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            if (typeof showToast === 'function') showToast('✅ Share link copied!');
        }
        
        // শেয়ার মেনু দেখাই
        if (navigator.share) {
            setTimeout(() => {
                navigator.share({
                    title: 'A memory from Vaenorix',
                    text: memory.type === 'note' ? memory.content.substring(0, 100) : 'Check out this memory',
                    url: shareUrl
                }).catch(() => {});
            }, 500);
        }
        
    } catch (error) {
        console.error('Share error:', error);
        if (typeof showToast === 'function') showToast('Failed to create share link', true);
    }
};
        
// ==================== PWA INSTALL ====================
let deferredPrompt = null;
let installBannerShown = false;

// Install prompt available হলে বাটন দেখাই
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installBtn = document.getElementById('installBtn');
    if (installBtn && !window.matchMedia('(display-mode: standalone)').matches) {
        installBtn.style.display = 'inline-flex';
    }
});

// Install বাটনে ক্লিক
document.addEventListener('click', async function(e) {
    const installBtn = e.target.closest('#installBtn');
    if (installBtn && deferredPrompt) {
        installBtn.disabled = true;
        installBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Installing...';
        
        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                if (typeof showToast === 'function') showToast('🎉 Installing Vaenorix...');
            } else {
                if (typeof showToast === 'function') showToast('Installation cancelled');
            }
        } catch (err) {
            console.error('Install error:', err);
        }
        
        deferredPrompt = null;
        installBtn.style.display = 'none';
        installBtn.disabled = false;
        installBtn.innerHTML = '<i class="fas fa-download"></i> Install App';
    }
});

// App install হলে বাটন লুকাই
window.addEventListener('appinstalled', () => {
    console.log('✅ Vaenorix installed');
    deferredPrompt = null;
    const installBtn = document.getElementById('installBtn');
    if (installBtn) installBtn.style.display = 'none';
    if (typeof showToast === 'function') {
        showToast('🎉 Vaenorix installed! Check your home screen.');
    }
});

// iOS-এর জন্য fallback (beforeinstallprompt কাজ করে না)
function detectIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

if (detectIOS() && !window.matchMedia('(display-mode: standalone)').matches && !localStorage.getItem('iosInstallDismissed')) {
    setTimeout(() => {
        if (installBannerShown) return;
        installBannerShown = true;
        
        const banner = document.createElement('div');
        banner.className = 'install-banner';
        banner.innerHTML = `
            <div class="install-banner-title">
                <i class="fas fa-mobile-alt"></i> Install Vaenorix
            </div>
            <div class="install-banner-text">
                Safari-তে <strong>Share</strong> বাটনে ট্যাপ করে <strong>"Add to Home Screen"</strong> সিলেক্ট করুন।
            </div>
            <div class="install-banner-actions">
                <button class="install-banner-primary" id="iosGotIt">Got it</button>
                <button class="install-banner-secondary" id="iosLater">Later</button>
            </div>
        `;
        document.body.appendChild(banner);
        
        setTimeout(() => banner.classList.add('show'), 100);
        
        banner.querySelector('#iosGotIt').onclick = () => {
            banner.classList.remove('show');
            localStorage.setItem('iosInstallDismissed', 'true');
            setTimeout(() => banner.remove(), 400);
        };
        
        banner.querySelector('#iosLater').onclick = () => {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 400);
        };
    }, 3000);
}

// Standalone mode এ থাকলে install button লুকাই
if (window.matchMedia('(display-mode: standalone)').matches) {
    const installBtn = document.getElementById('installBtn');
    if (installBtn) installBtn.style.display = 'none';
}
// ==================== EDIT MEMORY MODAL ====================
let editingMemoryId = null;

function openEditModal(memoryId, currentContent) {
    const modal = document.getElementById('editModal');
    const input = document.getElementById('editModalInput');
    if (!modal || !input) return;
    
    editingMemoryId = memoryId;
    input.value = currentContent || '';
    modal.classList.add('open');
    
    // ফোকাস করি এবং কার্সর শেষে রাখি
    setTimeout(() => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }, 300);
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.classList.remove('open');
    editingMemoryId = null;
}

async function saveEditModal() {
    const input = document.getElementById('editModalInput');
    const saveBtn = document.getElementById('editModalSave');
    
    if (!editingMemoryId || !input) return;
    
    const newContent = input.value.trim();
    if (!newContent) {
        if (typeof showToast === 'function') showToast('Memory cannot be empty', true);
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Saving...';
    
    try {
        // global editMemory ফাংশন কল করি
        if (typeof window.editMemory === 'function' || typeof editMemory === 'function') {
            // editMemory আগে থেকেই initializeApp-এর ভেতরে আছে
            // তাই আমরা সরাসরি window থেকে কল করতে পারি না
        }
        
        // সরাসরি Firebase update
        if (currentUser && window.db && window.doc && window.updateDoc) {
            const memoryRef = window.doc(window.db, `users/${currentUser.uid}/memories`, editingMemoryId);
            await window.updateDoc(memoryRef, { content: newContent });
            
            if (typeof showToast === 'function') showToast('✅ Memory updated!');
            closeEditModal();
            
            // memories reload করি
            if (typeof loadMemories === 'function') {
                await loadMemories();
            } else if (typeof window.loadMemories === 'function') {
                await window.loadMemories();
            }
        } else {
            throw new Error('Firebase not ready');
        }
    } catch (error) {
        console.error('Edit save error:', error);
        if (typeof showToast === 'function') showToast('Failed to update: ' + error.message, true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Save Changes';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('editModal');
    const closeBtn = document.getElementById('editModalClose');
    const cancelBtn = document.getElementById('editModalCancel');
    const saveBtn = document.getElementById('editModalSave');
    
    if (closeBtn) closeBtn.addEventListener('click', closeEditModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditModal);
    if (saveBtn) saveBtn.addEventListener('click', saveEditModal);
    
    // বাইরে ক্লিক করলে বন্ধ হবে
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeEditModal();
        });
    }
    
    // Escape key দিয়ে বন্ধ
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
            closeEditModal();
        }
    });
    
    // Ctrl+Enter বা Cmd+Enter দিয়ে সেভ
    const input = document.getElementById('editModalInput');
    if (input) {
        input.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                saveEditModal();
            }
        });
    }
});

// Global function হিসেবে এক্সপোর্ট করি
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
// ==================== DELETE CONFIRMATION MODAL ====================
let deletingMemoryId = null;
let isClearAllMode = false;
function openDeleteModal(memoryId, memoryContent, memoryType) {
    const modal = document.getElementById('deleteModal');
    const preview = document.getElementById('deleteModalPreview');
    if (!modal) return;
    
    deletingMemoryId = memoryId;
    
    // Preview তৈরি করি
    if (preview) {
        const typeLabel = memoryType === 'note' ? 'Note' : memoryType === 'link' ? 'Link' : 'Image';
        
        if (memoryType === 'image') {
            preview.innerHTML = `
                <div class="delete-modal-preview-type">${typeLabel}</div>
                <img src="${memoryContent}" class="delete-modal-preview-image" alt="Preview">
            `;
        } else {
            const text = memoryContent.length > 120 ? memoryContent.substring(0, 120) + '...' : memoryContent;
            preview.innerHTML = `
                <div class="delete-modal-preview-type">${typeLabel}</div>
                <div class="delete-modal-preview-content">${escapeHtmlLocal(text)}</div>
            `;
        }
    }
    
    modal.classList.add('open');
}

function escapeHtmlLocal(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('open');
    deletingMemoryId = null;
    isClearAllMode = false;
}
async function confirmDelete() {
    if (!deletingMemoryId && !isClearAllMode) return;
    
    const confirmBtn = document.getElementById('deleteModalConfirm');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Deleting...';
    
    try {
        const user = window.currentUser || currentUser;
        if (!user || !window.db) {
            throw new Error('Firebase not ready');
        }
        
        if (isClearAllMode) {
            // সব মেমোরি ডিলিট
            const memoriesRef = window.collection(window.db, `users/${user.uid}/memories`);
            const querySnapshot = await window.getDocs(memoriesRef);
            for (const doc of querySnapshot.docs) {
                await window.deleteDoc(window.doc(window.db, `users/${user.uid}/memories`, doc.id));
            }
            if (typeof showToast === 'function') showToast('🗑️ All memories cleared');
        } else {
            // একটা মেমোরি ডিলিট
            const memoryRef = window.doc(window.db, `users/${user.uid}/memories`, deletingMemoryId);
            await window.deleteDoc(memoryRef);
            if (typeof showToast === 'function') showToast('🗑️ Memory deleted');
        }
        
        // Detail view খোলা থাকলে বন্ধ করি
        const detailView = document.getElementById('detailView');
        if (detailView) detailView.classList.remove('open');
        
        // Folder view খোলা থাকলে বন্ধ করি
        const folderView = document.getElementById('folderView');
        if (folderView && isClearAllMode) folderView.classList.remove('open');
        
        // Modal বন্ধ করি
        closeDeleteModal();
        
        // লিস্ট রিফ্রেশ করি
        if (typeof window.loadMemories === 'function') {
            await window.loadMemories();
        }
    } catch (error) {
        console.error('Delete error:', error);
        if (typeof showToast === 'function') showToast('Failed to delete: ' + error.message, true);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
    }
                }

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('deleteModal');
    const cancelBtn = document.getElementById('deleteModalCancel');
    const confirmBtn = document.getElementById('deleteModalConfirm');
    
    if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteModal);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmDelete);
    
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeDeleteModal();
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
            closeDeleteModal();
        }
    });
});

// Global export
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
// ==================== CLEAR ALL MODAL ====================
function openClearAllModal() {
    const modal = document.getElementById('deleteModal');
    if (!modal) return;
    
    isClearAllMode = true;
    deletingMemoryId = null;
    
    // টাইটেল ও টেক্সট পরিবর্তন
    const title = modal.querySelector('.delete-modal-title');
    const text = modal.querySelector('.delete-modal-text');
    const preview = document.getElementById('deleteModalPreview');
    
    if (title) title.textContent = 'Clear all memories?';
    if (text) text.textContent = 'This will permanently delete ALL your memories (notes, links, and images). This action cannot be undone.';
    if (preview) {
        preview.innerHTML = `
            <div class="delete-modal-preview-type">Warning</div>
            <div class="delete-modal-preview-content" style="color: #ff8888;">
                ${typeof memories !== 'undefined' ? memories.length : 0} memories will be permanently deleted
            </div>
        `;
    }
    
    modal.classList.add('open');
}

// Reset modal on close (পরেরবার single delete modal ঠিকভাবে আসবে)
const originalCloseDeleteModal = closeDeleteModal;
window.closeDeleteModal = function() {
    originalCloseDeleteModal();
    // Reset title/text for next single delete
    setTimeout(() => {
        const modal = document.getElementById('deleteModal');
        if (!modal) return;
        const title = modal.querySelector('.delete-modal-title');
        const text = modal.querySelector('.delete-modal-text');
        if (title) title.textContent = 'Delete this memory?';
        if (text) text.textContent = 'This action cannot be undone. This memory will be permanently removed from your account.';
    }, 300);
};

window.openClearAllModal = openClearAllModal;
// ==================== OFFLINE DETECTION ====================
function showOfflineBanner() {
    let banner = document.getElementById('offlineBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offlineBanner';
        banner.className = 'offline-banner';
        banner.innerHTML = `
            <i class="fas fa-wifi"></i>
            <span>You're offline — showing cached data</span>
        `;
        document.body.appendChild(banner);
    }
    setTimeout(() => banner.classList.add('show'), 100);
}

function hideOfflineBanner() {
    const banner = document.getElementById('offlineBanner');
    if (banner) {
        banner.classList.remove('show');
        setTimeout(() => banner.remove(), 400);
    }
}

// চেক করি অনলাইন নাকি অফলাইন
function checkOnlineStatus() {
    if (!navigator.onLine) {
        showOfflineBanner();
    } else {
        hideOfflineBanner();
    }
}

// Event listeners
window.addEventListener('online', function() {
    hideOfflineBanner();
    if (typeof showToast === 'function') {
        showToast('✅ Back online');
    }
    // ডেটা reload করি
    if (typeof loadMemories === 'function') {
        loadMemories();
    }
});

window.addEventListener('offline', function() {
    showOfflineBanner();
    if (typeof showToast === 'function') {
        showToast('📡 No internet connection', true);
    }
});

// পেজ লোড হওয়ার সময় চেক করি
checkOnlineStatus();
                   
// ==================== NAVBAR SCROLL EFFECT ====================
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        if (window.scrollY > 10) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }
});
