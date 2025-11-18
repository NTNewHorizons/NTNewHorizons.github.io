// Set current year
document.getElementById('currentYear').textContent = new Date().getFullYear();

// GitHub API endpoints
const REPOS_API = 'https://api.github.com/repos/NTNewHorizons/NTNH/releases';

// DOM elements
const loadingEl = document.getElementById('loading');
const releasesContentEl = document.getElementById('releases-content');
const releaseDetailsEl = document.getElementById('release-details');
const versionLoadingEl = document.getElementById('version-loading');
const versionsListEl = document.getElementById('versions-list');

// Fetch releases from GitHub API
async function fetchReleases() {
    try {
        const response = await fetch(REPOS_API);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const releases = await response.json();
        
        // Hide loading, show content
        loadingEl.classList.add('hidden');
        releasesContentEl.classList.remove('hidden');
        
        versionLoadingEl.classList.add('hidden');
        versionsListEl.classList.remove('hidden');
        
        // Display versions in sidebar
        displayVersions(releases);
        
        // Display first release details by default
        if (releases.length > 0) {
            displayReleaseDetails(releases[0]);
        }
    } catch (error) {
        console.error('Error fetching releases:', error);
        loadingEl.innerHTML = '<p class="text-red-400">Failed to load releases. Please try again later.</p>';
    }
}

// Display versions in sidebar
function displayVersions(releases) {
    versionsListEl.innerHTML = '';
    
    releases.forEach((release, index) => {
        const versionCard = document.createElement('div');
        versionCard.className = `p-3 rounded-lg border cursor-pointer transition-all duration-300 hover:scale-105 ${
            index === 0 ? 'bg-red-900/30 border-red-500' : 'bg-gray-700/50 border-gray-600 hover:border-red-500'
        }`;
        
        versionCard.innerHTML = `
            <div class="font-semibold text-orange-400">${release.name}</div>
            <div class="text-sm text-gray-400 mt-1">${formatDate(release.published_at)}</div>
            ${release.prerelease ? '<span class="inline-block px-2 py-1 text-xs bg-yellow-900/30 text-yellow-400 rounded-full mt-2">Pre-release</span>' : ''}
            ${release.draft ? '<span class="inline-block px-2 py-1 text-xs bg-red-900/30 text-red-400 rounded-full mt-2">Draft</span>' : ''}
        `;
        
        versionCard.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('#versions-list .border').forEach(el => {
                el.classList.remove('border-red-500');
                el.classList.add('border-gray-600');
            });
            versionCard.classList.remove('border-gray-600');
            versionCard.classList.add('border-red-500');
            
            displayReleaseDetails(release);
        });
        
        versionsListEl.appendChild(versionCard);
    });
}

// Display release details
function displayReleaseDetails(release) {
    // Convert markdown description to HTML
    const descriptionHtml = marked.parse(release.body || 'No description provided.');
    
    // Format assets for display
    const assetsHtml = release.assets.map(asset => `
        <div class="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-red-500 transition-colors">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-semibold text-orange-400">${asset.name}</h4>
                    <p class="text-sm text-gray-400 mt-1">${formatFileSize(asset.size)}</p>
                </div>
                <a href="${asset.browser_download_url}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="bg-gradient-to-r from-red-600 to-orange-700 hover:from-red-700 hover:to-orange-800 text-white font-bold py-2 px-4 rounded-full text-sm inline-flex items-center transition-all duration-300 hover:scale-105">
                    <i class="fas fa-download mr-2"></i>
                    Download
                </a>
            </div>
            <div class="mt-2 text-xs text-gray-500">
                Downloaded ${asset.download_count.toLocaleString()} times
            </div>
        </div>
    `).join('');
    
    releaseDetailsEl.innerHTML = `
        <div class="mb-6">
            <h2 class="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">
                ${release.name}
            </h2>
            <div class="flex items-center text-gray-400 mb-4">
                <span class="mr-4">
                    <i class="fas fa-calendar mr-1"></i>
                    ${formatDate(release.published_at)}
                </span>
                <span>
                    <i class="fas fa-code-branch mr-1"></i>
                    ${release.tag_name}
                </span>
            </div>
            ${release.prerelease ? '<span class="inline-block px-3 py-1 text-sm bg-yellow-900/30 text-yellow-400 rounded-full mb-4">Pre-release</span>' : ''}
            ${release.draft ? '<span class="inline-block px-3 py-1 text-sm bg-red-900/30 text-red-400 rounded-full mb-4">Draft</span>' : ''}
        </div>
        
        <div class="prose prose-invert max-w-none mb-8">
            ${descriptionHtml}
        </div>
        
        <div class="mb-6">
            <h3 class="text-xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">
                <i class="fas fa-box-open mr-2"></i>Download Assets
            </h3>
            ${assetsHtml || '<p class="text-gray-400">No assets available for this release.</p>'}
        </div>
        
        <div class="flex flex-wrap gap-4">
            <a href="${release.html_url}" 
               target="_blank" 
               rel="noopener noreferrer"
               class="bg-gray-700/50 hover:bg-gray-600/50 text-white font-bold py-3 px-6 rounded-full inline-flex items-center transition-all duration-300 border border-gray-600 hover:border-red-500">
                <i class="fab fa-github mr-2"></i>
                View on GitHub
            </a>
            ${release.assets.length > 0 ? `
                <a href="${release.assets[0]?.browser_download_url}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="bg-gradient-to-r from-red-600 to-orange-700 hover:from-red-700 hover:to-orange-800 text-white font-bold py-3 px-6 rounded-full inline-flex items-center transition-all duration-300 hover:scale-105">
                    <i class="fas fa-download mr-2"></i>
                    Download Latest
                </a>
            ` : ''}
        </div>
    `;
}

// Format date
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialize the page
document.addEventListener('DOMContentLoaded', fetchReleases);