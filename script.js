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
        try {
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            const q = window.query(memoriesRef, window.orderBy("timestamp", "desc"));
            const querySnapshot = await window.getDocs(q);
            memories = [];
            querySnapshot.forEach((doc) => {
                memories.push({ id: doc.id, ...doc.data() });
            });
            renderMemories();
        } catch (error) {
            if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">Error loading memories</div>';
            showToast("Failed to load memories", true);
        }
    }

    async function deleteMemory(id) {
        if (!currentUser) return;
        try {
            await window.deleteDoc(window.doc(window.db, `users/${currentUser.uid}/memories`, id));
            showToast('Memory deleted');
            await loadMemories();
        } catch (error) {
            showToast("Failed to delete", true);
        }
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

    function renderMemories(filterText = '') {
        if (!currentUser || !memoriesList) return;
        if (memories.length === 0) {
            memoriesList.innerHTML = '<div class="empty-message">No memories yet. Save your first one!</div>';
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
            <div class="memory-card">
                <div class="memory-header">
                    <div class="memory-type">${memory.type === 'note' ? 'Note' : memory.type === 'link' ? 'Link' : 'Image'}</div>
                    <div class="menu-container">
                        <button class="three-dots" data-id="${memory.id}">⋮</button>
                        <div class="dropdown-menu" id="menu-${memory.id}">
                            <button class="edit-btn" data-id="${memory.id}">Edit</button>
                            <button class="share-btn" data-id="${memory.id}">Share</button>
                            <button class="delete-btn-menu" data-id="${memory.id}">Delete</button>
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
                            <button class="download-btn" onclick="downloadImage('${memory.content}')">⬇️ Download</button>
                        </div>` :
                        memory.content
                    }
                </div>
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
                    const newContent = prompt('Edit:', memory.content);
                    if (newContent && newContent.trim()) editMemory(id, newContent.trim());
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

        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.onclick = () => {
                if (!currentUser) { showToast('Please sign in first!', true); return; }
                if (memories.length === 0) { showToast('No memories to clear', true); return; }
                if (confirm('⚠️ Are you sure? This will delete ALL your memories permanently!')) {
                    deleteAllMemories();
                }
            };
        }
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
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            await window.addDoc(memoriesRef, {
                type: type,
                content: content,
                timestamp: new Date().toISOString()
            });
            showToast('Memory saved!');
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
        if (aiSearchInput) renderMemories(aiSearchInput.value.trim());
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
        } else {
            currentUser = null;
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (avatarImg) avatarImg.style.display = 'none';
            if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">Please sign in to see your memories</div>';
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
