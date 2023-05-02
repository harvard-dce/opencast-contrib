/**
 * Licensed to The Apereo Foundation under one or more contributor license
 * agreements. See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 *
 * The Apereo Foundation licenses this file to you under the Educational
 * Community License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License
 * at:
 *
 *   http://opensource.org/licenses/ecl2.txt
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
 * License for the specific language governing permissions and limitations under
 * the License.
 *
 */
/**
 * iFrameEmbedApi - v0.0.1 - 2021-08-06
 * Based on YouTube iFrame API
 * This applies a portion of the YouTube APi for embedded videos
 * To support standard driver calls to both players.
 * ref: https://developers.google.com/youtube/iframe_api_reference
 */

// Create Namespace
window.HudcePaellaPlayer = window.HudcePaellaPlayer || {};

// Define class specific constants
window.HudcePaellaPlayer.CONSTANTS = {
  // This iFrame prefix is used by the dce-paella-extensions
  // iFrameApiApraiser plugin, change in both places.
  IFRAME_NAME_PREFIX: 'DCE-iframe-API',
  // Requests to the player - the API message name
  PAELLA_TRIGGER: {
    PLAY: 'play',
    PAUSE: 'pause',
    SEEK: 'seek',
  },
  // Paella player subscription events
  PAELLA_EVENT: {
    PLAY: 'paella:play',
    PAUSE: 'paella:pause',
    SEEKED: 'paella:seeked',
    TIMEUPDATE: 'paella:timeupdate',
    ERROR: 'paella:error',
    ENDED: 'paella:ended',
    // Special event When player is auth resolved (or public)
    AUTH_READY: 'onAuthReady',
    // The following events happen too early and too late
    IGNORE_API_READY: 'ready',
    IGNORE_VIDEO_READY: 'paella:videoReady',
  },
  // API's Player state constants
  PLAYER_STATE: {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
  },
  // API's Subscription options
  SUBSCRIPTION_TYPE: {
    ON_READY: 'onReady',
    ON_STATE_CHANGE: 'onStateChange',
    ON_ERROR: 'onError',
  },
  // API onError codes
  ERROR: {
    INVALID_PARAM: 2,
    PLAYER_ERROR: 5,
    // Special HUDCE auth code
    DCE_AUTH_REQUIRED: 401,
    VIDEO_NOT_FOUND: 100,
    EMBED_FORBIDDEN: 101,
  }
};

// Create Player
window.HudcePaellaPlayer.Player = class {
  /**
   * The constructor returns a promise and creates the iFrame
   * @author HUDCE
   * @param {string} divId - the id of the parent div to add the iFrame
   * @param {object} opts - a set of attributes defined by the API
   */
  constructor(divId, opts = {}) {
    // Private instance attributes
    this.firstTimePlay = true;
    // Keep playing state
    this.player = {};
    this.player.timeSeconds = 0;
    // This is updated when metadata is received on ready state
    this.player.duration = 0;
    // This is updated when metadata is received on ready state
    this.player.metadata;
    // Keep track of subscribers
    this.onReadySubscribers = [];
    this.onStateChangeSubscribers = [];
    this.onErrorSubscribers = [];
    // Save local copy of opts
    this.opts = opts;
    // Check for initial event handlers and config params
    const { events = {}, videoHost, videoId } = this.opts;
    const {
      onReady,
      onStateChange,
      onError
    } = events;
    // Add protocol if host does not have one, assume https
    let tempHost = videoHost;
    if (tempHost && !tempHost.startsWith('http')) {
      tempHost = `https://${tempHost}`;
    }
    // Save parent iFrame divId to filter messages from that iFrame sender
    // Save player params as mutable params, they can be changed by other methods
    this.params = { videoHost: tempHost, videoId, divId };
    // Add initial subscribers
    if (onReady) {
      this.onReadySubscribers.push(onReady);
    }
    if (onStateChange) {
      this.onStateChangeSubscribers.push(onStateChange);
    }
    if (onError) {
      this.onErrorSubscribers.push(onError);
    }
    // Create the iFrame to prep for video and auth check
    this._createIFrame();
    // Try Load video incase any ids were passed in constructor
    try {
      this._loadVideoInIFrame();
    } catch (e) {
      // Alert error handlers
      this._videoLoadErrorHandler(e);
    }
  }

  /*------------------------------------------------------------------------ */
  /*                       Private Internal Functions                        */
  /*------------------------------------------------------------------------ */

  /**
   * Common load error handler
   * @param {object|number} err  - the error code or object
   * @param {string} [authUrl]  - the redirect URL to use for 401 errors
   */
  _videoLoadErrorHandler(err, authURL) {
    const codes = window.HudcePaellaPlayer.CONSTANTS;
    if (err && (err === 401 || err.message === '401')) {
      // Special case message
      this.onErrorSubscribers.forEach((sub) => {
        sub({ data: codes.ERROR.DCE_AUTH_REQUIRED, authURL });
      });
    }
    // default
    else {
      const message = err ? err : 'An unknown error has occurred.';
      this._onErrorHandler(codes.ERROR.PLAYER_ERROR, message);
    }
  }
  /**
   * Create the video an iframe in the container page.
   * @author HUDCE
   */
  _createIFrame() {
    // Get the constants
    const codes = window.HudcePaellaPlayer.CONSTANTS;
    const { divId } = this.params;
    // Create an iFrame
    const iframe = document.createElement('iframe');
    // Allow iFrame to be resized
    iframe.height = '100%';
    iframe.width = '100%';
    iframe.style.cssText = 'resize: both; overflow: auto;';
    // No border
    iframe.frameBorder = 0;
    iframe.allowFullScreen = 1;
    // Unique name for the iFrame to support multiple embeds
    iframe.name = `${codes.IFRAME_NAME_PREFIX}-${divId}`;
    iframe.id = `${codes.IFRAME_NAME_PREFIX}-${divId}`;
    iframe.title = 'HUDCE Paella Player';
    const container = document.getElementById(divId);
    if (container) {
      container.appendChild(iframe);
    }
    this.iFrame = iframe;
    // start the listener
    this._initIFrameListener();
  }
  /**
  * Add the video url or id if saved from constructor.
  */
  _loadVideoInIFrame() {
    const { videoUrl, videoId, videoHost } = this.params;
    const iframe = this.iFrame;
    // Parse the iframe host for messaging
    if (videoUrl) {
      // parse the host from the URL
      const { origin } = new URL(videoUrl);
      // save the host name with protocol
      this.params.videoHost = origin;
      iframe.src = videoUrl;
    } else if (videoId) {
      const playUrl = window.HudcePaellaPlayer.Player._getPlayerUrl(videoHost, videoId);
      // Load the src
      iframe.src = playUrl;
    }
  }

  /**
   * Set the duration and metadata from the input data
   * Input metadata is in the form of
   * https://developers.google.com/youtube/v3/docs/videos?hl=en#resource
   * @param {object} metadata - the video metadata
   */
  _setMetadata(metadata) {
    this.player.duration = (
      metadata.contentDetails
        ? metadata.contentDetails.duration
        : this.player.duration
    );
    this.player.metadata = metadata;
  }

  /*---------------------------------------- */
  /*         UTILITIES                       */
  /*---------------------------------------- */

  /**
   * Helper to create path for the video load
   * @param {string} videoHost - the host name including protocol
   * @param {string} videoId - the video mediapackage Id
   * @return {string} the constructed full player URL
   */
  static _getPlayerUrl(videoHost, videoId) {
    // Add OC Social plugin special arg to force disable
    return `${videoHost}/engage/player/watch.html?id=${videoId}&social=off`;
  }

  /**
   * Helper to extract host and mpId from full video URL
   * @param {string} url - the full video URL
   * @return {object} - the parsed {videohost, videoId} or an empty object
   */
  static _parseIdAndHostFromUrl(url) {
    const { origin, searchParams } = new URL (url);
    if (origin && searchParams) {
      const videoId = searchParams.get('id');
      return { videoHost: origin, videoId };
    }
    return {};
  }

  /**
   * Listen to messages from the origin and iFrame name
   */
  _initIFrameListener() {
    // Alias the constants
    const codes = window.HudcePaellaPlayer.CONSTANTS;
    // Only accept messages from the embedded host and filter by iFrame name
    window.addEventListener('message', (event) => {
      if ((event.origin !== this.params.videoHost)
      || (!event.data || event.data.sender !== this.iFrame.name)) {
        return;
      }
      // extract the key event values
      const { name, value, authUrl, metadata } = event.data;
      let eventNameCode;
      // Convert name to a number if possible, to match event codes
      // Use type coercion ("==") to enale comparison, ex. "12"==12 is true
      if (Number.parseFloat(name) == name) {
        eventNameCode = Number.parseFloat(name);
      } else {
        eventNameCode = name;
      }
      switch (eventNameCode) {
      case codes.PAELLA_EVENT.PLAY: {
        // Only alert if state has changed
        if (this.player.state !== codes.PLAYER_STATE.PLAYING) {
          this.player.state = codes.PLAYER_STATE.PLAYING;
          this._onStateChangeHandler(this.player.state);
        }
        break;
      }
      case codes.PAELLA_EVENT.PAUSE: {
        // Only alert if stae has changed
        if (this.player.state !== codes.PLAYER_STATE.PAUSED) {
          this.player.state = codes.PLAYER_STATE.PAUSED;
          this._onStateChangeHandler(this.player.state);
        }
        break;
      }
      case codes.PAELLA_EVENT.ENDED: {
        this.player.state = codes.PLAYER_STATE.ENDED;
        this._onStateChangeHandler(this.player.state);
        break;
      }
      case codes.PAELLA_EVENT.SEEKED: {
        this.player.timeSeconds = value;
        break;
      }
      case codes.PAELLA_EVENT.TIMEUPDATE: {
        this.player.timeSeconds = value;
        break;
      }
      case codes.PAELLA_EVENT.IGNORE_API_READY:
      case codes.PAELLA_EVENT.IGNORE_VIDEO_READY: {
        // Ignore these two paella events, wait for PAELLA_EVENT.AUTH_READY
        break;
        // Using a special ready event for after Paella auth resolution.
        // The other ready events from app-src and plugin are too early and too late.
      }
      case codes.PAELLA_EVENT.AUTH_READY: {
        this.player.state = codes.PLAYER_STATE.UNSTARTED;
        if (metadata) {
          this._setMetadata(metadata);
        }
        this._onStateChangeHandler(this.player.state);
        this._onReadyHandler();
        break;
      }
      case codes.ERROR.DCE_AUTH_REQUIRED: {
        this._videoLoadErrorHandler(codes.ERROR.DCE_AUTH_REQUIRED, authUrl);
        break;
      }
      case codes.PAELLA_EVENT.ERROR: {
        this._onErrorHandler(codes.ERROR.PLAYER_ERROR, value);
        break;
      }
      default: {
        window.console.log('Unknown event "', eventNameCode, '" from iFrame', this.iFrame.name);
      }
      }
    });
  }

  /**
   * Send message to embedded player
   * @param {string} name - one of the PAELLA_TRIGGER values
   * @param {number} [value] - the seek to value in seconds
   */
  _sendMessageToPlayer(name, value) {
    var message = {
      sender: 'dce-player-embed-api',
      name,
      value,
    };
    // If the player is not yet initialized, add message as ready state listener
    this.doProtectedRequest(() => {
      this.iFrame.contentWindow.postMessage(message, this.params.videoHost);
    });
  }
  /**
   * Call Subscriber handler for Error event
   * @param {string} code - the code of the error
   * @param {string} [msg] - an optional message
   */
  _onErrorHandler(code, msg) {
    this.onErrorSubscribers.forEach((sub) => {
      sub({ data:code, msg });
    });
  }
  /**
   * Call Subscriber handler for State State event
   * @param {string} eventCode - the code of the event
   */
  _onStateChangeHandler(eventCode) {
    this.onStateChangeSubscribers.forEach((sub) => {
      sub({ data: eventCode });
    });
  }

  /**
   * Call Subscriber handler for Ready event
   */
  _onReadyHandler() {
    this.onReadySubscribers.forEach((sub) => {
      sub();
    });
  }

  /*---------------------------------------- */
  /*         PUBIC LOADING  APIs             */
  /*---------------------------------------- */

  /**
   * Load video using full URL
   * Optional start time in seconds
   * @author HUDCE
   * @async
   * @param {string} url - the full path of the video
   * @param {string} start - the video skip to time in seconds
   */
  loadVideoByUrl(url, start) {
    return new Promise((resolve, reject) => {
      // Get the constants
      const codes = window.HudcePaellaPlayer.CONSTANTS;
      if (!url) {
        this._onErrorHandler(codes.ERROR.INVALID_PARAM, 'Missing required url param');
        return reject(codes.ERROR.INVALID_PARAM);
      }
      // deconstruct the host origin and mpid
      const { videoHost } = window.HudcePaellaPlayer.Player._parseIdAndHostFromUrl(url);
      try {
        // save the video host origin
        this.params.videoHost = videoHost;
        // Set the iFrame source, optional start time
        if (start) {
          this.iFrame.src = url + `#t=${Number.parseInt(start)}`;
        } else {
          this.iFrame.src = url;
        }
        return resolve();
      } catch (e) {
        // Alert error handlers
        this._videoLoadErrorHandler(e);
        return reject();
      }
    });
  }
  /**
  * Load video with Id and other parameters
  * @author HUDCE
  * @async
  * @param {object|string} idOpt - an object with the form described below or the video id
  * @param {string} [idOpt.videoId] - the id of the video to load
  * @param {string} [idOpt.startSeconds] - the inpoint to start the video
  * @param {string} [idOpt.endSeconds] - the inpoint to end the video
  * @param {string} [startSecStr] -  a stringifed integer to start the video
  */
  loadVideoById(idOpt, startSecStr) {
    return new Promise((resolve, reject) => {
      let playUrl;
      // video Host is a required constructor param
      const { videoHost } = this.params;
      // Test if idOpt is an object or a string
      if (idOpt.videoId) {
        const { videoId, startSeconds, endSeconds } = idOpt;
        // Save a local reference to the video id
        this.params.videoId = videoId;
        const startSec = Number.parseInt(startSeconds);
        const endSec = Number.parseInt(endSeconds);
        const pathUrlId = window.HudcePaellaPlayer.Player._getPlayerUrl(videoHost, videoId);
        const startParam = isNaN(startSec) ? '' : '&start=' + startSec;
        const endParam = isNaN(endSec) ? '' : '&end=' + endSec;
        playUrl = `${pathUrlId}${startParam}${endParam}`;
      } else {
        // Save a local reference to the video id
        this.params.videoId = idOpt;
        const startSec = Number.parseInt(startSecStr);
        const pathUrlOpt = window.HudcePaellaPlayer.Player._getPlayerUrl(videoHost, idOpt);
        playUrl = `${pathUrlOpt}${isNaN(startSec) ? '' : '#t=' + startSec}`;
      }
      try {
        // Load the iFrame src
        this.iFrame.src = playUrl;
        return resolve(this);
      } catch (e) {
        // Alert error handlers
        this._videoLoadErrorHandler(e);
        return reject();
      }
    });
  }
  /*---------------------------------------- */
  /*          PUBLIC DRIVER APIs             */
  /*---------------------------------------- */

  /**
   * Method to request player to pause
   * @author HUDCE
   */
  pauseVideo() {
    this.doProtectedRequest(() => {
      this._sendMessageToPlayer(window.HudcePaellaPlayer.CONSTANTS.PAELLA_TRIGGER.PAUSE);
    });
  }

  /**
   * Method to request player to play
   * @author HUDCE
   */
  playVideo() {
    this.doProtectedRequest(() => {
      this._sendMessageToPlayer(window.HudcePaellaPlayer.CONSTANTS.PAELLA_TRIGGER.PLAY);
    });
  }

  /**
   * Method to request player to seek a number of seconds into video
   * The allowSeekAhead parameter is ignored, all seek requests are passed
   * @author HUDCE
   * @param {string} sec - the seek to number in seconds
   * @param {string} allowSeekAhead - a boolean that is ignored
   */
  seekTo(sec, allowSeekAhead) {
    this.doProtectedRequest(() => {
      this._sendMessageToPlayer(window.HudcePaellaPlayer.CONSTANTS.PAELLA_TRIGGER.SEEK, Number.parseInt(sec));
    });
  }

  /**
   * Ensure the player is ready before making the request.
   * Otherwise, queue the request until player is ready.
   * @author HUDCE
   * @param {fun} callback - the function to call
   */
  doProtectedRequest(callback) {
    const curState = this.player.state;
    if (curState === undefined || curState === null) {
      // Get the constants
      const codes = window.HudcePaellaPlayer.CONSTANTS;
      // If the player is not yet initialized,
      // queue callback on the ready state listeners
      addEventListener(codes.SUBSCRIPTION_TYPE.ON_READY, callback);
    } else {
      // Ok to execute now
      callback();
    }
  }

  /**
   * Method to return player State
   * @author HUDCE
   * @return {(-1,0,1,2,undefined)} - the code of the player state
   * - Values:
   * - -1 unstarted
   * - 0 ended
   * - 1 playing
   * - 2 paused
   * - undefined means not yet initialized
   * - Not Implemented: 3 buffering and 5 queued
   */
  getPlayerState() {
    return this.player.state;
  }

  /**
   * Method to return current Player time in seconds
   * @author HUDCE
   * @return {number} current time point of player in seconds (rounded down)
   */
  getCurrentTime() {
    return Math.floor(this.player.timeSeconds);
  }

  /**
   * Method to return the duration in seconds of the
   * current video. Note that getDuration() will return 0 until
   * the video's metadata is loaded
   * @author HUDCE
   * @return {number} duration of the video in seconds (float)
   */
  getDuration() {
    return this.player.duration;
  }

  /**
   * Method to return the metadata information of the
   * current video. The metadata is in the format of
   * YouTube video resource.
   * https://developers.google.com/youtube/v3/docs/videos?hl=en#resource
   * @author HUDCE
   * @return {object} video metadata in Youtube video resource format
   */
  getVideoMetadata() {
    return this.player.metadata;
  }

  /**
   * Add Subscribers
   * @author HUDCE
   * @param {string} event - the name of the event (as defined in the APi)
   * @param {requestCallback} callBack - The method to call when the event occurs.
   */
  addEventListener(event, callBack) {
    const codes = window.HudcePaellaPlayer.CONSTANTS;
    switch (event) {
    case codes.SUBSCRIPTION_TYPE.ON_READY:
      this.onReadySubscribers.push(callBack);
      break;
    case codes.SUBSCRIPTION_TYPE.ON_ERROR:
      this.onErrorSubscribers.push(callBack);
      break;
    case codes.SUBSCRIPTION_TYPE.ON_STATE_CHANGE:
      this.onStateChangeSubscribers.push(callBack);
      break;
    default:
      window.console.log('WARNING: unexpected subscriber', event);
    }
  }
};

// Script is loaded. Ok to call onPaellaIframeAPIReady
if (window.onPaellaIframeAPIReady) {
  window.onPaellaIframeAPIReady();
}
