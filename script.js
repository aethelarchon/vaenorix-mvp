// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    
    // Get elements
    const noteInput = document.getElementById('noteInput');
    const linkInput = document.getElementById('linkInput');
    const saveBtn = document.getElementById('saveBtn');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const memoriesList = document.getElementById('memoriesList');
    const getStartedBtn = document.getElementById('getStartedBtn');

    // Load saved memories from localStorage
    let memories = [];

    function loadMemories() {
        const saved = localStorage.getItem('vaenorix_memories');
        if (saved) {
            memories = JSON.parse(saved);
        }
        renderMemories();
    }

    // Save memories to localStorage
    function saveToLocal() {
        localStorage.setItem('vaenorix_memories', JSON.stringify(memories));
    }

    // Render memories on screen
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

        memoriesList.innerHTML = filteredMemories.map((memory, index) => `
            <div class="memory-card">
                <div class="memory-type">${memory.type === 'note' ? '📝 Note' : '🔗 Link'}</div>
                <div class="memory-content">
                    ${memory.type === 'link' ? 
                        `<a href="${memory.content}" target="_blank" class="memory-link">${memory.content}</a>` : 
                        memory.content
                    }
                </div>
            </div>
        `).join('');
    }

    // Add new memory
    function addMemory() {
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

        memories.unshift({
            id: Date.now(),
            type: type,
            content: content,
            date: new Date().toISOString()
        });

        saveToLocal();
        renderMemories();
    }

    // Search memories
    function searchMemories() {
        const searchTerm = searchInput.value.trim();
        renderMemories(searchTerm);
    }

    // Scroll to save section when button clicked
    function scrollToSave() {
        document.querySelector('.save-section').scrollIntoView({ behavior: 'smooth' });
    }

    // Event listeners
    saveBtn.addEventListener('click', addMemory);
    searchBtn.addEventListener('click', searchMemories);
    getStartedBtn.addEventListener('click', scrollToSave);
    
    // Press Enter to search
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchMemories();
        }
    });

    // Initial load
    loadMemories();
});
