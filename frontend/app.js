const socket = io("http://127.0.0.1:3000");

const params = new URLSearchParams(window.location.search);
const room = params.get("room");

console.log("Room ID:", room);

if (room) {
  socket.emit("join-room", room);
}

socket.on("now-playing", (data) => {
  if (!data) {
    document.getElementById("song").innerText = "Nothing playing";
    document.getElementById("artist").innerText = "Play something on Spotify";
    document.getElementById("status").innerText = "";
    document.getElementById("art").src = "";
    return;
  }

  document.getElementById("art").src = data.image;
  document.getElementById("song").innerText = data.song;
  document.getElementById("artist").innerText = data.artist;

  document.getElementById("status").innerText =
    data.isPlaying ? "🟢 Live" : "⏸ Paused";
});