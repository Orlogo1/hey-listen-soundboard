const playButton = document.querySelector('#playButton');
const audioPicker = document.querySelector('#audioPicker');
const audioPlayer = document.querySelector('#audioPlayer');
const soundSelect = document.querySelector('#soundSelect');
const removeLocalButton = document.querySelector('#removeLocalButton');
const status = document.querySelector('#status');
const installButton = document.querySelector('#installButton');

const DB_NAME = 'pocket-fairy-audio';
const STORE_NAME = 'clips';
const FALLBACK_SOUNDS = [{ id: 'hey-listen', label: 'Hey! Listen!', src: './assets/hey-listen.wav' }];
let nativeSounds = FALLBACK_SOUNDS;
let localSounds = [];
let soundMode = 'native:hey-listen';
let selectedName = '';
let objectUrl = null;
let installPrompt = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveClip(file) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const record = { id, blob: file, name: file.name };
  transaction.objectStore(STORE_NAME).put(record, `local:${id}`);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(record);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadClips() {
  const db = await openDatabase();
  const store = db.transaction(STORE_NAME).objectStore(STORE_NAME);
  const recordsRequest = store.getAll();
  const keysRequest = store.getAllKeys();
  return new Promise((resolve, reject) => {
    recordsRequest.onsuccess = () => {
      if (keysRequest.readyState !== 'done') return;
      resolve(recordsRequest.result.map((record, index) => ({
        ...record,
        id: record.id || String(keysRequest.result[index]).replace(/^local:/, ''),
        storageKey: keysRequest.result[index]
      })).filter((record) => record.blob));
    };
    keysRequest.onsuccess = () => {
      if (recordsRequest.readyState !== 'done') return;
      resolve(recordsRequest.result.map((record, index) => ({
        ...record,
        id: record.id || String(keysRequest.result[index]).replace(/^local:/, ''),
        storageKey: keysRequest.result[index]
      })).filter((record) => record.blob));
    };
    recordsRequest.onerror = () => reject(recordsRequest.error);
    keysRequest.onerror = () => reject(keysRequest.error);
  });
}

async function removeClip(record) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).delete(record.storageKey || `local:${record.id}`);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadSoundCatalog() {
  try {
    const response = await fetch('./sounds.json');
    if (!response.ok) throw new Error('Sound catalog unavailable');
    const catalog = await response.json();
    if (Array.isArray(catalog.sounds) && catalog.sounds.length) nativeSounds = catalog.sounds;
  } catch {
    nativeSounds = FALLBACK_SOUNDS;
  }
}

function populateSoundSelect() {
  soundSelect.replaceChildren();
  nativeSounds.forEach((sound) => {
    const option = document.createElement('option');
    option.value = `native:${sound.id}`;
    option.textContent = `${sound.label} — built in`;
    soundSelect.append(option);
  });

  const demoOption = document.createElement('option');
  demoOption.value = 'demo';
  demoOption.textContent = 'Demo chime';
  soundSelect.append(demoOption);

  localSounds.forEach((sound) => {
    const customOption = document.createElement('option');
    customOption.value = `local:${sound.id}`;
    customOption.textContent = `${sound.name || 'Local audio'} — offline`;
    soundSelect.append(customOption);
  });

  if ([...soundSelect.options].some((option) => option.value === soundMode)) soundSelect.value = soundMode;
  removeLocalButton.hidden = !soundMode.startsWith('local:');
}

function clearObjectUrl() {
  if (!objectUrl) return;
  URL.revokeObjectURL(objectUrl);
  objectUrl = null;
}

function useNativeClip(soundId, { remember = true } = {}) {
  const sound = nativeSounds.find((item) => item.id === soundId) || nativeSounds[0];
  if (!sound) return useDemoChime({ remember });
  clearObjectUrl();
  soundMode = `native:${sound.id}`;
  selectedName = sound.label;
  audioPlayer.src = sound.src;
  status.textContent = `Ready: ${sound.label}`;
  if (remember) localStorage.setItem('pocket-fairy-mode', soundMode);
  populateSoundSelect();
}

function useDemoChime({ remember = true } = {}) {
  clearObjectUrl();
  soundMode = 'demo';
  selectedName = '';
  audioPlayer.removeAttribute('src');
  audioPlayer.load();
  status.textContent = 'Ready with a demo chime';
  if (remember) localStorage.setItem('pocket-fairy-mode', soundMode);
  populateSoundSelect();
}

function useLocalClip(record, { remember = true } = {}) {
  clearObjectUrl();
  soundMode = `local:${record.id}`;
  selectedName = record.name || 'Local audio';
  objectUrl = URL.createObjectURL(record.blob);
  audioPlayer.src = objectUrl;
  status.textContent = `Ready offline: ${selectedName}`;
  if (remember) localStorage.setItem('pocket-fairy-mode', soundMode);
  populateSoundSelect();
}

function playDemoChime() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, context.currentTime);
  master.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.025);
  master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.72);
  master.connect(context.destination);

  [783.99, 1174.66].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.72 : 0.45;
    oscillator.connect(gain).connect(master);
    oscillator.start(context.currentTime + index * 0.09);
    oscillator.stop(context.currentTime + 0.75);
  });
  status.textContent = 'Demo chime — choose your audio below';
}

async function playSound() {
  playButton.classList.remove('playing');
  void playButton.offsetWidth;
  playButton.classList.add('playing');
  if (navigator.vibrate) navigator.vibrate(28);

  if (soundMode !== 'demo') {
    audioPlayer.currentTime = 0;
    try {
      await audioPlayer.play();
      status.textContent = `Playing ${selectedName}`;
    } catch {
      status.textContent = 'Tap again to allow sound';
    }
  } else {
    playDemoChime();
  }
}

playButton.addEventListener('click', playSound);
playButton.addEventListener('animationend', () => playButton.classList.remove('playing'));

audioPicker.addEventListener('change', async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  const validFiles = files.filter((file) =>
    (file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg)$/i.test(file.name)) && file.size <= 15 * 1024 * 1024
  );
  if (!validFiles.length) {
    status.textContent = 'Choose audio files under 15 MB each';
    return;
  }
  try {
    const added = await Promise.all(validFiles.map(saveClip));
    localSounds.push(...added);
    useLocalClip(added[0]);
    status.textContent = added.length === 1
      ? `Saved offline: ${added[0].name}`
      : `Saved ${added.length} sounds offline`;
  } catch {
    status.textContent = 'This browser could not save the local audio';
  }
  audioPicker.value = '';
});

soundSelect.addEventListener('change', () => {
  if (soundSelect.value === 'demo') return useDemoChime();
  if (soundSelect.value.startsWith('local:')) {
    const localSound = localSounds.find((sound) => `local:${sound.id}` === soundSelect.value);
    if (localSound) return useLocalClip(localSound);
  }
  if (soundSelect.value.startsWith('native:')) return useNativeClip(soundSelect.value.slice(7));
});

removeLocalButton.addEventListener('click', async () => {
  if (!soundMode.startsWith('local:')) return;
  const record = localSounds.find((sound) => `local:${sound.id}` === soundMode);
  if (!record) return;
  try {
    await removeClip(record);
    localSounds = localSounds.filter((sound) => sound !== record);
    useNativeClip('hey-listen');
    status.textContent = `Removed ${record.name || 'local audio'}`;
  } catch {
    status.textContent = 'Could not remove that local sound';
  }
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    status.textContent = 'Open your browser menu and choose “Install app” or “Add to Home Screen”.';
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  status.textContent = 'Added to your home screen';
  installButton.hidden = true;
});

const rememberedMode = localStorage.getItem('pocket-fairy-mode');
Promise.all([loadSoundCatalog(), loadClips().catch(() => [])])
  .then(([, saved]) => {
    localSounds = saved;
    populateSoundSelect();
    const rememberedLocal = localSounds.find((sound) => `local:${sound.id}` === rememberedMode)
      || (rememberedMode === 'custom' ? localSounds[0] : null);
    if (rememberedLocal) {
      useLocalClip(rememberedLocal, { remember: false });
    } else if (rememberedMode === 'demo') {
      useDemoChime({ remember: false });
    } else {
      const nativeId = rememberedMode?.startsWith('native:') ? rememberedMode.slice(7) : 'hey-listen';
      useNativeClip(nativeId, { remember: false });
    }
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
