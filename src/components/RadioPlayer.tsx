import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Visualizer from './Visualizer';
import { PlayIcon, PauseIcon, StopIcon } from '@heroicons/react/solid';

interface SongDetails {
  title: string;
  artist: string;
}

interface DjSegment {
  script: string;
  audio: string;
  songDetails: SongDetails;
}

interface SongData {
  uri: string;
  name: string;
  artist: string;
  albumCover: string;
  previewUrl: string;
  duration: number;
}

const RadioPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Ready to play");
  const [currentScript, setCurrentScript] = useState<string>("");
  const [currentSong, setCurrentSong] = useState<SongData | null>(null);
  const [mode, setMode] = useState<'dj' | 'song'>('dj');
  const [volume, setVolume] = useState<number>(80);
  
  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000');
    
    // Set up socket event listeners
    socketRef.current.on('connect', () => {
      setIsConnected(true);
    });
    
    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });
    
    socketRef.current.on('status', (data: { message: string }) => {
      setStatusMessage(data.message);
    });
    
    socketRef.current.on('dj_segment', (data: DjSegment) => {
      setCurrentScript(data.script);
      setMode('dj');
      
      if (audioRef.current) {
        audioRef.current.src = data.audio;
        audioRef.current.volume = volume / 100;
        audioRef.current.play().catch(error => {
          console.error('Error playing DJ audio:', error);
        });
      }
    });
    
    socketRef.current.on('play_song', (data: SongData) => {
      setCurrentSong(data);
      setMode('song');
      
      if (audioRef.current) {
        if (data.previewUrl) {
          audioRef.current.src = data.previewUrl;
          audioRef.current.volume = volume / 100;
          audioRef.current.play().catch(error => {
            console.error('Error playing song:', error);
          });
        } else {
          // Handle case where preview URL is not available
          setStatusMessage("Song preview not available. Moving to next track soon...");
          setTimeout(() => {
            if (socketRef.current) {
              socketRef.current.emit('song_ended');
            }
          }, 5000);
        }
      }
    });
    
    socketRef.current.on('radio_stopped', () => {
      setIsPlaying(false);
      setStatusMessage("Radio stopped");
      if (audioRef.current) {
        audioRef.current.pause();
      }
    });
    
    socketRef.current.on('error', (data: { message: string }) => {
      setStatusMessage(`Error: ${data.message}`);
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);
  
  useEffect(() => {
    // Set up audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      audioRef.current.onended = () => {
        if (mode === 'song' && socketRef.current) {
          socketRef.current.emit('song_ended');
        }
      };
    }
    
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume, mode]);
  
  const handlePlayPause = () => {
    if (!isPlaying) {
      // Start radio
      setIsPlaying(true);
      setStatusMessage("Starting radio...");
      if (socketRef.current) {
        socketRef.current.emit('start_radio');
      }
    } else {
      // Pause/resume current audio
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
          setStatusMessage(mode === 'dj' ? "DJ talking..." : `Now playing: ${currentSong?.name}`);
        } else {
          audioRef.current.pause();
          setStatusMessage("Paused");
        }
      }
    }
  };
  
  const handleStop = () => {
    if (socketRef.current) {
      socketRef.current.emit('stop_radio');
    }
    setIsPlaying(false);
    setStatusMessage("Stopping radio...");
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
  };
  
  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden transition-colors duration-300">
      {/* Radio Display */}
      <div className="p-6 bg-gradient-to-r from-primary-light to-primary dark:from-primary-dark dark:to-secondary-dark">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">AI Radio FM</h2>
          <div className="px-3 py-1 bg-black bg-opacity-20 rounded-full text-white text-sm">
            LIVE
          </div>
        </div>
        
        <div className="bg-black bg-opacity-30 rounded-lg p-4 mb-4">
          <Visualizer isActive={isPlaying && !audioRef.current?.paused} mode={mode} />
          
          <div className="mt-4 text-white">
            {mode === 'dj' ? (
              <div>
                <div className="font-medium text-lg">DJ Commentary</div>
                <div className="text-sm opacity-80 mt-1 line-clamp-2">{currentScript}</div>
              </div>
            ) : (
              <div className="flex items-center">
                {currentSong?.albumCover && (
                  <img 
                    src={currentSong.albumCover} 
                    alt="Album cover" 
                    className="w-16 h-16 rounded mr-3"
                  />
                )}
                <div>
                  <div className="font-medium text-lg">{currentSong?.name || "Loading song..."}</div>
                  <div className="text-sm opacity-80">{currentSong?.artist || ""}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-white text-sm mb-4 h-6">
          {statusMessage}
        </div>
        
        {/* Controls */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <button
              onClick={handlePlayPause}
              className="bg-white text-primary-dark rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors"
              disabled={!isConnected}
            >
              {!isPlaying || (audioRef.current && audioRef.current.paused) ? (
                <PlayIcon className="w-8 h-8" />
              ) : (
                <PauseIcon className="w-8 h-8" />
              )}
            </button>
            
            <button
              onClick={handleStop}
              className="bg-white text-red-600 rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors"
              disabled={!isPlaying}
            >
              <StopIcon className="w-8 h-8" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-white text-sm">Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              className="w-24 accent-white"
            />
          </div>
        </div>
      </div>
      
      {/* Radio Info */}
      <div className="p-6 dark:text-white">
        <h3 className="text-xl font-bold mb-2">Now On Air</h3>
        
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4 transition-colors duration-300">
          <p className="font-medium">
            {mode === 'dj' 
              ? "DJ Commentary" 
              : `${currentSong?.name || "Loading..."} - ${currentSong?.artist || ""}`
            }
          </p>
          
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 max-h-32 overflow-y-auto">
            {currentScript || "Waiting for DJ to start talking..."}
          </div>
        </div>
        
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>Welcome to AI Radio - powered by DeepSeek, Eleven Labs, and Spotify</p>
          <p>The AI DJ will entertain you with jokes and news, followed by music!</p>
        </div>
      </div>
    </div>
  );
};

export default RadioPlayer; 