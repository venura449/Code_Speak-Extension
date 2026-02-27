const vscode = require('vscode');
const path = require('path');
const AudioPlayer = require('./audio-utils');

// Track previous error count to detect if errors increased or decreased
let previousErrorCount = 0;
let previousWarningCount = 0;
let audioPlayer = null;

/**
 * Initialize audio player with extension settings
 * @param {vscode.ExtensionContext} context - Extension context
 */
function initializeAudioPlayer(context) {
	audioPlayer = new AudioPlayer(context.extensionPath);
	updateAudioPlayerSettings();
}

/**
 * Update audio player based on configuration
 */
function updateAudioPlayerSettings() {
	if (!audioPlayer) return;

	const config = vscode.workspace.getConfiguration('codeSpeak');
	audioPlayer.setEnabled(config.get('enabled', true));
	audioPlayer.setVolume(config.get('volumeLevel', 0.7));
}

/**
 * Play a sound using the audio player
 * @param {string} soundType - Type of sound to play
 */
function playSound(soundType) {
	if (!audioPlayer) return;

	const config = vscode.workspace.getConfiguration('codeSpeak');

	// Check if this specific sound type is enabled
	const enabledKey = {
		'success': 'soundOnTerminalSuccess',
		'fail': 'soundOnTerminalFail',
		'warning': 'soundOnWarning',
		'error_increase': 'soundOnErrorIncrease',
		'error_decrease': 'soundOnErrorDecrease',
	}[soundType];

	if (enabledKey && !config.get(enabledKey, true)) {
		console.log(`[Code Speaks] ${soundType} is disabled in settings`);
		return;
	}

	audioPlayer.play(soundType);
}

/**
 * Handle terminal execution and play appropriate sound
 * @param {vscode.ExtensionContext} context - Extension context
 */
function setupTerminalEventListeners(context) {
	// Listen for shell command completion in any terminal (exit code based)
	context.subscriptions.push(
		vscode.window.onDidEndTerminalShellExecution((event) => {
			const exitCode = event.exitCode;
			if (exitCode === undefined) return; // exit code not available

			if (exitCode === 0) {
				playSound('success');
				console.log('[Code Speaks] ✅ Terminal command succeeded!');
			} else {
				playSound('fail');
				console.log(`[Code Speaks] ❌ Terminal command failed (exit code: ${exitCode})`);
			}
		})
	);

	// Listen for VS Code task completion as well
	context.subscriptions.push(
		vscode.tasks.onDidEndTaskProcess((event) => {
			if (event.exitCode === 0) {
				playSound('success');
				console.log('[Code Speaks] ✅ Task succeeded!');
			} else {
				playSound('fail');
				console.log(`[Code Speaks] ❌ Task failed (exit code: ${event.exitCode})`);
			}
		})
	);
}

/**
 * Monitor code diagnostics (errors and warnings)
 * @param {vscode.ExtensionContext} context - Extension context
 */
function setupDiagnosticListeners(context) {
	// Initial count
	updateDiagnosticCounts();

	// Listen for diagnostics changes
	vscode.languages.onDidChangeDiagnostics(() => {
		updateDiagnosticCounts();
	});
}

/**
 * Update diagnostic counts and play sounds based on changes
 */
function updateDiagnosticCounts() {
	const allDiagnostics = vscode.languages.getDiagnostics();

	let errorCount = 0;
	let warningCount = 0;

	// Count all errors and warnings
	for (const [, diagnosticList] of allDiagnostics) {
		for (const diagnostic of diagnosticList) {
			if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
				errorCount++;
			} else if (diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
				warningCount++;
			}
		}
	}

	// Check if errors increased
	if (errorCount > previousErrorCount && previousErrorCount >= 0) {
		playSound('error_increase');
		console.log(`[Code Speaks] 📈 Errors increased: ${previousErrorCount} → ${errorCount}`);
	}
	// Check if errors decreased
	else if (errorCount < previousErrorCount && previousErrorCount > 0) {
		playSound('error_decrease');
		console.log(`[Code Speaks] 📉 Errors decreased: ${previousErrorCount} → ${errorCount}`);
	}

	// Check for warnings
	if (warningCount > 0 && warningCount > previousWarningCount) {
		playSound('warning');
		console.log(`[Code Speaks] ⚠️  ${warningCount} warning(s) detected`);
	}

	previousErrorCount = errorCount;
	previousWarningCount = warningCount;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('[Code Speaks] 🎵 Extension activated!');

	// Initialize audio player
	initializeAudioPlayer(context);

	// Setup sound detection for terminals
	setupTerminalEventListeners(context);

	// Setup sound detection for diagnostics
	setupDiagnosticListeners(context);

	// Watch for configuration changes
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('codeSpeak')) {
			updateAudioPlayerSettings();
			console.log('[Code Speaks] Settings updated');
		}
	});

	// Command to test sounds
	const testCommand = vscode.commands.registerCommand('venura.testSounds', function () {
		const sounds = ['success', 'fail', 'warning', 'error_increase', 'error_decrease'];

		vscode.window.showQuickPick(
			sounds,
			{
				placeHolder: 'Select a sound to test',
				title: 'Code Speaks - Test Sounds'
			}
		).then(selected => {
			if (selected) {
				playSound(selected);
				vscode.window.showInformationMessage(`🔊 Playing: ${selected}`);
			}
		});
	});

	// Command to toggle extension
	const toggleCommand = vscode.commands.registerCommand('venura.toggle', function () {
		const config = vscode.workspace.getConfiguration('codeSpeak');
		const enabled = config.get('enabled', true);
		const newState = !enabled;

		config.update('enabled', newState, vscode.ConfigurationTarget.Global);
		vscode.window.showInformationMessage(
			`🎵 Code Speaks ${newState ? 'enabled' : 'disabled'}`
		);
	});

	// Command to open sounds folder
	const openSoundsCommand = vscode.commands.registerCommand('venura.openSoundsFolder', function () {
		const soundsPath = path.join(context.extensionPath, 'sounds');
		vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(soundsPath)).then(
			() => {
				vscode.window.showInformationMessage('📁 Sounds folder opened! Add your MP3 files here.');
			},
			(error) => {
				vscode.window.showErrorMessage(`Failed to open sounds folder: ${error}`);
			}
		);
	});

	// Command to check audio files status
	const checkAudioCommand = vscode.commands.registerCommand('venura.checkAudioFiles', function () {
		if (audioPlayer) {
			const summary = audioPlayer.getAudioSummary();
			console.log(summary);
			vscode.window.showInformationMessage('Check output panel for audio file status');
		}
	});

	context.subscriptions.push(testCommand, toggleCommand, openSoundsCommand, checkAudioCommand);

	// Log available audio files on startup
	if (audioPlayer) {
		console.log(audioPlayer.getAudioSummary());
	}
}

function deactivate() {
	console.log('[Code Speaks] 🎵 Extension deactivated!');
}

module.exports = {
	activate,
	deactivate
}