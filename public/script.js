let currentHlsInstance = null;
let searchState = { page: 1, isLoading: false, hasMore: true };
let seasonalState = { page: 1, isLoading: false, hasMore: true };
let playerInactivityTimer = null;
let profiles = [];
let activeProfileId = null;
let videoProgressUpdateTimer = null;
let currentUser = null;
let firebaseDb = null;

// Firebase configuration
const firebaseConfig = { 
  apiKey: "AIzaSyDyStzeP2mBubrrTaJtPr5Zw4BxfxyEyOA", 
  authDomain: "ashanime-web-app-3b033.firebaseapp.com", 
  projectId: "ashanime-web-app-3b033", 
  storageBucket: "ashanime-web-app-3b033.firebasestorage.app", 
  messagingSenderId: "380734891442", 
  appId: "1:380734891442:web:64340b418db0918ac830ab",
  databaseURL: "https://ashanime-web-app-3b033-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
firebaseDb = firebase.database();

// Firebase auth state observer
firebase.auth().onAuthStateChanged((user) => {
  currentUser = user;
  if (user) {
    console.log('User is signed in:', user.uid);
    // Load user data from Firebase
    loadUserData();
  } else {
    console.log('User is signed out');
  }
});

// Load user data from Firebase
async function loadUserData() {
  if (!currentUser) return;
  
  try {
    const userRef = firebaseDb.ref(`users/${currentUser.uid}`);
    userRef.on('value', (snapshot) => {
      const userData = snapshot.val() || {};
      console.log('User data loaded:', userData);
    });
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

async function fetchWithProfile(url, options = {}) {
   if (!activeProfileId) {
      console.error("No active profile selected. Cannot make request.");
      return Promise.reject(new Error("No active profile."));
   }
   const newOptions = { ...options };
   if (!newOptions.headers) {
      newOptions.headers = {};
   }
   newOptions.headers['X-Profile-ID'] = activeProfileId;
   if (newOptions.body && typeof newOptions.body === 'string' && !newOptions.headers['Content-Type']) {
      newOptions.headers['Content-Type'] = 'application/json';
   }
   return fetch(url, newOptions);
}

function navigateTo(hash) {
   window.location.hash = hash;
}

function router() {
   const hash = window.location.hash || '#home';
   const [pathPart, ...rest] = hash.substring(1).split('/');
   const [path, queryString] = pathPart.split('?');
   
   const data = { showId: rest[0], episodeToPlay: rest[1] };
   if (queryString) {
       data.params = new URLSearchParams(queryString);
   }

   // Log navigation for debugging
   console.log(`Navigating to: ${path}, showId: ${data.showId}, episodeToPlay: ${data.episodeToPlay}`);
   
   renderPageContent(path || 'home', data);
}

document.addEventListener('DOMContentLoaded', () => {
   setupThemeSelector();
   setupFirebaseAuth();
   initProfileSystem();
   setupSearchFilters();
   setupHomePage();
   setupWatchlistPage();
   setupMobileMenu();
   window.addEventListener('hashchange', router);
});

function setupFirebaseAuth() {
   // Add login/signup UI to the header
   const headerRight = document.querySelector('.header-right');
   const authContainer = document.createElement('div');
   authContainer.className = 'auth-container';
   authContainer.innerHTML = `
      <div id="auth-status-container">
         <button id="login-btn" class="auth-btn">Login</button>
         <button id="signup-btn" class="auth-btn">Sign Up</button>
         <div id="user-container" style="display: none;">
            <span id="user-email"></span>
            <button id="logout-btn" class="auth-btn">Logout</button>
         </div>
      </div>
      <div id="auth-modal" class="modal" style="display: none;">
         <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h2 id="auth-modal-title">Login</h2>
            <form id="auth-form">
               <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" required>
               </div>
               <div class="form-group">
                  <label for="password">Password</label>
                  <input type="password" id="password" required>
               </div>
               <button type="submit" id="auth-submit-btn">Login</button>
            </form>
         </div>
      </div>
   `;
   
   headerRight.insertBefore(authContainer, headerRight.firstChild);
   
   // Update UI based on auth state
   firebase.auth().onAuthStateChanged((user) => {
      const loginBtn = document.getElementById('login-btn');
      const signupBtn = document.getElementById('signup-btn');
      const userContainer = document.getElementById('user-container');
      const userEmail = document.getElementById('user-email');
      
      if (user) {
         // User is signed in
         if (loginBtn) loginBtn.style.display = 'none';
         if (signupBtn) signupBtn.style.display = 'none';
         if (userContainer) userContainer.style.display = 'flex';
         if (userEmail) userEmail.textContent = user.email;
      } else {
         // User is signed out
         if (loginBtn) loginBtn.style.display = 'inline-block';
         if (signupBtn) signupBtn.style.display = 'inline-block';
         if (userContainer) userContainer.style.display = 'none';
      }
   });
   
   // Setup event listeners
   const loginBtn = document.getElementById('login-btn');
   const signupBtn = document.getElementById('signup-btn');
   const logoutBtn = document.getElementById('logout-btn');
   const authModal = document.getElementById('auth-modal');
   const closeModal = document.querySelector('.close-modal');
   const authForm = document.getElementById('auth-form');
   const authModalTitle = document.getElementById('auth-modal-title');
   const authSubmitBtn = document.getElementById('auth-submit-btn');
   
   let authMode = 'login';
   
   loginBtn.addEventListener('click', () => {
      authMode = 'login';
      authModalTitle.textContent = 'Login';
      authSubmitBtn.textContent = 'Login';
      authModal.style.display = 'block';
   });
   
   signupBtn.addEventListener('click', () => {
      authMode = 'signup';
      authModalTitle.textContent = 'Sign Up';
      authSubmitBtn.textContent = 'Sign Up';
      authModal.style.display = 'block';
   });
   
   logoutBtn.addEventListener('click', () => {
      firebase.auth().signOut().catch(error => {
         console.error('Error signing out:', error);
      });
   });
   
   closeModal.addEventListener('click', () => {
      authModal.style.display = 'none';
   });
   
   window.addEventListener('click', (event) => {
      if (event.target === authModal) {
         authModal.style.display = 'none';
      }
   });
   
   authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      if (authMode === 'login') {
         firebase.auth().signInWithEmailAndPassword(email, password)
            .then(() => {
               authModal.style.display = 'none';
               authForm.reset();
            })
            .catch(error => {
               alert(`Login error: ${error.message}`);
            });
      } else {
         firebase.auth().createUserWithEmailAndPassword(email, password)
            .then(() => {
               authModal.style.display = 'none';
               authForm.reset();
               // Initialize user data in Firebase
               const user = firebase.auth().currentUser;
               if (user) {
                  firebaseDb.ref(`users/${user.uid}`).set({
                     email: user.email,
                     createdAt: firebase.database.ServerValue.TIMESTAMP,
                     watchedEpisodes: {}
                  });
               }
            })
            .catch(error => {
               alert(`Sign up error: ${error.message}`);
            });
      }
   });
}

function setupMobileMenu() {
   const menuToggle = document.querySelector('.menu-toggle');
   const nav = document.querySelector('nav');
   const mobileSearchBtn = document.querySelector('.mobile-search-btn');
   
   if (menuToggle && nav) {
      menuToggle.addEventListener('click', () => {
         nav.classList.toggle('active');
      });
   }
   
   if (mobileSearchBtn) {
      mobileSearchBtn.addEventListener('click', () => {
         // Navigate to search page
         window.location.hash = '#search';
         // If the menu is open, close it
         if (nav.classList.contains('active')) {
            nav.classList.remove('active');
         }
      });
   }
}

async function initProfileSystem() {
   try {
      const response = await fetch('/api/profiles');
      if (!response.ok) throw new Error('Could not load profiles.');
      profiles = await response.json();
      if (profiles.length > 0) {
         const storedId = localStorage.getItem('activeProfileId');
         const isValidId = profiles.some(p => p.id.toString() === storedId);
         activeProfileId = isValidId ? storedId : profiles[0].id.toString();
         localStorage.setItem('activeProfileId', activeProfileId);
         
         updateProfileDisplay();
         setupProfileEventListeners();
         document.getElementById('profile-area').style.display = 'flex';
         router();
      } else {
         console.error("No profiles found on the server.");
         alert("Error: No user profiles found. The application may not work correctly.");
      }
   } catch (error) {
      console.error("Failed to initialize profile system:", error);
      alert(`Critical Error: Could not load profile system. ${error.message}`);
   }
}

function updateProfileDisplay() {
    const activeProfile = profiles.find(p => p.id.toString() === activeProfileId);
    if (!activeProfile) return;

    const avatar = document.getElementById('profile-avatar');
    const dropdownAvatar = document.getElementById('dropdown-avatar');
    const dropdownUsername = document.getElementById('dropdown-username');
    
    const avatarUrl = activeProfile.picture_path ? `${activeProfile.picture_path}?t=${new Date().getTime()}` : '/profile_pics/default.png';
    avatar.src = avatarUrl;
    dropdownAvatar.src = avatarUrl;
    dropdownUsername.textContent = activeProfile.name;

    const selectorContainer = document.getElementById('profile-selector-container');
    selectorContainer.innerHTML = '';
    profiles.forEach(profile => {
        const item = document.createElement('div');
        item.className = 'dropdown-item profile-switch-item';
        if (profile.id.toString() === activeProfileId) {
            item.classList.add('active');
        }
        item.dataset.id = profile.id;
        item.innerHTML = `
            <img src="${profile.picture_path || '/profile_pics/default.png'}" class="profile-avatar-small">
            <span>${profile.name}</span>
        `;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            switchProfile(profile.id.toString());
            document.getElementById('profile-dropdown').classList.remove('active');
        });
        selectorContainer.appendChild(item);
    });
}


function setupProfileEventListeners() {
    const profileDisplay = document.getElementById('profile-display');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    if (profileDisplay) {
        profileDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
    }

    document.addEventListener('click', () => {
        if(profileDropdown) profileDropdown.classList.remove('active');
    });

    if(profileDropdown) profileDropdown.addEventListener('click', e => e.stopPropagation());

    const addProfileBtn = document.getElementById('add-profile-btn-dropdown');
    if (addProfileBtn) addProfileBtn.addEventListener('click', createProfile);
    
    const settingsDeleteBtn = document.getElementById('delete-profile-btn-settings');
    if (settingsDeleteBtn) settingsDeleteBtn.addEventListener('click', deleteProfile);
}

function switchProfile(newProfileId) {
   activeProfileId = newProfileId;
   localStorage.setItem('activeProfileId', newProfileId);
   updateProfileDisplay();
   
   const hash = window.location.hash || '#home';
   const [path] = hash.substring(1).split('/');
   if (path === 'home' || path === '') {
      document.getElementById('continue-watching').innerHTML = '';
      document.getElementById('continue-watching').parentElement.style.display = 'none';
      router();
   } else {
      window.location.reload();
   }
}

async function createProfile() {
   const name = prompt("Enter new profile name:");
   if (name && name.trim()) {
      try {
         const response = await fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim() })
         });
         if (!response.ok) throw new Error((await response.json()).error || 'Failed to create profile.');
         const newProfile = await response.json();
         await initProfileSystem();
         switchProfile(newProfile.id.toString());
      } catch (error) {
         alert(`Error: ${error.message}`);
      }
   }
}

async function deleteProfile() {
   if (profiles.length <= 1) {
      alert("Cannot delete the last profile.");
      return;
   }
   const currentProfile = profiles.find(p => p.id.toString() === activeProfileId);
   if (!currentProfile) return;
   if (confirm(`Are you sure you want to delete the profile "${currentProfile.name}"? All its data will be permanently deleted.`)) {
      try {
         const response = await fetch(`/api/profiles/${activeProfileId}`, { method: 'DELETE' });
         if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete profile.');
         localStorage.removeItem('activeProfileId');
         await initProfileSystem();
         navigateTo('#home');
      } catch (error) {
         alert(`Error: ${error.message}`);
      }
   }
}

function stopVideoPlayback() {
   if (playerInactivityTimer) {
      clearTimeout(playerInactivityTimer);
      playerInactivityTimer = null;
   }
    if (videoProgressUpdateTimer) {
        clearInterval(videoProgressUpdateTimer);
        videoProgressUpdateTimer = null;
    }
   document.body.style.cursor = 'default';
   if (currentHlsInstance) {
      currentHlsInstance.destroy();
      currentHlsInstance = null;
   }
   const playerPage = document.getElementById('player-page');
   const videoElement = playerPage.querySelector('video');
   if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
      videoElement.load();
   }
}

function renderPageContent(page, data = {}) {
   stopVideoPlayback();
   document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
   const pageElement = document.getElementById(`${page}-page`);
   if (pageElement) {
      pageElement.style.display = 'block';
      window.scrollTo(0, 0);
      if (page === 'home') {
         if (document.getElementById('seasonal-anime').innerHTML === '') {
            loadHomePage();
         } else {
            fetchAndDisplayContinueWatching();
         }
      } else if (page === 'watchlist') {
         fetchAndDisplayWatchlist();
      } else if (page === 'search') {
          if (data.params) {
              const searchInput = document.getElementById('searchInput');
              searchInput.value = data.params.get('query') || '';
              document.getElementById('typeFilter').value = data.params.get('type') || 'ALL';
              document.getElementById('seasonFilter').value = data.params.get('season') || 'ALL';
              document.getElementById('yearFilter').value = data.params.get('year') || 'ALL';
              document.getElementById('countryFilter').value = data.params.get('country') || 'ALL';
              document.getElementById('translationFilter').value = data.params.get('translation') || 'sub';
              document.getElementById('sortFilter').value = data.params.get('sortBy') || 'Recent';
              triggerSearch(false);
          }
         document.getElementById('searchInput').focus();
      } else if (page === 'player' && data.showId) {
         fetchEpisodes(data.showId, data.episodeToPlay);
      } else if (page === 'settings') {
          renderSettingsPage();
      }
   } else {
      document.getElementById('home-page').style.display = 'block';
   }
}

function setupThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    const savedTheme = localStorage.getItem('theme') || 'default';
    themeSelector.value = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSelector.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        document.documentElement.setAttribute('data-theme', selectedTheme);
        localStorage.setItem('theme', selectedTheme);
    });
}
function setupHomePage() {
   const topPopularFilter = document.getElementById('top-popular-filter');
   if (topPopularFilter) {
      topPopularFilter.addEventListener('change', (e) => {
         fetchAndDisplayTopPopular(e.target.value);
      });
   }
}
function setupWatchlistPage() {
   const importBtn = document.getElementById('importMalBtn');
   const restoreDbBtn = document.getElementById('restoreDbBtn');
   const sortSelect = document.getElementById('watchlist-sort');
   const filterButtons = document.querySelectorAll('.status-filter-btn');

   if (importBtn) {
      importBtn.addEventListener('click', handleMalImport);
   }
   if (restoreDbBtn) {
      restoreDbBtn.addEventListener('click', handleDbRestore);
   }
   if (sortSelect) {
      sortSelect.addEventListener('change', fetchAndDisplayWatchlist);
   }
   filterButtons.forEach(button => {
       button.addEventListener('click', () => {
           filterButtons.forEach(btn => btn.classList.remove('active'));
           button.classList.add('active');
           fetchAndDisplayWatchlist();
       });
   });
}
async function handleMalImport() {
   const fileInput = document.getElementById('malFile');
   const eraseToggle = document.getElementById('eraseWatchlistToggle');
   const statusDiv = document.getElementById('importStatus');
   if (!fileInput.files.length) {
      statusDiv.textContent = 'Please select a file first.';
      return;
   }
   const file = fileInput.files[0];
   statusDiv.textContent = 'Importing...';
   const reader = new FileReader();
   reader.onload = async (e) => {
      try {
         const response = await fetchWithProfile('/import/mal-xml', {
            method: 'POST',
            body: JSON.stringify({
               xml: e.target.result,
               erase: eraseToggle.checked
            })
         });
         const result = await response.json();
         if (!response.ok) {
            throw new Error(result.error || 'Failed to import watchlist.');
         }
         statusDiv.textContent = `Import complete! Imported: ${result.imported}, Skipped: ${result.skipped}.`;
         fetchAndDisplayWatchlist();
      } catch (error) {
         statusDiv.textContent = `Error: ${error.message}`;
      }
   };
   reader.onerror = () => {
      statusDiv.textContent = 'Error reading file.';
   };
   reader.readAsText(file);
}
async function handleDbRestore() {
   const fileInput = document.getElementById('restoreFile');
   const statusDiv = document.getElementById('restoreStatus');
   if (!fileInput.files.length) {
      statusDiv.textContent = 'Please select a database file to restore.';
      return;
   }
   const file = fileInput.files[0];
   if (!file.name.endsWith('.db')) {
      statusDiv.textContent = 'Invalid file type. Please select a .db file.';
      return;
   }
   const formData = new FormData();
   formData.append('dbfile', file);
   statusDiv.textContent = 'Restoring... This may take a moment.';
   try {
      const response = await fetch('/restore-db', {
         method: 'POST',
         body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
         throw new Error(result.error || 'Failed to restore database.');
      }
      statusDiv.textContent = result.message;
      alert('Database restored successfully! The page will now reload.');
      setTimeout(() => window.location.reload(), 1000);
   } catch (error) {
      statusDiv.textContent = `Error: ${error.message}`;
   }
}
async function loadHomePage() {
   setupScheduleSelector();
   await Promise.all([
      fetchAndDisplaySeasonal(),
      fetchAndDisplayTopPopular('all'),
      fetchAndDisplayEpisodeSchedule()
   ]);
   fetchAndDisplayContinueWatching();
   fetchAndDisplayLatestReleases();
}
const thumbnailCache = new Map();
function fixThumbnailUrl(url) {
   if (!url) return '/placeholder.png';
   if (thumbnailCache.has(url)) return thumbnailCache.get(url);
   const proxiedUrl = `/image-proxy?url=${encodeURIComponent(url)}`;
   thumbnailCache.set(url, proxiedUrl);
   return proxiedUrl;
}
async function fetchAndDisplaySection(endpoint, containerId, append = false) {
   const container = document.getElementById(containerId);
   try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
      const shows = await response.json();
      displayGrid(containerId, shows, (e, show) => {
         if (e.target.closest('.status-select-wrapper, .card-controls')) return;
         navigateTo(`#player/${show._id}`);
      }, item => item.name, append);
   } catch (error) {
      console.error(`Error fetching section ${containerId}:`, error);
      if (container) container.innerHTML = `<p class="error">Could not load this section.</p>`;
   }
}
const fetchAndDisplayLatestReleases = () => fetchAndDisplaySection('/latest-releases', 'latest-releases');
async function fetchAndDisplayEpisodeSchedule(date = null) {
   if (!date) {
      date = new Date().toISOString().split('T')[0];
   }
   await fetchAndDisplaySection(`/schedule/${date}`, 'episode-schedule');
}
function setupScheduleSelector() {
   const selectorContainer = document.getElementById('schedule-day-selector');
   if (!selectorContainer) return;
   selectorContainer.innerHTML = '';
   const days = [];
   const today = new Date();
   const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
   for (let i = -6; i <= 0; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      days.push(date);
   }
   days.forEach(date => {
      const button = document.createElement('button');
      button.classList.add('day-button');
      const dateString = date.toISOString().split('T')[0];
      button.dataset.date = dateString;
      let dayLabel = dayNames[date.getDay()];
      if (date.toDateString() === today.toDateString()) {
         dayLabel = 'Today';
         button.classList.add('active');
      }
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
         dayLabel = 'Yesterday';
      }
      const formattedDate = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      button.innerHTML = `<span class="day-name">${dayLabel}</span><span class="day-date">${formattedDate}</span>`;
      button.addEventListener('click', () => {
         document.querySelectorAll('.day-button').forEach(btn => btn.classList.remove('active'));
         button.classList.add('active');
         fetchAndDisplayEpisodeSchedule(dateString);
      });
      selectorContainer.appendChild(button);
   });
}

async function fetchAndDisplayTopPopular(timeframe = 'all') {
   const container = document.getElementById('top-10-popular');
   if (!container) return;
   container.innerHTML = '<div class="loading"></div>';
   try {
      const response = await fetch(`/popular/${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch popular');
      const shows = await response.json();
      container.innerHTML = '';
      shows.forEach((show, index) => {
         const item = document.createElement('div');
         item.className = 'top-10-item';
         item.setAttribute('data-raw-thumbnail', show.thumbnail || '');
         item.innerHTML = `
            <span class="rank-number">${String(index + 1).padStart(2, '0')}</span>
            <img src="${fixThumbnailUrl(show.thumbnail)}" alt="${show.name}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.src='/placeholder.png'; this.classList.add('loaded');"/>
            <div class="item-details">
               <p class="item-title">${show.name}</p>
               <div class="ep-counts">
                  ${show.availableEpisodes.sub ? `<span>SUB ${show.availableEpisodes.sub}</span>` : ''}
                  ${show.availableEpisodes.dub ? `<span>DUB ${show.availableEpisodes.dub}</span>` : ''}
               </div>
            </div>
         `;
         item.addEventListener('click', () => navigateTo(`#player/${show._id}`));
         container.appendChild(item);
      });
   } catch (error) {
      console.error('Error fetching top popular:', error);
      container.innerHTML = `<p class="error">Could not load top 10.</p>`;
   }
}

async function fetchAndDisplaySeasonal() {
   if (seasonalState.isLoading || !seasonalState.hasMore) return;
   seasonalState.isLoading = true;
   const container = document.getElementById('seasonal-anime');
   try {
      const response = await fetch(`/seasonal?page=${seasonalState.page}`);
      if (!response.ok) throw new Error(`Failed to fetch /seasonal`);
      const shows = await response.json();
      if (shows.length === 0) {
         seasonalState.hasMore = false;
         return;
      }
      if (seasonalState.page === 1) {
         const firstShowWithDesc = shows.find(s => s.description);
         if (firstShowWithDesc) {
            const desc = firstShowWithDesc.description;
            const yearMatch = desc.match(/Season: (?:Winter|Spring|Summer|Fall) (\d{4})/);
            const seasonMatch = desc.match(/Season: (Winter|Spring|Summer|Fall)/);
            if (yearMatch && seasonMatch) {
               document.getElementById('seasonal-title').textContent = `${seasonMatch[1]} ${yearMatch[1]}`;
            }
         }
      }
      displayGrid('seasonal-anime', shows, (e, show) => navigateTo(`#player/${show._id}`), item => item.name, true);
      seasonalState.page++;
   } catch (error) {
      console.error('Error fetching seasonal anime:', error);
      if (container) container.innerHTML = `<p class="error">Could not load seasonal anime.</p>`;
   } finally {
      seasonalState.isLoading = false;
   }
}

async function fetchAndDisplayContinueWatching() {
   try {
      const response = await fetchWithProfile('/continue-watching');
      if (!response.ok) throw new Error('Network response was not ok');
      const shows = await response.json();
      const container = document.getElementById('continue-watching');
      if (shows && shows.length > 0) {
         container.parentElement.style.display = 'block';
         displayGrid('continue-watching', shows, (e, show) => {
             if (e.target.classList.contains('remove-from-cw-btn')) return;
             navigateTo(`#player/${show.showId}/${show.episodeToPlay}`);
         });
      } else {
         if (container) container.parentElement.style.display = 'none';
      }
   } catch (error) {
      console.error('Error fetching continue watching:', error);
      const container = document.getElementById('continue-watching');
      if (container) container.parentElement.style.display = 'none';
   }
}

const formatTime = (timeInSeconds) => {
      if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '00:00';
      const result = new Date(timeInSeconds * 1000).toISOString().slice(11, 19);
      const hours = parseInt(result.slice(0, 2), 10);
      return hours > 0 ? result : result.slice(3);
};

function displayGrid(containerId, items, onClick, titleFn = item => item.name, append = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!append) container.innerHTML = '';

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'grid-item';
        div.setAttribute('data-raw-thumbnail', item.thumbnail || '');
        const title = typeof titleFn === 'function' ? titleFn(item) : item.name;

        let overlayContent = '';
        let infoOverlay = '';
        let progressOverlay = '';

        if (containerId === 'continue-watching') {
            overlayContent = `<button class="remove-from-cw-btn" title="Remove from Continue Watching">×</button>`;
            const isResuming = item.currentTime > 0 && item.duration > 0;
            const progressPercent = isResuming ? (item.currentTime / item.duration) * 100 : 0;

            infoOverlay = `<div class="card-info-overlay"><span class="card-ep-count">EP ${item.episodeToPlay}</span></div>`;
            if(isResuming) {
                progressOverlay = `
                    <div class="card-progress-overlay">
                        <div class="card-progress-bar" style="width: ${progressPercent}%"></div>
                        <span class="card-progress-time">${formatTime(item.currentTime)} / ${formatTime(item.duration)}</span>
                    </div>
                `;
            }
        } else {
            const subCount = item.availableEpisodesDetail?.sub?.length || 0;
            const dubCount = item.availableEpisodesDetail?.dub?.length || 0;
            const type = item.type || '';
            
            infoOverlay = `
                <div class="card-info-overlay">
                    ${type ? `<span class="card-type-tag">${type.replace(/_/g, ' ')}</span>` : ''}
                    <div class="card-ep-details">
                        ${subCount > 0 ? `<span>SUB: ${subCount}</span>` : ''}
                        ${dubCount > 0 ? `<span>DUB: ${dubCount}</span>` : ''}
                    </div>
                </div>
            `;
        }
      
        div.innerHTML = `
            <div class="img-container">
                <img src="${fixThumbnailUrl(item.thumbnail)}" alt="${item.name}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.src='/placeholder.png'; this.className='image-fallback loaded';">
                ${infoOverlay}
                ${progressOverlay}
            </div>
            <p>${title}</p>
            ${overlayContent}
        `;

        div.addEventListener('click', (e) => onClick(e, item));
      
        if (containerId === 'continue-watching') {
            const removeBtn = div.querySelector('.remove-from-cw-btn');
            removeBtn.addEventListener('click', async () => {
                try {
                    const response = await fetchWithProfile('/continue-watching/remove', {
                        method: 'POST',
                        body: JSON.stringify({ showId: item.showId })
                    });
                    if (response.ok) {
                        div.remove();
                        if (container.children.length === 0) {
                            container.parentElement.style.display = 'none';
                        }
                    } else {
                        alert('Failed to remove from continue watching.');
                    }
                } catch (error) {
                    console.error('Error removing from continue watching:', error);
                    alert('An error occurred.');
                }
            });
        }
        container.appendChild(div);
    });
}

async function fetchAndDisplayWatchlist() {
   try {
      const sortSelect = document.getElementById('watchlist-sort');
      const activeFilterBtn = document.querySelector('.status-filter-btn.active');
      const sortBy = sortSelect ? sortSelect.value : 'last_added';
      const filterBy = activeFilterBtn ? activeFilterBtn.dataset.status : 'All';

      const response = await fetchWithProfile(`/watchlist?sort=${sortBy}`);
      if (!response.ok) throw new Error('Network response was not ok.');
      let shows = await response.json();
      const container = document.getElementById('watchlist');
      container.innerHTML = '';

      if (filterBy !== 'All') {
          shows = shows.filter(show => show.status === filterBy);
      }

      if (shows.length === 0) {
         container.innerHTML = `<p>${filterBy === 'All' ? 'Your watchlist is empty.' : `No items with status "${filterBy}".`}</p>`;
         return;
      }
      shows.forEach(show => {
         const item = document.createElement('div');
         item.className = 'grid-item watchlist-item';
         
         const clickHandler = (e) => {
             if (e.target.closest('.watchlist-controls')) return;
             navigateTo(`#player/${show.id}`);
         };

         item.addEventListener('click', clickHandler);
         item.innerHTML = `
            <div class="img-container">
                <img src="${fixThumbnailUrl(show.thumbnail)}" alt="${show.name}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.src='/placeholder.png'; this.className='image-fallback loaded';">
            </div>
            <p>${show.name}</p>
            <div class="watchlist-controls">
               <select class="status-select" data-id="${show.id}">
                  <option value="Watching" ${show.status === 'Watching' ? 'selected' : ''}>Watching</option>
                  <option value="Completed" ${show.status === 'Completed' ? 'selected' : ''}>Completed</option>
                  <option value="On-Hold" ${show.status === 'On-Hold' ? 'selected' : ''}>On-Hold</option>
                  <option value="Dropped" ${show.status === 'Dropped' ? 'selected' : ''}>Dropped</option>
                  <option value="Planned" ${show.status === 'Planned' ? 'selected' : ''}>Planned</option>
               </select>
               <button class="remove-button" data-id="${show.id}">Remove</button>
            </div>
         `;
         item.querySelector('.status-select').addEventListener('change', async (e) => {
            await fetchWithProfile('/watchlist/status', {
               method: 'POST',
               body: JSON.stringify({ id: show.id, status: e.target.value })
            });
            fetchAndDisplayWatchlist();
         });
         item.querySelector('.remove-button').addEventListener('click', async () => {
            await fetchWithProfile('/watchlist/remove', {
               method: 'POST',
               body: JSON.stringify({ id: show.id })
            });
            item.remove();
         });
         container.appendChild(item);
      });
   } catch (error) {
      console.error('Error fetching watchlist:', error);
      document.getElementById('watchlist').innerHTML = '<p class="error">Could not load watchlist.</p>';
   }
}

function setupSearchFilters() {
   const searchInput = document.getElementById('searchInput');
   const typeFilter = document.getElementById('typeFilter');
   const seasonFilter = document.getElementById('seasonFilter');
   const yearFilter = document.getElementById('yearFilter');
   const countryFilter = document.getElementById('countryFilter');
   const translationFilter = document.getElementById('translationFilter');
   const sortFilter = document.getElementById('sortFilter');
   const searchBtn = document.getElementById('searchBtn');
   const seasons = ['ALL', 'Winter', 'Spring', 'Summer', 'Fall'];
   seasons.forEach(s => seasonFilter.add(new Option(s, s)));
   const currentYear = new Date().getFullYear();
   yearFilter.add(new Option('ALL', 'ALL'));
   for (let y = currentYear; y >= 1940; y--) {
      yearFilter.add(new Option(y, y));
   }
   searchBtn.addEventListener('click', () => triggerSearch(true));
   searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
         triggerSearch(true);
      }
   });
}
window.addEventListener('scroll', () => {
   if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
      if (document.getElementById('search-page').style.display === 'block' && !searchState.isLoading && searchState.hasMore) {
         performSearch(false);
      }
      if (document.getElementById('home-page').style.display === 'block' && !seasonalState.isLoading && seasonalState.hasMore) {
         fetchAndDisplaySeasonal();
      }
   }
});
	
function triggerSearch(updateUrl = true) {
   searchState = { page: 1, isLoading: false, hasMore: true };
   document.getElementById('results').innerHTML = '';
   
   if(updateUrl) {
       const params = new URLSearchParams({
           query: document.getElementById('searchInput').value,
           type: document.getElementById('typeFilter').value,
           season: document.getElementById('seasonFilter').value,
           year: document.getElementById('yearFilter').value,
           country: document.getElementById('countryFilter').value,
           translation: document.getElementById('translationFilter').value,
           sortBy: document.getElementById('sortFilter').value
       });
       navigateTo(`#search?${params.toString()}`);
   } else {
       performSearch(true);
   }
}


async function performSearch(isNewSearch) {
   if (searchState.isLoading || !searchState.hasMore) return;
   searchState.isLoading = true;
   const resultsDiv = document.getElementById('results');
   if (isNewSearch) {
      resultsDiv.innerHTML = '<div class="loading"></div>';
   }
   const query = document.getElementById('searchInput').value;
   const type = document.getElementById('typeFilter').value;
   const season = document.getElementById('seasonFilter').value;
   const year = document.getElementById('yearFilter').value;
   const country = document.getElementById('countryFilter').value;
   const translation = document.getElementById('translationFilter').value;
   const sortBy = document.getElementById('sortFilter').value;
   const page = searchState.page;
   try {
      const params = new URLSearchParams({ query, type, season, year, country, translation, sortBy, page });
      const response = await fetch(`/search?${params}`);
      if (!response.ok) throw new Error('Search failed');
      const shows = await response.json();
      if (isNewSearch) {
         resultsDiv.innerHTML = '';
      }
      if (shows.length === 0) {
         searchState.hasMore = false;
         if (isNewSearch) resultsDiv.innerHTML = '<p>No results found.</p>';
         return;
      }
      displayGrid('results', shows, (e, show) => navigateTo(`#player/${show._id}`), item => item.name, !isNewSearch);
      searchState.page++;
   } catch (error) {
      console.error('Search error:', error);
      resultsDiv.innerHTML = '<p class="error">An error occurred during search.</p>';
   } finally {
      searchState.isLoading = false;
   }
}
async function fetchEpisodes(showId, episodeToPlay = null, mode = 'sub') {
   const page = document.getElementById('player-page');
   page.innerHTML = '<div class="loading"></div>';
   try {
      const showMetaResponse = await fetch(`/show-meta/${showId}`);
      if (!showMetaResponse.ok) throw new Error(`Failed to fetch show metadata: ${showMetaResponse.statusText}`);
      const showMeta = await showMetaResponse.json();

      // Get episodes from API
      const episodesResponse = await fetch(`/episodes?showId=${encodeURIComponent(showId)}&mode=${mode}`);
      if (!episodesResponse.ok) throw new Error(`Failed to fetch episodes list: ${episodesResponse.statusText}`);
      const { episodes, description } = await episodesResponse.json();
      const sortedEpisodes = episodes.sort((a, b) => parseFloat(a) - parseFloat(b));
      
      // Get watched episodes - either from Firebase (if logged in) or from local API
      let watchedEpisodes = [];
      let lastWatchedTimestamp = 0;
      let lastWatchedEp = null;
      
      if (currentUser) {
         // Get watched episodes from Firebase
         try {
            const watchedSnapshot = await firebaseDb.ref(`users/${currentUser.uid}/watchedEpisodes/${showId}`).once('value');
            const watchedData = watchedSnapshot.val() || {};
            
            // Extract episode numbers and find the most recently watched
            watchedEpisodes = Object.keys(watchedData);
            
            // Find the most recently watched episode based on timestamp
            Object.entries(watchedData).forEach(([epNum, epData]) => {
               if (epData.timestamp && epData.timestamp > lastWatchedTimestamp) {
                  lastWatchedTimestamp = epData.timestamp;
                  lastWatchedEp = epNum;
               }
            });
            
            console.log('Firebase watched episodes:', watchedEpisodes);
            console.log('Last watched episode from Firebase:', lastWatchedEp);
         } catch (err) {
            console.error('Error fetching watched episodes from Firebase:', err);
         }
      } else {
         // Fallback to local API if not logged in
         try {
            const watchedResponse = await fetchWithProfile(`/watched-episodes/${showId}`);
            if (watchedResponse.ok) {
               watchedEpisodes = await watchedResponse.json();
               
               // For local API, we assume the highest episode number is the last watched
               if (watchedEpisodes.length > 0) {
                  const numericWatchedEpisodes = watchedEpisodes.map(ep => parseFloat(ep));
                  lastWatchedEp = Math.max(...numericWatchedEpisodes).toString();
               }
            }
         } catch (err) {
            console.error('Error fetching watched episodes from local API:', err);
         }
      }
      
      // Get watchlist status
      const watchlistResponse = await fetchWithProfile(`/watchlist/check/${showId}`);
      let inWatchlist = false;
      if (watchlistResponse.ok) {
         const watchlistData = await watchlistResponse.json();
         inWatchlist = watchlistData.inWatchlist;
      }
      
      // Determine which episode to play:
      // 1. If a specific episode is requested, play that
      // 2. If user has watched episodes, play the last watched episode
      // 3. Otherwise, play the first episode
      let epToPlay;
      if (episodeToPlay) {
         epToPlay = episodeToPlay;
      } else if (lastWatchedEp) {
         epToPlay = lastWatchedEp;
      } else {
         epToPlay = sortedEpisodes[0];
      }
      
      // Log the episode selection logic for debugging
      console.log(`Episode selection: requested=${episodeToPlay}, lastWatched=${lastWatchedEp}, selected=${epToPlay}`);
      
      // Pass the episode to play to displayEpisodes so it can mark it as active
      displayEpisodes(sortedEpisodes, showId, showMeta, mode, watchedEpisodes, description, inWatchlist, epToPlay);
      
      if (epToPlay) {
         fetchVideoLinks(showId, epToPlay, showMeta, mode);
      }
   } catch (error) {
      console.error('Error fetching episode data:', error);
      page.innerHTML = `<p class="error">Could not load episode data.</p>`;
   }
}

function createEpisodeJumpControls(episodes) {
    if (episodes.length <= 100) return '';

    let ranges = '';
    const sortedNumericEpisodes = episodes.map(Number).sort((a, b) => a - b);

    for (let i = 0; i < sortedNumericEpisodes.length; i += 100) {
        const start = sortedNumericEpisodes[i];
        const end = sortedNumericEpisodes[Math.min(i + 99, sortedNumericEpisodes.length - 1)];
        ranges += `<button class="ep-range-btn" data-start-ep="${start}">Ep ${start}-${end}</button>`;
    }

    return `
        <div class="ep-jump-controls">
            <div class="ep-range-buttons">${ranges}</div>
            <div class="ep-jump-input-group">
                <input type="number" id="ep-jump-input" placeholder="Go to Ep #" min="1">
                <button id="ep-jump-btn">Go</button>
            </div>
        </div>
    `;
}

function displayEpisodes(episodes, showId, showMeta, mode, watchedEpisodes, description, inWatchlist, currentEpisode = null) {
   const page = document.getElementById('player-page');
   const jumpControls = createEpisodeJumpControls(episodes);

   // Log the current episode for debugging
   console.log(`displayEpisodes called with currentEpisode: ${currentEpisode}`);

   page.innerHTML = `
      <div class="player-page-content">
         <div class="show-header">
            <h2>${showMeta.name}</h2>
            <div id="schedule-status-container" class="schedule-status"></div>
            <div class="header-controls">
               <button id="watchlistToggleBtn" class="watchlist-toggle-button ${inWatchlist ? 'in-list' : ''}">
                  ${inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
               </button>
               <div class="toggle-container">
                  <span>SUB</span>
                  <label class="switch">
                     <input type="checkbox" id="modeToggle" ${mode === 'dub' ? 'checked' : ''}>
                     <span class="slider"></span>
                  </label>
                  <span>DUB</span>
               </div>
            </div>
         </div>
         <div class="show-description">${description ? description.replace(/<br>/g, ' ').replace(/\[.*?\]/g, '') : 'No description available.'}</div>
         <div id="player-section-container"></div>
         ${jumpControls}
         <div id="episode-grid-player" class="episode-grid">
            ${episodes.map(ep => `
               <div class="result-item ${watchedEpisodes.includes(ep.toString()) ? 'watched' : ''} ${currentEpisode === ep.toString() ? 'active' : ''}" data-episode="${ep}">Episode ${ep}</div>
            `).join('') || `<p class="error">No ${mode.toUpperCase()} episodes found</p>`}
         </div>
      </div>
   `;

   fetch(`/schedule-info/${showId}`)
     .then(res => res.json())
     .then(data => {
        const container = document.getElementById('schedule-status-container');
        if (!container) return;

        if (data.status && data.status !== 'Not Found on Schedule' && data.status !== 'Error') {
            const statusClass = `status-${data.status.toLowerCase().replace(/ /g, '-')}`;
            let html = `<span class="status-tag ${statusClass}">${data.status}</span>`;
            
            if (data.nextEpisodeAirDate) {
                let nextEpText = '';
                if (data.nextEpisodeAirDate.includes('T') && data.nextEpisodeAirDate.includes('Z')) {
                    const airDate = new Date(data.nextEpisodeAirDate);
                    if (!isNaN(airDate)) {
                        nextEpText = `Next ep: ${airDate.toLocaleString()}`;
                    } else {
                        nextEpText = `Next ep in: ${data.nextEpisodeAirDate}`;
                    }
                } else {
                    nextEpText = `Next ep in: ${data.nextEpisodeAirDate}`;
                }
                html += `<span class="countdown-text">${nextEpText}</span>`;
            }
            container.innerHTML = html;
        }
     }).catch(err => console.error('Failed to load schedule status.'));

   page.querySelectorAll('.result-item').forEach(item => {
      item.addEventListener('click', () => {
         const episodeNumber = item.dataset.episode;
         
         // Update active class immediately for better user feedback
         document.querySelectorAll('#episode-grid-player .result-item').forEach(ep => {
            ep.classList.remove('active');
         });
         item.classList.add('active');
         
         navigateTo(`#player/${showId}/${episodeNumber}`);
      });
   });

   if (episodes.length > 100) {
       document.querySelectorAll('.ep-range-btn').forEach(btn => {
           btn.addEventListener('click', () => {
               const epNum = btn.dataset.startEp;
               const epElement = document.querySelector(`.result-item[data-episode="${epNum}"]`);
               if(epElement) epElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
           });
       });
       const jumpInput = document.getElementById('ep-jump-input');
       const jumpBtn = document.getElementById('ep-jump-btn');
       const jumpAction = () => {
           const epNum = jumpInput.value;
           if (episodes.includes(epNum)) {
               const epElement = document.querySelector(`.result-item[data-episode="${epNum}"]`);
               if(epElement) epElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
           } else {
               alert(`Episode ${epNum} not found.`);
           }
       };
       jumpBtn.addEventListener('click', jumpAction);
       jumpInput.addEventListener('keypress', (e) => {
           if (e.key === 'Enter') jumpAction();
       });
   }


   document.getElementById('modeToggle').addEventListener('change', (e) => {
      fetchEpisodes(showId, null, e.target.checked ? 'dub' : 'sub');
   });
   
   const watchlistBtn = document.getElementById('watchlistToggleBtn');
   watchlistBtn.addEventListener('click', async () => {
      const isInList = watchlistBtn.classList.contains('in-list');
      const endpoint = isInList ? '/watchlist/remove' : '/watchlist/add';
      const body = { id: showId, name: showMeta.name, thumbnail: showMeta.thumbnail };
      const response = await fetchWithProfile(endpoint, {
         method: 'POST',
         body: JSON.stringify(body)
      });
      if (response.ok) {
         watchlistBtn.classList.toggle('in-list');
         watchlistBtn.textContent = watchlistBtn.classList.contains('in-list') ? 'In Watchlist' : 'Add to Watchlist';
      }
   });
}

async function fetchVideoLinks(showId, episodeNumber, showMeta, mode = 'sub') {
   const playerPageContent = document.querySelector('.player-page-content');
   if (!playerPageContent) return;
   const oldPlayer = document.getElementById('player-section-container');
   if (oldPlayer) oldPlayer.remove();
   const playerContainer = document.createElement('div');
   playerContainer.id = 'player-section-container';
   playerContainer.innerHTML = '<div class="loading"></div>';
   playerPageContent.insertBefore(playerContainer, document.querySelector('.ep-jump-controls, #episode-grid-player'));
   
   // Update the active class for the currently playing episode
   document.querySelectorAll('#episode-grid-player .result-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.episode === episodeNumber) {
         item.classList.add('active');
      }
   });
   
   try {
      // Mark episode as watched in Firebase if user is logged in
      if (currentUser) {
         const timestamp = firebase.database.ServerValue.TIMESTAMP;
         await firebaseDb.ref(`users/${currentUser.uid}/watchedEpisodes/${showId}/${episodeNumber}`).set({
            timestamp: timestamp,
            showName: showMeta.name
         });
         
         // Update the watched class for this episode
         const episodeItem = document.querySelector(`#episode-grid-player .result-item[data-episode="${episodeNumber}"]`);
         if (episodeItem && !episodeItem.classList.contains('watched')) {
            episodeItem.classList.add('watched');
         }
      }
      
      const [sourcesResponse, settingsResponse, progressResponse] = await Promise.all([
         fetch(`/video?showId=${encodeURIComponent(showId)}&episodeNumber=${encodeURIComponent(episodeNumber)}&mode=${mode}`),
         fetchWithProfile(`/settings/preferredSource`),
         fetchWithProfile(`/episode-progress/${showId}/${episodeNumber}`)
      ]);
      if (!sourcesResponse.ok) throw new Error('Failed to fetch video sources');
      if (!settingsResponse.ok) throw new Error('Failed to fetch user settings');
      if (!progressResponse.ok) throw new Error('Failed to fetch episode progress');

      const sources = await sourcesResponse.json();
      const { value: preferredSource } = await settingsResponse.json();
      const progress = await progressResponse.json();
      displayEpisodePlayer(sources, showId, episodeNumber, showMeta, preferredSource, progress);
   } catch (error) {
      console.error('Error fetching video links:', error);
      playerContainer.innerHTML = `<p class="error">Could not load video sources.</p>`;
   }
}
function displayEpisodePlayer(sources, showId, episodeNumber, showMeta, preferredSource, progress) {
   const playerSection = document.getElementById('player-section-container');
   if (!playerSection) return;
   const playIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
   const pauseIcon = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
   const fullscreenIcon = `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
   const downloadIcon = `<svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>`;
   const exitFullscreenIcon = `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;
   const volumeHighIcon = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
   const seekForwardIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="m19.293 8-3.147-3.146a.5.5 0 1 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 1 1-.708-.708L19.293 9H5.5A1.5 1.5 0 0 0 4 10.5v6A1.5 1.5 0 0 0 5.5 18h15a.5.5 0 0 1 0 1h-15A2.5 2.5 0 0 1 3 16.5v-6A2.5 2.5 0 0 1 5.5 8z"/><text x="6.5" y="16.25" font-size="8">10</text></svg>`;
   const seekBackwardIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="m4.707 8 3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 1 0 .708-.708L4.707 9H18.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-15a.5.5 0 0 0 0 1h15a2.5 2.5 0 0 0 2.5-2.5v-6A2.5 2.5 0 0 0 18.5 8z"/><text x="8" y="16.25" font-size="8">10</text></svg>`;
   playerSection.innerHTML = `
      <div id="player-content" class="player-content">
         <video id="videoPlayer" playsinline webkit-playsinline></video>
         <div id="video-controls-container" class="video-controls-container">
            <div class="progress-bar-container">
               <div id="progress-bubble" class="slider-bubble">00:00</div>
               <div class="progress-bar">
                  <div class="progress-bar-watched"></div>
                  <div class="progress-bar-buffered"></div>
                  <div class="progress-bar-thumb"></div>
               </div>
            </div>
            <div class="bottom-controls">
               <div class="left-controls">
                  <button id="play-pause-btn" class="control-button">${playIcon}</button>
                  <div class="volume-container">
                     <button id="volume-btn" class="control-button">${volumeHighIcon}</button>
                     <div class="volume-slider-container">
                        <input type="range" id="volume-slider" min="0" max="1" step="0.01" value="1">
                        <div id="volume-bubble" class="slider-bubble">100%</div>
                     </div>
                  </div>
                  <div class="time-display">
                     <span id="current-time">00:00</span> / <span id="total-time">00:00</span>
                  </div>
               </div>
               <div class="right-controls">
                  <button id="seek-backward-btn" class="control-button seek-button">${seekBackwardIcon}</button>
                  <button id="seek-forward-btn" class="control-button seek-button">${seekForwardIcon}</button>
                  <div class="toggle-container">
                     <label for="autoSkipToggle">Auto Skip</label>
                     <label class="switch">
                        <input type="checkbox" id="autoSkipToggle">
                        <span class="slider"></span>
                     </label>
                  </div>
                  <div class="toggle-container">
                     <label for="autoplayToggle">Autoplay</label>
                     <label class="switch">
                        <input type="checkbox" id="autoplayToggle">
                        <span class="slider"></span>
                     </label>
                  </div>
                  <button id="download-btn" class="control-button" title="Download Video">${downloadIcon}</button>
                  <button id="cc-btn" class="control-button disabled"><svg viewBox="0 0 24 24"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2v-.5H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2v-.5H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg></button>
                  <button id="settings-btn" class="control-button"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.785.45c1.039 0 1.932.715 2.127 1.705l.087.44c.342 1.73 2.187 2.762 3.903 2.184l.436-.147c.982-.33 2.067.062 2.587.934l.785 1.318c.52.872.326 1.98-.46 2.639l-.35.293a2.83 2.83 0 0 0 0 4.368l.35.293c.787.66.98 1.767.46 2.64l-.785 1.317c-.52.872-1.605 1.264-2.587.934l-.436-.147c-1.716-.578-3.561.454-3.903 2.184l-.087.44c-.195.99-1.088 1.705-2.127 1.705h-1.57c-1.039 0-1.932-.716-2.127-1.705L9 21.405c-.342-1.73-2.187-2.762-3.903-2.184l-.436.146c-.982.331-2.067-.06-2.587-.933l-.785-1.318a2.055 2.055 0 0 1 .46-2.639l.35-.293a2.83 2.83 0 0 0 0-4.368l-.35-.293a2.055 2.055 0 0 1-.46-2.64l.785-1.317c.52-.872 1.605-1.264 2.587-.934l.436.147C6.813 5.357 8.658 4.324 9 2.595l.087-.44C9.283 1.165 10.176.45 11.215.45zM12 15.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6" fill="currentColor"/></svg></button>
                  <button id="fullscreen-btn" class="control-button">${fullscreenIcon}</button>
                  <div id="settings-menu" class="settings-menu hidden">
                     <h4>Quality</h4>
                     <div id="source-options"></div>
                  </div>
                  <div id="cc-menu" class="settings-menu cc-menu hidden">
                     <h4>Subtitles</h4>
                     <div id="cc-options-container"></div>
                     <div class="cc-divider"></div>
                     <h4>Subtitle Settings</h4>
                     <div class="cc-slider-container">
                        <label for="fontSizeSlider">Font Size</label>
                        <div class="generic-slider-wrapper">
                           <input type="range" id="fontSizeSlider" min="1" max="3" step="0.1" value="1.8">
                           <div id="fontSizeBubble" class="slider-bubble">1.8</div>
                        </div>
                     </div>
                     <div class="cc-slider-container">
                        <label for="positionSlider">Position</label>
                        <div class="generic-slider-wrapper">
                           <input type="range" id="positionSlider" min="-10" max="0" step="1" value="-4">
                           <div id="positionBubble" class="slider-bubble">-4</div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   `;
   initCustomPlayer(sources, showId, episodeNumber, showMeta, preferredSource, progress);
}

function initCustomPlayer(sources, showId, episodeNumber, showMeta, preferredSource, progress) {
   const playerContent = document.getElementById('player-content');
   const video = document.getElementById('videoPlayer');
   const controlsContainer = document.getElementById('video-controls-container');
   const playPauseBtn = document.getElementById('play-pause-btn');
   const seekBackwardBtn = document.getElementById('seek-backward-btn');
   const seekForwardBtn = document.getElementById('seek-forward-btn');
   const progressBar = document.querySelector('.progress-bar');
   const progressBarContainer = document.querySelector('.progress-bar-container');
   const progressBubble = document.getElementById('progress-bubble');
   const watchedBar = document.querySelector('.progress-bar-watched');
   const bufferedBar = document.querySelector('.progress-bar-buffered');
   const progressBarThumb = document.querySelector('.progress-bar-thumb');
   const currentTimeEl = document.getElementById('current-time');
   const totalTimeEl = document.getElementById('total-time');
   const fullscreenBtn = document.getElementById('fullscreen-btn');
   const settingsBtn = document.getElementById('settings-btn');
   const ccBtn = document.getElementById('cc-btn');
   const downloadBtn = document.getElementById('download-btn');
   const settingsMenu = document.getElementById('settings-menu');
   const ccMenu = document.getElementById('cc-menu');
   const sourceOptions = document.getElementById('source-options');
   const volumeBtn = document.getElementById('volume-btn');
   const volumeSlider = document.getElementById('volume-slider');
   const volumeBubble = document.getElementById('volume-bubble');
   const fontSizeSlider = document.getElementById('fontSizeSlider');
   const fontSizeBubble = document.getElementById('fontSizeBubble');
   const positionSlider = document.getElementById('positionSlider');
   const positionBubble = document.getElementById('positionBubble');
   const autoSkipToggle = document.getElementById('autoSkipToggle');
   const playIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
   const pauseIcon = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
   const fullscreenIcon = `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
   const exitFullscreenIcon = `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;
   const volumeHighIcon = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
   const volumeMediumIcon = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`;
   const volumeMuteIcon = `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
   
   let skipIntervals = [];
   let skippedInThisSession = new Set();
   let isAutoSkipEnabled = localStorage.getItem('autoSkipEnabled') === 'true';
   autoSkipToggle.checked = isAutoSkipEnabled;
   autoSkipToggle.addEventListener('change', (e) => {
      isAutoSkipEnabled = e.target.checked;
      localStorage.setItem('autoSkipEnabled', isAutoSkipEnabled);
   });

   function renderSkipSegments() {
      if (!video.duration || skipIntervals.length === 0) return;
      progressBar.querySelectorAll('.progress-bar-skip-segment').forEach(el => el.remove());
      skipIntervals.forEach(result => {
         const interval = result.interval;
         const startPercent = (interval.start_time / video.duration) * 100;
         const widthPercent = ((interval.end_time - interval.start_time) / video.duration) * 100;
         const segment = document.createElement('div');
         segment.className = 'progress-bar-skip-segment';
         segment.style.left = `${startPercent}%`;
         segment.style.width = `${widthPercent}%`;
         segment.dataset.skipType = result.skip_type;
         progressBar.appendChild(segment);
      });
   }

   async function fetchAndApplySkipTimes() {
      try {
         const response = await fetch(`/skip-times/${showId}/${episodeNumber}`);
         if (!response.ok) return;
         const data = await response.json();
         if (data.found && data.results) {
            skipIntervals = data.results;
            renderSkipSegments();
         }
      } catch (error) {
         console.error("Could not fetch skip times:", error);
      }
   }
   
	function setupSlider(slider, bubble, valueFormatter) {
	  const updateSliderUI = () => {
		 const min = parseFloat(slider.min);
		 const max = parseFloat(slider.max);
		 const val = parseFloat(slider.value);
		 const percent = ((val - min) / (max - min)) * 100;
		 slider.style.setProperty('--value-percent', `${percent}%`);

		 if (bubble) {
			bubble.textContent = valueFormatter ? valueFormatter(val) : val;

			const sliderWidth = slider.offsetWidth;
			const thumbWidth = 16;
			const trackWidth = sliderWidth - thumbWidth;
			const thumbPosition = (percent / 100) * trackWidth;
			const bubbleLeft = thumbPosition + (thumbWidth / 2);

			bubble.style.left = `${bubbleLeft}px`;
		 }
	  };

	  if (bubble) {
		 const container = slider.parentElement;
		 const showBubble = () => {
			updateSliderUI();
			bubble.style.opacity = '1';
		 };
		 const hideBubble = () => bubble.style.opacity = '0';
		 slider.addEventListener('input', updateSliderUI);
		 container.addEventListener('mouseenter', showBubble);
		 container.addEventListener('mouseleave', hideBubble);
		 slider.addEventListener('mousedown', showBubble);
		 document.addEventListener('mouseup', hideBubble);
	  }
	  
	  slider.addEventListener('input', updateSliderUI);
	  updateSliderUI();
	}

   let styleElement = document.getElementById('subtitle-style-override');
   if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'subtitle-style-override';
      document.head.appendChild(styleElement);
   }
   const updateFontSize = () => {
      const size = fontSizeSlider.value;
      styleElement.innerHTML = `video::cue { font-size: ${size}rem !important; }`;
      localStorage.setItem('subtitleFontSize', size);
   };
   const updatePosition = () => {
      const position = positionSlider.value;
      if (video.textTracks && video.textTracks.length > 0) {
         for (const track of video.textTracks) {
            if (track.cues) {
               for (const cue of track.cues) {
                  cue.line = parseInt(position, 10);
               }
            }
         }
      }
      localStorage.setItem('subtitlePosition', position);
   };
   fontSizeSlider.value = localStorage.getItem('subtitleFontSize') || '1.8';
   positionSlider.value = localStorage.getItem('subtitlePosition') || '-4';
   setupSlider(fontSizeSlider, fontSizeBubble, val => val.toFixed(1));
   setupSlider(positionSlider, positionBubble, val => val.toString());
   fontSizeSlider.addEventListener('input', updateFontSize);
   positionSlider.addEventListener('input', updatePosition);
   updateFontSize();

   const togglePlay = () => {
      if (video.paused) {
         video.play();
      } else {
         video.pause();
      }
   };
   let clickTimer = null;
   video.addEventListener('click', (e) => {
      if (clickTimer === null) {
         clickTimer = setTimeout(() => {
            clickTimer = null;
            togglePlay();
         }, 250);
      } else {
         clearTimeout(clickTimer);
         clickTimer = null;
         
         // Check for fullscreen state with cross-browser support
         const isFullscreen = !!document.fullscreenElement || 
                             !!document.webkitFullscreenElement || 
                             !!document.mozFullScreenElement ||
                             !!document.msFullscreenElement;
         
         if (!isFullscreen) {
            // iOS Safari requires using webkitEnterFullscreen directly on the video element
            if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && video.webkitEnterFullscreen) {
               video.webkitEnterFullscreen();
            }
            // Request fullscreen with cross-browser support for other devices
            else if (playerContent.requestFullscreen) {
               playerContent.requestFullscreen();
            } else if (playerContent.webkitRequestFullscreen) { // Safari and iOS
               playerContent.webkitRequestFullscreen();
            } else if (playerContent.msRequestFullscreen) { // IE11
               playerContent.msRequestFullscreen();
            } else if (playerContent.mozRequestFullScreen) { // Firefox
               playerContent.mozRequestFullScreen();
            }
         } else {
            // Exit fullscreen with cross-browser support
            if (document.exitFullscreen) {
               document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { // Safari and iOS
               document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { // IE11
               document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) { // Firefox
               document.mozCancelFullScreen();
            }
         }
      }
   });
   playPauseBtn.addEventListener('click', togglePlay);
   video.addEventListener('play', () => playPauseBtn.innerHTML = pauseIcon);
   video.addEventListener('pause', () => playPauseBtn.innerHTML = playIcon);
   seekBackwardBtn.addEventListener('click', () => { video.currentTime -= 10; });
   seekForwardBtn.addEventListener('click', () => { video.currentTime += 10; });
   
   video.addEventListener('loadedmetadata', () => {
      totalTimeEl.textContent = formatTime(video.duration);

      if (progress && progress.currentTime > 0 && progress.currentTime < video.duration * 0.95) {
         const continueWatchingTime = progress.currentTime;
         const formattedTime = formatTime(continueWatchingTime);

         const userConfirmed = confirm(`You were watching Episode ${episodeNumber} at ${formattedTime}. Would you like to continue from there?`);

         if (userConfirmed) {
            video.currentTime = continueWatchingTime;
         } else {
            video.currentTime = 0;
         }
      } else {
          video.currentTime = 0;
      }

      fetchAndApplySkipTimes();
   });

	let hasMarkedWatched = false;
	video.addEventListener('timeupdate', () => {
		currentTimeEl.textContent = formatTime(video.currentTime);
		const progressPercent = (video.currentTime / video.duration) * 100;
		watchedBar.style.width = `${progressPercent}%`;
		progressBarThumb.style.left = `${progressPercent}%`;
		const currentTime = video.currentTime;

		if (progressPercent > 95 && !hasMarkedWatched) {
			markEpisodeWatched(showId, episodeNumber);
			hasMarkedWatched = true;
		}

		if (skippedInThisSession.size > 0) {
			for (const skippedId of skippedInThisSession) {
				const result = skipIntervals.find(r => r.skip_id === skippedId);
				if (result && currentTime < result.interval.start_time) {
					skippedInThisSession.delete(skippedId);
				}
			}
		}

		if (isAutoSkipEnabled && skipIntervals.length > 0) {
			for (const result of skipIntervals) {
				if (!skippedInThisSession.has(result.skip_id)) {
					const interval = result.interval;
					if (currentTime >= interval.start_time && currentTime < interval.end_time) {
						if (interval.end_time < video.duration) {
							video.currentTime = interval.end_time;
						}
						skippedInThisSession.add(result.skip_id);
						break;
					}
				}
			}
		}
	});

    if (videoProgressUpdateTimer) clearInterval(videoProgressUpdateTimer);
    videoProgressUpdateTimer = setInterval(() => {
        if (!video.paused && video.duration > 0) {
            fetchWithProfile('/update-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    showId,
                    episodeNumber,
                    currentTime: video.currentTime,
                    duration: video.duration,
                    showName: showMeta.name,
                    showThumbnail: showMeta.thumbnail,
                })
            });
        }
    }, 5000);

   video.addEventListener('progress', () => {
      if (video.buffered.length > 0) {
         const bufferedEnd = video.buffered.end(video.buffered.length - 1);
         const bufferedPercent = (bufferedEnd / video.duration) * 100;
         bufferedBar.style.width = `${bufferedPercent}%`;
      }
   });
   
    let isDragging = false;
    let wasPlayingBeforeDrag = false;

    const updateScrubberUI = (percent) => {
        watchedBar.style.width = `${percent}%`;
        progressBarThumb.style.left = `${percent}%`;
    };

    progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = percent * video.duration;
    });

    progressBarContainer.addEventListener('mousemove', e => {
        const rect = progressBar.getBoundingClientRect();
        const percent = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1);
        const hoverTime = percent * video.duration;
        progressBubble.textContent = formatTime(hoverTime);

        const mouseX = e.clientX - rect.left;
        progressBubble.style.left = `${mouseX}px`;

        if (!isDragging) {
            progressBubble.style.opacity = '1';
        }
    });
   
    progressBarContainer.addEventListener('mouseleave', () => {
        if (!isDragging) {
            progressBubble.style.opacity = '0';
        }
    });
    
    progressBarThumb.addEventListener('mousedown', () => {
        isDragging = true;
        wasPlayingBeforeDrag = !video.paused;
        video.pause();
        progressBubble.style.opacity = '1';
    });

    document.addEventListener('mousemove', e => {
        if (isDragging) {
            const rect = progressBar.getBoundingClientRect();
            const percent = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1);
            
            updateScrubberUI(percent * 100);

            const hoverTime = percent * video.duration;
            progressBubble.textContent = formatTime(hoverTime);
            const mouseX = e.clientX - rect.left;
            progressBubble.style.left = `${mouseX}px`;
        }
    });
    
    document.addEventListener('mouseup', (e) => {
        if (isDragging) {
            isDragging = false;
            progressBubble.style.opacity = '0';

            const rect = progressBar.getBoundingClientRect();
            const percent = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1);
            
            video.currentTime = percent * video.duration;
            
            if (wasPlayingBeforeDrag) {
                video.play();
            }
        }
    });
	
   const updateVolumeUI = () => {
      const volume = video.muted ? 0 : video.volume;
      if (video.muted || volume === 0) {
         volumeBtn.innerHTML = volumeMuteIcon;
      } else if (volume <= 0.5) {
         volumeBtn.innerHTML = volumeMediumIcon;
      } else {
         volumeBtn.innerHTML = volumeHighIcon;
      }
   };

   video.addEventListener('volumechange', () => {
      updateVolumeUI();
      if (!video.muted) {
         volumeSlider.value = video.volume;
      }
      
      const min = parseFloat(volumeSlider.min);
      const max = parseFloat(volumeSlider.max);
      const percent = ((parseFloat(volumeSlider.value) - min) / (max - min)) * 100;
      volumeSlider.style.setProperty('--value-percent', `${percent}%`);

      localStorage.setItem('playerVolume', video.volume);
      localStorage.setItem('playerMuted', video.muted.toString());
   });

   volumeSlider.addEventListener('input', (e) => {
      video.muted = false;
      video.volume = e.target.value;
   });

   volumeBtn.addEventListener('click', () => {
      video.muted = !video.muted;
   });

   const savedVolume = localStorage.getItem('playerVolume');
   const savedMuted = localStorage.getItem('playerMuted');
   
   video.volume = (savedVolume !== null) ? parseFloat(savedVolume) : 1.0;
   volumeSlider.value = video.volume;
   video.muted = (savedMuted === 'true');
   
   setupSlider(volumeSlider, volumeBubble, val => `${Math.round(val * 100)}%`);
   updateVolumeUI();
   
   const initialPercent = ((parseFloat(volumeSlider.value) - parseFloat(volumeSlider.min)) / (parseFloat(volumeSlider.max) - parseFloat(volumeSlider.min))) * 100;
   volumeSlider.style.setProperty('--value-percent', `${initialPercent}%`);
   
   fullscreenBtn.addEventListener('click', () => {
      // Check for standard fullscreen API
      if (!document.fullscreenElement && 
          !document.mozFullScreenElement && 
          !document.webkitFullscreenElement && 
          !document.msFullscreenElement) {
         // iOS Safari requires using webkitEnterFullscreen directly on the video element
         if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
         }
         // Request fullscreen with cross-browser support for other devices
         else if (playerContent.requestFullscreen) {
            playerContent.requestFullscreen();
         } else if (playerContent.webkitRequestFullscreen) { // Safari and iOS
            playerContent.webkitRequestFullscreen();
         } else if (playerContent.msRequestFullscreen) { // IE11
            playerContent.msRequestFullscreen();
         } else if (playerContent.mozRequestFullScreen) { // Firefox
            playerContent.mozRequestFullScreen();
         }
      } else {
         // Exit fullscreen with cross-browser support
         if (document.exitFullscreen) {
            document.exitFullscreen();
         } else if (document.webkitExitFullscreen) { // Safari and iOS
            document.webkitExitFullscreen();
         } else if (document.msExitFullscreen) { // IE11
            document.msExitFullscreen();
         } else if (document.mozCancelFullScreen) { // Firefox
            document.mozCancelFullScreen();
         }
      }
   });

   // Handle fullscreen change events with cross-browser support
   document.addEventListener('fullscreenchange', handleFullscreenChange);
   document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari and iOS
   document.addEventListener('mozfullscreenchange', handleFullscreenChange); // Firefox
   document.addEventListener('MSFullscreenChange', handleFullscreenChange); // IE11
   
   function handleFullscreenChange() {
      const isFullscreen = !!document.fullscreenElement || 
                          !!document.webkitFullscreenElement || 
                          !!document.mozFullScreenElement ||
                          !!document.msFullscreenElement;
      
      playerContent.classList.toggle('fullscreen', isFullscreen);
      fullscreenBtn.innerHTML = isFullscreen ? exitFullscreenIcon : fullscreenIcon;
   }
   
   // Current video URL and headers for download
   let currentVideoUrl = '';
   let currentVideoFilename = '';
   let currentHeaders = {};
   let isProxiedUrl = false;
   
   downloadBtn.addEventListener('click', () => {
      if (currentVideoUrl) {
         // Get the filename from the data attribute or use the currentVideoFilename
         const filename = downloadBtn.getAttribute('data-filename') || currentVideoFilename || '1P_0.mp4';
         console.log('Download button clicked with filename:', filename);
         
         // Create a form to submit the download request
         const form = document.createElement('form');
         form.method = 'GET';
         form.action = '/api/download-video';
         form.target = '_blank';
         
         // Add URL parameter
         const urlInput = document.createElement('input');
         urlInput.type = 'hidden';
         urlInput.name = 'url';
         urlInput.value = currentVideoUrl;
         form.appendChild(urlInput);
         
         // Add referer if available
         if (currentHeaders && currentHeaders.Referer) {
            const refererInput = document.createElement('input');
            refererInput.type = 'hidden';
            refererInput.name = 'referer';
            refererInput.value = currentHeaders.Referer;
            form.appendChild(refererInput);
         }
         
         // Add filename - always include a filename
         const filenameInput = document.createElement('input');
         filenameInput.type = 'hidden';
         filenameInput.name = 'filename';
         filenameInput.value = filename;
         form.appendChild(filenameInput);
         
         // Submit the form
         document.body.appendChild(form);
         form.submit();
         document.body.removeChild(form);
      } else {
         alert('No downloadable video source available');
      }
   });
   const toggleMenu = (menu) => {
      menu.classList.toggle('hidden');
   };
   settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(settingsMenu);
      ccMenu.classList.add('hidden');
   });
   ccBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(ccMenu);
      settingsMenu.classList.add('hidden');
   });
   document.addEventListener('click', () => {
      settingsMenu.classList.add('hidden');
      ccMenu.classList.add('hidden');
   });
   settingsMenu.addEventListener('click', e => e.stopPropagation());
   ccMenu.addEventListener('click', e => e.stopPropagation());
   let isMouseInsidePlayer = false;
   const hideControls = () => {
      if (video.paused) return;
      if (isMouseInsidePlayer) {
         controlsContainer.classList.add('hidden');
         document.body.style.cursor = 'none';
      }
   };
   const showControls = () => {
      controlsContainer.classList.remove('hidden');
      document.body.style.cursor = 'default';
      clearTimeout(playerInactivityTimer);
      if (!video.paused && isMouseInsidePlayer) {
         playerInactivityTimer = setTimeout(hideControls, 3000);
      }
   };
   playerContent.addEventListener('mousemove', () => {
      isMouseInsidePlayer = true;
      showControls();
   });
   playerContent.addEventListener('mouseleave', () => {
      isMouseInsidePlayer = false;
      clearTimeout(playerInactivityTimer);
      controlsContainer.classList.add('hidden');
      document.body.style.cursor = 'default';
   });
   playerContent.addEventListener('mouseenter', () => {
      isMouseInsidePlayer = true;
      showControls();
   });
   video.addEventListener('pause', () => {
      showControls();
      document.body.style.cursor = 'default';
   });
   video.addEventListener('play', () => {
      if (isMouseInsidePlayer) {
         playerInactivityTimer = setTimeout(hideControls, 3000);
      }
   });
   showControls();
   document.addEventListener('keydown', (e) => {
      if (document.getElementById('player-page').style.display !== 'block') return;
      const activeElement = document.activeElement;
      if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT') return;
      showControls();
      switch (e.key.toLowerCase()) {
         case ' ': e.preventDefault(); togglePlay(); break;
         case 'f': fullscreenBtn.click(); break;
         case 'm': volumeBtn.click(); break;
         case 'arrowright': video.currentTime += 5; break;
         case 'arrowleft': video.currentTime -= 5; break;
         case 'arrowup': video.volume = Math.min(1, video.volume + 0.05); break;
         case 'arrowdown': video.volume = Math.max(0, video.volume - 0.05); break;
      }
   });
   let autoPlayed = false;
   sources.forEach(source => {
      const container = document.createElement('div');
      container.className = 'source-container';
      const title = document.createElement('h4');
      title.textContent = source.sourceName;
      const sortedLinks = [...source.links].sort((a, b) => (parseInt(b.resolutionStr) || 0) - (parseInt(a.resolutionStr) || 0));
      const englishSub = source.subtitles?.find(s => s.lang === 'en' || s.label === 'English');
      const qualityList = document.createElement('div');
      qualityList.className = 'quality-list';
      sortedLinks.forEach(linkInfo => {
         const qualityItem = document.createElement('button');
         qualityItem.className = 'quality-item';
         qualityItem.textContent = linkInfo.resolutionStr;
         qualityItem.onclick = () => {
            playVideo(source.sourceName, linkInfo, englishSub);
            sourceOptions.querySelectorAll('.quality-item').forEach(btn => btn.classList.remove('active'));
            qualityItem.classList.add('active');
         };
         qualityList.appendChild(qualityItem);
      });
      container.appendChild(title);
      container.appendChild(qualityList);
      sourceOptions.appendChild(container);
      if (!autoPlayed && preferredSource && source.sourceName === preferredSource && qualityList.querySelector('.quality-item')) {
         qualityList.querySelector('.quality-item').click();
         autoPlayed = true;
      }
   });
   if (!autoPlayed && sourceOptions.querySelector('.quality-item')) {
      sourceOptions.querySelector('.quality-item').click();
   }
   const autoplayToggle = document.getElementById('autoplayToggle');
   autoplayToggle.checked = localStorage.getItem('autoplayEnabled') === 'true';
   autoplayToggle.addEventListener('change', (e) => localStorage.setItem('autoplayEnabled', e.target.checked));
   video.addEventListener('ended', () => {
      markEpisodeWatched(showId, episodeNumber);
      if (autoplayToggle.checked) {
         const allEpItems = [...document.querySelectorAll('#episode-grid-player .result-item')];
         const currentEpItem = document.querySelector(`#episode-grid-player .result-item[data-episode='${episodeNumber}']`);
         const currentIndex = allEpItems.indexOf(currentEpItem);
         if (currentIndex > -1 && currentIndex < allEpItems.length - 1) {
            allEpItems[currentIndex + 1].click();
         }
      }
   });

function playVideo(sourceName, linkInfo, subtitleInfo) {
	if (currentHlsInstance) {
		currentHlsInstance.destroy();
		currentHlsInstance = null;
	}
	const videoElement = document.getElementById('videoPlayer');
	const ccOptionsContainer = document.getElementById('cc-options-container');
	ccOptionsContainer.innerHTML = '';
	setPreferredSource(sourceName);
	
	// Set current video URL and headers for download button
	currentVideoUrl = linkInfo.link;
	currentHeaders = linkInfo.headers || {};
	
	// Get anime name and episode number
	const animeName = document.querySelector('#player-page .show-header h2')?.textContent?.trim() || 'Anime';
	const episodeNumber = document.querySelector('#episode-grid-player .result-item.active')?.getAttribute('data-episode') || '0';
	
	// Episode number is already extracted from the active episode element
	// No need to parse it from a title
	
	// Format the filename as requested: AnimeName_EpisodeNumber.mp4
	// Remove any characters that might cause issues in filenames
	let safeAnimeName = animeName.replace(/[\s\\/:*?"<>|]+/g, '_');
	// Ensure we have a valid anime name
	if (!safeAnimeName || safeAnimeName === '_') {
		safeAnimeName = '1P'; // Default name if extraction failed
	}
	
	// Create the filename
	currentVideoFilename = `${safeAnimeName}_${episodeNumber}.mp4`;
	console.log('Setting filename for download:', currentVideoFilename);
	
	// Force update the download button with this filename
	const downloadBtn = document.getElementById('downloadBtn');
	if (downloadBtn) {
		downloadBtn.setAttribute('data-filename', currentVideoFilename);
	}

	skipIntervals = [];
	skippedInThisSession.clear();
	progressBar.querySelectorAll('.progress-bar-skip-segment').forEach(el => el.remove());

	while (videoElement.firstChild) {
		videoElement.removeChild(videoElement.firstChild);
	}
	if (subtitleInfo && subtitleInfo.src) {
		const updateActiveCCButton = (activeButton) => {
			ccOptionsContainer.querySelectorAll('.cc-item').forEach(btn => btn.classList.remove('active'));
			if (activeButton) activeButton.classList.add('active');
		};
		ccBtn.classList.remove('disabled');
		const offButton = document.createElement('button');
		offButton.className = 'cc-item';
		offButton.textContent = 'Off';
		offButton.onclick = () => {
			for (let i = 0; i < videoElement.textTracks.length; i++) {
				videoElement.textTracks[i].mode = 'hidden';
			}
			updateActiveCCButton(offButton);
		};
		const langButton = document.createElement('button');
		langButton.className = 'cc-item active';
		langButton.textContent = 'English';
		langButton.onclick = () => {
			for (let i = 0; i < videoElement.textTracks.length; i++) {
				videoElement.textTracks[i].mode = 'showing';
			}
			updateActiveCCButton(langButton);
		};
		ccOptionsContainer.appendChild(offButton);
		ccOptionsContainer.appendChild(langButton);
		const track = document.createElement('track');
		track.kind = 'subtitles';
		track.label = 'English';
		track.srclang = 'en';
		track.src = `/subtitle-proxy?url=${encodeURIComponent(subtitleInfo.src)}`;
		track.default = true;
		videoElement.appendChild(track);
		videoElement.textTracks.addEventListener('addtrack', (event) => {
			const addedTrack = event.track;
			addedTrack.mode = 'showing';
			addedTrack.addEventListener('cuechange', () => {
				const position = localStorage.getItem('subtitlePosition') || '-4';
				const activeCues = addedTrack.activeCues;
				if (activeCues) {
					for (let i = 0; i < activeCues.length; i++) {
						activeCues[i].line = parseInt(position, 10);
					}
				}
			});
		});
	} else {
		ccBtn.classList.add('disabled');
		const disabledButton = document.createElement('button');
		disabledButton.className = 'cc-item';
		disabledButton.textContent = 'Not Available';
		disabledButton.disabled = true;
		ccOptionsContainer.appendChild(disabledButton);
	}

	if (linkInfo.hls && Hls.isSupported()) {
		let proxiedUrl = `/proxy?url=${encodeURIComponent(linkInfo.link)}`;
		if (linkInfo.headers && linkInfo.headers.Referer) {
			proxiedUrl += `&referer=${encodeURIComponent(linkInfo.headers.Referer)}`;
		}
		// Set proxied URL flag for download button
		isProxiedUrl = false;
		const hls = new Hls();
		hls.loadSource(proxiedUrl);
		hls.attachMedia(videoElement);
		hls.on(Hls.Events.ERROR, (event, data) => {
			if (data.fatal) {
				console.error('HLS fatal error:', data);
				hls.destroy();
			}
		});
		currentHlsInstance = hls;
	} else {
		let proxiedUrl = `/proxy?url=${encodeURIComponent(linkInfo.link)}`;
		if (linkInfo.headers && linkInfo.headers.Referer) {
			proxiedUrl += `&referer=${encodeURIComponent(linkInfo.headers.Referer)}`;
		}
		// Set proxied URL flag for download button
		isProxiedUrl = false;
		videoElement.src = proxiedUrl;
	}
	
	videoElement.play().catch(e => {
		console.log("Autoplay was prevented. User interaction needed.");
	});
}

}

async function setPreferredSource(sourceName) {
   try {
      const response = await fetchWithProfile('/settings', {
         method: 'POST',
         body: JSON.stringify({ key: 'preferredSource', value: sourceName })
      });
      if (!response.ok) {
         console.error('Failed to set preferred source:', await response.text());
      }
   } catch (error) {
      console.error('Error setting preferred source:', error);
   }
}
async function markEpisodeWatched(showId, episodeNumber) {
   await fetchWithProfile('/update-progress', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ showId, episodeNumber, currentTime: 1, duration: 1 })
    });
   const epItem = document.querySelector(`#episode-grid-player .result-item[data-episode='${episodeNumber}']`);
   if (epItem) epItem.classList.add('watched');
}

async function renderSettingsPage() {
    const nameInput = document.getElementById('profile-name-input');
    const picPreview = document.getElementById('settings-profile-pic');
    const picUpload = document.getElementById('profile-pic-upload');
    const saveBtn = document.getElementById('save-profile-settings-btn');
    
    try {
        const response = await fetchWithProfile(`/api/profiles/${activeProfileId}`);
        const profile = await response.json();
        
        nameInput.value = profile.name;
        picPreview.src = profile.picture_path ? `${profile.picture_path}?t=${new Date().getTime()}` : '/profile_pics/default.png';

        picUpload.onchange = () => {
            if (picUpload.files && picUpload.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    picPreview.src = e.target.result;
                }
                reader.readAsDataURL(picUpload.files[0]);
            }
        };

        saveBtn.onclick = async () => {
            const newName = nameInput.value.trim();
            if (newName && newName !== profile.name) {
                await fetchWithProfile(`/api/profiles/${activeProfileId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName })
                });
            }

            if (picUpload.files && picUpload.files[0]) {
                const formData = new FormData();
                formData.append('profilePic', picUpload.files[0]);
                await fetchWithProfile(`/api/profiles/${activeProfileId}/picture`, {
                    method: 'POST',
                    body: formData
                });
            }
            alert('Profile updated!');
            await initProfileSystem();
        };

    } catch (error) {
        console.error("Failed to load settings page:", error);
    }
}