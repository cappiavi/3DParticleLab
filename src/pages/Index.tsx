import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

type ShapeType = 'sphere' | 'heart' | 'cube' | 'spiral';

interface ParticleData {
  positions: Float32Array;
  velocities: Float32Array;
  targetPositions: Float32Array;
  colors: Float32Array;
}

const ParticleSystem = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const particleDataRef = useRef<ParticleData | null>(null);
  const handPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isHandOpenRef = useRef<boolean>(true);
  const handDetectedRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number>(0);
  const mediapipeHandsRef = useRef<Hands | null>(null);
  const mediapipeCameraRef = useRef<Camera | null>(null);

  const [particleCount, setParticleCount] = useState(20000);
  const [forceStrength, setForceStrength] = useState(0.15);
  const [forceRadius, setForceRadius] = useState(3);
  const [currentShape, setCurrentShape] = useState<ShapeType>('sphere');
  const [cameraActive, setCameraActive] = useState(false);
  const [handStatus, setHandStatus] = useState<'none' | 'open' | 'fist'>('none');
  const [isLoading, setIsLoading] = useState(false);

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
          // Add some volume inside
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

  // Generate particle colors
  const generateColors = useCallback((count: number): Float32Array => {
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      // Cyan to purple gradient with some variation
      const hue = 180 + t * 100 + (Math.random() - 0.5) * 40;
      const saturation = 0.8 + Math.random() * 0.2;
      const lightness = 0.5 + Math.random() * 0.3;
      
      // HSL to RGB conversion
      const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
      const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
      const m = lightness - c / 2;
      
      let r = 0, g = 0, b = 0;
      if (hue < 60) { r = c; g = x; b = 0; }
      else if (hue < 120) { r = x; g = c; b = 0; }
      else if (hue < 180) { r = 0; g = c; b = x; }
      else if (hue < 240) { r = 0; g = x; b = c; }
      else if (hue < 300) { r = x; g = 0; b = c; }
      else { r = c; g = 0; b = x; }
      
      colors[i * 3] = r + m;
      colors[i * 3 + 1] = g + m;
      colors[i * 3 + 2] = b + m;
    }
    
    return colors;
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080a0f);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 8;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create particles
    const geometry = new THREE.BufferGeometry();
    const targetPositions = generateShapePositions(currentShape, particleCount);
    const positions = new Float32Array(targetPositions);
    const velocities = new Float32Array(particleCount * 3).fill(0);
    const colors = generateColors(particleCount);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    particleDataRef.current = {
      positions,
      velocities,
      targetPositions,
      colors
    };

    // Particle material with additive blending
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

    // Handle resize
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (!particlesRef.current || !particleDataRef.current) return;

      const { positions, velocities, targetPositions } = particleDataRef.current;
      const positionAttribute = particlesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;

      const handPos = handPositionRef.current;
      const handDetected = handDetectedRef.current;
      const isOpen = isHandOpenRef.current;
      const strength = forceStrength;
      const radius = forceRadius;
      const radiusSq = radius * radius;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Current position
        const px = positions[i3];
        const py = positions[i3 + 1];
        const pz = positions[i3 + 2];

        // Target position
        const tx = targetPositions[i3];
        const ty = targetPositions[i3 + 1];
        const tz = targetPositions[i3 + 2];

        // Spring force toward target
        const springForce = 0.02;
        velocities[i3] += (tx - px) * springForce;
        velocities[i3 + 1] += (ty - py) * springForce;
        velocities[i3 + 2] += (tz - pz) * springForce;

        // Hand interaction
        if (handDetected) {
          const dx = px - handPos.x;
          const dy = py - handPos.y;
          const dz = pz - handPos.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < radiusSq && distSq > 0.001) {
            const dist = Math.sqrt(distSq);
            const force = (1 - dist / radius) * strength;
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;

            if (isOpen) {
              // Push away
              velocities[i3] += nx * force;
              velocities[i3 + 1] += ny * force;
              velocities[i3 + 2] += nz * force;
            } else {
              // Pull toward hand
              velocities[i3] -= nx * force * 0.5;
              velocities[i3 + 1] -= ny * force * 0.5;
              velocities[i3 + 2] -= nz * force * 0.5;
            }
          }
        }

        // Damping
        const damping = 0.92;
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

      // Rotate scene slightly
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
  }, [particleCount, generateShapePositions, generateColors, forceStrength, forceRadius]);

  // Update shape when changed
  useEffect(() => {
    if (!particleDataRef.current) return;
    
    const newTargetPositions = generateShapePositions(currentShape, particleCount);
    particleDataRef.current.targetPositions = newTargetPositions;
  }, [currentShape, particleCount, generateShapePositions]);

  // Calculate if hand is open or fist
  const calculateHandGesture = useCallback((landmarks: { x: number; y: number; z: number }[]): boolean => {
    // Check if fingers are extended by comparing fingertip to palm distance
    const palmBase = landmarks[0];
    const fingertips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]]; // index, middle, ring, pinky tips
    const knuckles = [landmarks[5], landmarks[9], landmarks[13], landmarks[17]]; // MCP joints
    
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
      
      // If fingertip is far from knuckle relative to palm, finger is extended
      if (tipToKnuckle > knuckleToPalm * 0.5) {
        extendedFingers++;
      }
    }
    
    return extendedFingers >= 3; // Open hand if 3+ fingers extended
  }, []);

  // Initialize MediaPipe Hands
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    
    setIsLoading(true);
    
    try {
      const hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
      });

      hands.onResults((results: Results) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          
          // Get palm center (wrist + middle finger base)
          const palmX = (landmarks[0].x + landmarks[9].x) / 2;
          const palmY = (landmarks[0].y + landmarks[9].y) / 2;
          
          // Convert to 3D world coordinates
          // X: -1 to 1 mapped to -4 to 4
          // Y: 0 to 1 mapped to 3 to -3 (inverted)
          const worldX = (palmX - 0.5) * 8;
          const worldY = (0.5 - palmY) * 6;
          const worldZ = 0;
          
          handPositionRef.current.set(worldX, worldY, worldZ);
          handDetectedRef.current = true;
          
          const isOpen = calculateHandGesture(landmarks);
          isHandOpenRef.current = isOpen;
          setHandStatus(isOpen ? 'open' : 'fist');
        } else {
          handDetectedRef.current = false;
          setHandStatus('none');
        }
      });

      mediapipeHandsRef.current = hands;

      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && mediapipeHandsRef.current) {
            await mediapipeHandsRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480
      });

      await camera.start();
      mediapipeCameraRef.current = camera;
      setCameraActive(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error starting camera:', error);
      setIsLoading(false);
    }
  }, [calculateHandGesture]);

  const stopCamera = useCallback(() => {
    if (mediapipeCameraRef.current) {
      mediapipeCameraRef.current.stop();
      mediapipeCameraRef.current = null;
    }
    if (mediapipeHandsRef.current) {
      mediapipeHandsRef.current.close();
      mediapipeHandsRef.current = null;
    }
    handDetectedRef.current = false;
    setCameraActive(false);
    setHandStatus('none');
  }, []);

  const shapes: { id: ShapeType; label: string; icon: string }[] = [
    { id: 'sphere', label: 'Sphere', icon: '●' },
    { id: 'heart', label: 'Heart', icon: '♥' },
    { id: 'cube', label: 'Cube', icon: '◼' },
    { id: 'spiral', label: 'Spiral', icon: '◎' },
  ];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* Hidden video element for MediaPipe */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        autoPlay
        muted
      />

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
            {handStatus === 'none' ? 'No Hand' : handStatus === 'open' ? 'Push Mode' : 'Pull Mode'}
          </span>
        </div>
      )}

      {/* Settings Panel */}
      <div className="absolute bottom-6 left-6 right-6 md:left-6 md:right-auto md:w-80 glass-panel p-5 glow-border animate-float">
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
            {isLoading ? 'Initializing Camera...' : cameraActive ? '⏹ Stop Hand Tracking' : '▶ Start Hand Tracking'}
          </button>
          <p className="text-xs text-muted-foreground mt-2 font-body">
            {cameraActive 
              ? 'Open hand = push • Fist = pull' 
              : 'Enable webcam to interact with particles'}
          </p>
        </div>

        {/* Shape Selector */}
        <div className="mb-5">
          <label className="text-sm font-body text-muted-foreground block mb-2">Shape</label>
          <div className="grid grid-cols-4 gap-2">
            {shapes.map((shape) => (
              <button
                key={shape.id}
                onClick={() => setCurrentShape(shape.id)}
                className={`py-2 px-3 rounded-lg font-body text-xs transition-all duration-300 border ${
                  currentShape === shape.id
                    ? 'bg-primary/30 border-primary text-primary'
                    : 'bg-muted/30 border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                <span className="text-lg block mb-0.5">{shape.icon}</span>
                {shape.label}
              </button>
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

          {/* Force Radius */}
          <div>
            <div className="flex justify-between text-sm font-body mb-2">
              <span className="text-muted-foreground">Interaction Radius</span>
              <span className="text-primary">{forceRadius.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1"
              max="6"
              step="0.5"
              value={forceRadius}
              onChange={(e) => setForceRadius(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider-glow accent-primary"
            />
          </div>
        </div>
      </div>

      {/* Camera Preview (when active) */}
      {cameraActive && (
        <div className="absolute top-20 right-6 w-40 h-30 glass-panel overflow-hidden rounded-lg border border-primary/30">
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1]"
            playsInline
            autoPlay
            muted
          />
          <div className="absolute inset-0 border-2 border-primary/20 rounded-lg pointer-events-none" />
        </div>
      )}
    </div>
  );
};

export default ParticleSystem;
