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
