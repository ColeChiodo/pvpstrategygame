const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function drawBackground() {
    ctx.fillStyle = 'cornflowerblue';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPlayer(player: Player) {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.height, player.height);
}

function draw(player: Player) {
    drawBackground();
    drawPlayer(player);
}

window.addEventListener('keydown', (e) => {
    console.log('Key pressed:', e.key);
    window.socket.emit('player-action', e.key);
});

function gameLoop() {
    window.socket.on('gameState', (gameState) => {
        console.log('Game State:', gameState);
        draw(gameState.box);
    });
}

gameLoop();