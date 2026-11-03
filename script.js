const heading = document.getElementById("heading");
const foldersDiv = document.getElementById("folders");
const playlistDiv = document.getElementById("playlist");
const playlistTitle = document.getElementById("playlistTitle");
const songsDiv = document.getElementById("songs");

const backButton = document.getElementById("back");
const folderInput = document.getElementById("folderInput");
const songInput = document.getElementById("songInput");
const addSongsButton = document.getElementById("addSongs");

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
            const transaction = event.target.transaction;

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
                musicStore = transaction.objectStore("music");
            }

            if (!musicStore.indexNames.contains("folder")) {
                music