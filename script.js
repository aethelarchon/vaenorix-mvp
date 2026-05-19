// Firebase is already loaded from index.html
document.addEventListener('DOMContentLoaded', async function() {
    
    // Get elements
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

    // Check auth state
    window.onAuthStateChanged(window.auth, async (user) => {
        if (user) {
            currentUser = user;
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
            await loadMemories();
        } else {
            currentUser = null;
            loginBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
            memoriesList.innerHTML = '<div class="empty-message">🔐 Please sign in to see your memories</div>';
        }
    });

    // Login function
    async function login() {
        const provider = new window.GoogleAuthProvider();
        try {
            await window.signInWithPopup(window.auth, provider);
        } catch (error) {
            console.error("Login error:", error);
            alert("Login failed: " + error.message);
        }
    }

    // Logout function
    async function logout() {
        try {
            await window.auth.signOut();
        } catch (error) {
            console.error("Logout error:", error);
        }
    }

    // Load memories from Firebase (only current user's)
    async function loadMemories() {
        if (!currentUser) return;
        
        try {
            const q = query(collection(window.db, `users/${currentUser.uid}/memories`), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            memories = [];
            querySnapshot.forEach((doc) => {
                memories.push({ id: doc.id, ...doc.data() });
            });
            renderMemories();
        } catch (error) {
            console.error("Error loading memories:", error);
            memoriesList.innerHTML = '<div class="empty-message">⚠️ Error loading memories</div>';
        }
    }

    // Delete memory
    async function deleteMemory(id) {
        if (!currentUser) return;
        try {
            await deleteDoc(doc(window.db, `users/${currentUser.uid}/memories`, id));
            await loadMemories();
        } catch (error) {
            console.error("Error deleting:", error);
            alert("Failed to delete");
        }
    }

    // Render memories
    function renderMemories(filterText = '') {
        if (!currentUser) return;
        
        if (memories.length === 0) {
            memoriesList.innerHTML = '<div class="empty-message">✨ No memories yet. Save your first one!</div>';
            return;
        }

        let filteredMemories = memories;
        if (filterText) {
            filteredMemories = memories.filter(m => 
                m.content.toLowerCase().includes(filterText.toLowerCase())
            );
        }

        if (filteredMemories.length === 0) {
            memoriesList.innerHTML = '<div class="empty-message">🔍 No memories found</div>';
            return;
        }

        memoriesList.innerHTML = filteredMemories.map((memory) => `
            <div class="memory-card">
                <div class="memory-header">
                    <div class="memory-type">${memory.type === 'note' ? '📝 Note' : '🔗 Link'}</div>
                    <button class="delete-btn" data-id="${memory.id}">🗑️ Delete</button>
                </div>
                <div class="memory-content">
                    ${memory.type === 'link' ? 
                        `<a href="${memory.content}" target="_blank" class="memory-link">${memory.content}</a>` : 
                        memory.content
                    }
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                deleteMemory(id);
            });
        });
    }

    // Add new memory
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
        }

        try {
            await addDoc(collection(window.db, `users/${currentUser.uid}/memories`), {
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

    // Search memories
    function searchMemories() {
        const searchTerm = searchInput.value.trim();
        renderMemories(searchTerm);
    }

    function scrollToSave() {
        document.querySelector('.save-section').scrollIntoView({ behavior: 'smooth' });
    }

    // Event listeners
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
});
