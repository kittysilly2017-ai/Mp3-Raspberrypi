// ========================================
//              MUSIC PLAYER
// ========================================

// ========================================
//              DATABASE SETUP
// ========================================

let db;

const request = indexedDB.open("MusicPlayerDB", 3);

request.onupgradeneeded = function(event) {
    const database = event.target.result;

    if (!database.objectStoreNames.contains("playlists")) {
        database.createObjectStore("playlists", {
            keyPath: "name"
        });
    }

    let musicStore;

    if (!database.objectStoreNames.contains("music")) {
        musicStore = database.createObjectStore("music", {
            keyPath: "id"
        });
    } else {
        musicStore = event.target.transaction.objectStore("music");
    }

    if (!musicStore.indexNames.contains("folder")) {
        musicStore.createIndex("folder", "folder", {
            unique: false
        });
    }
};

request.onsuccess = function(event) {
    db = event.target.result;
    renderFolders();
};

request.onerror = function() {
    alert("Could not open music storage.");
};

// ========================================
//              ELEMENTS
// ========================================

const heading = document.getElementById("heading");
const foldersDiv = document.getElementById("folders");
const playlistDiv = document.getElementById("playlist");
const playlistTitle = document.getElementById("playlistTitle");
const songsDiv = document.getElementById("songs");

const backButton = document.getElementById("back");
const importFolderButton = document.getElementById("importFolder");
const folderInput = document.getElementById("folderInput");

const addSongsButton = document.getElementById("addSongs");
const songInput = document.getElementById("songInput");

let currentFolder = null;
let currentAudio = null;
let currentAudioUrl = null;
let currentPlayingButton = null;

// ========================================
//              DATABASE FUNCTIONS
// ========================================

function createSongId() {
    return Date.now().toString() +
        Math.random().toString(16).slice(2);
}

function saveSong(song) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("music", "readwrite");

        transaction.objectStore("music").put(song);

        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
}

function savePlaylist(name) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("playlists", "readwrite");

        transaction.objectStore("playlists").put({
            name: name
        });

        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
}

function getPlaylists() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("playlists", "readonly");
        const request = transaction.objectStore("playlists").getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getSongs(folderName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("music", "readonly");

        const index = transaction
            .objectStore("music")
            .index("folder");

        const request = index.getAll(folderName);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ========================================
//              DISPLAY FOLDERS
// ========================================

async function renderFolders() {
    const playlists = await getPlaylists();

    foldersDiv.innerHTML = "";

    playlists.forEach(playlist => {
        const button = document.createElement("button");
        button.className = "folder";

        const icon = document.createElement("span");
        icon.className = "folder-icon";
        icon.textContent = "📁";

        const name = document.createElement("span");
        name.className = "folder-name";
        name.textContent = playlist.name;

        button.appendChild(icon);
        button.appendChild(name);

        button.onclick = function() {
            openFolder(playlist.name);
        };

        foldersDiv.appendChild(button);
    });
}

// ========================================
//              OPEN FOLDER
// ========================================

async function openFolder(name) {
    stopAudio();

    currentFolder = name;

    heading.hidden = true;
    foldersDiv.hidden = true;
    playlistDiv.hidden = false;
    backButton.hidden = false;

    playlistTitle.textContent = name;

    await renderSongs();
}

// ========================================
//              DISPLAY SONGS
// ========================================

async function renderSongs() {
    const songs = await getSongs(currentFolder);

    songsDiv.innerHTML = "";

    if (songs.length === 0) {
        songsDiv.textContent = "No songs in this folder yet.";
        return;
    }

    songs.forEach(song => {
        const row = document.createElement("div");
        row.className = "song";

        const name = document.createElement("span");
        name.textContent = song.name;

        const button = document.createElement("button");
        button.className = "play";
        button.textContent = "▶";

        button.onclick = function() {
            playSong(song, button);
        };

        row.appendChild(name);
        row.appendChild(button);

        songsDiv.appendChild(row);
    });
}

// ========================================
//              MUSIC PLAYER
// ========================================

function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
    }

    if (currentPlayingButton) {
        currentPlayingButton.textContent = "▶";
        currentPlayingButton.className = "play";
        currentPlayingButton = null;
    }
}

function playSong(song, button) {
    if (currentPlayingButton === button && currentAudio) {
        if (currentAudio.paused) {
            currentAudio.play();
            button.textContent = "Ⅱ";
            button.className = "pause";
        } else {
            currentAudio.pause();
            button.textContent = "▶";
            button.className = "play";
        }

        return;
    }

    stopAudio();

    currentAudioUrl = URL.createObjectURL(song.blob);
    currentAudio = new Audio(currentAudioUrl);
    currentPlayingButton = button;

    button.textContent = "Ⅱ";
    button.className = "pause";

    currentAudio.play().catch(error => {
        alert("Could not play song: " + error.message);
        stopAudio();
    });

    currentAudio.onended = function() {
        stopAudio();
    };
}

// ========================================
//              BACK BUTTON
// ========================================

backButton.onclick = async function() {
    stopAudio();

    currentFolder = null;

    playlistDiv.hidden = true;
    backButton.hidden = true;

    heading.hidden = false;
    foldersDiv.hidden = false;

    await renderFolders();
};

// ========================================
//              IMPORT FOLDER
// ========================================

importFolderButton.onclick = function() {
    folderInput.click();
};

folderInput.onchange = async function() {
    const files = Array.from(folderInput.files);

    if (files.length === 0) return;

    let imported = 0;
    const folderNames = new Set();

    try {
        for (const file of files) {
            const relativePath = file.webkitRelativePath || file.name;
            const parts = relativePath.split("/");

            const folderName = parts.length > 1
                ? parts[0]
                : "Imported Folder";

            folderNames.add(folderName);

            if (!file.name.toLowerCase().endsWith(".mp3")) {
                continue;
            }

            await saveSong({
                id: folderName + "/" + createSongId(),
                folder: folderName,
                name: file.name.replace(/\.[^/.]+$/, ""),
                blob: file
            });

            imported++;
        }

        for (const name of folderNames) {
            await savePlaylist(name);
        }

        await renderFolders();

        alert(imported + " songs imported!");

    } catch (error) {
        console.error(error);
        alert("Folder import failed: " + error.message);
    }

    folderInput.value = "";
};

// ========================================
//              ADD SONGS
// ========================================

addSongsButton.onclick = function() {
    if (currentFolder) {
        songInput.click();
    }
};

songInput.onchange = async function() {
    const files = Array.from(songInput.files);

    if (!currentFolder) {
        alert("Open a folder first.");
        return;
    }

    if (files.length === 0) return;

    let imported = 0;

    try {
        for (const file of files) {
            if (!file.name.toLowerCase().endsWith(".mp3")) {
                continue;
            }

            await saveSong({
                id: currentFolder + "/" + createSongId(),
                folder: currentFolder,
                name: file.name.replace(/\.[^/.]+$/, ""),
                blob: file
            });

            imported++;
        }

        await renderSongs();

        alert(imported + " songs added!");

    } catch (error) {
        console.error(error);
        alert("Could not add songs: " + error.message);
    }

    songInput.value = "";
};

// ========================================
//              END OF SCRIPT
// ========================================
