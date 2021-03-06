//  CUSTOM WORDLE -- Phineas Ziegler and Ciaran Whitney

import { dict } from "./dict.js";
import { answers } from "./answers.js";
import Position from "./position.js";
import ToastNotification from "./toastNotification.js";


// ----------------------------------------------------------------------------- //

/////////////////
/// CONSTANTS /// and init
/////////////////

// ----------------------------------------------------------------------------- //

// Style Constants
const gridSpace = 2.5; // 5px border between tiles
const borderWidth = 2;
const yellowColor = "#b59f3b";
const greyColor = "#3a3a3c";
const greenColor = "#538d4e";
const borderColor = "#3a3a3c";
const borderColorActive = "#565758";
const keyboardDefault = "#818384";

// ANIMATION CONSTANTS -- safe to change ----
// Flip animation
const flipTime = 0.5;       // amount of time for a flip to take place in s
const flipExp = 3;          // exponent used to animate flip -- only odd ints
const flipNextFrac = 0.5;   // % time through the anim to start the next one.

// Invalid animation
const invalidTime = 0.125;
const invalidOffset = 6;
const invalidIterations = 3;

// Input animation
const inputAnimScale = 1.1;
const inputAnimTime = 0.08;

// GAME VARIABLES
const emptyText = "";
let typing;     // set false to prevent input
let ended;
let rows;
let cols;
let answer;
let state;
let currPos;
let letters = {};
let challenge = false;
let activeRows = [];

// CHALLENGE DETECTION
const d = new Date();
let seed;
const urlParams = new URLSearchParams(window.location.search)
if (urlParams.has('e')) {
    challenge = true;
}

function init() {
    document.getElementById("reveal").style.display = "none";
    let seedInput = document.getElementById("seed").value;

    // if the seed is empty, do the daily wordle
    if (seedInput == "") {
        seed = String((d.getDate() + d.getFullYear() + d.getMonth()) * d.getDate() / d.getMonth());
    }
    else {
        seed = seedInput;
    }

    // remove any existing row elements
    activeRows.forEach(e => e.remove());

    // Used to color the keyboard
    letters = {
        a: -1, b: -1, c: -1, d: -1, e: -1, f: -1, g: -1, h: -1, i: -1, j: -1, k: -1, l: -1, m: -1,
        n: -1, o: -1, p: -1, q: -1, r: -1, s: -1, t: -1, u: -1, v: -1, w: -1, x: -1, y: -1, z: -1,
    }

    typing = true;
    ended = false;

    if (challenge) {
        let decrypted = urlParams.get('e');

        decrypted = decrypted.replaceAll('flM667', '&');
        decrypted = decrypted.toString().replaceAll('ll1994n', '+');
        decrypted = decrypted.toString().replaceAll('jf0901DD', '/');

        decrypted = CryptoJS.AES.decrypt(decrypted, "wordle");
        decrypted = decrypted.toString(CryptoJS.enc.Utf8);

        answer = decrypted.split('_')[0].toUpperCase();
        rows = decrypted.split('_')[1];
        cols = answer.length;

        answers.push(answer);
    }
    else {
        rows = Math.round(parseFloat(document.getElementById("tries").value));
        cols = Math.round(parseFloat(document.getElementById("length").value));

        answer = randomWord(seed).toUpperCase();
    }

    dict[answer] = true;    // in case the answer word is "not valid."

    state = generateEmptyState(rows, cols);
    currPos = new Position(0, 0, rows, cols);
    generateBoard(state);
    resetKeyboard();

}

// ----------------------------------------------------------------------------- //

//////////////////
/// GENERATION ///
//////////////////

// ----------------------------------------------------------------------------- //

// Generate random word of length n
// https://stackoverflow.com/a/47593316
function randomWord(seed) {
    function xmur3(str) {
        for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = h << 13 | h >>> 19;
        } return function () {
            h = Math.imul(h ^ (h >>> 16), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            return (h ^= h >>> 16) >>> 0;
        }
    }
    function sfc32(a, b, c, d) {
        return function () {
            a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
            var t = (a + b) | 0;
            a = b ^ b >>> 9;
            b = c + (c << 3) | 0;
            c = (c << 21 | c >>> 11);
            d = d + 1 | 0;
            t = t + d | 0;
            c = c + t | 0;
            return (t >>> 0) / 4294967296;
        }
    }
    // Create xmur3 state:
    let hash = xmur3(seed);
    // Output four 32-bit hashes to provide the seed for sfc32.
    let rand = sfc32(hash(), hash(), hash(), hash());

    let choices = answers.filter(word => word.length == cols);
    console.log("Found " + choices.length + " possible solutions for word length " + cols + ".");

    if (choices.length > 0) {
        let outcome = Math.floor((choices.length + 1) * rand());
        return choices[outcome];
    }
    return -1;

}

// Generates the beginning state
function generateEmptyState(tries, wordlength) {
    let output = [];
    for (let r = 0; r < tries; r++) {
        let row = [];
        for (let c = 0; c < wordlength; c++) {
            row.push(emptyText);
        }
        output.push(row);
    }
    return output;
}

// creates the board and tiles
function generateBoard(state) {    // default is 6x5
    let board = document.getElementById("board");
    board.style.width = ((cols * 335) / 5) + "px";

    for (let row = 0; row < state.length; row++) {
        let rowDiv = document.createElement("div");
        rowDiv.id = row;
        rowDiv.classList.add("row");
        for (let col = 0; col < state[row].length; col++) {
            let div = createDiv(row, col, calculateWidth(state), borderWidth);
            rowDiv.appendChild(div);
            activeRows.push(rowDiv);
        }
        board.appendChild(rowDiv);
    }
}

// create a tile element and appends a text element to itself
function createDiv(row, col, width, borderWidth) {
    let div = document.createElement("div");
    div.id = tileID(row, col);
    div.classList.add("tile");
    div.style.width = width + "px";
    div.style.height = width + "px";
    div.style.margin = gridSpace + "px";
    inactive(div);

    let p = createTextElem(row, col, width, borderWidth);
    div.appendChild(p);
    return div;
}

// create an empty tileText element
function createTextElem(row, col, width, borderWidth) {
    let p = document.createElement("p");
    p.id = textID(row, col);
    p.classList.add("tileText");
    p.innerText = emptyText;
    p.style.lineHeight = width - (borderWidth * 2) - (width / 17) + "px";
    p.style.fontSize = (width / 2) + 1 + "px";
    return p;
}

// calculate the width of the tiles
function calculateWidth(state) {
    let margin = gridSpace;
    let cols = state[0].length;
    let bWidth = boardWidth();
    let width = (bWidth / cols) - (2 * margin);
    return width;
}

// get the width of the board
function boardWidth() {
    let width = board.clientWidth;
    return width;
}

function newGame() {
    if(challenge) {
        answers.pop();
        challenge = false;
    }
    init();
}

// ----------------------------------------------------------------------------- //

/////////////////////////
/// TILE/TEXT CONTROL ///
/////////////////////////

// ----------------------------------------------------------------------------- //

// tileID -- gives the id of a tile element at row,col coords
function tileID(row, col) {
    return "tile[" + row + ", " + col + "]";
}

// textID -- gives the ID of a tileText element at row,col coords
function textID(row, col) {
    return "text[" + row + ", " + col + "]";
}

// get a tile element
function getTile(position) {
    return document.getElementById(tileID(position.getRow(), position.getCol()));
}

// get a tileText element
function getTileText(position) {
    return document.getElementById(textID(position.getRow(), position.getCol()));
}

// editText -- change the text of a tile at a position
function editText(position, text) {
    getTileText(position).innerText = text;
    updateState(position, text);
}

// get the text of a text tile
function getText(position) {
    return getTileText(position).innerText;
}

// ----------------------------------------------------------------------------- //

////////////////
/// GAMEPLAY ///
////////////////

// ----------------------------------------------------------------------------- //

function green(element, border = true) {
    if (border) {
        element.style.border = borderWidth + "px solid " + greenColor;
    }
    element.style.backgroundColor = greenColor;
}

function yellow(element, border = true) {
    if (border) {
        element.style.border = borderWidth + "px solid " + yellowColor;
    }
    element.style.backgroundColor = yellowColor;
}

function grey(element, border = true) {
    if (border) {
        element.style.border = borderWidth + "px solid " + greyColor;
    }
    element.style.backgroundColor = greyColor;
}

// REVEAL AND COLOR A ROW
function revealRow(position, score) {
    typing = false;
    let pos = new Position(position.getRow(), 0, rows, cols);
    animateFlip(pos, flipTime, flipExp, flipNextFrac, score);
}

// END OF REVEAL -- do anything that should happen after all letters are revealed.
function endOfReveal(position, scoreArr) {
    typing = true;
    colorKeyboard(position, scoreArr);
    checkIfEnded(word(position));
}

// Reset Keyboard Colors
function resetKeyboard() {
    Array.from(document.querySelectorAll(".letter")).forEach(e => e.style.backgroundColor = keyboardDefault);
}

// Color the Keyboard according to a score
function colorKeyboard(position, score) {
    let wordArr = Array.from(word(position));
    for (let i = 0; i < wordArr.length; i++) {
        if (letters[wordArr[i].toLowerCase()] < score[i]) {
            letters[wordArr[i].toLowerCase()] = score[i];
            let elem = document.getElementById(wordArr[i].toUpperCase())
            switch (score[i]) {
                case 0:
                    grey(elem, false);
                    break;
                case 1:
                    yellow(elem, false);
                    break;
                case 2:
                    green(elem, false);
                    break;
            }
        }
    }
}

// ACTIVE
function active(element) {
    element.style.border = borderWidth + "px solid " + borderColorActive;
}

// INACTIVE
function inactive(element) {
    element.style.border = borderWidth + "px solid " + borderColor;
}

function animateInvalid(currPos, offset, timeS, iterations) {
    let rowDiv = document.getElementById(currPos.getRow());
    rowDiv.animate([
        // keyframes
        { transform: 'translateX(0px)' },
        { transform: 'translateX(' + (-offset) + 'px)' },
        { transform: 'translateX(0px)' },
        { transform: 'translateX(' + offset + 'px)' },
        { transform: 'translateX(0px)' }
    ], {
        // timing options
        duration: timeS * 1000,
        iterations: iterations,
    });
}

function animateInput(currPos, scale, timeS) {
    let tile = getTile(currPos);
    tile.animate([
        // keyframes
        { transform: 'scale(1)' },
        { transform: 'scale(' + scale + ')' },
        { transform: 'scale(1)' },

    ], {
        // timing options
        duration: timeS * 1000,
        iterations: 1,
    });
}

// COLOR A SPECIFIC TILE
function colorTile(elem, score) {
    switch (score) {
        case 0:
            grey(elem);
            break;
        case 1:
            yellow(elem);
            break;
        case 2:
            green(elem);
            break;
    }
}

// ANIMATE FLIP
function animateFlip(position, time, exp, nextFrac, scoreArr) {     // exp is the exponent to control the speed of the flip
    // nextFrac is the % of time through the anim to wait before starting the next
    let start;
    let duration = time / 2;
    let elem = getTile(position);
    let beganNext = false;
    let myCol = position.getCol();

    // FLIP DOWN
    function flipDown(timestamp) {
        if (start == undefined) {
            start = timestamp;
        }

        let elapsed = (timestamp - start) / 1000; // time elapsed in seconds
        let scale = (-((elapsed / duration) ** exp)) + 1;

        // begin next flip
        if (elapsed >= (nextFrac * time) && position.getCol() < cols - 1 && beganNext == false) {
            animateFlip(position.next(), time, exp, nextFrac, scoreArr);
            beganNext = true;
        }

        if (scale <= 0) {
            scale = 0;
            colorTile(elem, scoreArr[myCol]);
            elem.style.transform = "scaleY(" + scale + ")";
            window.requestAnimationFrame(flipUp)
            return;
        }

        elem.style.transform = "scaleY(" + scale + ")";
        window.requestAnimationFrame(flipDown);
    }

    // FLIP UP
    function flipUp(timestamp) {
        let elapsed = (timestamp - start) / 1000; // time elapsed in seconds
        let scale = ((elapsed - (2 * duration)) / duration) ** exp + 1;

        // Begin next flip
        if (elapsed >= (nextFrac * time) && position.getCol() < cols - 1 && beganNext == false) {
            animateFlip(position.next(), time, exp, nextFrac, scoreArr);
            beganNext = true;
        }

        if (scale >= 1) {
            scale = 1;
            elem.style.transform = "scaleY(" + scale + ")";

            if (position.getCol() >= cols - 1) {
                endOfReveal(position, scoreArr);
            }
            return;
        }

        elem.style.transform = "scaleY(" + scale + ")";
        window.requestAnimationFrame(flipUp);
    }

    window.requestAnimationFrame(flipDown);
}


// UPDATE STATE
function updateState(position, key) {
    state[position.getRow()][position.getCol()] = key;
}

// WORD 
function word(position) {
    let word = state[position.getRow()].join("");
    return word;
}

// CHECK VALID
function checkValid(word) {
    if (dict[word]) {
        console.log(word + " valid");
        return true;
    }
    console.log(word + " invalid");
    animateInvalid(currPos, invalidOffset, invalidTime, invalidIterations);
    return false;
}

// // CHECK ANSWER
// function checkAnswer(word) {
//     if (word == answer) {
//         endGame(word);
//         return score(word);
//     }
//     return score(word);
// }

function score(word) {
    let ans = Array.from(answer);
    let guess = Array.from(word);
    let score = new Array(guess.length).fill(0);

    /* 
        1. check for exact matches, remove from ans
        2. check for half matches, remove from ans
        3. push zeroes elsewhere
    */

    // STEP 1
    for (let i = 0; i < guess.length; i++) {
        if (guess[i] == ans[i]) {
            ans[i] = "~";
            guess[i] = "}";
            score[i] = 2;
        }
    }

    // STEP 2
    for (let i = 0; i < guess.length; i++) {
        let index = myIndexOf(ans, guess[i], i);
        if (!(index == -1)) {
            ans[index] = "~";       // can replace i with index for slightly different results
            score[i] = 1;
        }
    }
    return score;
}

// finds the index of the elements occurence that is closest to the start index
function myIndexOf(array, element, start) {
    for (let i = start; i >= 0; i--) {
        if (array[i] == element) {
            return i;
        }
    }
    for (let i = start + 1; i < array.length; i++) {
        if (array[i] == element) {
            return i;
        }
    }
    return -1;
}

function checkIfEnded(word) {
    if (word == answer || (currPos.getRow() == rows - 1 && currPos.getCol() == cols - 1)) {
        endGame(word);
    }
}

function endGame(word) {
    if (word == answer) {
        ended = true;
        reveal("You win!");
    }
    else {
        ended = true;
        reveal(answer);
    }
}

function reveal(text) {
    let reveal = document.getElementById("reveal");
    reveal.innerText = text;
    reveal.style.display = "block";
}

function generateChallengeLink() {
    if (document.getElementById("customWord").value == "") {
        return;
    }

    var input = document.getElementById("customWord").value + "_" + document.getElementById("customTries").value;

    var encrypted = CryptoJS.AES.encrypt(input, "wordle");

    encrypted = encrypted.toString().replaceAll('&', 'flM667');
    encrypted = encrypted.toString().replaceAll('+', 'll1994n');
    encrypted = encrypted.toString().replaceAll('/', 'jf0901DD');

    var str = window.location.protocol + "//" + window.location.host + window.location.pathname + "?e=" + encrypted;

    navigator.clipboard.writeText(str);
}

// ----------------------------------------------------------------------------- //

///////////////////////
/// EVENT HANDLERS ////
///////////////////////

// ----------------------------------------------------------------------------- //

document.addEventListener("keydown", (e) => {
    if (!typing || ended) {
        return;
    }
    let key = e.key;
    switch (key) {
        case "Backspace":
            handleBackspace();
            break;
        case "Enter":
            handleEnter();
            break;
        default:
            if (new RegExp('^[a-zA-Z]{1}$').test(key)) {
                handleInput(key.toUpperCase());
            }
    }
});

// Start a new puzzle.
document.getElementById("generate").addEventListener("click", () => {
    newGame();
    new ToastNotification().generate("New game started!", 2000, "hsl(115, 40%, 50%)");
});

/* Fixes a "bug" which wasnt really a bug. Occasionally the user would
accidentally tab into the "generate" button, and then begin typing. 
When they press "enter" it would reset the board, but it looks like
the word wasnt accepted. */
document.getElementById("generate").addEventListener("focus", () => {
    typing = false;
});
document.getElementById("generate").addEventListener("focusout", () => {
    typing = true;
});

// Prevents any typed input meant for the input from going into the game
Array.from(document.querySelectorAll("ul > label > input")).forEach(e => e.addEventListener("focus", () => {
    typing = false;
}));
Array.from(document.querySelectorAll("ul > label > input")).forEach(e => e.addEventListener("focusout", () => {
    typing = true;
}));

// set ID's for the keyboard divs ---> this could be done in the html but i didnt want to.
Array.from(document.querySelectorAll(".letter")).forEach(e => e.id = e.innerText.toUpperCase());

// Add event listeners to the keyboard buttons
Array.from(document.querySelectorAll(".letter")).forEach(e => e.addEventListener("click", () => {
    if (ended) {
        return;
    }
    handleInput(e.innerText.toUpperCase());
}));

// generate challenge link
document.getElementById("generateID").addEventListener("click", (e) => {
    e.stopPropagation();
    generateChallengeLink();
    new ToastNotification().copyLink("Copied to clipboard!", 2000, "hsl(115, 40%, 50%)");
});


// ----------------------------------------------------------------------------- //

/////////////////////
/// HANDLE INPUTS ///
/////////////////////

// ----------------------------------------------------------------------------- //

document.getElementById("backspace").addEventListener("click", () => {
    if (ended) {
        return;
    }
    handleBackspace();
});

document.getElementById("enter").addEventListener("click", () => {
    if (ended) {
        return;
    }
    handleEnter();
});

// HANDLE BACKSPACE
function handleBackspace() {
    if (getText(currPos) == emptyText && !currPos.rowChangePrev()) {
        currPos.prev();
    }
    if (getText(currPos) != emptyText) {
        editText(currPos, emptyText);
        inactive(getTile(currPos));
    }
}

// HANDLE ENTER
function handleEnter() {
    if (getText(currPos) == emptyText) {
        return;
    }
    if (checkValid(word(currPos))) {
        // let score = checkAnswer(word(currPos));
        revealRow(currPos, score(word(currPos)));
        currPos.next();
        return;
    }
}

// HANDLE ALPHABETIC INPUT
function handleInput(key) {
    if (getText(currPos) == emptyText) {
        editText(currPos, key);
        active(getTile(currPos));
        animateInput(currPos, inputAnimScale, inputAnimTime);
    }
    if (!currPos.rowChangeNext()) {
        currPos.next();
    }
}

// ----------------------------------------------------------------------------- //

///////////////
/// RUNTIME ///
///////////////

// ----------------------------------------------------------------------------- //

init();

