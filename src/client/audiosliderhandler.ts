const volumeSlider = document.getElementById("volumeSlider") as HTMLInputElement;
const volumeIcon = document.getElementById("volumeIcon") as HTMLImageElement;

const gainNode = window.gainNode as GainNode;

let isMuted = gainNode.gain.value === 0;

volumeSlider.addEventListener("input", () => {
    const volume = volumeSlider.valueAsNumber;
    gainNode.gain.value = volume;
    
    volumeIcon.src = volume === 0 ? "/assets/global/mute.png" : "/assets/global/audio.png";
    isMuted = volume === 0;
});

function toggleMute() {
    isMuted = !isMuted;
    gainNode.gain.value = isMuted ? 0 : volumeSlider.valueAsNumber;
    
    volumeIcon.src = isMuted ? "/assets/global/mute.png" : "/assets/global/audio.png";
    console.log(`isMuted: ${isMuted}`);
}

document.addEventListener("DOMContentLoaded", () => {
    const volume = volumeSlider.valueAsNumber;
    gainNode.gain.value = volume;

    volumeIcon.src = volume === 0 ? "/assets/global/mute.png" : "/assets/global/audio.png";
    isMuted = volume === 0;
});

window.toggleMute = toggleMute;
