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
