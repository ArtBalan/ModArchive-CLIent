"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribe = subscribe;
exports.getState = getState;
exports.playModule = playModule;
exports.addToQueue = addToQueue;
exports.playQueue = playQueue;
exports.togglePlayPause = togglePlayPause;
exports.nextTrack = nextTrack;
exports.prevTrack = prevTrack;
exports.setVolume = setVolume;
exports.getCurrentTrack = getCurrentTrack;
const initialState = {
    queue: [],
    currentIndex: -1,
    status: 'stopped',
    progress: 0,
    volume: 70,
};
let state = { ...initialState };
let progressInterval = null;
let listeners = [];
function notify() {
    listeners.forEach(l => l({ ...state, queue: [...state.queue] }));
}
function subscribe(fn) {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
}
function getState() {
    return { ...state, queue: [...state.queue] };
}
function startProgress() {
    if (progressInterval)
        clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        if (state.status === 'playing') {
            state.progress = Math.min(100, state.progress + 0.5);
            if (state.progress >= 100) {
                nextTrack();
            }
            else {
                notify();
            }
        }
    }, 200);
}
function stopProgress() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}
function playModule(mod) {
    const existingIdx = state.queue.findIndex(m => m.id === mod.id);
    if (existingIdx >= 0) {
        state.currentIndex = existingIdx;
    }
    else {
        state.queue = [mod, ...state.queue.filter(m => m.id !== mod.id)];
        state.currentIndex = 0;
    }
    state.status = 'playing';
    state.progress = 0;
    startProgress();
    notify();
}
function addToQueue(mod) {
    if (!state.queue.find(m => m.id === mod.id)) {
        state.queue = [...state.queue, mod];
        notify();
    }
}
function playQueue(modules, startIndex = 0) {
    state.queue = [...modules];
    state.currentIndex = startIndex;
    state.status = 'playing';
    state.progress = 0;
    startProgress();
    notify();
}
function togglePlayPause() {
    if (state.status === 'stopped')
        return;
    if (state.status === 'playing') {
        state.status = 'paused';
        stopProgress();
    }
    else {
        state.status = 'playing';
        startProgress();
    }
    notify();
}
function nextTrack() {
    if (state.queue.length === 0)
        return;
    state.currentIndex = (state.currentIndex + 1) % state.queue.length;
    state.status = 'playing';
    state.progress = 0;
    startProgress();
    notify();
}
function prevTrack() {
    if (state.queue.length === 0)
        return;
    if (state.progress > 10) {
        state.progress = 0;
    }
    else {
        state.currentIndex = state.currentIndex <= 0 ? state.queue.length - 1 : state.currentIndex - 1;
        state.progress = 0;
    }
    state.status = 'playing';
    startProgress();
    notify();
}
function setVolume(vol) {
    state.volume = Math.max(0, Math.min(100, vol));
    notify();
}
function getCurrentTrack() {
    if (state.currentIndex < 0 || state.currentIndex >= state.queue.length)
        return null;
    return state.queue[state.currentIndex];
}
