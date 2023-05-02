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
