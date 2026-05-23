// Image compression function before upload
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

// Toast Notification Function
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

document.addEventListener('DOMContentLoaded', function() {
    
    const noteInput = document.getElementById('noteInput');
    const linkInput = document.getElementById('linkInput');
    const saveBtn = document.getElementById('saveBtn');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const memoriesList = document.getElementById('memoriesList');
    const getStartedBtn = document.getElementById('getStartedBtn');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    let memories = [];
    let currentUser = null;
    let currentFilter = 'all';

    window.onAuthStateChanged(window.auth, async (user) => {
        const avatarImg = document.getElementById('userAvatar');
        if (user) {
            currentUser = user;
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-block';
            if (avatarImg && user.photoURL) {
                avatarImg.src = user.photoURL;
                avatarImg.style.display = 'block';
            }
            await loadMemories();
        } else {
            currentUser = null;
            loginBtn.style.display = 'inline-block';
            logoutBtn.style.display = 'none';
            if (avatarImg) {
                avatarImg.style.display = 'none';
            }
            memoriesList.innerHTML = '<div class="empty-message">Please sign in to see your memories</div>';
        }
    });

    async function login() {
        const provider = new window.GoogleAuthProvider();
        try {
            await window.signInWithPopup(window.auth, provider);
            showToast('Welcome back!');
        } catch (error) {
            showToast("Login failed: " + error.message, true);
        }
    }

    async function logout() {
        try {
            await window.auth.signOut();
            showToast('Logged out successfully');
        } catch (error) {
            showToast("Logout failed", true);
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
            memoriesList.innerHTML = '<div class="empty-message">Error loading memories</div>';
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
            const data = await response.json();
            return data;
        } catch (error) {
            return null;
        }
    }

    async function deleteAllMemories() {
        if (!currentUser) return;
        try {
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            const querySnapshot = await window.getDocs(memoriesRef);
            for (const doc of querySnapshot.docs) {
                await window.deleteDoc(window.doc(window.db, `users/${currentUser.uid}/memories`, doc.id));
            }
            showToast('All memories cleared!');
            await loadMemories();
        } catch (error) {
            console.error("Clear all error:", error);
            showToast('Failed to clear memories', true);
        }
    }

    function renderMemories(filterText = '', aiFilterIds = null) {
        if (!currentUser) return;
        
        if (memories.length === 0) {
            memoriesList.innerHTML = '<div class="empty-message">No memories yet. Save your first one!</div>';
            return;
        }

        let filteredMemories = memories;
        if (aiFilterIds && aiFilterIds.length > 0) {
            filteredMemories = filteredMemories.filter(m => aiFilterIds.includes(m.id));
        }
        if (currentFilter !== 'all') {
            filteredMemories = filteredMemories.filter(m => m.type === currentFilter);
        }
        if (filterText) {
            filteredMemories = filteredMemories.filter(m => 
                m.content.toLowerCase().includes(filterText.toLowerCase())
            );
        }
        
        const counterSpan = document.getElementById('memoryCount');
        if (counterSpan) {
            counterSpan.textContent = `(${filteredMemories.length})`;
        }
        
        if (filteredMemories.length === 0) {
            memoriesList.innerHTML = '<div class="empty-message">No memories found</div>';
            return;
        }

        memoriesList.innerHTML = filteredMemories.map((memory) => `
            <div class="memory-card">
                <div class="memory-header">
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
                if(menu) menu.classList.toggle('show');
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.getAttribute('data-id');
                const memory = memories.find(m => m.id === id);
                if(memory) {
                    const newContent = prompt('Edit:', memory.content);
                    if (newContent && newContent.trim()) {
                        editMemory(id, newContent.trim());
                    }
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
                if(memory) window.shareMemory(memory.content, memory.type);
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

        const note = noteInput.value.trim();
        const link = linkInput.value.trim();

        if (!note && !link) {
            showToast('Please write a note or paste a link', true);
            return;
        }

        let type = '';
        let content = '';

        if (note) {
            type = 'note';
            content = note;
            noteInput.value = '';
        } else if (link) {
            type = 'link';
            content = link;
            linkInput.value = '';
            
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
            saveBtn.classList.add('btn-loading');
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
            console.error("Add memory error:", error);
            showToast("Failed to save", true);
        } finally {
            if (type === 'link') {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save to Second Brain';
                saveBtn.classList.remove('btn-loading');
            }
        }
    }

    function searchMemories() {
        renderMemories(searchInput.value.trim());
    }

    function scrollToSave() {
        document.querySelector('.save-section').scrollIntoView({ behavior: 'smooth' });
    }

    function initFilters() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        if (filterBtns.length === 0) return;
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                filterBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.getAttribute('data-filter');
                renderMemories(searchInput.value.trim());
            });
        });
    }

    // Screenshot Upload
    const uploadArea = document.getElementById('uploadArea');
    const screenshotInput = document.getElementById('screenshotInput');
    const uploadBtn = document.getElementById('uploadBtn');

    if(uploadArea) uploadArea.addEventListener('click', () => screenshotInput.click());
    if(uploadBtn) uploadBtn.addEventListener('click', () => screenshotInput.click());

    if(screenshotInput) {
        screenshotInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!currentUser) return showToast('Please sign in first!', true);

            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<span class="spinner"></span> Uploading...';
            uploadBtn.classList.add('btn-loading');

            const compressedFile = await compressImage(file);
            const formData = new FormData();
            formData.append('image', compressedFile);

            try {
                const response = await fetch('https://api.imgbb.com/1/upload?key=e27afa0854f1728a1445914cdd2f5304', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if(!data.success) throw new Error(data.error.message);

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
                console.error("Upload error:", error);
                showToast('Failed: ' + error.message, true);
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fas fa-camera"></i> Upload Screenshot';
                uploadBtn.classList.remove('btn-loading');
                screenshotInput.value = '';
            }
        });
    }

    // Export Data Button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            if (!currentUser) {
                showToast('Please sign in first!', true);
                return;
            }
            if (memories.length === 0) {
                showToast('No memories to export', true);
                return;
            }
            showToast('Preparing export...');
            const exportData = {
                exportDate: new Date().toISOString(),
                version: '1.0',
                memories: memories.map(m => ({
                    type: m.type,
                    content: m.content,
                    timestamp: m.timestamp
                }))
            };
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vaenorix-backup-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(`Exported ${memories.length} memories!`);
        });
    }

    // Clear All Button
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (!currentUser) {
                showToast('Please sign in first!', true);
                return;
            }
            if (memories.length === 0) {
                showToast('No memories to clear', true);
                return;
            }
            if (confirm('⚠️ Are you sure? This will delete ALL your memories permanently!')) {
                deleteAllMemories();
            }
        });
    }

    // AI Natural Language Search
    const aiSearchInput = document.getElementById('aiSearchInput');
    const aiSearchBtn = document.getElementById('aiSearchBtn');
    const aiSearchResult = document.getElementById('aiSearchResult');

    function parseAIQuery(query, memoriesList) {
        query = query.toLowerCase();
        let filtered = [...memoriesList];
        let message = '';
        
        const now = new Date();
        let startDate = null;
        
        if (query.includes('last week')) {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            message = 'Last week • ';
        } else if (query.includes('yesterday')) {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 1);
            message = 'Yesterday • ';
        } else if (query.includes('last month')) {
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 1);
            message = 'Last month • ';
        } else if (query.includes('today')) {
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            message = 'Today • ';
        }
        
        if (startDate)
