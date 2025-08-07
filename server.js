const express = require('express');
const axios = require('axios');
const { parseString } = require('xml2js');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(cors());

// Ensure user identity hints are available to ALL routes
app.use((req, res, next) => {
  const h = req.headers || {};
  const val = (k) => h[k] ?? h[k?.toLowerCase?.()] ?? h[k?.toUpperCase?.()];
  const uid = val('x-user-id');
  if (uid) req.userId = uid;
  req.userEmail = val('x-user-email') || null;
  req.userName = val('x-user-name') || null;
  next();
});

// Force port 3001 regardless of environment variable (as requested)
const port = 3001;
const apiCache = new NodeCache({ stdTTL: 3600 });

// Initialize SQLite database
const db = new sqlite3.Database('./anime.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database');
        // Create users table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT,
            displayName TEXT,
            photoURL TEXT,
            createdAt INTEGER
        )`);

        // Ensure users table has photoURL column (migrate older DBs without it)
        db.get("PRAGMA table_info(users)", (e, row) => {
            // no-op; use separate pragma to check columns
        });
        db.all("PRAGMA table_info(users)", (err, columns) => {
            if (err) {
                console.error('Error reading users table schema:', err);
                return;
            }
            const hasPhotoURL = Array.isArray(columns) && columns.some(c => c.name === 'photoURL');
            if (!hasPhotoURL) {
                db.run("ALTER TABLE users ADD COLUMN photoURL TEXT", (alterErr) => {
                    if (alterErr) {
                        console.error('Failed to add photoURL column to users table:', alterErr);
                    } else {
                        console.log('Added photoURL column to users table.');
                    }
                });
            }
        });
    }
});

// Use local directory for profile pictures
const profilePicsDir = path.join(__dirname, 'public', 'profile_pics');

if (!fs.existsSync(profilePicsDir)) {
    fs.mkdirSync(profilePicsDir, { recursive: true });
}

// Add endpoint for profile picture uploads
const multer = require('multer');
// Move auth header extractor BEFORE routes to ensure req.userId is available
// (Place middleware registration near top before routes)

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.get('/favicon.ico', (req, res) => res.status(204).send());

// API endpoint to get user profile from SQLite
app.get('/api/user-profile', (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [req.userId], (err, user) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).json({ error: 'Failed to fetch user profile' });
        }

        if (!user) {
            // Create minimal row so Edit Profile works and persists avatar on refresh
            const email = req.userEmail || null;
            const displayName = req.userName || (email ? email.split('@')[0] : null) || null;
            const photoURL = '/profile_pics/default.png';
            db.run(
                'INSERT INTO users (id, email, displayName, photoURL, createdAt) VALUES (?, ?, ?, ?, ?)',
                [req.userId, email, displayName, photoURL, Date.now()],
                function(insertErr) {
                    if (insertErr) {
                        console.error('Error auto-creating user profile:', insertErr);
                        return res.status(500).json({ error: 'Failed to create user profile' });
                    }
                    return res.json({ id: req.userId, email, displayName, photoURL, createdAt: Date.now() });
                }
            );
            return;
        }

        res.json(user);
    });
});

// API endpoint to update user profile in SQLite
app.post('/api/update-profile', (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { displayName, email } = req.body || {};
    
    if (!displayName) {
        return res.status(400).json({ error: 'Display name is required' });
    }
    
    db.run(
        'UPDATE users SET displayName = ?, email = ? WHERE id = ?',
        [displayName, email, req.userId],
        function(err) {
            if (err) {
                console.error('Error updating user profile:', err);
                return res.status(500).json({ error: 'Failed to update profile' });
            }
            
            if (this.changes === 0) {
                // User doesn't exist, create a new record
                db.run(
                    'INSERT INTO users (id, displayName, email, createdAt, photoURL) VALUES (?, ?, ?, ?, ?)',
                    [req.userId, displayName, email, Date.now(), '/profile_pics/default.png'],
                    function(err) {
                        if (err) {
                            console.error('Error creating user profile:', err);
                            return res.status(500).json({ error: 'Failed to create profile' });
                        }
                        res.json({ success: true });
                    }
                );
            } else {
                res.json({ success: true });
            }
        }
    );
});

// New: update only photoURL (used to sync header avatar from Firebase value on refresh)
app.post('/api/update-profile-photo', (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { photoURL } = req.body || {};
    if (!photoURL || typeof photoURL !== 'string') {
        return res.status(400).json({ error: 'photoURL required' });
    }
    db.run('UPDATE users SET photoURL = ? WHERE id = ?', [photoURL, req.userId], function(err) {
        if (err) {
            console.error('Error updating photoURL:', err);
            return res.status(500).json({ error: 'Failed to update photo' });
        }
        if (this.changes === 0) {
            const email = null;
            const displayName = null;
            db.run(
                'INSERT INTO users (id, email, displayName, photoURL, createdAt) VALUES (?, ?, ?, ?, ?)',
                [req.userId, email, displayName, photoURL, Date.now()],
                function(insertErr) {
                    if (insertErr) {
                        console.error('Error creating user for photo:', insertErr);
                        return res.status(500).json({ error: 'Failed to create user' });
                    }
                    return res.json({ success: true });
                }
            );
        } else {
            return res.json({ success: true });
        }
    });
});

// (auth header middleware moved earlier)

// Configure multer with memory storage and enforce MIME validation + safe extension
const memoryUpload = multer({
   storage: multer.memoryStorage(),
   limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Secure avatar upload endpoint with validation and deterministic filenames
app.post('/api/upload-profile-pic', memoryUpload.single('file'), (req, res) => {
   try {
       const uid = req.userId || (req.body && req.body.uid);
       if (!uid) return res.status(401).json({ error: 'Unauthorized' });
       if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

       const mime = req.file.mimetype || '';
       const allowed = ['image/png', 'image/jpeg', 'image/gif'];
       if (!allowed.includes(mime)) {
           return res.status(400).json({ error: 'Unsupported image type' });
       }

       const guessedExt = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'gif';
       const providedExt = (req.body?.ext || '').toLowerCase();
       const safeExt = ['jpg', 'jpeg', 'png', 'gif'].includes(providedExt) ? providedExt.replace('jpeg', 'jpg') : guessedExt;

       const fileName = `${uid}.${safeExt}`;
       const outPath = path.join(profilePicsDir, fileName);
       fs.writeFileSync(outPath, req.file.buffer);

       const fileUrl = `/profile_pics/${fileName}`;

       // Try update first, fallback to insert with available metadata
       db.run(
           'UPDATE users SET photoURL = ? WHERE id = ?',
           [fileUrl, uid],
           function(err) {
               if (err) {
                   console.error('Error updating user profile in database:', err);
                   return res.status(500).json({ error: 'Failed to update profile in database' });
               }
               if (this.changes === 0) {
                   const email = req.userEmail || null;
                   const displayName = req.userName || (email ? email.split('@')[0] : null) || null;
                   db.run(
                       'INSERT INTO users (id, email, displayName, photoURL, createdAt) VALUES (?, ?, ?, ?, ?)',
                       [uid, email, displayName, fileUrl, Date.now()],
                       function(insertErr) {
                           if (insertErr) {
                               console.error('Error creating user profile in database:', insertErr);
                               return res.status(500).json({ error: 'Failed to create profile in database' });
                           }
                           return res.json({ url: fileUrl });
                       }
                   );
               } else {
                   return res.json({ url: fileUrl });
               }
           }
       );
   } catch (e) {
       console.error('Upload avatar error:', e);
       return res.status(500).json({ error: 'Upload failed' });
   }
});

// Optional: endpoint to retrieve avatar URL for a given uid
app.get('/api/users/:uid/avatar', (req, res) => {
   db.get('SELECT photoURL FROM users WHERE id = ?', [req.params.uid], (err, row) => {
       if (err) {
           console.error('SQLite read error:', err);
           return res.status(500).json({ error: 'Database error' });
       }
       if (!row) return res.status(404).json({ error: 'Not found' });
       return res.json({ photoURL: row.photoURL });
   });
});

// Add root route handler to serve index.html
app.get('/', (req, res) => {
  // Set the root directory for serving static files
  const rootDir = __dirname;
  res.sendFile(path.join(rootDir, 'public', 'index.html'));
});
const apiBaseUrl = 'https://allanime.day';
const apiEndpoint = `https://api.allanime.day/api`;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0';
const referer = 'https://allmanga.to';
const DEOBFUSCATION_MAP = {
    '79': 'A', '7a': 'B', '7b': 'C', '7c': 'D', '7d': 'E', '7e': 'F', '7f': 'G',
    '70': 'H', '71': 'I', '72': 'J', '73': 'K', '74': 'L', '75': 'M', '76': 'N',
    '77': 'O', '68': 'P', '69': 'Q', '6a': 'R', '6b': 'S', '6c': 'T', '6d': 'U',
    '6e': 'V', '6f': 'W', '60': 'X', '61': 'Y', '62': 'Z', '59': 'a', '5a': 'b',
    '5b': 'c', '5c': 'd', '5d': 'e', '5e': 'f', '5f': 'g', '50': 'h', '51': 'i',
    '52': 'j', '53': 'k', '54': 'l', '55': 'm', '56': 'n', '57': 'o', '48': 'p',
    '49': 'q', '4a': 'r', '4b': 's', '4c': 't', '4d': 'u', '4e': 'v', '4f': 'w',
    '40': 'x', '41': 'y', '42': 'z', '08': '0', '09': '1', '0a': '2', '0b': '3',
    '0c': '4', '0d': '5', '0e': '6', '0f': '7', '00': '8', '01': '9', '15': '-',
    '16': '.', '67': '_', '46': '~', '02': ':', '17': '/', '07': '?', '1b': '#',
    '63': '[', '65': ']', '78': '@', '19': '!', '1c': '$', '1e': '&', '10': '(',
    '11': ')', '12': '*', '13': '+', '14': ',', '03': ';', '05': '=', '1d': '%'
};
function deobfuscateUrl(obfuscatedUrl) {
    if (!obfuscatedUrl) return '';
    if (!obfuscatedUrl.startsWith('--') && obfuscatedUrl.includes('s4.anilist.co')) {
        return obfuscatedUrl.replace('https://s4.anilist.co', 'https://wp.youtube-anime.com/s4.anilist.co');
    }
    if (obfuscatedUrl.startsWith('--')) {
        obfuscatedUrl = obfuscatedUrl.slice(2);
        let deobfuscated = '';
        for (let i = 0; i < obfuscatedUrl.length; i += 2) {
            const chunk = obfuscatedUrl.substring(i, i + 2);
            deobfuscated += DEOBFUSCATION_MAP[chunk] || chunk;
        }
        if (deobfuscated.startsWith('/')) {
            return `https://wp.youtube-anime.com${deobfuscated}`;
        }
        return deobfuscated;
    }
    return obfuscatedUrl;
}

async function streamToString(stream) {
    if (!stream || typeof stream.pipe !== 'function') return stream;
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
}

const showsQuery = `
query ($search: SearchInput, $limit: Int, $page: Int, $translationType: VaildTranslationTypeEnumType, $countryOrigin: VaildCountryOriginEnumType) {
  shows(search: $search, limit: $limit, page: $page, translationType: $translationType, countryOrigin: $countryOrigin) {
    edges {
      _id
      name
      thumbnail
      description
      type
      availableEpisodesDetail
    }
  }
}
`;
async function fetchAndSendShows(res, variables, cacheKey) {
    if (cacheKey && apiCache.has(cacheKey)) {
        return res.json(apiCache.get(cacheKey));
    }
    try {
        const response = await axios.get(apiEndpoint, {
            headers: { 'User-Agent': userAgent, 'Referer': referer },
            params: { query: showsQuery, variables: JSON.stringify(variables) },
            timeout: 15000
        });
        const shows = response.data?.data?.shows?.edges || [];
        const transformedShows = shows.map(show => ({
            ...show,
            thumbnail: deobfuscateUrl(show.thumbnail || '')
        }));
        if (cacheKey) {
            apiCache.set(cacheKey, transformedShows);
        }
        res.json(transformedShows);
    } catch (error) {
        console.error('Error fetching data:', error.message);
        res.status(500).send('Error fetching data');
    }
}
const popularQueryHash = "1fc9651b0d4c3b9dfd2fa6e1d50b8f4d11ce37f988c23b8ee20f82159f7c1147";
app.get('/popular/:timeframe', async (req, res) => {
    const timeframe = req.params.timeframe.toLowerCase();
    const cacheKey = `popular-${timeframe}`;
    if (apiCache.has(cacheKey)) {
        return res.json(apiCache.get(cacheKey));
    }
    let dateRange;
    switch (timeframe) {
        case 'daily': dateRange = 1; break;
        case 'weekly': dateRange = 7; break;
        case 'monthly': dateRange = 30; break;
        case 'all': dateRange = 0; break;
        default: return res.status(400).send('Invalid timeframe.');
    }
    const variables = { type: "anime", size: 10, page: 1, allowAdult: false, allowUnknown: false, dateRange: dateRange };
    const extensions = { persistedQuery: { version: 1, sha256Hash: popularQueryHash } };
    try {
        const response = await axios.get(apiEndpoint, {
            headers: { 'User-Agent': userAgent, 'Referer': referer },
            params: { variables: JSON.stringify(variables), extensions: JSON.stringify(extensions) },
            timeout: 15000
        });
        const recommendations = response.data?.data?.queryPopular?.recommendations || [];
        const shows = recommendations.map(rec => {
            const card = rec.anyCard;
            return { ...card, thumbnail: deobfuscateUrl(card.thumbnail || '') };
        });
        apiCache.set(cacheKey, shows);
        res.json(shows);
    } catch (error) {
        console.error('Error fetching popular data:', error.response ? error.response.data : error.message);
        res.status(500).send('Error fetching popular data');
    }
});
app.get('/latest-releases', (req, res) => {
    const variables = { search: { sortBy: 'Latest_Update', allowAdult: false }, limit: 10, page: 1, translationType: 'sub', countryOrigin: 'JP' };
    const cacheKey = 'latest-releases';
    fetchAndSendShows(res, variables, cacheKey);
});
function getCurrentAnimeSeason() {
	const month = new Date().getMonth();
	if (month >= 0 && month <= 2) return "Winter";
	if (month >= 3 && month <= 5) return "Spring";
	if (month >= 6 && month <= 8) return "Summer";
	return "Fall";
}
app.get('/seasonal', (req, res) => {
	const season = getCurrentAnimeSeason();
	const year = new Date().getFullYear();
    const page = parseInt(req.query.page) || 1;
	const variables = { search: { year, season, sortBy: "Latest_Update", allowAdult: false }, limit: 25, page: page, translationType: "sub", countryOrigin: "JP" };
    const cacheKey = `seasonal-${season}-${year}-p${page}`;
	fetchAndSendShows(res, variables, cacheKey);
});
app.get('/search', (req, res) => {
    const { query, season, year, sortBy, page, type, country, translation } = req.query;
    const searchObj = { allowAdult: false };
    if (query) searchObj.query = query;
    if (season && season !== 'ALL') searchObj.season = season;
    if (year && year !== 'ALL') searchObj.year = parseInt(year);
    if (sortBy) searchObj.sortBy = sortBy;
    if (type && type !== 'ALL') searchObj.types = [type];
    const variables = { search: searchObj, limit: 28, page: parseInt(page) || 1, translationType: (translation && translation !== 'ALL') ? translation : 'sub', countryOrigin: (country && country !== 'ALL') ? country : 'ALL' };
    fetchAndSendShows(res, variables, null);
});
app.get('/schedule/:date', (req, res) => {
    const dateStr = req.params.date;
    const cacheKey = `schedule-${dateStr}`;
    if (apiCache.has(cacheKey)) {
        return res.json(apiCache.get(cacheKey));
    }
    const requestedDate = new Date(dateStr + 'T00:00:00.000Z');
    if (isNaN(requestedDate)) {
        return res.status(400).send('Invalid date format. Use YYYY-MM-DD.');
    }
    const startOfDay = new Date(requestedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(requestedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const variables = { search: { dateRangeStart: Math.floor(startOfDay.getTime() / 1000), dateRangeEnd: Math.floor(endOfDay.getTime() / 1000), sortBy: "Latest_Update" }, limit: 50, page: 1, translationType: "sub", countryOrigin: "ALL" };
    fetchAndSendShows(res, variables, cacheKey);
});
app.get('/show-meta/:id', async (req, res) => {
    const showId = req.params.id;
    const cacheKey = `show-meta-${showId}`;
    if (apiCache.has(cacheKey)) {
        return res.json(apiCache.get(cacheKey));
    }
    try {
        const response = await axios.get(apiEndpoint, {
            headers: { 'User-Agent': userAgent, 'Referer': referer },
            params: { query: `query($showId: String!) { show(_id: $showId) { name, thumbnail } }`, variables: JSON.stringify({ showId }) },
            timeout: 15000
        });
        const show = response.data.data.show;
        if (show) {
            const meta = { name: show.name, thumbnail: deobfuscateUrl(show.thumbnail) };
            apiCache.set(cacheKey, meta);
            res.json(meta);
        } else {
            res.status(404).json({ error: 'Show not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch show metadata' });
    }
});
app.get('/episodes', async (req, res) => {
    const { showId, mode = 'sub' } = req.query;
    const cacheKey = `episodes-${showId}-${mode}`;
    if (apiCache.has(cacheKey)) {
        return res.json(apiCache.get(cacheKey));
    }
    try {
        const response = await axios.get(apiEndpoint, {
            headers: { 'User-Agent': userAgent, 'Referer': referer },
            params: { query: `query($showId: String!) { show(_id: $showId) { availableEpisodesDetail, description } }`, variables: JSON.stringify({ showId }) },
            timeout: 15000
        });
        const showData = response.data.data.show;
        const result = { episodes: showData.availableEpisodesDetail[mode] || [], description: showData.description };
        apiCache.set(cacheKey, result);
        res.json(result);
    } catch (error) {
        res.status(500).send('Error fetching episodes from API');
    }
});

app.get('/video', async (req, res) => {
	const { showId, episodeNumber, mode = 'sub' } = req.query;
	
	// Validate required parameters
	if (!showId || !episodeNumber) {
		return res.status(400).json({ error: 'Missing required parameters: showId and episodeNumber are required' });
	}
	
	const cacheKey = `video-${showId}-${episodeNumber}-${mode}`;
	
	if (apiCache.has(cacheKey)) {
		console.log(`Serving cached video sources for ${showId} episode ${episodeNumber}`);
		return res.json(apiCache.get(cacheKey));
	}

	const graphqlQuery = `query($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) { episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) { sourceUrls } }`;
	try {
		console.log(`Fetching video sources for ${showId} episode ${episodeNumber} mode ${mode}`);
		const { data } = await axios.get(apiEndpoint, {
			headers: { 'User-Agent': userAgent, 'Referer': referer },
			params: { query: graphqlQuery, variables: JSON.stringify({ showId, translationType: mode, episodeString: episodeNumber }) },
			timeout: 15000
		});

		// Check if we have valid data
		if (!data || !data.data || !data.data.episode || !data.data.episode.sourceUrls) {
			console.error(`Invalid response structure for ${showId} episode ${episodeNumber}`);
			return res.status(500).json({ error: 'Invalid API response structure' });
		}

		const sources = data.data.episode.sourceUrls.filter(s => s.sourceUrl.startsWith('--')).sort((a, b) => b.priority - a.priority);
		
		if (sources.length === 0) {
			console.error(`No sources found for ${showId} episode ${episodeNumber}`);
			return res.status(404).json({ error: 'No video sources found' });
		}
		
		const trustedSources = ['Default', 'wixmp', 'Yt-mp4', 'S-mp4', 'Luf-Mp4'];

        const sourcePromises = sources.map(source => (async () => {
            if (!trustedSources.includes(source.sourceName) && source.sourceName !== 'wixmp' /*wixmp is the Default source*/) {
                return null;
            }

            try {
                let decryptedUrl = (s => {
					const m = DEOBFUSCATION_MAP;
					let d = '';
					for (let i = 0; i < s.length; i += 2) d += m[s.substring(i, i + 2)] || s.substring(i, i + 2);
					return d.includes('/clock') && !d.includes('.json') ? d.replace('/clock', '/clock.json') : d;
				})(source.sourceUrl.substring(2)).replace(/([^:]\/)\/+/g, "$1");

				let videoLinks = [];
				let subtitles = [];
				if (decryptedUrl.includes('/clock.json')) {
					const finalUrl = new URL(decryptedUrl, apiBaseUrl).href;
					try {
						const { data: clockData } = await axios.get(finalUrl, {
							headers: { 'Referer': referer, 'User-Agent': userAgent },
							timeout: 10000
						});
						if (clockData.links && clockData.links.length > 0) {
							videoLinks = clockData.links[0].hls ? await (async (u, h) => {
								try {
									const { data: d } = await axios.get(u, { headers: h, timeout: 10000 });
									const l = d.split('\n'), q = [];
									for (let i = 0; i < l.length; i++)
										if (l[i].startsWith('#EXT-X-STREAM-INF')) {
											const rM = l[i].match(/RESOLUTION=\d+x(\d+)/);
											q.push({ resolutionStr: rM ? `${rM[1]}p` : 'Auto', link: new URL(l[i + 1], u).href, hls: true, headers: h });
										} return q.length > 0 ? q : [{ resolutionStr: 'auto', link: u, hls: true, headers: h }];
								} catch (e) { 
									console.error(`Error parsing HLS manifest: ${e.message}`);
									return []; 
								}
							})(clockData.links[0].link, clockData.links[0].headers) : clockData.links;
							subtitles = clockData.links[0].subtitles || [];
						}
					} catch (clockError) {
						console.error(`Error fetching clock data: ${clockError.message}`);
						// Continue to try other sources
					}
                } else if (decryptedUrl.includes('repackager.wixmp.com')) {
                    const urlTemplate = decryptedUrl.replace('repackager.wixmp.com/', '').replace(/\.urlset.*/, '');
                    const qualitiesMatch = decryptedUrl.match(/\/,\s*([^/]*),\s*\/mp4/);
                    if (qualitiesMatch && qualitiesMatch[1]) {
                        const qualities = qualitiesMatch[1].split(',');
                        videoLinks = qualities.map(q => ({
                            resolutionStr: q,
                            link: urlTemplate.replace(/,\s*[^/]*$/, q),
                            hls: false
                        })).sort((a,b) => parseInt(b.resolutionStr) - parseInt(a.resolutionStr));
                    }
				}	else {
						let finalLink = decryptedUrl;
						
						if (finalLink.startsWith('/')) {
							finalLink = new URL(finalLink, apiBaseUrl).href;
						}
						videoLinks.push({ link: finalLink, resolutionStr: 'default', hls: finalLink.includes('.m3u8'), headers: { Referer: referer } });
					}
				if (videoLinks.length > 0) {
					return { sourceName: source.sourceName, links: videoLinks, subtitles };
				}
                return null;
			} catch (e) {
				console.error(`Error processing source ${source.sourceName}: ${e.message}`);
                return null;
            }
        })());

        const results = await Promise.allSettled(sourcePromises);
        const availableSources = results
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => result.value);

		if (availableSources.length > 0) {
            console.log(`Found ${availableSources.length} playable sources for ${showId} episode ${episodeNumber}`);
            apiCache.set(cacheKey, availableSources, 300);
            res.json(availableSources);
        } else {
            console.error(`No playable video URLs found for ${showId} episode ${episodeNumber}`);
            res.status(404).json({ error: 'No playable video URLs found' });
        }
	} catch (e) {
		console.error(`Error fetching video data for ${showId} episode ${episodeNumber}: ${e.message}`);
		res.status(500).json({ error: `Error fetching video data: ${e.message}` });
	}
});

app.get('/image-proxy', async (req, res) => {
    try {
        const { data, headers } = await axios({
            method: 'get',
            url: req.query.url,
            responseType: 'stream',
            headers: { Referer: apiBaseUrl, 'User-Agent': userAgent },
            timeout: 10000
        });
        res.set('Cache-Control', 'public, max-age=604800, immutable');
        res.set('Content-Type', headers['content-type']);
        data.pipe(res);
    } catch (e) {
        // Use local path for placeholder image
        const placeholderPath = path.join(__dirname, 'public', 'placeholder.png');
        res.status(500).sendFile(placeholderPath);
    }
});

app.get('/proxy', async (req, res) => {
    const requestId = crypto.randomBytes(4).toString('hex');
    //console.log(`\n--- [${requestId}] /proxy: NEW REQUEST ---`);
    //console.log(`[${requestId}] /proxy: Request URL: ${req.originalUrl}`);
    //console.log(`[${requestId}] /proxy: Client Request Headers:`, JSON.stringify(req.headers, null, 2));

    const { url, referer: dynamicReferer } = req.query;
    
    // Validate required parameters
    if (!url) {
        return res.status(400).json({ 
            error: 'Missing URL parameter', 
            details: 'The url parameter is required for proxy requests' 
        });
    }
    
    try {
        // Validate URL format
        try {
            new URL(url);
        } catch (urlError) {
            return res.status(400).json({ 
                error: 'Invalid URL format', 
                details: urlError.message 
            });
        }
        
        const headers = { 
            'User-Agent': userAgent, 
            'Accept': '*/*',
            // --- CHANGE: Added keep-alive for connection stability ---
            'Connection': 'keep-alive'
        };
        if (dynamicReferer) headers['Referer'] = dynamicReferer;

        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        //console.log(`[${requestId}] /proxy: Fetching remote URL: ${url}`);
        //console.log(`[${requestId}] /proxy: Sending Headers to Remote:`, JSON.stringify(headers, null, 2));

        if (url.includes('.m3u8')) {
            try {
                const response = await axios.get(url, { headers, responseType: 'text', timeout: 15000 });
                
                console.log(`[${requestId}] /proxy: m3u8 remote response status: ${response.status}`);
                
                const baseUrl = new URL(url);
                const rewritten = response.data.split('\n').map(l =>
                    (l.trim().length > 0 && !l.startsWith('#'))
                        ? `/proxy?url=${encodeURIComponent(new URL(l, baseUrl).href)}&referer=${encodeURIComponent(dynamicReferer || referer)}`
                        : l
                ).join('\n');
                res.set('Content-Type', 'application/vnd.apple.mpegurl').send(rewritten);
                //console.log(`[${requestId}] /proxy: Finished processing m3u8.`);
            } catch (m3u8Error) {
                console.error(`[${requestId}] /proxy: Error processing m3u8:`, m3u8Error);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Failed to process m3u8 playlist',
                        details: m3u8Error.message
                    });
                }
            }
        } else {
            try {
                const streamResponse = await axios({ 
                    method: 'get', 
                    url, 
                    responseType: 'stream', 
                    headers, 
                    timeout: 20000 
                });

                //console.log(`[${requestId}] /proxy: Video chunk remote response status: ${streamResponse.status}`);
                
                res.status(streamResponse.status);
                res.set(streamResponse.headers);
                
                // --- CHANGE: Added listeners to the client connection to handle aborts gracefully ---
                req.on('close', () => {
                    //console.log(`[${requestId}] /proxy: Client closed connection. Aborting remote request.`);
                    streamResponse.data.destroy();
                });

                streamResponse.data.pipe(res);

                streamResponse.data.on('error', (err) => {
                    // Ignore ECONNRESET, as it's the expected error when the client aborts a request.
                    if (err.code !== 'ECONNRESET') {
                        console.error(`[${requestId}] /proxy: Error on remote stream:`, err);
                    }
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: 'Error during streaming from remote',
                            details: err.message
                        });
                    }
                    res.end();
                });

                streamResponse.data.on('end', () => {
                    //console.log(`[${requestId}] /proxy: Remote stream finished successfully.`);
                });
            } catch (streamError) {
                console.error(`[${requestId}] /proxy: Error setting up stream:`, streamError);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Failed to set up video stream',
                        details: streamError.message
                    });
                }
            }
        }
    } catch (e) {
        console.error(`[${requestId}] /proxy: Error processing request:`, e);
        
        if (e.response) {
            //console.error(`[${requestId}] /proxy: AXIOS ERROR for ${url}: Status ${e.response.status}`);
            //console.error(`[${requestId}] /proxy: AXIOS ERROR Headers:`, JSON.stringify(e.response.headers, null, 2));
            const errorBody = await streamToString(e.response.data).catch(() => 'Could not read error stream.');
            //console.error(`[${requestId}] /proxy: AXIOS ERROR Data:`, errorBody);
            if (!res.headersSent) {
                res.status(e.response.status).json({
                    error: 'Remote server error',
                    status: e.response.status,
                    details: e.message
                });
            }
        } else if (e.request) {
            //console.error(`[${requestId}] /proxy: AXIOS NETWORK ERROR for ${url}: No response received.`, e.message);
            if (!res.headersSent) {
                res.status(504).json({
                    error: 'Gateway timeout',
                    details: 'No response received from remote server'
                });
            }
        } else {
            //console.error(`[${requestId}] /proxy: UNKNOWN ERROR for ${url}: ${e.message}`);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Proxy error',
                    details: e.message
                });
            }
        }
        
        if (res.writable && !res.headersSent) {
           // Error response already sent
        } else if (res.writable) {
           res.end();
        }
    }
});

app.get('/subtitle-proxy', async (req, res) => {
    const { url } = req.query;
    
    // Validate required parameters
    if (!url) {
        return res.status(400).json({ 
            error: 'Missing URL parameter', 
            details: 'The url parameter is required for subtitle proxy requests' 
        });
    }
    
    try {
        // Validate URL format
        try {
            new URL(url);
        } catch (urlError) {
            return res.status(400).json({ 
                error: 'Invalid URL format', 
                details: urlError.message 
            });
        }
        
        const response = await axios.get(url, { responseType: 'text', timeout: 10000 });
        res.set('Content-Type', 'text/vtt; charset=utf-8').send(response.data);
    } catch (error) {
        console.error('Error fetching subtitle:', error);
        
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            res.status(error.response.status).json({
                error: 'Remote server error',
                status: error.response.status,
                details: error.message
            });
        } else if (error.request) {
            // The request was made but no response was received
            res.status(504).json({
                error: 'Gateway timeout',
                details: 'No response received from subtitle server'
            });
        } else {
            // Something happened in setting up the request that triggered an Error
            res.status(500).json({
                error: 'Subtitle proxy error',
                details: error.message
            });
        }
    }
});




app.get('/schedule-info/:showId', async (req, res) => {
    const { showId } = req.params;
    const cacheKey = `schedule-info-${showId}`;
    if (apiCache.has(cacheKey)) {
        return res.json(apiCache.get(cacheKey));
    }

    try {
        const metaQuery = `query($showId: String!) { show(_id: $showId) { name } }`;
        const metaResponse = await axios.get(apiEndpoint, {
            headers: { 'User-Agent': userAgent, 'Referer': referer },
            params: { query: metaQuery, variables: JSON.stringify({ showId }) },
            timeout: 10000
        });
        const showName = metaResponse.data?.data?.show?.name;

        if (!showName) {
            return res.status(404).json({ error: 'Show not found' });
        }

        const scheduleSearchUrl = `https://animeschedule.net/api/v3/anime?q=${encodeURIComponent(showName)}`;
        const scheduleResponse = await axios.get(scheduleSearchUrl, { timeout: 10000 });
        
        const firstResult = scheduleResponse.data?.anime?.[0];
        
        if (firstResult && firstResult.route) {
            const status = firstResult.status || "Unknown";
            let nextEpisodeAirDate = null;

            if (status === 'Ongoing') {
                const pageResponse = await axios.get(`https://animeschedule.net/anime/${firstResult.route}`, { timeout: 10000 });
                const countdownMatch = pageResponse.data.match(/countdown-time" datetime="([^"]*)"/);
                if (countdownMatch) {
                    nextEpisodeAirDate = countdownMatch[1];
                }
            }

            const result = {
                nextEpisodeAirDate: nextEpisodeAirDate,
                status: status.replace(/([A-Z])/g, ' $1').trim()
            };

            apiCache.set(cacheKey, result, 3600);
            return res.json(result);
        }

        return res.json({ status: "Not Found on Schedule" });

    } catch (error) {
        // --- CHANGE: Added .catch() to prevent unhandled promise rejection from logs ---
        //console.error("Error fetching schedule info:", error.message);
        return res.json({ status: "Error" });
    }
});
















app.get('/skip-times/:showId/:episodeNumber', async (req, res) => {
    const { showId, episodeNumber } = req.params;
    const cacheKey = `skip-${showId}-${episodeNumber}`;
    const notFoundResponse = { found: false, results: [] };

    if (apiCache.has(cacheKey)) {
        return res.json(apiCache.get(cacheKey));
    }

    try {
        const malIdQuery = `query($showId: String!) { show(_id: $showId) { malId } }`;
        const malIdResponse = await axios.get(apiEndpoint, {
            headers: { 'User-Agent': userAgent, 'Referer': referer },
            params: { query: malIdQuery, variables: JSON.stringify({ showId }) },
            timeout: 10000
        });

        const malId = malIdResponse.data?.data?.show?.malId;

        if (!malId) {
            apiCache.set(cacheKey, notFoundResponse);
            return res.json(notFoundResponse);
        }

        const response = await axios.get(`https://api.aniskip.com/v1/skip-times/${malId}/${episodeNumber}?types=op&types=ed`, {
            headers: { 'User-Agent': userAgent },
            timeout: 5000
        });

        apiCache.set(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        apiCache.set(cacheKey, notFoundResponse);
        res.json(notFoundResponse);
    }
});

// API endpoint to get skip times for a Firebase user (no SQL settings; return generic)
app.get('/api/users/me/skip-times/:show_id/:episode_id', async (req, res) => {
    const { show_id, episode_id } = req.params;
    const cacheKey = `skip-${show_id}-${episode_id}`;
    const notFoundResponse = { found: false, results: [] };
    
    if (apiCache.has(cacheKey)) return res.json(apiCache.get(cacheKey));
    try {
        const malIdQuery = `query($showId: String!) { show(_id: $showId) { malId } }`;
        const malIdResponse = await axios.get(apiEndpoint, {
            headers: { 'User-Agent': userAgent, 'Referer': referer },
            params: { query: malIdQuery, variables: JSON.stringify({ showId: show_id }) },
            timeout: 10000
        });
        const malId = malIdResponse.data?.data?.show?.malId;
        if (!malId) {
            apiCache.set(cacheKey, notFoundResponse);
            return res.json(notFoundResponse);
        }
        const response = await axios.get(`https://api.aniskip.com/v1/skip-times/${malId}/${episode_id}?types=op&types=ed`, {
            headers: { 'User-Agent': userAgent },
            timeout: 5000
        });
        apiCache.set(cacheKey, response.data);
        return res.json(response.data);
    } catch (error) {
        apiCache.set(cacheKey, notFoundResponse);
        return res.json(notFoundResponse);
    }
});





// API endpoint for direct video downloads
app.get('/api/download-video', async (req, res) => {
    const { url, referer, filename } = req.query;
    
    console.log('Download request received:');
    console.log('- URL:', url ? 'Present' : 'Missing');
    console.log('- Referer:', referer ? 'Present' : 'Missing');
    console.log('- Filename:', filename || 'Not provided');
    console.log('- Raw query string:', req.url.split('?')[1] || 'None');
    console.log('- All query parameters:', JSON.stringify(req.query));
    
    if (!url) {
        return res.status(400).send('URL parameter is required');
    }
    
    try {
        // Process the filename
        let downloadFilename = filename || 'video.mp4';
        
        // Ensure filename has .mp4 extension
        if (!downloadFilename.toLowerCase().endsWith('.mp4')) {
            downloadFilename += '.mp4';
        }
        
        // Force a simple ASCII filename for maximum compatibility
        const safeFilename = downloadFilename.replace(/[^a-zA-Z0-9_.-]/g, '_');
        console.log('Using safe filename:', safeFilename);
        
        // Set appropriate headers for the request
        const headers = { 
            'User-Agent': userAgent,
            'Accept': '*/*',
            'Connection': 'keep-alive'
        };
        
        if (referer) {
            headers['Referer'] = referer;
        }
        
        // Set download headers
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
        
        // Create a direct proxy to the video
        const videoRequest = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: headers,
            timeout: 30000, // Longer timeout for video download
            maxRedirects: 5
        });
        
        // Copy response headers that might be useful
        const headersToForward = ['content-length', 'content-type', 'accept-ranges', 'cache-control'];
        headersToForward.forEach(header => {
            if (videoRequest.headers[header]) {
                res.setHeader(header.replace(/^\w/, c => c.toUpperCase()), videoRequest.headers[header]);
            }
        });
        
        // Handle client disconnection
        req.on('close', () => {
            if (videoRequest.data) {
                videoRequest.data.destroy();
            }
        });
        
        // Pipe the video data to response
        videoRequest.data.pipe(res);
        
    } catch (error) {
        console.error('Download error:', error.message);
        if (!res.headersSent) {
            res.status(500).send(`Download failed: ${error.message}`);
        }
    }
});

// Add catch-all route to handle client-side routing
app.get('*', (req, res) => {
  // Exclude API routes and other specific routes from catch-all
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/video/') || 
      req.path.startsWith('/download/') || 
      req.path.startsWith('/episodes/')) {
    return res.status(404).send('Not found');
  }
  
  // Set the root directory for serving static files
  const rootDir = __dirname;
  res.sendFile(path.join(rootDir, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});