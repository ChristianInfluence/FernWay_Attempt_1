(function(){
  let map;
  let sampleMarker = null;
  let userMarker = null;
  let locationWatchId = null;
  let latestUserPosition = null;
  let hasCenteredOnUser = false;
  let appReady = false;
  let videoNearEnd = false;
  let loadingFadeStarted = false;
  let achievementMarkers = [];
  let activeAchievementCategory = null;

  // Prototype achievement content. Replace with nearby API/database results later.
  const achievementCategories = {
    flames: {
      label: 'Flames',
      accent: '#ff704f',
      progress: 2,
      goal: 5,
      places: [
        ['Trail Steward', 'Help restore or care for a nearby trail.'],
        ['Community Spark', 'Join a local service activity.'],
        ['Campcraft', 'Practice a safe outdoor skill.']
      ]
    },
    palettes: {
      label: 'Palettes',
      accent: '#f2a8ff',
      progress: 1,
      goal: 4,
      places: [
        ['Public Art Hunt', 'Find and document a local work of art.'],
        ['Sketch the Scene', 'Create something inspired by this place.'],
        ['Creative Workshop', 'Take part in a nearby creative activity.']
      ]
    },
    vines: {
      label: 'Vines',
      accent: '#69db83',
      progress: 3,
      goal: 6,
      places: [
        ['Native Plant Watch', 'Identify native plants in the area.'],
        ['Habitat Helper', 'Complete a local nature-care activity.'],
        ['Tree Story', 'Learn the story of a notable nearby tree.']
      ]
    },
    locks: {
      label: 'Locks',
      accent: '#79b7ff',
      progress: 1,
      goal: 5,
      places: [
        ['Hidden History', 'Unlock a story tied to this location.'],
        ['Local Mystery', 'Solve a place-based clue.'],
        ['Knowledge Gate', 'Complete the challenge to reveal a new route.']
      ]
    },
    hammers: {
      label: 'Hammers',
      accent: '#f5b85c',
      progress: 2,
      goal: 4,
      places: [
        ['Build & Repair', 'Practice a useful making or repair skill.'],
        ['Craft Heritage', 'Discover a traditional local craft.'],
        ['Hands-On Helper', 'Contribute to a practical community project.']
      ]
    },
    scales: {
      label: 'Scales',
      accent: '#e8d98c',
      progress: 0,
      goal: 4,
      places: [
        ['Civic Voice', 'Learn how a nearby civic place serves people.'],
        ['Fairness in Action', 'Complete a community-minded challenge.'],
        ['Local Leadership', 'Meet or learn about someone serving the area.']
      ]
    },
    vials: {
      label: 'Vials',
      accent: '#73dfdf',
      progress: 2,
      goal: 6,
      places: [
        ['Field Scientist', 'Make an observation about the local environment.'],
        ['Water Watch', 'Learn about a nearby water system.'],
        ['Citizen Science', 'Contribute a useful local data point.']
      ]
    },
    scrolls: {
      label: 'Scrolls',
      accent: '#c9a9ff',
      progress: 4,
      goal: 7,
      places: [
        ['Living History', 'Discover an event connected to this place.'],
        ['Story Keeper', 'Record a local memory or oral history.'],
        ['Archive Explorer', 'Find a historical detail hidden nearby.']
      ]
    }
  };

  function initializeMap(){
    map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [-122.4194, 37.7749],
      zoom: 12,
      attributionControl: true
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right'
    );

    map.once('load', () => {
      map.addSource('location-accuracy', {
        type: 'geojson',
        data: emptyFeatureCollection()
      });

      map.addLayer({
        id: 'location-accuracy-fill',
        type: 'fill',
        source: 'location-accuracy',
        paint: {
          'fill-color': '#3f9361',
          'fill-opacity': 0.14
        }
      });

      map.addLayer({
        id: 'location-accuracy-line',
        type: 'line',
        source: 'location-accuracy',
        paint: {
          'line-color': '#2f7d50',
          'line-width': 1.5,
          'line-opacity': 0.65
        }
      });

      hideLoading();
      showMenu();
    });

    window.setTimeout(() => {
      hideLoading();
      showMenu();
    }, 4000);

    startLocationTracking();
  }

  function hideLoading(){
    appReady = true;
    finishLoadingWhenReady();
  }

  function markVideoNearEnd(){
    videoNearEnd = true;
    finishLoadingWhenReady();
  }

  function skipLoading(){
    videoNearEnd = true;

    const video = document.getElementById('loadingVideo');
    if(video) video.pause();

    finishLoadingWhenReady();
  }

  function finishLoadingWhenReady(){
    const loading = document.getElementById('loadingOverlay');
    if(!loading || !appReady || !videoNearEnd || loadingFadeStarted) return;

    loadingFadeStarted = true;
    loading.classList.add('isHidden');
    window.setTimeout(() => {
      loading.style.display = 'none';
    }, 800);
  }

  function showMenu(){
    const menu = document.getElementById('menuOverlay');
    if(menu) menu.classList.add('isVisible');
  }

  function toggleSampleOverlay(){
    if(!map) return;
    if(sampleMarker){
      sampleMarker.remove();
      sampleMarker = null;
    } else {
      const markerElement = document.createElement('div');
      markerElement.className = 'savedMarker';
      markerElement.setAttribute('aria-label', 'Saved marker');

      sampleMarker = new maplibregl.Marker({ element: markerElement })
        .setLngLat(map.getCenter())
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText('Saved marker'))
        .addTo(map);
    }
  }

  function setLocationStatus(message, isError = false){
    const status = document.getElementById('locationStatus');
    if(!status) return;

    const statusText = status.querySelector('.statusText');
    if(statusText) statusText.textContent = message;
    status.classList.toggle('locationError', isError);
  }

  function updateUserLocation(position){
    const { latitude, longitude, accuracy } = position.coords;
    const lngLat = [longitude, latitude];

    latestUserPosition = lngLat;

    if(!userMarker){
      const markerElement = document.createElement('div');
      markerElement.className = 'userLocationIcon';
      markerElement.innerHTML = '<span class="locationPulse"></span><span class="locationCore"></span>';
      markerElement.setAttribute('aria-label', 'Your location');

      userMarker = new maplibregl.Marker({
        element: markerElement,
        anchor: 'center'
      })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText('Your location'))
        .addTo(map);
    } else {
      userMarker.setLngLat(lngLat);
    }

    updateAccuracyCircle(longitude, latitude, accuracy);

    if(!hasCenteredOnUser){
      map.easeTo({
        center: lngLat,
        zoom: Math.max(map.getZoom(), 16),
        duration: 900
      });
      hasCenteredOnUser = true;
    }

    setLocationStatus(`Location active · ±${Math.round(accuracy)} m`);
  }

  function handleLocationError(error){
    const messages = {
      1: 'Location permission was denied. Enable it in your browser settings.',
      2: 'Your location is currently unavailable.',
      3: 'Finding your location timed out. Try again.'
    };

    setLocationStatus(messages[error.code] || 'Unable to access your location.', true);
  }

  function startLocationTracking(){
    if(!navigator.geolocation){
      setLocationStatus('This browser does not support location tracking.', true);
      return;
    }

    if(locationWatchId !== null){
      navigator.geolocation.clearWatch(locationWatchId);
    }

    setLocationStatus('Requesting your location…');
    locationWatchId = navigator.geolocation.watchPosition(
      updateUserLocation,
      handleLocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
  }

  function centerOnUserLocation(){
    if(latestUserPosition){
      map.easeTo({
        center: latestUserPosition,
        zoom: Math.max(map.getZoom(), 16),
        duration: 700
      });
      if(activeAchievementCategory){
        window.setTimeout(()=>{
          showAchievementAreas(activeAchievementCategory);
        }, 720);
      }
      return;
    }

    startLocationTracking();
  }

  function closeMenuForMap(){
    const menu = document.getElementById('menuOverlay');
    const radialMenu = menu?.querySelector('.radialMenu');
    const mainSettingsBtn = document.getElementById('mainSettingsBtn');

    if(radialMenu) radialMenu.classList.remove('playerMenuOpen');
    if(mainSettingsBtn){
      document.body.appendChild(mainSettingsBtn);
      mainSettingsBtn.classList.add('isDocked');
      mainSettingsBtn.setAttribute('aria-label', 'Open FernWay controls');
    }

    if(menu) menu.classList.remove('isVisible');
    showAchievementRail();

    window.setTimeout(() => {
      if(map) map.resize();
    }, 250);
  }

  function openRadialMenu(){
    const menu = document.getElementById('menuOverlay');
    const radialMenu = menu?.querySelector('.radialMenu');
    const mainSettingsBtn = document.getElementById('mainSettingsBtn');

    if(!menu || !radialMenu || !mainSettingsBtn) return;

    radialMenu.appendChild(mainSettingsBtn);
    radialMenu.classList.remove('playerMenuOpen');
    mainSettingsBtn.classList.remove('isDocked', 'isActive');
    mainSettingsBtn.setAttribute('aria-label', 'Player and main settings');
    setRadialMessage('Choose your path');
    menu.classList.add('isVisible');
    hideAchievementRail();
    clearAchievementMarkers();
  }

  function setRadialMessage(message){
    const radialMessage = document.getElementById('radialMessage');
    if(radialMessage) radialMessage.textContent = message;
  }

  function openPlayerQuickMenu(){
    const radialMenu = document.querySelector('.radialMenu');
    const mainSettingsBtn = document.getElementById('mainSettingsBtn');
    if(!radialMenu || !mainSettingsBtn) return;

    mainSettingsBtn.classList.add('isActive');
    radialMenu.classList.add('playerMenuOpen');
    setPlayerMenuStatus('Player menu');
  }

  function closePlayerQuickMenu(){
    const radialMenu = document.querySelector('.radialMenu');
    const mainSettingsBtn = document.getElementById('mainSettingsBtn');
    if(radialMenu) radialMenu.classList.remove('playerMenuOpen');
    if(mainSettingsBtn) mainSettingsBtn.classList.remove('isActive');
    setRadialMessage('Choose your path');
  }

  function setPlayerMenuStatus(message){
    const status = document.getElementById('playerMenuStatus');
    if(status) status.textContent = message;
  }

  function buildAchievementRail(){
    const railButtons = document.getElementById('achievementRailButtons');
    if(!railButtons) return;

    railButtons.replaceChildren();

    document.querySelectorAll('.achievementButton').forEach((sourceButton)=>{
      const category = sourceButton.dataset.category;
      const categoryData = achievementCategories[category];
      if(!categoryData) return;

      const button = document.createElement('button');
      button.className = 'achievementRailButton';
      button.type = 'button';
      button.dataset.category = category;
      button.style.setProperty('--accent', categoryData.accent);
      button.setAttribute('aria-label', `Show nearby ${categoryData.label} achievements`);
      button.appendChild(sourceButton.querySelector('svg').cloneNode(true));

      const progress = document.createElement('span');
      progress.className = 'achievementRailProgress';
      progress.textContent = `${categoryData.progress}/${categoryData.goal}`;
      progress.setAttribute('aria-label', `${categoryData.progress} of ${categoryData.goal} badge steps completed`);
      button.appendChild(progress);

      const tooltip = document.createElement('span');
      tooltip.className = 'achievementRailTooltip';
      tooltip.textContent = categoryData.label;
      button.appendChild(tooltip);

      button.addEventListener('click', ()=>{
        showAchievementAreas(category);
      });

      railButtons.appendChild(button);
    });
  }

  function showAchievementRail(){
    const rail = document.getElementById('achievementRail');
    if(rail) rail.classList.add('isVisible');
  }

  function hideAchievementRail(){
    const rail = document.getElementById('achievementRail');
    const card = document.getElementById('achievementMapCard');
    if(rail) rail.classList.remove('isVisible');
    if(card) card.classList.remove('isVisible');
    document.querySelectorAll('.achievementRailButton').forEach((button)=>{
      button.classList.remove('isActive');
    });
    activeAchievementCategory = null;
  }

  function clearAchievementMarkers(){
    achievementMarkers.forEach((marker)=>marker.remove());
    achievementMarkers = [];
  }

  function showAchievementAreas(category){
    const categoryData = achievementCategories[category];
    if(!categoryData || !map) return;

    activeAchievementCategory = category;
    clearAchievementMarkers();

    document.querySelectorAll('.achievementRailButton').forEach((button)=>{
      button.classList.toggle('isActive', button.dataset.category === category);
    });

    const center = latestUserPosition || map.getCenter().toArray();
    const latitudeRadians = center[1] * Math.PI / 180;
    const distances = [260, 420, 570];
    const bearings = [20, 142, 258];

    categoryData.places.forEach((place, index)=>{
      const bearing = bearings[index] * Math.PI / 180;
      const north = Math.cos(bearing) * distances[index];
      const east = Math.sin(bearing) * distances[index];
      const latitude = center[1] + (north / 6371008.8) * (180 / Math.PI);
      const longitude = center[0]
        + (east / (6371008.8 * Math.cos(latitudeRadians))) * (180 / Math.PI);

      const markerElement = document.createElement('button');
      markerElement.className = 'achievementAreaMarker';
      markerElement.type = 'button';
      markerElement.style.setProperty('--accent', categoryData.accent);
      markerElement.setAttribute('aria-label', `${place[0]}: ${place[1]}`);
      markerElement.innerHTML = `<span>${index + 1}</span>`;
      markerElement.addEventListener('click', ()=>{
        showAchievementCard(categoryData, place, index);
      });

      const marker = new maplibregl.Marker({
        element: markerElement,
        anchor: 'center'
      })
        .setLngLat([longitude, latitude])
        .addTo(map);

      achievementMarkers.push(marker);
    });

    showAchievementCard(categoryData, categoryData.places[0], 0);
    map.easeTo({
      center,
      zoom: Math.max(map.getZoom(), 15),
      duration: 650
    });
  }

  function showAchievementCard(categoryData, place, index){
    const card = document.getElementById('achievementMapCard');
    if(!card) return;

    card.style.setProperty('--accent', categoryData.accent);
    document.getElementById('achievementCardEyebrow').textContent = `${categoryData.label} achievement area`;
    document.getElementById('achievementCardTitle').textContent = place[0];
    document.getElementById('achievementCardDescription').textContent = place[1];
    document.getElementById('achievementCardProgressText').textContent =
      `${categoryData.progress} of ${categoryData.goal} badge steps complete · Nearby stop ${index + 1} of ${categoryData.places.length}`;
    card.classList.add('isVisible');
  }

  function emptyFeatureCollection(){
    return {
      type: 'FeatureCollection',
      features: []
    };
  }

  function updateAccuracyCircle(longitude, latitude, radiusMeters){
    const source = map.getSource('location-accuracy');
    if(!source) return;

    const earthRadius = 6371008.8;
    const latitudeRadians = latitude * Math.PI / 180;
    const coordinates = [];
    const steps = 64;

    for(let step = 0; step <= steps; step += 1){
      const bearing = (step / steps) * Math.PI * 2;
      const north = Math.cos(bearing) * radiusMeters;
      const east = Math.sin(bearing) * radiusMeters;
      const pointLatitude = latitude + (north / earthRadius) * (180 / Math.PI);
      const pointLongitude = longitude
        + (east / (earthRadius * Math.cos(latitudeRadians))) * (180 / Math.PI);
      coordinates.push([pointLongitude, pointLatitude]);
    }

    source.setData({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      },
      properties: {}
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const mapLocationBtn = document.getElementById('mapLocationBtn');
    const mapModeBtn = document.getElementById('mapModeBtn');
    const storyModeBtn = document.getElementById('storyModeBtn');
    const mainSettingsBtn = document.getElementById('mainSettingsBtn');
    const playerExitBtn = document.getElementById('playerExitBtn');
    const playerSettingsBtn = document.getElementById('playerSettingsBtn');
    const playerActionButtons = document.querySelectorAll('.playerActionButton');
    const utilityButtons = document.querySelectorAll('.utilityButton');
    const loading = document.getElementById('loadingOverlay');
    const closeAchievementCard = document.getElementById('closeAchievementCard');

    buildAchievementRail();
    if(mapLocationBtn) mapLocationBtn.addEventListener('click', centerOnUserLocation);
    if(mapModeBtn) mapModeBtn.addEventListener('click', closeMenuForMap);
    if(storyModeBtn) storyModeBtn.addEventListener('click', ()=>{
      setRadialMessage('Story mode · artwork and experience to follow');
    });
    if(mainSettingsBtn) mainSettingsBtn.addEventListener('click', ()=>{
      if(mainSettingsBtn.classList.contains('isDocked')){
        openRadialMenu();
        return;
      }

      if(document.querySelector('.radialMenu')?.classList.contains('playerMenuOpen')){
        closePlayerQuickMenu();
        return;
      }

      openPlayerQuickMenu();
    });
    if(playerExitBtn) playerExitBtn.addEventListener('click', closePlayerQuickMenu);
    if(playerSettingsBtn){
      playerSettingsBtn.addEventListener('click', ()=>{
        setPlayerMenuStatus('Settings · preferences and self-care options to follow');
      });
    }
    playerActionButtons.forEach((button)=>{
      button.addEventListener('click', ()=>{
        setPlayerMenuStatus(`${button.dataset.playerAction} · panel to follow`);
      });
    });
    utilityButtons.forEach((button)=>{
      button.addEventListener('click', ()=>{
        setRadialMessage(`${button.dataset.actionLabel} · image and action to follow`);
      });
    });
    if(closeAchievementCard){
      closeAchievementCard.addEventListener('click', ()=>{
        document.getElementById('achievementMapCard')?.classList.remove('isVisible');
      });
    }
    if(loading){
      loading.addEventListener('click', skipLoading);
      loading.addEventListener('keydown', (event)=>{
        if(event.key === 'Enter' || event.key === ' '){
          event.preventDefault();
          skipLoading();
        }
      });
    }

    // Ensure video plays (some browsers require user interaction unless muted)
    const vid = document.getElementById('loadingVideo');
    if(vid){
      vid.playbackRate = 1.35;

      const checkVideoProgress = () => {
        if(
          Number.isFinite(vid.duration)
          && vid.duration > 0
          && vid.currentTime >= Math.max(0, vid.duration - 0.9)
        ){
          markVideoNearEnd();
        }
      };

      vid.addEventListener('loadedmetadata', checkVideoProgress);
      vid.addEventListener('timeupdate', checkVideoProgress);
      vid.addEventListener('ended', markVideoNearEnd);
      vid.addEventListener('error', markVideoNearEnd);
      vid.play().catch(()=>{
        window.setTimeout(markVideoNearEnd, 2200);
      });

      // Safety fallback for browsers that do not report video progress reliably.
      window.setTimeout(markVideoNearEnd, 5000);
    } else {
      markVideoNearEnd();
    }

    initializeMap();
  });

  window.addEventListener('pagehide', ()=>{
    if(locationWatchId !== null && navigator.geolocation){
      navigator.geolocation.clearWatch(locationWatchId);
    }
  });

  // Register service worker if available
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('/service-worker.js').catch(()=>{/* registration failed */});
    });
  }

})();
