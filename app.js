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
  let achievementTasks = [];
  let profileData = {};
  let selectedTaskCategory = null;
  let pendingTaskImage = '';
  let selectedCoordinates = null;
  let coordinateReadoutCoordinates = null;
  let coordinateMarker = null;
  let coordinatePickMode = false;
  let coordinatePickTarget = 'panel';
  let pendingNextLink = null;

  const taskStorageKey = 'fernway-achievement-tasks-v1';
  const profileStorageKey = 'fernway-profile-v1';

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

  function loadLocalData(){
    try {
      achievementTasks = JSON.parse(localStorage.getItem(taskStorageKey) || '[]')
        .map(normalizeAchievementNode);
      profileData = JSON.parse(localStorage.getItem(profileStorageKey) || '{}');
    } catch {
      achievementTasks = [];
      profileData = {};
    }
  }

  function saveAchievementTasks(){
    try {
      localStorage.setItem(taskStorageKey, JSON.stringify(achievementTasks));
      return true;
    } catch {
      return false;
    }
  }

  function saveProfileData(){
    localStorage.setItem(profileStorageKey, JSON.stringify(profileData));
  }

  function createTaskId(){
    return `achievement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeAchievementNode(node){
    return {
      ...node,
      nodeType: node.nodeType === 'branch' ? 'branch' : 'task',
      parentId: node.parentId || '',
      parentLabel: node.parentLabel || node.parent || '',
      approvalRank: node.approvalRank || 'none',
      sectionPoints: Number(node.sectionPoints) || 0,
      subsectionPoints: Number(node.subsectionPoints) || 0,
      unlockType: node.unlockType || 'none',
      unlockTargets: Array.isArray(node.unlockTargets) ? node.unlockTargets : [],
      leadershipOpportunity: Boolean(node.leadershipOpportunity),
      endTask: Boolean(node.endTask),
      nextTaskId: node.nextTaskId || '',
      endLayer: Boolean(node.endLayer),
      nextLayerId: node.nextLayerId || '',
      hidden: Boolean(node.hidden)
    };
  }

  function formatCoordinates(longitude, latitude){
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }

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
      updateCoordinateFromCenter();
    });

    map.on('move', updateCoordinateFromCenter);
    map.on('click', (event)=>{
      if(!coordinatePickMode) return;
      selectMapCoordinates(event.lngLat.lng, event.lngLat.lat);
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
    showCoordinatePanel();

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
    hideCoordinatePanel();
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
  }

  function closePlayerQuickMenu(){
    const radialMenu = document.querySelector('.radialMenu');
    const mainSettingsBtn = document.getElementById('mainSettingsBtn');
    if(radialMenu) radialMenu.classList.remove('playerMenuOpen');
    if(mainSettingsBtn) mainSettingsBtn.classList.remove('isActive');
    setRadialMessage('Choose your path');
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

    const nearbyPlaces = categoryData.places.map((place, index)=>{
      const bearing = bearings[index] * Math.PI / 180;
      const north = Math.cos(bearing) * distances[index];
      const east = Math.sin(bearing) * distances[index];
      const latitude = center[1] + (north / 6371008.8) * (180 / Math.PI);
      const longitude = center[0]
        + (east / (6371008.8 * Math.cos(latitudeRadians))) * (180 / Math.PI);

      return {
        title: place[0],
        description: place[1],
        longitude,
        latitude,
        isCustom: false
      };
    });

    const customPlaces = achievementTasks
      .filter((task)=>{
        return task.nodeType === 'task'
          && !task.hidden
          && task.category === category
          && task.isMapItem
          && Number.isFinite(task.latitude)
          && Number.isFinite(task.longitude);
      })
      .map((task)=>({
        title: task.title,
        description: task.description,
        longitude: task.longitude,
        latitude: task.latitude,
        image: task.image,
        isCustom: true
      }));

    const allPlaces = [...nearbyPlaces, ...customPlaces];

    allPlaces.forEach((place, index)=>{
      const markerElement = document.createElement('button');
      markerElement.className = 'achievementAreaMarker';
      if(place.isCustom) markerElement.classList.add('isCustom');
      markerElement.type = 'button';
      markerElement.style.setProperty('--accent', categoryData.accent);
      markerElement.setAttribute('aria-label', `${place.title}: ${place.description}`);
      markerElement.innerHTML = `<span>${place.isCustom ? '◆' : index + 1}</span>`;
      markerElement.addEventListener('click', ()=>{
        showAchievementCard(categoryData, place, index, allPlaces.length);
      });

      const marker = new maplibregl.Marker({
        element: markerElement,
        anchor: 'center'
      })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);

      achievementMarkers.push(marker);
    });

    if(allPlaces.length){
      showAchievementCard(categoryData, allPlaces[0], 0, allPlaces.length);
    }
    map.easeTo({
      center,
      zoom: Math.max(map.getZoom(), 15),
      duration: 650
    });
  }

  function showAchievementCard(categoryData, place, index, totalPlaces){
    const card = document.getElementById('achievementMapCard');
    if(!card) return;

    card.style.setProperty('--accent', categoryData.accent);
    document.getElementById('achievementCardEyebrow').textContent = `${categoryData.label} achievement area`;
    document.getElementById('achievementCardTitle').textContent = place.title;
    document.getElementById('achievementCardDescription').textContent = place.description;
    document.getElementById('achievementCardProgressText').textContent =
      `${categoryData.progress} of ${categoryData.goal} badge steps complete · ${place.isCustom ? 'Custom map achievement' : `Nearby stop ${index + 1} of ${totalPlaces}`}`;
    card.classList.add('isVisible');
  }

  function showCoordinatePanel(){
    const panel = document.getElementById('coordinatePanel');
    if(!panel) return;
    panel.classList.add('isVisible');
    updateCoordinateFromCenter();
  }

  function hideCoordinatePanel(){
    document.getElementById('coordinatePanel')?.classList.remove('isVisible');
    cancelCoordinatePicking();
  }

  function updateCoordinateFromCenter(){
    if(!map || selectedCoordinates || coordinatePickMode) return;
    const center = map.getCenter();
    updateCoordinateReadout(center.lng, center.lat, 'Map center', true);
  }

  function updateCoordinateReadout(longitude, latitude, label, canCopy = true){
    coordinateReadoutCoordinates = { longitude, latitude };
    document.getElementById('coordinateModeLabel').textContent = label;
    document.getElementById('coordinateValue').textContent = formatCoordinates(longitude, latitude);
    document.getElementById('copyCoordinateBtn').disabled = !canCopy;
  }

  function startCoordinatePicking(target = 'panel'){
    if(!map) return;
    coordinatePickMode = true;
    coordinatePickTarget = target;
    document.body.classList.add('coordinatePicking');
    document.getElementById('coordinatePanel')?.classList.add('isVisible', 'isPicking');
    document.getElementById('pickCoordinateBtn').textContent = 'Cancel picking';
    document.getElementById('coordinateModeLabel').textContent = 'Pick a location';
    document.getElementById('coordinateStatus').textContent = 'Click anywhere on the map to capture coordinates.';

    if(target === 'task'){
      closeSettingsWorkspace();
    }
  }

  function cancelCoordinatePicking(){
    coordinatePickMode = false;
    coordinatePickTarget = 'panel';
    document.body.classList.remove('coordinatePicking');
    document.getElementById('coordinatePanel')?.classList.remove('isPicking');
    document.getElementById('pickCoordinateBtn').textContent = 'Pick on map';
    document.getElementById('coordinateStatus').textContent =
      selectedCoordinates ? 'Coordinates selected. Copy or pick another location.' : 'Click “Pick on map,” then choose a location.';
  }

  function selectMapCoordinates(longitude, latitude){
    selectedCoordinates = { longitude, latitude };
    updateCoordinateReadout(longitude, latitude, 'Selected point', true);
    document.getElementById('coordinateStatus').textContent = 'Coordinates selected. Copy or pick another location.';

    if(!coordinateMarker){
      const markerElement = document.createElement('div');
      markerElement.className = 'coordinateMarker';
      markerElement.innerHTML = '<span>⌖</span>';
      coordinateMarker = new maplibregl.Marker({
        element: markerElement,
        anchor: 'center'
      });
    }
    coordinateMarker.setLngLat([longitude, latitude]).addTo(map);

    if(coordinatePickTarget === 'task'){
      document.getElementById('taskLatitude').value = latitude.toFixed(6);
      document.getElementById('taskLongitude').value = longitude.toFixed(6);
      openSettingsWorkspace('task-editor');
      document.getElementById('taskSaveStatus').textContent = 'Map coordinates selected.';
    }

    cancelCoordinatePicking();
  }

  async function copySelectedCoordinates(){
    if(!coordinateReadoutCoordinates) return;
    const text = formatCoordinates(
      coordinateReadoutCoordinates.longitude,
      coordinateReadoutCoordinates.latitude
    );

    try {
      await navigator.clipboard.writeText(text);
      document.getElementById('coordinateStatus').textContent = 'Coordinates copied to clipboard.';
    } catch {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
      document.getElementById('coordinateStatus').textContent = 'Coordinates copied to clipboard.';
    }
  }

  function openSettingsWorkspace(view = 'profile'){
    const workspace = document.getElementById('settingsWorkspace');
    if(!workspace) return;

    populateProfileForm();
    renderTaskLibrary();
    renderTaskCategoryGrid();
    showSettingsView(view);
    workspace.classList.add('isVisible');
    workspace.setAttribute('aria-hidden', 'false');
  }

  function closeSettingsWorkspace(){
    const workspace = document.getElementById('settingsWorkspace');
    if(!workspace) return;
    workspace.classList.remove('isVisible');
    workspace.setAttribute('aria-hidden', 'true');
  }

  function showSettingsView(view){
    document.querySelectorAll('.settingsView').forEach((panel)=>{
      panel.classList.toggle('isActive', panel.dataset.settingsPanel === view);
    });
    document.querySelectorAll('.settingsTab').forEach((tab)=>{
      tab.classList.toggle('isActive', tab.dataset.settingsView === view);
    });
  }

  function populateProfileForm(){
    document.getElementById('profileDisplayName').value = profileData.displayName || '';
    document.getElementById('profileClan').value = profileData.clan || '';
    document.getElementById('profileBio').value = profileData.bio || '';
    document.getElementById('profileRegion').value = profileData.region || '';
    document.getElementById('profileTitle').value = profileData.title || '';
  }

  function renderTaskCategoryGrid(){
    const grid = document.getElementById('taskCategoryGrid');
    if(!grid) return;

    grid.replaceChildren();
    Object.entries(achievementCategories).forEach(([category, categoryData])=>{
      const sourceButton = document.querySelector(`.achievementButton[data-category="${category}"]`);
      const button = document.createElement('button');
      button.className = 'taskCategoryCard';
      button.type = 'button';
      button.dataset.category = category;
      button.style.setProperty('--accent', categoryData.accent);
      if(sourceButton) button.appendChild(sourceButton.querySelector('svg').cloneNode(true));

      const text = document.createElement('span');
      text.innerHTML = `<strong>${categoryData.label}</strong><small>${achievementTasks.filter((task)=>task.category === category).length} branches and tasks</small>`;
      button.appendChild(text);
      button.addEventListener('click', ()=>{
        selectedTaskCategory = category;
        renderTaskTree(category);
        showSettingsView('task-tree');
      });
      grid.appendChild(button);
    });
  }

  function renderTaskLibrary(){
    const library = document.getElementById('taskLibrary');
    if(!library) return;

    library.replaceChildren();
    if(!achievementTasks.length){
      const empty = document.createElement('div');
      empty.className = 'taskEmptyState';
      empty.innerHTML = '<strong>No custom achievements yet</strong><p>Add a task to grow your first branch.</p>';
      library.appendChild(empty);
      return;
    }

    achievementTasks
      .slice()
      .sort((a, b)=>b.updatedAt - a.updatedAt)
      .forEach((task)=>{
        const categoryData = achievementCategories[task.category];
        const card = document.createElement('article');
        card.className = 'taskLibraryCard';
        card.style.setProperty('--accent', categoryData?.accent || '#74d6a0');

        const visual = document.createElement('div');
        visual.className = 'taskLibraryImage';
        if(task.image){
          const image = document.createElement('img');
          image.src = task.image;
          image.alt = '';
          visual.appendChild(image);
        } else {
          visual.textContent = '◆';
        }

        const content = document.createElement('div');
        content.className = 'taskLibraryContent';
        content.innerHTML = `
          <p>${categoryData?.label || task.category} · ${task.nodeType === 'branch' ? 'Branch' : 'Task'}${task.isMapItem ? ' · Map item' : ''}${task.hidden ? ' · Hidden' : ''}</p>
          <h4>${escapeHtml(task.title)}</h4>
          <span>${escapeHtml(task.description)}</span>
        `;

        const edit = document.createElement('button');
        edit.className = 'taskEditButton';
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', ()=>openTaskEditor(task));

        card.append(visual, content, edit);
        library.appendChild(card);
      });
  }

  function renderTaskTree(category){
    const tree = document.getElementById('taskTree');
    const categoryData = achievementCategories[category];
    if(!tree || !categoryData) return;

    document.getElementById('taskTreeTitle').textContent = `${categoryData.label} achievement tree`;
    tree.replaceChildren();

    const seedLeaves = categoryData.places.map((place, index)=>({
      id: `seed-${category}-${index}`,
      title: place[0],
      description: place[1],
      category,
      nodeType: 'task',
      parentId: '',
      isSeed: true
    }));
    const customNodes = achievementTasks.filter((task)=>task.category === category);
    const allNodes = [...seedLeaves, ...customNodes];
    const nodeById = new Map(allNodes.map((node)=>[node.id, node]));
    const childrenByParent = new Map();

    customNodes.forEach((node)=>{
      const parentId = node.parentId && nodeById.has(node.parentId) ? node.parentId : '';
      const children = childrenByParent.get(parentId) || [];
      children.push(node);
      childrenByParent.set(parentId, children);
    });

    const roots = [
      ...seedLeaves,
      ...(childrenByParent.get('') || [])
    ];

    roots.forEach((node)=>{
      tree.appendChild(createTaskTreeNode(node, 0, childrenByParent, categoryData));
    });
  }

  function createTaskTreeNode(node, depth, childrenByParent, categoryData){
    const wrapper = document.createElement('div');
    wrapper.className = 'taskTreeNode';
    wrapper.style.setProperty('--tree-depth', depth);

    const item = document.createElement('article');
    item.className = `taskTreeLeaf is${node.nodeType === 'branch' ? 'Branch' : 'Task'}`;
    if(node.hidden) item.classList.add('isHiddenLeaf');
    item.style.setProperty('--accent', categoryData.accent);

    const visual = document.createElement('div');
    visual.className = 'taskTreeLeafVisual';
    if(node.image){
      const image = document.createElement('img');
      image.src = node.image;
      image.alt = '';
      visual.appendChild(image);
    } else {
      visual.textContent = node.nodeType === 'branch' ? '⑂' : '◆';
    }

    const content = document.createElement('div');
    content.className = 'taskTreeLeafContent';
    const badges = [
      node.nodeType === 'branch' ? 'Branch' : 'Task',
      node.hidden ? 'Hidden' : '',
      node.nodeType === 'task' && node.unlockTargets?.length ? `Unlocks ${node.unlockTargets.length}` : ''
    ].filter(Boolean).map((badge)=>`<em>${escapeHtml(badge)}</em>`).join('');
    content.innerHTML = `
      <div class="taskTreeBadges">${badges}</div>
      <strong>${escapeHtml(node.title)}</strong>
      <span>${escapeHtml(node.description)}</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'taskTreeLeafActions';

    const addTask = document.createElement('button');
    addTask.className = 'taskLeafAddButton';
    addTask.type = 'button';
    addTask.title = 'Add task leaf';
    addTask.setAttribute('aria-label', `Add a task under ${node.title}`);
    addTask.textContent = '+ Leaf';
    addTask.addEventListener('click', ()=>{
      openTaskEditor(null, node.category, node, 'task');
    });

    const addBranch = document.createElement('button');
    addBranch.className = 'taskBranchAddButton';
    addBranch.type = 'button';
    addBranch.title = 'Add sub-branch';
    addBranch.setAttribute('aria-label', `Add a branch under ${node.title}`);
    addBranch.textContent = '+ Branch';
    addBranch.addEventListener('click', ()=>{
      openTaskEditor(null, node.category, node, 'branch');
    });

    actions.append(addTask, addBranch);

    if(!node.isSeed){
      const edit = document.createElement('button');
      edit.className = 'taskLeafEditButton';
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', ()=>openTaskEditor(node));
      actions.appendChild(edit);
    }

    item.append(visual, content, actions);
    wrapper.appendChild(item);

    const children = childrenByParent.get(node.id) || [];
    if(children.length){
      const childContainer = document.createElement('div');
      childContainer.className = 'taskTreeChildren';
      children
        .sort((a, b)=>(a.nodeType === b.nodeType ? a.title.localeCompare(b.title) : a.nodeType === 'branch' ? -1 : 1))
        .forEach((child)=>{
          childContainer.appendChild(
            createTaskTreeNode(child, depth + 1, childrenByParent, categoryData)
          );
        });
      wrapper.appendChild(childContainer);
    }

    return wrapper;
  }

  function openTaskEditor(
    task = null,
    category = selectedTaskCategory,
    parentNode = null,
    nodeType = 'task',
    preserveNextLink = false
  ){
    const categoryData = achievementCategories[task?.category || category];
    if(!categoryData) return;

    selectedTaskCategory = task?.category || category;
    if(!preserveNextLink) pendingNextLink = null;
    pendingTaskImage = task?.image || '';
    const resolvedType = task?.nodeType || nodeType;
    const resolvedParentId = task?.parentId || parentNode?.id || '';
    const resolvedParentLabel = task?.parentLabel || parentNode?.title || '';

    document.getElementById('taskEditorHeading').textContent =
      task
        ? `Edit ${resolvedType === 'branch' ? 'branch' : 'task'}`
        : `Add ${resolvedType === 'branch' ? 'branch' : 'task leaf'}`;
    document.getElementById('taskId').value = task?.id || '';
    document.getElementById('taskParent').value = resolvedParentId;
    document.getElementById('taskParentName').value = resolvedParentLabel;
    document.getElementById('taskCategory').value = selectedTaskCategory;
    document.getElementById('taskNodeType').value = resolvedType;
    document.getElementById('taskTitle').value = task?.title || '';
    document.getElementById('taskDescription').value = task?.description || '';
    document.getElementById('taskImage').value = '';
    document.getElementById('taskIsMapItem').checked = Boolean(task?.isMapItem);
    document.getElementById('taskLatitude').value = Number.isFinite(task?.latitude) ? task.latitude : '';
    document.getElementById('taskLongitude').value = Number.isFinite(task?.longitude) ? task.longitude : '';
    document.getElementById('deleteTaskBtn').hidden = !task;
    document.getElementById('taskNodeTypeBadge').textContent =
      resolvedType === 'branch' ? 'Branch / layer' : 'Task leaf';
    document.getElementById('taskParentLabel').textContent =
      resolvedParentLabel ? `Inside “${resolvedParentLabel}”` : 'Root of section';
    document.getElementById('taskSaveStatus').textContent = '';

    document.querySelectorAll('.taskOnlyField').forEach((field)=>{
      field.hidden = resolvedType === 'branch';
    });
    populateProgressionFields(task);

    updateTaskImagePreview();
    if(resolvedType === 'task') toggleTaskCoordinates();
    showSettingsView('task-editor');
  }

  function populateProgressionFields(task){
    const currentId = task?.id || '';
    const categoryNodes = achievementTasks.filter((node)=>{
      return node.category === selectedTaskCategory && node.id !== currentId;
    });
    const taskNodes = categoryNodes.filter((node)=>node.nodeType === 'task');
    const branchNodes = categoryNodes.filter((node)=>node.nodeType === 'branch');

    populateNodeSelect(
      document.getElementById('taskNextTask'),
      taskNodes,
      task?.nextTaskId ? [task.nextTaskId] : [],
      false,
      'None'
    );
    populateNodeSelect(
      document.getElementById('taskNextLayer'),
      branchNodes,
      task?.nextLayerId ? [task.nextLayerId] : [],
      false,
      'None'
    );

    document.getElementById('taskApprovalRank').value = task?.approvalRank || 'none';
    document.getElementById('taskSectionPoints').value = task?.sectionPoints || 0;
    document.getElementById('taskSubsectionPoints').value = task?.subsectionPoints || 0;
    document.getElementById('taskUnlockType').value = task?.unlockType || 'none';
    document.getElementById('taskLeadershipOpportunity').checked = Boolean(task?.leadershipOpportunity);
    document.getElementById('taskEndTask').checked = Boolean(task?.endTask);
    document.getElementById('taskEndLayer').checked = Boolean(task?.endLayer);

    const hiddenValue = task?.hidden ? 'yes' : 'no';
    document.querySelectorAll('input[name="taskHidden"]').forEach((radio)=>{
      radio.checked = radio.value === hiddenValue;
    });
    refreshUnlockTargetOptions(task?.unlockTargets || []);
    toggleProgressionEnds();
  }

  function populateNodeSelect(select, nodes, selectedIds, multiple, emptyLabel = ''){
    if(!select) return;
    select.replaceChildren();

    if(!multiple){
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = emptyLabel;
      select.appendChild(empty);
    }

    nodes.forEach((node)=>{
      const option = document.createElement('option');
      option.value = node.id;
      option.textContent = `${node.nodeType === 'branch' ? 'Branch' : 'Task'} · ${node.title}`;
      option.selected = selectedIds.includes(node.id);
      select.appendChild(option);
    });
  }

  function toggleUnlockTargets(){
    const unlockType = document.getElementById('taskUnlockType').value;
    const field = document.getElementById('taskUnlockTargetsField');
    field.hidden = unlockType === 'none';
  }

  function refreshUnlockTargetOptions(selectedIds = []){
    const type = document.getElementById('taskUnlockType').value;
    const select = document.getElementById('taskUnlockTargets');
    let options = [];

    if(type === 'nodes'){
      options = achievementTasks
        .filter((node)=>node.id !== document.getElementById('taskId').value)
        .map((node)=>({
          id: node.id,
          title: `${achievementCategories[node.category]?.label || node.category} · ${node.nodeType === 'branch' ? 'Branch' : 'Task'} · ${node.title}`
        }));
    } else if(type === 'section'){
      options = [
        ...Object.entries(achievementCategories).map(([id, data])=>({
          id: `section:${id}`,
          title: `Section · ${data.label}`
        })),
        ...achievementTasks
          .filter((node)=>node.nodeType === 'branch')
          .map((node)=>({
            id: node.id,
            title: `Subsection · ${node.title}`
          }))
      ];
    } else if(type === 'sub-app'){
      options = [
        ['subapp:map', 'Map'],
        ['subapp:story', 'Story mode'],
        ['subapp:inventory', 'Inventory'],
        ['subapp:messages', 'Messages'],
        ['subapp:self-care', 'Self-Care'],
        ['subapp:rank-clan', 'Rank / Clan']
      ].map(([id, title])=>({ id, title: `Sub app · ${title}` }));
    } else if(type === 'leadership'){
      options = [
        ['leadership:guide', 'Guide opportunity'],
        ['leadership:mentor', 'Mentor opportunity'],
        ['leadership:section-leader', 'Section leader opportunity'],
        ['leadership:clan-leader', 'Clan leader opportunity']
      ].map(([id, title])=>({ id, title }));
    }

    select.replaceChildren();
    options.forEach((item)=>{
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.title;
      option.selected = selectedIds.includes(item.id);
      select.appendChild(option);
    });
    toggleUnlockTargets();
  }

  function beginNextNodeCreation(type){
    const sourceId = document.getElementById('taskId').value;
    if(!sourceId){
      document.getElementById('taskSaveStatus').textContent =
        'Save this task before creating its next item.';
      return;
    }

    pendingNextLink = { sourceId, type };
    const parentId = document.getElementById('taskParent').value;
    const parentTitle = document.getElementById('taskParentName').value;
    const parentNode = parentId ? { id: parentId, title: parentTitle } : null;
    openTaskEditor(
      null,
      selectedTaskCategory,
      parentNode,
      type === 'layer' ? 'branch' : 'task',
      true
    );
    document.getElementById('taskSaveStatus').textContent =
      type === 'layer'
        ? 'Saving this branch will link it as the next layer.'
        : 'Saving this task will link it as the next task.';
  }

  function toggleProgressionEnds(){
    const endTask = document.getElementById('taskEndTask').checked;
    const endLayer = document.getElementById('taskEndLayer').checked;
    document.getElementById('taskNextTask').disabled = endTask;
    document.getElementById('createNextTaskBtn').disabled = endTask;
    document.getElementById('taskNextLayer').disabled = endLayer;
    document.getElementById('createNextLayerBtn').disabled = endLayer;
  }

  function updateTaskImagePreview(){
    const preview = document.getElementById('taskImagePreview');
    if(!preview) return;
    preview.replaceChildren();

    if(pendingTaskImage){
      const image = document.createElement('img');
      image.src = pendingTaskImage;
      image.alt = 'Achievement image preview';
      preview.appendChild(image);
    } else {
      const placeholder = document.createElement('span');
      placeholder.textContent = 'Leaf image preview';
      preview.appendChild(placeholder);
    }
  }

  function toggleTaskCoordinates(){
    const enabled = document.getElementById('taskIsMapItem').checked;
    const coordinates = document.getElementById('taskCoordinates');
    coordinates.hidden = !enabled;
    document.getElementById('taskLatitude').required = enabled;
    document.getElementById('taskLongitude').required = enabled;
  }

  function saveTaskFromEditor(event){
    event.preventDefault();
    const id = document.getElementById('taskId').value;
    const nodeType = document.getElementById('taskNodeType').value;
    const isMapItem = nodeType === 'task' && document.getElementById('taskIsMapItem').checked;
    const latitude = Number(document.getElementById('taskLatitude').value);
    const longitude = Number(document.getElementById('taskLongitude').value);
    const parentId = document.getElementById('taskParent').value;
    const parentNode = achievementTasks.find((node)=>node.id === parentId);
    const unlockTargets = [...document.getElementById('taskUnlockTargets').selectedOptions]
      .map((option)=>option.value);

    const task = {
      id: id || createTaskId(),
      nodeType,
      category: document.getElementById('taskCategory').value,
      parentId,
      parentLabel: parentNode?.title || document.getElementById('taskParentName').value,
      title: document.getElementById('taskTitle').value.trim(),
      description: document.getElementById('taskDescription').value.trim(),
      image: pendingTaskImage,
      isMapItem,
      latitude: isMapItem ? latitude : null,
      longitude: isMapItem ? longitude : null,
      approvalRank: nodeType === 'task' ? document.getElementById('taskApprovalRank').value : 'none',
      sectionPoints: nodeType === 'task' ? Math.max(0, Number(document.getElementById('taskSectionPoints').value) || 0) : 0,
      subsectionPoints: nodeType === 'task' ? Math.max(0, Number(document.getElementById('taskSubsectionPoints').value) || 0) : 0,
      unlockType: nodeType === 'task' ? document.getElementById('taskUnlockType').value : 'none',
      unlockTargets: nodeType === 'task' ? unlockTargets : [],
      leadershipOpportunity: nodeType === 'task' && document.getElementById('taskLeadershipOpportunity').checked,
      endTask: nodeType === 'task' && document.getElementById('taskEndTask').checked,
      nextTaskId: nodeType === 'task' ? document.getElementById('taskNextTask').value : '',
      endLayer: nodeType === 'task' && document.getElementById('taskEndLayer').checked,
      nextLayerId: nodeType === 'task' ? document.getElementById('taskNextLayer').value : '',
      hidden: nodeType === 'task'
        && document.querySelector('input[name="taskHidden"]:checked')?.value === 'yes',
      updatedAt: Date.now()
    };

    if(isMapItem && (!Number.isFinite(latitude) || !Number.isFinite(longitude))){
      document.getElementById('taskSaveStatus').textContent = 'Add valid map coordinates.';
      return;
    }

    const existingIndex = achievementTasks.findIndex((item)=>item.id === task.id);
    if(existingIndex >= 0){
      achievementTasks[existingIndex] = task;
    } else {
      achievementTasks.push(task);
    }

    if(pendingNextLink){
      const source = achievementTasks.find((item)=>item.id === pendingNextLink.sourceId);
      if(source){
        if(pendingNextLink.type === 'task') source.nextTaskId = task.id;
        if(pendingNextLink.type === 'layer') source.nextLayerId = task.id;
        source.updatedAt = Date.now();
      }
      pendingNextLink = null;
    }

    if(!saveAchievementTasks()){
      document.getElementById('taskSaveStatus').textContent =
        'Could not save locally. Try a smaller image.';
      return;
    }
    renderTaskLibrary();
    renderTaskCategoryGrid();
    buildAchievementRail();
    document.getElementById('taskSaveStatus').textContent =
      nodeType === 'branch' ? 'Branch saved.' : 'Task saved.';
    window.setTimeout(()=>showSettingsView('tasks'), 500);

    if(activeAchievementCategory === task.category){
      showAchievementAreas(task.category);
    }
  }

  function deleteCurrentTask(){
    const id = document.getElementById('taskId').value;
    if(!id) return;
    if(!window.confirm('Delete this achievement? This cannot be undone.')) return;

    const deletedTask = achievementTasks.find((task)=>task.id === id);
    const idsToDelete = new Set([id]);
    let foundChildren = true;
    while(foundChildren){
      foundChildren = false;
      achievementTasks.forEach((node)=>{
        if(idsToDelete.has(node.parentId) && !idsToDelete.has(node.id)){
          idsToDelete.add(node.id);
          foundChildren = true;
        }
      });
    }

    achievementTasks = achievementTasks
      .filter((task)=>!idsToDelete.has(task.id))
      .map((task)=>({
        ...task,
        unlockTargets: task.unlockTargets.filter((targetId)=>!idsToDelete.has(targetId)),
        nextTaskId: idsToDelete.has(task.nextTaskId) ? '' : task.nextTaskId,
        nextLayerId: idsToDelete.has(task.nextLayerId) ? '' : task.nextLayerId
      }));
    saveAchievementTasks();
    renderTaskLibrary();
    renderTaskCategoryGrid();
    buildAchievementRail();
    showSettingsView('tasks');

    if(deletedTask && activeAchievementCategory === deletedTask.category){
      showAchievementAreas(deletedTask.category);
    }
  }

  function readTaskImage(file){
    if(!file) return;
    const status = document.getElementById('taskSaveStatus');
    if(file.size > 2 * 1024 * 1024){
      status.textContent = 'Please use an image smaller than 2 MB.';
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', ()=>{
      pendingTaskImage = reader.result;
      updateTaskImagePreview();
      status.textContent = '';
    });
    reader.readAsDataURL(file);
  }

  function escapeHtml(value = ''){
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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
    const pickCoordinateBtn = document.getElementById('pickCoordinateBtn');
    const copyCoordinateBtn = document.getElementById('copyCoordinateBtn');

    loadLocalData();
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
        openSettingsWorkspace('profile');
      });
    }
    playerActionButtons.forEach((button)=>{
      button.addEventListener('click', ()=>{
        setRadialMessage(`${button.dataset.playerAction} · panel to follow`);
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
    if(pickCoordinateBtn){
      pickCoordinateBtn.addEventListener('click', ()=>{
        if(coordinatePickMode){
          cancelCoordinatePicking();
        } else {
          startCoordinatePicking('panel');
        }
      });
    }
    if(copyCoordinateBtn) copyCoordinateBtn.addEventListener('click', copySelectedCoordinates);

    document.getElementById('closeSettingsWorkspace')?.addEventListener('click', closeSettingsWorkspace);
    document.getElementById('settingsWorkspace')?.addEventListener('click', (event)=>{
      if(event.target.id === 'settingsWorkspace') closeSettingsWorkspace();
    });
    document.querySelectorAll('.settingsTab').forEach((tab)=>{
      tab.addEventListener('click', ()=>showSettingsView(tab.dataset.settingsView));
    });
    document.querySelectorAll('[data-settings-back]').forEach((button)=>{
      button.addEventListener('click', ()=>{
        const view = button.dataset.settingsBack;
        if(view === 'task-tree' && selectedTaskCategory){
          renderTaskTree(selectedTaskCategory);
        }
        showSettingsView(view);
      });
    });
    document.getElementById('startAddTaskBtn')?.addEventListener('click', ()=>{
      renderTaskCategoryGrid();
      showSettingsView('task-category');
    });
    document.getElementById('addBlankTaskBtn')?.addEventListener('click', ()=>{
      openTaskEditor(null, selectedTaskCategory, null, 'task');
    });
    document.getElementById('addBlankBranchBtn')?.addEventListener('click', ()=>{
      openTaskEditor(null, selectedTaskCategory, null, 'branch');
    });
    document.getElementById('profileForm')?.addEventListener('submit', (event)=>{
      event.preventDefault();
      profileData = {
        displayName: document.getElementById('profileDisplayName').value.trim(),
        clan: document.getElementById('profileClan').value.trim(),
        bio: document.getElementById('profileBio').value.trim(),
        region: document.getElementById('profileRegion').value.trim(),
        title: document.getElementById('profileTitle').value.trim()
      };
      saveProfileData();
      const status = document.getElementById('profileSaveStatus');
      status.textContent = 'Profile saved.';
      window.setTimeout(()=>{ status.textContent = ''; }, 1800);
    });
    document.getElementById('taskEditorForm')?.addEventListener('submit', saveTaskFromEditor);
    document.getElementById('deleteTaskBtn')?.addEventListener('click', deleteCurrentTask);
    document.getElementById('taskImage')?.addEventListener('change', (event)=>{
      readTaskImage(event.target.files?.[0]);
    });
    document.getElementById('taskIsMapItem')?.addEventListener('change', toggleTaskCoordinates);
    document.getElementById('taskUnlockType')?.addEventListener('change', ()=>{
      refreshUnlockTargetOptions([]);
    });
    document.getElementById('createNextTaskBtn')?.addEventListener('click', ()=>{
      beginNextNodeCreation('task');
    });
    document.getElementById('createNextLayerBtn')?.addEventListener('click', ()=>{
      beginNextNodeCreation('layer');
    });
    document.getElementById('taskEndTask')?.addEventListener('change', toggleProgressionEnds);
    document.getElementById('taskEndLayer')?.addEventListener('change', toggleProgressionEnds);
    document.getElementById('useCurrentMapCenter')?.addEventListener('click', ()=>{
      const center = map?.getCenter();
      if(!center) return;
      document.getElementById('taskLatitude').value = center.lat.toFixed(6);
      document.getElementById('taskLongitude').value = center.lng.toFixed(6);
    });
    document.getElementById('pickTaskCoordinates')?.addEventListener('click', ()=>{
      startCoordinatePicking('task');
    });
    document.addEventListener('keydown', (event)=>{
      if(event.key === 'Escape' && document.getElementById('settingsWorkspace')?.classList.contains('isVisible')){
        closeSettingsWorkspace();
      }
    });

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
