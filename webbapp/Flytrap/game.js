const fly = document.getElementById('fly');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const timerDisplay = document.getElementById('timer');
const scoreDisplay = document.getElementById('score');
const topScores = document.getElementById('topScores');
const gameContainer = document.getElementById('game-container');
const flyCounterDisplay = document.getElementById('flyCounter');

const flyImage = `data:image/svg+xml;base64,${btoa(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- Body segments -->
  <ellipse cx="32" cy="32" rx="12" ry="8" fill="#1a1a1a"/>
  <ellipse cx="32" cy="24" rx="8" ry="6" fill="#333"/>
  
  <!-- Wings -->
  <path class="wing left" d="M20 28c-8-4-16 2-16 8s4 12 12 8s12-12 4-16" fill="rgba(136,136,136,0.3)" stroke="#666" stroke-width="0.5"/>
  <path class="wing right" d="M44 28c8-4 16 2 16 8s-4 12-12 8s-12-12-4-16" fill="rgba(136,136,136,0.3)" stroke="#666" stroke-width="0.5"/>
  
  <!-- Head -->
  <circle cx="32" cy="18" r="6" fill="#333"/>
  
  <!-- Eyes -->
  <ellipse cx="29" cy="16" rx="2.5" ry="2" fill="#c41e3a"/>
  <ellipse cx="35" cy="16" rx="2.5" ry="2" fill="#c41e3a"/>
  
  <!-- Legs -->
  <path d="M28 30l-8 8M32 32l-8 10M36 30l-6 12" stroke="#1a1a1a" stroke-width="1"/>
  <path d="M36 30l8 8M32 32l8 10M28 30l6 12" stroke="#1a1a1a" stroke-width="1"/>
  
  <!-- Antennae -->
  <path d="M30 14c-2-4-4-6-6-6M34 14c2-4 4-6 6-6" fill="none" stroke="#1a1a1a" stroke-width="0.75"/>
</svg>`)}`;

let gameInterval;
let timeLeft;
let score;
let isGameRunning = false;
let fliesRemaining = 10;

// Set initial fly image
fly.src = flyImage;
fly.style.display = 'none'; // Hide fly initially

function createSplat(x, y) {
    const splat = document.createElement('div');
    splat.className = 'splat';
    splat.style.left = `${x - 15}px`;
    splat.style.top = `${y - 15}px`;
    splat.style.backgroundColor = '#8B0000';
    splat.style.borderRadius = '50%';
    splat.style.transform = `rotate(${Math.random() * 360}deg)`;
    gameContainer.appendChild(splat);

    // Create smaller splatter particles
    for (let i = 0; i < 5; i++) {
        const particle = document.createElement('div');
        particle.className = 'splat';
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 20 + 10;
        particle.style.left = `${x + Math.cos(angle) * distance - 5}px`;
        particle.style.top = `${y + Math.sin(angle) * distance - 5}px`;
        particle.style.width = '10px';
        particle.style.height = '10px';
        particle.style.backgroundColor = '#8B0000';
        particle.style.borderRadius = '50%';
        gameContainer.appendChild(particle);
    }
}

function moveFly() {
    const maxX = gameContainer.clientWidth - fly.clientWidth;
    const maxY = gameContainer.clientHeight - fly.clientHeight;
    
    // Create bezier curve animation
    fly.style.transition = 'all 1s cubic-bezier(.17,.67,.83,.67)';
    fly.style.left = `${Math.random() * maxX}px`;
    fly.style.top = `${Math.random() * maxY}px`;
    fly.style.transform = `rotate(${Math.random() * 360}deg)`;
}

function updateLeaderboard() {
    const scores = JSON.parse(localStorage.getItem('flyGameScores') || '[]');
    // Sort by score first, then by flies caught, then by time left
    scores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.fliesCaught !== a.fliesCaught) return b.fliesCaught - a.fliesCaught;
        return b.timeLeft - a.timeLeft;
    });
    
    const top5 = scores.slice(0, 5);
    topScores.innerHTML = top5.map((result, index) => `
        <li>
            <span class="rank">#${index + 1}</span>
            <span class="score">Score: ${result.score}</span>
            <span class="flies">Flies: ${result.fliesCaught}/10</span>
            <span class="time">Time: ${result.timeLeft}s</span>
            <span class="date">${result.date}</span>
        </li>
    `).join('');
}

function startGame() {
    isGameRunning = true;
    score = 0;
    timeLeft = 60;
    fliesRemaining = 10;
    
    // Reset displays
    scoreDisplay.textContent = score;
    timerDisplay.textContent = timeLeft;
    flyCounterDisplay.textContent = fliesRemaining;
    
    // Update buttons
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    // Show fly and start movement
    fly.style.display = 'block';
    moveFly();

    // Clear any existing splats
    document.querySelectorAll('.splat').forEach(splat => splat.remove());

    // Start game timer
    gameInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        
        if (timeLeft % 2 === 0) { // Move fly every 2 seconds
            moveFly();
        }

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function endGame() {
    isGameRunning = false;
    clearInterval(gameInterval);
    fly.style.display = 'none';
    startBtn.disabled = false;
    stopBtn.disabled = true;

    // Save score with additional details
    const gameResult = {
        score: score,
        fliesCaught: 10 - fliesRemaining, // Total flies caught
        timeLeft: timeLeft,
        date: new Date().toLocaleDateString()
    };

    const scores = JSON.parse(localStorage.getItem('flyGameScores') || '[]');
    scores.push(gameResult);
    localStorage.setItem('flyGameScores', JSON.stringify(scores));
    updateLeaderboard();
}

// Event Listeners
fly.addEventListener('click', (e) => {
    if (isGameRunning) {
        // Create splat effect first
        createSplat(e.pageX, e.pageY);
        
        // Update score and counter
        score++;
        fliesRemaining--;
        scoreDisplay.textContent = score;
        flyCounterDisplay.textContent = fliesRemaining;
        
        // Hide the fly immediately on last catch
        if (fliesRemaining <= 0) {
            fly.style.display = 'none';
            
            // Delay the end game alert to see the final splat
            setTimeout(() => {
                alert('Congratulations! You caught all the flies!');
                endGame();
            }, 500); // Increased delay to 500ms for better visibility
        } else {
            // Only move the fly if there are more flies remaining
            moveFly();
        }
    }
});

startBtn.addEventListener('click', startGame);
stopBtn.addEventListener('click', endGame);

// Initial leaderboard display
updateLeaderboard();
