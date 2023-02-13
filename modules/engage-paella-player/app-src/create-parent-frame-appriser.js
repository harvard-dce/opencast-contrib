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
