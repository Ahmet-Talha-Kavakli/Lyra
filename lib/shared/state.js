// lib/state.js — Global in-memory state extracted from server.js

// --- DUYGU DURUMU TAKİBİ ---
export const userEmotions = new Map(); // userId -> { gecmis, trend, dominant_duygu, ... }

// --- SEANS TRANSCRIPT STORE ---
export const sessionTranscriptStore = new Map();
// userId → { fullTranscript, silenceDuration, lastSegment, updatedAt }

// --- AKTİF OTURUM ---
export let activeSessionUserId = null;
export let activeSessionId = null;

export function setActiveSessionUserId(val) { activeSessionUserId = val; }
export function setActiveSessionId(val) { activeSessionId = val; }
