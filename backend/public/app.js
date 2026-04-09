const socket = io();

const params = new URLSearchParams(window.location.search);
const room = params.get("room");

if (room) {
  socket.emit("join-room", room);
}

socket.on("now-playing", (data) => {
  if (!data) {
    document.getElementById("song").innerText = "Nothing playing";
    document.getElementById("artist").innerText = "";
    document.getElementById("status").innerText = "";
    return;
  }

  document.getElementById("art").src = data.image;
  document.getElementById("song").innerText = data.song;
  document.getElementById("artist").innerText = data.artist;
  document.getElementById("status").innerText =
    data.isPlaying ? "🟢 Live" : "⏸ Paused";
});