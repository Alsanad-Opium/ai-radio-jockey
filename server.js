const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// Environment variables
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Initialize Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/callback'
});

// Get Spotify access token
async function refreshSpotifyToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    console.log('Spotify access token refreshed!');
    spotifyApi.setAccessToken(data.body['access_token']);
    
    // Set a timeout to refresh again before expiration
    setTimeout(refreshSpotifyToken, (data.body['expires_in'] - 60) * 1000);
    
    return data.body['access_token'];
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
  }
}

// Generate radio script using DeepSeek API
async function generateRadioScript(includeNextSong = false) {
  try {
    let prompt = "Act as a funny, engaging radio DJ. Share some jokes and discuss recent world news for about 1 minute worth of talking.";
    
    if (includeNextSong) {
      prompt += " In the last 5 seconds, announce the next song that will be played by saying something like 'Coming up next is [SONG NAME] by [ARTIST NAME]!'";
    }
    
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating script with DeepSeek:', error);
    return "Sorry, I'm having technical difficulties. Let's play some music while we fix this!";
  }
}

// Extract song details from the script
function extractSongDetails(script) {
  // Use regex to find song title and artist in the announcement
  const songRegex = /next is ['"]*([^'"]*)['"]*\s+by\s+['"]*([^'"]*)['"]/i;
  const match = script.match(songRegex);
  
  if (match && match.length >= 3) {
    return {
      title: match[1].trim(),
      artist: match[2].trim()
    };
  }
  
  // Fallback to a random popular song
  return getRandomSong();
}

function getRandomSong() {
  const popularSongs = [
    { title: "Blinding Lights", artist: "The Weeknd" },
    { title: "Shape of You", artist: "Ed Sheeran" },
    { title: "Dance Monkey", artist: "Tones and I" },
    { title: "Someone You Loved", artist: "Lewis Capaldi" },
    { title: "Watermelon Sugar", artist: "Harry Styles" }
  ];
  
  return popularSongs[Math.floor(Math.random() * popularSongs.length)];
}

// Convert text to speech using Eleven Labs
async function textToSpeech(text) {
  try {
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Default voice ID (you can change this)
    
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        responseType: 'arraybuffer'
      }
    );
    
    // Convert the binary data to a base64 string
    const audioBase64 = Buffer.from(response.data).toString('base64');
    return `data:audio/mpeg;base64,${audioBase64}`;
  } catch (error) {
    console.error('Error with Eleven Labs TTS:', error);
    return null;
  }
}

// Search for song on Spotify
async function searchSpotifySong(title, artist) {
  try {
    const searchQuery = `track:${title} artist:${artist}`;
    const searchResults = await spotifyApi.searchTracks(searchQuery);
    
    if (searchResults.body.tracks.items.length > 0) {
      return searchResults.body.tracks.items[0];
    } else {
      // Try broader search
      const broadSearchResults = await spotifyApi.searchTracks(`${title} ${artist}`);
      return broadSearchResults.body.tracks.items[0] || null;
    }
  } catch (error) {
    console.error('Error searching Spotify:', error);
    return null;
  }
}

// Radio state
let radioState = {
  isPlaying: false,
  currentSession: null
};

// Start radio session
async function startRadioSession(socket) {
  if (radioState.currentSession) {
    clearTimeout(radioState.currentSession);
  }
  
  radioState.isPlaying = true;
  await runRadioCycle(socket);
}

// Stop radio session
function stopRadioSession() {
  if (radioState.currentSession) {
    clearTimeout(radioState.currentSession);
    radioState.currentSession = null;
  }
  radioState.isPlaying = false;
}

// Run a full radio cycle (DJ talk + song)
async function runRadioCycle(socket) {
  if (!radioState.isPlaying) return;
  
  try {
    // Step 1: Generate the radio script with song announcement
    socket.emit('status', { message: "Generating DJ script..." });
    const script = await generateRadioScript(true);
    
    // Step 2: Extract song details
    const songDetails = extractSongDetails(script);
    
    // Step 3: Convert script to speech
    socket.emit('status', { message: "Converting to speech..." });
    const audioData = await textToSpeech(script);
    
    // Step 4: Send the script and audio to the client
    socket.emit('dj_segment', {
      script: script,
      audio: audioData,
      songDetails: songDetails
    });
    
    // Step 5: Search for the song on Spotify
    socket.emit('status', { message: "Searching for song..." });
    await refreshSpotifyToken(); // Ensure token is fresh
    const track = await searchSpotifySong(songDetails.title, songDetails.artist);
    
    // Allow time for DJ commentary to play (approximately 60 seconds)
    setTimeout(async () => {
      if (!radioState.isPlaying) return;
      
      if (track) {
        // Step 6: Send song details to client
        socket.emit('play_song', {
          uri: track.uri,
          name: track.name,
          artist: track.artists[0].name,
          albumCover: track.album.images[0]?.url,
          previewUrl: track.preview_url,
          duration: track.duration_ms
        });
        
        // Step 7: Schedule the next cycle after song ends
        const songDuration = track.duration_ms || 30000;
        radioState.currentSession = setTimeout(() => {
          if (radioState.isPlaying) {
            runRadioCycle(socket);
          }
        }, songDuration);
      } else {
        // If track not found, try again sooner
        socket.emit('status', { message: "Song not found, trying next DJ segment..." });
        radioState.currentSession = setTimeout(() => {
          if (radioState.isPlaying) {
            runRadioCycle(socket);
          }
        }, 5000);
      }
    }, 60000); // 60 seconds for DJ talk
    
  } catch (error) {
    console.error('Error in radio cycle:', error);
    socket.emit('error', { message: "Technical difficulties. Restarting soon..." });
    
    // Try again after a delay
    radioState.currentSession = setTimeout(() => {
      if (radioState.isPlaying) {
        runRadioCycle(socket);
      }
    }, 10000);
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('start_radio', () => {
    startRadioSession(socket);
  });
  
  socket.on('stop_radio', () => {
    stopRadioSession();
    socket.emit('radio_stopped');
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Initialize Spotify token
  refreshSpotifyToken();
});