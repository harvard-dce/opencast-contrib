/*
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
/*
 * #DCE custom plugin for embedding player in Immersive Classroom
 * @author HUDCE
 */
import { Events, EventLogPlugin, bindEvent } from 'paella-core';

export default class IFrameApiPlugin extends EventLogPlugin {
  get events() {
    // Ref https://github.com/polimediaupv/paella-core/blob/main/src/js/core/Events.js
    return [
      Events.PLAY,
      Events.PAUSE,
      Events.ENDED,
      Events.STOP,  // different than ended and pause?
      Events.SEEK,  // same as seeked event?
      Events.TIMEUPDATE,
      Events.STREAM_LOADED,  // same as video ready or load complete?
      Events.PLAYBACK_RATE_CHANGED,
      Events.VIDEO_QUALITY_CHANGED,
      Events.LAYOUT_CHANGED,
      Events.VOLUME_CHANGED,
      Events.CAPTIONS_ENABLED,
      Events.CAPTIONS_DISABLED
    ];
  }

  /**
   * The handle this Paella event driven plugin
   * calls when an event fires.
   * By intention, a limited number of events
   * are passed to the wrapper in order to keep the API simple.
   * Include more events to be passed as they become relevant.
   *
   * @inheritdoc
   * @param {string} event - the event that was fired
   * @param {object} [params] - params associated to the event
   */
  async onEvent(event, params) {
    // Test if the event is supported
    const eventType = event;
    if (this.events.includes(eventType)) {
      // TimeUpdate uses currentTime
      // Seek uses prevTime, newTime
      // Example of a sequence of events for seek:
      //   paella:timeupdate params {"currentTime":6652.137751}
      //   paella:pause params {}
      //   paella:timeupdate params {"currentTime":1902}
      //   paella:seek params {"prevTime":6652.258766,"newTime":1902}
      //   paella:timeupdate params {"currentTime":1902}
      //   paella:play params {}
      this.sendMessageToEmbedApi(eventType, params?.currentTime);
    } else {
      this.player?.log.debug('IFrameApiPlugin: Unsupported event ' + eventType);
    }
  }

  /**
   * Check if this plugin is enabled
   * @inheritdoc
   */
  isEnabled () {
    // This iFrame prefix is used by the iFrameEmbedApi
    // When constructing the embedded player iFrame
    const iFramePrefix =  this.config?.iFrameNamePrefix;
    const isConfigEnabled = this.config?.enabled;
    const isEmbeddedWithPrefix = (window.self !== window.top)
      && (window.name && window.name.startsWith(iFramePrefix));

    // Enable when player is embedded, and embed iFrame has target prefix
    return isConfigEnabled && isEmbeddedWithPrefix;
  }

  async load() {
    this.INVALID_PARAM = 2;
    // Requests to the player from the parent
    this.PAELLA_TRIGGER = {
      PLAY: 'play',
      PAUSE: 'pause',
      SEEK: 'seek',
    };
    const thisClass = this;
    if (window.parent !== window) {
      // Set up message listener
      window.addEventListener('message', (event) => {
        thisClass.receiveMessage(event, thisClass);
      }, false);
    }
  }

  async unload() {
    const thisClass = this;
    if (window.parent !== window) {
      // Use the same form of listener to be removed
      window.removeEventListener('message', (event) => {
        thisClass.receiveMessage(event, thisClass);
      }, false);
    }
  }

  /**
   * Message receiver for gov21 implementation
   * @param {object} event - the message from gov21
   */
  async receiveMessage(event, thisClass) {
    // Filter out unwanted messages
    if (
      !event
      || !event.data
      || !event.data.sender
      || [
        'gov2001',
        'dce-player-embed-api',
      ].indexOf(String(event.data.sender)) === -1
    ) {
      return;
    }
    const value = Number.parseInt(String(event?.data?.value || 0));
    try {
      // respond to the request
      switch (String(event.data.name)) {
      case thisClass.PAELLA_TRIGGER.PLAY:
        await thisClass.player.play();
        break;
      case this.PAELLA_TRIGGER.PAUSE:
        await thisClass.player.pause();
        break;
      case thisClass.PAELLA_TRIGGER.SEEK:
        // When stream provider is ready, it's safe to call set time
        if (thisClass.player?.ready && thisClass.player._videoContainer) {
          await thisClass.player._videoContainer.setCurrentTime(value);
        } else {
          // Otherwise, wait for video to load
          bindEvent(thisClass.player, Events.STREAM_LOADED, () => {
            thisClass.seekWhenPaellaIsReady(thisClass, value);
          });
        }
        break;
      default:
        thisClass.player.log.debug(`Unknown request ${String(event.data.name)}`);
      }
    } catch (e) {
      return thisClass.sendMessageToEmbedApi('error', thisClass.INVALID_PARAM);
    }
  }

  /**
  * The call to seek in the videos when player has loaded
  * @param {number} sec -  the number of seconds to seek to in the video
  */
  seekWhenPaellaIsReady = (thisClass, sec) => {
    thisClass.player.log.debug(`iFrameAPIPlugin: Testing if Ok to seek to time ${sec}`);
    if (thisClass.player?.ready && thisClass.player._videoContainer) {
      thisClass.player._videoContainer.setCurrentTime(sec);
    } else {
      // Otherwise, wait for video to load
      thisClass.player.log.debug(`iFrameAPIPlugin: Not Ok to seek to time ${sec}, queuing to try again`);
      setTimeout(() => {
        thisClass.seekWhenPaellaIsReady(thisClass, sec);
      }, 200);
    }
  };

  /**
   * Helper to construct and send the event
   * @param {string} eventType - the name of the event
   * @param {string} [value] - a value associated to the event
   */
  sendMessageToEmbedApi(eventType, value) {
    const iFrameName = window.name;
    const newMessage = {
      sender: iFrameName, // required
      name: eventType, // required
      value, // Optional
    };
    // The plugin sends the above event types to all containers
    // The Host source of the embedAPI is unknown to the player
    // Player status information is low risk
    window.parent.postMessage(newMessage, '*');
  }

  /**
   * Get the name of the Paella plugin
   * @inheritdoc
   * @return the name of this plugin
   */
  getName() {
    return 'edu.harvard.dce.paella.iFrameApiPlugin';
  }

}
