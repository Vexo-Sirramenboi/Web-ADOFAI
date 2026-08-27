"use strict";


/* =========================================================
   ELEMENTS
========================================================= */

const fileInput =
    document.getElementById("fileInput");

const dropZone =
    document.getElementById("dropZone");

const uploadScreen =
    document.getElementById("uploadScreen");

const playerScreen =
    document.getElementById("playerScreen");

const levelName =
    document.getElementById("levelName");

const bpmLabel =
    document.getElementById("bpmLabel");

const tileLabel =
    document.getElementById("tileLabel");

const offsetLabel =
    document.getElementById("offsetLabel");

const statusDot =
    document.getElementById("statusDot");

const statusText =
    document.getElementById("statusText");

const newLevelButton =
    document.getElementById("newLevelButton");

const playButton =
    document.getElementById("playButton");

const pauseButton =
    document.getElementById("pauseButton");

const restartButton =
    document.getElementById("restartButton");

const timeline =
    document.getElementById("timeline");

const timeCurrent =
    document.getElementById("timeCurrent");

const timeTotal =
    document.getElementById("timeTotal");

const currentTile =
    document.getElementById("currentTile");

const currentTime =
    document.getElementById("currentTime");

const speedSlider =
    document.getElementById("speedSlider");

const speedValue =
    document.getElementById("speedValue");

const beatCircle =
    document.getElementById("beatCircle");

const canvas =
    document.getElementById("gameCanvas");

const ctx =
    canvas.getContext("2d");


/* =========================================================
   STATE
========================================================= */

let level = null;

let tiles = [];

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


/* =========================================================
   FILE INPUT
========================================================= */

fileInput.addEventListener(
    "change",
    event => {

        const file =
            event.target.files[0];

        if (file) {
            loadFile(file);
        }
    }
);


dropZone.addEventListener(
    "dragover",
    event => {

        event.preventDefault();

        dropZone.classList.add("dragging");
    }
);


dropZone.addEventListener(
    "dragleave",
    () => {

        dropZone.classList.remove("dragging");
    }
);


dropZone.addEventListener(
    "drop",
    event => {

        event.preventDefault();

        dropZone.classList.remove("dragging");

        const file =
            event.dataTransfer.files[0];

        if (file) {
            loadFile(file);
        }
    }
);


/* =========================================================
   LOAD FILE
========================================================= */

async function loadFile(file) {

    if (
        !file.name
            .toLowerCase()
            .endsWith(".adofai")
    ) {

        alert(
            "Please select an .adofai file."
        );

        return;
    }


    try {

        statusText.textContent =
            "Loading...";


        const text =
            await file.text();


        const data =
            JSON.parse(text);


        parseLevel(
            data,
            file.name
        );


    } catch (error) {

        console.error(error);

        statusText.textContent =
            "Error";

        alert(
            "Could not read this ADOFAI file.\n\n" +
            error.message
        );
    }
}


/* =========================================================
   PARSE LEVEL
========================================================= */

function parseLevel(data, filename) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        throw new Error(
            "Invalid ADOFAI data."
        );
    }


    level = data;


    const settings =
        data.settings || {};


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
        OFFSET
    */

    offset =
        Number(settings.offset);


    if (
        !Number.isFinite(offset)
    ) {

        offset = 0;
    }


    /*
        ANGLE DATA
    */

    const angleData =
        Array.isArray(data.angleData)
            ? data.angleData
            : [];


    if (!angleData.length) {

        throw new Error(
            "This level has no angleData."
        );
    }


    /*
        Build path
    */

    tiles =
        buildTilePath(
            angleData
        );


    /*
        Timing
    */

    calculateTiming();


    /*
        Name
    */

    let name =
        settings.song ||
        settings.levelDesc ||
        removeExtension(filename);


    if (!name) {
        name = "Untitled Level";
    }


    levelName.textContent =
        name;


    bpmLabel.textContent =
        `BPM: ${formatNumber(bpm)}`;


    tileLabel.textContent =
        `Tiles: ${tiles.length}`;


    offsetLabel.textContent =
        `Offset: ${formatNumber(offset)} ms`;


    /*
        Reset
    */

    currentTimeSeconds = 0;

    currentTileIndex = 0;

    playing = false;

    lastBeatIndex = -1;


    resizeCanvas();


    uploadScreen.classList.add(
        "hidden"
    );

    playerScreen.classList.remove(
        "hidden"
    );


    statusDot.classList.add(
        "ready"
    );

    statusText.textContent =
        "Level loaded";


    updateUI();

    draw();
}


/* =========================================================
   BUILD TILE PATH
========================================================= */

function buildTilePath(angleData) {

    const result = [];

    let x = 0;

    let y = 0;

    const distance = 1;


    for (
        let i = 0;
        i < angleData.length;
        i++
    ) {

        let angle =
            Number(angleData[i]);


        if (
            !Number.isFinite(angle)
        ) {

            angle = 0;
        }


        angle =
            normalizeAngle(angle);


        if (i > 0) {

            const radians =
                angle *
                Math.PI /
                180;


            x +=
                Math.cos(radians) *
                distance;


            y -=
                Math.sin(radians) *
                distance;
        }


        result.push({

            index: i,

            angle,

            x,

            y,

            time: 0

        });
    }


    /*
        Center path
    */

    if (result.length) {

        let minX = Infinity;

        let maxX = -Infinity;

        let minY = Infinity;

        let maxY = -Infinity;


        for (const tile of result) {

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


        for (const tile of result) {

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


    /*
        Seconds per beat
    */

    const beatDuration =
        60 / bpm;


    for (
        let i = 0;
        i < tiles.length;
        i++
    ) {

        tiles[i].time =
            i * beatDuration;
    }


    totalDuration =
        tiles.length *
        beatDuration;
}


/* =========================================================
   CANVAS RESIZE
========================================================= */

function resizeCanvas() {

    const rect =
        canvas.getBoundingClientRect();


    const dpr =
        window.devicePixelRatio || 1;


    canvas.width =
        Math.floor(
            rect.width * dpr
        );


    canvas.height =
        Math.floor(
            rect.height * dpr
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


    if (!tiles.length) {
        return;
    }


    drawGrid(
        width,
        height
    );


    /*
        Find bounds
    */

    let minX = Infinity;

    let maxX = -Infinity;

    let minY = Infinity;

    let maxY = -Infinity;


    for (const tile of tiles) {

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
            maxX - minX,
            1
        );


    const pathHeight =
        Math.max(
            maxY - minY,
            1
        );


    const padding = 70;


    const scale =
        Math.min(
            (width - padding * 2) /
                pathWidth,

            (height - padding * 2) /
                pathHeight
        );


    const centerX =
        width / 2;


    const centerY =
        height / 2;


    /*
        Convert game coordinates
        to canvas coordinates.
    */

    function screenX(x) {

        return centerX +
            x * scale;
    }


    function screenY(y) {

        return centerY +
            y * scale;
    }


    /*
        Path
    */

    ctx.beginPath();


    for (
        let i = 0;
        i < tiles.length;
        i++
    ) {

        const tile =
            tiles[i];


        const sx =
            screenX(tile.x);


        const sy =
            screenY(tile.y);


        if (i === 0) {

            ctx.moveTo(
                sx,
                sy
            );

        } else {

            ctx.lineTo(
                sx,
                sy
            );
        }
    }


    ctx.strokeStyle =
        "rgba(255,255,255,.12)";

    ctx.lineWidth = 2;

    ctx.stroke();


    /*
        Tiles
    */

    for (
        let i = 0;
        i < tiles.length;
        i++
    ) {

        const tile =
            tiles[i];


        const sx =
            screenX(tile.x);


        const sy =
            screenY(tile.y);


        const isCurrent =
            i === currentTileIndex;


        const isPassed =
            i < currentTileIndex;


        /*
            Glow for current tile
        */

        if (isCurrent) {

            ctx.beginPath();

            ctx.arc(
                sx,
                sy,
                17,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                "rgba(255,255,255,.12)";

            ctx.fill();
        }


        /*
            Tile
        */

        ctx.beginPath();

        ctx.arc(
            sx,
            sy,
            isCurrent ? 8 : 5,
            0,
            Math.PI * 2
        );


        if (isCurrent) {

            ctx.fillStyle =
                "white";

        } else if (isPassed) {

            ctx.fillStyle =
                "rgba(255,255,255,.45)";

        } else {

            ctx.fillStyle =
                "rgba(255,255,255,.75)";
        }


        ctx.fill();


        /*
            Tile number
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
                String(i),
                sx,
                sy - 11
            );
        }
    }


    /*
        Player position
    */

    if (tiles.length) {

        const tile =
            tiles[currentTileIndex];


        if (tile) {

            const sx =
                screenX(tile.x);

            const sy =
                screenY(tile.y);


            /*
                Outer pulse
            */

            const pulse =
                13 +
                Math.sin(
                    performance.now() /
                    120
                ) * 3;


            ctx.beginPath();

            ctx.arc(
                sx,
                sy,
                pulse,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                "rgba(255,255,255,.55)";

            ctx.lineWidth = 1.5;

            ctx.stroke();
        }
    }
}


/* =========================================================
   GRID
========================================================= */

function drawGrid(
    width,
    height
) {

    const gridSize = 40;


    ctx.save();


    ctx.strokeStyle =
        "rgba(255,255,255,.025)";

    ctx.lineWidth = 1;


    for (
        let x = 0;
        x <= width;
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
        y <= height;
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


    ctx.restore();
}


/* =========================================================
   PLAY
========================================================= */

function play() {

    if (!level || !tiles.length) {
        return;
    }


    if (playing) {
        return;
    }


    if (
        currentTimeSeconds >=
        totalDuration
    ) {

        currentTimeSeconds = 0;
    }


    playing = true;

    lastAnimationTime =
        performance.now();


    animationFrame =
        requestAnimationFrame(
            animationLoop
        );
}


/* =========================================================
   PAUSE
========================================================= */

function pause() {

    playing = false;


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


    const delta =
        (now - lastAnimationTime) /
        1000;


    lastAnimationTime = now;


    currentTimeSeconds +=
        delta * playbackSpeed;


    /*
        Finished
    */

    if (
        currentTimeSeconds >=
        totalDuration
    ) {

        currentTimeSeconds =
            totalDuration;

        updateCurrentTile();

        playing = false;

        updateUI();

        draw();

        return;
    }


    updateCurrentTile();

    updateBeat();

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
        beatIndex !==
        lastBeatIndex
    ) {

        lastBeatIndex =
            beatIndex;


        beatCircle.classList.remove(
            "beat"
        );


        /*
            Force animation restart.
        */

        void beatCircle.offsetWidth;


        beatCircle.classList.add(
            "beat"
        );


        setTimeout(() => {

            beatCircle.classList.remove(
                "beat"
            );

        }, 100);
    }
}


/* =========================================================
   UI
========================================================= */

function updateUI() {

    currentTile.textContent =
        `Tile ${currentTileIndex + 1} / ${tiles.length}`;


    currentTime.textContent =
        formatTimeDetailed(
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


    if (totalDuration > 0) {

        timeline.value =
            (
                currentTimeSeconds /
                totalDuration
            ) * 100;

    } else {

        timeline.value = 0;
    }


    playButton.innerHTML =
        playing
            ? "▶ <span>Playing</span>"
            : "▶ <span>Play</span>";
}


/* =========================================================
   TIMELINE
========================================================= */

timeline.addEventListener(
    "input",
    () => {

        if (!totalDuration) {
            return;
        }


        const percentage =
            Number(
                timeline.value
            ) / 100;


        currentTimeSeconds =
            percentage *
            totalDuration;


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


newLevelButton.addEventListener(
    "click",
    () => {

        pause();


        playerScreen.classList.add(
            "hidden"
        );

        uploadScreen.classList.remove(
            "hidden"
        );


        fileInput.value = "";


        statusDot.classList.remove(
            "ready"
        );


        statusText.textContent =
            "No level loaded";
    }
);


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        /*
            Don't activate keyboard shortcuts
            while typing.
        */

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
   HELPERS
========================================================= */

function normalizeAngle(angle) {

    angle %= 360;


    if (angle < 0) {
        angle += 360;
    }


    return angle;
}


function removeExtension(filename) {

    return filename
        .replace(
            /\.adofai$/i,
            ""
        );
}


function formatNumber(number) {

    return Number(number)
        .toFixed(2)
        .replace(/\.00$/, "");
}


function formatTime(seconds) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {

        seconds = 0;
    }


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
        String(secs).padStart(
            2,
            "0"
        )
    );
}


function formatTimeDetailed(seconds) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {

        seconds = 0;
    }


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
            (seconds % 1) *
            1000
        );


    return (
        minutes +
        ":" +
        String(secs).padStart(2, "0") +
        "." +
        String(milliseconds).padStart(
            3,
            "0"
        )
    );
}


/* =========================================================
   INITIAL CANVAS
========================================================= */

resizeCanvas();
