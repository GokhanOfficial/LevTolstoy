/**
 * Client-Side Router
 * Handles smooth page transitions
 */

const Router = {
    routes: {},
    currentPath: window.location.pathname,

    init(routes) {
        this.routes = routes;

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            this.loadPage(window.location.pathname, false);
        });

        // Intercept links
        document.body.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && link.host === window.location.host && !link.hasAttribute('download') && !link.target) {
                e.preventDefault();
                const path = link.getAttribute('href');
                this.navigate(path);
            }
        });

        // Load initial page
        this.handleRoute(this.currentPath);
    },

    navigate(path) {
        if (path === this.currentPath) return;
        window.history.pushState(null, '', path);
        this.loadPage(path);
    },

    async loadPage(path, pushState = true) {
        this.currentPath = path;

        // Show loading state if needed
        // document.body.style.cursor = 'wait';

        try {
            // Fetch the HTML of the new page
            const response = await fetch(path);
            const html = await response.text();

            // Parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Swap Main Content
            const newMain = doc.querySelector('main');
            const currentMain = document.querySelector('main');

            // Fade out
            currentMain.style.transition = 'opacity 0.2s ease';
            currentMain.style.opacity = '0';

            setTimeout(() => {
                if (newMain && currentMain) {
                    currentMain.innerHTML = newMain.innerHTML;

                    // Update Title
                    document.title = doc.title;

                    // Update Active Nav Link
                    this.updateActiveNav(path);

                    // Re-run page scripts
                    this.handleRoute(path);

                    // Fade in
                    currentMain.style.opacity = '1';
                }
                // document.body.style.cursor = 'default';
            }, 200); // Wait for transition

        } catch (error) {
            console.error('Navigation error:', error);
            window.location.reload(); // Fallback
        }
    },

    handleRoute(path) {
        // Find matching route
        let matchedKey = Object.keys(this.routes).find(key => {
            if (key === '/') return path === '/';
            return path.startsWith(key);
        });

        if (!matchedKey && path === '/') matchedKey = '/';

        // Unmount previous if exists (implied by design for now)

        // Mount new
        if (matchedKey && this.routes[matchedKey]) {
            console.log('Mounting page:', matchedKey);
            this.routes[matchedKey].mount();
        }
    },

    updateActiveNav(path) {
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('href') === path) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
};

window.Router = Router;
