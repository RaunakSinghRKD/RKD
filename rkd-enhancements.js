/* ============================================================
   RKD UI ENHANCEMENTS - FIXED BUILD
   - Click-only add-to-playlist menus for trending songs
   - Uses the existing top-right video-panel three-dot button
   - Creates playlists and adds tracks using RKD's native data format
   - Playlist deletion with confirmation
   - No extra floating dots or hover-triggered menus
   ============================================================ */
(() => {
    "use strict";

    const $ = (selector, context = document) => context.querySelector(selector);
    const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

    const getPlaylists = () => Array.isArray(window.playlists) ? window.playlists : [];
    const getSongs = () => Array.isArray(window.songs) ? window.songs : $$(".songs");

    function notify(message) {
        let toast = $("#rkd-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "rkd-toast";
            toast.setAttribute("role", "status");
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add("visible");
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove("visible"), 2100);
    }

    function savePlaylists() {
        try {
            if (typeof window.savePlaylists === "function") {
                window.savePlaylists();
            } else {
                // Fallback for builds where the app's persistence wrapper is unavailable.
                const records = getPlaylists().map(pl => ({
                    name: pl.name,
                    songs: (pl.songs || []).map(entry => {
                        if (typeof entry === "number") {
                            const el = getSongs()[entry];
                            if (el?.classList.contains("virtual-song")) {
                                return {
                                    kind: "virtual",
                                    meta: {
                                        title: el.dataset.title || "",
                                        artist: el.dataset.artist || "",
                                        cover: el.dataset.cover || "",
                                        src: el.dataset.src || "",
                                        video: el.dataset.video || ""
                                    }
                                };
                            }
                            return { kind: "local", index: entry };
                        }
                        return null;
                    }).filter(Boolean)
                }));
                localStorage.setItem("rkd.playlists.v1", JSON.stringify(records));
            }
        } catch (error) {
            console.error("RKD: could not save playlists", error);
            notify("Could not save playlist changes.");
        }
    }


    function getCardIndex(card) {
        if (!card) return -1;
        const songs = getSongs();
        let index = songs.indexOf(card);
        if (index !== -1) return index;

        // Refresh the global list from the DOM, preserving the app's DOM order.
        const refreshed = $$(".songs");
        if (Array.isArray(window.songs)) {
            window.songs = refreshed;
            return refreshed.indexOf(card);
        }
        return refreshed.indexOf(card);
    }

    function getTrackFromCard(card) {
        const index = getCardIndex(card);
        return index >= 0 ? { index } : null;
    }

    function getCurrentTrack() {
        // Prefer the app's own currentEntry because it is updated by its player.
        const current = window.currentEntry;
        if (current && current.type === "dom" && Number.isInteger(Number(current.index))) {
            return { index: Number(current.index) };
        }
        if (current && current.type === "virtual") {
            const virtual = (window.virtualSongs || []).find(
                item => String(item.id) === String(current.id)
            );
            if (virtual && typeof window.ensureVirtualSong === "function") {
                const ensured = window.ensureVirtualSong(virtual);
                if (ensured && Number.isInteger(Number(ensured.idx))) {
                    return { index: Number(ensured.idx) };
                }
            }
        }

        // Fallback: match the current audio URL to a song element.
        const audio = $("#audio");
        const src = audio?.currentSrc || audio?.src;
        if (src) {
            const match = getSongs().findIndex(card => {
                const candidate = card?.dataset?.src;
                if (!candidate) return false;
                try {
                    return new URL(candidate, document.baseURI).href === new URL(src, document.baseURI).href;
                } catch (_) {
                    return candidate === src;
                }
            });
            if (match >= 0) return { index: match };
        }
        return null;
    }

    function addTrackToPlaylist(track, playlist) {
        if (!track || !Number.isInteger(track.index) || !playlist) {
            notify("Could not identify this song.");
            return false;
        }

        if (!Array.isArray(playlist.songs)) playlist.songs = [];

        // RKD's serializer expects numeric song indexes. Do not push {type,index}
        // objects here: those are not serialized by the current app.js save routine.
        if (playlist.songs.some(entry => Number(entry) === track.index)) {
            notify(`Already in "${playlist.name}".`);
            return false;
        }

        playlist.songs.push(track.index);

        try {
            if (typeof window.renderPlaylistSongs === "function") {
                window.renderPlaylistSongs(playlist);
            }
        } catch (error) {
            console.warn("RKD: playlist render failed", error);
        }

        savePlaylists();
        window.dispatchEvent(new CustomEvent("rkd:playlist-updated", { detail: { playlist } }));
        notify(`Added to "${playlist.name}".`);
        return true;
    }

    function createPlaylistAndAdd(track) {
        const rawName = window.prompt("Enter a name for your new playlist:");
        if (rawName === null) return;

        const name = rawName.trim();
        if (!name) {
            notify("Enter a playlist name.");
            return;
        }

        const duplicate = getPlaylists().find(
            playlist => String(playlist.name).toLowerCase() === name.toLowerCase()
        );
        if (duplicate) {
            notify("A playlist with that name already exists.");
            return;
        }

        if (typeof window.createPlaylist !== "function") {
            notify("Playlist creation is unavailable. Refresh the page and try again.");
            return;
        }

        const before = getPlaylists().length;
        try {
            window.createPlaylist(name);
        } catch (error) {
            console.error("RKD: createPlaylist failed", error);
            notify("Playlist could not be created.");
            return;
        }

        // The app's createPlaylist() pushes synchronously into window.playlists.
        const created = getPlaylists().find(playlist => playlist.name === name)
            || getPlaylists()[before];

        if (!created) {
            notify("Playlist was not created. Check the playlist panel.");
            return;
        }

        savePlaylists();
        addTrackToPlaylist(track, created);
        refreshPlaylistMenus();
    }

    function closeMenus() {
    $$(".rkd-action-menu").forEach(menu => menu.remove());
    closePlaylistMenus();
}

    function openAddMenu(anchor, track) {
        if (!anchor || !track) {
            notify("Play a song first.");
            return;
        }

        closeMenus();

        const menu = document.createElement("div");
        menu.className = "rkd-action-menu";
        menu.setAttribute("role", "menu");

        const title = document.createElement("div");
        title.className = "rkd-action-menu-heading";
        title.textContent = "Add to playlist";
        menu.appendChild(title);

        const createButton = document.createElement("button");
        createButton.type = "button";
        createButton.className = "rkd-action-menu-create";
        createButton.textContent = "+ Create new playlist";
        createButton.addEventListener("click", () => {
            closeMenus();
            createPlaylistAndAdd(track);
        });
        menu.appendChild(createButton);

        const divider = document.createElement("div");
        divider.className = "rkd-action-menu-divider";
        menu.appendChild(divider);

        const playlists = getPlaylists();
        if (!playlists.length) {
            const empty = document.createElement("div");
            empty.className = "rkd-action-menu-empty";
            empty.textContent = "No playlists yet. Create one above.";
            menu.appendChild(empty);
        } else {
            playlists.forEach(playlist => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "rkd-action-menu-item";
                button.textContent = playlist.name;
                button.addEventListener("click", () => {
                    addTrackToPlaylist(track, playlist);
                    closeMenus();
                });
                menu.appendChild(button);
            });
        }

        document.body.appendChild(menu);

        const rect = anchor.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const left = Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, rect.left));
        const below = rect.bottom + menuRect.height + 8 <= window.innerHeight;
        const top = below
            ? rect.bottom + 6
            : Math.max(8, rect.top - menuRect.height - 6);

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        const onOutside = event => {
            if (!menu.contains(event.target) && !anchor.contains(event.target)) {
                closeMenus();
                document.removeEventListener("pointerdown", onOutside, true);
            }
        };
        setTimeout(() => document.addEventListener("pointerdown", onOutside, true), 0);
    }


    function closePlaylistMenus(except) {
        $$(".playlist-context-menu").forEach(menu => {
            if (menu === except) return;

            menu.hidden = true;

            const host = menu._rkdHost;
            if (host && menu.parentElement !== host) {
                host.appendChild(menu);
            }

            menu.style.position = "";
            menu.style.left = "";
            menu.style.top = "";
            menu.style.right = "";
            menu.style.bottom = "";
            menu.style.zIndex = "";
        });

        $$(".playlist-menu-wrap.is-open").forEach(wrap => {
            wrap.classList.remove("is-open");

            const trigger = $(".playlist-menu-trigger", wrap);
            if (trigger) trigger.setAttribute("aria-expanded", "false");
        });
    }


    function runPlaylistAction(action, card) {
        const name = card.dataset.title || $(".pl-name", card)?.textContent?.trim();
        const playlist = getPlaylists().find(pl => pl.el === card || pl.name === name);
        if (!playlist) {
            notify("Could not find this playlist.");
            return;
        }

        if (action === "shuffle") {
            const entries = Array.isArray(playlist.songs) ? playlist.songs.slice() : [];
            if (!entries.length) {
                notify("This playlist is empty.");
                return;
            }
            const entry = entries[Math.floor(Math.random() * entries.length)];
            window.activePlaylist = playlist;
            if (typeof entry === "number" && typeof window.loadSong === "function") {
                window.loadSong(entry, playlist);
            } else if (entry && entry.virtual) {
                const meta = (window.virtualSongs || []).find(v => String(v.id) === String(entry.id));
                if (meta && typeof window.loadVirtualAsIndexed === "function") {
                    window.loadVirtualAsIndexed(meta, playlist);
                } else {
                    notify("This playlist track could not be loaded.");
                    return;
                }
            } else {
                notify("This playlist track could not be loaded.");
                return;
            }
            notify(`Shuffling "${playlist.name}".`);
            return;
        }

        if (action === "edit") {
            if (typeof window.openPlaylistOverlay !== "function") {
                notify("Playlist editor is unavailable. Refresh the page and try again.");
                return;
            }

            window.activePlaylist = playlist;
            window.openPlaylistOverlay(playlist);
            return;
        }

        
if (action === "rename") {
    const entered = window.prompt(
        "Enter the new playlist name:",
        playlist.name
    );

    if (entered === null) return;

    const nextName = entered.trim();

    if (!nextName) {
        notify("Playlist name cannot be empty.");
        return;
    }

    const duplicate = getPlaylists().some(pl =>
        pl !== playlist &&
        String(pl.name).toLowerCase() === nextName.toLowerCase()
    );

    if (duplicate) {
        notify("A playlist with that name already exists.");
        return;
    }

    // Determine whether this playlist is currently selected.
    const isActive = card.classList.contains("active");

    // Update the actual playlist data.
    playlist.name = nextName;
    card.dataset.title = nextName;

    // Update the Library playlist name.
    const label = $(".pl-name", card);

    if (label) {
        label.textContent = nextName;
        label.title = nextName;
    }

    // Update the large playlist overlay immediately.
    const overlay = document.getElementById("playlist-overlay");
    const overlayName = document.getElementById("overlay-name");

    if (isActive && overlay && overlay.classList.contains("active")) {
        if (overlayName) {
            overlayName.textContent = nextName;
        }

        // Refresh the overlay using the renamed playlist object.
        if (typeof window.openPlaylistOverlay === "function") {
            window.openPlaylistOverlay(playlist);
        }
    }

    // Update Panel 3 immediately when this playlist is selected.
    if (isActive) {
        const playerPlaylistName =
            document.getElementById("playlist-name") ||
            document.getElementById("playlistName");

        if (playerPlaylistName) {
            playerPlaylistName.textContent = nextName;
        }

        // Keep the enhancement-side reference synchronized.
        window.activePlaylist = playlist;
    }

    // Persist the renamed playlist.
    savePlaylists();

    notify("Playlist renamed.");
    return;
}


        if (action === "delete") {
            if (!window.confirm(`Delete "${playlist.name}"? This cannot be undone.`)) return;
            const index = getPlaylists().indexOf(playlist);
            if (index >= 0) getPlaylists().splice(index, 1);
            if (window.activePlaylist === playlist) window.activePlaylist = null;
            card.remove();
            savePlaylists();
            notify(`Deleted "${playlist.name}".`);
        }
    }

    function refreshPlaylistMenus() {
        $$(".user-playlist").forEach(card => {
            const header = $(".pl-header", card);
            if (!header || $(".playlist-menu-wrap", header)) return;

            const wrap = document.createElement("div");
            wrap.className = "playlist-menu-wrap";

            const trigger = document.createElement("button");
            trigger.type = "button";
            trigger.className = "playlist-menu-trigger";
            trigger.textContent = "⋯";
            trigger.title = "Playlist options";
            trigger.setAttribute("aria-label", "Playlist options");
            trigger.setAttribute("aria-haspopup", "true");
            trigger.setAttribute("aria-expanded", "false");

            const menu = document.createElement("div");
            menu.className = "playlist-context-menu";
            menu.hidden = true;
            menu.setAttribute("role", "menu");

            [
                ["shuffle", "Shuffle play", false],
                ["edit", "Edit playlist", false],
                ["rename", "Edit playlist name", false],
                ["delete", "Delete playlist", true]
            ].forEach(([action, label, danger]) => {
                const item = document.createElement("button");
                item.type = "button";
                item.textContent = label;
                item.dataset.action = action;
                item.setAttribute("role", "menuitem");
                if (danger) item.classList.add("danger");
                item.addEventListener("click", event => {
                    event.preventDefault();
                    event.stopPropagation();
                    closePlaylistMenus();
                    runPlaylistAction(action, card);
                });
                menu.appendChild(item);
            });

            
trigger.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    const willOpen = menu.hidden;

    closePlaylistMenus();

    if (!willOpen) return;

    menu._rkdHost = wrap;
    document.body.appendChild(menu);

    menu.hidden = false;

    const rect = trigger.getBoundingClientRect();

    // Measure after making the menu visible.
    const menuRect = menu.getBoundingClientRect();

    const margin = 8;
    const gap = 6;

    let left = rect.right - menuRect.width;
    left = Math.max(
        margin,
        Math.min(left, window.innerWidth - menuRect.width - margin)
    );

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top;

    if (spaceBelow >= menuRect.height + gap) {
        top = rect.bottom + gap;
    } else if (spaceAbove >= menuRect.height + gap) {
        top = rect.top - menuRect.height - gap;
    } else {
        top = Math.max(
            margin,
            Math.min(
                rect.bottom + gap,
                window.innerHeight - menuRect.height - margin
            )
        );
    }

    menu.style.position = "fixed";
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.right = "auto";
    menu.style.bottom = "auto";
    menu.style.zIndex = "51000";

    trigger.setAttribute("aria-expanded", "true");
    wrap.classList.add("is-open");
});


            wrap.append(trigger, menu);
            header.appendChild(wrap);
        });
    }

    document.addEventListener("click", event => {
    if (
        !event.target.closest(".playlist-menu-wrap") &&
        !event.target.closest(".playlist-context-menu")
    ) {
        closePlaylistMenus();
    }
});
    function bindSongAddButtons() {
        // Capture the click before app.js's older add-btn handler.
        // This ensures the new picker is the only action performed.
        document.addEventListener("click", event => {
            const button = event.target.closest(".add-btn");
            if (!button) return;

            const card = button.closest(".songs");
            const track = getTrackFromCard(card);

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            if (!track) {
                notify("Could not identify this song.");
                return;
            }
            openAddMenu(button, track);
        }, true);
    }

    function bindExistingVideoMoreButton() {
        // Use the existing three-dot control in the video panel.
        // Do not inject another floating button over the video.
        const button = $(".container3 .more-button");
        if (!button || button.dataset.rkdBound === "true") return;

        button.dataset.rkdBound = "true";
        button.setAttribute("aria-label", "More options for currently playing song");
        button.title = "Add currently playing song to a playlist";

        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const track = getCurrentTrack();
            if (!track) {
                notify("Play a song first to add it to a playlist.");
                return;
            }
            openAddMenu(button, track);
        }, true);
    }

    function init() {
        bindSongAddButtons();
        bindExistingVideoMoreButton();
        refreshPlaylistMenus();

        const playlistRoot = $("#playlistContainer") || $("#playlist-container");
        if (playlistRoot) {
            const observer = new MutationObserver(refreshPlaylistMenus);
            observer.observe(playlistRoot, { childList: true, subtree: true });
        }

        window.addEventListener("resize", closeMenus, { passive: true });
        window.addEventListener("scroll", closeMenus, { passive: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();


/* =====================================================
   RKD MOBILE NAVIGATION
   Home | Library | Now Playing
   ===================================================== */

(() => {
    "use strict";

    const MOBILE_QUERY = window.matchMedia("(max-width: 700px)");

    function setupRKDMobileNavigation() {
        if (document.getElementById("rkd-mobile-nav")) return;

        const nav = document.createElement("nav");
        nav.id = "rkd-mobile-nav";
        nav.setAttribute("aria-label", "Mobile navigation");

        nav.innerHTML = `
            <button type="button" data-rkd-view="home" aria-label="Home">
                <span class="rkd-mobile-nav-icon">⌂</span>
                <span>Home</span>
            </button>

            <button type="button" data-rkd-view="library" aria-label="Library">
                <span class="rkd-mobile-nav-icon">▤</span>
                <span>Library</span>
            </button>

            <button type="button" data-rkd-view="player" aria-label="Now Playing">
                <span class="rkd-mobile-nav-icon">♫</span>
                <span>Player</span>
            </button>
        `;

        document.body.appendChild(nav);

        nav.addEventListener("click", event => {
            const button = event.target.closest("[data-rkd-view]");
            if (!button) return;

            setMobileView(button.dataset.rkdView);
        });

        window.addEventListener("resize", handleMobileBreakpoint);

        handleMobileBreakpoint();
    }

    function setMobileView(view) {
        const validViews = ["home", "library", "player"];
        if (!validViews.includes(view)) return;

        document.body.classList.remove(
            "rkd-mobile-view-home",
            "rkd-mobile-view-library",
            "rkd-mobile-view-player"
        );

        document.body.classList.add(`rkd-mobile-view-${view}`);

        document.querySelectorAll("#rkd-mobile-nav [data-rkd-view]")
            .forEach(button => {
                const selected = button.dataset.rkdView === view;

                button.classList.toggle("active", selected);
                button.setAttribute("aria-current", selected ? "page" : "false");
            });

        // Reset the selected panel's scroll position.
        const panelMap = {
            home: ".container2",
            library: "#panel1",
            player: "#panel2"
        };

        const panel = document.querySelector(panelMap[view]);
        if (panel) panel.scrollTop = 0;
    }

    function handleMobileBreakpoint() {
        if (MOBILE_QUERY.matches) {
            if (
                !document.body.classList.contains("rkd-mobile-view-home") &&
                !document.body.classList.contains("rkd-mobile-view-library") &&
                !document.body.classList.contains("rkd-mobile-view-player")
            ) {
                setMobileView("home");
            }
        } else {
            document.body.classList.remove(
                "rkd-mobile-view-home",
                "rkd-mobile-view-library",
                "rkd-mobile-view-player"
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupRKDMobileNavigation);
    } else {
        setupRKDMobileNavigation();
    }
})();

