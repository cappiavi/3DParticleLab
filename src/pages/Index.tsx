import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

type ShapeType = 'sphere' | 'heart' | 'cube' | 'spiral';

interface ParticleData {
  positions: Float32Array;
  velocities: Float32Array;
  targetPositions: Float32Array;
  colors: Float32Array;
}

interface ShapeColor {
  primary: string;
  secondary: string;
  hueStart: number;
  hueEnd: number;
}

const COLOR_PRESETS: Record<string, ShapeColor> = {
  cyan: { primary: '#00ffff', secondary: '#0088ff', hueStart: 180, hueEnd: 200 },
  magenta: { primary: '#ff00ff', secondary: '#ff0088', hueStart: 280, hueEnd: 320 },
  gold: { primary: '#ffd700', secondary: '#ff8c00', hueStart: 40, hueEnd: 50 },
  lime: { primary: '#00ff88', secondary: '#88ff00', hueStart: 100, hueEnd: 140 },
  rose: { primary: '#ff4488', secondary: '#ff0044', hueStart: 330, hueEnd: 350 },
  ocean: { primary: '#0066ff', secondary: '#00ccff', hueStart: 200, hueEnd: 220 },
};

const ParticleSystem = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const particleDataRef = useRef<ParticleData | null>(null);
  const handPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isHandOpenRef = useRef<boolean>(true);
  const prevHandOpenRef = useRef<boolean>(true);
  const handDetectedRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number>(0);
  const handsRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingRef = useRef<boolean>(false);
  const explosionTimeRef = useRef<number>(0);
  const isGatheringRef = useRef<boolean>(false);

  const [particleCount, setParticleCount] = useState(20000);
  const [forceStrength, setForceStrength] = useState(0.15);
  const [forceRadius, setForceRadius] = useState(3);
  const [currentShape, setCurrentShape] = useState<ShapeType>('sphere');
  const [cameraActive, setCameraActive] = useState(false);
  const [handStatus, setHandStatus] = useState<'none' | 'open' | 'fist'>('none');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Color state for each shape
  const [shapeColors, setShapeColors] = useState<Record<ShapeType, string>>({
    sphere: 'cyan',
    heart: 'rose',
    cube: 'gold',
    spiral: 'ocean',
  });

  // Generate shape positions
  const generateShapePositions = useCallback((shape: ShapeType, count: number): Float32Array => {
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      let x = 0, y = 0, z = 0;
      
      switch (shape) {
        case 'sphere': {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const r = 2.5 * Math.cbrt(Math.random());
          x = r * Math.sin(phi) * Math.cos(theta);
          y = r * Math.sin(phi) * Math.sin(theta);
          z = r * Math.cos(phi);
          break;
        }
        case 'heart': {
          const t = Math.random() * Math.PI * 2;
          const s = Math.random();
          const scale = 0.12 * Math.cbrt(s);
          x = scale * 16 * Math.pow(Math.sin(t), 3);
          y = scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          z = (Math.random() - 0.5) * 1.5 * s;
          break;
        }
        case 'cube': {
          const face = Math.floor(Math.random() * 6);
          const u = (Math.random() - 0.5) * 4;
          const v = (Math.random() - 0.5) * 4;
          switch (face) {
            case 0: x = 2; y = u; z = v; break;
            case 1: x = -2; y = u; z = v; break;
            case 2: x = u; y = 2; z = v; break;
            case 3: x = u; y = -2; z = v; break;
            case 4: x = u; y = v; z = 2; break;
            case 5: x = u; y = v; z = -2; break;
          }
          const fill = Math.random();
          if (fill > 0.7) {
            x = (Math.random() - 0.5) * 4;
            y = (Math.random() - 0.5) * 4;
            z = (Math.random() - 0.5) * 4;
          }
          break;
        }
        case 'spiral': {
          const angle = Math.random() * Math.PI * 8;
          const radius = 0.3 + angle * 0.15;
          const heightVar = (Math.random() - 0.5) * 0.5;
          x = Math.cos(angle) * radius;
          y = angle * 0.2 - 2.5 + heightVar;
          z = Math.sin(angle) * radius;
          break;
        }
      }
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    
    return positions;
  }, []);

  // Generate particle colors based on shape color preset
  const generateColors = useCallback((count: number, colorPreset: string): Float32Array => {
    const colors = new Float32Array(count * 3);
    const preset = COLOR_PRESETS[colorPreset] || COLOR_PRESETS.cyan;
    
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const hue = preset.hueStart + t * (preset.hueEnd - preset.hueStart) + (Math.random() - 0.5) * 20;
      const saturation = 0.8 + Math.random() * 0.2;
      const lightness = 0.5 + Math.random() * 0.3;
      
      // HSL to RGB conversion
      const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
      const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
      const m = lightness - c / 2;
      
      let r = 0, g = 0, b = 0;
      const h = ((hue % 360) + 360) % 360;
      if (h < 60) { r = c; g = x; b = 0; }
      else if (h < 120) { r = x; g = c; b = 0; }
      else if (h < 180) { r = 0; g = c; b = x; }
      else if (h < 240) { r = 0; g = x; b = c; }
      else if (h < 300) { r = x; g = 0; b = c; }
      else { r = c; g = 0; b = x; }
      
      colors[i * 3] = r + m;
      colors[i * 3 + 1] = g + m;
      colors[i * 3 + 2] = b + m;
    }
    
    return colors;
  }, []);

  // Update colors when shape color changes
  const updateParticleColors = useCallback((colorPreset: string) => {
    if (!particlesRef.current || !particleDataRef.current) return;
    
    const newColors = generateColors(particleCount, colorPreset);
    particleDataRef.current.colors = newColors;
    
    const colorAttribute = particlesRef.current.geometry.getAttribute('color') as THREE.BufferAttribute;
    colorAttribute.array = newColors;
    colorAttribute.needsUpdate = true;
  }, [particleCount, generateColors]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080a0f);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 8;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const geometry = new THREE.BufferGeometry();
    const targetPositions = generateShapePositions(currentShape, particleCount);
    const positions = new Float32Array(targetPositions);
    const velocities = new Float32Array(particleCount * 3).fill(0);
    const colors = generateColors(particleCount, shapeColors[currentShape]);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    particleDataRef.current = {
      positions,
      velocities,
      targetPositions,
      colors
    };

    const material = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop with gather/explode mechanics
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (!particlesRef.current || !particleDataRef.current) return;

      const { positions, velocities, targetPositions } = particleDataRef.current;
      const positionAttribute = particlesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;

      const handDetected = handDetectedRef.current;
      const isOpen = isHandOpenRef.current;
      const wasOpen = prevHandOpenRef.current;
      const strength = forceStrength;

      // Detect transition from fist to open hand (explosion trigger)
      if (handDetected && isOpen && !wasOpen) {
        explosionTimeRef.current = Date.now();
        isGatheringRef.current = false;
      }
      
      // Detect fist (gathering mode)
      if (handDetected && !isOpen) {
        isGatheringRef.current = true;
      }

      prevHandOpenRef.current = isOpen;

      const timeSinceExplosion = Date.now() - explosionTimeRef.current;
      const isExploding = timeSinceExplosion < 2000; // 2 second explosion phase
      const explosionProgress = Math.min(timeSinceExplosion / 2000, 1);
      
      // Slow-motion spring force during reformation (starts weak, gets stronger)
      const reformationSpring = isExploding 
        ? 0.003 + explosionProgress * 0.017 // 0.003 to 0.02 over 2 seconds
        : 0.02;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        const px = positions[i3];
        const py = positions[i3 + 1];
        const pz = positions[i3 + 2];

        const tx = targetPositions[i3];
        const ty = targetPositions[i3 + 1];
        const tz = targetPositions[i3 + 2];

        // FIST: Gather all particles toward center
        if (handDetected && !isOpen && isGatheringRef.current) {
          const dx = px - 0; // Center is (0,0,0)
          const dy = py - 0;
          const dz = pz - 0;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          if (dist > 0.1) {
            const pullStrength = strength * 0.8;
            velocities[i3] -= (dx / dist) * pullStrength;
            velocities[i3 + 1] -= (dy / dist) * pullStrength;
            velocities[i3 + 2] -= (dz / dist) * pullStrength;
          }
        } 
        // EXPLOSION: Apply outward burst when transitioning from fist to open
        else if (isExploding && explosionProgress < 0.1) {
          // Apply explosion force only in the first 100ms
          const dx = px;
          const dy = py;
          const dz = pz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
          
          // Randomized explosion direction for more organic feel
          const explosionStrength = strength * 3 * (1 + Math.random() * 0.5);
          const randomAngle = Math.random() * Math.PI * 2;
          const randomTilt = (Math.random() - 0.5) * 0.5;
          
          velocities[i3] += (dx / dist + Math.cos(randomAngle) * randomTilt) * explosionStrength;
          velocities[i3 + 1] += (dy / dist + Math.sin(randomAngle) * randomTilt) * explosionStrength;
          velocities[i3 + 2] += (dz / dist + randomTilt) * explosionStrength;
        }
        // REFORMATION: Slow spring back to shape
        else {
          velocities[i3] += (tx - px) * reformationSpring;
          velocities[i3 + 1] += (ty - py) * reformationSpring;
          velocities[i3 + 2] += (tz - pz) * reformationSpring;
        }

        // Damping (slower during explosion for dramatic effect)
        const damping = isExploding ? 0.96 : 0.92;
        velocities[i3] *= damping;
        velocities[i3 + 1] *= damping;
        velocities[i3 + 2] *= damping;

        // Update position
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];
      }

      positionAttribute.array = positions;
      positionAttribute.needsUpdate = true;

      particlesRef.current.rotation.y += 0.001;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      renderer.dispose();
    };
  }, [particleCount, generateShapePositions, generateColors, forceStrength, shapeColors, currentShape]);

  // Update shape and colors when changed
  useEffect(() => {
    if (!particleDataRef.current) return;
    
    const newTargetPositions = generateShapePositions(currentShape, particleCount);
    particleDataRef.current.targetPositions = newTargetPositions;
    
    // Update colors for new shape
    updateParticleColors(shapeColors[currentShape]);
  }, [currentShape, particleCount, generateShapePositions, shapeColors, updateParticleColors]);

  // Handle color change for current shape
  const handleColorChange = (shape: ShapeType, colorKey: string) => {
    setShapeColors(prev => ({ ...prev, [shape]: colorKey }));
    if (shape === currentShape) {
      updateParticleColors(colorKey);
    }
  };

  // Calculate if hand is open or fist
  const calculateHandGesture = useCallback((landmarks: { x: number; y: number; z: number }[]): boolean => {
    const palmBase = landmarks[0];
    const fingertips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const knuckles = [landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    
    let extendedFingers = 0;
    
    for (let i = 0; i < 4; i++) {
      const tipToKnuckle = Math.sqrt(
        Math.pow(fingertips[i].x - knuckles[i].x, 2) +
        Math.pow(fingertips[i].y - knuckles[i].y, 2)
      );
      const knuckleToPalm = Math.sqrt(
        Math.pow(knuckles[i].x - palmBase.x, 2) +
        Math.pow(knuckles[i].y - palmBase.y, 2)
      );
      
      if (tipToKnuckle > knuckleToPalm * 0.5) {
        extendedFingers++;
      }
    }
    
    return extendedFingers >= 3;
  }, []);

  // Process video frame with MediaPipe
  const processFrame = useCallback(async () => {
    if (!videoRef.current || !handsRef.current || !cameraActive || processingRef.current) return;
    
    if (videoRef.current.readyState < 2) {
      requestAnimationFrame(processFrame);
      return;
    }
    
    processingRef.current = true;
    
    try {
      await handsRef.current.send({ image: videoRef.current });
    } catch (error) {
      console.error('Frame processing error:', error);
    }
    
    processingRef.current = false;
    
    if (cameraActive) {
      requestAnimationFrame(processFrame);
    }
  }, [cameraActive]);

  // Start camera with native getUserMedia
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const { Hands } = await import('@mediapipe/hands');
      
      const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      hands.onResults((results: any) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          
          const palmX = (landmarks[0].x + landmarks[9].x) / 2;
          const palmY = (landmarks[0].y + landmarks[9].y) / 2;
          
          const worldX = (palmX - 0.5) * 8;
          const worldY = (0.5 - palmY) * 6;
          
          handPositionRef.current.set(worldX, worldY, 0);
          handDetectedRef.current = true;
          
          const isOpen = calculateHandGesture(landmarks);
          isHandOpenRef.current = isOpen;
          setHandStatus(isOpen ? 'open' : 'fist');
        } else {
          handDetectedRef.current = false;
          setHandStatus('none');
        }
      });

      await hands.initialize();
      handsRef.current = hands;
      
      setCameraActive(true);
      setIsLoading(false);
      
      requestAnimationFrame(processFrame);
      
    } catch (error: any) {
      console.error('Error starting camera:', error);
      setErrorMsg(error.message || 'Failed to start camera');
      setIsLoading(false);
      setCameraActive(false);
    }
  }, [calculateHandGesture, processFrame]);

  useEffect(() => {
    if (cameraActive && handsRef.current) {
      requestAnimationFrame(processFrame);
    }
  }, [cameraActive, processFrame]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (handsRef.current) {
      handsRef.current.close();
      handsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    handDetectedRef.current = false;
    processingRef.current = false;
    setCameraActive(false);
    setHandStatus('none');
  }, []);

  const shapes: { id: ShapeType; label: string; icon: string }[] = [
    { id: 'sphere', label: 'Sphere', icon: '●' },
    { id: 'heart', label: 'Heart', icon: '♥' },
    { id: 'cube', label: 'Cube', icon: '◼' },
    { id: 'spiral', label: 'Spiral', icon: '◎' },
  ];

  const colorOptions = Object.keys(COLOR_PRESETS);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* Hidden video element for MediaPipe */}
      <video
        ref={videoRef}
        className="absolute opacity-0 pointer-events-none"
        style={{ width: 1, height: 1 }}
        playsInline
        muted
      />
      
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" width={640} height={480} />

      {/* Title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground glow-text tracking-wider">
          PARTICLE FIELD
        </h1>
        <p className="text-muted-foreground text-sm mt-1 font-body">
          Interactive 3D Particle System
        </p>
      </div>

      {/* Hand Status Indicator */}
      {cameraActive && (
        <div className="absolute top-6 right-6 glass-panel px-4 py-2 flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            handStatus === 'none' 
              ? 'bg-muted-foreground' 
              : handStatus === 'open' 
                ? 'bg-primary animate-pulse-glow' 
                : 'bg-accent animate-pulse-glow'
          }`} />
          <span className="text-sm font-body text-foreground">
            {handStatus === 'none' ? 'No Hand' : handStatus === 'open' ? 'Explode!' : 'Gathering...'}
          </span>
        </div>
      )}

      {/* Settings Panel */}
      <div className="absolute bottom-6 left-6 right-6 md:left-6 md:right-auto md:w-96 glass-panel p-5 glow-border max-h-[80vh] overflow-y-auto">
        <h2 className="font-display text-lg font-semibold text-foreground mb-4 tracking-wide">
          CONTROLS
        </h2>

        {/* Camera Toggle */}
        <div className="mb-5">
          <button
            onClick={cameraActive ? stopCamera : startCamera}
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-body font-medium text-sm transition-all duration-300 ${
              cameraActive 
                ? 'bg-accent/20 border border-accent text-accent hover:bg-accent/30' 
                : 'bg-primary/20 border border-primary text-primary hover:bg-primary/30'
            } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
          >
            {isLoading ? 'Initializing...' : cameraActive ? '⏹ Stop Hand Tracking' : '▶ Start Hand Tracking'}
          </button>
          {errorMsg && (
            <p className="text-xs text-destructive mt-2 font-body">{errorMsg}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2 font-body">
            {cameraActive 
              ? 'Fist = gather • Open = explode & reform' 
              : 'Enable webcam to interact with particles'}
          </p>
        </div>

        {/* Shape Selector with Color */}
        <div className="mb-5">
          <label className="text-sm font-body text-muted-foreground block mb-2">Shape & Color</label>
          <div className="space-y-3">
            {shapes.map((shape) => (
              <div 
                key={shape.id}
                className={`p-3 rounded-lg border transition-all duration-300 ${
                  currentShape === shape.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-muted/20 border-border hover:border-primary/50'
                }`}
              >
                <button
                  onClick={() => setCurrentShape(shape.id)}
                  className="w-full flex items-center gap-3 mb-2"
                >
                  <span className="text-2xl">{shape.icon}</span>
                  <span className={`font-body text-sm ${
                    currentShape === shape.id ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {shape.label}
                  </span>
                  {currentShape === shape.id && (
                    <span className="ml-auto text-xs text-primary font-body">Active</span>
                  )}
                </button>
                
                {/* Color picker for this shape */}
                <div className="flex gap-1.5 flex-wrap">
                  {colorOptions.map((colorKey) => (
                    <button
                      key={colorKey}
                      onClick={() => handleColorChange(shape.id, colorKey)}
                      className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                        shapeColors[shape.id] === colorKey 
                          ? 'border-foreground scale-110' 
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: COLOR_PRESETS[colorKey].primary }}
                      title={colorKey}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          {/* Particle Count */}
          <div>
            <div className="flex justify-between text-sm font-body mb-2">
              <span className="text-muted-foreground">Particles</span>
              <span className="text-primary">{particleCount.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="5000"
              max="50000"
              step="1000"
              value={particleCount}
              onChange={(e) => setParticleCount(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider-glow accent-primary"
            />
          </div>

          {/* Force Strength */}
          <div>
            <div className="flex justify-between text-sm font-body mb-2">
              <span className="text-muted-foreground">Force Strength</span>
              <span className="text-primary">{(forceStrength * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.5"
              step="0.01"
              value={forceStrength}
              onChange={(e) => setForceStrength(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider-glow accent-primary"
            />
          </div>

          {/* Force Radius - now unused but kept for future */}
          <input type="hidden" value={forceRadius} onChange={(e) => setForceRadius(Number(e.target.value))} />
        </div>
      </div>

      {/* Camera Preview (when active) */}
      {cameraActive && streamRef.current && (
        <div className="absolute top-20 right-6 w-40 h-30 glass-panel overflow-hidden rounded-lg border border-primary/30">
          <video
            className="w-full h-full object-cover scale-x-[-1]"
            playsInline
            autoPlay
            muted
            ref={(el) => {
              if (el && streamRef.current) {
                el.srcObject = streamRef.current;
              }
            }}
          />
          <div className="absolute inset-0 border-2 border-primary/20 rounded-lg pointer-events-none" />
        </div>
      )}
    </div>
  );
};

export default ParticleSystem;
