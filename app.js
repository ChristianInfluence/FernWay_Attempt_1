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
      return;
    }

    startLocationTracking();
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
    const toggleBtn = document.getElementById('toggleOverlayBtn');
    const centerLocationBtn = document.getElementById('centerLocationBtn');
    const mapLocationBtn = document.getElementById('mapLocationBtn');
    const closeBtn = document.getElementById('closeMenuBtn');
    const menu = document.getElementById('menuOverlay');
    const loading = document.getElementById('loadingOverlay');

    if(toggleBtn) toggleBtn.addEventListener('click', toggleSampleOverlay);
    if(centerLocationBtn) centerLocationBtn.addEventListener('click', centerOnUserLocation);
    if(mapLocationBtn) mapLocationBtn.addEventListener('click', centerOnUserLocation);
    if(closeBtn) closeBtn.addEventListener('click', ()=>{ if(menu) menu.classList.remove('isVisible') });
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
