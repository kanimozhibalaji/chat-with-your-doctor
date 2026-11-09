/**
 * VitalSync Guided Stationary POS-rPPG Optical Spot-Check Engine
 * ==============================================================
 * Designed strictly as a 15-second stationary optical pulse spot-check adjunct:
 *
 *   1. Unique-Frame Optical Capture (`requestVideoFrameCallback` + `currentTime` guard):
 *      Eliminates 60Hz/120Hz monitor `requestAnimationFrame` duplicate-frame oversampling.
 *   2. YCbCr Dermal Segmentation + Centroid Motion & Low-Light Gate:
 *      Pauses spot-check accumulation whenever facial speech/head motion or dim lighting
 *      would corrupt the cardiac spectrum.
 *   3. 3-Channel POS Projection (Plane-Orthogonal-to-Skin — Wang et al., IEEE TBME 2017):
 *      Projects temporal RGB onto the two axes orthogonal to `[1, 1, 1]` intensity drift,
 *      canceling webcam auto-exposure and specular glare.
 *   4. Zero-Phase Forward-Backward (`filtfilt`) Butterworth Bandpass [0.78 Hz – 2.35 Hz]:
 *      4th-order zero-phase cardiac passband (47 – 141 BPM) suppressing DC drift & high harmonics.
 *   5. Sub-Harmonic Dicrotic-Notch Disambiguation + Autocorrelation Verification:
 *      Prevents `f0 -> 2*f0` second-harmonic doubling (e.g., 70 BPM jumping to 140 BPM)
 *      by cross-checking fundamental `f/2` spectral energy and full-cycle autocorrelation.
 *   6. Physiological Slew-Rate Limiter + 15-Second Interquartile-Mean Auto-Lock:
 *      Locks a stable, non-fluctuating resting BPM once 15s of clean stationary frames complete.
 */

export class RPPGEngine {
    constructor(videoElement, onUpdate, options = {}) {
        this.video = videoElement;
        this.onUpdate = onUpdate;
        this.spotCheckMode = options.spotCheckMode !== false; // Default true: 15s guided spot-check
        this.spotCheckTargetSec = options.spotCheckTargetSec || 15;
        this.onComplete = options.onComplete || null;

        this.isRunning = false;
        this.isLocked = false;
        this.rafId = null;
        this.rvfcId = null;
        this.lastVideoTime = -1;

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        // 10-second sliding buffer at ~30 FPS (~300 genuine camera frames)
        this.maxFrames = 300;
        this.rgbBuffer = []; // [{ r, g, b, t }]
        this.filteredWaveform = [];

        // Motion & lighting tracking
        this.prevCentroid = null;
        this.prevLuma = null;
        this.noSkinFrames = 0;
        this.motionCooldown = 0;

        // Spot-check & physiological stabilization state
        this.cleanDurationSec = 0;
        this.lastCleanFrameTs = null;
        this.currentBpm = null;
        this.validBpmHistory = [];
        this.spotCheckSamples = [];
        this.outlierStreak = 0;
        this.lastAnalysisTime = 0;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isLocked = false;
        this.lastVideoTime = -1;
        this.rgbBuffer = [];
        this.filteredWaveform = [];
        this.prevCentroid = null;
        this.prevLuma = null;
        this.noSkinFrames = 0;
        this.motionCooldown = 0;
        this.cleanDurationSec = 0;
        this.lastCleanFrameTs = null;
        this.currentBpm = null;
        this.validBpmHistory = [];
        this.spotCheckSamples = [];
        this.outlierStreak = 0;
        this.lastAnalysisTime = 0;

        this.scheduleNextFrame();
    }

    stop() {
        this.isRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.rvfcId && this.video && typeof this.video.cancelVideoFrameCallback === 'function') {
            try {
                this.video.cancelVideoFrameCallback(this.rvfcId);
            } catch (e) {}
            this.rvfcId = null;
        }
    }

    scheduleNextFrame() {
        if (!this.isRunning) return;
        if (this.video && typeof this.video.requestVideoFrameCallback === 'function') {
            this.rvfcId = this.video.requestVideoFrameCallback((now, metadata) => {
                const frameTimeMs =
                    typeof metadata?.mediaTime === 'number' && metadata.mediaTime > 0
                        ? metadata.mediaTime * 1000
                        : now;
                this.handleUniqueVideoFrame(now, frameTimeMs);
                this.scheduleNextFrame();
            });
        } else {
            this.rafId = requestAnimationFrame((now) => {
                if (this.video && this.video.currentTime !== this.lastVideoTime) {
                    this.lastVideoTime = this.video.currentTime;
                    this.handleUniqueVideoFrame(now, now);
                }
                this.scheduleNextFrame();
            });
        }
    }

    /**
     * 2nd-Order Butterworth Biquad Filter + Zero-Phase Forward-Backward (`filtfilt`)
     */
    applyBiquadSinglePass(signal, cutoffHz, sampleRate, type = 'lowpass') {
        const nyquist = sampleRate * 0.5;
        const safeCutoff = Math.max(0.1, Math.min(cutoffHz, nyquist * 0.90));
        const wc = Math.tan((Math.PI * safeCutoff) / sampleRate);
        const k1 = Math.SQRT2 * wc;
        const k2 = wc * wc;
        const a0 = 1 + k1 + k2;

        let b0, b1, b2;
        if (type === 'lowpass') {
            b0 = k2 / a0;
            b1 = 2 * b0;
            b2 = b0;
        } else {
            b0 = 1 / a0;
            b1 = -2 * b0;
            b2 = b0;
        }
        const a1 = (2 * (k2 - 1)) / a0;
        const a2 = (1 - k1 + k2) / a0;

        const out = new Array(signal.length).fill(0);
        // Pad initial state with first sample to eliminate startup transient ringing
        let x1 = signal[0] || 0;
        let x2 = signal[0] || 0;
        let y1 = type === 'lowpass' ? signal[0] || 0 : 0;
        let y2 = y1;

        for (let i = 0; i < signal.length; i++) {
            const x0 = signal[i];
            const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
            out[i] = y0;
            x2 = x1;
            x1 = x0;
            y2 = y1;
            y1 = y0;
        }
        return out;
    }

    applyZeroPhaseBandpass(signal, lowCutHz, highCutHz, sampleRate) {
        if (signal.length < 8) return signal;
        const hpFwd = this.applyBiquadSinglePass(signal, lowCutHz, sampleRate, 'highpass');
        const bpFwd = this.applyBiquadSinglePass(hpFwd, highCutHz, sampleRate, 'lowpass');
        const rev = [...bpFwd].reverse();
        const hpRev = this.applyBiquadSinglePass(rev, lowCutHz, sampleRate, 'highpass');
        const bpRev = this.applyBiquadSinglePass(hpRev, highCutHz, sampleRate, 'lowpass');
        return bpRev.reverse();
    }

    /**
     * Stage 3: Plane-Orthogonal-to-Skin (POS) Chrominance Extraction (Wang et al., IEEE TBME 2017)
     */
    computePOSSignal(rgbSamples, sampleRate) {
        const n = rgbSamples.length;
        const pos = new Array(n).fill(0);
        const winLen = Math.min(n, Math.max(28, Math.round(sampleRate * 1.6)));

        for (let start = 0; start <= n - winLen; start++) {
            let sumR = 0, sumG = 0, sumB = 0;
            for (let k = start; k < start + winLen; k++) {
                sumR += rgbSamples[k].r;
                sumG += rgbSamples[k].g;
                sumB += rgbSamples[k].b;
            }
            const meanR = sumR / winLen || 1;
            const meanG = sumG / winLen || 1;
            const meanB = sumB / winLen || 1;

            const s1 = new Array(winLen);
            const s2 = new Array(winLen);
            let meanS1 = 0, meanS2 = 0;

            for (let i = 0; i < winLen; i++) {
                const sample = rgbSamples[start + i];
                const rn = sample.r / meanR;
                const gn = sample.g / meanG;
                const bn = sample.b / meanB;
                // POS orthogonal projection axes: P = [[0, 1, -1], [-2, 1, 1]]
                const v1 = gn - bn;
                const v2 = gn + bn - 2 * rn;
                s1[i] = v1;
                s2[i] = v2;
                meanS1 += v1;
                meanS2 += v2;
            }
            meanS1 /= winLen;
            meanS2 /= winLen;

            let varS1 = 0, varS2 = 0;
            for (let i = 0; i < winLen; i++) {
                const d1 = s1[i] - meanS1;
                const d2 = s2[i] - meanS2;
                varS1 += d1 * d1;
                varS2 += d2 * d2;
            }
            const stdS1 = Math.sqrt(varS1 / winLen);
            const stdS2 = Math.sqrt(varS2 / winLen);
            const alpha = stdS2 > 1e-7 ? stdS1 / stdS2 : 0;

            let meanH = 0;
            const h = new Array(winLen);
            for (let i = 0; i < winLen; i++) {
                h[i] = s1[i] + alpha * s2[i];
                meanH += h[i];
            }
            meanH /= winLen;

            for (let i = 0; i < winLen; i++) {
                pos[start + i] += h[i] - meanH;
            }
        }
        return pos;
    }

    handleUniqueVideoFrame(wallNow, frameTimeMs) {
        if (!this.isRunning || this.isLocked) return;
        if (!this.video || this.video.readyState < 2 || this.video.paused) return;

        const width = 160;
        const height = 120;
        if (this.canvas.width !== width) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        try {
            this.ctx.drawImage(this.video, 0, 0, width, height);

            const roiX = Math.floor(width * 0.28);
            const roiY = Math.floor(height * 0.16);
            const roiW = Math.floor(width * 0.44);
            const roiH = Math.floor(height * 0.50);

            const imgData = this.ctx.getImageData(roiX, roiY, roiW, roiH);
            const data = imgData.data;
            const totalPixels = roiW * roiH;

            let skinR = 0, skinG = 0, skinB = 0, skinY = 0;
            let sumX = 0, sumY = 0;
            let skinCount = 0;
            let globalY = 0;

            for (let py = 0; py < roiH; py++) {
                for (let px = 0; px < roiW; px++) {
                    const idx = (py * roiW + px) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];

                    const y = 0.299 * r + 0.587 * g + 0.114 * b;
                    globalY += y;
                    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                    if (y >= 40 && y <= 242 && cb >= 75 && cb <= 135 && cr >= 130 && cr <= 180 && r > g * 0.94) {
                        skinR += r;
                        skinG += g;
                        skinB += b;
                        skinY += y;
                        sumX += px / roiW;
                        sumY += py / roiH;
                        skinCount++;
                    }
                }
            }

            const skinCoverage = skinCount / (totalPixels || 1);
            const avgGlobalY = globalY / (totalPixels || 1);

            // Gate A: Low Light or Face Missing
            if (skinCoverage < 0.24) {
                this.noSkinFrames++;
                this.lastCleanFrameTs = null;
                if (this.noSkinFrames >= 8) {
                    this.rgbBuffer = [];
                    this.prevCentroid = null;
                    this.prevLuma = null;
                    this.emitUpdate({
                        bpm: this.currentBpm,
                        confidence: 0,
                        signalQuality: avgGlobalY < 42 ? 'LOW_LIGHT' : 'NO_FACE',
                        skinCoverage: Math.round(skinCoverage * 100),
                        progressPct: this.getProgressPct(),
                        motionWarning: false,
                        isDetecting: false,
                        isLocked: false
                    });
                }
                return;
            }

            this.noSkinFrames = 0;
            const meanR = skinR / skinCount;
            const meanG = skinG / skinCount;
            const meanB = skinB / skinCount;
            const meanY = skinY / skinCount;
            const cx = sumX / skinCount;
            const cy = sumY / skinCount;

            // Gate B: Speech / Head Motion & Auto-Exposure Jump Rejection
            let isMotion = false;
            if (this.prevCentroid && this.prevLuma) {
                const dPos = Math.hypot(cx - this.prevCentroid.x, cy - this.prevCentroid.y);
                const dLuma = Math.abs(meanY - this.prevLuma) / Math.max(1, this.prevLuma);
                if (dPos > 0.028 || dLuma > 0.045) {
                    isMotion = true;
                }
            }
            this.prevCentroid = { x: cx, y: cy };
            this.prevLuma = meanY;

            if (isMotion) {
                this.motionCooldown = 8;
                this.lastCleanFrameTs = null;
                // Trim the last few frames that preceded the motion spike
                if (this.rgbBuffer.length > 6) {
                    this.rgbBuffer.splice(-4);
                }
                this.emitUpdate({
                    bpm: this.currentBpm,
                    confidence: 0.35,
                    signalQuality: 'HOLD_STILL',
                    skinCoverage: Math.round(skinCoverage * 100),
                    progressPct: this.getProgressPct(),
                    motionWarning: true,
                    isDetecting: false,
                    isLocked: false
                });
                return;
            }

            if (this.motionCooldown > 0) {
                this.motionCooldown--;
                this.lastCleanFrameTs = null;
                return;
            }

            // Clean stationary frame accepted!
            if (this.lastCleanFrameTs !== null) {
                const dt = Math.min(0.15, Math.max(0, (wallNow - this.lastCleanFrameTs) / 1000));
                this.cleanDurationSec += dt;
            }
            this.lastCleanFrameTs = wallNow;

            // Enforce monotonic frame timestamps
            const prevT = this.rgbBuffer.length > 0 ? this.rgbBuffer[this.rgbBuffer.length - 1].t : -1;
            const safeT = frameTimeMs > prevT ? frameTimeMs : wallNow;

            this.rgbBuffer.push({ r: meanR, g: meanG, b: meanB, t: safeT });
            if (this.rgbBuffer.length > this.maxFrames) {
                this.rgbBuffer.shift();
            }

            const spanSec =
                this.rgbBuffer.length > 1
                    ? (this.rgbBuffer[this.rgbBuffer.length - 1].t - this.rgbBuffer[0].t) / 1000
                    : 0;

            // Require at least 4.5s of clean optical signal before estimating cardiac frequency
            if (spanSec >= 4.5 && this.rgbBuffer.length >= 90 && wallNow - this.lastAnalysisTime >= 250) {
                this.lastAnalysisTime = wallNow;
                this.analyzeSpectrumAndLock(skinCoverage, spanSec);
            } else if (spanSec < 4.5) {
                this.emitUpdate({
                    bpm: this.currentBpm,
                    confidence: Number(Math.min(0.5, (spanSec / 4.5) * 0.48).toFixed(2)),
                    signalQuality: 'CALIBRATING',
                    skinCoverage: Math.round(skinCoverage * 100),
                    progressPct: this.getProgressPct(),
                    motionWarning: false,
                    isDetecting: false,
                    isLocked: false
                });
            }
        } catch (err) {
            // Ignore transient canvas read errors
        }
    }

    getProgressPct() {
        if (!this.spotCheckMode) return 100;
        return Math.min(100, Math.round((this.cleanDurationSec / this.spotCheckTargetSec) * 100));
    }

    /**
     * Core Spectral + Autocorrelation Estimator (mountable directly in unit tests too)
     */
    estimateHeartRateFromPOS(bandPassed, sampleRate) {
        const n = bandPassed.length;
        const windowed = new Array(n);
        for (let i = 0; i < n; i++) {
            const hanning = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
            windowed[i] = bandPassed[i] * hanning;
        }

        // Resting seated teleconsultation range: 48 – 138 BPM (0.80 – 2.30 Hz)
        const minFreq = 0.80;
        const maxFreq = 2.30;
        const freqStep = 0.01; // 0.6 BPM resolution

        const psdBins = [];
        let maxPower = 0;
        let rawPeakFreq = 1.2;
        let totalPower = 0;

        for (let f = minFreq; f <= maxFreq + 1e-6; f += freqStep) {
            let re = 0;
            let im = 0;
            const omega = (2 * Math.PI * f) / sampleRate;
            for (let k = 0; k < n; k++) {
                const angle = omega * k;
                re += windowed[k] * Math.cos(angle);
                im -= windowed[k] * Math.sin(angle);
            }
            const power = re * re + im * im;
            psdBins.push({ f, power });
            totalPower += power;
            if (power > maxPower) {
                maxPower = power;
                rawPeakFreq = f;
            }
        }

        // Normalized Time-Domain Autocorrelation helper for lag validation
        let zeroLagEnergy = 0;
        for (let i = 0; i < n; i++) zeroLagEnergy += bandPassed[i] * bandPassed[i];

        const getAutocorrAtFreq = (freqHz) => {
            if (zeroLagEnergy <= 1e-12) return 0;
            const exactLag = sampleRate / freqHz;
            const lagLow = Math.max(2, Math.floor(exactLag) - 1);
            const lagHigh = Math.min(Math.floor(n * 0.65), Math.ceil(exactLag) + 1);
            let bestR = -1;
            for (let lag = lagLow; lag <= lagHigh; lag++) {
                let sum = 0;
                const count = n - lag;
                if (count < 16) continue;
                for (let i = 0; i < count; i++) {
                    sum += bandPassed[i] * bandPassed[i + lag];
                }
                const normR = (sum / count) / (zeroLagEnergy / n);
                if (normR > bestR) bestR = normR;
            }
            return bestR;
        };

        let chosenFreq = rawPeakFreq;

        // Stage 5: Dicrotic-Notch 2nd-Harmonic Suppression (`2*f0 -> f0`)
        // Whenever raw spectral winner is >= 96 BPM (1.60 Hz), inspect fundamental candidate `f_half = f / 2`.
        if (rawPeakFreq >= 1.60) {
            const halfCenter = rawPeakFreq * 0.5;
            if (halfCenter >= minFreq) {
                let bestHalfPower = 0;
                let bestHalfFreq = halfCenter;
                for (const bin of psdBins) {
                    if (Math.abs(bin.f - halfCenter) <= 0.09 && bin.power > bestHalfPower) {
                        bestHalfPower = bin.power;
                        bestHalfFreq = bin.f;
                    }
                }

                // Verify `f/2` is an actual fundamental spectral peak (carries >= 20% of 2nd-harmonic power)
                // Note: time-domain autocorrelation at lag 2T is naturally high even for pure f0, so only PSD
                // energy at f/2 distinguishes a dicrotic-notch harmonic (68 + 136 BPM) from true 118 BPM tachycardia!
                if (bestHalfPower >= maxPower * 0.20) {
                    chosenFreq = bestHalfFreq;
                }
            }
        }

        // Compute spectral concentration around chosen fundamental (+ its 2nd harmonic if inside band)
        let signalPower = 0;
        for (const bin of psdBins) {
            if (Math.abs(bin.f - chosenFreq) <= 0.10 || Math.abs(bin.f - chosenFreq * 2) <= 0.10) {
                signalPower += bin.power;
            }
        }
        const spectralPurity = totalPower > 0 ? signalPower / totalPower : 0;

        return {
            bpm: chosenFreq * 60,
            spectralPurity,
            autocorr: getAutocorrAtFreq(chosenFreq)
        };
    }

    analyzeSpectrumAndLock(skinCoverage, spanSec) {
        const n = this.rgbBuffer.length;
        const sampleRate = Math.max(12, Math.min(60, (n - 1) / spanSec));

        const posRaw = this.computePOSSignal(this.rgbBuffer, sampleRate);
        const bandPassed = this.applyZeroPhaseBandpass(posRaw, 0.78, 2.35, sampleRate);
        this.filteredWaveform = bandPassed.slice(-75);

        const { bpm: rawBpm, spectralPurity, autocorr } = this.estimateHeartRateFromPOS(bandPassed, sampleRate);

        // Strict SNR + periodicity gate: refuse noisy guesses
        if (rawBpm < 48 || rawBpm > 138 || spectralPurity < 0.24 || autocorr < 0.12) {
            this.emitUpdate({
                bpm: this.currentBpm,
                confidence: 0.42,
                signalQuality: 'CALIBRATING',
                skinCoverage: Math.round(skinCoverage * 100),
                progressPct: this.getProgressPct(),
                motionWarning: false,
                isDetecting: false,
                isLocked: false
            });
            return;
        }

        // Physiological Slew-Rate Gate: reject sudden >14 BPM single-window spikes unless sustained 4x
        if (this.currentBpm !== null && Math.abs(rawBpm - this.currentBpm) > 14) {
            this.outlierStreak++;
            if (this.outlierStreak < 4) {
                return;
            }
        }
        this.outlierStreak = 0;

        this.validBpmHistory.push(rawBpm);
        if (this.validBpmHistory.length > 9) this.validBpmHistory.shift();

        // Interquartile-Range (IQR) Trimmed Mean
        const sorted = [...this.validBpmHistory].sort((a, b) => a - b);
        const qStart = Math.floor(sorted.length * 0.2);
        const qEnd = Math.max(qStart + 1, Math.ceil(sorted.length * 0.8));
        const trimmed = sorted.slice(qStart, qEnd);
        const targetBpm = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;

        // Smooth slew limit (max ±2 BPM step per update)
        if (this.currentBpm === null) {
            this.currentBpm = Math.round(targetBpm);
        } else {
            const diff = targetBpm - this.currentBpm;
            const clampedStep = Math.max(-2, Math.min(2, diff));
            this.currentBpm = Math.round(this.currentBpm + clampedStep);
        }

        this.spotCheckSamples.push(this.currentBpm);

        const confidence = Math.min(0.96, Math.max(0.62, Number((0.48 + spectralPurity * 0.65).toFixed(2))));
        const progressPct = this.getProgressPct();

        // Lock final reading once 15-second stationary spot-check completes!
        if (this.spotCheckMode && progressPct >= 100 && this.spotCheckSamples.length >= 6) {
            const finalSorted = [...this.spotCheckSamples].sort((a, b) => a - b);
            const lo = Math.floor(finalSorted.length * 0.25);
            const hi = Math.max(lo + 1, Math.ceil(finalSorted.length * 0.75));
            const iqm = Math.round(
                finalSorted.slice(lo, hi).reduce((a, b) => a + b, 0) / (hi - lo)
            );
            this.currentBpm = iqm;
            this.isLocked = true;

            const finalPayload = {
                bpm: this.currentBpm,
                confidence: Math.max(0.85, confidence),
                signalQuality: 'LOCKED',
                sampleRate: Number(sampleRate.toFixed(1)),
                skinCoverage: Math.round(skinCoverage * 100),
                progressPct: 100,
                motionWarning: false,
                waveform: this.filteredWaveform,
                isDetecting: true,
                isLocked: true
            };
            this.emitUpdate(finalPayload);
            if (typeof this.onComplete === 'function') {
                this.onComplete(finalPayload);
            }
            this.stop();
            return;
        }

        const signalQuality =
            confidence >= 0.82 && skinCoverage >= 0.42
                ? 'EXCELLENT'
                : confidence >= 0.70
                ? 'GOOD'
                : 'FAIR';

        this.emitUpdate({
            bpm: this.currentBpm,
            confidence,
            signalQuality,
            sampleRate: Number(sampleRate.toFixed(1)),
            skinCoverage: Math.round(skinCoverage * 100),
            progressPct,
            motionWarning: false,
            waveform: this.filteredWaveform,
            isDetecting: true,
            isLocked: false
        });
    }

    emitUpdate(payload) {
        if (typeof this.onUpdate === 'function') {
            this.onUpdate({
                waveform: this.filteredWaveform,
                ...payload
            });
        }
    }
}
