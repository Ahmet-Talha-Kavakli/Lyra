/**
 * FACS Analyzer - Layer 2A
 * Facial Action Coding System (Paul Ekman)
 * Detects micro-expressions and action units in real-time
 */

import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { logger } from '../logging/logger.js';

export class FACSAnalyzer {
    constructor() {
        this.model = null;
        this.isInitialized = false;
        this.actionUnits = this.defineFACSActionUnits();
        this.previousLandmarks = null;
    }

    /**
     * Initialize face landmarks detection model
     */
    async initialize() {
        try {
            const model = faceLandmarksDetection.SupportedModels.MediaPipeFacemesh;
            const detectorConfig = {
                runtime: 'tfjs',
                refineLandmarks: true,
                maxFaces: 1
            };

            this.model = await faceLandmarksDetection.createDetector(model, detectorConfig);
            this.isInitialized = true;
            logger.info('[FACSAnalyzer] Initialized');
        } catch (error) {
            logger.error('[FACSAnalyzer] Init failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Define FACS Action Units (AU)
     * Based on Paul Ekman's Facial Action Coding System Manual
     */
    defineFACSActionUnits() {
        return {
            AU1: { name: 'Inner brow raiser', aliases: ['raise_inner_brows'] },
            AU2: { name: 'Outer brow raiser', aliases: ['raise_outer_brows'] },
            AU4: { name: 'Brow lowerer', aliases: ['lower_brows', 'frown'] },
            AU5: { name: 'Upper lid raiser', aliases: ['eyes_wide_open'] },
            AU6: { name: 'Cheek raiser (smile)', aliases: ['raise_cheeks'] },
            AU7: { name: 'Lid tightener', aliases: ['tight_eyes'] },
            AU9: { name: 'Nose wrinkler', aliases: ['wrinkle_nose'] },
            AU10: { name: 'Upper lip raiser', aliases: ['raise_upper_lip'] },
            AU12: { name: 'Lip corner puller (smile)', aliases: ['smile', 'pull_lip_corners'] },
            AU14: { name: 'Dimpler', aliases: ['dimple'] },
            AU15: { name: 'Lip corner depressor', aliases: ['sad_mouth'] },
            AU17: { name: 'Chin raiser', aliases: ['raise_chin'] },
            AU20: { name: 'Lip stretcher', aliases: ['stretch_lips'] },
            AU26: { name: 'Jaw drop', aliases: ['open_mouth'] }
        };
    }

    /**
     * Analyze frame for FACS
     */
    async analyzeFrame(imageData) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Detect face landmarks
            const predictions = await this.model.estimateFaces({
                input: imageData,
                returnTensors: false,
                flipHorizontal: false,
                predictIrises: true
            });

            if (!predictions || predictions.length === 0) {
                return {
                    detected: false,
                    actionUnits: [],
                    confidence: 0,
                    error: 'Face not detected'
                };
            }

            const face = predictions[0];
            const landmarks = face.landmarks;

            // Calculate face dimensions
            const faceDimensions = this.calculateFaceDimensions(landmarks);

            // Detect active action units
            const activeUnits = this.detectActionUnits(landmarks, faceDimensions);

            // Calculate AU intensities (0-5 scale)
            const intensities = this.calculateIntensities(activeUnits, landmarks);

            // Detect micro-expressions (requires temporal analysis)
            const microExpressions = this.detectMicroExpressions(landmarks);

            // Calculate facial symmetry
            const symmetry = this.calculateSymmetry(landmarks);

            const result = {
                detected: true,
                actionUnits: activeUnits,
                intensities: intensities,
                faceDimensions: faceDimensions,
                microExpressions: microExpressions,
                symmetry: symmetry,
                landmarks: this.normalizeLandmarks(landmarks),
                confidence: face.start.probability[0] || 0.9,
                timestamp: Date.now()
            };

            // Store for temporal analysis
            this.previousLandmarks = landmarks;

            return result;
        } catch (error) {
            logger.error('[FACSAnalyzer] Analysis failed', { error: error.message });
            return {
                detected: false,
                actionUnits: [],
                error: error.message
            };
        }
    }

    /**
     * Calculate facial dimensions and key distances
     */
    calculateFaceDimensions(landmarks) {
        // Key landmark indices (MediaPipe face mesh)
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const noseTip = landmarks[4];
        const mouthCenter = landmarks[13];
        const chinBottom = landmarks[152];
        const foreheadCenter = landmarks[10];
        const leftCheek = landmarks[226];
        const rightCheek = landmarks[446];
        const leftEyebrow = landmarks[70];
        const rightEyebrow = landmarks[300];

        return {
            faceWidth: this.distance(leftEye, rightEye),
            faceHeight: this.distance(foreheadCenter, chinBottom),
            eyeDistance: this.distance(leftEye, rightEye),
            mouthWidth: this.distance(landmarks[61], landmarks[291]),
            cheekDistance: this.distance(leftCheek, rightCheek),
            eyebrowHeight: Math.min(
                this.distance(leftEyebrow, [landmarks[70][0], landmarks[13][1]]),
                this.distance(rightEyebrow, [landmarks[300][0], landmarks[13][1]])
            ),
            eyeOpenness: this.calculateEyeOpenness(landmarks),
            jawOpen: this.calculateJawOpening(landmarks),
            noseHeight: this.distance(landmarks[4], landmarks[2])
        };
    }

    /**
     * Detect which action units are active
     */
    detectActionUnits(landmarks, faceDimensions) {
        const activeUnits = [];

        // AU6: Cheek raiser (part of genuine smile)
        if (this.isAU6Active(landmarks, faceDimensions)) {
            activeUnits.push('AU6');
        }

        // AU12: Lip corner puller (smile)
        if (this.isAU12Active(landmarks, faceDimensions)) {
            activeUnits.push('AU12');
        }

        // AU4: Brow lowerer (anger, concentration, sadness)
        if (this.isAU4Active(landmarks, faceDimensions)) {
            activeUnits.push('AU4');
        }

        // AU5: Upper lid raiser (surprise, fear)
        if (this.isAU5Active(landmarks, faceDimensions)) {
            activeUnits.push('AU5');
        }

        // AU26: Jaw drop (surprise, awe, shock)
        if (this.isAU26Active(landmarks, faceDimensions)) {
            activeUnits.push('AU26');
        }

        // AU15: Lip corner depressor (sadness, disgust)
        if (this.isAU15Active(landmarks, faceDimensions)) {
            activeUnits.push('AU15');
        }

        // AU1: Inner brow raiser (surprise, fear, sadness)
        if (this.isAU1Active(landmarks, faceDimensions)) {
            activeUnits.push('AU1');
        }

        // AU2: Outer brow raiser (surprise, sadness)
        if (this.isAU2Active(landmarks, faceDimensions)) {
            activeUnits.push('AU2');
        }

        return activeUnits;
    }

    /**
     * Calculate intensity for each action unit (0-5 scale)
     */
    calculateIntensities(activeUnits, landmarks) {
        const intensities = {};

        for (const unit of activeUnits) {
            if (unit === 'AU6') {
                intensities.AU6 = this.calculateCheekRaiserIntensity(landmarks);
            } else if (unit === 'AU12') {
                intensities.AU12 = this.calculateLipPullerIntensity(landmarks);
            } else if (unit === 'AU4') {
                intensities.AU4 = this.calculateBrowLowererIntensity(landmarks);
            } else if (unit === 'AU5') {
                intensities.AU5 = this.calculateEyelidRaiserIntensity(landmarks);
            } else if (unit === 'AU26') {
                intensities.AU26 = this.calculateJawDropIntensity(landmarks);
            } else if (unit === 'AU15') {
                intensities.AU15 = this.calculateLipDepressorIntensity(landmarks);
            }
        }

        return intensities;
    }

    /**
     * Detect micro-expressions (fleeting, < 500ms)
     * Requires temporal comparison
     */
    detectMicroExpressions(currentLandmarks) {
        if (!this.previousLandmarks) {
            return [];
        }

        const microExpressions = [];

        // Look for rapid facial changes
        const forehead = this.distance(this.previousLandmarks[70], currentLandmarks[70]);
        if (forehead > 5) {
            microExpressions.push({
                type: 'eyebrow_flash',
                region: 'forehead',
                intensity: Math.min(forehead / 20, 1),
                timestamp: Date.now()
            });
        }

        return microExpressions;
    }

    /**
     * Calculate facial symmetry
     * Low symmetry = emotional suppression or pain
     */
    calculateSymmetry(landmarks) {
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const leftMouth = landmarks[61];
        const rightMouth = landmarks[291];
        const leftCheek = landmarks[226];
        const rightCheek = landmarks[446];

        const eyeSymmetry = Math.abs(leftEye[1] - rightEye[1]) / Math.max(leftEye[1], rightEye[1]);
        const mouthSymmetry = Math.abs(leftMouth[1] - rightMouth[1]) / Math.max(leftMouth[1], rightMouth[1]);
        const cheekSymmetry = Math.abs(leftCheek[1] - rightCheek[1]) / Math.max(leftCheek[1], rightCheek[1]);

        const overallSymmetry = 1 - (eyeSymmetry + mouthSymmetry + cheekSymmetry) / 3;

        return {
            overall: overallSymmetry,
            eye: 1 - eyeSymmetry,
            mouth: 1 - mouthSymmetry,
            cheek: 1 - cheekSymmetry,
            interpretation: overallSymmetry > 0.8 ? 'symmetric' : 'asymmetric'
        };
    }

    /**
     * Helper: Distance between two points
     */
    distance(p1, p2) {
        return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
    }

    /**
     * Helper: Calculate eye openness
     */
    calculateEyeOpenness(landmarks) {
        const leftEyeTop = landmarks[159];
        const leftEyeBottom = landmarks[145];
        const rightEyeTop = landmarks[386];
        const rightEyeBottom = landmarks[374];

        const leftOpenness = this.distance(leftEyeTop, leftEyeBottom);
        const rightOpenness = this.distance(rightEyeTop, rightEyeBottom);

        return (leftOpenness + rightOpenness) / 2;
    }

    /**
     * Helper: Calculate jaw opening
     */
    calculateJawOpening(landmarks) {
        const upperIncisor = landmarks[0];
        const lowerIncisor = landmarks[17];
        return this.distance(upperIncisor, lowerIncisor);
    }

    /**
     * Helper: Check if AU6 is active
     */
    isAU6Active(landmarks, faceDimensions) {
        const cheekHeight = Math.abs(landmarks[226][1] - landmarks[113][1]);
        return cheekHeight > faceDimensions.faceHeight * 0.08;
    }

    /**
     * Helper: Check if AU12 is active
     */
    isAU12Active(landmarks, faceDimensions) {
        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];
        const noseTip = landmarks[4];

        const leftRise = noseTip[1] - leftCorner[1];
        const rightRise = noseTip[1] - rightCorner[1];

        return leftRise > 5 && rightRise > 5;
    }

    /**
     * Helper: Check if AU4 is active
     */
    isAU4Active(landmarks, faceDimensions) {
        const leftBrow = landmarks[70];
        const rightBrow = landmarks[300];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];

        const leftDrop = leftEye[1] - leftBrow[1];
        const rightDrop = rightEye[1] - rightBrow[1];

        return leftDrop < faceDimensions.faceHeight * 0.15 && rightDrop < faceDimensions.faceHeight * 0.15;
    }

    /**
     * Helper: Check if AU5 is active
     */
    isAU5Active(landmarks, faceDimensions) {
        return faceDimensions.eyeOpenness > faceDimensions.faceHeight * 0.12;
    }

    /**
     * Helper: Check if AU26 is active (jaw drop)
     */
    isAU26Active(landmarks, faceDimensions) {
        return faceDimensions.jawOpen > faceDimensions.faceHeight * 0.1;
    }

    /**
     * Helper: Check if AU15 is active
     */
    isAU15Active(landmarks, faceDimensions) {
        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];
        const noseTip = landmarks[4];

        const leftDrop = leftCorner[1] - noseTip[1];
        const rightDrop = rightCorner[1] - noseTip[1];

        return leftDrop > 10 && rightDrop > 10;
    }

    /**
     * Helper: Check if AU1 is active
     */
    isAU1Active(landmarks, faceDimensions) {
        const leftInnerBrow = landmarks[105];
        const rightInnerBrow = landmarks[334];
        const faceCenter = landmarks[4];

        const leftRise = faceCenter[1] - leftInnerBrow[1];
        const rightRise = faceCenter[1] - rightInnerBrow[1];

        return leftRise > 5 && rightRise > 5;
    }

    /**
     * Helper: Check if AU2 is active
     */
    isAU2Active(landmarks, faceDimensions) {
        const leftOuterBrow = landmarks[70];
        const rightOuterBrow = landmarks[300];
        const faceCenter = landmarks[4];

        const leftRise = faceCenter[1] - leftOuterBrow[1];
        const rightRise = faceCenter[1] - rightOuterBrow[1];

        return leftRise > 8 && rightRise > 8;
    }

    /**
     * Calculate intensity scores
     */
    calculateCheekRaiserIntensity(landmarks) {
        const cheek = this.distance(landmarks[226], landmarks[113]);
        return Math.min(cheek / 15, 5);
    }

    calculateLipPullerIntensity(landmarks) {
        const lipMovement = Math.max(
            landmarks[4][1] - landmarks[61][1],
            landmarks[4][1] - landmarks[291][1]
        );
        return Math.min(lipMovement / 10, 5);
    }

    calculateBrowLowererIntensity(landmarks) {
        const browDrop = Math.min(
            landmarks[33][1] - landmarks[70][1],
            landmarks[263][1] - landmarks[300][1]
        );
        return Math.max(0, Math.min(browDrop / 10, 5));
    }

    calculateEyelidRaiserIntensity(landmarks) {
        const eyeOpen = this.calculateEyeOpenness(landmarks);
        return Math.min(eyeOpen / 15, 5);
    }

    calculateJawDropIntensity(landmarks) {
        const jawDrop = this.calculateJawOpening(landmarks);
        return Math.min(jawDrop / 15, 5);
    }

    calculateLipDepressorIntensity(landmarks) {
        const lipDrop = Math.min(
            landmarks[61][1] - landmarks[4][1],
            landmarks[291][1] - landmarks[4][1]
        );
        return Math.max(0, Math.min(lipDrop / 10, 5));
    }

    /**
     * Normalize landmarks to 0-1 range
     */
    normalizeLandmarks(landmarks) {
        const minX = Math.min(...landmarks.map(l => l[0]));
        const maxX = Math.max(...landmarks.map(l => l[0]));
        const minY = Math.min(...landmarks.map(l => l[1]));
        const maxY = Math.max(...landmarks.map(l => l[1]));

        return landmarks.map(l => [
            (l[0] - minX) / (maxX - minX),
            (l[1] - minY) / (maxY - minY),
            l[2] || 0 // Z coordinate if available
        ]);
    }
}

export const facsAnalyzer = new FACSAnalyzer();

export default FACSAnalyzer;
