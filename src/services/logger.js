// services/logger.js
const fs = require('fs');
const path = require('path');

const LOG_ROOT = path.resolve(process.cwd(), 'logs');
const LEVELS = ['trace', 'warn', 'err', 'upload', 'download'];

// Ensure folder structure exists
function ensureLogDirs() {
    if (!fs.existsSync(LOG_ROOT)) {
        fs.mkdirSync(LOG_ROOT, { recursive: true });
    }
    LEVELS.forEach(level => {
        const dir = path.join(LOG_ROOT, level);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// Append message to a file in the right log folder
function appendToFile(level, message) {
    const fileName = new Date().toISOString().slice(0, 10) + '.log'; // YYYY-MM-DD.log
    const filePath = path.join(LOG_ROOT, level, fileName);
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;

    try {
        fs.appendFileSync(filePath, line, 'utf8');
    } catch (err) {
        console.error(`[LOGGER][ERR] Failed to write log file: ${err.message}`);
    }
}

function trace(...args) {
    console.log('[STREAM][TRACE]', ...args);
    appendToFile('trace', args.map(a => formatArg(a)).join(' '));
}

function warn(...args) {
    console.warn('[STREAM][WARN]', ...args);
    appendToFile('warn', args.map(a => formatArg(a)).join(' '));
}

function err(...args) {
    console.error('[STREAM][ERR ]', ...args);
    appendToFile('err', args.map(a => formatArg(a)).join(' '));
}

// Pretty-format objects
function formatArg(arg) {
    if (typeof arg === 'object') {
        try {
            return JSON.stringify(arg);
        } catch {
            return '[Unserializable Object]';
        }
    }
    return String(arg);
}

function makeLogger(level, consoleMethod = console.log) {
    return (...args) => {
        consoleMethod(`[STREAM][${level.toUpperCase()}]`, ...args);
        appendToFile(level, args.map(formatArg).join(' '));
    };
}

// Init log directories on load
ensureLogDirs();

module.exports = {
    trace: makeLogger('trace', console.log),
    warn: makeLogger('warn', console.warn),
    err: makeLogger('err', console.error),
    upload: makeLogger('upload', console.log),
    download: makeLogger('download', console.log),
};