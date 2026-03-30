/**
 * Facemesh Web Worker
 *
 * This worker runs in a SEPARATE THREAD and does expensive computation
 * Main thread stays responsive for UI
 *
 * Workflow:
 * Main Thread (UI) sends ImageData
 *   ↓
 * Worker loads MediaPipe Facemesh model
 * Worker detects faces and landmarks
 * Worker computes FACS Action Units
 *   ↓
 * Worker sends lightweight AU JSON back to main thread
 */

// Import MediaPipe (in worker context)
importScripts('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
importScripts('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.11.0');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/facemesh@0.0.5/dist/facemesh.js');

let facemesh = null;
let isInitialized = false;

/**
 * Initialize MediaPipe Facemesh in Worker
 */
async function initializeFacemesh() {
    if (isInitialized) return;

    try {
        console.log('[Facemesh Worker] Loading MediaPipe Facemesh...');

        // Load the facemesh model
        facemesh = await window.facemesh.load();

        isInitialized = true;
        console.log('[Facemesh Worker] Facemesh loaded successfully');
    } catch (error) {
        console.error('[Facemesh Worker] Failed to load:', error);
        self.postMessage({ error: error.message });
    }
}

/**
 * Compute FACS Action Units from facial landmarks
 * This is the HEAVY MATH that should NOT run on main thread
 */
function computeActionUnits(landmarks) {
    const au = {};

    try {
        // ═══════════════════════════════════════════════════════════
        // AU4: Brow Lowerer (Anger)
        // ═══════════════════════════════════════════════════════════
        const innerBrowLeft = landmarks[105];
        const innerBrowRight = landmarks[334];
        const browDistance = Math.sqrt(
            Math.pow(innerBrowRight.x - innerBrowLeft.x, 2) +
            Math.pow(innerBrowRight.y - innerBrowLeft.y, 2)
        );
        const browLowerIntensity = Math.max(0, 1 - (browDistance / 40));
        au['AU4'] = Math.round(browLowerIntensity * 5);

        // ═══════════════════════════════════════════════════════════
        // AU5 & AU7: Eye opening vs Eye squint
        // ═══════════════════════════════════════════════════════════
        const upperEyelidLeft = landmarks[159];
        const lowerEyelidLeft = landmarks[145];
        const eyeOpenness = Math.abs(lowerEyelidLeft.y - upperEyelidLeft.y);

        au['AU5'] = Math.round((eyeOpenness / 20) * 5); // Eyelid raiser
        const eyeSquint = Math.max(0, 1 - (eyeOpenness / 15));
        au['AU7'] = Math.round(eyeSquint * 5); // Lid tightener

        // ═══════════════════════════════════════════════════════════
        // AU12: Lip Corner Puller (Smile) — THE KEY TO AUTHENTICITY
        // ═══════════════════════════════════════════════════════════
        const lipCornerLeft = landmarks[61];
        const lipCornerRight = landmarks[291];
        const lipCornerDistance = Math.sqrt(
            Math.pow(lipCornerRight.x - lipCornerLeft.x, 2) +
            Math.pow(lipCornerRight.y - lipCornerLeft.y, 2)
        );
        const mouthSmileIntensity = Math.max(0, (lipCornerDistance - 35) / 15);
        au['AU12'] = Math.round(mouthSmileIntensity * 5);

        // ═══════════════════════════════════════════════════════════
        // AU6: Cheek Raiser (Genuine smile - "Crow's feet")
        // THIS MUST CORRELATE WITH AU12 FOR AUTHENTICITY
        // ═══════════════════════════════════════════════════════════
        const eyeCorner = landmarks[226];
        const cheekpoint = landmarks[113];
        const cheekDistance = Math.abs(cheekpoint.y - eyeCorner.y);
        const cheekIntensity = Math.max(0, 1 - (cheekDistance / 25));
        au['AU6'] = Math.round(cheekIntensity * 5);

        // ═══════════════════════════════════════════════════════════
        // AUTHENTICITY CHECK: Duchenne Smile
        // Genuine: AU6 (cheek) + AU12 (mouth)
        // Fake: AU12 alone
        // ═══════════════════════════════════════════════════════════
        const smileIsGenuine = (au['AU6'] > 2 && au['AU12'] > 2);
        au['smile_authenticity'] = smileIsGenuine ? 'genuine' : 'social';

        // ═══════════════════════════════════════════════════════════
        // AU15: Lip Corner Depressor (Sadness)
        // ═══════════════════════════════════════════════════════════
        const lipDepressorIntensity = Math.max(0, 1 - mouthSmileIntensity);
        au['AU15'] = Math.round(lipDepressorIntensity * 5);

        // ═══════════════════════════════════════════════════════════
        // AU26: Jaw Drop (Surprise/Fear)
        // ═══════════════════════════════════════════════════════════
        const chinPoint = landmarks[175];
        const mouthCenterPoint = landmarks[152];
        const jawOpenness = Math.max(0, mouthCenterPoint.y - chinPoint.y);
        au['AU26'] = Math.round((jawOpenness / 20) * 5);

        // ═══════════════════════════════════════════════════════════
        // Facial Symmetry (important for authenticity)
        // ═══════════════════════════════════════════════════════════
        const symmetryScore = calculateSymmetry(landmarks);
        au['symmetry_score'] = symmetryScore;

        // ═══════════════════════════════════════════════════════════
        // Expression Intensity (overall emotional activation)
        // ═══════════════════════════════════════════════════════════
        const allAUs = Object.values(au).filter(v => typeof v === 'number');
        au['expression_intensity'] = Math.round(allAUs.reduce((a, b) => a + b, 0) / allAUs.length);

        return au;
    } catch (error) {
        console.error('[Facemesh Worker] AU computation failed:', error);
        return au;
    }
}

/**
 * Calculate facial symmetry (0-1)
 * Asymmetry indicates tension, pain, or insincerity
 */
function calculateSymmetry(landmarks) {
    try {
        const symmetryPairs = [
            { left: 33, right: 263 },   // Eye corners
            { left: 61, right: 291 },   // Mouth corners
            { left: 105, right: 334 }   // Eyebrows
        ];

        let totalDiff = 0;
        symmetryPairs.forEach(pair => {
            const leftY = landmarks[pair.left].y;
            const rightY = landmarks[pair.right].y;
            totalDiff += Math.abs(leftY - rightY);
        });

        const avgDiff = totalDiff / symmetryPairs.length;
        const symmetry = Math.max(0, 1 - (avgDiff / 50));

        return Math.round(symmetry * 100) / 100;
    } catch (error) {
        console.error('[Facemesh Worker] Symmetry calc failed:', error);
        return 0.5;
    }
}

/**
 * Process incoming ImageData from main thread
 */
self.onmessage = async (event) => {
    // Initialize facemesh on first message
    if (!isInitialized) {
        await initializeFacemesh();
    }

    const { imageData, width, height } = event.data;

    try {
        // Create canvas in worker
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);

        // Run MediaPipe Facemesh detection
        // This is the EXPENSIVE operation that happens in background thread
        const predictions = await facemesh.estimateFaces(canvas, false);

        if (predictions.length > 0) {
            // Focus on primary face
            const primaryFace = predictions[0];
            const landmarks = primaryFace.landmarks;

            // Compute FACS Action Units
            // This is pure math, doesn't need GPU
            const actionUnits = computeActionUnits(landmarks);

            // Send lightweight JSON back to main thread
            self.postMessage({
                success: true,
                actionUnits: actionUnits,
                confidence: primaryFace.confidence || 0.9,
                landmarks: landmarks,
            });
        } else {
            // No face detected
            self.postMessage({
                success: false,
                error: 'No face detected',
            });
        }
    } catch (error) {
        console.error('[Facemesh Worker] Processing failed:', error);
        self.postMessage({
            success: false,
            error: error.message,
        });
    }
};

console.log('[Facemesh Worker] Ready to process frames');
