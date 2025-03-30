import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  isActive: boolean;
  mode: 'dj' | 'song';
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const bars = 60;
    const barWidth = canvas.width / bars;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (isActive) {
        // Different visualization style based on mode
        if (mode === 'dj') {
          // Wave pattern for DJ talking
          const centerY = canvas.height / 2;
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          
          for (let i = 0; i < canvas.width; i += 5) {
            const amplitude = isActive ? 15 : 2;
            const y = centerY + Math.sin(i * 0.02 + Date.now() * 0.005) * amplitude;
            ctx.lineTo(i, y);
          }
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Bar pattern for music
          for (let i = 0; i < bars; i++) {
            const barHeight = isActive ? Math.random() * canvas.height * 0.8 : 5;
            const x = i * barWidth;
            const y = canvas.height - barHeight;
            
            const gradient = ctx.createLinearGradient(0, y, 0, canvas.height);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth - 1, barHeight);
          }
        }
      } else {
        // Flat line when not active
        const centerY = canvas.height / 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(canvas.width, centerY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, mode]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-20 rounded-md"
    />
  );
};

export default Visualizer; 