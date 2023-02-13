(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
function createParentFrameAppriser(opts) {
  var videoElement;
  if (opts) {
    videoElement = opts.videoElement;
  }

  if (videoElement && window.parent !== window) {
    videoElement.addEventListener('timeupdate', sendTimeToParent);
  }
}

function sendTimeToParent(e) {
  var updateMessage = {
    sender: 'dce-player',
    name: 'timeupdate',
    value: e.target.currentTime
  };
  window.parent.postMessage(updateMessage, '*');
}

module.exports = createParentFrameAppriser;

},{}],2:[function(require,module,exports){
var okSenders = [
  'gov2001'
];

function createParentFrameListener(opts) {
  var playResponder;
  var pauseResponder;

  if (opts) {
    playResponder = opts.playResponder;
    pauseResponder = opts.pauseResponder;
  }

  if (window.parent !== window) {
    window.addEventListener('message', receiveMessage, false);
    var readyMessage = {
      sender: 'dce-player',
      name: 'ready'
    };
    window.parent.postMessage(readyMessage, '*');
  }

  function receiveMessage(event) {
    if (!event || !event.data.sender ||  okSenders.indexOf(event.data.sender) === -1) {
      return;
    }
    if (event.data.name === 'play') {
      playResponder();
    } else if (event.data.name === 'pause') {
      pauseResponder();
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
var createParentFrameListener = require('./create-parent-frame-listener');
var createParentFrameAppriser = require('./create-parent-frame-appriser');

function setUpParentFrameCommunications(document) {
  function setUpParentFrameListener() {
    // #DCE OPC-552 UPV Paella 6.4.3 lazyLoad loadComplete doesn't necessarily load player, yet
    // wait until player loaded loadComplete event
    if (!paella.player.videoContainer) return;
    $(document).off('paella:loadComplete', setUpParentFrameListener);
    createParentFrameListener({
      playResponder: playVideos,
      pauseResponder: pauseVideos
    });
  }

  function setUpParentFrameAppriser() {
    // #DCE OPC-552 UPV Paella 6.4.3 lazyLoad loadComplete doesn't necessarily load player, yet
    // wait until player loaded loadComplete event
    if (!paella.player.videoContainer) return;
    $(document).off('paella:loadComplete', setUpParentFrameAppriser);
    createParentFrameAppriser({
      videoElement: document.querySelector('#' + paella.player.videoContainer.video1Id)
    });
  }

  $(document).on('paella:loadComplete', setUpParentFrameListener);
  $(document).on('paella:loadComplete', setUpParentFrameAppriser);
}

function playVideos() {
  $(document).trigger(paella.events.play);
}

function pauseVideos() {
  $(document).trigger(paella.events.pause);
}

module.exports = setUpParentFrameCommunications;

},{"./create-parent-frame-appriser":1,"./create-parent-frame-listener":2}],6:[function(require,module,exports){
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
