(function(){
  /*
    app.js
    - Initializes Google Maps via the global `initMap` callback required by the Maps JS API
    - Manages the loading video overlay and the main menu overlay
    - Provides a simple toggleable sample overlay (marker) to demonstrate overlay controls
  */
  // `map` will hold the Google Maps instance once initialized
  let map;
  // `sampleMarker` is a simple overlay (marker) we can add/remove for demo purposes
  let sampleMarker = null;

  // Expose `initMap` globally because the Maps API calls it by name when ready
  window.initMap = function(){
    // Default center coordinates (San Francisco) for the initial map view
    const center = {lat: 37.7749, lng: -122.4194};

    // Create the map inside the `#map` element
    map = new google.maps.Map(document.getElementById('map'), {
      center,        // starting center
      zoom: 12,      // starting zoom level
      mapTypeId: 'roadmap' // map style
    });

    // Once map tiles are loaded we can hide the loading screen and show the main menu
    map.addListener('tilesloaded', () => {
      hideLoading();
      showMenu();
    });
  };

  // Hide the fullscreen loading overlay by setting display to 'none'
  function hideLoading(){
    const loading = document.getElementById('loadingOverlay');
    if(loading) loading.style.display = 'none';
  }

  // Show the main menu overlay by setting display to 'flex'
  function showMenu(){
    const menu = document.getElementById('menuOverlay');
    if(menu) menu.style.display = 'flex';
  }

  // Toggle a sample marker overlay at the map center; removes it if present
  function toggleSampleOverlay(){
    if(!map) return; // guard if map isn't ready yet
    if(sampleMarker){
      // Remove existing marker from the map
      sampleMarker.setMap(null);
      sampleMarker = null;
    } else {
      // Create a new marker at the current center of the map
      sampleMarker = new google.maps.Marker({
        position: map.getCenter(),
        map,
        title: 'Sample Overlay'
      });
    }
  }

  // Wire up UI interactions after DOM is ready
  document.addEventListener('DOMContentLoaded', ()=>{
    const toggleBtn = document.getElementById('toggleOverlayBtn');
    const closeBtn = document.getElementById('closeMenuBtn');
    const menu = document.getElementById('menuOverlay');

    // Attach click handlers if buttons exist
    if(toggleBtn) toggleBtn.addEventListener('click', toggleSampleOverlay);
    if(closeBtn) closeBtn.addEventListener('click', ()=>{ if(menu) menu.style.display='none' });

    // Try to play the loading video; many browsers allow muted autoplay
    const vid = document.getElementById('loadingVideo');
    if(vid){
      vid.play().catch(()=>{
        // If autoplay is blocked, ignore — the video is muted and will usually play
      });
    }
  });

  // Register service worker for basic offline caching if supported
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('/service-worker.js').catch(()=>{
        // Registration failed — we ignore here, but in production log/report error
      });
    });
  }

})();
(function(){
  let map;
  let sampleMarker = null;

  // Expose initMap globally for the Google Maps callback
  window.initMap = function(){
    const center = {lat: 37.7749, lng: -122.4194};
    map = new google.maps.Map(document.getElementById('map'), {
      center,
      zoom: 12,
      mapTypeId: 'roadmap'
    });

    // When tiles loaded, hide loading overlay and show menu
    map.addListener('tilesloaded', () => {
      hideLoading();
      showMenu();
    });
  };

  function hideLoading(){
    const loading = document.getElementById('loadingOverlay');
    if(loading) loading.style.display = 'none';
  }

  function showMenu(){
    const menu = document.getElementById('menuOverlay');
    if(menu) menu.style.display = 'flex';
  }

  function toggleSampleOverlay(){
    if(!map) return;
    if(sampleMarker){
      sampleMarker.setMap(null);
      sampleMarker = null;
    } else {
      sampleMarker = new google.maps.Marker({
        position: map.getCenter(),
        map,
        title: 'Sample Overlay'
      });
    }
  }

  // Wire UI buttons
  document.addEventListener('DOMContentLoaded', ()=>{
    const toggleBtn = document.getElementById('toggleOverlayBtn');
    const closeBtn = document.getElementById('closeMenuBtn');
    const menu = document.getElementById('menuOverlay');

    if(toggleBtn) toggleBtn.addEventListener('click', toggleSampleOverlay);
    if(closeBtn) closeBtn.addEventListener('click', ()=>{ if(menu) menu.style.display='none' });

    // Ensure video plays (some browsers require user interaction unless muted)
    const vid = document.getElementById('loadingVideo');
    if(vid){
      vid.play().catch(()=>{/* ignore autoplay block; video is muted so should play */});
    }
  });

  // Register service worker if available
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('/service-worker.js').catch(()=>{/* registration failed */});
    });
  }

})();
