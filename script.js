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
        if (user) {
            currentUser = user;
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-block';
            await loadMemories();
        } else {
            currentUser = null;
            loginBtn.style.display = 'inline-block';
            logoutBtn.style.display = 'none';
            memoriesList.innerHTML = '<div class="empty-message">Please sign in to see your memories</div>';
        }
    });

    async function login() {
        const provider = new window.GoogleAuthProvider();
        try {
            await window.signInWithPopup(window.auth, provider);
        } catch (error) {
            console.error("Login error:", error);
            alert("Login failed: " + error.message);
        }
    }

    async function logout() {
        try {
            await window.auth.signOut();
        } catch (error) {
            console.error("Logout error:", error);
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
            console.error("Error loading memories:", error);
            memoriesList.innerHTML = '<div class="empty-message">Error loading memories</div>';
        }
    }

    async function deleteMemory(id) {
        if (!currentUser) return;
        try {
            await window.deleteDoc(window.doc(window.db, `users/${currentUser.uid}/memories`, id));
            await loadMemories();
        } catch (error) {
            console.error("Error deleting:", error);
            alert("Failed to delete");
        }
    }

    async function editMemory(id, newContent) {
        if (!currentUser) return;
        try {
            const memoryRef = window.doc(window.db, `users/${currentUser.uid}/memories`, id);
            await window.updateDoc(memoryRef, { content: newContent });
            await loadMemories();
        } catch (error) {
            alert("Failed to edit");
        }
    }

    function renderMemories(filterText = '') {
        if (!currentUser) return;
        
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
                            <button class="delete-btn-menu" data-id="${memory.id}">Delete</button>
                        </div>
                    </div>
                </div>
                <div class="memory-content">
                    ${memory.type === 'link' ? 
                        `<a href="${memory.content}" target="_blank" class="memory-link">${memory.content}</a>` : 
                        memory.type === 'image' ?
                        `<img src="${memory.content}" alt="Screenshot" loading="lazy" class="clickable-image" onclick="showImageModal('${memory.content}')">` :
                        memory.content
                    }
                </div>
                ${memory.summary ? `<div class="memory-summary">${memory.summary}</div>` : ''}
            </div>
        `).join('');

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

        document.addEventListener('click', function() {
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        });
    }

    async function addMemory() {
        if (!currentUser) {
            alert('Please sign in first!');
            login();
            return;
        }

        const note = noteInput.value.trim();
        const link = linkInput.value.trim();

        if (!note && !link) {
            alert('Please write a note or paste a link');
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
            saveBtn.textContent = 'Saving...';
            
            setTimeout(() => {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save to Second Brain';
            }, 500);
        }

        try {
            const memoriesRef = window.collection(window.db, `users/${currentUser.uid}/memories`);
            await window.addDoc(memoriesRef, {
                type: type,
                content: content,
                timestamp: new Date().toISOString()
            });
            await loadMemories();
        } catch (error) {
            console.error("Error adding memory:", error);
            alert("Failed to save");
        }
    }

    function searchMemories() {
        const searchTerm = searchInput.value.trim();
        renderMemories(searchTerm);
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

    const uploadArea = document.getElementById('uploadArea');
    const screenshotInput = document.getElementById('screenshotInput');
    const uploadBtn = document.getElementById('uploadBtn');

    if(uploadArea) uploadArea.addEventListener('click', () => screenshotInput.click());
    if(uploadBtn) uploadBtn.addEventListener('click', () => screenshotInput.click());

    if(screenshotInput) {
        screenshotInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!currentUser) return alert('Please sign in first!');

            uploadBtn.disabled = true;
            uploadBtn.innerHTML = 'Uploading...';

            const formData = new FormData();
            formData.append('image', file);

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

                alert('Screenshot saved!');
                await loadMemories();
            } catch (error) {
                alert('Failed: ' + error.message);
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = 'Upload Screenshot';
                screenshotInput.value = '';
            }
        });
    }

    saveBtn.addEventListener('click', addMemory);
    searchBtn.addEventListener('click', searchMemories);
    getStartedBtn.addEventListener('click', scrollToSave);
    loginBtn.addEventListener('click', login);
    logoutBtn.addEventListener('click', logout);
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchMemories();
        }
    });
    
    setTimeout(initFilters, 100);
});

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
    modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
};
