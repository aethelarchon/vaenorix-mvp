// ============================================
// VAENORIX - Full Working Script
// Firebase v10 (compat)
// ============================================

// ========== IMAGE COMPRESSION ==========
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
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.8);
            };
        };
    });
}

// ========== TOAST NOTIFICATION ==========
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

// ========== DOM READY ==========
document.addEventListener('DOMContentLoaded', function() {

    // ========== DOM ELEMENTS ==========
    const noteInput = document.getElementById('noteInput');
    const linkInput = document.getElementById('linkInput');
    const saveBtn = document.getElementById('saveBtn');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const memoriesList = document.getElementById('memoriesList');
    const getStartedBtn = document.getElementById('getStartedBtn');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    // ========== STATE ==========
    let memories = [];
    let currentUser = null;
    let currentFilter = 'all';

    // ========== AUTH STATE ==========
    window.onAuthStateChanged(window.auth, async (user) => {
        const avatarImg = document.getElementById('userAvatar');
        if (user) {
            currentUser = user;
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (avatarImg && user.photoURL) {
                avatarImg.src = user.photoURL;
                avatarImg.style.display = 'block';
            }
            await loadMemories();
            showToast('Welcome back! 👋');
        } else {
            currentUser = null;
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (avatarImg) {
                avatarImg.style.display = 'none';
            }
            if (memoriesList) {
                memoriesList.innerHTML = '<div class="empty-message">🔐 Please sign in to see your memories</div>';
            }
        }
    });

    // ========== LOGIN ==========
    async function login() {
        const provider = new window.GoogleAuthProvider();
        try {
            await window.signInWithPopup(window.auth, provider);
        } catch (error) {
            if (error.code !== 'auth/cancelled-popup-request') {
                showToast("Login failed: " + error.message, true);
            }
        }
    }

    // ========== LOGOUT ==========
    async function logout() {
        try {
            await window.auth.signOut();
            showToast('Logged out successfully');
        } catch (error) {
            showToast("Logout failed", true);
        }
    }

    // ========== LOAD MEMORIES ==========
    async function loadMemories() {
        if (!currentUser) return;
        try {
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            const q = window.query(memoriesRef, window.orderBy("timestamp", "desc"));
            const querySnapshot = await window.getDocs(q);
            memories = [];
            querySnapshot.forEach((doc) => {
                memories.push({ id: doc.id, ...doc.data() });
            });
            renderMemories();
            updateMemoryCounter();
        } catch (error) {
            console.error("Load error:", error);
            if (memoriesList) {
                memoriesList.innerHTML = '<div class="empty-message">❌ Error loading memories</div>';
            }
            showToast("Failed to load memories", true);
        }
    }

    // ========== UPDATE COUNTER ==========
    function updateMemoryCounter() {
        const counterSpan = document.getElementById('memoryCount');
        if (counterSpan) {
            const filtered = getFilteredMemories(searchInput ? searchInput.value.trim() : '');
            counterSpan.textContent = `(${filtered.length})`;
        }
    }

    // ========== GET FILTERED MEMORIES ==========
    function getFilteredMemories(filterText = '') {
        let filtered = memories;
        if (currentFilter !== 'all') {
            filtered = filtered.filter(m => m.type === currentFilter);
        }
        if (filterText) {
            filtered = filtered.filter(m =>
                m.content && m.content.toLowerCase().includes(filterText.toLowerCase())
            );
        }
        return filtered;
    }

    // ========== DELETE MEMORY ==========
    async function deleteMemory(id) {
        if (!currentUser) return;
        try {
            await window.deleteDoc(window.doc(window.db, `users/${currentUser.uid}/memories`, id));
            showToast('🗑️ Memory deleted');
            await loadMemories();
        } catch (error) {
            showToast("Failed to delete", true);
        }
    }

    // ========== EDIT MEMORY ==========
    async function editMemory(id, newContent) {
        if (!currentUser) return;
        if (!newContent || !newContent.trim()) {
            showToast('Content cannot be empty', true);
            return;
        }
        try {
            const memoryRef = window.doc(window.db, `users/${currentUser.uid}/memories`, id);
            await window.updateDoc(memoryRef, { content: newContent.trim() });
            showToast('✏️ Memory updated');
            await loadMemories();
        } catch (error) {
            showToast("Failed to edit", true);
        }
    }

    // ========== DELETE ALL MEMORIES ==========
    async function deleteAllMemories() {
        if (!currentUser) {
            showToast('Please sign in first!', true);
            return;
        }
        if (memories.length === 0) {
            showToast('No memories to clear', true);
            return;
        }
        if (!confirm('⚠️ Are you sure? This will delete ALL your memories permanently!')) {
            return;
        }
        try {
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            const querySnapshot = await window.getDocs(memoriesRef);
            for (const doc of querySnapshot.docs) {
                await window.deleteDoc(window.doc(window.db, `users/${currentUser.uid}/memories`, doc.id));
            }
            showToast('🧹 All memories cleared!');
            await loadMemories();
        } catch (error) {
            console.error("Clear all error:", error);
            showToast('Failed to clear memories', true);
        }
    }

    // ========== FETCH LINK PREVIEW ==========
    async function fetchLinkPreview(url) {
        try {
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            return null;
        }
    }

    // ========== RENDER MEMORIES ==========
    function renderMemories(filterText = '') {
        if (!currentUser) return;

        if (memories.length === 0) {
            if (memoriesList) {
                memoriesList.innerHTML = '<div class="empty-message">📭 No memories yet. Save your first one!</div>';
            }
            return;
        }

        const filtered = getFilteredMemories(filterText);

        if (filtered.length === 0) {
            if (memoriesList) {
                memoriesList.innerHTML = '<div class="empty-message">🔍 No memories found</div>';
            }
            return;
        }

        if (memoriesList) {
            memoriesList.innerHTML = filtered.map((memory) => {
                let contentHtml = '';
                if (memory.type === 'link') {
                    contentHtml = `
                        <a href="${memory.content}" target="_blank" class="memory-link">${memory.content}</a>
                        <div class="link-preview-container" data-url="${memory.content}">
                            <div class="loading-preview">Loading preview...</div>
                        </div>
                    `;
                } else if (memory.type === 'image') {
                    contentHtml = `
                        <div style="position: relative;">
                            <img src="${memory.content}" alt="Screenshot" class="clickable-image" onclick="showImageModal('${memory.content}')">
                            <button class="download-btn" onclick="downloadImage('${memory.content}')">⬇️ Download</button>
                        </div>
                    `;
                } else {
                    contentHtml = `<div class="note-content">${escapeHtml(memory.content)}</div>`;
                }

                return `
                    <div class="memory-card">
                        <div class="memory-header">
                            <div class="memory-type">${getTypeIcon(memory.type)} ${capitalize(memory.type)}</div>
                            <div class="menu-container">
                                <button class="three-dots" data-id="${memory.id}">⋯</button>
                                <div class="dropdown-menu" id="menu-${memory.id}">
                                    <button class="edit-btn" data-id="${memory.id}">✏️ Edit</button>
                                    <button class="share-btn" data-id="${memory.id}">📤 Share</button>
                                    <button class="delete-btn-menu" data-id="${memory.id}">🗑️ Delete</button>
                                </div>
                            </div>
                        </div>
                        <div class="memory-content">
                            ${contentHtml}
                        </div>
                        <div class="memory-time">${formatTime(memory.timestamp)}</div>
                    </div>
                `;
            }).join('');
        }

        // ===== ATTACH EVENTS =====

        // Three dots menu toggle
        document.querySelectorAll('.three-dots').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
                const menu = document.getElementById(`menu-${id}`);
                if (menu) menu.classList.toggle('show');
            });
        });

        // Edit
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                const memory = memories.find(m => m.id === id);
                if (memory) {
                    const newContent = prompt('✏️ Edit your memory:', memory.content);
                    if (newContent !== null && newContent.trim()) {
                        editMemory(id, newContent.trim());
                    }
                }
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            });
        });

        // Delete
        document.querySelectorAll('.delete-btn-menu').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                if (confirm('Delete this memory?')) {
                    deleteMemory(id);
                }
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            });
        });

        // Share
        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                const memory = memories.find(m => m.id === id);
                if (memory) {
                    shareMemory(memory.content, memory.type);
                }
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            });
        });

        // Close dropdown on outside click
        document.addEventListener('click', function() {
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        });

        // ===== LOAD LINK PREVIEWS =====
        document.querySelectorAll('.link-preview-container').forEach(async (container) => {
            const url = container.getAttribute('data-url');
            const preview = await fetchLinkPreview(url);
            if (preview && preview.title) {
                container.innerHTML = `
                    <a href="${url}" target="_blank" class="link-preview">
                        ${preview.image ? `<img src="${preview.image}" class="link-preview-img" onerror="this.style.display='none'">` : ''}
                        <div class="link-preview-content">
                            <div class="link-preview-title">${escapeHtml(preview.title.substring(0, 60))}</div>
                            <div class="link-preview-desc">${preview.description ? escapeHtml(preview.description.substring(0, 80)) : 'No description'}</div>
                        </div>
                    </a>
                `;
            } else {
                container.innerHTML = '';
            }
        });
    }

    // ========== HELPER FUNCTIONS ==========
    function getTypeIcon(type) {
        const icons = {
            'note': '📝',
            'link': '🔗',
            'image': '📸'
        };
        return icons[type] || '📄';
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            if (m === '"') return '&quot;';
            return m;
        });
    }

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // ========== ADD MEMORY ==========
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
                saveBtn.innerHTML = '⏳ Saving...';
                saveBtn.classList.add('btn-loading');
            }
        }

        try {
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            await window.addDoc(memoriesRef, {
                type: type,
                content: content,
                timestamp: new Date().toISOString()
            });
            showToast('✅ Memory saved!');
            await loadMemories();
        } catch (error) {
            console.error("Save error:", error);
            showToast("Failed to save: " + error.message, true);
        } finally {
            if (type === 'link' && saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '💾 Save to Second Brain';
                saveBtn.classList.remove('btn-loading');
            }
        }
    }

    // ========== SEARCH ==========
    function searchMemories() {
        if (searchInput) {
            renderMemories(searchInput.value.trim());
        }
    }

    // ========== SCROLL TO SAVE ==========
    function scrollToSave() {
        document.querySelector('.save-section')?.scrollIntoView({ behavior: 'smooth' });
    }

    // ========== FILTER BUTTONS ==========
    function initFilters() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                filterBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.getAttribute('data-filter');
                if (searchInput) {
                    renderMemories(searchInput.value.trim());
                } else {
                    renderMemories('');
                }
            });
        });
    }

    // ========== SCREENSHOT UPLOAD ==========
    const uploadArea = document.getElementById('uploadArea');
    const screenshotInput = document.getElementById('screenshotInput');
    const uploadBtn = document.getElementById('uploadBtn');

    if (uploadArea) {
        uploadArea.addEventListener('click', () => screenshotInput?.click());
    }
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => screenshotInput?.click());
    }

    if (screenshotInput) {
        screenshotInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!currentUser) {
                showToast('Please sign in first!', true);
                return;
            }

            if (uploadBtn) {
                uploadBtn.disabled = true;
                uploadBtn.innerHTML = '⏳ Uploading...';
                uploadBtn.classList.add('btn-loading');
            }

            try {
                const compressedFile = await compressImage(file);
                const formData = new FormData();
                formData.append('image', compressedFile);

                // ImgBB upload
                const response = await fetch('https://api.imgbb.com/1/upload?key=e27afa0854f1728a1445914cdd2f5304', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (!data.success) {
          
