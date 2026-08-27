"use strict";


/* =========================================================
   ADOFAI WEB PLAYER
   ========================================================= */


/* =========================================================
   DOM
   ========================================================= */

const fileInput =
    document.getElementById("fileInput");

const dropZone =
    document.getElementById("dropZone");

const uploadScreen =
    document.getElementById("uploadScreen");

const levelSelectScreen =
    document.getElementById("levelSelectScreen");

const playerScreen =
    document.getElementById("playerScreen");

const levelList =
    document.getElementById("levelList");

const loadSelectedButton =
    document.getElementById("loadSelectedButton");

const backToUploadButton =
    document.getElementById("backToUploadButton");

const newLevelButton =
    document.getElementById("newLevelButton");

const levelName =
    document.getElementById("levelName");

const bpmLabel =
    document.getElementById("bpmLabel");

const tileLabel =
    document.getElementById("tileLabel");

const offsetLabel =
    document.getElementById("offsetLabel");

const audioLabel =
    document.getElementById("audioLabel");

const statusDot =
    document.getElementById("statusDot");

const statusText =
    document.getElementById("statusText");

const canvas =
    document.getElementById("gameCanvas");

const ctx =
    canvas.getContext("2d");

const gameContainer =
    document.getElementById("gameContainer");

const gameMessage =
    document.getElementById("gameMessage");

const flashOverlay =
    document.getElementById("flashOverlay");

const beatCircle =
    document.getElementById("beatCircle");

const currentTile =
    document.getElementById("currentTile");

const currentTime =
    document.getElementById("currentTime");

const playButton =
    document.getElementById("playButton");

const pauseButton =
    document.getElementById("pauseButton");

const restartButton =
    document.getElementById("restartButton");

const timelineSlider =
    document.getElementById("timelineSlider");

const timeCurrent =
    document.getElementById("timeCurrent");

const timeTotal =
    document.getElementById("timeTotal");

const speedSlider =
    document.getElementById("speedSlider");

const speedValue =
    document.getElementById("speedValue");


/* =========================================================
   STATE
   ========================================================= */

let level = null;

let tiles = [];

let actions = [];

let decorations = [];

let availableLevels = [];

let zipFiles = {};

let selectedLevelIndex = 0;

let bpm = 100;

let offset = 0;

let totalDuration = 0;

let currentTimeSeconds = 0;

let currentTileIndex = 0;

let playing = false;

let playbackSpeed = 1;

let animationFrame = null;

let lastAnimationTime = 0;

let lastBeatIndex = -1;

let audioUrl = null;

let backgroundImage = null;

let backgroundImageUrl = null;


/* =========================================================
   AUDIO
   ========================================================= */

const audio =
    new Audio();

audio.preload = "auto";


/* =========================================================
   FILE INPUT
   ========================================================= */

fileInput.addEventListener(
    "change",
    async event => {

        const file =
            event.target.files[0];

        if (!file) {
            return;
        }

        await loadFile(file);
    }
);


/* =========================================================
   DRAG & DROP
   ========================================================= */

dropZone.addEventListener(
    "dragover",
    event => {

        event.preventDefault();

        dropZone.classList.add(
            "dragging"
        );
    }
);


dropZone.addEventListener(
    "dragleave",
    () => {

        dropZone.classList.remove(
            "dragging"
        );
    }
);


dropZone.addEventListener(
    "drop",
    async event => {

        event.preventDefault();

        dropZone.classList.remove(
            "dragging"
        );

        const file =
            event.dataTransfer.files[0];

        if (!file) {
            return;
        }

        await loadFile(file);
    }
);


/* =========================================================
   LOAD FILE
   ========================================================= */

async function loadFile(file) {

    try {

        setStatus(
            "Loading...",
            false
        );


        if (
            file.name
                .toLowerCase()
                .endsWith(".adofai")
        ) {

            const text =
                await file.text();

            const data =
                parseADOFAI(text);

            zipFiles = {};

            availableLevels = [];

            await prepareLevel(
                data,
                file.name,
                null
            );

            return;
        }


        if (
            file.name
                .toLowerCase()
                .endsWith(".zip")
        ) {

            await loadZip(file);

            return;
        }


        throw new Error(
            "Please choose an .adofai or .zip file."
        );

    } catch (error) {

        console.error(error);

        setStatus(
            "Error",
            false
        );

        alert(
            "Could not load the level:\n\n" +
            error.message
        );
    }
}


/* =========================================================
   PARSE ADOFAI
   ========================================================= */

function parseADOFAI(text) {

    /*
        Some ADOFAI files can contain a BOM.
    */

    text =
        text.replace(
            /^\uFEFF/,
            ""
        );


    try {

        return JSON.parse(text);

    } catch (error) {

        /*
            Try removing trailing commas.
        */

        const cleaned =
            text
                .replace(
                    /,\s*([}\]])/g,
                    "$1"
                );


        return JSON.parse(cleaned);
    }
}


/* =========================================================
   LOAD ZIP
   ========================================================= */

async function loadZip(file) {

    if (
        typeof JSZip ===
        "undefined"
    ) {

        throw new Error(
            "JSZip did not load."
        );
    }


    const zip =
        await JSZip.loadAsync(file);


    zipFiles = {};


    for (
        const entry of
        Object.values(zip.files)
    ) {

        if (entry.dir) {
            continue;
        }


        zipFiles[entry.name] =
            await entry.async("blob");
    }


    const levelFiles =
        Object.keys(zipFiles)
            .filter(
                filename =>
                    filename
                        .toLowerCase()
                        .endsWith(".adofai")
            );


    if (!levelFiles.length) {

        throw new Error(
            "No .adofai files were found inside this ZIP."
        );
    }


    availableLevels = [];


    for (
        const filename of
        levelFiles
    ) {

        try {

            const text =
                await zipFiles[
                    filename
                ].text();


            const data =
                parseADOFAI(text);


            const settings =
                data.settings || {};


            availableLevels.push({

                filename,

                data,

                name:
                    settings.song ||
                    settings.levelDesc ||
                    getFilename(filename)

            });

        } catch (error) {

            console.warn(
                "Could not parse:",
                filename,
                error
            );
        }
    }


    if (
        availableLevels.length === 1
    ) {

        await prepareLevel(

            availableLevels[0].data,

            availableLevels[0].filename,

            zipFiles

        );

    } else {

        showLevelSelector();
    }
}


/* =========================================================
   LEVEL SELECTOR
   ========================================================= */

function showLevelSelector() {

    uploadScreen.classList.add(
        "hidden"
    );

    playerScreen.classList.add(
        "hidden"
    );

    levelSelectScreen.classList.remove(
        "hidden"
    );


    selectedLevelIndex = 0;


    renderLevelList();
}


function renderLevelList() {

    levelList.innerHTML = "";


    availableLevels.forEach(
        (entry, index) => {

            const option =
                document.createElement(
                    "div"
                );


            option.className =
                "level-option";


            if (
                index ===
                selectedLevelIndex
            ) {

                option.classList.add(
                    "selected"
                );
            }


            option.innerHTML = `

                <div class="level-radio"></div>

                <div>

                    <div class="level-option-title">
                        ${escapeHtml(entry.name)}
                    </div>

                    <div class="level-option-file">
                        ${escapeHtml(entry.filename)}
                    </div>

                </div>

            `;


            option.addEventListener(
                "click",
                () => {

                    selectedLevelIndex =
                        index;

                    renderLevelList();
                }
            );


            levelList.appendChild(
                option
            );
        }
    );
}


loadSelectedButton.addEventListener(
    "click",
    async () => {

        const entry =
            availableLevels[
                selectedLevelIndex
            ];


        if (!entry) {
            return;
        }


        try {

            await prepareLevel(
                entry.data,
                entry.filename,
                zipFiles
            );

        } catch (error) {

            console.error(error);

            alert(
                "Could not load this level:\n\n" +
                error.message
            );
        }
    }
);


/* =========================================================
   PREPARE LEVEL
   ========================================================= */

async function prepareLevel(
    data,
    filename,
    assets
) {

    if (!data) {

        throw new Error(
            "The ADOFAI file is empty."
        );
    }


    level = data;


    const settings =
        data.settings || {};


    actions =
        Array.isArray(data.actions)
            ? data.actions
            : [];


    decorations =
        Array.isArray(data.decorations)
            ? data.decorations
            : [];


    /*
        BPM
    */

    bpm =
        Number(settings.bpm);


    if (
        !Number.isFinite(bpm) ||
        bpm <= 0
    ) {

        bpm = 100;
    }


    /*
        Offset
    */

    offset =
        Number(settings.offset);


    if (
        !Number.isFinite(offset)
    ) {

        offset = 0;
    }


    /*
        Angle data
    */

    let angleData =
        Array.isArray(data.angleData)
            ? data.angleData.slice()
            : null;


    /*
        Some older levels use pathData.
    */

    if (
        !angleData &&
        typeof data.pathData ===
        "string"
    ) {

        angleData =
            pathDataToAngles(
                data.pathData
            );
    }


    if (
        !angleData ||
        !angleData.length
    ) {

        throw new Error(
            "This level does not contain usable angleData or pathData."
        );
    }


    /*
        Build the track.
    */

    tiles =
        buildTrack(
            angleData
        );


    /*
        Timing.
    */

    calculateTiming();


    /*
        Audio.
    */

    stopAudio();


    if (assets) {

        const audioFile =
            findAudio(
                data,
                filename,
                assets
            );


        if (audioFile) {

            await loadAudio(
                assets[audioFile],
                audioFile
            );

        } else {

            audioLabel.textContent =
                "Audio: none";
        }


        await loadBackground(
            data,
            filename,
            assets
        );
    }


    /*
        Level name.
    */

    levelName.textContent =
        settings.song ||
        settings.levelDesc ||
        getFilename(filename);


    bpmLabel.textContent =
        "BPM: " +
        formatNumber(bpm);


    tileLabel.textContent =
        "Tiles: " +
        tiles.length;


    offsetLabel.textContent =
        "Offset: " +
        formatNumber(offset) +
        " ms";


    /*
        Reset.
    */

    currentTimeSeconds = 0;

    currentTileIndex = 0;

    playing = false;

    lastBeatIndex = -1;


    /*
        UI.
    */

    uploadScreen.classList.add(
        "hidden"
    );

    levelSelectScreen.classList.add(
        "hidden"
    );

    playerScreen.classList.remove(
        "hidden"
    );


    gameMessage.classList.add(
        "hidden"
    );


    statusDot.classList.add(
        "ready"
    );

    statusText.textContent =
        "Level loaded";


    resizeCanvas();

    updateUI();

    draw();
}


/* =========================================================
   PATH DATA
   ========================================================= */

function pathDataToAngles(path) {

    /*
        Common ADOFAI pathData mapping.

        This is primarily for older levels.
    */

    const table = {

        R: 0,

        p: 15,

        J: 30,

        E: 45,

        T: 60,

        o: 75,

        G: 90,

        Q: 105,

        H: 120,

        W: 135,

        x: 150,

        N: 165,

        F: 180,

        "<": 195,

        L: 210,

        "]": 225,

        v: 240,

        Z: 255,

        U: 270,

        D: 285,

        "7": 300,

        "8": 315,

        "9": 330,

        "0": 345
    };


    return [...path]
        .map(
            char =>
                table[char] ??
                0
        );
}


/* =========================================================
   BUILD TRACK
   ========================================================= */

function buildTrack(
    angleData
) {

    const result = [];


    let x = 0;

    let y = 0;

    let previousDirection = 0;


    for (
        let i = 0;
        i < angleData.length;
        i++
    ) {

        let direction =
            Number(
                angleData[i]
            );


        /*
            999 represents a midspin.
        */

        if (
            direction === 999
        ) {

            direction =
                previousDirection + 180;
        }


        if (
            !Number.isFinite(direction)
        ) {

            direction = 0;
        }


        direction =
            normalizeAngle(
                direction
            );


        /*
            The first tile is the origin.
        */

        if (i > 0) {

            const radians =
                direction *
                Math.PI /
                180;


            x +=
                Math.cos(radians);


            y +=
                Math.sin(radians);
        }


        result.push({

            index: i,

            direction,

            x,

            y,

            time: 0
        });


        previousDirection =
            direction;
    }


    /*
        Center.
    */

    if (result.length) {

        let minX = Infinity;

        let maxX = -Infinity;

        let minY = Infinity;

        let maxY = -Infinity;


        for (
            const tile of result
        ) {

            minX =
                Math.min(
                    minX,
                    tile.x
                );

            maxX =
                Math.max(
                    maxX,
                    tile.x
                );

            minY =
                Math.min(
                    minY,
                    tile.y
                );

            maxY =
                Math.max(
                    maxY,
                    tile.y
                );
        }


        const centerX =
            (minX + maxX) / 2;


        const centerY =
            (minY + maxY) / 2;


        for (
            const tile of result
        ) {

            tile.x -= centerX;

            tile.y -= centerY;
        }
    }


    return result;
}


/* =========================================================
   TIMING
   ========================================================= */

function calculateTiming() {

    if (!tiles.length) {

        totalDuration = 0;

        return;
    }


    const beatDuration =
        60 / bpm;


    for (
        let i = 0;
        i < tiles.length;
        i++
    ) {

        tiles[i].time =
            i *
            beatDuration;
    }


    totalDuration =
        Math.max(
            0,
            tiles.length *
            beatDuration
        );
}


/* =========================================================
   AUDIO SEARCH
   ========================================================= */

function findAudio(
    data,
    levelFilename,
    assets
) {

    const settings =
        data.settings || {};


    const requested =
        settings.songFilename ||
        settings.songFile ||
        settings.musicFilename ||
        "";


    const names =
        Object.keys(assets);


    /*
        Exact reference.
    */

    if (requested) {

        const exact =
            names.find(
                name =>
                    normalizePath(name) ===
                    normalizePath(requested)
            );


        if (exact) {
            return exact;
        }


        const requestedBase =
            getFilename(
                requested
            ).toLowerCase();


        const baseMatch =
            names.find(
                name =>
                    getFilename(name)
                        .toLowerCase() ===
                    requestedBase
            );


        if (baseMatch) {
            return baseMatch;
        }
    }


    /*
        Find all audio.
    */

    const audioFiles =
        names.filter(
            isAudioFile
        );


    if (!audioFiles.length) {
        return null;
    }


    /*
        Same folder.
    */

    const folder =
        getFolder(
            levelFilename
        );


    const sameFolder =
        audioFiles.find(
            name =>
                getFolder(name) ===
                folder
        );


    if (sameFolder) {
        return sameFolder;
    }


    /*
        Match level name.
    */

    const levelBase =
        getFilename(
            levelFilename
        )
        .replace(
            /\.adofai$/i,
            ""
        )
        .toLowerCase();


    const matching =
        audioFiles.find(
            name => {

                const audioBase =
                    getFilename(name)
                        .replace(
                            /\.[^.]+$/,
                            ""
                        )
                        .toLowerCase();


                return (
                    audioBase ===
                    levelBase
                );
            }
        );


    if (matching) {
        return matching;
    }


    return audioFiles[0];
}


/* =========================================================
   LOAD AUDIO
   ========================================================= */

async function loadAudio(
    blob,
    filename
) {

    if (!blob) {
        return;
    }


    if (audioUrl) {

        URL.revokeObjectURL(
            audioUrl
        );
    }


    audioUrl =
        URL.createObjectURL(
            blob
        );


    audio.pause();

    audio.src =
        audioUrl;

    audio.currentTime =
        0;

    audio.playbackRate =
        playbackSpeed;

    audio.load();


    audioLabel.textContent =
        "Audio: " +
        getFilename(filename);


    await new Promise(
        resolve => {

            if (
                audio.readyState >= 1
            ) {

                resolve();

                return;
            }


            const done =
                () => {

                    audio.removeEventListener(
                        "loadedmetadata",
                        done
                    );

                    resolve();
                };


            audio.addEventListener(
                "loadedmetadata",
                done
            );


            setTimeout(
                resolve,
                3000
            );
        }
    );


    if (
        Number.isFinite(
            audio.duration
        ) &&
        audio.duration > 0
    ) {

        totalDuration =
            Math.max(
                totalDuration,
                audio.duration
            );
    }
}


/* =========================================================
   BACKGROUND IMAGE
   ========================================================= */

async function loadBackground(
    data,
    levelFilename,
    assets
) {

    backgroundImage = null;


    if (backgroundImageUrl) {

        URL.revokeObjectURL(
            backgroundImageUrl
        );

        backgroundImageUrl = null;
    }


    const settings =
        data.settings || {};


    const possibleNames = [

        settings.bgImage,

        settings.backgroundImage,

        settings.background,

        settings.bg,

        settings.customBackground

    ]
        .filter(Boolean);


    const names =
        Object.keys(assets);


    let selected =
        null;


    /*
        Look for exact references.
    */

    for (
        const requested of
        possibleNames
    ) {

        const match =
            names.find(
                name =>
                    normalizePath(name) ===
                    normalizePath(requested)
            );


        if (match) {

            selected = match;

            break;
        }


        const base =
            getFilename(
                requested
            ).toLowerCase();


        const baseMatch =
            names.find(
                name =>
                    getFilename(name)
                        .toLowerCase() ===
                    base
            );


        if (baseMatch) {

            selected =
                baseMatch;

            break;
        }
    }


    /*
        If no explicit background was found,
        look for common background images.
    */

    if (!selected) {

        selected =
            names.find(
                name =>
                    isImageFile(name) &&
                    (
                        name
                            .toLowerCase()
                            .includes("background") ||

                        name
                            .toLowerCase()
                            .includes("bg")
                    )
            );
    }


    if (!selected) {
        return;
    }


    backgroundImageUrl =
        URL.createObjectURL(
            assets[selected]
        );


    const image =
        new Image();


    image.onload =
        () => {

            backgroundImage =
                image;

            draw();
        };


    image.src =
        backgroundImageUrl;
}


/* =========================================================
   PLAY
   ========================================================= */

async function play() {

    if (
        !level ||
        !tiles.length
    ) {

        return;
    }


    if (playing) {
        return;
    }


    if (
        currentTimeSeconds >=
        totalDuration
    ) {

        restart();
    }


    playing = true;


    if (audio.src) {

        try {

            audio.currentTime =
                currentTimeSeconds;

            audio.playbackRate =
                playbackSpeed;

            await audio.play();

        } catch (error) {

            console.warn(
                "Audio playback:",
                error
            );
        }
    }


    lastAnimationTime =
        performance.now();


    animationFrame =
        requestAnimationFrame(
            animationLoop
        );


    updateUI();
}


/* =========================================================
   PAUSE
   ========================================================= */

function pause() {

    playing = false;

    audio.pause();


    if (animationFrame) {

        cancelAnimationFrame(
            animationFrame
        );

        animationFrame = null;
    }


    updateUI();
}


/* =========================================================
   RESTART
   ========================================================= */

function restart() {

    pause();


    currentTimeSeconds = 0;

    currentTileIndex = 0;

    lastBeatIndex = -1;


    audio.currentTime = 0;


    updateUI();

    draw();
}


/* =========================================================
   ANIMATION LOOP
   ========================================================= */

function animationLoop(now) {

    if (!playing) {
        return;
    }


    /*
        Use the audio clock whenever possible.
    */

    if (
        audio.src &&
        !audio.paused &&
        Number.isFinite(
            audio.currentTime
        )
    ) {

        currentTimeSeconds =
            audio.currentTime;

    } else {

        const delta =
            (
                now -
                lastAnimationTime
            ) / 1000;


        lastAnimationTime =
            now;


        currentTimeSeconds +=
            delta *
            playbackSpeed;
    }


    if (
        currentTimeSeconds >=
        totalDuration
    ) {

        currentTimeSeconds =
            totalDuration;

        playing = false;

        audio.pause();

        updateCurrentTile();

        updateUI();

        draw();

        return;
    }


    updateCurrentTile();

    updateBeat();

    updateActions();

    updateUI();

    draw();


    animationFrame =
        requestAnimationFrame(
            animationLoop
        );
}


/* =========================================================
   CURRENT TILE
   ========================================================= */

function updateCurrentTile() {

    if (!tiles.length) {
        return;
    }


    let index = 0;


    for (
        let i = 0;
        i < tiles.length;
        i++
    ) {

        if (
            tiles[i].time <=
            currentTimeSeconds
        ) {

            index = i;

        } else {

            break;
        }
    }


    currentTileIndex =
        Math.min(
            index,
            tiles.length - 1
        );
}


/* =========================================================
   BEAT
   ========================================================= */

function updateBeat() {

    const beatDuration =
        60 / bpm;


    const beatIndex =
        Math.floor(
            currentTimeSeconds /
            beatDuration
        );


    if (
        beatIndex ===
        lastBeatIndex
    ) {

        return;
    }


    lastBeatIndex =
        beatIndex;


    beatCircle.classList.remove(
        "beat"
    );


    void beatCircle.offsetWidth;


    beatCircle.classList.add(
        "beat"
    );


    setTimeout(
        () => {

            beatCircle.classList.remove(
                "beat"
            );

        },
        100
    );
}


/* =========================================================
   ACTIONS
   ========================================================= */

function updateActions() {

    /*
        Basic Flash support.

        Actions can be stored as objects or
        strings depending on the level version.
    */

    for (
        const action of actions
    ) {

        if (!action) {
            continue;
        }


        const type =
            action.eventType ||
            action.type;


        if (
            type !== "Flash"
        ) {

            continue;
        }


        const floor =
            Number(
                action.floor
            );


        if (
            floor !==
            currentTileIndex
        ) {

            continue;
        }


        const color =
            action.color ||
            "ffffff";


        flashOverlay.style.background =
            "#" +
            String(color)
                .replace("#", "");


        flashOverlay.style.opacity =
            (
                Number(
                    action.opacity ??
                    100
                ) / 100
            ).toString();


        setTimeout(
            () => {

                flashOverlay.style.opacity =
                    "0";

            },
            Math.max(
                30,
                Number(
                    action.duration ||
                    .15
                ) * 1000
            )
        );
    }
}


/* =========================================================
   UI
   ========================================================= */

function updateUI() {

    currentTile.textContent =
        "Tile " +
        (
            currentTileIndex + 1
        ) +
        " / " +
        tiles.length;


    currentTime.textContent =
        formatDetailedTime(
            currentTimeSeconds
        );


    timeCurrent.textContent =
        formatTime(
            currentTimeSeconds
        );


    timeTotal.textContent =
        formatTime(
            totalDuration
        );


    if (
        totalDuration > 0
    ) {

        timelineSlider.value =
            (
                currentTimeSeconds /
                totalDuration
            ) * 100;

    } else {

        timelineSlider.value = 0;
    }


    if (playing) {

        playButton.innerHTML =
            "▶ <span>Playing</span>";

    } else {

        playButton.innerHTML =
            "▶ <span>Play</span>";
    }
}


/* =========================================================
   TIMELINE
   ========================================================= */

timelineSlider.addEventListener(
    "input",
    () => {

        if (
            totalDuration <= 0
        ) {

            return;
        }


        currentTimeSeconds =
            (
                Number(
                    timelineSlider.value
                ) / 100
            ) *
            totalDuration;


        if (audio.src) {

            audio.currentTime =
                currentTimeSeconds;
        }


        updateCurrentTile();

        updateUI();

        draw();
    }
);


/* =========================================================
   SPEED
   ========================================================= */

speedSlider.addEventListener(
    "input",
    () => {

        playbackSpeed =
            Number(
                speedSlider.value
            );


        speedValue.textContent =
            playbackSpeed.toFixed(2) +
            "×";


        audio.playbackRate =
            playbackSpeed;
    }
);


/* =========================================================
   BUTTONS
   ========================================================= */

playButton.addEventListener(
    "click",
    play
);


pauseButton.addEventListener(
    "click",
    pause
);


restartButton.addEventListener(
    "click",
    restart
);


/* =========================================================
   LOAD ANOTHER
   ========================================================= */

newLevelButton.addEventListener(
    "click",
    () => {

        pause();

        stopAudio();


        level = null;

        tiles = [];

        actions = [];

        decorations = [];

        zipFiles = {};

        availableLevels = [];


        playerScreen.classList.add(
            "hidden"
        );

        levelSelectScreen.classList.add(
            "hidden"
        );

        uploadScreen.classList.remove(
            "hidden"
        );


        gameMessage.classList.remove(
            "hidden"
        );


        statusDot.classList.remove(
            "ready"
        );


        statusText.textContent =
            "Ready";


        fileInput.value = "";
    }
);


/* =========================================================
   BACK
   ========================================================= */

backToUploadButton.addEventListener(
    "click",
    () => {

        levelSelectScreen.classList.add(
            "hidden"
        );

        uploadScreen.classList.remove(
            "hidden"
        );


        fileInput.value = "";
    }
);


/* =========================================================
   KEYBOARD
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.target.tagName ===
            "INPUT"
        ) {

            return;
        }


        if (
            event.code ===
            "Space"
        ) {

            event.preventDefault();


            if (playing) {

                pause();

            } else {

                play();
            }
        }


        if (
            event.key.toLowerCase() ===
            "r"
        ) {

            restart();
        }
    }
);


/* =========================================================
   CANVAS
   ========================================================= */

function resizeCanvas() {

    const rect =
        canvas.getBoundingClientRect();


    const dpr =
        window.devicePixelRatio ||
        1;


    canvas.width =
        Math.floor(
            rect.width *
            dpr
        );


    canvas.height =
        Math.floor(
            rect.height *
            dpr
        );


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    draw();
}


window.addEventListener(
    "resize",
    resizeCanvas
);


/* =========================================================
   DRAW
   ========================================================= */

function draw() {

    const width =
        canvas.clientWidth;

    const height =
        canvas.clientHeight;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    /*
        Background.
    */

    drawBackground(
        width,
        height
    );


    if (!tiles.length) {
        return;
    }


    /*
        Calculate bounds.
    */

    let minX = Infinity;

    let maxX = -Infinity;

    let minY = Infinity;

    let maxY = -Infinity;


    for (
        const tile of tiles
    ) {

        minX =
            Math.min(
                minX,
                tile.x
            );

        maxX =
            Math.max(
                maxX,
                tile.x
            );

        minY =
            Math.min(
                minY,
                tile.y
            );

        maxY =
            Math.max(
                maxY,
                tile.y
            );
    }


    const pathWidth =
        Math.max(
            1,
            maxX - minX
        );


    const pathHeight =
        Math.max(
            1,
            maxY - minY
        );


    const padding = 80;


    const scale =
        Math.min(

            (
                width -
                padding * 2
            ) /
            pathWidth,

            (
                height -
                padding * 2
            ) /
            pathHeight,

            55

        );


    const centerX =
        width / 2;


    const centerY =
        height / 2;


    function sx(x) {

        return (
            centerX +
            x * scale
        );
    }


    function sy(y) {

        return (
            centerY -
            y * scale
        );
    }


    /*
        Track colors.
    */

    const settings =
        level.settings || {};


    const trackColor =
        getHexColor(
            settings.trackColor,
            "#ffffff"
        );


    const trackColor2 =
        getHexColor(
            settings.secondaryTrackColor,
            "#72d8ff"
        );


    /*
        Draw connecting path.
    */

    for (
        let i = 1;
        i < tiles.length;
        i++
    ) {

        const previous =
            tiles[i - 1];

        const tile =
            tiles[i];


        const progress =
            i /
            Math.max(
                1,
                tiles.length - 1
            );


        const color =
            mixColors(
                trackColor,
                trackColor2,
                progress
            );


        ctx.beginPath();


        ctx.moveTo(
            sx(previous.x),
            sy(previous.y)
        );


        ctx.lineTo(
            sx(tile.x),
            sy(tile.y)
        );


        ctx.strokeStyle =
            color;


        ctx.globalAlpha =
            .20;


        ctx.lineWidth =
            Math.max(
                5,
                scale * .23
            );


        ctx.lineCap =
            "round";


        ctx.stroke();


        ctx.globalAlpha =
            1;
    }


    /*
        Draw tiles.
    */

    for (
        let i = 0;
        i < tiles.length;
        i++
    ) {

        const tile =
            tiles[i];


        const x =
            sx(tile.x);


        const y =
            sy(tile.y);


        const isCurrent =
            i ===
            currentTileIndex;


        const passed =
            i <
            currentTileIndex;


        const progress =
            i /
            Math.max(
                1,
                tiles.length - 1
            );


        const color =
            mixColors(
                trackColor,
                trackColor2,
                progress
            );


        /*
            Glow.
        */

        if (isCurrent) {

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                28,
                0,
                Math.PI * 2
            );


            const glow =
                ctx.createRadialGradient(
                    x,
                    y,
                    0,
                    x,
                    y,
                    30
                );


            glow.addColorStop(
                0,
                color
            );


            glow.addColorStop(
                1,
                "transparent"
            );


            ctx.fillStyle =
                glow;


            ctx.globalAlpha =
                .65;


            ctx.fill();

            ctx.globalAlpha =
                1;
        }


        /*
            Tile body.
        */

        ctx.beginPath();


        ctx.arc(
            x,
            y,
            isCurrent
                ? 9
                : 6,
            0,
            Math.PI * 2
        );


        if (passed) {

            ctx.fillStyle =
                "rgba(255,255,255,.28)";

        } else {

            ctx.fillStyle =
                color;
        }


        ctx.fill();


        /*
            Tile ring.
        */

        ctx.beginPath();


        ctx.arc(
            x,
            y,
            isCurrent
                ? 13
                : 8,
            0,
            Math.PI * 2
        );


        ctx.strokeStyle =
            color;


        ctx.globalAlpha =
            isCurrent
                ? 1
                : .45;


        ctx.lineWidth =
            isCurrent
                ? 2
                : 1;


        ctx.stroke();


        ctx.globalAlpha =
            1;


        /*
            Tile number.
        */

        if (
            tiles.length <= 300
        ) {

            ctx.font =
                "9px system-ui";


            ctx.textAlign =
                "center";


            ctx.fillStyle =
                "rgba(255,255,255,.35)";


            ctx.fillText(
                String(i + 1),
                x,
                y - 14
            );
        }
    }


    /*
        Draw fire and ice planets
        around the current tile.
    */

    drawPlanets(
        sx(tiles[currentTileIndex].x),
        sy(tiles[currentTileIndex].y),
        scale
    );
}


/* =========================================================
   BACKGROUND
   ========================================================= */

function drawBackground(
    width,
    height
) {

    const settings =
        level?.settings || {};


    const backgroundColor =
        getHexColor(
            settings.backgroundColor,
            "#080a10"
        );


    ctx.fillStyle =
        backgroundColor;


    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    /*
        Image.
    */

    if (backgroundImage) {

        const image =
            backgroundImage;


        const scale =
            Math.max(

                width /
                image.width,

                height /
                image.height

            );


        const imageWidth =
            image.width *
            scale;


        const imageHeight =
            image.height *
            scale;


        ctx.globalAlpha =
            Number(
                settings.backgroundImageOpacity ??
                settings.bgImageOpacity ??
                .35
            );


        ctx.drawImage(

            image,

            (
                width -
                imageWidth
            ) / 2,

            (
                height -
                imageHeight
            ) / 2,

            imageWidth,

            imageHeight
        );


        ctx.globalAlpha =
            1;
    }


    /*
        Grid.
    */

    ctx.strokeStyle =
        "rgba(255,255,255,.035)";


    ctx.lineWidth = 1;


    const gridSize = 50;


    for (
        let x = 0;
        x < width;
        x += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            height
        );

        ctx.stroke();
    }


    for (
        let y = 0;
        y < height;
        y += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            width,
            y
        );

        ctx.stroke();
    }
}


/* =========================================================
   PLANETS
   ========================================================= */

function drawPlanets(
    x,
    y,
    scale
) {

    const radius =
        Math.max(
            13,
            Math.min(
                24,
                scale * .35
            )
        );


    /*
        Fire.
    */

    const fireX =
        x -
        radius * 1.15;


    const fireY =
        y;


    const fireGradient =
        ctx.createRadialGradient(
            fireX - radius * .35,
            fireY - radius * .35,
            radius * .1,
            fireX,
            fireY,
            radius
        );


    fireGradient.addColorStop(
        0,
        "#fff"
    );


    fireGradient.addColorStop(
        .18,
        "#ffb095"
    );


    fireGradient.addColorStop(
        .55,
        "#ff5338"
    );


    fireGradient.addColorStop(
        1,
        "#8b1612"
    );


    ctx.beginPath();

    ctx.arc(
        fireX,
        fireY,
        radius,
        0,
        Math.PI * 2
    );


    ctx.fillStyle =
        fireGradient;


    ctx.fill();


    /*
        Ice.
    */

    const iceX =
        x +
        radius * 1.15;


    const iceY =
        y;


    const iceGradient =
        ctx.createRadialGradient(
            iceX - radius * .35,
            iceY - radius * .35,
            radius * .1,
            iceX,
            iceY,
            radius
        );


    iceGradient.addColorStop(
        0,
        "#fff"
    );


    iceGradient.addColorStop(
        .18,
        "#c3f8ff"
    );


    iceGradient.addColorStop(
        .55,
        "#45c7ef"
    );


    iceGradient.addColorStop(
        1,
        "#15536e"
    );


    ctx.beginPath();

    ctx.arc(
        iceX,
        iceY,
        radius,
        0,
        Math.PI * 2
    );


    ctx.fillStyle =
        iceGradient;


    ctx.fill();
}


/* =========================================================
   STOP AUDIO
   ========================================================= */

function stopAudio() {

    audio.pause();


    try {

        audio.currentTime = 0;

    } catch (_) {}


    if (audioUrl) {

        URL.revokeObjectURL(
            audioUrl
        );

        audioUrl = null;
    }


    audio.removeAttribute(
        "src"
    );


    audio.load();


    audioLabel.textContent =
        "Audio: --";
}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(
    text,
    ready
) {

    statusText.textContent =
        text;


    statusDot.classList.toggle(
        "ready",
        ready
    );
}


/* =========================================================
   COLOR HELPERS
   ========================================================= */

function getHexColor(
    value,
    fallback
) {

    if (
        typeof value !==
        "string"
    ) {

        return fallback;
    }


    let color =
        value.trim();


    if (!color) {
        return fallback;
    }


    if (
        !color.startsWith("#")
    ) {

        color =
            "#" +
            color;
    }


    if (
        /^#[0-9a-fA-F]{6}$/
            .test(color)
    ) {

        return color;
    }


    return fallback;
}


function mixColors(
    a,
    b,
    amount
) {

    const ca =
        hexToRgb(a);


    const cb =
        hexToRgb(b);


    if (!ca || !cb) {
        return a;
    }


    const r =
        Math.round(
            ca.r +
            (
                cb.r -
                ca.r
            ) *
            amount
        );


    const g =
        Math.round(
            ca.g +
            (
                cb.g -
                ca.g
            ) *
            amount
        );


    const bl =
        Math.round(
            ca.b +
            (
                cb.b -
                ca.b
            ) *
            amount
        );


    return (
        "#" +
        [r,g,bl]
            .map(
                n =>
                    n
                        .toString(16)
                        .padStart(
                            2,
                            "0"
                        )
            )
            .join("")
    );
}


function hexToRgb(
    hex
) {

    const match =
        /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i
            .exec(hex);


    if (!match) {
        return null;
    }


    return {

        r:
            parseInt(
                match[1],
                16
            ),

        g:
            parseInt(
                match[2],
                16
            ),

        b:
            parseInt(
                match[3],
                16
            )
    };
}


/* =========================================================
   FILE HELPERS
   ========================================================= */

function isAudioFile(
    filename
) {

    const name =
        filename.toLowerCase();


    return (

        name.endsWith(".ogg") ||

        name.endsWith(".mp3") ||

        name.endsWith(".wav") ||

        name.endsWith(".m4a") ||

        name.endsWith(".aac") ||

        name.endsWith(".flac")

    );
}


function isImageFile(
    filename
) {

    const name =
        filename.toLowerCase();


    return (

        name.endsWith(".png") ||

        name.endsWith(".jpg") ||

        name.endsWith(".jpeg") ||

        name.endsWith(".webp") ||

        name.endsWith(".gif")

    );
}


function getFilename(
    path
) {

    return String(path)
        .replace(
            /\\/g,
            "/"
        )
        .split("/")
        .pop() || "";
}


function getFolder(
    path
) {

    const normalized =
        String(path)
            .replace(
                /\\/g,
                "/"
            );


    const index =
        normalized.lastIndexOf(
            "/"
        );


    if (
        index === -1
    ) {

        return "";
    }


    return normalized.substring(
        0,
        index
    );
}


function normalizePath(
    path
) {

    return String(path)
        .replace(
            /\\/g,
            "/"
        )
        .replace(
            /^\.?\//,
            ""
        )
        .toLowerCase();
}


function normalizeAngle(
    angle
) {

    angle %= 360;


    if (
        angle < 0
    ) {

        angle += 360;
    }


    return angle;
}


function formatNumber(
    value
) {

    return Number(value)
        .toFixed(2)
        .replace(
            /\.00$/,
            ""
        );
}


function formatTime(
    seconds
) {

    seconds =
        Math.max(
            0,
            Number(seconds) || 0
        );


    const minutes =
        Math.floor(
            seconds / 60
        );


    const secs =
        Math.floor(
            seconds % 60
        );


    return (
        minutes +
        ":" +
        String(secs)
            .padStart(
                2,
                "0"
            )
    );
}


function formatDetailedTime(
    seconds
) {

    seconds =
        Math.max(
            0,
            Number(seconds) || 0
        );


    const minutes =
        Math.floor(
            seconds / 60
        );


    const secs =
        Math.floor(
            seconds % 60
        );


    const milliseconds =
        Math.floor(
            (
                seconds %
                1
            ) *
            1000
        );


    return (
        minutes +
        ":" +
        String(secs)
            .padStart(
                2,
                "0"
            ) +
        "." +
        String(milliseconds)
            .padStart(
                3,
                "0"
            )
    );
}


function escapeHtml(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

resizeCanvas();

updateUI();
