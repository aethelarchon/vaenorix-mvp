// ============================================
// VAENORIX - Full Working Script (Complete)
// ============================================

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
                if (width > 1200) { height = (height * 1200) / width; width = 1200; }
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

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (isError) toast.classList.add('error');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2500);
}

function getTypeIcon(type) {
    const icons = { 'note': '📝', 'link': '🔗', 'image': '📸' };
    return icons[type] || '📄';
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

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
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:10000;cursor:pointer;';
    modal.innerHTML = '<img src="' + imageUrl + '" style="max-width:90%;max-height:90%;border-radius:8px;">';
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
}

function shareMemory(content) {
    if (navigator.share) {
        navigator.share({ title: 'Vaenorix Memory', text: 'Check out: ' + content.substring(0, 50) }).catch(e => {});
    } else {
        showToast('Share not supported', true);
    }
}

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
            const check = setInterval(() => {
                if (window.auth && window.db) { clearInterval(check); resolve(); }
                else if (attempts > 50) { clearInterval(check); resolve(); }
                attempts++;
            }, 100);
        });
    }

    waitForFirebase().then(() => {
        if (!window.auth) return;
        if (window.getRedirectResult) {
            window.getRedirectResult(window.auth).catch((e) => console.log('Redirect error:', e));
        }
        window.onAuthStateChanged(window.auth, async (user) => {
            const avatarImg = document.getElementById('userAvatar');
            if (user) {
                currentUser = user;
                if (loginBtn) loginBtn.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'inline-block';
                if (avatarImg && user.photoURL) { avatarImg.src = user.photoURL; avatarImg.style.display = 'block'; }
                await loadMemories();
                showToast('Welcome! 👋');
            } else {
                currentUser = null;
                if (loginBtn) loginBtn.style.display = 'inline-block';
                if (logoutBtn) logoutBtn.style.display = 'none';
                if (avatarImg) avatarImg.style.display = 'none';
                if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">🔐 Please sign in</div>';
            }
        });
    });

    async function login() {
        if (!window.auth || !window.GoogleAuthProvider) { showToast('Firebase not ready', true); return; }
        const provider = new window.GoogleAuthProvider();
        try { await window.signInWithRedirect(window.auth, provider); }
        catch (error) { showToast('Login failed: ' + error.message, true); }
    }

    async function logout() {
        if (!window.auth) return;
        try { await window.auth.signOut(); showToast('Logged out'); }
        catch (error) { showToast('Logout failed', true); }
    }

    async function loadMemories() {
        if (!currentUser || !window.db) return;
        try {
            const ref = window.collection(window.db, 'users/' + currentUser.uid + '/memories');
            const q = window.query(ref, window.orderBy('timestamp', 'desc'));
            const snap = await window.getDocs(q);
            memories = [];
            snap.forEach((d) => memories.push({ id: d.id, ...d.data() }));
            renderMemories();
            updateMemoryCounter();
        } catch (e) { if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">❌ Error loading</div>'; }
    }

    function updateMemoryCounter() {
        const c = document.getElementById('memoryCount');
        if (c) c.textContent = '(' + getFilteredMemories(searchInput ? searchInput.value.trim() : '').length + ')';
    }

    function getFilteredMemories(filterText = '') {
        let f = memories;
        if (currentFilter !== 'all') f = f.filter(m => m.type === currentFilter);
        if (filterText) f = f.filter(m => m.content && m.content.toLowerCase().includes(filterText.toLowerCase()));
        return f;
    }

    async function deleteMemory(id) {
        if (!currentUser || !window.db) return;
        try { await window.deleteDoc(window.doc(window.db, 'users/' + currentUser.uid + '/memories', id)); showToast('🗑️ Deleted'); await loadMemories(); }
        catch (e) { showToast('Failed to delete', true); }
    }

    async function editMemory(id, newContent) {
        if (!currentUser || !window.db) return;
        try { await window.updateDoc(window.doc(window.db, 'users/' + currentUser.uid + '/memories', id), { content: newContent.trim() }); showToast('✏️ Updated'); await loadMemories(); }
        catch (e) { showToast('Failed', true); }
    }

    async function deleteAllMemories() {
        if (!currentUser) { showToast('Sign in first!', true); return; }
        if (memories.length === 0) { showToast('No memories', true); return; }
        if (!confirm('⚠️ Delete ALL memories?')) return;
        try {
            const ref = window.collection(window.db, 'users/' + currentUser.uid + '/memories');
            const snap = await window.getDocs(ref);
            for (const d of snap.docs) { await window.deleteDoc(window.doc(window.db, 'users/' + currentUser.uid + '/memories', d.id)); }
            showToast('🧹 Cleared'); await loadMemories();
        } catch (e) { showToast('Failed', true); }
    }

    function renderMemories(filterText = '') {
        if (!currentUser) return;
        if (memories.length === 0) { if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">📭 No memories yet!</div>'; return; }
        const filtered = getFilteredMemories(filterText);
        if (filtered.length === 0) { if (memoriesList) memoriesList.innerHTML = '<div class="empty-message">🔍 Nothing found</div>'; return; }
        if (memoriesList) {
            memoriesList.innerHTML = filtered.map((m) => {
                let html = '';
                if (m.type === 'link') { html = '<a href="' + escapeHtml(m.content) + '" target="_blank" class="memory-link">' + escapeHtml(m.content) + '</a>'; }
                else if (m.type === 'image') { html = '<div><img src="' + escapeHtml(m.content) + '" class="clickable-image" onclick="showImageModal(\'' + escapeHtml(m.content) + '\')"><button class="download-btn" onclick="downloadImage(\'' + escapeHtml(m.content) + '\')">⬇️ Download</button></div>'; }
                else { html = '<div class="note-content">' + escapeHtml(m.content) + '</div>'; }
                return '<div class="memory-card"><div class="memory-header"><div class="memory-type">' + getTypeIcon(m.type) + ' ' + capitalize(m.type) + '</div><div class="menu-container"><button class="three-dots" data-id="' + m.id + '">⋯</button><div class="dropdown-menu" id="menu-' + m.id + '"><button class="edit-btn" data-id="' + m.id + '">✏️ Edit</button><button class="delete-btn-menu" data-id="' + m.id + '">🗑️ Delete</button></div></div></div><div class="memory-content">' + html + '</div><div class="memory-time">' + formatTime(m.timestamp) + '</div></div>';
            }).join('');
        }
        document.querySelectorAll('.three-dots').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation(); const id = this.getAttribute('data-id');
                document.querySelectorAll('.dropdown-menu').forEach(x => x.classList.remove('show'));
                const menu = document.getElementById('menu-' + id); if (menu) menu.classList.toggle('show');
            });
        });
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation(); const id = this.getAttribute('data-id');
                const m = memories.find(x => x.id === id);
                if (m) { const nc = prompt('✏️ Edit:', m.content); if (nc !== null && nc.trim()) editMemory(id, nc.trim()); }
                document.querySelectorAll('.dropdown-menu').forEach(x => x.classList.remove('show'));
            });
        });
        document.querySelectorAll('.delete-btn-menu').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation(); const id = this.getAttribute('data-id');
                if (confirm('Delete?')) deleteMemory(id);
                document.querySelectorAll('.dropdown-menu').forEach(x => x.classList.remove('show'));
            });
        });
        document.addEventListener('click', function() { document.querySelectorAll('.dropdown-menu').forEach(x => x.classList.remove('show')); });
    }

    async function addMemory() {
        if (!currentUser) { showToast('Sign in first!', true); login(); return; }
        const note = noteInput ? noteInput.value.trim() : '';
        const link = linkInput ? linkInput.value.trim() : '';
        if (!note && !link) { showToast('Write something', true); return; }
        let type = '', content = '';
        if (note) { type = 'note'; content = note; if (noteInput) noteInput.value = ''; }
        else if (link) { type = 'link'; content = link; if (linkInput) linkInput.value = ''; }
        try {
            const ref = window.collection(window.db, 'users/' + currentUser.uid + '/memories');
            await window.addDoc(ref, { type: type, content: content, timestamp: Date.now() });
            showToast('💾 Saved!'); await loadMemories();
        } catch (e) { showToast('Failed to save', true); }
    }

    async function uploadScreenshot(file) {
        if (!currentUser) { showToast('Sign in first!', true); return; }
        try {
            showToast('⏳ Compressing...');
            const compressed = await compressImage(file);
            const reader = new FileReader();
            reader.readAsDataURL(compressed);
            reader.onload = async (e) => {
                try {
                    const ref = window.collection(window.db, 'users/' + currentUser.uid + '/memories');
                    await window.addDoc(ref, { type: 'image', content: e.target.result, timestamp: Date.now() });
                    showToast('📸 Saved!'); await loadMemories();
                } catch (err) { showToast('Failed', true); }
            };
        } catch (e) { showToast('Upload failed', true); }
    }

    if (saveBtn) saveBtn.addEventListener('click', addMemory);
    if (loginBtn) loginBtn.addEventListener('click', login);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (getStartedBtn) getStartedBtn.addEventListener('click', () => { if (!currentUser) login(); else if (noteInput) noteInput.focus(); });
    if (clearAllBtn) clearAllBtn.addEventListener('click', deleteAllMemories);
    if (uploadBtn) uploadBtn.addEventListener('click', () => { if (screenshotInput) screenshotInput.click(); });
    if (uploadArea) uploadArea.addEventListener('click', () => { if (screenshotInput) screenshotInput.click(); });
    if (screenshotInput) screenshotInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files[0]) { uploadScreenshot(e.target.files[0]); this.value = ''; }
    });
    if (noteInput) noteInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addMemory(); });
    if (linkInput) linkInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addMemory(); });
    if (searchBtn) searchBtn.addEventListener('click', () => { renderMemories(searchInput ? searchInput.value.trim() : ''); updateMemoryCounter(); });
    if (searchInput) searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { renderMemories(searchInput.value.trim()); updateMemoryCounter(); } });
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active'); currentFilter = this.getAttribute('data-filter');
            renderMemories(); updateMemoryCounter();
        });
    });
    if (exportBtn) exportBtn.addEventListener('click', () => {
        if (memories.length === 0) { showToast('No data', true); return; }
        const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'vaenorix-backup.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showToast('📥 Exported!');
    });
});
