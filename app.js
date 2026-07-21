// app.js
import { siteData } from './catalog.js';

// --- ESTADO LOCAL & CONFIGURAÇÕES ---
let profiles = JSON.parse(localStorage.getItem('user_profiles')) || [
  { id: 'default', name: 'Perfil 1', avatar: 'https://via.placeholder.com/150/000000/FFFFFF?text=P1' }
];
let activeProfileId = localStorage.getItem('active_profile_id') || profiles[0].id;
let editingProfileId = null;

// --- GERENCIAMENTO DE PERFIS ---
const profilesList = document.getElementById('profiles-list');
const addProfileBtn = document.getElementById('add-profile-btn');
const fileInput = document.getElementById('file-input');

function saveProfiles() {
  localStorage.setItem('user_profiles', JSON.stringify(profiles));
  localStorage.setItem('active_profile_id', activeProfileId);
}

function renderProfiles() {
  profilesList.innerHTML = '';
  profiles.forEach(p => {
    const card = document.createElement('div');
    card.className = `profile-card ${p.id === activeProfileId ? 'active' : ''}`;
    card.onclick = () => selectProfile(p.id);

    card.innerHTML = `
      <div class="profile-avatar-wrapper">
        <img class="profile-avatar" src="${p.avatar}" alt="${p.name}">
        <div class="edit-pencil" id="pencil-${p.id}">✏️</div>
      </div>
      <span class="profile-name">${p.name}</span>
    `;
    profilesList.appendChild(card);

    document.getElementById(`pencil-${p.id}`).onclick = (e) => triggerAvatarUpload(e, p.id);
  });
}

function selectProfile(id) {
  activeProfileId = id;
  saveProfiles();
  renderProfiles();
  renderContent();
}

addProfileBtn.onclick = () => {
  const name = prompt('Nome do novo perfil:');
  if (name) {
    const newProfile = {
      id: 'p_' + Date.now(),
      name: name,
      avatar: 'https://via.placeholder.com/150/000000/FFFFFF?text=' + encodeURIComponent(name[0])
    };
    profiles.push(newProfile);
    activeProfileId = newProfile.id;
    saveProfiles();
    renderProfiles();
    renderContent();
  }
};

function triggerAvatarUpload(event, profileId) {
  event.stopPropagation();
  editingProfileId = profileId;
  fileInput.click();
}

fileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file && editingProfileId) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const profile = profiles.find(p => p.id === editingProfileId);
      if (profile) {
        profile.avatar = evt.target.result;
        saveProfiles();
        renderProfiles();
      }
    };
    reader.readAsDataURL(file);
  }
};

// --- SALVAMENTO E PROGRESSO ---
function getProfileProgress() {
  const key = `progress_${activeProfileId}`;
  return JSON.parse(localStorage.getItem(key)) || {};
}

function saveEpisodeProgress(epId, currentTime, duration) {
  if (!epId || !duration) return;
  const key = `progress_${activeProfileId}`;
  const progressData = JSON.parse(localStorage.getItem(key)) || {};

  progressData[epId] = {
    time: currentTime,
    duration: duration,
    percentage: (currentTime / duration) * 100
  };

  localStorage.setItem(key, JSON.stringify(progressData));
  renderContent();
}

function extractYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// --- MONTAGEM DA INTERFACE ---
function renderContent() {
  const seriesGrid = document.getElementById('series-grid');
  const fandubsGrid = document.getElementById('fandubs-grid');
  
  seriesGrid.innerHTML = '';
  fandubsGrid.innerHTML = '';

  const progressData = getProfileProgress();

  siteData.series.forEach(s => {
    s.episodes.forEach(ep => {
      seriesGrid.appendChild(createCard(ep, progressData));
    });
  });

  siteData.fandubs.forEach(f => {
    f.episodes.forEach(ep => {
      fandubsGrid.appendChild(createCard(ep, progressData));
    });
  });
}

function createCard(ep, progressData) {
  const card = document.createElement('div');
  card.className = 'card';

  const epProgress = progressData[ep.id] ? progressData[ep.id].percentage : 0;

  const cardHTML = `
    <div class="thumb-wrapper">
      <img src="${ep.thumb}" alt="${ep.title}">
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${epProgress}%;"></div>
      </div>
    </div>
    <div class="card-content">
      <div class="card-title">${ep.title}</div>
      <div class="card-desc">${ep.desc}</div>
      <div class="audios-container" id="audios-${ep.id}"></div>
    </div>
  `;

  card.innerHTML = cardHTML;

  const audiosContainer = card.querySelector(`#audios-${ep.id}`);
  ep.audios.forEach(audio => {
    const btn = document.createElement('button');
    btn.className = 'audio-btn';
    btn.innerText = `▶ ${audio.label}`;
    btn.onclick = () => openPlayer(ep.id, audio.url);
    audiosContainer.appendChild(btn);
  });

  return card;
}

// --- PLAYER E AUTO-SAVE A CADA 10 SEGUNDOS ---
let player = null;
let autoSaveInterval = null;
let currentPlayingEpId = null;

function openPlayer(epId, videoUrl) {
  const youtubeId = extractYouTubeId(videoUrl);
  if (!youtubeId) return;

  currentPlayingEpId = epId;
  const modal = document.getElementById('video-modal');
  modal.style.display = 'flex';

  const progressData = getProfileProgress();
  const savedTime = progressData[epId] ? progressData[epId].time : 0;

  if (player && typeof player.loadVideoById === 'function') {
    player.loadVideoById({ videoId: youtubeId, startSeconds: savedTime });
  } else {
    player = new YT.Player('youtube-player-container', {
      videoId: youtubeId,
      playerVars: { 'autoplay': 1, 'start': Math.floor(savedTime) },
      events: { 'onStateChange': onPlayerStateChange }
    });
  }

  startAutoSave();
}

function startAutoSave() {
  clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => {
    if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();
      if (currentTime > 0) {
        saveEpisodeProgress(currentPlayingEpId, currentTime, duration);
      }
    }
  }, 10000); // 10 Segundos
}

function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
    saveEpisodeProgress(currentPlayingEpId, player.getCurrentTime(), player.getDuration());
  }
}

function closeModal() {
  const modal = document.getElementById('video-modal');
  modal.style.display = 'none';

  if (player && typeof player.getCurrentTime === 'function') {
    saveEpisodeProgress(currentPlayingEpId, player.getCurrentTime(), player.getDuration());
    player.stopVideo();
  }

  stopAutoSave();
  currentPlayingEpId = null;
}

document.getElementById('modal-close').onclick = closeModal;

// Inicialização
renderProfiles();
renderContent();
