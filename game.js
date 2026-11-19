"use strict";

const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const overlay = document.querySelector("#game-overlay");
const overlayEyebrow = document.querySelector("#overlay-eyebrow");
const overlayTitle = document.querySelector("#overlay-title");
const overlayMessage = document.querySelector("#overlay-message");
const overlayAction = document.querySelector("#overlay-action");
const overlayFootnote = document.querySelector("#overlay-footnote");
const leaderboardButton = document.querySelector("#leaderboard-button");
const leaderboardList = document.querySelector("#leaderboard-list");
const leaderboardEmpty = document.querySelector("#leaderboard-empty");
const scoreForm = document.querySelector("#score-form");
const playerNameInput = document.querySelector("#player-name");
const scoreValue = document.querySelector("#score-value");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_Y = 365;
const LEADERBOARD_KEY = "skybound.leaderboard.v1";
const audio = new AudioManager();

let state = "ready";
let overlayMode = "ready";
let elapsed = 0;
let score = 0;
let coinsCollected = 0;
let spawnTimer = 1;
let coinTimer = 1.5;
let groundOffset = 0;
let lastFrame = 0;
let scoreSubmitted = false;
let obstacles = [];
let coins = [];
const player = { x: 112, y: GROUND_Y - 42, width: 34, height: 42, velocityY: 0, onGround: true };

function readLeaderboard() {
  try {
    const saved = window.localStorage.getItem(LEADERBOARD_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      console.warn("The saved Skybound leaderboard is not a list; starting with an empty board.");
      return [];
    }

    return parsed
      .filter((entry) =>
        entry &&
        typeof entry.name === "string" &&
        typeof entry.score === "number" &&
        Number.isFinite(entry.score) &&
        entry.score >= 0
      )
      .map((entry) => ({
        name: entry.name.trim().slice(0, 16) || "Cloud chaser",
        score: Math.floor(entry.score),
        date: typeof entry.date === "string" ? entry.date : ""
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch (error) {
    console.warn("Could not read the Skybound leaderboard from local storage.", error);
    return [];
  }
}

let leaderboard = readLeaderboard();

function writeLeaderboard() {
  try {
    window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
  } catch (error) {
    console.warn("Could not save the Skybound leaderboard to local storage.", error);
    overlayFootnote.textContent = "Could not save on this device. Your score is shown for now.";
    return false;
  }
  return true;
}

function renderLeaderboard() {
  leaderboardList.replaceChildren();
  leaderboardEmpty.hidden = leaderboard.length > 0;

  leaderboard.forEach((entry, index) => {
    const row = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const points = document.createElement("span");
    rank.className = "rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    name.textContent = entry.name;
    points.className = "points";
    points.textContent = String(entry.score).padStart(5, "0");
    row.append(rank, name, points);
    leaderboardList.append(row);
  });
}

function updateScoreDisplay() {
  scoreValue.textContent = String(Math.floor(score)).padStart(5, "0");
}

function showOverlay(mode) {
  overlayMode = mode;
  overlay.hidden = false;
  scoreForm.hidden = (mode !== "gameOver" && !(mode === "leaderboard" && state === "over")) || scoreSubmitted;
  overlayAction.hidden = false;
  overlayFootnote.textContent = "Five spots. One local leaderboard.";

  if (mode === "ready") {
    overlayEyebrow.textContent = "READY WHEN YOU ARE";
    overlayTitle.textContent = "Chase the clouds.";
    overlayMessage.textContent = "Jump over the little things. Grab the shiny ones. How far can you go?";
    overlayAction.innerHTML = 'Start running <span aria-hidden="true">↗</span>';
    overlayFootnote.textContent = "SPACE or ↑ to jump. Coins are worth 100 points.";
  } else if (mode === "gameOver") {
    overlayEyebrow.textContent = "RUN COMPLETE";
    overlayTitle.textContent = "Nice little run.";
    overlayMessage.textContent = `You scored ${Math.floor(score)} points and picked up ${coinsCollected} ${coinsCollected === 1 ? "coin" : "coins"}.`;
    overlayAction.innerHTML = 'Run it back <span aria-hidden="true">↗</span>';
    if (!scoreSubmitted) playerNameInput.value = "";
    playerNameInput.disabled = scoreSubmitted;
    if (scoreSubmitted) overlayAction.textContent = "Play again";
    overlayFootnote.textContent = "Your score stays on this device.";
  } else {
    overlayEyebrow.textContent = "THE LOCAL LEGENDS";
    overlayTitle.textContent = "Leaderboard";
    overlayMessage.textContent = state === "paused"
      ? "Take a breather. Your run is paused."
      : "Five spots. Your best run could be one of them.";
    overlayAction.innerHTML = state === "paused"
      ? 'Back to the run <span aria-hidden="true">↗</span>'
      : state === "over"
        ? 'Start a new run <span aria-hidden="true">↗</span>'
        : 'Start running <span aria-hidden="true">↗</span>';
  }

  renderLeaderboard();
}

function startGame() {
  state = "running";
  scoreSubmitted = false;
  elapsed = 0;
  score = 0;
  coinsCollected = 0;
  spawnTimer = 1;
  coinTimer = 1.2;
  groundOffset = 0;
  obstacles = [];
  coins = [];
  player.y = GROUND_Y - player.height;
  player.velocityY = 0;
  player.onGround = true;
  updateScoreDisplay();
  overlay.hidden = true;
}

function pauseForLeaderboard() {
  if (state === "running") state = "paused";
  showOverlay("leaderboard");
}

function jump() {
  if (state !== "running" || !player.onGround) return;
  player.velocityY = -610;
  player.onGround = false;
  audio.play("jump");
}

function endGame() {
  if (state !== "running") return;
  state = "over";
  score = Math.floor(score);
  updateScoreDisplay();
  audio.play("gameOver");
  showOverlay("gameOver");
}

function submitScore(event) {
  event.preventDefault();
  if (state !== "over" || scoreSubmitted) return;

  const name = playerNameInput.value.trim().slice(0, 16) || "Cloud chaser";
  leaderboard.push({ name, score: Math.floor(score), date: new Date().toISOString() });
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 5);
  scoreSubmitted = true;
  const saved = writeLeaderboard();
  showOverlay(overlayMode);
  if (!saved) overlayFootnote.textContent = "Could not save on this device. Your score is shown for now.";
}

function spawnObstacle() {
  const height = 28 + Math.random() * 22;
  const width = 20 + Math.random() * 13;
  obstacles.push({ x: WIDTH + 20, y: GROUND_Y - height, width, height });
}

function spawnCoin() {
  coins.push({
    x: WIDTH + 20,
    y: GROUND_Y - 75 - Math.random() * 75,
    radius: 10,
    phase: Math.random() * Math.PI * 2
  });
}

function overlaps(rect, circle) {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function update(delta) {
  if (state !== "running") return;

  elapsed += delta;
  score += delta * 12;
  const speed = 300 + Math.min(elapsed * 5, 170);
  groundOffset = (groundOffset + speed * delta) % 42;
  player.velocityY += 1550 * delta;
  player.y += player.velocityY * delta;

  if (player.y + player.height >= GROUND_Y) {
    player.y = GROUND_Y - player.height;
    player.velocityY = 0;
    player.onGround = true;
  }

  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = Math.max(0.82, 1.5 + Math.random() * 0.7 - elapsed * 0.006);
  }

  coinTimer -= delta;
  if (coinTimer <= 0) {
    spawnCoin();
    coinTimer = 1.1 + Math.random() * 1.2;
  }

  for (const obstacle of obstacles) obstacle.x -= speed * delta;
  for (const coin of coins) {
    coin.x -= speed * delta;
    coin.phase += delta * 5;
  }
  obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -10);
  coins = coins.filter((coin) => coin.x + coin.radius > -10);

  if (obstacles.some((obstacle) =>
    player.x < obstacle.x + obstacle.width &&
    player.x + player.width > obstacle.x &&
    player.y < obstacle.y + obstacle.height &&
    player.y + player.height > obstacle.y
  )) {
    endGame();
    return;
  }

  const remainingCoins = [];
  for (const coin of coins) {
    if (overlaps(player, coin)) {
      score += 100;
      coinsCollected += 1;
      audio.play("coin");
    } else {
      remainingCoins.push(coin);
    }
  }
  coins = remainingCoins;
  updateScoreDisplay();
}

function drawBackground() {
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#88c4df");
  sky.addColorStop(0.66, "#c2e6e9");
  sky.addColorStop(1, "#e5eccf");
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = "rgb(255 255 255 / 28%)";
  for (let index = 0; index < 5; index += 1) {
    const cloudX = (index * 193 + 70 - elapsed * 12) % (WIDTH + 130);
    const x = cloudX < -70 ? cloudX + WIDTH + 130 : cloudX;
    const y = 55 + (index % 3) * 55;
    context.beginPath();
    context.ellipse(x, y, 42, 10, 0, 0, Math.PI * 2);
    context.ellipse(x - 15, y - 5, 17, 12, 0, 0, Math.PI * 2);
    context.ellipse(x + 6, y - 8, 21, 15, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#b1d6cf";
  context.beginPath();
  context.moveTo(0, GROUND_Y);
  context.lineTo(0, 315);
  context.quadraticCurveTo(180, 285, 340, 330);
  context.quadraticCurveTo(540, 280, WIDTH, 320);
  context.lineTo(WIDTH, GROUND_Y);
  context.fill();

  context.fillStyle = "#52696a";
  context.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  context.fillStyle = "#c8f17b";
  context.fillRect(0, GROUND_Y, WIDTH, 4);
  context.fillStyle = "rgb(255 255 255 / 20%)";
  for (let x = -groundOffset; x < WIDTH; x += 42) {
    context.fillRect(x, GROUND_Y + 18, 19, 2);
  }
}

function drawPlayer() {
  const runningLegOffset = player.onGround && state === "running" ? Math.sin(elapsed * 16) * 3 : 0;
  context.fillStyle = "#29374b";
  context.beginPath();
  context.roundRect(player.x, player.y + 8, player.width, player.height - 8, 10);
  context.fill();
  context.fillStyle = "#c8f17b";
  context.beginPath();
  context.arc(player.x + 23, player.y + 18, 2.4, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#29374b";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(player.x + 9, player.y + player.height - 3);
  context.lineTo(player.x + 8 + runningLegOffset, player.y + player.height + 5);
  context.moveTo(player.x + 25, player.y + player.height - 3);
  context.lineTo(player.x + 26 - runningLegOffset, player.y + player.height + 5);
  context.stroke();
}

function draw() {
  drawBackground();

  for (const obstacle of obstacles) {
    context.fillStyle = "#d8795a";
    context.beginPath();
    context.roundRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 5);
    context.fill();
    context.fillStyle = "#f3a078";
    context.fillRect(obstacle.x + 4, obstacle.y + 5, 3, obstacle.height - 10);
  }

  for (const coin of coins) {
    const bob = Math.sin(coin.phase) * 3;
    context.fillStyle = "rgb(255 210 92 / 25%)";
    context.beginPath();
    context.arc(coin.x, coin.y + bob, coin.radius + 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffd45c";
    context.beginPath();
    context.arc(coin.x, coin.y + bob, coin.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#fff0a7";
    context.lineWidth = 2;
    context.stroke();
  }

  drawPlayer();
}

function frame(timestamp) {
  const delta = lastFrame === 0 ? 0 : Math.min((timestamp - lastFrame) / 1000, 0.04);
  lastFrame = timestamp;
  update(delta);
  draw();
  window.requestAnimationFrame(frame);
}

overlayAction.addEventListener("click", () => {
  if (state === "paused") {
    state = "running";
    overlay.hidden = true;
    return;
  }
  startGame();
});

leaderboardButton.addEventListener("click", pauseForLeaderboard);
scoreForm.addEventListener("submit", submitScore);

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.code !== "ArrowUp") return;
  if (event.target instanceof HTMLInputElement) return;

  event.preventDefault();
  if (state === "ready") {
    startGame();
    jump();
  } else {
    jump();
  }
});

renderLeaderboard();
showOverlay("ready");
window.requestAnimationFrame(frame);

function AudioManager() {
  this.context = null;
}

AudioManager.prototype.play = function (kind) {
  if (!("AudioContext" in window) && !("webkitAudioContext" in window)) return;
  if (!this.context) {
    const Context = window.AudioContext || window.webkitAudioContext;
    this.context = new Context();
  }
  if (this.context.state === "suspended") {
    this.context.resume().catch((error) => console.warn("Could not resume game audio.", error));
  }

  const now = this.context.currentTime;
  const oscillator = this.context.createOscillator();
  const gain = this.context.createGain();
  const settings = {
    jump: { start: 410, end: 690, duration: 0.14, wave: "sine", volume: 0.075 },
    coin: { start: 790, end: 1180, duration: 0.18, wave: "sine", volume: 0.09 },
    gameOver: { start: 440, end: 145, duration: 0.42, wave: "triangle", volume: 0.085 }
  }[kind];
  if (!settings) return;

  oscillator.type = settings.wave;
  oscillator.frequency.setValueAtTime(settings.start, now);
  oscillator.frequency.exponentialRampToValueAtTime(settings.end, now + settings.duration);
  gain.gain.setValueAtTime(settings.volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);
  oscillator.connect(gain);
  gain.connect(this.context.destination);
  oscillator.start(now);
  oscillator.stop(now + settings.duration);
};
