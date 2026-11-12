/* ===============================
   🎵 AUDIO PLAYER CORE
================================= */
const audio = document.getElementById('audio');
const playBtn = document.getElementById('play');
const playIcon = document.getElementById('play-icon');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const shuffleBtn = document.getElementById('shuffle');
const repeatBtn = document.getElementById('repeat');

const seek = document.getElementById('seek');
const progress = document.getElementById('progress');
const currentTimeEl = document.getElementById('current');
const durationEl = document.getElementById('duration');
const volume = document.getElementById('volume');

function fmt(s) {
    if (isNaN(s)) return '0:00';
    s = Math.floor(s);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + (sec < 10 ? '0' + sec : sec);
}

function setPlayingState(isPlaying) {
    if (!playBtn || !playIcon) return;
    playBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
    if (isPlaying) playIcon.innerHTML = '<path d="M6 19h4V5H6v14zM14 5v14h4V5h-4z" fill="currentColor"/>';
    else playIcon.innerHTML = '<path d="M5 3v18l15-9L5 3z" fill="currentColor"/>';
}

/* Play/Pause */
if (playBtn) {
    playBtn.addEventListener('click', () => {
        if (audio.paused) audio.play();
        else audio.pause();
    });
}
audio.addEventListener('play', () => setPlayingState(true));
audio.addEventListener('pause', () => setPlayingState(false));

/* Metadata / time updates */
audio.addEventListener('loadedmetadata', () => {
    if (durationEl) durationEl.textContent = fmt(audio.duration);
    if (seek) seek.max = Math.floor(audio.duration);
});
audio.addEventListener('timeupdate', () => {
    if (currentTimeEl) currentTimeEl.textContent = fmt(audio.currentTime);
    const p = (audio.currentTime / audio.duration) * 100 || 0;
    if (progress) progress.style.width = p + '%';
    if (seek) seek.value = Math.floor(audio.currentTime);
});

/* Seek behavior */
if (seek) {
    seek.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (progress) progress.style.width = (val / Math.max(1, audio.duration)) * 100 + '%';
        if (currentTimeEl) currentTimeEl.textContent = fmt(val);
    });
    seek.addEventListener('change', (e) => {
        audio.currentTime = Number(e.target.value);
    });
}

/* Click on progress bar to seek */
const progressBar = document.querySelector('.seek .bar');
if (progressBar) {
    progressBar.addEventListener('click', (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        if (audio.duration) audio.currentTime = ratio * audio.duration;
    });
}

/* Volume */
if (volume) {
    volume.addEventListener('input', (e) => {
        audio.volume = Number(e.target.value);
    });
    audio.volume = Number(volume.value || 1);
}

/* Keyboard: Space toggles play/pause (when not typing) */
document.addEventListener('click', e => {
    if (e.target.classList.contains('add-btn')) {
        e.stopPropagation();
        const parentSong = e.target.closest('.songs');
        if (!parentSong) return;

        let idx = parentSong ? songs.indexOf(parentSong) : -1;
        if (idx === -1) {
            refreshSongsArray();
            idx = parentSong ? songs.indexOf(parentSong) : -1;
        }
        if (idx === -1) {
            console.error("Song not found in songs array");
            return;
        }

        if (!currentPlaylist) {
            alert("Please create/select a playlist first!");
            return;
        }

        playlists[currentPlaylist].push(idx);
        renderPlaylists(); // update UI
    }
});


/* ===============================
   🎶 SONGS + PLAYLISTS (existing-only)
================================= */
/* UI elements used for updates */
const coverEl = document.querySelector('.cover img');
const titleEl = document.getElementById('track-title');
const artistEl = document.getElementById('track-artist');
const bgVideoEl = document.querySelector('.video-bg video') || document.querySelector('.bg-video');

const songNameEl = document.getElementById('song-name');
const authorNameEl = document.getElementById('author-name');
const playlistNameEl = document.getElementById('playlist-name');

/* State */
let songs = [];
let currentIndex = 0;
let playlists = [];          // array of {name, songs: [indexes], el}
let activePlaylist = null;   // currently selected playlist object

/* Utility: safe id lookups (fallbacks) */
const createBtn = document.getElementById('create-btn') || document.getElementById('createPlaylistBtn') || document.getElementById('create-playlist');
const playlistContainer = document.getElementById('playlist-container') || document.getElementById('playlistContainer') || document.querySelector('.playlist-area');

/* Refresh songs from DOM and bind click handlers */
// initial songs array (fresh)
function refreshSongsArray() {
    songs = Array.from(document.querySelectorAll('.songs'));
    // ensure dataset.index exists for debugging / optional usage
    songs.forEach((el, i) => el.dataset.index = i);
    // debug
    // console.debug('Songs refreshed, count=', songs.length);
}
refreshSongsArray();

// container which holds songs; prefer .songbox if present
const songsContainer = document.querySelector('.songbox') || document.getElementById('all-songs') || document.body;

// Event delegation for song clicks and add-btn clicks
if (songsContainer) {
    songsContainer.addEventListener('click', (e) => {
        // 1) If clicked an add button (or child of it)
        const addBtn = e.target.closest('.add-btn');
        if (addBtn) {
            e.stopPropagation();

            // find parent song element
            const parentSong = addBtn.closest('.songs');
            // if parent not found, try to refresh songs and search again
            if (!parentSong) {
                refreshSongsArray();
                console.warn('add-btn clicked but parent .songs not found. refreshed songs array.');
                // fall through to fail-safe below
            }

            // compute index from current songs array
            let idx = parentSong ? songs.indexOf(parentSong) : -1;
            if (idx === -1) {
                // try refresh and recompute once
                refreshSongsArray();
                idx = parentSong ? songs.indexOf(parentSong) : -1;
            }

            if (!Number.isFinite(idx) || idx < 0 || idx >= songs.length) {
                console.error('Invalid song index — addBtn handler computed idx=', idx, { parentSong, songsCount: songs.length });
                alert('Invalid song index'); // keeps current behaviour
                return;
            }

            // handle add button click (adds to activePlaylist or shows chooser)
            handleAddBtnClick(e, idx);
            return;
        }

        // 2) Else if clicked a song (not the +)
        const songEl = e.target.closest('.songs');
        if (songEl) {
            // compute index safely
            let idx = songs.indexOf(songEl);
            if (idx === -1) {
                refreshSongsArray();
                idx = songs.indexOf(songEl);
            }
            if (idx === -1) {
                console.error('Clicked .songs but index still not found', songEl);
                return;
            }
            currentIndex = idx;
            loadSong(idx, activePlaylist);
        }
    });
} else {
    console.warn('Songs container not found — delegated handlers not attached');
}

/* Keep helper for showing chooser + adding to playlist */
function handleAddBtnClick(event, songIndex) {
    if (activePlaylist) {
        addSongToPlaylist(songIndex);
        return;
    }

    if (playlists.length === 0) {
        alert('Create a playlist first!');
        return;
    }

    // show chooser near button
    showPlaylistChooser(event, (chosenPlaylist) => {
        if (!chosenPlaylist) return;
        activePlaylist = chosenPlaylist;
        addSongToPlaylist(songIndex);
    });
}

/* small helper alert to avoid silent failures */
function showAlert(msg) {
    // use native alert for now
    alert(msg);
}

/* Load a song by index and optionally set playlist context */
function loadSong(index, playlist = null) {
    index = Number(index);
    if (!Number.isFinite(index) || index < 0) return;
    // ensure songs is fresh
    if (!songs || songs.length === 0) refreshSongsArray();
    if (index < 0 || index >= songs.length) return;

    const songEl = songs[index];
    if (!songEl) return;

    const src = songEl.dataset.src;
    const title = songEl.dataset.title || 'Unknown';
    const artist = songEl.dataset.artist || 'Unknown';
    const cover = songEl.dataset.cover || '';
    const video = songEl.dataset.video || '';

    // Update Now Playing artwork whenever a song is selected
    const expandedCover = document.getElementById('expandedCover');

    if (expandedCover) {
        if (cover) {
            expandedCover.src = cover;

            if (typeof applyBackdrop === "function") {
                applyBackdrop(cover);
            }
        } else {
            expandedCover.removeAttribute("src");
        }
    }

    // set audio
    audio.src = src;
    if (titleEl) titleEl.textContent = title;
    if (artistEl) artistEl.textContent = artist;
    if (coverEl && cover) coverEl.src = cover;

    // background video (if available)
    if (bgVideoEl && video) {
        if (bgVideoEl.tagName && bgVideoEl.tagName.toLowerCase() === 'video') {
            bgVideoEl.src = video;
            bgVideoEl.load();
            bgVideoEl.play().catch(() => { });
        } else {
            bgVideoEl.src = video;
        }
    }

    if (songNameEl) songNameEl.textContent = title;
    if (authorNameEl) authorNameEl.textContent = artist;
    if (playlistNameEl) playlistNameEl.textContent = playlist ? playlist.name : (songEl.dataset.playlist || 'All Songs');

    // highlight
    songs.forEach(s => s.classList.remove('active'));
    songEl.classList.add('active');

    currentIndex = index;
    activePlaylist = playlist || activePlaylist;
    audio.load();
    audio.play();
}


/* Next / Prev / Shuffle (respect playlist if active) */
/* ===============================
   🔁 Mixed-entry aware Next / Prev
   =============================== */
function playNext() {
    if (activePlaylist?.songs?.length) {
        const list = activePlaylist.songs;
        let pos = list.findIndex(
            s =>
                (typeof s === "number" && s === currentIndex) ||
                (typeof s === "object" && s.virtual && window.songs[currentIndex]?.dataset?.src === (window.virtualSongs?.find(v => v.id === s.id)?.src))
        );
        if (pos === -1) pos = 0;
        else pos = (pos + 1) % list.length;

        const nextEntry = list[pos];
        if (typeof nextEntry === "number") {
            loadSong(nextEntry, activePlaylist);
        } else if (nextEntry?.virtual) {
            const v = (window.virtualSongs || []).find(x => String(x.id) === String(nextEntry.id));
            if (v) loadVirtualAsIndexed(v, activePlaylist);
            else console.warn("Virtual song not found for next:", nextEntry);
        }
        return;
    }

    // fallback to all songs
    currentIndex = (currentIndex + 1) % songs.length;
    loadSong(currentIndex, null);
}

function playPrev() {
    if (activePlaylist?.songs?.length) {
        const list = activePlaylist.songs;
        let pos = list.findIndex(
            s =>
                (typeof s === "number" && s === currentIndex) ||
                (typeof s === "object" && s.virtual && window.songs[currentIndex]?.dataset?.src === (window.virtualSongs?.find(v => v.id === s.id)?.src))
        );
        if (pos === -1) pos = 0;
        else pos = (pos - 1 + list.length) % list.length;

        const prevEntry = list[pos];
        if (typeof prevEntry === "number") {
            loadSong(prevEntry, activePlaylist);
        } else if (prevEntry?.virtual) {
            const v = (window.virtualSongs || []).find(x => String(x.id) === String(prevEntry.id));
            if (v) loadVirtualAsIndexed(v, activePlaylist);
            else console.warn("Virtual song not found for prev:", prevEntry);
        }
        return;
    }

    // fallback to all songs
    currentIndex = (currentIndex - 1 + songs.length) % songs.length;
    loadSong(currentIndex, null);
}

function shuffleSong() {
    if (activePlaylist?.songs?.length) {
        const list = activePlaylist.songs;
        if (list.length <= 1) return loadSong(list[0], activePlaylist);
        let r;
        do { r = list[Math.floor(Math.random() * list.length)]; } while (r === currentIndex);
        loadSong(r, activePlaylist);
    } else {
        if (songs.length <= 1) return;
        let r;
        do { r = Math.floor(Math.random() * songs.length); } while (r === currentIndex);
        loadSong(r, null);
    }
}

if (nextBtn) nextBtn.addEventListener('click', playNext);
if (prevBtn) prevBtn.addEventListener('click', playPrev);
if (shuffleBtn) shuffleBtn.addEventListener('click', () => {
    const on = shuffleBtn.getAttribute('data-state') !== 'on';
    shuffleBtn.setAttribute('data-state', on ? 'on' : 'off');
    shuffleBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) shuffleSong();
});
if (repeatBtn) repeatBtn.addEventListener('click', () => {
    const on = repeatBtn.getAttribute('data-state') !== 'on';
    repeatBtn.setAttribute('data-state', on ? 'on' : 'off');
    repeatBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    audio.loop = on;
});

/* ===============================
   📂 PLAYLIST CREATION + MANAGEMENT (supports virtual songs)
================================= */

const playlistContainerEl = playlistContainer || document.createElement('div');
if (!playlistContainer && !document.getElementById('playlist-container')) {
    playlistContainerEl.id = 'playlist-container';
    document.body.appendChild(playlistContainerEl);
}

function createPlaylist(name) {
    if (playlists.some(p => p.name === name)) {
        alert("Playlist already exists!");
        return;
    }

    const plEl = document.createElement('div');
    plEl.className = 'user-playlist';
    plEl.dataset.title = name;
    plEl.innerHTML = `
        <div class="pl-header" style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <div class="pl-cover">
                ${Array(4).fill('').map(() => `<img src="https://i.pinimg.com/564x/f9/b6/51/f9b651715812b95d60de6748a9495a46.jpg" alt="cover">`).join('')}
            </div>
            <strong class="pl-name" style="font-size:1.3em;">${escapeHtml(name)}</strong>
        </div>
        <div class="playlist-songs" style="display:none;"></div>
    `;
    playlistContainerEl.appendChild(plEl);

    const plObj = { name, songs: [], el: plEl };
    playlists.push(plObj);
    if (typeof savePlaylists === "function") savePlaylists();

    const header = plEl.querySelector('.pl-header');
    const songsContainer = plEl.querySelector('.playlist-songs');

    header.addEventListener('click', () => {
        const isActive = plEl.classList.contains('active');
        document.querySelectorAll('.user-playlist').forEach(p => {
            p.classList.remove('active');
            p.querySelector('.playlist-songs').style.display = 'none';
        });

        if (!isActive) {
            plEl.classList.add('active');
            songsContainer.style.display = 'block';
            activePlaylist = plObj;
            if (playlistNameEl) playlistNameEl.textContent = plObj.name;
            openPlaylistOverlay(plObj);
        } else {
            plEl.classList.remove('active');
            songsContainer.style.display = 'none';
        }
    });
}

/* 🔥 Unified getter for song metadata */
function getSongMeta(entry) {
    if (typeof entry === 'number') {
        const s = songs[entry];
        if (!s) return null;
        return {
            title: s.dataset.title,
            artist: s.dataset.artist,
            cover: s.dataset.cover,
            video: s.dataset.video,
            src: s.dataset.src
        };
    } else if (entry && typeof entry === 'object' && entry.virtual) {
        const found = window.virtualSongs?.find(v => v.id === entry.id);
        return found ? {
            title: found.title,
            artist: found.artist,
            cover: found.cover,
            video: found.video,
            src: found.src
        } : null;
    }
    return null;
}

function openPlaylistOverlay(pl) {
    const overlay = document.getElementById('playlist-overlay');
    const cover = document.getElementById('overlay-cover');
    const nameEl = document.getElementById('overlay-name');
    const countEl = document.getElementById('overlay-count');
    const songsEl = document.getElementById('overlay-songs');
    if (!overlay || !cover || !nameEl || !songsEl) return;

    cover.innerHTML = '';

    if (pl.songs.length > 0) {
        const picks = pl.songs.slice(0, 4);
        picks.forEach(entry => {
            const meta = getSongMeta(entry);
            const img = document.createElement('img');
            img.src = meta?.cover || 'https://i.pinimg.com/564x/f9/b6/51/f9b651715812b95d60de6748a9495a46.jpg';
            cover.appendChild(img);
        });
        while (cover.children.length < 4) {
            const img = document.createElement('img');
            img.src = 'https://i.pinimg.com/564x/f9/b6/51/f9b651715812b95d60de6748a9495a46.jpg';
            cover.appendChild(img);
        }
    } else {
        for (let i = 0; i < 4; i++) {
            const img = document.createElement('img');
            img.src = 'https://i.pinimg.com/564x/f9/b6/51/f9b651715812b95d60de6748a9495a46.jpg';
            cover.appendChild(img);
        }
    }

    nameEl.textContent = pl.name;
    countEl.textContent = `${pl.songs.length} song${pl.songs.length !== 1 ? 's' : ''}`;
    songsEl.innerHTML = '';

    if (pl.songs.length === 0) {
        songsEl.innerHTML = '<p style="text-align:center;color:#aaa;">No songs added yet.</p>';
    } else {
        pl.songs.forEach((entry, i) => {
            const meta = getSongMeta(entry);
            if (!meta) return;
            const div = document.createElement('div');
            div.className = 'song-item';
            div.innerHTML = `
                <div class="song-info">
                    <span class="song-index">${i + 1}</span>
                    <img src="${meta.cover}" alt="cover" class="song-thumb">
                    <div class="song-details">
                        <span class="song-title">${escapeHtml(meta.title)}</span>
                        <span class="song-artist">${escapeHtml(meta.artist)}</span>
                    </div>
                </div>
                <div class="song-actions">
                    <button class="play-btn" data-idx="${i}">▶</button>
                    <button class="remove-btn" data-idx="${i}">✖</button>
                </div>
            `;
            songsEl.appendChild(div);
        });
    }

    songsEl.querySelectorAll('.play-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const pos = parseInt(btn.dataset.idx);
            const entry = pl.songs[pos];
            const meta = getSongMeta(entry);
            if (!meta) return;

            // ✅ Set global activePlaylist before loading
            window.activePlaylist = pl;

            if (typeof entry === 'number') {
                loadSong(entry, pl);
            } else if (entry.virtual) {
                if (typeof window.loadVirtualAsIndexed === 'function') {
                    window.loadVirtualAsIndexed(meta, pl);
                } else if (typeof window.loadVirtualSong === 'function') {
                    window.loadVirtualSong(meta, pl);
                } else {
                    console.warn('No virtual loader found');
                }
            }
        });
    });


    songsEl.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const pos = parseInt(btn.dataset.idx);
            pl.songs.splice(pos, 1);
            if (typeof savePlaylists === 'function') savePlaylists();
            openPlaylistOverlay(pl);
        });
    });

    overlay.classList.add('active');
}

document.getElementById('playlist-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'playlist-overlay') {
        e.currentTarget.classList.remove('active');
    }
});

/* ============== MODAL ================= */
const playlistModal = document.getElementById('playlist-modal');
const closeModalBtn = document.getElementById('close-modal');
const playlistForm = document.getElementById('playlist-form');
const playlistNameInput = document.getElementById("playlist-name-input");

function showModal() {
    if (!playlistModal) return;
    playlistModal.classList.add('active');
    playlistModal.style.display = 'flex';
    document.body.classList.add('modal-open');
    setTimeout(() => playlistNameInput?.focus?.(), 120);
}

function hideModal() {
    if (!playlistModal) return;
    playlistModal.classList.remove('active');
    playlistModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    if (playlistNameInput) playlistNameInput.value = '';
}

if (createBtn) createBtn.addEventListener('click', e => { e.preventDefault(); showModal(); });
if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);
window.addEventListener('click', e => { if (e.target === playlistModal) hideModal(); });

if (playlistForm) {
    playlistForm.addEventListener('submit', e => {
        e.preventDefault();
        const name = (playlistNameInput?.value || '').trim();
        if (!name) { hideModal(); return; }
        createPlaylist(name);
        hideModal();
    });
}

/* Add song to playlist (supports virtual) */
function addSongToPlaylist(songEntry) {
    if (!activePlaylist) { alert('Select or create a playlist first!'); return; }

    // Accept number or {virtual:true,id:'x'}
    const entry = typeof songEntry === 'object' ? songEntry : Number(songEntry);
    const exists = activePlaylist.songs.some(s =>
        (typeof s === 'object' && s.virtual && entry.virtual && s.id === entry.id) || s === entry
    );

    if (!exists) {
        activePlaylist.songs.push(entry);
        renderPlaylistSongs(activePlaylist);
        if (playlistNameEl) playlistNameEl.textContent = `${activePlaylist.name}`;
    } else {
        alert('Song already in playlist');
    }
}

/* Render playlist cover (small view) */
function renderPlaylistSongs(pl) {
    if (!pl?.el) return;
    const container = pl.el.querySelector('.playlist-songs');
    container.innerHTML = '';

    const coverImgs = pl.el.querySelectorAll('.pl-cover img');
    const thumbs = [];
    pl.songs.slice(0, 4).forEach(entry => {
        const meta = getSongMeta(entry);
        if (meta?.cover) thumbs.push(meta.cover);
    });
    coverImgs.forEach((img, i) => {
        img.src = thumbs[i] || 'https://i.pinimg.com/564x/f9/b6/51/f9b651715812b95d60de6748a9495a46.jpg';
    });
}

/* Helper */
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&quot;', "'": '&#39;' }[s]));
}

/* Initialize */
refreshSongsArray();

// must keep very important
/* =====================================================
   🎵 Virtual-song integration (Full merged patch)
   - Preserves container3 cover & backdrop update from old loadVirtualSong
   - Keeps new index-based logic (so playlists/next/prev work)
   Drop-in replacement for the last helper block.
===================================================== */
(function () {
    // simple key for matching
    function metaFingerprint(meta) {
        if (!meta) return '';
        return (meta.src ? 'src:' + meta.src :
            (meta.title ? 't:' + meta.title.toLowerCase().trim() + '|a:' + (meta.artist || '').toLowerCase().trim() : ''));
    }

    function createVirtualSongElement(meta = {}) {
        const el = document.createElement('div');
        el.className = 'songs virtual-song';
        Object.entries(meta).forEach(([k, v]) => {
            if (v && typeof v === 'string') el.dataset[k] = v;
        });
        el.dataset._virtualFingerprint = metaFingerprint(meta);
        el.style.display = 'none';
        const container = document.querySelector('.songbox')
            || document.getElementById('all-songs');
        el.className = 'songs virtual-song';
        Object.entries(meta).forEach(([k, v]) => { if (v) el.dataset[k] = v; });
        el.dataset._virtualFingerprint = metaFingerprint(meta);
        el.style.display = 'none';

        // ✅ append inside the same container as real songs
        if (container) container.appendChild(el);
        else document.querySelector('.songs')?.parentElement?.appendChild(el);

        return el;

    }

    function findExistingSongElement(meta) {
        if (!meta) return null;
        const fp = metaFingerprint(meta);
        if (Array.isArray(window.songs) && window.songs.length) {
            const found = window.songs.find(s =>
                s.dataset._virtualFingerprint === fp ||
                (meta.src && s.dataset.src === meta.src) ||
                (meta.title && s.dataset.title === meta.title && meta.artist && s.dataset.artist === meta.artist)
            );
            if (found) return found;
        }
        return document.querySelector(`.songs[data-_virtual-fingerprint="${CSS.escape(fp)}"]`)
            || (meta.src ? document.querySelector(`.songs[data-src="${CSS.escape(meta.src)}"]`) : null);
    }

    // ensure virtual song exists & has index
    window.ensureVirtualSong = function (meta = {}) {
        if (!meta.src && !meta.title) return null;

        // see if it already exists in DOM
        let el = findExistingSongElement(meta);
        if (!el) {
            el = createVirtualSongElement(meta);
        }

        // 🔁 Manually register it in global songs[]
        if (!window.songs) window.songs = [];
        if (!window.songs.includes(el)) {
            window.songs.push(el);
        }

        // ✅ Now the index is guaranteed
        const idx = window.songs.indexOf(el);
        console.log('✅ virtual song ensured at index', idx);
        return { idx, el };
    };


    // full load including container3 visuals
    window.loadVirtualAsIndexed = function (meta = {}, playlistObj = null) {
        if (!meta || (!meta.src && !meta.title)) return;
        const { idx, el } = window.ensureVirtualSong(meta);
        if (idx == null || idx < 0) {
            console.warn('❌ Could not resolve virtual song index');
            return;
        }

        // Use regular loader for sync
        if (typeof loadSong === 'function') {
            loadSong(idx, playlistObj || window.activePlaylist || null);
        }

        // Container3 + background visuals
        try {
            const videoPlayer = document.getElementById("myVideo");
            const expandedCover = document.getElementById("expandedCover");
            const coverBackdrop = document.querySelector(".cover-backdrop");

            if (expandedCover) expandedCover.src = meta.cover || "";
            if (coverBackdrop && meta.cover && typeof extractColor === 'function') {
                extractColor(meta.cover, (rgb) => {
                    coverBackdrop.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                    coverBackdrop.style.opacity = "1";
                });
            }
            if (meta.video && videoPlayer) {
                videoPlayer.src = meta.video;
                videoPlayer.play().catch(() => { });
            }
        } catch (err) {
            console.warn("Visual sync fallback error", err);
        }

        window.activeSongMeta = meta;
        window.activePlaylist = playlistObj || null;
    };

    window.addMetaToPlaylist = function (meta = {}, playlistObj) {
        if (!playlistObj) return null;
        const item = window.ensureVirtualSong(meta);
        if (item.idx < 0) return null;
        if (!playlistObj.songs.includes(item.idx)) {
            playlistObj.songs.push(item.idx);
            if (typeof savePlaylists === 'function') savePlaylists();
            if (typeof renderPlaylistSongs === 'function') renderPlaylistSongs(playlistObj);
        }
        return item.idx;
    };

    window.handleSearchPlay = function (payload) {
        if (!payload) return;
        if (Number.isFinite(payload.idx)) loadSong(payload.idx, window.activePlaylist || null);
        else window.loadVirtualAsIndexed(payload, window.activePlaylist || null);
    };

    // ensure globals for other scripts
    window.playlists = playlists;
    window.activePlaylist = activePlaylist;
    window.songs = songs;
    window.currentIndex = currentIndex;

    console.log("✅ Virtual-song system (v2 merged) loaded.");
})();


// search-input

(function () {
    const searchInput = document.querySelector('.serch input');
    const overlay = document.getElementById('search-overlay');
    const topCard = document.getElementById('top-result-card');
    const topThumb = document.getElementById('topThumb');
    const topTitle = document.getElementById('topTitle');
    const topArtist = document.getElementById('topArtist');
    const topMetaSmall = document.getElementById('topMetaSmall');
    const resultsBox = document.getElementById('search-results');
    const popupRoot = document.getElementById('playlist-popup-root');
    const closeBtn = document.getElementById('closeSearchOverlay');

    if (!searchInput || !overlay || !topCard || !resultsBox) {
        console.warn('Search overlay init skipped - missing element(s).');
        return;
    }

    // helpers
    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
    function highlight(text, term) {
        if (!term) return esc(text);
        const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
        return esc(text).replace(re, '<span class="search-highlight">$1</span>');
    }

    // playlist popup
    function showPlaylistPopup(anchorEl, songIndex, isVirtual = false) {
        popupRoot.innerHTML = '';
        popupRoot.style.display = 'block';
        const rect = anchorEl.getBoundingClientRect();
        const pop = document.createElement('div');
        pop.className = 'playlist-popup';
        pop.style.position = 'fixed';
        pop.style.left = Math.min(window.innerWidth - 220, Math.max(8, rect.right - 180)) + 'px';
        pop.style.top = rect.bottom + 8 + 'px';

        const header = document.createElement('div');
        header.className = 'pl-add-option';
        header.textContent = 'Add to playlist';
        header.style.color = '#cfcfcf';
        header.style.padding = '6px 8px';
        header.style.fontSize = '0.95rem';
        pop.appendChild(header);

        if (!Array.isArray(playlists) || playlists.length === 0) {
            const none = document.createElement('div');
            none.className = 'pl-item';
            none.textContent = 'No playlists yet';
            pop.appendChild(none);
        } else {
            playlists.forEach(pl => {
                const item = document.createElement('div');
                item.className = 'pl-item';
                item.textContent = pl.name;
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!Array.isArray(pl.songs)) pl.songs = [];
                    const entry = isVirtual ? { virtual: true, id: songIndex } : songIndex;
                    if (!pl.songs.some(s => (typeof s === 'object' ? s.id === entry.id : s === entry))) {
                        pl.songs.push(entry);
                        if (typeof savePlaylists === 'function') savePlaylists();
                        renderPlaylistSongs(pl);
                        item.textContent = pl.name + ' ✓';
                        setTimeout(() => item.textContent = pl.name, 900);
                    } else {
                        item.textContent = pl.name + ' (already)';
                        setTimeout(() => item.textContent = pl.name, 900);
                    }
                    popupRoot.style.display = 'none';
                    popupRoot.innerHTML = '';
                });
                pop.appendChild(item);
            });
        }

        popupRoot.appendChild(pop);
        setTimeout(() => {
            function docClick(ev) {
                if (!popupRoot.contains(ev.target)) {
                    popupRoot.style.display = 'none';
                    popupRoot.innerHTML = '';
                    document.removeEventListener('click', docClick);
                }
            }
            document.addEventListener('click', docClick);
        }, 10);
    }

    // gather unified results
    function unifiedSearch(term) {
        term = term.trim().toLowerCase();
        const results = [];

        // DOM songs
        songs.forEach((el, idx) => {
            const title = (el.dataset.title || '').toLowerCase();
            const artist = (el.dataset.artist || '').toLowerCase();
            if (title.includes(term) || artist.includes(term)) {
                results.push({ type: 'dom', idx, el, title: el.dataset.title, artist: el.dataset.artist, cover: el.dataset.cover });
            }
        });

        // Virtual songs
        if (window.virtualSongs && window.virtualSongs.length) {
            window.virtualSongs.forEach(v => {
                const title = (v.title || '').toLowerCase();
                const artist = (v.artist || '').toLowerCase();
                if (title.includes(term) || artist.includes(term)) {
                    results.push({ type: 'virtual', v, title: v.title, artist: v.artist, cover: v.cover });
                }
            });
        }

        return results;
    }

    function renderSearchResults(term) {
        const results = unifiedSearch(term);
        resultsBox.innerHTML = '';
        topThumb.src = '';
        topTitle.textContent = '';
        topArtist.textContent = '';
        topMetaSmall.textContent = '';

        if (!results.length) {
            resultsBox.innerHTML = '<div class="search-empty">No results</div>';
            overlay.classList.add('active');
            return;
        }

        const top = results[0];
        topThumb.src = top.cover || '';
        topTitle.innerHTML = highlight(top.title, term);
        topArtist.innerHTML = highlight(top.artist, term);
        topMetaSmall.textContent = top.artist || '';
        topCard.dataset.type = top.type;
        topCard.dataset.idx = top.type === 'dom' ? top.idx : top.v.id;

        results.slice(0, 4).forEach(r => {
            const row = document.createElement('div');
            row.className = 'search-result-item';
            row.innerHTML = `
                <div class="result-left"><img class="result-thumb" src="${esc(r.cover)}" alt=""></div>
                <div class="result-details">
                    <div class="result-title">${highlight(r.title, term)}</div>
                    <div class="result-artist">${highlight(r.artist, term)}</div>
                </div>
                <div class="result-actions"><button class="result-more" title="Add to playlist">⋯</button></div>
            `;

            row.addEventListener('click', (e) => {
                if (e.target.closest('.result-more')) return;
                if (r.type === 'dom') loadSong(r.idx, null);
                else if (typeof loadVirtualSong === 'function') loadVirtualSong(r.v);
            });

            row.querySelector('.result-more').addEventListener('click', ev => {
                ev.stopPropagation();
                showPlaylistPopup(row.querySelector('.result-more'),
                    r.type === 'dom' ? r.idx : r.v.id,
                    r.type === 'virtual');
            });

            resultsBox.appendChild(row);
        });

        overlay.classList.add('active');
        document.body.classList.add('search-active');
    }

    let deb = null;
    searchInput.addEventListener('input', e => {
        clearTimeout(deb);
        const val = e.target.value;
        deb = setTimeout(() => renderSearchResults(val), 120);
    });

    topCard.addEventListener('click', () => {
        const type = topCard.dataset.type;
        const id = topCard.dataset.idx;
        if (type === 'dom') loadSong(Number(id), null);
        else {
            const v = window.virtualSongs.find(x => x.id === id);
            if (v && typeof loadVirtualSong === 'function') loadVirtualSong(v);
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        document.body.classList.remove('search-active');
        popupRoot.style.display = 'none';
        popupRoot.innerHTML = '';
        resultsBox.innerHTML = '';
        topCard.dataset.idx = '';
    });

    document.addEventListener('click', (ev) => {
        if (!ev.target.closest('.result-more') && !ev.target.closest('.playlist-popup')) {
            popupRoot.style.display = 'none';
            popupRoot.innerHTML = '';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!overlay.classList.contains('active')) return;
        if (e.key === 'Escape') {
            overlay.classList.remove('active');
            document.body.classList.remove('search-active');
            popupRoot.style.display = 'none';
            popupRoot.innerHTML = '';
            resultsBox.innerHTML = '';
            topCard.dataset.idx = '';
        }
        if (e.key === 'Enter') topCard.click();
    });

    console.log('✅ Unified search overlay with working playlist popup & virtual songs ready');
})();




/* ===============================
   🔳 UI: expand/shrink panels + myVideo loop + scroll
================================= */
/* myVideo loop */
const vid = document.getElementById('myVideo');
if (vid) {
    const startTime = 0, endTime = 8;
    vid.addEventListener('loadedmetadata', () => { vid.currentTime = startTime; });
    vid.addEventListener('timeupdate', () => { if (vid.currentTime >= endTime) vid.currentTime = startTime; });
}

/* Panel expand/shrink handlers (guarded) */
const panel1 = document.getElementById('panel1'), expandBtn1 = document.getElementById('expandBtn1');
if (panel1 && expandBtn1) expandBtn1.addEventListener('click', (e) => { e.stopPropagation(); panel1.classList.toggle('expanded'); });

const panel2 = document.getElementById('panel2'), expandBtn2 = document.getElementById('expandBtn2');
if (panel2 && expandBtn2) expandBtn2.addEventListener('click', (e) => { e.stopPropagation(); panel2.classList.toggle('expanded'); });

const shrinkBtn1 = document.getElementById("shrinkBtn1");

if (shrinkBtn1 && panel1) {
    shrinkBtn1.addEventListener("click", (e) => {
        e.stopPropagation();

        const isCollapsed = panel1.classList.toggle("shrinked");

        shrinkBtn1.setAttribute(
            "aria-expanded",
            String(!isCollapsed)
        );

        shrinkBtn1.setAttribute(
            "aria-label",
            isCollapsed ? "Expand library" : "Collapse library"
        );

        if (createBtn) {
            createBtn.textContent = isCollapsed ? "+" : "+ Create";
        }
    });
}

const shrinkBtn2 = document.getElementById('shrinkBtn2');
const mainContainer = document.querySelector('.container');
if (shrinkBtn2 && panel2) shrinkBtn2.addEventListener('click', (e) => {
    e.stopPropagation();
    panel2.classList.toggle('shrinked');
    if (mainContainer) mainContainer.classList.toggle('no-right');
});

/* ensure panel2 visible when song plays */
audio.addEventListener('play', () => {
    if (panel2) panel2.classList.remove('shrinked');
    if (mainContainer) mainContainer.classList.remove('no-right');
});

/* Scroll controls for .songbox */
const container = document.querySelector('.songbox');
const btnLeft = document.querySelector('.scroll-btn.left');
const btnRight = document.querySelector('.scroll-btn.right');
const scrollAmount = 525;

function updateScrollButtons() {
    if (!container || !btnLeft || !btnRight) return;
    const maxScroll = container.scrollWidth - container.clientWidth;
    btnLeft.style.display = container.scrollLeft <= 0 ? 'none' : 'flex';
    btnRight.style.display = container.scrollLeft >= maxScroll - 1 ? 'none' : 'flex';
}
if (btnLeft) btnLeft.addEventListener('click', () => { if (container) container.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); });
if (btnRight) btnRight.addEventListener('click', () => { if (container) container.scrollBy({ left: scrollAmount, behavior: 'smooth' }); });
if (container) { container.addEventListener('scroll', updateScrollButtons); setTimeout(updateScrollButtons, 120); }

/* =========================
   Sync overlay width with shrink state
   - robust: uses MutationObserver to detect .shrinked changes
   - uses .playlist-overlay selector (adjust if your overlay class/id differs)
   Paste at the end of your JS file
   ========================= */


/* =========================================
   PLAYLIST OVERLAY: LIVE PANEL SYNCHRONIZATION
   ========================================= */
(function () {
    const overlay = document.querySelector('.playlist-overlay');
    const c1 = document.querySelector('.container1');
    const c2 = document.querySelector('.container2');
    const c3 = document.querySelector('.container3');

    const shrinkBtn1 = document.getElementById('shrinkBtn1');
    const shrinkBtn2 = document.getElementById('shrinkBtn2');

    if (!overlay || !c2) {
        console.warn('Playlist overlay sync skipped: required element missing.');
        return;
    }

    let trackingFrame = null;

    function updateOverlayGeometry() {
        const rect = c2.getBoundingClientRect();

        overlay.style.left = `${rect.left}px`;
        overlay.style.width = `${rect.width}px`;

        // Match the existing search-overlay stacking behavior.
        const under =
            (c1 && c1.classList.contains('expanded')) ||
            (c3 && c3.classList.contains('expanded'));

        if (under) {
            overlay.style.zIndex = '9000';
        } else if (overlay.classList.contains('active')) {
            overlay.style.zIndex = '18000';
        } else {
            overlay.style.zIndex = '12000';
        }
    }

    function trackPanelTransition() {
        if (trackingFrame !== null) {
            cancelAnimationFrame(trackingFrame);
            trackingFrame = null;
        }

        updateOverlayGeometry();

        let previousGeometry = '';
        let stableFrames = 0;
        const startTime = performance.now();

        function followFrame() {
            updateOverlayGeometry();

            const rect = c2.getBoundingClientRect();
            const geometry =
                `${rect.left.toFixed(2)}:${rect.width.toFixed(2)}`;

            if (geometry === previousGeometry) {
                stableFrames++;
            } else {
                stableFrames = 0;
                previousGeometry = geometry;
            }

            if (stableFrames < 3 && performance.now() - startTime < 800) {
                trackingFrame = requestAnimationFrame(followFrame);
            } else {
                trackingFrame = null;
                updateOverlayGeometry();
            }
        }

        trackingFrame = requestAnimationFrame(followFrame);
    }

    [shrinkBtn1, shrinkBtn2].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', trackPanelTransition);
        }
    });

    [c1, c2, c3].forEach(panel => {
        if (!panel) return;

        panel.addEventListener('transitionend', event => {
            if (event.propertyName === 'width' ||
                event.propertyName === 'flex-basis') {
                updateOverlayGeometry();
            }
        });
    });

    const observer = new MutationObserver(() => {
        requestAnimationFrame(() => {
            updateOverlayGeometry();

            if (overlay.classList.contains('active')) {
                trackPanelTransition();
            }
        });
    });

    observer.observe(overlay, {
        attributes: true,
        attributeFilter: ['class']
    });

    updateOverlayGeometry();

    console.log('Playlist overlay live panel synchronization installed.');
})();



// search-overlay stuuf

/* =========================================
   SEARCH OVERLAY: LIVE PANEL SYNCHRONIZATION
   ========================================= */
(function () {
    const overlay =
        document.querySelector('.search-overlay') ||
        document.querySelector('#search-overlay') ||
        document.querySelector('.container2-overlay') ||
        document.getElementById('searchOverlay');

    const c1 = document.querySelector('.container1');
    const c2 = document.querySelector('.container2');
    const c3 = document.querySelector('.container3');

    const shrinkBtn1 = document.getElementById('shrinkBtn1');
    const shrinkBtn2 = document.getElementById('shrinkBtn2');

    const searchTrigger =
        document.querySelector('.serch input') ||
        document.querySelector('.search-button') ||
        document.querySelector('.open-search') ||
        document.getElementById('openSearch');

    if (!overlay || !c2) {
        console.warn('Search overlay sync skipped: required element missing.');
        return;
    }

    let trackingFrame = null;

    // Preserve the working container2 geometry calculation.
    function computeOverlayWidth() {
        const rect = c2.getBoundingClientRect();

        return {
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            under:
                (c1 && c1.classList.contains('expanded')) ||
                (c3 && c3.classList.contains('expanded'))
        };
    }

    function updateOverlayWidthAndPriority() {
        const { left, width, under } = computeOverlayWidth();

        overlay.style.left = left;
        overlay.style.width = width;

        const active = overlay.classList.contains('active');

        if (under) {
            overlay.classList.add('fade-under');
            overlay.style.zIndex = '9000';
        } else {
            overlay.classList.remove('fade-under');
            overlay.style.zIndex = active ? '15000' : '12000';
        }
    }

    // Follow the panel's actual dimensions during its CSS animation.
    function trackPanelTransition() {
        if (trackingFrame !== null) {
            cancelAnimationFrame(trackingFrame);
            trackingFrame = null;
        }

        updateOverlayWidthAndPriority();
        window.addEventListener('resize', () => {
            requestAnimationFrame(updateOverlayWidthAndPriority);
        });

        let previousGeometry = '';
        let stableFrames = 0;
        const startTime = performance.now();

        function followFrame() {
            updateOverlayWidthAndPriority();

            const rect = c2.getBoundingClientRect();
            const geometry =
                `${rect.left.toFixed(2)}:${rect.width.toFixed(2)}`;

            if (geometry === previousGeometry) {
                stableFrames++;
            } else {
                stableFrames = 0;
                previousGeometry = geometry;
            }

            if (stableFrames < 3 && performance.now() - startTime < 800) {
                trackingFrame = requestAnimationFrame(followFrame);
            } else {
                trackingFrame = null;
                updateOverlayWidthAndPriority();
            }
        }

        trackingFrame = requestAnimationFrame(followFrame);
    }

    // Existing panel handlers run before this listener.
    [shrinkBtn1, shrinkBtn2].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', trackPanelTransition);
        }
    });

    // Final synchronization when panel transitions finish.
    [c1, c2, c3].forEach(panel => {
        if (!panel) return;

        panel.addEventListener('transitionend', event => {
            if (
                event.propertyName === 'width' ||
                event.propertyName === 'flex-basis' ||
                event.propertyName === 'min-width'
            ) {
                updateOverlayWidthAndPriority();
            }
        });
    });

    function restoreOverlayDominance() {
        if (!overlay.classList.contains('active')) return;

        updateOverlayWidthAndPriority();
        overlay.classList.remove('fade-under');
        overlay.style.zIndex = '20000';
    }

    if (searchTrigger) {
        searchTrigger.addEventListener('focus', () => {
            requestAnimationFrame(restoreOverlayDominance);
        });

        searchTrigger.addEventListener('click', () => {
            requestAnimationFrame(restoreOverlayDominance);
        });
    }

    // Keep synchronization when the search overlay opens or closes.
    const observer = new MutationObserver(() => {
        requestAnimationFrame(updateOverlayWidthAndPriority);
    });

    observer.observe(overlay, {
        attributes: true,
        attributeFilter: ['class']
    });

    updateOverlayWidthAndPriority();

    console.log('Search overlay live panel synchronization installed.');
})();




(function () {
    const searchOverlay = document.querySelector('.search-overlay');
    const playlistOverlay = document.querySelector('.playlist-overlay');
    const searchInput = document.querySelector('.serch input');

    if (!searchOverlay || !playlistOverlay) {
        console.warn('Overlay priority controller skipped — missing element(s).');
        return;
    }

    const BASE_Z = 12000;
    const SEARCH_TOP = 20000;
    const PLAYLIST_TOP = 18000;

    // short suppression period (ms) during which playlist will not reassert on top
    const SUPPRESS_MS = 300;

    // last time search requested dominance
    let suppressPlaylistUntil = 0;
    // light re-entrancy guard
    let lock = false;

    function setZ(el, z) { if (el && el.style) el.style.zIndex = String(z); }

    // call when user explicitly wants search to be top (typing, focus, click)
    // force: boolean (true = ignore 'active' guard)
    function bringSearchFront(force = false) {
        // If search is neither active nor being typed and not forced, do nothing.
        const hasText = searchInput && searchInput.value && searchInput.value.trim().length > 0;
        if (!force && !searchOverlay.classList.contains('active') && !hasText) return;

        if (lock) {
            // schedule a quick retry so we don't clash with other rapid ops
            setTimeout(() => bringSearchFront(force), 40);
            return;
        }
        lock = true;

        // mark suppression window so playlist won't push back immediately
        suppressPlaylistUntil = Date.now() + SUPPRESS_MS;

        // schedule on next frame for smoothness
        requestAnimationFrame(() => {
            // ensure playlist sits below search visually but remains visible
            setZ(playlistOverlay, BASE_Z);
            setZ(searchOverlay, SEARCH_TOP);

            // micro-delay unlock
            setTimeout(() => { lock = false; }, 60);
        });
    }

    // call when playlist tries to come forward
    function bringPlaylistFront(force = false) {
        // don't override search if user recently asked search to be dominant
        if (!force && Date.now() < suppressPlaylistUntil) {
            // noop — keep search on top
            return;
        }

        if (!playlistOverlay.classList.contains('active') && !force) return;

        if (lock) {
            setTimeout(() => bringPlaylistFront(force), 40);
            return;
        }
        lock = true;

        requestAnimationFrame(() => {
            // if search is active and has text, keep search on top
            const searchActive = searchOverlay.classList.contains('active');
            const searchHasText = searchInput && searchInput.value && searchInput.value.trim().length > 0;

            if (searchActive || searchHasText) {
                // both visible: keep search top but keep playlist slightly above base (so it can still visually expand)
                setZ(searchOverlay, SEARCH_TOP);
                setZ(playlistOverlay, PLAYLIST_TOP - 500); // still below SEARCH_TOP
            } else {
                // normal playlist-in-front behavior
                setZ(searchOverlay, BASE_Z);
                setZ(playlistOverlay, PLAYLIST_TOP);
            }

            // small unlock
            setTimeout(() => { lock = false; }, 60);
        });
    }

    // MutationObserver on playlistOverlay: when playlist opens, bring it front (but it respects suppression)
    const moPlaylist = new MutationObserver((muts) => {
        for (const m of muts) {
            if (m.attributeName === 'class') {
                if (playlistOverlay.classList.contains('active')) {
                    bringPlaylistFront(false);
                }
            }
        }
    });
    moPlaylist.observe(playlistOverlay, { attributes: true, attributeFilter: ['class'] });

    // wire searchInput events to bring search front immediately when user types/focuses/clicks
    if (searchInput) {
        ['focus', 'click', 'input'].forEach(evt => {
            searchInput.addEventListener(evt, (e) => {
                // on first keystroke, force search dominance immediately
                const isInput = (evt === 'input');
                // call forced on the very first character typed (helps with the "only after 2 letters" issue)
                const len = (searchInput.value || '').trim().length;
                const force = isInput && len === 1;
                bringSearchFront(force);
            }, { passive: true });
        });
    }

    // tiny helper to expose debug controls from console (optional)
    window.__overlayPriority = {
        bringSearchFront, bringPlaylistFront, setSuppressMs: (v) => { SUPPRESS_MS = Number(v) || SUPPRESS_MS; }
    };

    console.log('🎯 overlay priority controller (suppression) installed');
})();

/* ==============================
   Preserve search dominance during container transitions
   - keeps search on top mid-transition
   - allows playlist to come forward only on user intent
   ============================== */
(function () {
    const searchOverlay = document.querySelector('.search-overlay');
    const playlistOverlay = document.querySelector('.playlist-overlay');
    const c1 = document.querySelector('.container1');
    const c3 = document.querySelector('.container3');
    const searchInput = document.querySelector('.serch input');

    if (!searchOverlay || !playlistOverlay) {
        console.warn('Search-preserve helper skipped — overlays not found.');
        return;
    }

    const BASE_Z = 12000;
    const SEARCH_TOP = 15000;
    const PLAYLIST_TOP = 14000;

    let searchDominant = false;
    let userIntentPlaylist = false;
    let playlistIntentTimer = null;
    let preLock = false; // 🧩 new tiny guard to stop playlist flash

    function setZ(el, z) { if (el && el.style) el.style.zIndex = String(z); }

    function markSearchDominant() {
        searchDominant = true;
        setZ(searchOverlay, SEARCH_TOP);
        setZ(playlistOverlay, BASE_Z);
        document.body.classList.add('search-dominant');
    }

    function clearSearchDominant() {
        searchDominant = false;
        document.body.classList.remove('search-dominant');
        searchOverlay.style.zIndex = '';
        playlistOverlay.style.zIndex = '';
    }

    function noteUserIntentPlaylist() {
        userIntentPlaylist = true;
        if (playlistIntentTimer) clearTimeout(playlistIntentTimer);
        playlistIntentTimer = setTimeout(() => { userIntentPlaylist = false; }, 700);
        setZ(playlistOverlay, PLAYLIST_TOP);
        setZ(searchOverlay, BASE_Z);
        document.body.classList.remove('search-dominant');
        searchDominant = false;
    }

    const PLAYLIST_OPEN_SELECTORS = ['.user-playlist', '.pl-header', '#playlist-container', '[data-open-playlist]', '.open-playlist', '#playlist-btn'];
    function isPlaylistControl(el) {
        if (!(el instanceof Element)) return false;
        for (const sel of PLAYLIST_OPEN_SELECTORS) if (el.closest(sel)) return true;
        if (playlistOverlay.contains(el)) return true;
        return false;
    }

    document.addEventListener('click', (ev) => {
        if (isPlaylistControl(ev.target)) {
            setTimeout(() => {
                if (playlistOverlay.classList.contains('active')) noteUserIntentPlaylist();
            }, 8);
        }
    }, { capture: true, passive: true });

    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
            const active = document.activeElement;
            if (isPlaylistControl(active)) {
                setTimeout(() => {
                    if (playlistOverlay.classList.contains('active')) noteUserIntentPlaylist();
                }, 8);
            }
        }
    });

    if (searchInput) {
        ['focus', 'click', 'input'].forEach(ev => {
            searchInput.addEventListener(ev, () => {
                const hasText = (searchInput.value || '').trim().length > 0;
                if (ev === 'focus' || hasText) markSearchDominant();
            }, { passive: true });
        });
    }

    const searchObserver = new MutationObserver(() => {
        if (!searchOverlay.classList.contains('active')) clearSearchDominant();
    });
    searchObserver.observe(searchOverlay, { attributes: true, attributeFilter: ['class'] });

    /// ── core watcher for container expand/shrink
    function onContainerChange() {
        if (!searchOverlay.classList.contains('active') || !searchDominant) return; // unchanged [web:27]

        if (!preLock) {
            preLock = true;

            if (!userIntentPlaylist) {
                // Save exact current display so restoration is precise
                const prevDisplay = playlistOverlay.style.display || '';
                playlistOverlay.dataset.prevDisplay = prevDisplay; // persist original [web:73]

                // Hard non-paint clamp (removes box, kills any paint/composite)
                playlistOverlay.style.display = 'none'; // zero chance of a 1-frame flash [web:73]

                // Synchronously commit the hide before next paint
                // eslint-disable-next-line no-unused-expressions
                window.getComputedStyle(playlistOverlay).display; // force style/layout flush [web:84]
            }

            // Keep playlist below while clamped
            setZ(playlistOverlay, BASE_Z - 2000); // unchanged [web:27]

            // Deterministic release: minimum window + two stable frames
            const start = performance.now();
            const MIN_MS = 160; // straddle slow frames/jank [web:106]
            let lastSig = `${c1?.className}|${c3?.className}`;
            let stable = 0;

            function tryRelease() {
                if (performance.now() - start < MIN_MS) {
                    requestAnimationFrame(tryRelease); // align to paint frames [web:111]
                    return;
                }

                const sig = `${c1?.className}|${c3?.className}`;
                if (sig === lastSig) {
                    stable += 1; // frame stable [web:12]
                } else {
                    stable = 0;
                    lastSig = sig; // reset on class change [web:12]
                }

                if (stable < 2) {
                    requestAnimationFrame(tryRelease); // require two consecutive stable frames [web:12]
                    return;
                }

                preLock = false;

                if (searchDominant && searchOverlay.classList.contains('active')) {
                    setZ(searchOverlay, SEARCH_TOP);
                    setZ(playlistOverlay, BASE_Z); // restore stack order [web:27]
                }

                if (!userIntentPlaylist) {
                    // Restore original display exactly as before
                    const prev = playlistOverlay.dataset.prevDisplay || '';
                    playlistOverlay.style.display = prev; // unhide without side effects [web:73]
                    delete playlistOverlay.dataset.prevDisplay;
                }
            }

            requestAnimationFrame(tryRelease); // begin release attempts [web:111]
        }

        if (userIntentPlaylist) return; // unchanged [web:27]
        setZ(searchOverlay, SEARCH_TOP);
        setZ(playlistOverlay, BASE_Z);
        document.body.classList.add('search-dominant'); // unchanged [web:27]
    }


    const moCfg = { attributes: true, attributeFilter: ['class'] };
    if (c1) new MutationObserver(onContainerChange).observe(c1, moCfg);
    if (c3) new MutationObserver(onContainerChange).observe(c3, moCfg);

    function onTransitionEnd(ev) {
        if (['width', 'transform', 'left'].includes(ev.propertyName)) onContainerChange();
    }
    if (c1) c1.addEventListener('transitionend', onTransitionEnd);
    if (c3) c3.addEventListener('transitionend', onTransitionEnd);

    window.__overlayPreserve = { markSearchDominant, clearSearchDominant, noteUserIntentPlaylist };
    console.log('🔒 overlay-preserve helper (flicker-fix) installed');
})();
// we need to change this i'm done for now

/* =====================================================
   🩹 Playlist Overlay Priority + Safe Live Refresh v3
===================================================== */
(function () {
    const overlay = document.querySelector('.playlist-overlay');
    const c1 = document.querySelector('.container1');
    const c3 = document.querySelector('.container3');
    if (!overlay) return;

    /* ---------- 1. Pre-warm overlay so first open is instant ---------- */
    overlay.style.willChange = 'transform, opacity';
    overlay.style.transition = 'opacity 0.25s ease, transform 0.25s ease';

    /* ---------- 2. Smooth z-index handling ---------- */
    const bumpZ = () => {
        const baseZ = Number(overlay.style.zIndex || 14000);
        [c1, c3].forEach(el => {
            if (el && el.classList.contains('expanded')) {
                el.style.zIndex = String(baseZ + 2000);
            } else if (el) {
                el.style.zIndex = '';
            }
        });
    };
    new MutationObserver(bumpZ).observe(document.body, { attributes: true, subtree: true });
    document.addEventListener('transitionend', bumpZ);

    /* ---------- 3. Safer overlay refresh hook ---------- */
    const refreshOverlay = (pl) => {
        if (!pl || !window.activePlaylist) return;
        if (!overlay.classList.contains('active')) return;
        if (window.activePlaylist.name !== pl.name) return;
        if (overlay.classList.contains('fading')) return;

        clearTimeout(refreshOverlay._t);
        refreshOverlay._t = setTimeout(() => {
            if (typeof window.openPlaylistOverlay === 'function')
                window.openPlaylistOverlay(pl);
        }, 150);
    };

    // wrap renderPlaylistSongs
    const oldRender = window.renderPlaylistSongs;
    window.renderPlaylistSongs = function (pl) {
        if (typeof oldRender === 'function') oldRender(pl);
        refreshOverlay(pl);
    };

    // wrap addSongToPlaylist
    const oldAdd = window.addSongToPlaylist;
    window.addSongToPlaylist = function (entry) {
        const res = oldAdd ? oldAdd(entry) : undefined;
        if (window.activePlaylist) refreshOverlay(window.activePlaylist);
        return res;
    };

    /* ---------- 4. Event-driven playlist refresh ---------- */
    window.addEventListener("rkd:playlist-updated", (event) => {
        const playlist = event.detail?.playlist;

        if (playlist) {
            refreshOverlay(playlist);
        }
    });

    /* ---------- 5. Reset queued refresh when overlay closes ---------- */
    const observer = new MutationObserver(() => {
        if (!overlay.classList.contains('active')) {
            clearTimeout(refreshOverlay._t);
        }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });

    console.log('✅ Overlay fix v3 loaded – smoother first open, no disappearing songs.');
})();


/* ===============================
   Unified Virtual + Player Glue
   - Single-file consolidated patch
   - Non-invasive: prefers your original loadSong / loadVirtual* if present
   - Guards: single ended handler, play-throttle, video thrash protection
   =============================== */
(function () {
    'use strict';

    // ---------- quick helpers ----------
    const $ = (sel) => document.querySelector(sel);
    const qsAll = (sel) => Array.from(document.querySelectorAll(sel));

    // ---- cached DOM that your UI expects (adjust if your ids differ) ----
    const audio = document.querySelector('audio') || document.getElementById('audio');
    const videoPlayer = document.getElementById('myVideo') || document.querySelector('.video-bg video') || null;
    const expandedCover = document.getElementById('expandedCover') || null;
    const coverBackdrop = document.querySelector('.cover-backdrop') || null;
    const smallTitleEl = document.getElementById('track-title') || document.querySelector('.bottom-song-title') || null;
    const smallArtistEl = document.getElementById('track-artist') || document.querySelector('.bottom-song-artist') || null;
    const smallCoverEl = document.querySelector('.cover img') || null;
    const songNameEl = document.getElementById('song-name') || null;
    const authorNameEl = document.getElementById('author-name') || null;
    const playlistNameEl = document.getElementById('playlist-name') || document.getElementById('playlistName') || null;

    // ---- expose/ensure important globals ----
    window.songs = window.songs || Array.from(document.querySelectorAll('.songs'));
    window.playlists = window.playlists || window.playlists || [];
    window.virtualSongs = window.virtualSongs || [];
    window.currentIndex = (typeof window.currentIndex === 'number') ? window.currentIndex : 0;
    window.currentEntry = window.currentEntry || null; // {type:'dom',index} or {type:'virtual',id}

    // ---- preserve originals where available ----
    const origLoadSong = (typeof window.loadSong === 'function') ? window.loadSong.bind(window) : null;
    const origLoadVirtualAsIndexed = (typeof window.loadVirtualAsIndexed === 'function') ? window.loadVirtualAsIndexed.bind(window) : null;
    const origLoadVirtualSong = (typeof window.loadVirtualSong === 'function') ? window.loadVirtualSong.bind(window) : null;
    const origAddSongToPlaylist = (typeof window.addSongToPlaylist === 'function') ? window.addSongToPlaylist.bind(window) : null;
    const origAddMetaToPlaylist = (typeof window.addMetaToPlaylist === 'function') ? window.addMetaToPlaylist.bind(window) : null;
    const origRenderPlaylistSongs = (typeof window.renderPlaylistSongs === 'function') ? window.renderPlaylistSongs.bind(window) : null;
    const origOpenPlaylistOverlay = (typeof window.openPlaylistOverlay === 'function') ? window.openPlaylistOverlay.bind(window) : null;

    // ---------- small state guards ----------
    const state = {
        lastPlayTs: 0,
        playThrottleMs: 160,        // prevent duplicate play calls within this window
        lastEndedTs: 0,
        endedDebounceMs: 600,       // ignore duplicate ended signals within this window
        lastVideoSrc: null,         // avoid reloading same video src repeatedly
        lastAudioSrc: null
    };

    // ---------- utilities ----------
    function isNumberLike(v) { return typeof v === 'number' || (!isNaN(Number(v)) && v !== null && v !== ''); }
    function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

    function normalizeEntry(x) {
        if (x == null) return null;
        // Already normalized
        if (typeof x === 'object' && x.type === 'dom' && Number.isFinite(x.index))
            return { type: 'dom', index: Number(x.index) };
        if (typeof x === 'object' && x.type === 'virtual' && x.id)
            return { type: 'virtual', id: String(x.id) };
        // Legacy virtual objects
        if (typeof x === 'object' && x.virtual && x.id)
            return { type: 'virtual', id: String(x.id) };
        // Raw number or numeric string → DOM
        if (isNumberLike(x)) return { type: 'dom', index: Number(x) };
        if (typeof x === 'string' && /^\d+$/.test(x))
            return { type: 'dom', index: Number(x) };
        // Plain string → virtual id
        if (typeof x === 'string') return { type: 'virtual', id: String(x) };
        return null;
    }

    // --- immediately after normalizeEntry definition, re-normalize once ---
    try {
        if (!Array.isArray(window.playlists)) window.playlists = window.playlists || [];
        window.playlists.forEach(pl => {
            if (!Array.isArray(pl.songs)) pl.songs = [];
            pl.songs = pl.songs.map(normalizeEntry).filter(Boolean);
        });
    } catch (e) { console.warn('playlist normalization failed', e); }


    function findVirtualById(id) {
        if (!id) return null;
        return (window.virtualSongs || []).find(v => String(v.id) === String(id)) || null;
    }

    // ---------- ensure there's a DOM song element for a virtual (non-destructive) ----------
    function ensureVirtualSong(meta = {}) {
        // meta: { id?, title?, artist?, cover?, src?, video? }
        if (!meta || (!meta.src && !meta.title && !meta.id)) return null;
        // build fingerprint
        const fp = (meta.src ? 'src:' + meta.src : (meta.title ? 't:' + (meta.title + '|' + (meta.artist || '')).toLowerCase().trim() : 'id:' + String(meta.id || '')));
        // try to find in existing songs array first
        let found = (window.songs || []).find(s => {
            if (!s || !s.dataset) return false;
            if (s.dataset._virtualFingerprint && s.dataset._virtualFingerprint === fp) return true;
            if (meta.src && s.dataset.src && s.dataset.src === meta.src) return true;
            if (meta.title && s.dataset.title && s.dataset.title === meta.title && meta.artist && s.dataset.artist === meta.artist) return true;
            return false;
        });
        // fallback to querySelector by attr
        if (!found) {
            try {
                found = document.querySelector(`.songs[data-_virtual-fingerprint="${CSS.escape(fp)}"]`) || (meta.src ? document.querySelector(`.songs[data-src="${CSS.escape(meta.src)}"]`) : null);
            } catch (e) { /* ignore CSS.escape errors for weird strings */ }
        }

        if (found) {
            // register if not in window.songs
            if (!window.songs.includes(found)) window.songs.push(found);
            return { idx: window.songs.indexOf(found), el: found };
        }

        // create invisible element to represent virtual song (keeps playlist indexing stable)
        const el = document.createElement('div');
        el.className = 'songs virtual-song';
        // keep the same dataset keys your app expects
        if (meta.src) el.dataset.src = meta.src;
        if (meta.title) el.dataset.title = meta.title;
        if (meta.artist) el.dataset.artist = meta.artist;
        if (meta.cover) el.dataset.cover = meta.cover;
        if (meta.video) el.dataset.video = meta.video;
        el.dataset._virtualFingerprint = fp;
        el.style.display = 'none';

        // where to append? prefer .songbox or #all-songs, otherwise body append
        const container = document.querySelector('.songbox') || document.getElementById('all-songs') || document.body;
        container.appendChild(el);

        // refresh global songs array reference to include it
        window.songs = window.songs || [];
        if (!window.songs.includes(el)) window.songs.push(el);

        const idx = window.songs.indexOf(el);
        console.log('ensureVirtualSong -> created/ensured at index', idx);
        return { idx, el };
    }

    // ---------- robust video play helper (minimal thrash) ----------
    function tryPlayVideoSafely(src) {
        if (!videoPlayer) return;
        try {
            // if no src -> hide video, show backdrop
            if (!src) {
                try { videoPlayer.pause(); } catch (e) { }
                videoPlayer.style.opacity = '0';
                if (coverBackdrop) coverBackdrop.style.opacity = '1';
                state.lastVideoSrc = null;
                return;
            }

            // avoid reloading same src repeatedly
            if (String(state.lastVideoSrc || '') === String(src)) {
                // still ensure playing when necessary
                const p = videoPlayer.play();
                if (p && typeof p.then === 'function') {
                    p.catch(() => {
                        // muted fallback
                        const prevMuted = videoPlayer.muted;
                        videoPlayer.muted = true;
                        videoPlayer.play().then(() => { setTimeout(() => { try { videoPlayer.muted = prevMuted; } catch (_) { } }, 200); }).catch(() => { videoPlayer.style.opacity = '0'; if (coverBackdrop) coverBackdrop.style.opacity = '1'; });
                    });
                }
                videoPlayer.style.opacity = '1';
                if (coverBackdrop) coverBackdrop.style.opacity = '0';
                return;
            }

            // set and load new src
            state.lastVideoSrc = src;
            try { videoPlayer.src = src; } catch (e) { }
            try { videoPlayer.load(); } catch (e) { /* ignore */ }
            const p = videoPlayer.play();
            if (p && typeof p.then === 'function') {
                p.then(() => { videoPlayer.style.opacity = '1'; if (coverBackdrop) coverBackdrop.style.opacity = '0'; }).catch(() => {
                    // muted fallback
                    const prevMuted = videoPlayer.muted;
                    videoPlayer.muted = true;
                    videoPlayer.play().then(() => { setTimeout(() => { try { videoPlayer.muted = prevMuted; } catch (_) { } }, 200); videoPlayer.style.opacity = '1'; if (coverBackdrop) coverBackdrop.style.opacity = '0'; }).catch(() => { videoPlayer.style.opacity = '0'; if (coverBackdrop) coverBackdrop.style.opacity = '1'; });
                });
            } else {
                // older platform
                videoPlayer.style.opacity = '1';
                if (coverBackdrop) coverBackdrop.style.opacity = '0';
            }
        } catch (err) {
            console.warn('tryPlayVideoSafely error', err);
        }
    }

    // ---------- small UI helpers for container3 visuals (virtual-only) ----------
    function applyCoverAndBackdrop(metaCover) {
        if (expandedCover && typeof metaCover !== 'undefined') try { expandedCover.src = metaCover || ''; } catch (e) { }
        if (!metaCover) return;
        if (typeof extractColor === 'function') {
            try { extractColor(metaCover, (rgb) => { if (coverBackdrop) { coverBackdrop.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`; coverBackdrop.style.opacity = '1'; } }); } catch (e) { }
        } else if (typeof applyBackdrop === 'function') {
            try { applyBackdrop(metaCover); } catch (e) { }
        } else if (coverBackdrop) {
            try { coverBackdrop.style.backgroundImage = `url("${metaCover}")`; coverBackdrop.style.backgroundSize = 'cover'; coverBackdrop.style.opacity = '1'; } catch (e) { }
        }
    }

    function syncContainer3ForVirtual(meta = {}, playlistObj = null) {
        if (!meta) return;
        // minimal safe updates (text)
        if (smallTitleEl) smallTitleEl.textContent = meta.title || 'Unknown Title';
        if (smallArtistEl) smallArtistEl.textContent = meta.artist || 'Unknown Artist';
        if (songNameEl) songNameEl.textContent = meta.title || 'Unknown Title';
        if (authorNameEl) authorNameEl.textContent = meta.artist || 'Unknown Artist';
        if (playlistNameEl) playlistNameEl.textContent = (playlistObj && playlistObj.name) || meta.playlist || (meta.pl || 'All Songs');
        if (smallCoverEl && meta.cover) smallCoverEl.src = meta.cover;

        // visuals
        applyCoverAndBackdrop(meta.cover || '');

        // video handling only for virtual (we won't touch DOM song video logic)
        tryPlayVideoSafely(meta.video || null);

        // mark activeSongMeta so other code can read it
        window.activeSongMeta = meta;
        window.activePlaylist = playlistObj || null;
    }

    // ---------- central loaders (prefer existing originals) ----------
    // load DOM index using original loader if present otherwise fallback minimal
    function loadDomIndex(index, playlistObj = null) {
        index = Number(index);
        if (!Number.isFinite(index)) return console.warn('loadDomIndex: invalid index', index);

        if (origLoadSong) {
            try {
                origLoadSong(index, playlistObj);
            } catch (e) { console.warn('origLoadSong threw', e); }
            // make sure canonical pointers are updated
            window.currentEntry = { type: 'dom', index: index };
            window.currentIndex = index;
            window.activePlaylist = playlistObj || null;
            // keep lastAudioSrc in sync (if audio element has src)
            try { state.lastAudioSrc = audio && audio.getAttribute && audio.getAttribute('src'); } catch (e) { }
            return;
        }

        // fallback minimal direct load
        const s = (window.songs || [])[index];
        if (!s) return console.warn('loadDomIndex fallback: song element missing at', index);
        const meta = { title: s.dataset.title, artist: s.dataset.artist, cover: s.dataset.cover, video: s.dataset.video, src: s.dataset.src };
        // set audio safely
        playAudioSrcSafely(meta.src);
        // UI updates
        try { if (smallTitleEl) smallTitleEl.textContent = meta.title || ''; } catch (e) { }
        try { if (smallArtistEl) smallArtistEl.textContent = meta.artist || ''; } catch (e) { }
        try { if (smallCoverEl && meta.cover) smallCoverEl.src = meta.cover; } catch (e) { }
        // video (best-effort)
        tryPlayVideoSafely(meta.video || null);

        window.currentEntry = { type: 'dom', index: index };
        window.currentIndex = index;
        window.activePlaylist = playlistObj || null;
    }

    // play audio src in safe / de-duplicated way
    function playAudioSrcSafely(src) {
        if (!audio) return;

        // 🩹 Prevent replaying same first song twice
        if (String(state.lastAudioSrc || '') === String(src)) {
            console.log('[DEBUG] Duplicate initial play suppressed for', src);
            return;
        }

        try {
            // avoid thrash: if same src and audio paused because of autoplay-block, just attempt play
            const prevSrc = audio.getAttribute && audio.getAttribute('src') || audio.src || '';
            const now = Date.now();
            if (state.lastPlayTs && (now - state.lastPlayTs) < state.playThrottleMs) {
                // short throttle: ignore repeated immediate requests
            }
            state.lastPlayTs = now;

            if (String(prevSrc) === String(src) && audio.paused) {
                // attempt to resume
                audio.play().catch(() => { });
                state.lastAudioSrc = src;
                return;
            }

            // else set new src safely
            try { audio.pause(); } catch (e) { }
            if (audio.setAttribute) audio.setAttribute('src', src);
            else audio.src = src;
            try { audio.load(); } catch (e) { }
            // small timeout before play helps avoid race on some browsers
            setTimeout(() => {
                audio.play().catch(() => { });
            }, 10);
            state.lastAudioSrc = src;
        } catch (err) {
            console.warn('playAudioSrcSafely error', err);
        }
    }

    // load virtual by meta or id (prefers origLoadVirtualAsIndexed / origLoadVirtualSong)
    function loadVirtualByMetaOrId(metaOrId, playlistObj = null) {
        let meta = metaOrId;
        if (!meta) return;
        if (typeof metaOrId === 'string') {
            // treat as id -> find in virtualSongs
            meta = findVirtualById(metaOrId);
            if (!meta) {
                // fallback: treat string as src/title
                meta = { id: metaOrId, src: metaOrId, title: metaOrId };
            }
        }

        // ensure we have virtual in DOM for playlist-index stability
        const kv = ensureVirtualSong(meta);
        if (kv && Number.isFinite(kv.idx)) {
            // prefer original indexed loader if present (it will call loadSong for DOM index)
            if (origLoadVirtualAsIndexed) {
                try { origLoadVirtualAsIndexed(meta, playlistObj); } catch (e) { console.warn('origLoadVirtualAsIndexed threw', e); }
                // canonical pointers
                window.currentEntry = { type: 'virtual', id: String(meta.id || meta.src || meta.title) };
                window.activePlaylist = playlistObj || null;
                // also attempt container3 visuals
                setTimeout(() => syncContainer3ForVirtual(meta, playlistObj), 30);
                return;
            }
        }

        // fallback older API
        if (origLoadVirtualSong) {
            try { origLoadVirtualSong(meta, playlistObj); } catch (e) { console.warn('origLoadVirtualSong threw', e); }
            window.currentEntry = { type: 'virtual', id: String(meta.id || meta.src || meta.title) };
            window.activePlaylist = playlistObj || null;
            setTimeout(() => syncContainer3ForVirtual(meta, playlistObj), 30);
            return;
        }

        // last resort: manually set audio + visuals but ensure we don't break DOM loadSong logic
        playAudioSrcSafely(meta.src || meta.src);
        syncContainer3ForVirtual(meta, playlistObj);
        window.currentEntry = { type: 'virtual', id: String(meta.id || meta.src || meta.title) };
        window.activePlaylist = playlistObj || null;
    }

    // unified public loader (replaces multiple ad-hoc calls)
    window.loadEntry = function (entryOrNumberOrMeta, playlistObj = null) {
        const n = normalizeEntry(entryOrNumberOrMeta);
        if (!n) {
            // maybe raw meta
            if (entryOrNumberOrMeta && typeof entryOrNumberOrMeta === 'object' && entryOrNumberOrMeta.src) {
                return loadVirtualByMetaOrId(entryOrNumberOrMeta, playlistObj);
            }
            return console.warn('loadEntry: invalid entry', entryOrNumberOrMeta);
        }
        if (n.type === 'dom') return loadDomIndex(Number(n.index), playlistObj);
        if (n.type === 'virtual') return loadVirtualByMetaOrId(n.id || entryOrNumberOrMeta, playlistObj);
    };

    // expose small convenience (backwards compat)
    window.ensureVirtualSong = ensureVirtualSong;
    window.loadVirtualByMetaOrId = loadVirtualByMetaOrId;

    // ---------- next / prev / shuffle (playlist-first) ----------
    function findCurrentPosInPlaylist(pl) {
        if (!pl || !Array.isArray(pl.songs)) return -1;
        const cur = window.currentEntry;
        if (!cur) return -1;

        for (let i = 0; i < pl.songs.length; i++) {
            const en = normalizeEntry(pl.songs[i]);
            if (!en) continue;

            // DOM match by index
            if (cur.type === 'dom' && en.type === 'dom' &&
                Number(en.index) === Number(cur.index)) return i;

            // Virtual match by id (loose match: allow src/title if id missing)
            if (cur.type === 'virtual' && en.type === 'virtual') {
                if (String(en.id) === String(cur.id)) return i;

                // fallback: match by src or title if present
                const vA = findVirtualById(en.id);
                const vB = findVirtualById(cur.id);
                if (vA && vB && (vA.src === vB.src || vA.title === vB.title))
                    return i;
            }
        }
        return -1;
    }


    window.playNext = function () {
        const pl = window.activePlaylist;
        if (pl && Array.isArray(pl.songs) && pl.songs.length) {
            let pos = findCurrentPosInPlaylist(pl);
            pos = (pos === -1) ? 0 : ((pos + 1) % pl.songs.length);
            const next = normalizeEntry(pl.songs[pos]);
            if (next) {
                const res = window.loadEntry(next, pl);
                setTimeout(() => {
                    try {
                        const meta = (next.type === 'virtual') ? findVirtualById(next.id) :
                            ((window.songs && window.songs[next.index]) ? {
                                title: window.songs[next.index].dataset.title,
                                artist: window.songs[next.index].dataset.artist,
                                cover: window.songs[next.index].dataset.cover,
                                video: window.songs[next.index].dataset.video
                            } : null);
                        if (meta) syncContainer3ForVirtual(meta, pl);
                    } catch (e) { }
                }, 60);
                return res;
            }

            return;
        }
        // fallback to global songs list
        let idx = null;
        if (window.currentEntry && window.currentEntry.type === 'dom') idx = Number(window.currentEntry.index);
        else if (Number.isFinite(window.currentIndex)) idx = Number(window.currentIndex);
        else idx = -1;
        const arr = window.songs || [];
        if (!arr.length) return;
        idx = ((idx + 1) % arr.length + arr.length) % arr.length;
        return window.loadEntry({ type: 'dom', index: idx }, null);
    };

    window.playPrev = function () {
        const pl = window.activePlaylist;
        if (pl && Array.isArray(pl.songs) && pl.songs.length) {
            let pos = findCurrentPosInPlaylist(pl);
            pos = (pos === -1) ? 0 : ((pos - 1 + pl.songs.length) % pl.songs.length);
            const prev = normalizeEntry(pl.songs[pos]);
            if (prev) {
                const res = window.loadEntry(prev, pl);
                setTimeout(() => {
                    try {
                        const meta = (prev.type === 'virtual') ? findVirtualById(prev.id) :
                            ((window.songs && window.songs[prev.index]) ? {
                                title: window.songs[prev.index].dataset.title,
                                artist: window.songs[prev.index].dataset.artist,
                                cover: window.songs[prev.index].dataset.cover,
                                video: window.songs[prev.index].dataset.video
                            } : null);
                        if (meta) syncContainer3ForVirtual(meta, pl);
                    } catch (e) { }
                }, 60);
                return res;
            }

            return;
        }
        let idx = null;
        if (window.currentEntry && window.currentEntry.type === 'dom') idx = Number(window.currentEntry.index);
        else if (Number.isFinite(window.currentIndex)) idx = Number(window.currentIndex);
        else idx = 0;
        const arr = window.songs || [];
        if (!arr.length) return;
        idx = ((idx - 1 + arr.length) % arr.length + arr.length) % arr.length;
        return window.loadEntry({ type: 'dom', index: idx }, null);
    };

    window.shuffleSong = function () {
        const pl = window.activePlaylist;
        const list = (pl && Array.isArray(pl.songs) && pl.songs.length) ? pl.songs : (Array.isArray(window.songs) ? window.songs.map((_, i) => ({ type: 'dom', index: i })) : []);
        if (!list || list.length <= 1) return;
        let pick = null;
        const maxTry = 8;
        for (let t = 0; t < maxTry; t++) {
            const r = Math.floor(Math.random() * list.length);
            const candidate = normalizeEntry(list[r]);
            if (!candidate) continue;
            if (!window.currentEntry) { pick = candidate; break; }
            if (candidate.type !== window.currentEntry.type) { pick = candidate; break; }
            if (candidate.type === 'dom' && Number(candidate.index) !== Number(window.currentEntry.index)) { pick = candidate; break; }
            if (candidate.type === 'virtual' && String(candidate.id) !== String(window.currentEntry.id)) { pick = candidate; break; }
        }
        if (!pick) pick = normalizeEntry(list[0]);
        if (pick) window.loadEntry(pick, window.activePlaylist || null);
    };

    // ---------- single guarded ended handler (strict src+time validation) ----------
    (function installStrictEndedHandler() {
        let a = window.audio || document.querySelector('audio');
        if (!a) return;

        if (a.__strictEndedInstalled) return;
        a.__strictEndedInstalled = true;

        let lastSrc = null;
        let lastEndedTime = 0;

        function getSrc(el) {
            return (el && el.getAttribute && el.getAttribute('src')) || el?.src || '';
        }

        function onEnded() {
            const now = Date.now();
            const src = getSrc(a);
            const dur = a.duration || 0;
            const ct = a.currentTime || 0;

            // if audio was swapped/reset just before ended
            if (src !== lastSrc && lastSrc !== null) {
                console.log('[ENDED] src changed during ended, ignoring', src);
                lastSrc = src;
                return;
            }

            // verify it's truly ended
            if (dur && ct < dur - 0.3) {
                console.log('[ENDED] rejected early ended, ct/dur=', ct, dur);
                return;
            }

            // debounce duplicates for same src
            if (src === lastSrc && now - lastEndedTime < 3000) {
                console.log('[ENDED] duplicate ignored for', src);
                return;
            }

            lastSrc = src;
            lastEndedTime = now;

            console.log('[ENDED] confirmed true ended for', src);
            try {
                if (typeof window.playNext === 'function') window.playNext();
            } catch (e) {
                console.warn('[ENDED] playNext error', e);
            }
        }

        a.addEventListener('ended', onEnded);
        a.addEventListener('play', () => {
            // reset tracking on new playback
            lastSrc = getSrc(a);
        });
        a.addEventListener('loadstart', () => {
            lastSrc = getSrc(a);
        });

        console.log('[ENDED] strict single handler installed');
    })();



    // ---------- normalize playlist storage (in-place) ----------
    try {
        if (!Array.isArray(window.playlists)) window.playlists = window.playlists || [];
        (window.playlists || []).forEach(pl => {
            if (!Array.isArray(pl.songs)) pl.songs = [];
            pl.songs = pl.songs.map(s => {
                const n = normalizeEntry(s);
                if (n) return n;
                if (isNumberLike(s)) return { type: 'dom', index: Number(s) };
                return { type: 'virtual', id: String(s) };
            });
        });
    } catch (e) { console.warn('normalize existing playlists failed', e); }

    // ---------- patch addSongToPlaylist & addMetaToPlaylist lightly (idempotent) ----------
    if (origAddSongToPlaylist) {
        window.addSongToPlaylist = function (songEntry) {
            const normalized = normalizeEntry(songEntry);
            if (!normalized) {
                // fallback to original if normalization fails
                return origAddSongToPlaylist(songEntry);
            }
            if (!window.activePlaylist) {
                // fallback: call original
                return origAddSongToPlaylist(songEntry);
            }
            // avoid dup
            const already = (window.activePlaylist.songs || []).some(s => {
                const n = normalizeEntry(s);
                if (!n) return false;
                if (n.type !== normalized.type) return false;
                if (n.type === 'dom') return Number(n.index) === Number(normalized.index);
                return String(n.id) === String(normalized.id);
            });
            if (already) return false;
            window.activePlaylist.songs.push(normalized);
            try { if (origRenderPlaylistSongs) origRenderPlaylistSongs(window.activePlaylist); } catch (e) { }
            try { if (typeof savePlaylists === 'function') savePlaylists(); } catch (e) { }
            return true;
        };
    }

    if (origAddMetaToPlaylist) {
        window.addMetaToPlaylist = function (meta = {}, playlistObj) {
            if (!playlistObj) return origAddMetaToPlaylist(meta, playlistObj);
            const vId = meta.id || meta.src || meta.title;
            const entry = normalizeEntry({ type: 'virtual', id: vId });
            const already = playlistObj.songs.some(s => {
                const n = normalizeEntry(s);
                return n && n.type === 'virtual' && String(n.id) === String(entry.id);
            });
            if (!already) {
                playlistObj.songs.push(entry);
                try { if (typeof savePlaylists === 'function') savePlaylists(); } catch (e) { }
                try { if (origRenderPlaylistSongs) origRenderPlaylistSongs(playlistObj); } catch (e) { }
            }
            // keep original behaviour for compatibility
            try { return origAddMetaToPlaylist(meta, playlistObj); } catch (e) { return entry; }
        };
    }

    // ---------- playlist-overlay live refresh helper (safe + rate-limited) ----------
    function refreshPlaylistOverlayIfOpen(pl) {
        try {
            const overlay = document.getElementById('playlist-overlay');
            if (!overlay || !overlay.classList.contains('active')) return;
            const nameEl = document.getElementById('overlay-name');
            if (!nameEl) return;
            if (String((nameEl.textContent || '').trim()) !== String((pl && pl.name || '').trim())) return;
            // debounce to avoid thrash if many add calls happen
            clearTimeout(refreshPlaylistOverlayIfOpen._t);
            refreshPlaylistOverlayIfOpen._t = setTimeout(() => {
                if (origOpenPlaylistOverlay) {
                    try { origOpenPlaylistOverlay(pl); } catch (e) { console.warn('openPlaylistOverlay error', e); }
                } else if (typeof window.renderPlaylistSongs === 'function') {
                    try { window.renderPlaylistSongs(pl); } catch (e) { }
                }
            }, 120);
        } catch (err) { console.warn('refreshPlaylistOverlayIfOpen failed', err); }
    }

    // patch renderPlaylistSongs/add functions to call overlay refresh (defensive)
    if (origRenderPlaylistSongs) {
        window.renderPlaylistSongs = function (pl) {
            try { origRenderPlaylistSongs(pl); } catch (e) { console.warn('renderPlaylistSongs threw', e); }
            try { refreshPlaylistOverlayIfOpen(pl); } catch (e) { }
        };
    }

    // if addSongToPlaylist was patched above, ensure it triggers overlay refresh too
    const _maybeRefreshAfterAdd = function (pl) { try { refreshPlaylistOverlayIfOpen(pl); } catch (e) { } };
    // already in addSongToPlaylist / addMetaToPlaylist we attempted to call save/render; the overlay helper is separate.

    // ---------- expose smaller compatibility helpers ----------
    window.loadVirtualAsIndexed = function (meta, playlistObj) {
        // this wrapper prefers existing orig if any, otherwise uses unified loader
        if (origLoadVirtualAsIndexed) {
            try { origLoadVirtualAsIndexed(meta, playlistObj); } catch (e) { console.warn('origLoadVirtualAsIndexed threw', e); }
            setTimeout(() => syncContainer3ForVirtual(meta, playlistObj), 40);
            setTimeout(() => {
                window.currentEntry = { type: 'virtual', id: String(meta.id || meta.src || meta.title) };
            }, 80);
            state.lastPlayedEntry = JSON.parse(JSON.stringify(window.currentEntry || {}));
            window.activePlaylist = playlistObj || null;
            return;
        }
        // fallback to unified loader
        loadVirtualByMetaOrId(meta, playlistObj);
    };

    window.loadVirtualSong = function (meta, fromPlaylist = null) {
        if (origLoadVirtualSong) {
            try { origLoadVirtualSong(meta, fromPlaylist); } catch (e) { console.warn('origLoadVirtualSong threw', e); }
            setTimeout(() => syncContainer3ForVirtual(meta, fromPlaylist), 40);
            setTimeout(() => {
                window.currentEntry = { type: 'virtual', id: String(meta.id || meta.src || meta.title) };
            }, 80);
            state.lastPlayedEntry = JSON.parse(JSON.stringify(window.currentEntry || {}));
            window.activePlaylist = fromPlaylist || null;
            return;
        }
        loadVirtualByMetaOrId(meta, fromPlaylist);
    };

    // ---------- small debug/status ----------
    console.log('✅ Unified virtual/player patch installed: single-ended-handler, virtual loaders, playlist refresh, video-bg safety.');

})();


// showup hover
document.querySelectorAll('.showup').forEach(el => {
    el.addEventListener('mouseenter', () => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--tooltip-left', rect.left + rect.width / 2 + 'px');
        el.style.setProperty('--tooltip-top', rect.top - 10 + 'px'); // 10px above element
    });
});


/* ===============================
   ▶ Initialize / Safety
================================= */
setPlayingState(false);
audio.volume = Number(volume?.value || 1);

/* load first song if present */
if (!songs || songs.length === 0) refreshSongsArray();
if (songs.length > 0) loadSong(0, null);

const videoBg = document.querySelector(".video-bg");
const videoPlayer = document.getElementById("myVideo");
const expandedCover = document.getElementById("expandedCover");
const coverBackdrop = document.querySelector(".cover-backdrop");

expandBtn2.addEventListener("click", () => {
    videoBg.classList.toggle("expanded");

    if (videoBg.classList.contains("expanded")) {
        if (videoPlayer) videoPlayer.style.opacity = "0"; // Fade out video
        const activeSong = document.querySelector(".songs.active");

        const coverURL =
            activeSong?.getAttribute("data-cover") ||
            document.querySelector(".cover img")?.src ||
            "";

        if (coverURL) {
            expandedCover.src = coverURL;
            applyBackdrop(coverURL);

            extractColor(coverURL, (rgb) => {
                coverBackdrop.style.background =
                    `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
            });
        }
        expandedCover.src = coverURL;
        applyBackdrop(coverURL);

        // Extract Color Dynamically
        extractColor(coverURL, (rgb) => {
            coverBackdrop.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        });
    } else {
        if (videoPlayer) videoPlayer.style.opacity = "1";
        if (expandedCover) expandedCover.src = "";
    }
});

// 🎨 Color Extractor (Canvas Trick - Clean & Lightweight)
function extractColor(imageURL, callback) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageURL;
    img.onload = function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = canvas.height = 50; // small sample for speed
        ctx.drawImage(img, 0, 0, 50, 50);
        try {
            let data = ctx.getImageData(25, 25, 1, 1).data;
            callback({ r: data[0], g: data[1], b: data[2] });
        } catch (error) {
            console.warn("RKD: cover color sampling unavailable", error);
        }
    };
}

function applyBackdrop(coverURL) {
    extractColor(coverURL, (rgb) => {
        coverBackdrop.style.background = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        coverBackdrop.style.opacity = "1"; // make sure it shows up fully
    });
}


/* ============================================================
   🎵 Virtual Songs Library (Invisible Songs Integration)
============================================================ */
window.virtualSongs = [];
window.virtualSongCounter = 0;

function addVirtualSong({ title, artist, cover, src, video, playlist }) {
    const id = `v${String(++window.virtualSongCounter).padStart(3, '0')}`;
    window.virtualSongs.push({
        id,
        title: title || 'Untitled',
        artist: artist || 'Unknown',
        cover: cover || '',
        src: src || '',
        video: video || '',
        playlist: playlist || 'All Songs'
    });
    return id;
}

/* ============================================================
   🧩 Example: Add virtuals easily
============================================================ */
function addVirtualSongs(songArray) {
    songArray.forEach(addVirtualSong);
}

addVirtualSongs([
    {
        title: 'Still Rollin',
        artist: 'Shubh',
        cover: 'https://c.saavncdn.com/775/STILL-ROLLIN-Hindi-2023-20231122223658-500x500.jpg',
        src: 'Still Rollin.mp3',
        video: 'Still Rollin.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Kyon',
        artist: 'Pritam',
        cover: 'https://c.saavncdn.com/099/Barfi--Hindi-2012-20210119211734-500x500.jpg',
        src: 'Kyon.mp3',
        video: 'Kyon.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Perfect',
        artist: 'Ed Sheeran',
        cover: 'https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96',
        src: 'Perfect.mp3',
        video: 'Perfect.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'I Think They Call This Love - Cover',
        artist: 'Matthew Ifield',
        cover: 'https://c.saavncdn.com/864/I-ll-Be-Home-For-Christmas-I-Think-They-Call-This-Love-Cover-English-2024-20241127183502-500x500.jpg',
        src: 'I Think They Call This Love - Cover.mp3',
        video: 'I Think They Call This Love - Cover.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Until I Found You',
        artist: 'Em Beihold',
        cover: 'https://c.saavncdn.com/000/Until-I-Found-You-English-2021-20210901105938-500x500.jpg',
        src: 'until i found you.mp3',
        video: 'Until I Found You.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'A thousand Years',
        artist: 'Christina Perri',
        cover: 'https://c.saavncdn.com/912/A-Thousand-Years-English-2011-20200822053427-500x500.jpg',
        src: 'A thousand Years.mp3',
        video: 'A thousand Years.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Dandelions',
        artist: 'Ruth B.',
        cover: 'https://c.saavncdn.com/400/Dandelions-English-2017-150x150.jpg',
        src: 'Dandelions.mp3',
        video: 'Dandelions.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Happier',
        artist: 'Olivia Rodrigo',
        cover: 'https://c.saavncdn.com/443/SOUR-English-2021-20210622205946-500x500.jpg',
        src: 'happier.mp3',
        video: 'Happier.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Line With A Hook',
        artist: 'Ricky Montgomery',
        cover: 'https://images.genius.com/c17eacd4676137d5780d7ec97b48d6d1.816x816x1.jpg',
        src: 'Line With A Hook.mp3',
        video: 'Line With A Hook.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Sweater Weather',
        artist: 'The Neighbourhood',
        cover: 'https://i.scdn.co/image/ab67616d0000b2738265a736a1eb838ad5a0b921',
        src: 'Sweater Weather.mp3',
        video: 'Sweater Weather.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Heat Waves',
        artist: 'Glass Animals',
        cover: 'https://i.scdn.co/image/ab67616d0000b273712701c5e263efc8726b1464',
        src: 'Heat Waves.mp3',
        video: 'Heat Waves.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'SNAP',
        artist: 'Rosa Linn',
        cover: 'https://i.scdn.co/image/ab67616d0000b273927f72f3739f256fb01d1470',
        src: 'Snap.mp3',
        video: 'SNAP.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Say Yes To Heaven',
        artist: 'Lana Del Rey',
        cover: 'https://i.scdn.co/image/ab67616d0000b273aa27708d07f49c82ff0d0dae',
        src: 'Say Yes To Heaven.mp3',
        video: 'Say Yes To Heaven.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Somewhere Only We Know',
        artist: 'Keane',
        cover: 'https://i.scdn.co/image/ab67616d0000b2737d6cd95a046a3c0dacbc7d33',
        src: 'Somewhere Only We Know.mp3',
        video: 'Somewhere Only We Know.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Mary On A Cross',
        artist: 'Ghost',
        cover: 'https://i.scdn.co/image/ab67616d0000b2733e03417574f87a0a708f8a2a',
        src: 'Mary On A Cross.mp3',
        video: 'Mary On A Cross.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Night Changes',
        artist: 'One Direction',
        cover: 'https://c.saavncdn.com/851/FOUR-Deluxe--English-2014-500x500.jpg',
        src: 'Night Changes.mp3',
        video: 'Night Changes.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'SNAP',
        artist: 'Rosa Linn',
        cover: 'https://i.scdn.co/image/ab67616d0000b273927f72f3739f256fb01d1470',
        src: 'Snap.mp3',
        video: 'SNAP.mp4',
        playlist: 'New Arrivals'
    },
    {
        title: 'Tera Hone Laga Hoon',
        artist: 'Pritam Chakraborty, Atif Aslam, Alisha Chinai',
        cover: 'https://i.scdn.co/image/ab67616d0000b27383c602137f7832cbef7e685c',
        src: 'Tera_Hone_Laga_Hoon.mp3',
        video: '',
        playlist: 'New Arrivals'
    },
    {
        title: 'Tere Naina',
        artist: 'Shankar Ehsaan Loy, Shafqat Amanat Ali ',
        cover: 'https://i.scdn.co/image/ab67616d0000b2734ead1372a95d29819105a7a7',
        src: 'Tere_Naina.mp3',
        video: '',
        playlist: 'New Arrivals'
    },
    {
        title: 'Zaalima',
        artist: 'Arijit Singh, Harshdeep Kaur',
        cover: 'https://c.saavncdn.com/334/Raees-Hindi-2016-20200430093124-500x500.jpg',
        src: 'Zaalima.mp3',
        video: '',
        playlist: 'New Arrivals'
    },
    {
        title: 'SNAP',
        artist: 'Rosa Linn',
        cover: 'https://i.scdn.co/image/ab67616d0000b273927f72f3739f256fb01d1470',
        src: 'Snap.mp3',
        video: 'SNAP.mp4',
        playlist: 'New Arrivals'
    },
]);
console.log('🎧 Virtual song system integrated successfully');


/* ============================
   🎧 MEDIA CONTROL FIX (FINAL)
============================ */

// Prevent any auto-play
audio.autoplay = false;
document.addEventListener("DOMContentLoaded", () => {
    if (!audio.paused) audio.pause();
    audio.currentTime = 0;
});

// Spacebar toggle play/pause
document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.code === "Space") {
        e.preventDefault();
        if (audio.paused) audio.play();
        else audio.pause();
    }
});

// ===============================
// 🎵 Enable Browser Media Keys
// ===============================
(function () {
    if (!('mediaSession' in navigator)) {
        console.warn('Media Session API not available in this browser.');
        return;
    }

    // --- find next/prev handlers that exist in your codebase ---
    const nextHandler =
        (typeof playNext === 'function' && playNext) ||
        (typeof nextSong === 'function' && nextSong) ||
        (typeof nextTrack === 'function' && nextTrack) ||
        null;

    const prevHandler =
        (typeof playPrev === 'function' && playPrev) ||
        (typeof prevSong === 'function' && prevSong) ||
        (typeof prevTrack === 'function' && prevTrack) ||
        null;

    // Helpful debug
    console.log('media keys: nextHandler=', !!nextHandler, 'prevHandler=', !!prevHandler);

    // Action handlers (log so we can debug)
    navigator.mediaSession.setActionHandler('play', () => {
        console.log('MediaSession: play');
        audio.play().catch(err => console.warn('play blocked', err));
    });

    navigator.mediaSession.setActionHandler('pause', () => {
        console.log('MediaSession: pause');
        audio.pause();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
        console.log('MediaSession: nexttrack');
        if (nextHandler) nextHandler();
        else console.warn('No next handler found');
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
        console.log('MediaSession: previoustrack');
        if (prevHandler) prevHandler();
        else console.warn('No prev handler found');
    });

    // Update metadata from current song (uses songs[currentIndex] if available)
    function updateMediaMetadata() {
        try {
            let songEl = null;
            if (Array.isArray(songs) && Number.isFinite(currentIndex) && songs[currentIndex]) {
                songEl = songs[currentIndex];
            }
            // Fallback to title/artist elements if needed
            const title = songEl?.dataset?.title || (titleEl && titleEl.textContent) || 'Unknown';
            const artist = songEl?.dataset?.artist || (artistEl && artistEl.textContent) || 'Unknown';
            const art = songEl?.dataset?.cover || (coverEl && coverEl.src) || '';

            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                artwork: art ? [{ src: art, sizes: '512x512', type: 'image/png' }] : []
            });

            navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
            console.log('MediaSession metadata set:', title, artist, art ? '[artwork]' : '[no artwork]');
        } catch (err) {
            console.warn('updateMediaMetadata error', err);
        }
    }

    // Update metadata on relevant events
    audio.addEventListener('play', () => {
        updateMediaMetadata();
        navigator.mediaSession.playbackState = 'playing';
    });
    audio.addEventListener('pause', () => {
        navigator.mediaSession.playbackState = 'paused';
    });
    audio.onended = () => {
        if (!audio.loop && typeof window.playNext === "function") {
            window.playNext();
        }
    };


    // If your loadSong function already changes currentIndex, call update when metadata changes
    audio.addEventListener('loadeddata', () => updateMediaMetadata());
    audio.addEventListener('loadedmetadata', () => updateMediaMetadata());

    // Also expose a manual hook if you want to call it from loadSong immediately
    window.__updateMediaSessionMetadata = updateMediaMetadata;

    // Small safeguard: ensure user interacts once before attempting autoplay
    document.addEventListener('click', function oneClick() {
        // calling update ensures browser recognizes media session after user interaction
        updateMediaMetadata();
        document.removeEventListener('click', oneClick);
    });

    console.log('Media keys handlers registered.');
})();


/* ============================================================
   RKD: small, reliable local playlist persistence
   Stores playlist names and track references in this browser.
   Remote tracks are stored as metadata and rebuilt on refresh.
============================================================ */
(() => {
    const STORAGE_KEY = "rkd.playlists.v1";

    function metaFromSongElement(el) {
        if (!el) return null;
        return {
            title: el.dataset.title || "Unknown",
            artist: el.dataset.artist || "Unknown",
            cover: el.dataset.cover || "",
            src: el.dataset.src || "",
            video: el.dataset.video || "",
            playlist: el.dataset.playlist || "All Songs"
        };
    }

    function serializeEntry(entry) {
        if (typeof entry === "number") {
            const el = window.songs && window.songs[entry];
            if (el && el.classList && el.classList.contains("virtual-song")) {
                return { kind: "virtual", meta: metaFromSongElement(el) };
            }
            return { kind: "local", index: entry };
        }

        if (entry && typeof entry === "object" && entry.virtual) {
            const v = (window.virtualSongs || []).find(item => String(item.id) === String(entry.id));
            return {
                kind: "virtual",
                meta: v ? {
                    title: v.title, artist: v.artist, cover: v.cover,
                    src: v.src, video: v.video || "", playlist: v.playlist || "Search"
                } : null
            };
        }

        return null;
    }

    window.savePlaylists = function savePlaylists() {
        try {
            const data = (window.playlists || []).map(pl => ({
                name: pl.name,
                songs: (pl.songs || []).map(serializeEntry).filter(Boolean)
            }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            console.warn("RKD: playlists could not be saved.", error);
            return false;
        }
    };

    function restorePlaylists() {
        let saved;
        try {
            saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        } catch (error) {
            console.warn("RKD: saved playlists were unreadable.", error);
            return;
        }

        if (!Array.isArray(saved) || !Array.isArray(window.playlists)) return;
        if (window.playlists.length) return;

        saved.forEach(record => {
            const name = String(record && record.name || "").trim();
            if (!name || window.playlists.some(pl => pl.name === name)) return;

            window.createPlaylist(name);
            const playlist = window.playlists[window.playlists.length - 1];
            if (!playlist) return;

            (Array.isArray(record.songs) ? record.songs : []).forEach(entry => {
                if (entry.kind === "local" && Number.isInteger(entry.index)) {
                    if (window.songs && window.songs[entry.index]) playlist.songs.push(entry.index);
                } else if (entry.kind === "virtual" && entry.meta && entry.meta.src) {
                    const ensured = window.ensureVirtualSong(entry.meta);
                    if (ensured && Number.isInteger(ensured.idx)) playlist.songs.push(ensured.idx);
                }
            });

            if (typeof window.renderPlaylistSongs === "function") {
                window.renderPlaylistSongs(playlist);
            }
        });

        window.savePlaylists();
    }

    // Persist additions made through the existing playlist function.
    const originalAddSongToPlaylist = window.addSongToPlaylist;
    if (typeof originalAddSongToPlaylist === "function") {
        window.addSongToPlaylist = function (...args) {
            const result = originalAddSongToPlaylist.apply(this, args);
            window.savePlaylists();
            return result;
        };
    }

    // Existing remove buttons rebuild the overlay; this observer also persists removals.
    const playlistOverlay = document.getElementById("playlist-overlay");
    if (playlistOverlay) {
        playlistOverlay.addEventListener("click", event => {
            if (event.target.closest(".remove-btn")) {
                setTimeout(window.savePlaylists, 0);
            }
        });
    }

    restorePlaylists();
})();



/* =========================================
   RKD: NOW PLAYING ARTWORK SYNC
   ========================================= */

(function () {
    const panel = document.getElementById("panel2");
    const artwork = document.getElementById("expandedCover");
    const playerArtwork = document.querySelector(".player .cover img");
    const expandButton = document.getElementById("expandBtn2");

    if (!panel || !artwork || !playerArtwork) return;

    function syncNowPlayingArtwork() {
        const currentCover = playerArtwork.currentSrc || playerArtwork.src;

        if (!currentCover) return;

        if (artwork.src !== currentCover) {
            artwork.src = currentCover;
        }
    }

    // Initial synchronization
    syncNowPlayingArtwork();

    // Synchronize after expanding or collapsing
    if (expandButton) {
        expandButton.addEventListener("click", function () {
            requestAnimationFrame(syncNowPlayingArtwork);
            requestAnimationFrame(() => {
                requestAnimationFrame(syncNowPlayingArtwork);
            });
        });
    }

    // Watch for changes to the player artwork
    const imageObserver = new MutationObserver(syncNowPlayingArtwork);

    imageObserver.observe(playerArtwork, {
        attributes: true,
        attributeFilter: ["src"]
    });

    // Also synchronize when the player artwork finishes loading
    playerArtwork.addEventListener("load", syncNowPlayingArtwork);

    // Watch for panel state changes
    const panelObserver = new MutationObserver(syncNowPlayingArtwork);

    panelObserver.observe(panel, {
        attributes: true,
        attributeFilter: ["class"]
    });
})();


