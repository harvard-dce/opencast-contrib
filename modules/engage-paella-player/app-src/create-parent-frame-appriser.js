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
