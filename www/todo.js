/* --- 1. STATE MANAGEMENT --- */
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentUser = localStorage.getItem('currentUser') || null;
let registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || {}; 

let categoryChart = null;
const notifiedTasks = new Set();
let editId = null;

// DOM Elements
const mainApp = document.getElementById('mainApp');
const authScreen = document.getElementById('authScreen');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const taskForm = document.getElementById('taskForm');
const sidebar = document.getElementById('sidebar');
const mainContent = document.querySelector('.main-content');

/* --- 2. THEME & AUTH UI --- */
function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
}

function resetAuthUI() {
    const btn = document.getElementById('authBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Sign In'; 
    }
    const recoverySec = document.getElementById('recoverySection');
    if (recoverySec) recoverySec.style.display = 'none';
    
    document.getElementById('authTitle').innerText = "Welcome Back";
    document.getElementById('toggleAuth').innerText = "Sign Up";
}

function checkAuth() {
    applyTheme(localStorage.getItem('theme') || 'light');

    if (currentUser) {
        authScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        const welcomeUser = document.getElementById('welcomeUser');
        if (welcomeUser) welcomeUser.innerText = `Hi, ${currentUser}!`;
        
        initSidebar();
        renderTasks();
        startReminderEngine();
        checkNotificationStatus(); 

        // Check for New User Tour
        const userData = registeredUsers[currentUser];
        if (userData && userData.isNew) {
            setTimeout(showWelcomeTour, 800);
        }
    } else {
        authScreen.style.display = 'flex';
        mainApp.style.display = 'none';
        resetAuthUI(); 
    }
}

/* --- 3. SMART AUTH & RECOVERY --- */
function toggleAuthMode() {
    const title = document.getElementById('authTitle');
    const btn = document.getElementById('authBtn');
    const toggleLink = document.getElementById('toggleAuth');
    const recoverySec = document.getElementById('recoverySection');

    if (title.innerText === "Welcome Back") {
        title.innerText = "Create Account";
        btn.innerText = "Sign Up";
        toggleLink.innerText = "Sign In";
        recoverySec.style.display = 'block';
    } else {
        title.innerText = "Welcome Back";
        btn.innerText = "Sign In";
        toggleLink.innerText = "Sign Up";
        recoverySec.style.display = 'none';
    }
}

document.getElementById('authForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const user = document.getElementById('authUsername').value.trim();
    const pass = document.getElementById('authPassword').value.trim();
    const secret = document.getElementById('authSecret')?.value.trim();
    const btn = document.getElementById('authBtn');
    const isSignUp = document.getElementById('authTitle').innerText === "Create Account";

    if (user.length < 3 || pass.length < 5) {
        showToast("Username (3+) and Password (5+) required", "error");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;

    setTimeout(() => {
        if (isSignUp) {
            if (registeredUsers[user]) {
                showToast("User already exists", "error");
                resetAuthUI();
                return;
            }
            if (!secret) {
                showToast("Secret word required for recovery!", "info");
                btn.disabled = false;
                btn.innerText = "Sign Up";
                return;
            }
            registeredUsers[user] = { pass: pass, secret: secret, isNew: true };
            localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
            showToast("Account created!", "success");
            performLogin(user);
        } else {
            if (registeredUsers[user] && registeredUsers[user].pass === pass) {
                performLogin(user);
            } else {
                showToast("Invalid credentials", "error");
                btn.disabled = false;
                btn.innerText = "Sign In";
            }
        }
    }, 800);
});

// NON-ALERT Forgot Password Flow
function handleForgotPassword() {
    const user = document.getElementById('authUsername').value.trim();
    if (!user || !registeredUsers[user]) {
        return showToast("Enter your username first", "info");
    }

    // Reuse the Confirm Modal UI for Recovery
    const modal = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmMessage');
    const btn = document.getElementById('confirmBtn');

    msg.innerHTML = `
        <div style="text-align:left;">
            <p>Recovery for <b>${user}</b></p>
            <input type="text" id="recoverSecretInput" placeholder="Enter Secret Word" class="modal-input" style="width:100%; padding:10px; margin:10px 0; border-radius:8px; border:1px solid var(--border-color);">
            <input type="password" id="recoverNewPassInput" placeholder="New Password" class="modal-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
        </div>
    `;
    
    btn.innerText = "Reset Password";
    modal.classList.add('active');

    btn.onclick = () => {
        const secretVal = document.getElementById('recoverSecretInput').value.trim();
        const newPassVal = document.getElementById('recoverNewPassInput').value.trim();

        if (secretVal === registeredUsers[user].secret) {
            if (newPassVal.length >= 5) {
                registeredUsers[user].pass = newPassVal;
                localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
                showToast("Password Reset! Logging in...", "success");
                modal.classList.remove('active');
                performLogin(user);
            } else {
                showToast("Password too short (min 5)", "error");
            }
        } else {
            showToast("Incorrect Secret Word", "error");
        }
    };
}

function performLogin(user) {
    currentUser = user;
    localStorage.setItem('currentUser', user);
    checkAuth();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    notifiedTasks.clear();
    checkAuth();
}

/* --- 4. SIDEBAR & INTERFACE --- */
function initSidebar() {
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn && sidebar) {
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        };
    }
}

document.getElementById('themeToggle')?.addEventListener('click', () => {
    const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
});

/* --- 5. NOTIFICATIONS --- */
function checkNotificationStatus() {
    const btn = document.getElementById('alertBtn');
    if (btn && Notification.permission === "granted") {
        btn.classList.add('active-alerts');
        btn.innerHTML = '<i class="fas fa-bell"></i> <span>Alerts Active</span>';
    }
}

function requestNotificationPermission() {
    if (!("Notification" in window)) return showToast("Not supported", "error");
    Notification.requestPermission().then(p => {
        if (p === "granted") {
            showToast("Notifications enabled!", "success");
            checkNotificationStatus();
        }
    });
}

function startReminderEngine() {
    // Clear existing intervals to prevent duplicates
    if (window.reminderInterval) clearInterval(window.reminderInterval);
    
    window.reminderInterval = setInterval(() => {
        const now = new Date();
        tasks.filter(t => t.user === currentUser && !t.completed && t.date).forEach(task => {
            const dueDate = new Date(task.date);
            const diff = dueDate - now;
            // Notify if due within the next hour (3600000 ms)
            if (diff > 0 && diff < 3600000 && !notifiedTasks.has(task.id)) {
                if (Notification.permission === "granted") {
                    new Notification("Task Master Pro", { body: `Due soon: ${task.title}` });
                }
                showToast(`Reminder: ${task.title}`, "info");
                notifiedTasks.add(task.id);
            }
        });
    }, 60000);
}

/* --- 6. TASK OPERATIONS --- */
function saveAndRender() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderTasks();
}

function openModal(id = null) {
    const modal = document.getElementById('taskModal');
    modal.classList.add('active');
    if (id) {
        const t = tasks.find(x => x.id === id);
        document.getElementById('modalTitle').innerText = "Edit Task";
        document.getElementById('taskTitle').value = t.title;
        document.getElementById('taskDesc').value = t.desc || '';
        document.getElementById('taskPriority').value = t.priority;
        document.getElementById('taskCategory').value = t.category;
        document.getElementById('taskDate').value = t.date;
        editId = id;
    } else {
        document.getElementById('modalTitle').innerText = "New Task";
        document.getElementById('taskForm').reset();
        editId = null;
    }
}

function closeModal() { document.getElementById('taskModal').classList.remove('active'); }
function closeConfirmModal() { document.getElementById('confirmModal').classList.remove('active'); }

document.getElementById('taskForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const taskData = {
        id: editId || Date.now(),
        user: currentUser,
        title: document.getElementById('taskTitle').value,
        desc: document.getElementById('taskDesc').value,
        priority: document.getElementById('taskPriority').value,
        category: document.getElementById('taskCategory').value,
        date: document.getElementById('taskDate').value,
        completed: false
    };

    if (editId) {
        tasks = tasks.map(t => t.id === editId ? { ...taskData, completed: t.completed } : t);
    } else {
        tasks.push(taskData);
    }
    saveAndRender();
    closeModal();
    showToast(editId ? "Task updated" : "Task added", "success");
});

function toggleTask(id) {
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    const task = tasks.find(t => t.id === id);
    if (task.completed && typeof confetti === 'function') {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
    saveAndRender();
}

function deleteTask(id) {
    const modal = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmMessage');
    const btn = document.getElementById('confirmBtn');

    msg.innerText = "Delete this task permanently?";
    btn.innerText = "Delete";
    btn.className = "btn-danger";
    modal.classList.add('active');

    btn.onclick = () => {
        tasks = tasks.filter(t => t.id !== id);
        saveAndRender();
        modal.classList.remove('active');
        showToast("Task removed", "info");
    };
}

function promptClearTasks() {
    const doneCount = tasks.filter(t => t.user === currentUser && t.completed).length;
    if (doneCount === 0) return showToast("No completed tasks to clear", "info");

    const modal = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmMessage');
    const btn = document.getElementById('confirmBtn');

    msg.innerText = `Clear all ${doneCount} completed tasks?`;
    btn.innerText = "Clear Done";
    btn.className = "btn-danger";
    modal.classList.add('active');

    btn.onclick = () => {
        tasks = tasks.filter(t => t.user !== currentUser || !t.completed);
        saveAndRender();
        modal.classList.remove('active');
        showToast("History cleared", "success");
    };
}

/* --- 7. RENDERING & ANALYTICS --- */
function filterTasks(type, el) {
    document.querySelectorAll('.tab, .nav-item').forEach(x => x.classList.remove('active'));
    if (el) el.classList.add('active');
    renderTasks(type);
}

function renderTasks(filter = 'all') {
    let f = tasks.filter(t => t.user === currentUser);
    
    if (['High', 'Medium', 'Low'].includes(filter)) f = f.filter(t => t.priority === filter);
    else if (filter !== 'all') f = f.filter(t => t.category === filter);
    
    const search = document.getElementById('taskSearch')?.value.toLowerCase() || "";
    f = f.filter(t => t.title.toLowerCase().includes(search));

    taskList.innerHTML = '';
    emptyState.style.display = f.length === 0 ? 'block' : 'none';

    f.forEach(t => {
        const card = document.createElement('div');
        card.className = `task-item-card ${t.completed ? 'completed-style' : ''}`;
        card.innerHTML = `
            <div class="task-card-left">
                <input type="checkbox" class="task-check" ${t.completed ? 'checked' : ''} onchange="toggleTask(${t.id})">
                <div class="task-details">
                    <h3>${t.title}</h3>
                    <div class="task-meta">
                        <span class="tag tag-${t.category.toLowerCase()}">${t.category}</span>
                        <span class="priority-chip ${t.priority.toLowerCase()}">${t.priority}</span>
                    </div>
                </div>
            </div>
            <div class="task-card-right">
                <button class="icon-btn" onclick="openModal(${t.id})"><i class="fas fa-edit"></i></button>
                <button class="icon-btn" onclick="deleteTask(${t.id})" style="color:#ef4444"><i class="fas fa-trash"></i></button>
            </div>`;
        taskList.appendChild(card);
    });
    updateAnalytics();
}

function updateAnalytics() {
    const userTasks = tasks.filter(t => t.user === currentUser);
    const total = userTasks.length;
    const completed = userTasks.filter(t => t.completed).length;
    const high = userTasks.filter(t => t.priority === 'High' && !t.completed).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = total;
    if (document.getElementById('stat-completed')) document.getElementById('stat-completed').innerText = completed;
    if (document.getElementById('stat-high')) document.getElementById('stat-high').innerText = high;

    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.innerText = `${percent}%`;
    
    updateCharts(userTasks);
}

function updateCharts(userTasks) {
    const ctxEl = document.getElementById('categoryChart');
    if (ctxEl && typeof Chart !== 'undefined') {
        const ctx = ctxEl.getContext('2d');
        const categories = ['Work', 'Personal', 'Shopping', 'School'];
        const data = categories.map(cat => userTasks.filter(t => t.category === cat).length);

        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{ 
                    data: data, 
                    backgroundColor: ['#14b8a6', '#6366f1', '#f59e0b', '#9b59b6'],
                    borderWidth: 0
                }]
            },
            options: { 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } } 
            }
        });
    }
}

/* --- 8. TOUR & KEYBOARD --- */
function showWelcomeTour() {
    const tour = document.getElementById('tourOverlay');
    if (tour) tour.classList.add('active');
}

function closeTour() {
    document.getElementById('tourOverlay').classList.remove('active');
    if (registeredUsers[currentUser]) {
        registeredUsers[currentUser].isNew = false;
        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
    }
    showToast("You're all set!", "success");
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
}

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key.toLowerCase() === 'n') { e.preventDefault(); openModal(); }
    if (e.key === 'Escape') { closeModal(); closeConfirmModal(); }
});

/* --- 9. UTILITIES --- */
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-info-circle"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.remove(), 500); 
    }, 3000);
}

window.onload = checkAuth;

/* --- 4. SIDEBAR & INTERFACE (FIXED) --- */
function initSidebar() {
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    
    if (menuBtn && sidebar) {
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            // On Mobile, we use 'active' to slide in. 
            // On Desktop, we can use 'collapsed' to hide.
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('active');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        };
    }
}

// Close sidebar when clicking main content on mobile
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768 && 
        sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) && 
        e.target.id !== 'menuBtn') {
        sidebar.classList.remove('active');
    }
});

/* --- 5. NOTIFICATIONS (FIXED) --- */
// Add the listener for the Alert Button explicitly
document.getElementById('alertBtn')?.addEventListener('click', () => {
    requestNotificationPermission();
});

function checkNotificationStatus() {
    const btn = document.getElementById('alertBtn');
    if (btn && Notification.permission === "granted") {
        btn.classList.add('active-alerts');
        btn.style.color = "var(--primary)";
        btn.innerHTML = '<i class="fas fa-bell"></i> <span>Alerts Active</span>';
    }
}

function requestNotificationPermission() {
    if (!("Notification" in window)) {
        showToast("Browser does not support notifications", "error");
        return;
    }
    
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            showToast("Notifications enabled!", "success");
            checkNotificationStatus();
        } else {
            showToast("Notifications blocked by user", "info");
        }
    });
}

function initSidebar() {
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    
    if (menuBtn && sidebar) {
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            
            if (window.innerWidth <= 768) {
                // Mobile behavior: Slide in/out
                sidebar.classList.toggle('active');
            } else {
                // Desktop behavior: Shrink to icons only
                sidebar.classList.toggle('collapsed');
            }
        };
    }
}

function logout() {
    const modal = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmMessage');
    const btn = document.getElementById('confirmBtn');

    // Set modal content for Logout
    msg.innerText = "Are you sure you want to log out of your session?";
    btn.innerText = "Logout";
    btn.className = "btn-danger"; // Keeps the red "danger" styling
    
    modal.classList.add('active');

    // Override the button click to handle logout
    btn.onclick = () => {
        currentUser = null;
        localStorage.removeItem('currentUser');
        notifiedTasks.clear();
        
        // Remove active class and refresh UI
        modal.classList.remove('active');
        checkAuth(); 
        showToast("Logged out successfully", "info");
    };
}