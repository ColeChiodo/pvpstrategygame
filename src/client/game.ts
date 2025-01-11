const SCALE = 3.125;

let arenaImage: HTMLImageElement | null = null;
let arena: Arena | null = null;
let player: Player | null = null;

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function drawBackground() {
    ctx.fillStyle = '#222034';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawArena() {
    if (arenaImage) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(arenaImage, (canvas.width - arena!.width * SCALE) / 2, (canvas.height - arena!.height * SCALE + 16 * SCALE) / 2, arena!.width * SCALE, arena!.height * SCALE);
    }
}

function drawPlayer() {
    if (!player) return;
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.height, player.height);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawArena();
    drawInteractionSquares();
    drawPlayer();
}

window.addEventListener('keydown', (e) => {
    console.log('Key pressed:', e.key);
    window.socket.emit('player-action', e.key);
});

function gameLoop() {
    window.socket.on('gameState', (gameState) => {
        console.log('Game State:', gameState);
        loadArenaImage(gameState.arena); // move to a game start function in the future to only load once
        loadBox(gameState.box); // move to a game start function in the future to only load once
        draw();
    });
}

gameLoop();

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function loadArenaImage(newArena: Arena) {
    if (!arenaImage) {  // Only load the image once
        arenaImage = new Image();
        arenaImage.src = `/assets/maps/${newArena.image}`;
        arena = newArena;
        arenaImage.onload = () => {
            drawArena();
        };
    }
}

function loadBox(newBox: Player) {
    if (!player) {
        player = newBox;
    } else {
        player.x = newBox.x;
        player.y = newBox.y;
    }
}

function resizeCanvas() {
    canvas.width = window.outerWidth;
    canvas.height = window.outerHeight;
    draw();
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let tiles: { x: number, y: number, row: number, col: number}[] = [];

function drawInteractionSquares() {
    if (!arenaImage) return;
    const tileWidth = 100; // width of an isometric tile
    const tileHeight = 50; // height of an isometric tile
    const rows = 10;       // number of rows in the grid
    const cols = 10;       // number of columns in the grid

    // get canvas center
    const imgCenterX = canvas.width / 2;
    const imgCenterY = canvas.height / 2;

    // Calculate the total width and height of the grid
    const gridWidth = (cols - 1) * tileWidth / 2;  // Total width of the grid
    const gridHeight = (rows - 1) * tileHeight / 2; // Total height of the grid

    // Calculate the offset to center the grid on the image
    const offsetX = imgCenterX - tileWidth / 2;
    const offsetY = imgCenterY - gridHeight - tileHeight * 1.5;

    // Draw the tiles
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // Calculate isometric coordinates
            const isoX = (col - row) * tileWidth / 2 + offsetX;
            const isoY = (col + row) * tileHeight / 2 + offsetY;

            tiles.push(drawIsometricTile(isoX, isoY, row, col));
        }
    }
}

function drawIsometricTile(x: number, y: number, row: number, col: number) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 50, y + 25);
    ctx.lineTo(x + 100, y);
    ctx.lineTo(x + 50, y - 25);
    ctx.closePath();
    
    //ctx.stroke();

    return { x, y, row, col };
}

function isPointInsideTile(px: number, py: number, tile: { x: number, y: number }): boolean {
    // Vertices of the tile
    const x1 = tile.x, y1 = tile.y;
    const x2 = tile.x + 50, y2 = tile.y + 25;
    const x3 = tile.x + 100, y3 = tile.y;
    const x4 = tile.x + 50, y4 = tile.y - 25;

    // Helper function to calculate the area of a triangle given by three points
    const sign = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): number => {
        return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    };

    // Check if the point is inside the tile (diamond shape)
    const d1 = sign(px, py, x1, y1, x2, y2);
    const d2 = sign(px, py, x2, y2, x3, y3);
    const d3 = sign(px, py, x3, y3, x4, y4);
    const d4 = sign(px, py, x4, y4, x1, y1);

    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0) || (d4 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0) || (d4 > 0);

    // Point is inside the tile if all signs are the same (either all positive or all negative)
    return !(hasNeg && hasPos);
}


// Attach click event listener to the canvas
canvas.addEventListener('click', function(event) {
    const clickX = event.offsetX;
    const clickY = event.offsetY;

    // Iterate over tiles to see if the click is inside any of them
    for (const tile of tiles) {
        if (isPointInsideTile(clickX, clickY, tile)) {
            console.log(`You clicked on: ${tile.col}, ${tile.row}`);
            break;
        }
    }
});