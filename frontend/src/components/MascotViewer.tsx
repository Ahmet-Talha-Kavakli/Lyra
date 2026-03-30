/**
 * Lyra 3D Mascot Viewer with Lazy Loading + Draco Compression
 *
 * PERFORMANCE:
 * - Suspense boundary shows loading spinner until model loads
 * - Draco compression reduces 16MB model to ~2-3MB
 * - Model preloads on demand, not on app boot
 * - Canvas lazily mounts/unmounts
 */

import { Suspense, lazy, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Spinner } from './Spinner';

// Configure Draco decoder path (three-js built-in)
// Location: node_modules/three/examples/jsm/libs/draco/
if (typeof window !== 'undefined') {
  useGLTF.setDecoderPath('/draco/');
}

interface MascotViewerProps {
  isVisible?: boolean;
  onLoadComplete?: () => void;
}

/**
 * Model Component - Wrapped in Suspense
 */
function MascotModel({ onLoadComplete }: { onLoadComplete?: () => void }) {
  const gltf = useGLTF('/lyra_mascot.glb');

  useEffect(() => {
    onLoadComplete?.();
  }, [onLoadComplete]);

  return (
    <primitive
      object={gltf.scene}
      position={[0, 0, 0]}
      scale={1}
    />
  );
}

/**
 * Canvas Wrapper with Draco Support
 */
function MascotCanvas({ onLoadComplete }: { onLoadComplete?: () => void }) {
  return (
    <Canvas
      camera={{
        position: [0, 1.5, 2.5],
        fov: 50,
        near: 0.1,
        far: 1000,
      }}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '12px',
      }}
      gl={{
        antialias: true,
        pixelRatio: window.devicePixelRatio,
      }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={0.8}
        castShadow
      />

      <Suspense fallback={<Spinner />}>
        <MascotModel onLoadComplete={onLoadComplete} />
      </Suspense>

      <OrbitControls
        enableZoom={true}
        enablePan={true}
        autoRotate={false}
      />
    </Canvas>
  );
}

/**
 * Main Component - Lazy loads canvas only when visible
 */
export default function MascotViewer({
  isVisible = false,
  onLoadComplete,
}: MascotViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoadComplete = () => {
    setIsLoading(false);
    onLoadComplete?.();
  };

  useEffect(() => {
    if (!isVisible) {
      setIsLoading(true);
    }
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800 rounded-lg">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load mascot</p>
          <button
            onClick={() => {
              setHasError(false);
              setIsLoading(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg overflow-hidden"
      onError={() => setHasError(true)}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
          <Spinner />
        </div>
      )}

      <MascotCanvas onLoadComplete={handleLoadComplete} />
    </div>
  );
}

/**
 * Hook: Preload mascot model in background
 * Use this before showing MascotViewer to warm up the cache
 */
export function usePreloadMascot() {
  useEffect(() => {
    // Preload GLTF model in background (non-blocking)
    if (typeof window !== 'undefined') {
      // Only preload if we have idle time
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          useGLTF.preload('/lyra_mascot.glb');
        });
      } else {
        // Fallback: load after 5 seconds
        setTimeout(() => {
          useGLTF.preload('/lyra_mascot.glb');
        }, 5000);
      }
    }
  }, []);
}
