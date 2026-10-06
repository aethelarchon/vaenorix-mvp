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
    return str.replace(/[&<>\"]/g, function(m) {
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
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; display:flex; align-items:center; justify-content:center; cursor:zoom-out;';
    modal.innerHTML = `<img src="${imageUrl}" style="max-width:90vw; max-height:80vh; object-fit:contain; border-radius:12px; pointer-events:none;" />`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            modal.remove();
        }
    });
}

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
    apiKey: "AIzaSyB4SxkLnozpPFv7O_jGljLvNXQW-Lbnapc",
    authDomain: "veanorix.firebaseapp.com",
    projectId: "veanorix",
    storageBucket: "veanorix.firebasestorage.app",
    messagingSenderId: "935840989114",
    appId: "1:935840989114:web:607fc547721a6efdbc6783"
};

// Initialize Firebase when the page loads via main HTML
let app, db, auth, googleProvider;

// ===== STATE =====
let memories = [];
let currentUser = null;

// ===== AUTH =====
async function login() {
    try {
        const result = await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
        showToast('Logged in successfully!');
    } catch (error) {
        showToast('Login failed: ' + error.message, true);
    }
}

async function logout() {
    try {
        await firebase.auth().signOut();
        showToast('Logged out!');
    } catch (error) {
        showToast('Logout failed', true);
    }
}

// ===== CRUD =====
async function saveMemory(type, content) {
    if (!currentUser) { showToast('Please login first!', true); return; }
    try {
        await firebase.firestore().collection('memories').add({
            uid: currentUser.uid,
            type,
            content,
            createdAt: Date.now()
        });
        showToast('Saved!');
        loadMemories();
    } catch (error) {
        showToast('Save failed: ' + error.message, true);
    }
}

async function deleteMemory(id) {
    try {
        await firebase.firestore().collection('memories').doc(id).delete();
        showToast('Deleted!');
        loadMemories();
    } catch (error) {
        showToast('Delete failed', true);
    }
}

async function loadMemories() {
    if (!currentUser) return;
    try {
        const snapshot = await firebase.firestore().collection('memories')
            .where('uid', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        memories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderMemories();
    } catch (error) {
        console.error('Load error:', error);
    }
}

function renderMemories() {
    const container = document.getElementById('memories-container');
    if (!container) return;
    container.innerHTML = memories.map(m => `
        <div class="memory-card" data-type="${m.type}">
            <div class="memory-header">
                <span>${getTypeIcon(m.type)} ${capitalize(m.type)}</span>
                <span>${formatTime(m.createdAt)}</span>
            </div>
            <div class="memory-body">${escapeHtml(m.content)}</div>
            <button onclick="deleteMemory('${m.id}')" class="btn-delete">Delete</button>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
        currentUser = user;
        if (user) loadMemories();
    });

    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const saveBtn = document.getElementById('saveBtn');
    
    if (loginBtn) loginBtn.addEventListener('click', login);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (saveBtn) saveBtn.addEventListener('click', () => {
        const noteInput = document.querySelector('textarea');
        if (noteInput && noteInput.value) {
            saveMemory('note', noteInput.value);
            noteInput.value = '';
        }
    });
});
