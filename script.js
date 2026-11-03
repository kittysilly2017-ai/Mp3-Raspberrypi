// ==========================================
// MUSIC PLAYER - COMPLETE SCRIPT
// ==========================================


// ELEMENTS

const folders = document.getElementById("folders");
const playlist = document.getElementById("playlist");
const songs = document.getElementById("songs");
const heading = document.getElementById("heading");
const back = document.getElementById("back");

const folderInput = document.getElementById("folderInput");
const songInput = document.getElementById("songInput");

const importFolderButton = document.getElementById("importFolder");
const addSongsButton = document.getElementById("addSongs");

let currentFolder = null;
let currentAudio = null;
let currentAudioURL = null;
let songCounter = 0;


// ==========================================
// UNIQUE SONG ID
// ==========================================

function createSongId() {
    songCounter++;

    return Date.now() + "-" +
        songCounter + "-" +
        Math.random().toString(36).slice(2);
}


// ==========================================
// DATABASE
// ==========================================

const dbPromise = new Promise((resolve, reject) => {

    if (!window.indexedDB) {
        reject(new Error("IndexedDB is not supported."));
        return;
    }

    const request = indexedDB.open("MusicPlayerDB", 3);

    request.onupgradeneeded = function(event) {

        const db = event.target.result;

        if (!db.objectStoreNames.contains("music")) {

            db.createObjectStore("music", {
                keyPath: "id"
            });

        }

        if (!db.objectStoreNames.contains("playlists")) {

            db.createObjectStore("playlists", {
                keyPath: "name"
            });

        }

    };

    request.onsuccess = function() {
        resolve(request.result);
    };

    request.onerror = function() {
        reject(request.error);
    };

    request.onblocked = function() {
        reject(new Error("Database is blocked."));
    };

});


// ==========================================
// SAVE FOLDER
// ==========================================

async function saveFolder(name) {

    const db = await dbPromise;

    return new Promise((resolve, reject) => {

        const tx = db.transaction(
            "playlists",
            "readwrite"
        );

        tx.objectStore("playlists").put({
            name: name
        });

        tx.oncomplete = () => resolve();

        tx.onerror = () => reject(tx.error);

        tx.onabort = () => reject(tx.error);

    });

}


// ==========================================
// GET FOLDERS
// ==========================================

async function getFolders() {

    const db = await dbPromise;

    return new Promise((resolve, reject) => {

        const request = db
            .transaction("playlists", "readonly")
            .objectStore("playlists")
            .getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };

    });

}


// ==========================================
// SAVE SONG
// ==========================================

async function saveSong(song) {

    const db = await dbPromise;

    return new Promise((resolve, reject) => {

        const tx = db.transaction(
            "music",
            "readwrite"
        );

        tx.objectStore("music").put(song);

        tx.oncomplete = () => resolve();

        tx.onerror = () => reject(tx.error);

        tx.onabort = () => reject(tx.error);

    });

}


// ==========================================
// GET ALL SONGS
// ==========================================

async function getAllSongs() {

    const db = await dbPromise;

    return new Promise((resolve, reject) => {

        const request = db
            .transaction("music", "readonly")
            .objectStore("music")
            .getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };

    });

}


// ==========================================
// IMPORT WHOLE FOLDER
// ==========================================

importFolderButton.onclick = function() {

    folderInput.click();

};


folderInput.onchange = async function() {

    const files = Array.from(folderInput.files);

    if (files.length === 0) {

        alert("No folder contents were received.");

        return;

    }

    try {

        const firstPath = files[0].webkitRelativePath;

        if (!firstPath || !firstPath.includes("/")) {

            alert(
                "Safari did not provide the folder name. " +
                "Please try selecting the folder again."
            );

            return;

        }

        const folderName = firstPath.split("/")[0];

        await saveFolder(folderName);

        let imported = 0;

        for (const file of files) {

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

        await renderFolders();

        alert(
            "Folder imported: " + folderName +
            "\nMP3 songs found: " + imported
        );

    } catch (error) {

        console.error("Folder import error:", error);

        alert(
            "Could not import folder.\n" +
            error.name + ": " + error.message
        );

    }

    folderInput.value = "";

};


// ==========================================
// DISPLAY FOLDERS
// ==========================================

async function renderFolders() {

    const savedFolders = await getFolders();

    folders.innerHTML = "";

    savedFolders.forEach(item => {

        const button = document.createElement("button");

        button.className = "folder";

        const icon = document.createElement("span");

        icon.className = "folder-icon";

        icon.textContent = "📁";

        const label = document.createElement("span");

        label.className = "folder-name";

        label.textContent = item.name;

        button.append(icon, label);

        button.onclick = function() {

            openFolder(item.name);

        };

        folders.appendChild(button);

    });

}


// ==========================================
// OPEN FOLDER
// ==========================================

async function openFolder(name) {

    currentFolder = name;

    folders.hidden = true;

    playlist.hidden = false;

    back.hidden = false;

    heading.textContent = "PLAYLISTS";

    document.getElementById("playlistTitle").textContent =
        "📁 " + name;

    await renderSongs();

}


// ==========================================
// DISPLAY SONGS
// ==========================================

async function renderSongs() {

    const allSongs = await getAllSongs();

    songs.innerHTML = "";

    const playlistSongs = allSongs.filter(song => {

        return song.folder === currentFolder;

    });

    if (playlistSongs.length === 0) {

        songs.textContent = "This folder is empty.";

        return;

    }

    playlistSongs.forEach(song => {

        const row = document.createElement("div");

        row.className = "song";

        const title = document.createElement("span");

        title.textContent = song.name;

        const play = document.createElement("button");

        play.className = "play";

        play.textContent = "▶";

        const pause = document.createElement("button");

        pause.className = "pause";

        pause.textContent = "Ⅱ";

        play.onclick = function() {

            playSong(song);

        };

        pause.onclick = function() {

            if (currentAudio) {
                currentAudio.pause();
            }

        };

        row.append(title, play, pause);

        songs.appendChild(row);

    });

}


// ==========================================
// ADD SONGS TO OPEN FOLDER
// ==========================================

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

    if (files.length === 0) {
        return;
    }

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

        console.error("Add songs error:", error);

        alert(
            "Could not add songs.\n" +
            error.name + ": " + error.message
        );

    }

    songInput.value = "";

};


// ==========================================
// PLAY SONG
// ==========================================

function playSong(song) {

    if (currentAudio) {

        currentAudio.pause();

    }

    if (currentAudioURL) {

        URL.revokeObjectURL(currentAudioURL);

    }

    currentAudioURL = URL.createObjectURL(song.blob);

    currentAudio = new Audio(currentAudioURL);

    currentAudio.play().catch(error => {

        console.error("Playback error:", error);

        alert("Unable to play this song.");

    });

}


// ==========================================
// BACK BUTTON
// ==========================================

back.onclick = function() {

    if (currentAudio) {

        currentAudio.pause();

        currentAudio = null;

    }

    if (currentAudioURL) {

        URL.revokeObjectURL(currentAudioURL);

        currentAudioURL = null;

    }

    currentFolder = null;

    playlist.hidden = true;

    folders.hidden = false;

    back.hidden = true;

    heading.textContent = "FOLDERS";

};


// ==========================================
// START PLAYER
// ==========================================

async function start() {

    try {

        await dbPromise;

        await renderFolders();

    } catch (error) {

        console.error("Startup error:", error);

        alert(
            "Could not open music storage.\n" +
            error.name + ": " + error.message
        );

    }

}

start();