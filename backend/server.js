const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());

// 🔐 Store tokens + rooms (in-memory)
let userTokens = {};
let rooms = {};


// 🔁 REFRESH TOKEN FUNCTION (NEW)
async function refreshAccessToken(userId) {
  const refresh_token = userTokens[userId]?.refresh_token;

  if (!refresh_token) {
    console.log("No refresh token");
    return;
  }

  try {
    const res = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    userTokens[userId].access_token = res.data.access_token;

    console.log("✅ Token refreshed");

  } catch (err) {
    console.error("❌ Refresh failed:", err.response?.data || err.message);
  }
}


// 🔐 LOGIN
app.get("/login", (req, res) => {
  const scope = "user-read-currently-playing";

  const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&scope=${scope}&redirect_uri=${process.env.REDIRECT_URI}`;

  res.redirect(authURL);
});


// 🔁 CALLBACK
app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;

    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.REDIRECT_URI,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    const userId = uuidv4();

    // ✅ STORE TOKENS PROPERLY
    userTokens[userId] = {
      access_token: tokenRes.data.access_token,
      refresh_token: tokenRes.data.refresh_token
    };

    const roomId = uuidv4();
    rooms[roomId] = userId;

    console.log("User:", userId);
    console.log("Room:", roomId);

    // 🔥 REDIRECT TO FRONTEND ROOM PAGE
    res.redirect(`http://127.0.0.1:5500/frontend/room.html?room=${roomId}`);

  } catch (err) {
    console.error("Callback error:", err.response?.data || err.message);
    res.send("Auth failed");
  }
});


// 🎵 GET NOW PLAYING (WITH AUTO REFRESH)
async function getNowPlaying(userId) {
  try {
    const token = userTokens[userId]?.access_token;

    const res = await axios.get(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!res.data || !res.data.item) return null;

    return {
      song: res.data.item.name,
      artist: res.data.item.artists.map(a => a.name).join(", "),
      image: res.data.item.album.images[0].url,
      isPlaying: res.data.is_playing
    };

  } catch (err) {
    // 🔥 AUTO REFRESH TRIGGER
    if (err.response?.status === 401) {
      console.log("⚠️ Token expired, refreshing...");
      await refreshAccessToken(userId);
      return getNowPlaying(userId); // retry
    }

    console.log("Spotify error:", err.response?.status);
    return null;
  }
}


// ⚡ SOCKET.IO
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("join-room", (roomId) => {
    console.log("Joining room:", roomId);

    socket.join(roomId);

    const interval = setInterval(async () => {
      const userId = rooms[roomId];

      if (!userId) return;

      const data = await getNowPlaying(userId);

      console.log("Sending:", data);

      io.to(roomId).emit("now-playing", data);

    }, 5000);

    socket.on("disconnect", () => {
      clearInterval(interval);
      console.log("Client disconnected");
    });
  });
});


server.listen(PORT, () => {
  console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
});