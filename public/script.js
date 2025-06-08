let currentHlsInstance = null;
const searchState = {
	query: '',
	season: 'ALL',
	year: 'ALL',
	sortBy: 'Popular',
	page: 1,
	isLoading: false,
	hasMore: true
};

document.addEventListener('DOMContentLoaded', () => {
	setupSearchFilters();
	showPage('home');
});

function stopVideoPlayback() {
	if (currentHlsInstance) {
		currentHlsInstance.destroy();
		currentHlsInstance = null;
	}
	const playerPage = document.getElementById('player-page');
	const videoElement = playerPage.querySelector('video');
	if (videoElement) {
		videoElement.pause();
	}
	playerPage.innerHTML = '';
}

function showPage(page, data = {}) {
	stopVideoPlayback();
	document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
	const pageElement = document.getElementById(`${page}-page`);
	pageElement.style.display = 'block';

	switch (page) {
		case 'home':
			fetchAndDisplayContinueWatching();
			fetchAndDisplaySeasonal();
			fetchAndDisplayTop10();
			fetchAndDisplayLatestReleases();
			break;
		case 'watchlist':
			fetchAndDisplayWatchlist();
			break;
		case 'search':
			if (document.getElementById('results').innerHTML === '') {
				triggerSearch();
			}
			break;
		case 'player':
			if (data.showId) {
				if (data.episodeToPlay) {
					fetchEpisodes(data.showId, data.showName, data.showThumbnail, 'sub', data.episodeToPlay);
				} else {
					fetchEpisodes(data.showId, data.showName, data.showThumbnail);
				}
			}
			break;
	}
}

function fixThumbnailUrl(url) {
	if (!url) return '/placeholder.png';
	const absoluteUrl = url.startsWith('http') ? url : `https://allanime.day/${url.replace(/^\/*/, '')}`;
	return `/image-proxy?url=${encodeURIComponent(absoluteUrl)}`;
}

async function fetchAndDisplaySection(endpoint, containerId) {
	try {
		const response = await fetch(endpoint);
		if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
		const shows = await response.json();
		displayGrid(containerId, shows, (show) => {
			showPage('player', {
				showId: show._id,
				showName: show.name,
				showThumbnail: show.thumbnail
			});
		});
	} catch (error) {
		document.getElementById(containerId).innerHTML = `<p class="error">Could not load this section.</p>`;
	}
}

const fetchAndDisplayLatestReleases = () => fetchAndDisplaySection('/latest-releases', 'latest-releases');

async function fetchAndDisplayTop10() {
	try {
		const response = await fetch('/popular');
		if (!response.ok) throw new Error('Failed to fetch popular');
		const shows = await response.json();
		const container = document.getElementById('top-10-popular');
		container.innerHTML = '';
		shows.forEach((show, index) => {
			const item = document.createElement('div');
			item.className = 'top-10-item';
			item.setAttribute('data-raw-thumbnail', show.thumbnail || '');
			const totalEpisodes = Math.max(show.availableEpisodesDetail?.sub?.length || 0, show.availableEpisodesDetail?.dub?.length || 0);
			item.innerHTML = `
                <span class="rank-number">${String(index + 1).padStart(2, '0')}</span>
                <img src="${fixThumbnailUrl(show.thumbnail)}" alt="${show.name}" loading="lazy" onerror="this.src='/placeholder.png';"/>
                <div class="item-details">
                    <p class="item-title">${show.name}</p>
                    <div class="ep-counts">
                        <i class="icon-cc"></i>
                        <span>${totalEpisodes}</span>
                    </div>
                </div>
            `;
			item.addEventListener('click', () => showPage('player', {
				showId: show._id,
				showName: show.name,
				showThumbnail: show.thumbnail
			}));
			container.appendChild(item);
		});
	} catch (error) {
		document.getElementById('top-10-popular').innerHTML = `<p class="error">Could not load top 10.</p>`;
	}
}

async function fetchAndDisplaySeasonal() {
	try {
		const response = await fetch('/seasonal');
		if (!response.ok) throw new Error(`Failed to fetch /seasonal`);
		const shows = await response.json();
		const firstShowWithDesc = shows.find(s => s.description);
		if (firstShowWithDesc) {
			const desc = firstShowWithDesc.description;
			const yearMatch = desc.match(/Season: (?:Winter|Spring|Summer|Fall) (\d{4})/);
			const seasonMatch = desc.match(/Season: (Winter|Spring|Summer|Fall)/);
			if (yearMatch && seasonMatch) {
				document.getElementById('seasonal-title').textContent = `${seasonMatch[1]} ${yearMatch[1]}`;
			}
		}
		displayGrid('seasonal-anime', shows, (show) => {
			showPage('player', {
				showId: show._id,
				showName: show.name,
				showThumbnail: show.thumbnail
			});
		});
	} catch (error) {
		document.getElementById('seasonal-anime').innerHTML = `<p class="error">Could not load seasonal anime.</p>`;
	}
}

async function fetchAndDisplayContinueWatching() {
	try {
		const response = await fetch('/continue-watching');
		if (!response.ok) throw new Error('Network response was not ok');
		const shows = await response.json();
		const container = document.getElementById('continue-watching');
		if (shows.length > 0) {
			container.parentElement.style.display = 'block';
			displayGrid('continue-watching', shows, (show) => {
				showPage('player', {
					showId: show.showId,
					showName: show.name,
					showThumbnail: show.thumbnail,
					episodeToPlay: show.nextEpisodeNumber
				});
			}, show => `${show.name} - Ep ${show.nextEpisodeNumber}`);
		} else {
			container.parentElement.style.display = 'none';
		}
	} catch (error) {
		document.getElementById('continue-watching').parentElement.style.display = 'none';
	}
}

async function fetchAndDisplayWatchlist() {
	try {
		const response = await fetch('/watchlist');
		if (!response.ok) throw new Error('Network response was not ok');
		const shows = await response.json();
		const container = document.getElementById('watchlist');
		container.innerHTML = '';
		container.className = 'grid';
		if (shows.length > 0) {
			shows.forEach(show => {
				const item = document.createElement('div');
				item.className = 'grid-item';
				item.setAttribute('data-raw-thumbnail', show.thumbnail || '');
				item.innerHTML = `
          <img src="${fixThumbnailUrl(show.thumbnail)}" alt="${show.name}" loading="lazy" onerror="this.src='/placeholder.png'; this.className='image-fallback';">
          <p>${show.name}</p>
          <div class="watchlist-controls">
            <select class="status-select">
              <option value="Watching" ${show.status === 'Watching' ? 'selected' : ''}>Watching</option>
              <option value="Completed" ${show.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="On-Hold" ${show.status === 'On-Hold' ? 'selected' : ''}>On-Hold</option>
              <option value="Dropped" ${show.status === 'Dropped' ? 'selected' : ''}>Dropped</option>
            </select>
            <button class="remove-button">Remove</button>
          </div>
        `;
				item.querySelector('img').addEventListener('click', () => showPage('player', {
					showId: show.id,
					showName: show.name,
					showThumbnail: show.thumbnail
				}));
				item.querySelector('.status-select').addEventListener('change', async (e) => {
					await fetch('/watchlist/status', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							id: show.id,
							status: e.target.value
						})
					});
				});
				item.querySelector('.remove-button').addEventListener('click', async () => {
					await fetch('/watchlist/remove', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							id: show.id
						})
					});
					fetchAndDisplayWatchlist();
				});
				container.appendChild(item);
			});
		} else {
			container.innerHTML = '<p class="error">Your watchlist is empty.</p>';
		}
	} catch (error) {
		document.getElementById('watchlist').innerHTML = '<p class="error">Could not load watchlist.</p>';
	}
}

function setupSearchFilters() {
	const seasonFilter = document.getElementById('seasonFilter');
	const yearFilter = document.getElementById('yearFilter');
	const sortFilter = document.getElementById('sortFilter');
	const searchInput = document.getElementById('searchInput');

	const seasons = ['ALL', 'Winter', 'Spring', 'Summer', 'Fall'];
	seasons.forEach(s => seasonFilter.add(new Option(s, s)));

	const currentYear = new Date().getFullYear();
	yearFilter.add(new Option('ALL', 'ALL'));
	for (let y = currentYear; y >= 1980; y--) {
		yearFilter.add(new Option(y, y));
	}
	yearFilter.value = 'ALL';

	let debounceTimer;
	const handleFilterChange = () => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchState.query = searchInput.value;
			searchState.season = seasonFilter.value;
			searchState.year = yearFilter.value;
			searchState.sortBy = sortFilter.value;
			triggerSearch();
		}, 300);
	};

	seasonFilter.addEventListener('change', handleFilterChange);
	yearFilter.addEventListener('change', handleFilterChange);
	sortFilter.addEventListener('change', handleFilterChange);
	searchInput.addEventListener('input', handleFilterChange);

	window.addEventListener('scroll', () => {
		if (document.getElementById('search-page').style.display !== 'block') return;
		if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500 && !searchState.isLoading && searchState.hasMore) {
			searchState.page++;
			performSearch(false);
		}
	});
}

function triggerSearch() {
	searchState.page = 1;
	searchState.hasMore = true;
	document.getElementById('results').innerHTML = '';
	performSearch(true);
}

async function performSearch(isNewSearch) {
	if (searchState.isLoading) return;
	searchState.isLoading = true;

	const {
		query,
		season,
		year,
		sortBy,
		page
	} = searchState;
	const resultsDiv = document.getElementById('results');
	if (isNewSearch) resultsDiv.innerHTML = '<p class="loading">Searching...</p>';

	try {
		const params = new URLSearchParams({
			query,
			season,
			year,
			sortBy,
			page
		});
		const response = await fetch(`/search?${params}`);
		if (!response.ok) throw new Error('Network response was not ok');
		const shows = await response.json();

		if (isNewSearch) resultsDiv.innerHTML = '';
		if (shows.length === 0) searchState.hasMore = false;

		displayGrid('results', shows, (show) => {
			showPage('player', {
				showId: show._id,
				showName: show.name,
				showThumbnail: show.thumbnail
			});
		}, item => item.name, !isNewSearch);

	} catch (error) {
		if (isNewSearch) resultsDiv.innerHTML = '<p class="error">Failed to fetch search results.</p>';
	} finally {
		searchState.isLoading = false;
	}
}

async function fetchEpisodes(showId, showName, showThumbnail, mode = 'sub', episodeToPlay = null) {
	const page = document.getElementById('player-page');
	page.innerHTML = '<div class="player-page-content"><p class="loading">Loading episodes...</p></div>';
	try {
		const [episodesResponse, watchedResponse, watchlistResponse] = await Promise.all([
			fetch(`/episodes?showId=${encodeURIComponent(showId)}&mode=${mode}`),
			fetch(`/watched-episodes/${showId}`),
			fetch(`/watchlist/check/${showId}`)
		]);

		if (!episodesResponse.ok) throw new Error('Network response was not ok');
		const {
			episodes,
			description
		} = await episodesResponse.json();
		const sortedEpisodes = episodes.sort((a, b) => parseFloat(a) - parseFloat(b));
		const watchedEpisodes = await watchedResponse.json();
		const {
			inWatchlist
		} = await watchlistResponse.json();
		displayEpisodes(sortedEpisodes, showId, showName, showThumbnail, watchedEpisodes, mode, description, inWatchlist);

		if (episodeToPlay) {
			fetchVideoLinks(showId, episodeToPlay, showName, showThumbnail, mode);
		}

	} catch (error) {
		page.innerHTML = '<div class="player-page-content"><p class="error">Failed to fetch episodes.</p></div>';
	}
}

function displayEpisodes(episodes, showId, showName, showThumbnail, watchedEpisodes, mode, description, inWatchlist) {
	const page = document.getElementById('player-page');
	page.innerHTML = `
      <div class="player-page-content">
        <div class="show-header">
            <h2>${showName}</h2>
            <div class="header-controls">
                <button id="watchlistToggleBtn" class="watchlist-toggle-button ${inWatchlist ? 'in-list' : ''}">${inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</button>
                <div class="toggle-container">
                    <span>SUB</span>
                    <label class="switch"><input type="checkbox" id="modeToggle" ${mode === 'dub' ? 'checked' : ''}><span class="slider"></span></label>
                    <span>DUB</span>
                </div>
            </div>
        </div>
        <div class="show-description">${description ? description.replace(/<br>/g, ' ').replace(/\[.*?\]/g, '') : 'No description available.'}</div>
        <div id="episode-grid-player" class="episode-grid">
            ${episodes.map(ep => `
                <div class="result-item ${watchedEpisodes.includes(ep.toString()) ? 'watched' : ''}" data-episode="${ep}">Episode ${ep}</div>
            `).join('') || `<p class="error">No ${mode.toUpperCase()} episodes found</p>`}
        </div>
      </div>
    `;

	page.querySelectorAll('.result-item').forEach(item => {
		item.addEventListener('click', () => fetchVideoLinks(showId, item.dataset.episode, showName, showThumbnail, mode));
	});

	document.getElementById('modeToggle').addEventListener('change', (e) => {
		fetchEpisodes(showId, showName, showThumbnail, e.target.checked ? 'dub' : 'sub');
	});

	const watchlistBtn = document.getElementById('watchlistToggleBtn');
	watchlistBtn.addEventListener('click', async () => {
		const isInList = watchlistBtn.classList.contains('in-list');
		const endpoint = isInList ? '/watchlist/remove' : '/watchlist/add';
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				id: showId,
				name: showName,
				thumbnail: showThumbnail,
				status: 'Watching'
			})
		});
		if (response.ok) {
			watchlistBtn.classList.toggle('in-list');
			watchlistBtn.textContent = isInList ? 'Add to Watchlist' : 'In Watchlist';
		}
	});
}

async function fetchVideoLinks(showId, episodeNumber, showName, showThumbnail, mode = 'sub') {
	const playerPageContent = document.querySelector('.player-page-content');
	if (!playerPageContent) return;

	const oldPlayer = document.getElementById('player-section-container');
	if (oldPlayer) oldPlayer.remove();

	const playerContainer = document.createElement('div');
	playerContainer.id = 'player-section-container';
	playerContainer.innerHTML = '<p class="loading">Finding video sources...</p>';
	playerPageContent.appendChild(playerContainer);

	try {
		const [sourcesResponse, settingsResponse] = await Promise.all([
			fetch(`/video?showId=${encodeURIComponent(showId)}&episodeNumber=${encodeURIComponent(episodeNumber)}&mode=${mode}`),
			fetch('/settings/preferredSource')
		]);
		if (!sourcesResponse.ok) throw new Error('Failed to fetch data');
		const sources = await sourcesResponse.json();
		const {
			value: preferredSource
		} = await settingsResponse.json();
		displayEpisodePlayer(sources, showId, episodeNumber, showName, showThumbnail, preferredSource);
	} catch (error) {
		playerContainer.innerHTML = `<p class="error">${error.message}</p>`;
	}
}

function displayEpisodePlayer(sources, showId, episodeNumber, showName, showThumbnail, preferredSource) {
	const playerSection = document.getElementById('player-section-container');
	if (!playerSection) return;

	playerSection.innerHTML = `
    <div class="show-header">
        <h3>Episode ${episodeNumber}</h3>
        <div class="player-controls">
            <div class="toggle-container">
                <label class="switch"><input type="checkbox" id="autoplayToggle"><span class="slider"></span></label>
                <span>Autoplay</span>
            </div>
        </div>
    </div>
    <div class="player-container">
      <div class="player-content">
        <video id="videoPlayer" controls></video>
        <h4>Select Source & Quality:</h4>
        <div id="source-options"></div>
      </div>
    </div>
  `;

	const sourceOptions = document.getElementById('source-options');
	if (!sources || sources.length === 0) {
		sourceOptions.innerHTML = '<p class="error">No video sources found.</p>';
		return;
	}
	let autoPlayed = false;
	sources.forEach(source => {
		const container = document.createElement('div');
		container.className = 'source-container';
		const title = document.createElement('h4');
		title.textContent = source.sourceName;
		container.appendChild(title);
		const sortedLinks = [...source.links].sort((a, b) => (parseInt(b.resolutionStr) || 0) - (parseInt(a.resolutionStr) || 0));
		const englishSub = source.subtitles?.find(s => s.lang === 'en' || s.label === 'English');
		const playButton = document.createElement('button');
		playButton.className = 'quality-button';
		playButton.id = `play-btn-${source.sourceName.replace(/\s+/g, '-')}`;
		if (sortedLinks.length > 1) {
			const select = document.createElement('select');
			select.className = 'quality-select';
			sortedLinks.forEach(link => {
				const option = document.createElement('option');
				option.value = JSON.stringify(link);
				option.textContent = link.resolutionStr || 'Default';
				select.appendChild(option);
			});
			playButton.textContent = 'Play';
			playButton.onclick = () => {
				const linkInfo = JSON.parse(select.value);
				playVideo(source.sourceName, linkInfo, englishSub);
				markEpisodeWatched(showId, episodeNumber, showName, showThumbnail);
			};
			container.appendChild(select);
		} else if (sortedLinks.length === 1) {
			const linkInfo = sortedLinks[0];
			playButton.textContent = `Play (${linkInfo.resolutionStr || 'Default'})`;
			playButton.onclick = () => {
				playVideo(source.sourceName, linkInfo, englishSub);
				markEpisodeWatched(showId, episodeNumber, showName, showThumbnail);
			};
		}
		container.appendChild(playButton);
		sourceOptions.appendChild(container);
		if (preferredSource && source.sourceName === preferredSource && !autoPlayed) {
			playButton.click();
			autoPlayed = true;
		}
	});

	const autoplayToggle = document.getElementById('autoplayToggle');
	autoplayToggle.checked = localStorage.getItem('autoplayEnabled') === 'true';
	autoplayToggle.addEventListener('change', (e) => localStorage.setItem('autoplayEnabled', e.target.checked));

	document.getElementById('videoPlayer').addEventListener('ended', () => {
		if (autoplayToggle.checked) {
			const allEpItems = [...document.querySelectorAll('#episode-grid-player .result-item')];
			const currentEpItem = document.querySelector(`#episode-grid-player .result-item[data-episode='${episodeNumber}']`);
			const currentIndex = allEpItems.indexOf(currentEpItem);
			if (currentIndex > -1 && currentIndex < allEpItems.length - 1) {
				allEpItems[currentIndex + 1].click();
			}
		}
	});
}

async function setPreferredSource(sourceName) {
	try {
		await fetch('/settings', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				key: 'preferredSource',
				value: sourceName
			}),
		});
	} catch (error) {}
}

function playVideo(sourceName, linkInfo, subtitleInfo) {
	if (currentHlsInstance) {
		currentHlsInstance.destroy();
		currentHlsInstance = null;
	}
	if (!linkInfo || !linkInfo.link) {
		return;
	}

	const videoElement = document.getElementById('videoPlayer');
	if (!videoElement) return;

	setPreferredSource(sourceName);

	videoElement.innerHTML = '';
	videoElement.controls = true;
	videoElement.autoplay = true;
	videoElement.crossOrigin = 'anonymous';
	if (subtitleInfo?.src) {
		const track = document.createElement('track');
		track.kind = 'subtitles';
		track.label = subtitleInfo.label || 'English';
		track.srclang = subtitleInfo.lang || 'en';
		track.src = `/subtitle-proxy?url=${encodeURIComponent(subtitleInfo.src)}`;
		track.default = true;
		videoElement.appendChild(track);
	}
	let proxiedUrl = `/proxy?url=${encodeURIComponent(linkInfo.link)}`;
	if (linkInfo.headers?.Referer) {
		proxiedUrl += `&referer=${encodeURIComponent(linkInfo.headers.Referer)}`;
	}
	if (linkInfo.hls && Hls.isSupported()) {
		const hls = new Hls();
		hls.loadSource(proxiedUrl);
		hls.attachMedia(videoElement);
		hls.on(Hls.Events.ERROR, (event, data) => {});
		currentHlsInstance = hls;
	} else {
		videoElement.src = proxiedUrl;
		videoElement.play().catch(e => {});
	}
}

function displayGrid(containerId, items, onClick, titleFn = item => item.name, append = false) {
	const container = document.getElementById(containerId);
	if (!append) container.innerHTML = '';
	if (items.length > 0) {
		items.forEach(item => {
			const div = document.createElement('div');
			div.className = 'grid-item';
			div.setAttribute('data-raw-thumbnail', item.thumbnail || '');
			const totalEpisodes = Math.max(item.availableEpisodesDetail?.sub?.length || 0, item.availableEpisodesDetail?.dub?.length || 0);
			div.innerHTML = `
        <div class="card-ep-count"><i class="icon-cc"></i> ${totalEpisodes}</div>
        <img src="${fixThumbnailUrl(item.thumbnail)}" alt="${titleFn(item)}" loading="lazy" onerror="this.src='/placeholder.png'; this.className='image-fallback';">
        <p>${titleFn(item)}</p>
      `;
			div.addEventListener('click', () => onClick(item));
			container.appendChild(div);
		});
	} else if (!append) {
		container.innerHTML = '<p class="error">No items found.</p>';
	}
}

async function markEpisodeWatched(showId, episodeNumber, showName, showThumbnail) {
	try {
		await fetch('/watched-episode', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				showId,
				episodeNumber,
				showName,
				showThumbnail
			})
		});
		const epItem = document.querySelector(`#episode-grid-player .result-item[data-episode='${episodeNumber}']`);
		if (epItem) epItem.classList.add('watched');
	} catch (error) {}
}