function createConfetti(x, y) {
    const colors = ['#ff3366', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#FFD700', '#FFA500'];
    
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        confetti.style.left = x + 'px';
        confetti.style.top = y + 'px';
        
        const size = 5 + Math.random() * 5;
        confetti.style.width = size + 'px';
        confetti.style.height = size + 'px';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        
        document.body.appendChild(confetti);
        
        const angle = Math.random() * Math.PI * 2;
        const velocity = 30 + Math.random() * 30;
        const tx = Math.cos(angle) * velocity * (Math.random() - 0.5) * 2;
        const ty = Math.sin(angle) * velocity * (Math.random() - 0.5) * 2;
        
        confetti.animate([
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], {
            duration: 1000 + Math.random() * 1000,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }).onfinish = () => confetti.remove();
    }
}

function createRocket() {
    if (!document.querySelector('.rocket')) {
        const rocket = document.createElement('span');
        rocket.className = 'rocket';
        rocket.textContent = '🚀';
        document.body.appendChild(rocket);
        
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        rocket.style.left = centerX + 'px';
        rocket.style.top = centerY + 'px';
        
        let angle = 0;
        const radius = Math.min(window.innerWidth, window.innerHeight) * 0.3;
        const duration = 5000;
        const startTime = Date.now();
        
        function updatePosition() {
            const elapsed = Date.now() - startTime;
            angle = (elapsed / duration) * Math.PI * 2;
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            rocket.style.left = x + 'px';
            rocket.style.top = y + 'px';
            rocket.style.transform = `rotate(${angle * (180/Math.PI) + 90}deg)`;
            
            if (elapsed < 5000) {
                requestAnimationFrame(updatePosition);
            } else {
                createConfetti(x, y);
                rocket.remove();
            }
        }
        
        requestAnimationFrame(updatePosition);
    }
}

function launchVerticalRocket() {
    const rocket = document.createElement('span');
    rocket.className = 'vertical-rocket';
    rocket.textContent = '🚀';
    document.body.appendChild(rocket);
    
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight - 100;
    rocket.style.left = startX + 'px';
    rocket.style.top = startY + 'px';
    
    let progress = 0;
    const duration = 2000;
    const startTime = Date.now();
    
    function updatePosition() {
        const elapsed = Date.now() - startTime;
        progress = elapsed / duration;
        
        if (progress < 1) {
            const currentY = startY - (progress * window.innerHeight * 0.7);
            rocket.style.top = currentY + 'px';
            requestAnimationFrame(updatePosition);
        } else {
            createConfetti(startX, startY - (window.innerHeight * 0.7));
            rocket.remove();
        }
    }
    
    requestAnimationFrame(updatePosition);
}

document.addEventListener('DOMContentLoaded', function() {
    const confettiButton = document.getElementById('confettiButton');
    const launchButton = document.getElementById('launchButton');
    
    if (confettiButton) {
        confettiButton.addEventListener('click', createRocket);
    }

    if (launchButton) {
        launchButton.addEventListener('click', launchVerticalRocket);
    }
});