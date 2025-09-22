import React, { useEffect, useRef } from 'react';  
  
interface Bar {  
  time: number; // timestamp (ms) when this bar was recorded  
  amplitude: number; // normalized amplitude (0–1)  
}  
  
const AudioVisualizer: React.FC = () => {  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);  
  const barsRef = useRef<Bar[]>([]);  
  
  // Constants  
  const SAMPLE_INTERVAL = 100; // in ms  
  const BAR_WIDTH = 4; // in px  
  const SCROLL_SPEED = 60; // pixels per second  
  
  useEffect(() => {  
    let audioContext: AudioContext | undefined;  
    let analyser: AnalyserNode | undefined;  
    let microphone: MediaStreamAudioSourceNode | undefined;  
    let sampleIntervalId: number | undefined;  
    let rafId: number | undefined;  
    const canvas = canvasRef.current;  
    if (!canvas) return;  
    const ctx = canvas.getContext('2d');  
    if (!ctx) return;  
  
    // Function to set canvas size  
    const setCanvasSize = () => {  
      canvas.width = canvas.clientWidth;  
      canvas.height = canvas.clientHeight;  
    };  
  
    setCanvasSize();  
  
    // Handle window resize for responsiveness  
    window.addEventListener('resize', setCanvasSize);  
  
    navigator.mediaDevices  
      .getUserMedia({ audio: true })  
      .then((stream) => {  
        audioContext = new AudioContext();  
        microphone = audioContext.createMediaStreamSource(stream);  
        analyser = audioContext.createAnalyser();  
        analyser.fftSize = 2048;  
        microphone.connect(analyser);  
  
        // Sampling loop  
        sampleIntervalId = window.setInterval(() => {  
          if (!analyser) return;  
          const bufferLength = analyser.fftSize;  
          const dataArray = new Uint8Array(bufferLength);  
          analyser.getByteTimeDomainData(dataArray);  
          let sumSquares = 0;  
          for (let i = 0; i < bufferLength; i++) {  
            const val = dataArray[i] - 128; // center is 128  
            sumSquares += val * val;  
          }  
          const rms = Math.sqrt(sumSquares / bufferLength) / 128; // normalized (0–1)  
          const now = performance.now();  
          barsRef.current.push({  
            time: now,  
            amplitude: rms,  
          });  
        }, SAMPLE_INTERVAL);  
  
        // Animation loop  
        const animate = (currentTime: number) => {  
          ctx.clearRect(0, 0, canvas.width, canvas.height);  
  
          // Optional: Draw a light horizontal baseline at mid-height  
          ctx.strokeStyle = '#ddd';  
          ctx.lineWidth = 1;  
          ctx.beginPath();  
          ctx.moveTo(0, canvas.height / 2);  
          ctx.lineTo(canvas.width, canvas.height / 2);  
          ctx.stroke();  
  
          // Set fill style for amplitude bars  
          ctx.fillStyle = '#007aff'; // iOS blue  
  
          const newBars: Bar[] = [];  
          for (let i = 0; i < barsRef.current.length; i++) {  
            const bar = barsRef.current[i];  
            const deltaSeconds = (currentTime - bar.time) / 1000;  
            const x = canvas.width - deltaSeconds * SCROLL_SPEED;  
  
            // Remove bars that have moved past the left edge  
            if (x + BAR_WIDTH < 0) {  
              continue;  
            }  
  
            // Skip rendering bars that are off the right edge  
            if (x > canvas.width) {  
              continue;  
            }  
  
            // Map amplitude to bar height  
            const halfBarHeight = bar.amplitude * (canvas.height * 2.85);  
            const barHeight = halfBarHeight * 2;  
            const y = canvas.height / 2 - halfBarHeight;  
  
            ctx.fillRect(x, y, BAR_WIDTH, barHeight);  
            newBars.push(bar);  
          }  
  
          // Update barsRef with bars still visible  
          barsRef.current = newBars;  
  
          rafId = requestAnimationFrame(animate);  
        };  
  
        rafId = requestAnimationFrame(animate);  
      })  
      .catch((err) => {  
        console.error('Error accessing microphone:', err);  
      });  
  
    // Cleanup function  
    return () => {  
      if (sampleIntervalId) {  
        clearInterval(sampleIntervalId);  
      }  
      if (rafId) {  
        cancelAnimationFrame(rafId);  
      }  
      if (audioContext) {  
        audioContext.close();  
      }  
      window.removeEventListener('resize', setCanvasSize);  
    };  
  }, []);  
  
  return (  
    <canvas  
      ref={canvasRef}  
      style={{  
        width: '100%',  
        height: '24px',
        marginTop: '4px',
        background: '#fff',
      }}  
    />  
  );  
};  
  
export default AudioVisualizer;  