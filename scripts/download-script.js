// Set current year in footer
document.getElementById('currentYear').textContent = new Date().getFullYear();

// Configure marked.js to preserve line breaks
marked.setOptions({
    breaks: true, // Convert line breaks to <br> tags
    gfm: true,    // Enable GitHub Flavored Markdown
    pedantic: false,
    smartLists: true,
    smartypants: true
});

// Helper function to format bytes into human-readable units
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Create release card HTML
function createReleaseCard(release) {
    const descriptionHTML = release.body ? marked.parse(release.body) : '<p class="text-gray-400">No description provided.</p>';
    
    const publishDate = new Date(release.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const isPreRelease = release.prerelease;
    const tagTypeClass = isPreRelease ? 'bg-purple-900/30 text-purple-400 border-purple-500/20' : 'bg-green-900/30 text-green-400 border-green-500/20';
    const tagText = isPreRelease ? 'Pre-release' : 'Stable';
    
    const assetsHTML = release.assets && release.assets.length > 0 
        ? release.assets.map(asset => `
            <a href="${asset.browser_download_url}" target="_blank" rel="noopener noreferrer"
               class="block p-3 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-orange-500 transition-colors break-words">
                <div class="flex items-center">
                    <i class="fas fa-file-download text-orange-400 mr-2 flex-shrink-0"></i>
                    <span class="text-sm truncate">${asset.name}</span>
                </div>
                <p class="text-xs text-gray-400 mt-1">${formatBytes(asset.size)}</p>
            </a>
        `).join('')
        : '<p class="text-gray-400 text-sm">No assets attached to this release.</p>';
    
    const sourceCodeHTML = `
        ${release.zipball_url ? `<a href="${release.zipball_url}" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-md transition-colors text-sm">
            <i class="fas fa-file-archive mr-2"></i> Source Code (Zip)
        </a>` : ''}
        ${release.tarball_url ? `<a href="${release.tarball_url}" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-md transition-colors text-sm">
            <i class="fas fa-file-archive mr-2"></i> Source Code (Tar.gz)
        </a>` : ''}
    `;

    const releaseCard = document.createElement('div');
    releaseCard.className = 'card-hover bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-red-500/50 transition-all duration-300 shadow-lg shadow-red-500/5';
    releaseCard.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h3 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">${release.name}</h3>
            <div class="flex gap-2">
                <span class="px-3 py-1 ${tagTypeClass} rounded-full border text-sm">
                    ${tagText}
                </span>
                ${release.draft ? `<span class="px-3 py-1 bg-gray-700/30 text-gray-300 rounded-full border border-gray-500/20 text-sm">Draft</span>` : ''}
            </div>
        </div>
        <p class="text-sm text-gray-400 mb-4">Published on ${publishDate}</p>
        <div class="markdown-content max-w-none mb-6">
            ${descriptionHTML}
        </div>
        <div class="mb-4">
            <h4 class="text-lg font-semibold mb-2 text-gray-200">Assets:</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${assetsHTML}
            </div>
        </div>
        <div class="flex flex-wrap gap-3">
             <a href="${release.html_url}" target="_blank" rel="noopener noreferrer"
                class="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-sm">
                <i class="fas fa-external-link-alt mr-2"></i> View on GitHub
            </a>
             ${sourceCodeHTML}
        </div>
    `;
    return releaseCard;
}

// Setup Intersection Observer for scroll animations
function setupScrollObserver() {
    if ('IntersectionObserver' in window) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -75px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.card-hover:not(.visible)').forEach(element => {
            observer.observe(element);
        });
    }
}

// Fetch releases from GitHub API
async function fetchReleases() {
    const releasesContainer = document.getElementById('releases-container');
    const loadingElement = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');

    try {
        // Show loading state
        loadingElement.classList.remove('hidden');
        errorMessage.classList.add('hidden');

        // Fetch releases
        const response = await fetch('https://api.github.com/repos/NTNewHorizons/NTNH/releases');
        if (!response.ok) {
            throw new Error(`GitHub API request failed with status ${response.status}`);
        }
        const releases = await response.json();

        // Clear container and hide loading
        releasesContainer.innerHTML = '';
        loadingElement.classList.add('hidden');

        if (releases.length === 0) {
            releasesContainer.innerHTML = '<p class="text-center text-gray-400 py-10">No releases found.</p>';
            return;
        }

        // Process and display releases
        releases.forEach(release => {
            releasesContainer.appendChild(createReleaseCard(release));
        });

        // Setup scroll animation for newly added cards
        setupScrollObserver();

    } catch (error) {
        console.error('Error fetching releases:', error);
        // Hide loading and show error message
        loadingElement.classList.add('hidden');
        errorMessage.classList.remove('hidden');
    }
}

// Initial fetch when the page loads
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases();
});
