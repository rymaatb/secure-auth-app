const SUPABASE_URL = 'https://zbigvywldyayocsigijb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiaWd2eXdsZHlheW9jc2lnaWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MzkxMjcsImV4cCI6MjA3OTQxNTEyN30.LNToUNRPDxiCo31fvgGdulZ6Faf9BME8bBhpSuvmUa0';

const LOCKOUT_STAGES = [5, 10, 15, 20];
const ATTEMPTS_PER_STAGE = 3;

let currentUser = null;
let lockoutTimer = null;

function generateSalt() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

function hashPassword(password, salt) {
    return CryptoJS.SHA256(salt + password).toString();
}

function validateUsername(username) {
    return /^[a-z]{5}$/.test(username);
}

function validatePassword(password) {
    if (password.length !== 8) {
        return { valid: false, message: "Password must be exactly 8 characters" };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: "Must contain at least 1 lowercase letter" };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: "Must contain at least 1 uppercase letter" };
    }
    if (!/\d/.test(password)) {
        return { valid: false, message: "Must contain at least 1 digit" };
    }
    return { valid: true };
}

function showAlert(message, type) {
    const iconMap = {
        error: 'fa-exclamation-circle',
        warning: 'fa-clock',
        success: 'fa-check-circle'
    };
    
    return `
        <div class="alert alert-${type}">
            <i class="fas ${iconMap[type]}"></i>
            <span>${message}</span>
        </div>
    `;
}

async function supabaseRequest(endpoint, method, body = null) {
    const options = {
        method,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
    return response.json();
}

async function getUser(username) {
    const data = await supabaseRequest(`users?username=eq.${username}`, 'GET');
    return data.length > 0 ? data[0] : null;
}

async function createUser(username, password) {
    const salt = generateSalt();
    const hash = hashPassword(password, salt);
    
    const userData = {
        username,
        salt,
        hash,
        lockout_stage: 0,
        failed_attempts: 0,
        banned: false
    };
    
    await supabaseRequest('users', 'POST', userData);
    return userData;
}

async function updateUser(username, updates) {
    await supabaseRequest(`users?username=eq.${username}`, 'PATCH', updates);
}

function checkLockout(user) {
    const lockoutKey = `lockout_${user.username}`;
    const lockoutUntil = localStorage.getItem(lockoutKey);
    
    if (lockoutUntil) {
        const remaining = Math.floor((parseInt(lockoutUntil) - Date.now()) / 1000);
        if (remaining > 0) {
            return { locked: true, remaining };
        } else {
            localStorage.removeItem(lockoutKey);
        }
    }
    
    return { locked: false, remaining: 0 };
}

function setLockout(username, duration) {
    const lockoutKey = `lockout_${username}`;
    const lockoutUntil = Date.now() + (duration * 1000);
    localStorage.setItem(lockoutKey, lockoutUntil.toString());
}

function renderSignup() {
    document.getElementById('app').innerHTML = `
        <div class="auth-box">
            <div class="logo">
                <div class="logo-icon">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <h1>Create Account</h1>
                <p>Join the secure platform</p>
            </div>
            
            <div id="alert-container"></div>
            
            <form id="signup-form">
                <div class="form-group">
                    <label class="form-label">Username</label>
                    <div class="input-wrapper">
                        <i class="fas fa-user input-icon"></i>
                        <input type="text" 
                               class="form-input" 
                               id="signup-username"
                               placeholder="5 lowercase letters" 
                               maxlength="5"
                               required 
                               autocomplete="off">
                    </div>
                    <div class="hint">Must be exactly 5 lowercase letters (a-z)</div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <div class="input-wrapper">
                        <i class="fas fa-lock input-icon"></i>
                        <input type="password" 
                               class="form-input" 
                               id="signup-password"
                               placeholder="8 characters" 
                               maxlength="8"
                               required>
                    </div>
                    <div class="hint">
                        8 characters: 1 uppercase, 1 lowercase, 1 digit
                    </div>
                </div>
                
                <button type="submit" class="btn">
                    <i class="fas fa-user-plus"></i> Create Account
                </button>
            </form>
            
            <div class="divider">
                Already have an account? <span class="link" onclick="renderSignin()">Sign In</span>
            </div>
        </div>
    `;
    
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
}

function renderSignin() {
    document.getElementById('app').innerHTML = `
        <div class="auth-box">
            <div class="logo">
                <div class="logo-icon">
                    <i class="fas fa-lock"></i>
                </div>
                <h1>Welcome Back</h1>
                <p>Sign in to continue</p>
            </div>
            
            <div id="alert-container"></div>
            
            <form id="signin-form">
                <div class="form-group">
                    <label class="form-label">Username</label>
                    <div class="input-wrapper">
                        <i class="fas fa-user input-icon"></i>
                        <input type="text" 
                               class="form-input" 
                               id="signin-username"
                               placeholder="Enter username" 
                               maxlength="5"
                               required 
                               autocomplete="off">
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <div class="input-wrapper">
                        <i class="fas fa-lock input-icon"></i>
                        <input type="password" 
                               class="form-input" 
                               id="signin-password"
                               placeholder="Enter password" 
                               maxlength="8"
                               required>
                    </div>
                </div>
                
                <button type="submit" class="btn" id="signin-btn">
                    <i class="fas fa-sign-in-alt"></i> Sign In
                </button>
            </form>
            
            <div class="divider">
                Don't have an account? <span class="link" onclick="renderSignup()">Sign Up</span>
            </div>
        </div>
    `;
    
    document.getElementById('signin-form').addEventListener('submit', handleSignin);
}

function renderDashboard() {
    document.getElementById('app').innerHTML = `
        <div class="auth-box" style="max-width: 500px;">
            <div class="logo">
                <div class="user-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <h1 style="font-size: 32px; margin-bottom: 10px;">Hello, ${currentUser}</h1>
                <p>You're successfully logged in</p>
            </div>
            
            <div style="margin: 40px 0;">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-check-circle" style="color: #22c55e;"></i>
                    </div>
                    <div class="stat-value" style="color: #22c55e;">Active</div>
                    <div class="stat-label">Account Status</div>
                </div>
            </div>
            
            <button class="btn btn-logout" onclick="handleLogout()">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        </div>
    `;
}

async function handleSignup(e) {
    e.preventDefault();
    
    const username = document.getElementById('signup-username').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;
    const alertContainer = document.getElementById('alert-container');
    
    if (!validateUsername(username)) {
        alertContainer.innerHTML = showAlert('Username must be exactly 5 lowercase letters', 'error');
        return;
    }
    
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
        alertContainer.innerHTML = showAlert(passwordCheck.message, 'error');
        return;
    }
    
    const existingUser = await getUser(username);
    if (existingUser) {
        alertContainer.innerHTML = showAlert('Username already exists', 'error');
        return;
    }
    
    await createUser(username, password);
    currentUser = username;
    localStorage.setItem('currentUser', username);
    renderDashboard();
}

async function handleSignin(e) {
    e.preventDefault();
    
    const username = document.getElementById('signin-username').value.trim().toLowerCase();
    const password = document.getElementById('signin-password').value;
    const alertContainer = document.getElementById('alert-container');
    const submitBtn = document.getElementById('signin-btn');
    const usernameInput = document.getElementById('signin-username');
    const passwordInput = document.getElementById('signin-password');
    
    const user = await getUser(username);
    
    if (!user) {
        alertContainer.innerHTML = showAlert('Invalid credentials', 'error');
        return;
    }
    
    if (user.banned) {
        alertContainer.innerHTML = showAlert('Account permanently banned', 'error');
        return;
    }
    
    const lockoutStatus = checkLockout(user);
    if (lockoutStatus.locked) {
        alertContainer.innerHTML = showAlert(
            `Account locked for <span class="countdown">${lockoutStatus.remaining}</span> seconds`,
            'warning'
        );
        
        submitBtn.disabled = true;
        usernameInput.disabled = true;
        passwordInput.disabled = true;
        
        startCountdown(lockoutStatus.remaining, () => {
            submitBtn.disabled = false;
            usernameInput.disabled = false;
            passwordInput.disabled = false;
            alertContainer.innerHTML = '';
        });
        return;
    }
    
    const computedHash = hashPassword(password, user.salt);
    
    if (computedHash === user.hash) {
        await updateUser(username, {
            failed_attempts: 0,
            lockout_stage: 0
        });
        
        currentUser = username;
        localStorage.setItem('currentUser', username);
        renderDashboard();
    } else {
        const newFailedAttempts = user.failed_attempts + 1;
        const currentStage = Math.floor(newFailedAttempts / ATTEMPTS_PER_STAGE);
        
        if (currentStage >= LOCKOUT_STAGES.length) {
            await updateUser(username, { banned: true });
            alertContainer.innerHTML = showAlert('Too many failed attempts. Account permanently banned', 'error');
            return;
        }
        
        const attemptsInStage = newFailedAttempts % ATTEMPTS_PER_STAGE;
        
        if (attemptsInStage === 0) {
            const lockoutDuration = LOCKOUT_STAGES[currentStage - 1];
            setLockout(username, lockoutDuration);
            
            await updateUser(username, {
                failed_attempts: newFailedAttempts,
                lockout_stage: currentStage
            });
            
            alertContainer.innerHTML = showAlert(
                `Account locked for <span class="countdown">${lockoutDuration}</span> seconds`,
                'warning'
            );
            
            submitBtn.disabled = true;
            usernameInput.disabled = true;
            passwordInput.disabled = true;
            
            startCountdown(lockoutDuration, () => {
                submitBtn.disabled = false;
                usernameInput.disabled = false;
                passwordInput.disabled = false;
                alertContainer.innerHTML = '';
            });
        } else {
            const remainingInStage = ATTEMPTS_PER_STAGE - attemptsInStage;
            await updateUser(username, { failed_attempts: newFailedAttempts });
            alertContainer.innerHTML = showAlert(`Invalid credentials. ${remainingInStage} attempt(s) remaining`, 'error');
        }
    }
}

function startCountdown(seconds, callback) {
    let remaining = seconds;
    const countdownEl = document.querySelector('.countdown');
    
    if (lockoutTimer) {
        clearInterval(lockoutTimer);
    }
    
    lockoutTimer = setInterval(() => {
        remaining--;
        if (countdownEl) {
            countdownEl.textContent = remaining;
        }
        
        if (remaining <= 0) {
            clearInterval(lockoutTimer);
            lockoutTimer = null;
            if (callback) callback();
        }
    }, 1000);
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    renderSignin();
}

function init() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        renderDashboard();
    } else {
        renderSignin();
    }
}

init();