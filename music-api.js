/*
 * RKD Music Search
 * Search and stream tracks from Audius' open music catalogue.
 *
 * Audius documents read-only API access for track search and streaming.
 * API keys are optional for basic read-only use; add one through a backend
 * later if the project needs higher rate limits.
 */
(() => {
    "use strict";

    const API_BASES = [
        "https://api.audius.co/v1",
        "https://discoveryprovider.audius.co/v1"
    ];
    const APP_NAME = "RKD";
    const searchInput = document.querySelector(".serch input");
    const overlay = document.getElementById("search-overlay");
    const topCard = document.getElementById("top-result-card");
    const topThumb = document.getElementById("topThumb");
    const topTitle = document.getElementById("topTitle");
    const topArtist = document.getElementById("topArtist");
    const topMeta = document.getElementById("topMetaSmall");
    const resultsBox = document.getElementById("search-results");

    if (!searchInput || !overlay || !topCard || !resultsBox) return;

    let debounceTimer = null;
    let activeController = null;
    let latestRequest = 0;
    const registeredTracks = new Map();

    function artworkFor(track) {
        const artwork = track.artwork || {};
        return artwork["480x480"] || artwork["150x150"] ||
            artwork["1000x1000"] || artwork["100x100"] || "";
    }

    function artistFor(track) {
        return track.user?.name || track.artist || "Unknown artist";
    }

    function makeStreamUrl(trackId, base) {
        return `${base}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${encodeURIComponent(APP_NAME)}`;
    }

    async function requestTracks(query, signal) {
        const params = new URLSearchParams({
            query,
            limit: "20",
            app_name: APP_NAME
        });

        let lastError;
        for (const base of API_BASES) {
            try {
                const response = await fetch(`${base}/tracks/search?${params.toString()}`, {
                    method: "GET",
                    headers: { "Accept": "application/json" },
                    signal
                });
                if (!response.ok) throw new Error(`Audius returned ${response.status}`);
                const payload = await response.json();
                if (!Array.isArray(payload.data)) throw new Error("Unexpected Audius response");
                return { tracks: payload.data, base };
            } catch (error) {
                if (error.name === "AbortError") throw error;
                lastError = error;
            }
        }
        throw lastError || new Error("Music search is currently unavailable.");
    }

    function registerTrack(track, base) {
        const key = String(track.id);
        const streamUrl = makeStreamUrl(track.id, base);
        let virtual = registeredTracks.get(key);

        if (!virtual) {
            const virtualId = window.addVirtualSong({
                title: track.title || "Untitled",
                artist: artistFor(track),
                cover: artworkFor(track),
                src: streamUrl,
                playlist: "Audius"
            });
            virtual = (window.virtualSongs || []).find(item => item.id === virtualId);
            if (!virtual) return null;
            registeredTracks.set(key, virtual);
        } else {
            virtual.src = streamUrl;
            virtual.cover = artworkFor(track) || virtual.cover;
        }

        virtual.provider = "Audius";
        virtual.providerId = key;
        virtual.permalink = track.permalink || `https://audius.co`;
        virtual.duration = Number(track.duration) || 0;
        return virtual;
    }

    function createResultRow(track, virtual) {
        const row = document.createElement("div");
        row.className = "search-result-item";
        row.setAttribute("role", "listitem");

        const left = document.createElement("div");
        left.className = "result-left";
        const image = document.createElement("img");
        image.className = "result-thumb";
        image.alt = "";
        image.loading = "lazy";
        image.src = virtual.cover || "";
        left.appendChild(image);

        const details = document.createElement("div");
        details.className = "result-details";
        const title = document.createElement("div");
        title.className = "result-title";
        title.textContent = virtual.title;
        const artist = document.createElement("div");
        artist.className = "result-artist";
        artist.textContent = `${virtual.artist} · Audius`;
        details.append(title, artist);

        const actions = document.createElement("div");
        actions.className = "result-actions";
        const addButton = document.createElement("button");
        addButton.className = "result-more";
        addButton.type = "button";
        addButton.title = "Add to playlist";
        addButton.setAttribute("aria-label", `Add ${virtual.title} to a playlist`);
        addButton.textContent = "+";
        actions.appendChild(addButton);

        row.append(left, details, actions);

        row.addEventListener("click", event => {
            if (event.target.closest(".result-more")) return;
            window.loadVirtualSong(virtual, null);
        });

        addButton.addEventListener("click", event => {
            event.stopPropagation();
            showPlaylistPicker(addButton, virtual);
        });

        return row;
    }

    function showPlaylistPicker(anchor, virtual) {
        document.querySelectorAll(".rkd-playlist-picker").forEach(node => node.remove());

        const playlists = window.playlists || [];
        const picker = document.createElement("div");
        picker.className = "rkd-playlist-picker";
        Object.assign(picker.style, {
            position: "fixed",
            zIndex: "30000",
            minWidth: "180px",
            maxWidth: "240px",
            padding: "8px",
            borderRadius: "8px",
            background: "#282828",
            color: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,.5)"
        });

        const rect = anchor.getBoundingClientRect();
        picker.style.left = `${Math.max(8, Math.min(window.innerWidth - 200, rect.left - 150))}px`;
        picker.style.top = `${Math.min(window.innerHeight - 60, rect.bottom + 6)}px`;

        const heading = document.createElement("div");
        heading.textContent = "Add to playlist";
        heading.style.cssText = "padding:6px 8px;color:#bbb;font-size:12px;";
        picker.appendChild(heading);

        if (!playlists.length) {
            const empty = document.createElement("div");
            empty.textContent = "Create a playlist first";
            empty.style.padding = "8px";
            picker.appendChild(empty);
        } else {
            playlists.forEach(playlist => {
                const option = document.createElement("button");
                option.type = "button";
                option.textContent = playlist.name;
                option.style.cssText = "display:block;width:100%;padding:9px 8px;text-align:left;border:0;border-radius:5px;background:transparent;color:#fff;cursor:pointer;";
                option.addEventListener("mouseenter", () => option.style.background = "#444");
                option.addEventListener("mouseleave", () => option.style.background = "transparent");
                option.addEventListener("click", () => {
                    const ensured = window.ensureVirtualSong({
                        title: virtual.title,
                        artist: virtual.artist,
                        cover: virtual.cover,
                        src: virtual.src,
                        playlist: "Audius"
                    });
                    if (ensured && Number.isInteger(ensured.idx)) {
                        if (!playlist.songs.includes(ensured.idx)) {
                            playlist.songs.push(ensured.idx);
                            window.savePlaylists?.();
                            window.renderPlaylistSongs?.(playlist);
                        }
                    }
                    picker.remove();
                });
                picker.appendChild(option);
            });
        }

        document.body.appendChild(picker);
        const closePicker = event => {
            if (!picker.contains(event.target) && event.target !== anchor) {
                picker.remove();
                document.removeEventListener("click", closePicker);
            }
        };
        setTimeout(() => document.addEventListener("click", closePicker), 0);
    }

    function renderRemoteResults(tracks, base, query) {
        const usable = tracks.filter(track =>
            track && track.id && track.title && track.is_streamable !== false
        );

        resultsBox.replaceChildren();

        if (!usable.length) {
            const empty = document.createElement("div");
            empty.className = "search-empty";
            empty.textContent = `No playable Audius tracks found for "${query}". Try another search.`;
            resultsBox.appendChild(empty);
            topThumb.removeAttribute("src");
            topTitle.textContent = "No playable results";
            topArtist.textContent = "";
            topMeta.textContent = "Search Audius for another track";
            topCard.dataset.type = "";
            topCard.dataset.idx = "";
            overlay.classList.add("active");
            return;
        }

        const first = registerTrack(usable[0], base);
        if (first) {
            topThumb.src = first.cover || "";
            topTitle.textContent = first.title;
            topArtist.textContent = first.artist;
            topMeta.textContent = "Full track · Audius";
            topCard.dataset.type = "virtual";
            topCard.dataset.idx = first.id;
        }

        usable.slice(0, 15).forEach(track => {
            const virtual = registerTrack(track, base);
            if (virtual) resultsBox.appendChild(createResultRow(track, virtual));
        });

        overlay.classList.add("active");
        overlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("search-active");
    }

    async function searchAudius(query, requestNumber) {
        if (activeController) activeController.abort();
        activeController = new AbortController();

        try {
            const result = await requestTracks(query, activeController.signal);
            if (requestNumber !== latestRequest) return;
            renderRemoteResults(result.tracks, result.base, query);
        } catch (error) {
            if (error.name === "AbortError") return;
            console.warn("RKD music search:", error);
            if (requestNumber !== latestRequest) return;

            const message = document.createElement("div");
            message.className = "search-empty";
            message.textContent = "Music search is temporarily unavailable. Your local library is still available.";
            resultsBox.appendChild(message);
            overlay.classList.add("active");
        }
    }

    searchInput.addEventListener("input", event => {
        const query = event.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            if (activeController) activeController.abort();
            return;
        }

        debounceTimer = setTimeout(() => {
            const requestNumber = ++latestRequest;
            searchAudius(query, requestNumber);
        }, 450);
    });

    console.info("RKD: Audius music search ready.");
})();
