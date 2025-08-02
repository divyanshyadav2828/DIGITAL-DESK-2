document.addEventListener('DOMContentLoaded', () => {
    // --- UI ELEMENT SELECTORS ---
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    const navClose = document.getElementById('nav-close');
    const themeBtn = document.getElementById('theme-btn');
    const searchBtn = document.getElementById('search-btn');
    const searchContainer = document.getElementById('search');
    const searchInput = document.getElementById('search-input-field');
    const loginBtn = document.getElementById('login-btn');
    const loginContainer = document.getElementById('login');
    const loginClose = document.getElementById('login-close');
    const loginForm = document.getElementById('login-form-popup');
    const newsGrid = document.getElementById('news-grid');

    // --- MOBILE MENU ---
    if (navToggle) {
        navToggle.addEventListener('click', () => navMenu.classList.add('show-menu'));
    }
    if (navClose) {
        navClose.addEventListener('click', () => navMenu.classList.remove('show-menu'));
    }

    // --- DROPDOWN (for mobile) ---
    document.querySelectorAll('.dropdown__link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024) {
                e.preventDefault();
                const dropdown = e.target.closest('.dropdown');
                dropdown.classList.toggle('show-dropdown');
            }
        });
    });

    // --- THEME TOGGLE ---
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            themeBtn.classList.toggle('ri-sun-line');
            themeBtn.classList.toggle('ri-moon-line');
        });
    }

    // --- SEARCH BAR TOGGLE ---
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            searchContainer.classList.toggle('show-search');
            if (searchContainer.classList.contains('show-search')) {
                searchInput.focus();
            }
        });
    }

    // --- LOGIN MODAL ---
    if (loginBtn) {
        loginBtn.addEventListener('click', () => loginContainer.classList.add('show-login'));
    }
    if (loginClose) {
        loginClose.addEventListener('click', () => loginContainer.classList.remove('show-login'));
    }

    // --- LOGIN FORM SUBMISSION ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorMessage = document.getElementById('error-message');
            
            try {
                const res = await fetch('/api/login/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: email, password })
                });

                const data = await res.json();

                if (res.ok) {
                    errorMessage.style.display = 'none';
                    window.location.href = data.redirectTo || '/';
                } else {
                    errorMessage.textContent = data.message || 'An unknown error occurred.';
                    errorMessage.style.display = 'block';
                }
            } catch (err) {
                errorMessage.textContent = 'Failed to connect to the server.';
                errorMessage.style.display = 'block';
            }
        });
    }

    // --- CLIENT-SIDE SEARCH FILTER ---
    if (searchInput && newsGrid) {
        searchInput.addEventListener('keyup', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const newsCards = newsGrid.querySelectorAll('.news-card');
            
            newsCards.forEach(card => {
                const cardText = card.textContent.toLowerCase();
                if (cardText.includes(searchTerm)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
});