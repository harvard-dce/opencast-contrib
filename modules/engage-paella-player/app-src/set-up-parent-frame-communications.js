/**
 * Legacy appraiser code, originally developed for gov21 integration, borrowed
 * for generalized Paella embed API integration.
 * TODO: consider refactoring all of this.
 * @author HUDCE
 */

 const createParentFrameListener = require('./create-parent-frame-listener');
 const createParentFrameAppriser = require('./create-parent-frame-appriser');
 const pathExists = require('object-path-exists');
 const seekMethodPath = ['player', 'videoContainer', 'seekToTime'];
 const pauseMethodPath = ['player', 'pause'];
 const playMethodPath = ['player', 'play'];
 
 /**
  * Helper to check if path is exists on paella object
  * @param {array} path - array of the path to check
  * @returns true if path exists, false otherwise
  */
 const paellaPathExists = (path) => {
   return (
     typeof paella !== "undefined"
       && pathExists(paella, seekMethodPath)
   );
 }
 /**
  * Prepare the listener, wait for paella load to prep the appraiser
  * @param {object} document - document element to listen to
  */
 function setUpParentFrameCommunications(document) {
   // Listener can be loaded before paella object is fully initiated
   // Listener is not reliant on paella object existing
   // and needs to be loaded early to initiate lazy load player from Paella v6.4.x+
   // Ok to load listener before player is loaded, "play" loads lazy load player
   createParentFrameListener({
     playResponder: playVideos,
     pauseResponder: pauseVideos,
     seekResponder: seekWhenPaellaIsReady,
   });
   // Gov21 Appraiser loads after loadComplete
   // The iFrame APi plugin loads with the lazy load player
   $(document).on('paella:loadComplete', () => {
     // #DCE OPC-552 UPV Paella 6.4.3 lazyLoad loadComplete doesn't necessarily load player, yet
     // wait until player loaded loadComplete event
     // The "paella.player" path always exists after a loadComplete
     if (!paella.player.videoContainer) {
       // The "paella.player.videoContainer" doesn't exist
       // when the loadComplete was because of a lazyLoad
       // So, wait until second videoContainer loadComplete event
       return;
     }
     $(document).off('paella:loadComplete', setUpParentFrameCommunications);
     createParentFrameAppriser({
       videoElement: document.querySelector('#' + paella.player.videoContainer.video1Id)
     });
   });
 }
 
 /**
  * Alerts wrapper APi that request could not be executed
  * because paella or the player was not found or not yet initiated.
  */
 function sendPaellaMissingErrorToEmbedApi() {
   var errorMessage = {
     sender: window.name, // This equates to the iframe name
     name: 'paella:error',
     value: 'cannot execute request, paella is not found',
 
   };
   window.parent.postMessage(errorMessage, '*');
 }
 
 /**
  * The call to play the videos
  * @return {(Promise|undefined)} the play promise or nothing if it's lazy load
  */
 function playVideos() {
   // Check if Paella player lazy Load requires activation
   const lazyLoad = document.getElementById('lazyLoadThumbnailContainer');
   if (lazyLoad) {
     // This is a Paella specific call to initialize the player to load
     // the videos and if it can auto play, to try auto play them.
     // The lazyLoad would only be true the first time the player loads.
     lazyLoad.click();
   } else if (paellaPathExists(playMethodPath)) {
     // A promise that triggers the play event
     return paella.player.play();
   } else {
     // Player is not in lazy load state or loaded, so return an error
     sendPaellaMissingErrorToEmbedApi();
   }
 }
 
 /**
  * The call to pause the videos
  * @return {(Promise || undefined)} the pause promise or nothing if it's lazy load
  */
 function pauseVideos() {
   const lazyLoad = document.getElementById('lazyLoadThumbnailContainer');
   if (paellaPathExists(pauseMethodPath)) {
     // A promise that triggers the pause event
     paella.player.pause();
   } else if (!lazyLoad) {
     // Player is not paused in lazy load, so return an error
     sendPaellaMissingErrorToEmbedApi();
   }
 }
 
 /**
  * The call to seek in the videos when player has loaded
  * @param {number} sec -  the number of seconds to seek to in the video
  */
 function seekWhenPaellaIsReady(sec) {
  seek();
 
  function seek() {
    if (paellaPathExists(seekMethodPath)) {
      $(document).off('paella:loadComplete', seek);
      // Seek after one promise buffer cycle
      paella.player.videoContainer.currentTime().then(function () {
        paella.player.videoContainer.seekToTime(sec);
      });
    }
    else {
      $(document).on('paella:loadComplete', seek);
    }
  }
 }
 
 module.exports = setUpParentFrameCommunications;
 
