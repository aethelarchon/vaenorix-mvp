// Firebase is already loaded from index.html
// Wait for page to load
document.addEventListener('DOMContentLoaded', async function() {
    
    // Get elements
    const noteInput = document.getElementById('noteInput');
    const linkInput = document.getElementById('linkInput');
    const saveBtn = document.getElementById('saveBtn');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const memoriesList = document.getElementById('memoriesList');
    const getStartedBtn = document.getElementById('getStartedBtn');

    let memories = [];

    // Load memories from Firebase
    async function loadMemories() {
        try {
            const q = query(collection(window.db, "memories"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            memories = [];
            querySnapshot.forEach((doc) => {
                memories.push({ id: doc.id, ...doc.data() });
            });
            renderMemories();
        } catch (error) {
            console.error("Error loading memories:", error);
            memoriesList.innerHTML = '<div class="empty-message">⚠️ Error loading memories. Check console.</div>';
        }
    }

    // Delete memory
    async function deleteMemory(id) {
        try {
            await deleteDoc(doc(window.db, "memories", id));
            await loadMemories(); // Reload after delete
        } catch (error) {
            console.error("Error deleting:", error);
            alert("Failed to delete. Check console.");
        }
    }

    // Render memories
    function renderMemories(filterText = '') {
        if (memories.length === 0) {
            memoriesList.innerHTML = '<div class="empty-message">✨ No memories yet. Save your first one above!</div>';
            return;
        }

        let filteredMemories = memories;
        if (filterText) {
            filteredMemories = memories.filter(m => 
                m.content.toLowerCase().includes(filterText.toLowerCase())
            );
        }

        if (filteredMemories.length === 0) {
            memoriesList.innerHTML = '<div class="empty-message">🔍 No memories found. Try a different search.</div>';
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

    // Add new memory to Firebase
    async function addMemory() {
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
            await addDoc(collection(window.db, "memories"), {
                type: type,
                content: content,
                timestamp: new Date().toISOString()
            });
            await loadMemories(); // Reload after adding
        } catch (error) {
            console.error("Error adding memory:", error);
            alert("Failed to save. Check console.");
        }
    }

    // Search memories (local filter)
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
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchMemories();
        }
    });

    // Initial load
    await loadMemories();
});
