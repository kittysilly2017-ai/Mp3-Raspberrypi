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

let db = null;
let currentFolder = null;
let currentAudio = null;
let currentAudioUrl = null;
let currentPlayingButton = null;

function createId() {
    return Date.now().toString() +
        Math.random().toString(16).slice(2);
}

// DATABASE

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("MusicPlayerDB", 4);

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
                musicStore = event.target.transaction
                    .objectStore("music");
            }

            if (!musicStore.indexNames.contains("folder")) {
                musicStore.createIndex("folder", "folder", {
                    unique: false
                });
            }
        };

        request.onsuccess = function() {
            db = request.result;

            db.onversionchange = function() {
                db.close();
                alert("Please reload the website.");
            };

            resolve(db);
        };

        request.onerror = function() {
            reject(request.error);
        };

        request.onblocked = function() {
            alert("Please close other tabs of this music player and reload.");
        };
    });
}

function checkDatabase() {
    if (!db) {
        throw new Error("Music storage has not opened. Reload the website.");
    }
}

// DATABASE HELPERS

function savePlaylist(name) {
    checkDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("playlists", "readwrite");

        transaction.objectStore("playlists").put({
            name: name
        });

        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function getPlaylists() {
    checkDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("playlists", "readonly");
        const request = transaction.objectStore("playlists").getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function saveSong(song) {
    checkDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("music", "readwrite");

        transaction.objectStore("music").put(song);

        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function getSongs(folderName) {
    checkDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("music", "readonly");
        const index = transaction.objectStore("music").index("folder");
        const request = index.getAll(folderName);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// DISPLAY FOLDERS

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

        button.addEventListener("click", () => {
            openFolder(playlist.name);
        });

        foldersDiv.appendChild(button);
    });
}

// OPEN FOLDER

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

// DISPLAY SONGS

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

        button.addEventListener("click", () => {
            playSong(song, button);
        });

        row.appendChild(name);
        row.appendChild(button);

        songsDiv.appendChild(row);
    });
}

// AUDIO PLAYER

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

    currentAudio.onended = stopAudio;
}

// BACK BUTTON

backButton.addEventListener("click", async function() {
    stopAudio();

    currentFolder = null;

    playlistDiv.hidden = true;
    backButton.hidden = true;

    heading.hidden = false;
    foldersDiv.hidden = false;

    await renderFolders();
});

// IMPORT FOLDER

importFolderButton.addEventListener("click", function() {
    folderInput.click();
});

folderInput.addEventListener("change", async function() {
    try {
        checkDatabase();

        const files = Array.from(folderInput.files || []);

        if (files.length === 0) {
            alert("No files were found in the selected folder.");
            return;
        }

        let imported = 0;
        const folderNames = new Set();

        for (const file of files) {
            const relativePath = file.webkitRelativePath || "";
            const parts = relativePath.split("/");

            const folderName = parts.length > 1 && parts[0]
                ? parts[0]
                : "Imported Folder";

            folderNames.add(folderName);

            if (!file.name.toLowerCase().endsWith(".mp3")) {
                continue;
            }

            await saveSong({
                id: createId(),
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

        alert(imported + " MP3 song(s) imported!");
    } catch (error) {
        console.error("Folder import error:", error);

        alert(
            "Folder import failed:\n" +
            error.name + ": " + error.message
        );
    } finally {
        folderInput.value = "";
    }
});

// ADD SONGS TO OPEN FOLDER

addSongsButton.addEventListener("click", function() {
    if (!currentFolder) {
        alert("Open a folder first.");
        return;
    }

    songInput.click();
});

songInput.addEventListener("change", async function() {
    try {
        checkDatabase();

        const files = Array.from(songInput.files || []);

        if (!currentFolder) {
            alert("Open a folder first.");
            return;
        }

        if (files.length === 0) {
            alert("No songs selected.");
            return;
        }

        let imported = 0;

        for (const file of files) {
            if (!file.name.toLowerCase().endsWith(".mp3")) {
                continue;
            }

            await saveSong({
                id: createId(),
                folder: currentFolder,
                name: file.name.replace(/\.[^/.]+$/, ""),
                blob: file
            });

            imported++;
        }

        await renderSongs();

        alert(imported + " song(s) added!");
    } catch (error) {
        console.error("Add songs error:", error);

        alert(
            "Could not add songs:\n" +
            error.name + ": " + error.message
        );
    } finally {
        songInput.value = "";
    }
});

// START PLAYER

async function start() {
    try {
        await openDatabase();
        await renderFolders();
    } catch (error) {
        console.error("Startup error:", error);

        alert(
            "Music player could not start:\n" +
            error.name + ": " + error.message
        );
    }
}

start();