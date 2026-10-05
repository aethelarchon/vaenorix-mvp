// ============================================
// VAENORIX - Full Working Script
// Firebase v10 (modular)
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

// ========== HELPER FUNCTIONS ==========
function getTypeIcon(type) {
    const icons = { 'note': '📝', 'link': '🔗', 'image': '📸' };
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

function downloadImage(imageUrl) {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = 'vaenorix-memory.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function showImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.9); display: flex; align-items: center;
        justify-content: center; z-index: 10000; cursor: pointer;
    `;
    modal.innerHTML = `<img src="${imageUrl}" alt="Full Image" style="max-width: 90%; max-height: 90%; border-radius: 8px;">`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
}

function shareMemory(content, type) {
    if (navigator.share) {
        navigator.share({
            title: 'Vaenorix Memory',
            text: `Check out my memory: ${content.substring(0, 50)}...`
        }).catch(err => console.log('Error sharing:', err));
    } else {
        showToast('Share not supported on this device', true);
    }
}

// ========== DOM READY ==========
document.addEventListener('DOMContentLoaded', function() {

    const noteInput = document.getElementById('noteInput');
    const linkInput = document.getElementById('linkInput');
    const saveBtn = document.getElementById('saveBtn');
    const searchInput = document.getElementById('aiSearchInput');
    const searchBtn = document.getElementById('aiSearchBtn');
    const memoriesList = document.getElementById('memoriesList');
    const getStartedBtn = document.getElementById('getStartedBtn');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const exportBtn = document.getElementById('exportBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadArea = document.getElementById('uploadArea');
    const screenshotInput = document.getElementById('screenshotInput');

    let memories = [];
    let currentUser = null;
    let currentFilter = 'all';

    function waitForFirebase() {
        return new Promise((resolve) => {
            let attempts = 0;
            const checkFirebase = setInterval(() => {
                if (window.auth && window.db) {
                    clearInterval(checkFirebase);
                    console.log('✅ Firebase loaded');
                    resolve();
                } else if (attempts > 50) {
                    clearInterval(checkFirebase);
                    console.error('❌ Firebase failed');
                    resolve();
                }
                attempts++;
            }, 100);
        });
    }

    waitForFirebase().then(() => {
        if (!window.auth) return;
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
                if (avatarImg) avatarImg.style.display = 'none';
                if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">🔐 Please sign in to see your memories</div>';
            }
        });
    });

    async function login() {
        if (!window.auth || !window.GoogleAuthProvider) {
            showToast('Firebase not ready. Please refresh.', true);
            return;
        }
        const provider = new window.GoogleAuthProvider();
        try {
            await window.signInWithPopup(window.auth, provider);
        } catch (error) {
            if (error.code !== 'auth/cancelled-popup-request') {
                showToast("Login failed: " + error.message, true);
            }
        }
    }

    async function logout() {
        if (!window.auth) return;
        try {
            await window.auth.signOut();
            showToast('Logged out');
        } catch (error) {
            showToast("Logout failed", true);
        }
    }

    async function loadMemories() {
        if (!currentUser || !window.db) return;
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
            if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">❌ Error loading</div>';
        }
    }

    function updateMemoryCounter() {
        const counterSpan = document.getElementById('memoryCount');
        if (counterSpan) {
            const filtered = getFilteredMemories(searchInput ? searchInput.value.trim() : '');
            counterSpan.textContent = `(${filtered.length})`;
        }
    }

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

    async function deleteMemory(id) {
        if (!currentUser || !window.db) return;
        try {
            await window.deleteDoc(window.doc(window.db, `users/${currentUser.uid}/memories`, id));
            showToast('🗑️ Memory deleted');
            await loadMemories();
        } catch (error) {
            showToast("Failed to delete", true);
        }
    }

    async function editMemory(id, newContent) {
        if (!currentUser || !window.db) return;
        if (!newContent || !newContent.trim()) {
            showToast('Content cannot be empty', true);
            return;
        }
        try {
            const memoryRef = window.doc(window.db, `users/${currentUser.uid}/memories`, id);
            await window.updateDoc(memoryRef, { content: newContent.trim() });
            showToast('✏️ Updated');
            await loadMemories();
        } catch (error) {
            showToast("Failed to edit", true);
        }
    }

    async function deleteAllMemories() {
        if (!currentUser) { showToast('Please sign in!', true); return; }
        if (memories.length === 0) { showToast('No memories', true); return; }
        if (!confirm('⚠️ Delete ALL memories permanently?')) return;
        try {
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            const querySnapshot = await window.getDocs(memoriesRef);
            for (const doc of querySnapshot.docs) {
                await window.deleteDoc(window.doc(window.db, `users/${currentUser.uid}/memories`, doc.id));
            }
            showToast('🧹 Cleared!');
            await loadMemories();
        } catch (error) {
            showToast('Failed to clear', true);
        }
    }

    async function fetchLinkPreview(url) {
        try {
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            return await response.json();
        } catch (error) {
            return null;
        }
    }

    function renderMemories(filterText = '') {
        if (!currentUser) return;
        if (memories.length === 0) {
            if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">📭 No memories yet!</div>';
            return;
        }
        const filtered = getFilteredMemories(filterText);
        if (filtered.length === 0) {
            if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">🔍 No memories found</div>';
            return;
        }
        if (memoriesList) {
            memoriesList.innerHTML = filtered.map((memory) => {
                let contentHtml = '';
                if (memory.type === 'link') {
                    contentHtml = `<a href="${escapeHtml(memory.content)}" target="_blank" class="memory-link">${escapeHtml(memory.content)}</a>`;
                } else if (memory.type === 'image') {
                    contentHtml = `<div style="position: relative;"><img src="${escapeHtml(memory.content)}" alt="Screenshot" class="clickable-image" onclick="showImageModal('${escapeHtml(memory.content)}')"><button class="download-btn" onclick="downloadImage('${escapeHtml(memory.content)}')">⬇️ Download</button></div>`;
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
                        <div class="memory-content">${contentHtml}</div>
                        <div class="memory-time">${formatTime(memory.timestamp)}</div>
                    </div>
                `;
            }).join('');
        }

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
                    const newContent = prompt('✏️ Edit:', memory.content);
                    if (newContent !== null && newContent.trim()) editMemory(id, newContent.trim());
                }
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            });
        });

        document.querySelectorAll('.delete-btn-menu').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                if (confirm('Delete this memory?')) deleteMemory(id);
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            });
        });

        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                const memory = memories.find(m => m.id === id);
                if (memory) shareMemory(memory.content, memory.type);
                document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            });
        });

        document.addEventListener('click', function() {
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
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
        }
        try {
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            await window.addDoc(memoriesRef, {
                type: type,
                content: content,
                timestamp: Date.now()
            });
            showToast('💾 Saved!');
            await loadMemories();
        } catch (error) {
            console.error('Save error:', error);
            showToast("Failed to save", true);
        }
    }

    async function uploadScreenshot(file) {
        if (!currentUser) { showToast('Please sign in!', true); return; }
        try {
            showToast('⏳ Compressing image...');
            const compressed = await compressImage(file);
            const reader = new FileReader();
            reader.readAsDataURL(compressed);
            reader.onload = async (e) => {
                const dataUrl = e.target.result;
                try {
                    const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
                    await window.addDoc(memoriesRef, {
                        type: 'image',
                        content: dataUrl,
                        timestamp: Date.now()
                    });
                    showToast('📸 Image saved!');
                    await loadMemories();
                } catch (error) {
                    showToast('Failed to save image', true);
                }
            };
        } catch (error) {
            showToast('Image upload failed', true);
        }
    }

    // ========== EVENT LISTENERS ==========
    if (saveBtn) saveBtn.addEventListener('click', addMemory);
    if (loginBtn) loginBtn.addEventListener('click', login);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (getStartedBtn) getStartedBtn.addEventListener('click', () => {
        if (!currentUser) login();
        else if (noteInput) noteInput.focus();
    });
    if (clearAllBtn) clearAllBtn.addEventListener('click', deleteAllMemories);

    if (uploadBtn) uploadBtn.addEventListener('click', () => {
        if (screenshotInput) screenshotInput.click();
    });

    if (uploadArea) uploadArea.addEventListener('click', () => {
        if (screenshotInput) screenshotInput.click();
    });

    if (screenshotInput) {
        screenshotInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                uploadScreenshot(e.target.files[0]);
                this.value = '';
            }
        });
    }

    if (noteInput) {
        noteInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addMemory();
        });
    }

    if (linkInput) {
        linkInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addMemory();
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const filterText = searchInput ? searchInput.value.trim() : '';
            renderMemories(filterText);
            updateMemoryCounter();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                renderMemories(searchInput.value.trim());
                updateMemoryCounter();
            }
        });
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.getAttribute('data-filter');
            renderMemories();
            updateMemoryCounter();
        });
    });

      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (memories.length === 0) { showToast('No memories to export', true); return; }
            const dataStr = JSON.stringify(memories, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vaenorix-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('📥 Exported!');
        });
    }

});
