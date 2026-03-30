/**
 * Calibration UI Manager
 *
 * Handles the 60-second baseline calibration UI
 * Shows progress to user while backend collects baseline AU data
 */

export class CalibrationUI {
    constructor(options = {}) {
        this.overlayId = options.overlayId || 'calibration-overlay';
        this.progressBarId = options.progressBarId || 'calibration-progress-bar';
        this.timerId = options.timerId || 'calibration-timer';
        this.statusId = options.statusId || 'calibration-status';

        this.isActive = false;
        this.startTime = null;
        this.calibrationDuration = 60000; // 60 seconds in ms
        this.animationFrameId = null;

        this.overlayElement = document.getElementById(this.overlayId);
        this.progressBarElement = document.getElementById(this.progressBarId);
        this.timerElement = document.getElementById(this.timerId);
        this.statusElement = document.getElementById(this.statusId);

        // Bind event handlers
        this.handleSkip = this.handleSkip.bind(this);

        console.log('[CalibrationUI] Initialized');
    }

    /**
     * Show the calibration overlay
     */
    show() {
        if (!this.overlayElement) {
            console.error('[CalibrationUI] Overlay element not found');
            return;
        }

        this.overlayElement.style.display = 'flex';
        this.isActive = true;
        this.startTime = Date.now();

        // Add event listeners
        const skipBtn = this.overlayElement.querySelector('#calibration-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', this.handleSkip);
        }

        // Start animation loop
        this.animateProgress();

        console.log('[CalibrationUI] Calibration overlay shown');
    }

    /**
     * Hide the calibration overlay
     */
    hide() {
        if (!this.overlayElement) return;

        this.overlayElement.style.display = 'none';
        this.isActive = false;

        // Cancel animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Remove event listeners
        const skipBtn = this.overlayElement.querySelector('#calibration-skip');
        if (skipBtn) {
            skipBtn.removeEventListener('click', this.handleSkip);
        }

        console.log('[CalibrationUI] Calibration overlay hidden');
    }

    /**
     * Animate progress bar and timer
     */
    animateProgress() {
        const elapsed = Date.now() - this.startTime;
        const progress = Math.min(100, (elapsed / this.calibrationDuration) * 100);
        const remainingMs = Math.max(0, this.calibrationDuration - elapsed);
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        // Update progress bar
        if (this.progressBarElement) {
            this.progressBarElement.style.width = `${progress}%`;
        }

        // Update timer
        if (this.timerElement) {
            this.timerElement.textContent = `${remainingSeconds}s`;
        }

        // Update status based on progress
        if (this.statusElement) {
            if (progress < 25) {
                this.statusElement.textContent = '⏳ Kalibrasyonunuz başlıyor... Yüz ifadeni sakin tutun.';
            } else if (progress < 50) {
                this.statusElement.textContent = '📊 Veriler toplanıyor... Biraz daha.';
            } else if (progress < 75) {
                this.statusElement.textContent = '✓ Harika gidiyor! Devam et.';
            } else {
                this.statusElement.textContent = '✓✓ Neredeyse bitti! Teşekkür ederim.';
            }
        }

        // Continue animation if not complete
        if (elapsed < this.calibrationDuration) {
            this.animationFrameId = requestAnimationFrame(() => this.animateProgress());
        } else {
            // Calibration complete
            this.onCalibrationComplete();
        }
    }

    /**
     * Called when calibration completes
     */
    onCalibrationComplete() {
        if (this.statusElement) {
            this.statusElement.textContent = '✓✓✓ Kalibrasyonunuz tamamlandı!';
        }

        // Hide after brief delay
        setTimeout(() => {
            this.hide();
        }, 1000);

        console.log('[CalibrationUI] Calibration complete');
    }

    /**
     * Handle skip button click
     */
    handleSkip() {
        if (confirm('Kalibrasyonu atlamak istediğinizden emin misiniz? Bu analiz doğruluğunu azaltabilir.')) {
            this.hide();
            console.log('[CalibrationUI] Calibration skipped by user');
        }
    }

    /**
     * Update progress from WebSocket message
     * Called when backend sends calibration_progress message
     */
    updateProgress(data) {
        if (!this.isActive) return;

        const { framesCollected, progress } = data;

        // Update status with frame count
        if (this.statusElement && framesCollected) {
            this.statusElement.textContent = `📊 Veriler toplanıyor (${framesCollected} frame)... ${progress}`;
        }

        console.log('[CalibrationUI] Progress update:', { framesCollected, progress });
    }

    /**
     * Destroy the UI manager
     */
    destroy() {
        this.hide();
        console.log('[CalibrationUI] Destroyed');
    }
}

export default CalibrationUI;
