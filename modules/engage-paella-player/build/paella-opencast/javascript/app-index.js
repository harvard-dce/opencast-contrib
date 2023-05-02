(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * The following is Function for Gov21 implementation
 * The DCE API appraiser is implemented by the
 * edu.harvard.dce.paella.iFrameApiAppraiser DCE extension plugin
 * @author HUDCE
 * @param {object} opts - options including video element
 */
function createParentFrameAppriser(opts = {}) {
  let videoElement = opts.videoElement;

  // Bind for gov21 API
  if (videoElement && window.parent !== window) {
    videoElement.addEventListener('timeupdate', (event) => {
      this.sendTimeToParent(event);
    });
  }

  /**
   * Backwards compatibility for legacy gov21 implementation
   * @param {object} event - the player event
   */
  sendTimeToParent = (event) => {
    const updateMessage = {
      sender: 'dce-player',
      name: 'timeupdate',
      value: event.target.currentTime,
    };
    window.parent.postMessage(updateMessage, '*');
  }
}

module.exports = createParentFrameAppriser;

},{}],2:[function(require,module,exports){
/**
 * This Listener contains DCE Paella API support for
 * player "ready" message and listener for requests for play, pause, seek.
 * All other messages are sent to APi from the Paella plugin appraiser APi.
 * This also has backwards compatibility for legacy gov2001 iFramed player.
 * @author HUDCE
 */

// Known APIs, to help track integrations
const KNOWN_PARENTS = [
  'gov2001',
  'dce-player-embed-api',
];

// Requests to the player from the parent
const PAELLA_TRIGGER = {
  PLAY: 'play',
  PAUSE: 'pause',
  SEEK: 'seek',
};

// API onError codes
const ERROR_CODES = {
  INVALID_PARAM: 2,
  PLAYER_ERROR: 5,
  VIDEO_NOT_FOUND: 100,
  EMBED_FORBIDDEN: 101,
}

/**
 * Initialize listener for gov21 and "ready" for API
 * @param {object} opts - option parameters
 */
function createParentFrameListener(opts = {}) {
  const responder = {};

  // Set response functions
  responder.playResponder = opts.playResponder || (() => {});
  responder.pauseResponder = opts.pauseResponder || (() => {});
  responder.seekResponder = opts.seekResponder || (() => {});

  if (window.parent !== window) {
    // Set up message listener
    window.addEventListener('message', receiveMessage, false);

    // Gov21: Post message that the player is ready to receive calls
    const readyMessage = {
      sender: 'dce-player',
      name: 'ready',
    };
    window.parent.postMessage(readyMessage, '*');

    // Embed API: Post message that the player is ready to receive calls
    sendMessageToParentApi('ready');
  }

  /**
   * Message sender for Paella embed API
   * @param {string} name - the event name
   */
  function sendMessageToParentApi(name) {
    // Embed API: Post message that the player is ready to receive calls
    const message = {
      sender: window.name, // the unique name of the embedded dce player iframe
      name,
    };
    window.parent.postMessage(message, '*');
  }

  /**
   * Message receiver for gov21 implementation
   * @param {object} event - the message from gov21
   */
  function receiveMessage(event) {
    // Filter out unwanted messages
    if (
      !event
      || !event.data
      || !event.data.sender
      || KNOWN_PARENTS.indexOf(String(event.data.sender)) === -1
    ) {
      return;
    }
    try {
      // respond to the request
      switch (String(event.data.name)) {
        case PAELLA_TRIGGER.PLAY:
          responder.playResponder();
          break;
        case PAELLA_TRIGGER.PAUSE:
          responder.pauseResponder();
          break;
        case PAELLA_TRIGGER.SEEK:
          const value = Number.parseInt(String(event.data.value));
          responder.seekResponder(value);
          break;
        default:
          console.log('Unknown request', String(event.data.name));
      }
    } catch (e) {
      return sendMessageToParentApi('error', ERROR_CODES.INVALID_PARAM);
    }
  }
}

module.exports = createParentFrameListener;

},{}],3:[function(require,module,exports){
var initPlayerRouter = require('./player-router/index');
var pathExists = require('object-path-exists');
var setUpParentFrameCommunications = require('./set-up-parent-frame-communications');

var seekMethodPath = ['player', 'videoContainer', 'seekToTime'];

var router = initPlayerRouter({
  seeking: {
    seekParamName: 't',
    seekResponder: seekWhenPaellaIsReady
  }
});

function seekWhenPaellaIsReady(startTime, endTime) {
  seek();

  function seek() {
    if (typeof paella !== "undefined" && pathExists(paella, seekMethodPath)) {
      $(document).off('paella:loadComplete', seek);
      paella.player.videoContainer.currentTime().then(function () {
        paella.player.videoContainer.seekToTime(startTime);
      });
    }
    else {
      $(document).on('paella:loadComplete', seek);
    }
  }
}

function clearDoneUrlCookie() {
  document.cookie = 'done_url=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ' +
    'domain=.harvard.edu; path=/';
}

((function go() {
  setUpParentFrameCommunications(document);
  clearDoneUrlCookie();
  router.route();
})());

},{"./player-router/index":4,"./set-up-parent-frame-communications":5,"object-path-exists":6}],4:[function(require,module,exports){
function initPlayerRouter(opts) {
  var seekParamName;
  var seekResponder;

  if (opts) {
    if (opts.seeking) {
      seekParamName = opts.seeking.seekParamName;
      seekResponder = opts.seeking.seekResponder;
    }
  }

  window.onhashchange = route;

  function route() {
    var segments = window.location.hash.slice(1).split('/');
    if (segments.length > 0) {
      var lastSegment = segments[segments.length - 1];
      var paramAndValue = lastSegment.split('=');

      if (paramAndValue.length === 2 && paramAndValue[0] === seekParamName) {
        var rangeValue = parseRangeValue(paramAndValue[1]);
        if (rangeValue.length > 0) {
          seekResponder.apply(seekResponder, rangeValue);
        }
      }
    }

    // If more traditional routing was needed, this is where we would pass the
    // hash off to Director or another routing module.
  }

  return {
    route: route
  };
}

function parseRangeValue(s) {
  var value = [];
  var startAndEnd = s.split('-');
  if (startAndEnd.length > 0) {
    var start = parseInt(startAndEnd[0], 10);
    if (!isNaN(start)) {
      value.push(start);

      if (startAndEnd.length > 1) {
        var end = parseInt(startAndEnd[1], 10);
        if (!isNaN(end) && end > start) {
          value.push(end);
        }
      }
    }
  }
  return value;
}

module.exports = initPlayerRouter;

},{}],5:[function(require,module,exports){
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
 

},{"./create-parent-frame-appriser":1,"./create-parent-frame-listener":2,"object-path-exists":6}],6:[function(require,module,exports){
function pathExists(object, path) {
  var current = object;
  return path.every(segmentExists, true);
  
  function segmentExists(segment) {
    current = current[segment];
    return current;
  }
}

module.exports = pathExists;

},{}]},{},[3]);
