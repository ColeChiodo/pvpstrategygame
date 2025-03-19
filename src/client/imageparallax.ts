const layers = [
    document.getElementById('5'),
    document.getElementById('4'),
    document.getElementById('3'),
    document.getElementById('2'),
    document.getElementById('1'),
];

let mouseX = 0, mouseY = 0;
let scrollYpos = 0;

function handleParallax() {
    scrollYpos = window.scrollY;
    updateTransforms();
}

function handleMouseMove(event: any) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    mouseX = (event.clientX - centerX) * 0.01;
    mouseY = (event.clientY - centerY) * 0.01;

    updateTransforms();
}

function updateTransforms() {
    layers.forEach((layer, index) => {
        if (!layer) return;
        const depth = (index + 1) * 0.5;
        const scrollSpeed = (index + 1) * 0.2;

        const offsetX = mouseX * depth;
        const offsetY = mouseY * depth;
        const scrollOffsetY = scrollY * scrollSpeed;

        layer.style.transform = `translate(${offsetX}px, ${scrollOffsetY + offsetY}px) scale(1.1)`;
    });
}

window.addEventListener('scroll', handleParallax);
window.addEventListener('mousemove', handleMouseMove);