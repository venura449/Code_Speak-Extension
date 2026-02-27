/**
 * Audio Utilities for Code Speaks Extension
 * Handles audio file playback with support for web audio and native methods
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

class AudioPlayer {
    constructor(extensionPath) {
        this.extensionPath = extensionPath;
        this.soundsPath = path.join(extensionPath, 'sounds');
        this.isEnabled = true;
        this.volumeLevel = 0.7;
    }

    /**
     * Set the extension enabled/disabled state
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    /**
     * Set the volume level (0-1)
     */
    setVolume(level) {
        this.volumeLevel = Math.max(0, Math.min(1, level));
    }

    /**
     * Play a sound file by type
     */
    play(soundType) {
        if (!this.isEnabled) {
            return;
        }

        const soundFile = this.getSoundFilePath(soundType);

        if (!fs.existsSync(soundFile)) {
            console.warn(`[Code Speaks] Sound file not found: ${soundFile}`);
            return;
        }

        this.playFile(soundFile);
    }

    /**
     * Get the full path to a sound file
     */
    getSoundFilePath(soundType) {
        const soundMap = {
            'success': 'success.mp3',
            'fail': 'fail.mp3',
            'warning': 'warning.mp3',
            'error_increase': 'error_increase.mp3',
            'error_decrease': 'error_decrease.mp3',
        };

        const fileName = soundMap[soundType] || 'default.mp3';
        return path.join(this.soundsPath, fileName);
    }

    /**
     * Play an audio file silently using Windows MCI (winmm.dll) — no player window
     */
    playFile(filePath) {
        try {
            console.log(`[Code Speaks] 🔊 Playing: ${path.basename(filePath)}`);

            // Build a PowerShell script that uses winmm.dll MCI to play MP3 silently
            const script = [
                `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class MCI { [DllImport("winmm.dll")] public static extern int mciSendString(string s, System.Text.StringBuilder sb, int n, int h); }'`,
                `[MCI]::mciSendString('open "${filePath}" type mpegvideo alias media', $null, 0, 0)`,
                `[MCI]::mciSendString('play media wait', $null, 0, 0)`,
                `[MCI]::mciSendString('close media', $null, 0, 0)`
            ].join('\n');

            // Use -EncodedCommand to avoid any escaping issues
            const encoded = Buffer.from(script, 'utf16le').toString('base64');

            exec(`powershell -NoProfile -WindowStyle Hidden -EncodedCommand ${encoded}`, { windowsHide: true }, (error) => {
                if (error) {
                    console.error(`[Code Speaks] Error playing audio: ${error.message}`);
                }
            });
        } catch (error) {
            console.error(`[Code Speaks] Error playing audio: ${error.message}`);
        }
    }

    /**
     * Test if audio files exist and are accessible
     */
    verifyAudioFiles() {
        const soundTypes = ['success', 'fail', 'warning', 'error_increase', 'error_decrease'];
        const results = {};

        for (const type of soundTypes) {
            const filePath = this.getSoundFilePath(type);
            results[type] = fs.existsSync(filePath);
        }

        return results;
    }

    /**
     * Get summary of available audio files
     */
    getAudioSummary() {
        const verificationResults = this.verifyAudioFiles();
        let summary = '[Code Speaks] Audio Files Status:\n';

        for (const [type, exists] of Object.entries(verificationResults)) {
            summary += `  ${exists ? '✓' : '✗'} ${type}\n`;
        }

        return summary;
    }
}

module.exports = AudioPlayer;
