/**
 * Theme Management
 */

const ThemeManager = {
    init() {
        // Load saved theme
        const savedTheme = localStorage.getItem('doc2md-theme');
        if (savedTheme === 'light') {
            document.documentElement.classList.add('light');
        } else {
            document.documentElement.classList.remove('light');
        }
        this.updateIcons();

        // Listen for toggle button (using event delegation for SPA support)
        // Ensure we don't add duplicate listeners
        if (!this.initialized) {
            document.addEventListener('click', (e) => {
                const toggleBtn = e.target.closest('#theme-toggle');
                if (toggleBtn) {
                    this.toggle();
                }
            });
            this.initialized = true;
        }
    },

    toggle() {
        document.documentElement.classList.toggle('light');
        const isLight = document.documentElement.classList.contains('light');

        localStorage.setItem('doc2md-theme', isLight ? 'light' : 'dark');
        this.updateIcons();
    },

    updateIcons() {
        const isLight = document.documentElement.classList.contains('light');
        document.querySelectorAll('.sun-icon').forEach(el => el.classList.toggle('hidden', !isLight));
        document.querySelectorAll('.moon-icon').forEach(el => el.classList.toggle('hidden', isLight));
    }
};

window.ThemeManager = ThemeManager;
