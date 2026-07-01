import { initialLocals } from '../data/seed';

const BASE_KEY = 'livelocal-v6-state';
const defaultState = { requests: [], locals: initialLocals, activeLocalId: 'local-marc', messages: {} };

function keyFor(userId){ return userId ? `${BASE_KEY}-${userId}` : BASE_KEY; }

export function loadState(userId){
  try { return JSON.parse(localStorage.getItem(keyFor(userId))) || defaultState; }
  catch { return defaultState; }
}

export function saveState(state, userId){
  localStorage.setItem(keyFor(userId), JSON.stringify(state));
}

export function resetState(userId){
  localStorage.removeItem(keyFor(userId));
  return defaultState;
}

export function storageKeyFor(userId){ return keyFor(userId); }
export function uid(prefix='id'){ return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2,8)}`; }
