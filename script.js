(() => {
    const $ = (id) => document.getElementById(id);
    const memoryForm = $('memoryForm');
    const noteInput = $('noteInput');
    const linkInput = $('linkInput');
    const saveBtn = $('saveBtn');
    const searchForm = $('searchForm');
    const searchInput = $('searchInput');
    const memoriesContainer = $('memories-container');
    const memoryCount = $('memoryCount');
    const loginBtn = $('loginBtn');
    const logoutBtn = $('logoutBtn');
    const accountStatus = $('accountStatus');
    const clearAllBtn = $('clearAllBtn');
    const exportBtn = $('exportBtn');
    const getStartedBtn = $('getStartedBtn');

    let currentUser = null;
    let memories = [];
    let currentFilter = 'all';

    function showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.className = `toast${isError ? ' error' : ''}`;
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        window.setTimeout(() => {
            toast.classList.remove('show');
            window.setTimeout(() => toast.remove(), 300);
        }, 2800);
    }

    function formatDate(value) {
        const date = value && typeof value.toDate === 'function'
            ? value.toDate()
            : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString();
    }

    function parseWebUrl(value) {
        try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) ? url : null;
        } catch {
            return null;
        }
    }

    function setSignedInView(user) {
        const signedIn = Boolean(user);
        loginBtn.hidden = signedIn;
        logoutBtn.hidden = !signedIn;
        accountStatus.textContent = signedIn
            ? `Signed in${user.displayName ? ` as ${user.displayName}` : ''}`
            : 'Sign in to access your memories';
        saveBtn.disabled = !signedIn;
        clearAllBtn.disabled = !signedIn;
        exportBtn.disabled = !signedIn;
    }

    function createMemoryCard(memory) {
        const card = document.createElement('article');
        card.className = 'memory-card';

        const header = document.createElement('div');
        header.className = 'memory-header';

        const type = document.createElement('span');
        type.className = 'memory-type';
        type.textContent = {
            note: '📝 Note',
            link: '🔗 Link',
            image: '🖼️ Image'
        }[memory.type] || '📄 Memory';

        const date = document.createElement('time');
        date.textContent = formatDate(memory.createdAt);
        header.append(type, date);

        const content = document.createElement('div');
        content.className = 'memory-content';
        if (memory.type === 'link' && parseWebUrl(memory.content)) {
            const link = document.createElement('a');
            link.className = 'memory-link';
            link.href = parseWebUrl(memory.content).href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = memory.content;
            content.appendChild(link);
        } else if (memory.type === 'image' && parseWebUrl(memory.content)) {
            const image = document.createElement('img');
            image.src = parseWebUrl(memory.content).href;
            image.alt = 'Saved memory';
            image.loading = 'lazy';
            content.appendChild(image);
        } else {
            content.textContent = memory.content || '';
        }

        const actions = document.createElement('div');
        actions.className = 'memory-actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteMemory(memory.id));
        actions.appendChild(deleteBtn);

        card.append(header, content, actions);
        return card;
    }

    function renderMemories() {
        memoriesContainer.replaceChildren();
        memoryCount.textContent = `(${memories.length})`;

        if (!currentUser) {
            const message = document.createElement('p');
            message.className = 'empty-message';
            message.textContent = 'Sign in to see your memories.';
            memoriesContainer.appendChild(message);
            return;
        }

        const term = searchInput.value.trim().toLocaleLowerCase();
        const visibleMemories = memories.filter((memory) => {
            const matchesType = currentFilter === 'all' || memory.type === currentFilter;
            const matchesSearch = !term || String(memory.content || '').toLocaleLowerCase().includes(term);
            return matchesType && matchesSearch;
        });

        if (visibleMemories.length === 0) {
            const message = document.createElement('p');
            message.className = 'empty-message';
            message.textContent = memories.length
                ? 'No memories match that search.'
                : 'No memories saved yet. Add your first note or link above.';
            memoriesContainer.appendChild(message);
            return;
        }

        visibleMemories.forEach((memory) => {
            memoriesContainer.appendChild(createMemoryCard(memory));
        });
    }

    async function loadMemories() {
        if (!currentUser) return;
        try {
            const snapshot = await firebase.firestore()
                .collection('memories')
                .where('uid', '==', currentUser.uid)
                .get();
            memories = snapshot.docs
                .map((document) => ({ id: document.id, ...document.data() }))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            renderMemories();
        } catch (error) {
            console.error('Could not load memories:', error);
            showToast('Could not load your memories. Please try again.', true);
        }
    }

    async function signIn() {
        try {
            await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
        } catch (error) {
            console.error('Sign-in failed:', error);
            showToast('Sign-in failed. Check your Google/Firebase configuration and try again.', true);
        }
    }

    async function signOut() {
        try {
            await firebase.auth().signOut();
        } catch (error) {
            console.error('Sign-out failed:', error);
            showToast('Could not sign out. Please try again.', true);
        }
    }

    async function saveMemory(event) {
        event.preventDefault();
        if (!currentUser) {
            showToast('Sign in before saving a memory.', true);
            return;
        }

        const note = noteInput.value.trim();
        const rawLink = linkInput.value.trim();
        const link = rawLink ? parseWebUrl(rawLink) : null;

        if (!note && !rawLink) {
            showToast('Write a note or add a link first.', true);
            return;
        }
        if (rawLink && !link) {
            showToast('Enter a valid link starting with http:// or https://.', true);
            linkInput.focus();
            return;
        }

        const entries = [];
        if (note) entries.push({ type: 'note', content: note });
        if (link) entries.push({ type: 'link', content: link.href });

        saveBtn.disabled = true;
        try {
            const firestore = firebase.firestore();
            const collection = firestore.collection('memories');
            const batch = firestore.batch();
            entries.forEach((entry) => {
                batch.set(collection.doc(), {
                    uid: currentUser.uid,
                    ...entry,
                    createdAt: Date.now()
                });
            });
            await batch.commit();
            memoryForm.reset();
            await loadMemories();
            showToast(entries.length === 1 ? 'Memory saved.' : 'Memories saved.');
        } catch (error) {
            console.error('Could not save memory:', error);
            showToast('Could not save your memory. Please try again.', true);
        } finally {
            saveBtn.disabled = !currentUser;
        }
    }

    async function deleteMemory(id) {
        if (!currentUser) return;
        try {
            await firebase.firestore().collection('memories').doc(id).delete();
            memories = memories.filter((memory) => memory.id !== id);
            renderMemories();
            showToast('Memory deleted.');
        } catch (error) {
            console.error('Could not delete memory:', error);
            showToast('Could not delete that memory.', true);
        }
    }

    async function clearAllMemories() {
        if (!currentUser || memories.length === 0) return;
        const confirmed = window.confirm(`Delete all ${memories.length} saved memories? This cannot be undone.`);
        if (!confirmed) return;

        clearAllBtn.disabled = true;
        try {
            const snapshot = await firebase.firestore()
                .collection('memories')
                .where('uid', '==', currentUser.uid)
                .get();
            for (let start = 0; start < snapshot.docs.length; start += 450) {
                const batch = firebase.firestore().batch();
                snapshot.docs.slice(start, start + 450).forEach((document) => batch.delete(document.ref));
                await batch.commit();
            }
            memories = [];
            renderMemories();
            showToast('All memories cleared.');
        } catch (error) {
            console.error('Could not clear memories:', error);
            showToast('Could not clear all memories. Please try again.', true);
            await loadMemories();
        } finally {
            clearAllBtn.disabled = !currentUser;
        }
    }

    function exportMemories() {
        if (!currentUser) return;
        const data = {
            exportedAt: new Date().toISOString(),
            memories: memories.map(({ id, type, content, createdAt }) => ({ id, type, content, createdAt }))
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `vaenorix-memories-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        showToast('Your export is ready.');
    }

    function initialize() {
        memoryForm.addEventListener('submit', saveMemory);
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            renderMemories();
        });
        searchInput.addEventListener('input', renderMemories);
        loginBtn.addEventListener('click', signIn);
        logoutBtn.addEventListener('click', signOut);
        clearAllBtn.addEventListener('click', clearAllMemories);
        exportBtn.addEventListener('click', exportMemories);
        getStartedBtn.addEventListener('click', () => {
            $('save-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
            noteInput.focus({ preventScroll: true });
        });

        document.querySelectorAll('[data-filter]').forEach((button) => {
            button.addEventListener('click', () => {
                currentFilter = button.dataset.filter;
                document.querySelectorAll('[data-filter]').forEach((filterButton) => {
                    const active = filterButton === button;
                    filterButton.classList.toggle('active', active);
                    filterButton.setAttribute('aria-pressed', String(active));
                });
                renderMemories();
            });
        });

        if (!window.firebase || !firebase.apps || firebase.apps.length === 0) {
            accountStatus.textContent = 'Sign-in is unavailable right now';
            setSignedInView(null);
            showToast('Firebase did not initialize. Check the Firebase scripts and configuration.', true);
            return;
        }

        firebase.auth().onAuthStateChanged(async (user) => {
            currentUser = user;
            setSignedInView(user);
            if (user) {
                await loadMemories();
            } else {
                memories = [];
                renderMemories();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
