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
 * #DCE This is an override of UPV
 * https://github.com/polimediaupv/paella-basic-plugins/blob/main/src/plugins/es.upv.paella.fullscreenButton.js
 * NOTE: Firefox 126.0.1 shows 2 fullscreen icons, parent & child when extending parent button with
 *    'export default class FullScreenPluginOverride extends FullscreenButtonPlugin'
 * Other browsers only show the one extended component.
 * TODO: retry the extend FullscreenButtonPlugin on a future Firefox version
*/
import { Events, bindEvent, ButtonPlugin, utils } from 'paella-core';
import fullscreenIcon from '../icons/fullscreen-icon.svg';

export default class PauseButtonPlugin extends ButtonPlugin {
  getPluginModuleInstance() {
    // #DCE BasicPluginsModule not exported, use ButtonPlugin ref:
    return super.getPluginModuleInstance();
  }

  get name() {
    return super.name || 'es.upv.paella.override.fullscreenButton';
  }

  getAriaLabel() {
    return 'Toggle fullscreen';
  }

  getDescription() {
    return this.getAriaLabel();
  }

  get isFallbackFSAvailable() {
    const { width: viewportWidth, height: viewportHeight } = globalThis.visualViewport;
    const { w: playerWidth, h: playerHeight } = this.player.containerSize;
    return viewportWidth !== playerWidth || viewportHeight !== playerHeight;
  }

  async isEnabled() {
    const enabled = await super.isEnabled();
    // #DCE Override for Immersive Classroom, allow disable by URL param 'fullscreen=off'
    const fullscreenArg = utils.getHashParameter('fullscreen') || utils.getUrlParameter('fullscreen');
    if (fullscreenArg === 'off') {
      return false;
    }
    return enabled && this.player.isFullScreenSupported() || this.isFallbackFSAvailable;
  }

  async load() {
    const fsIcon = this.player.getCustomPluginIcon(this.name,'fullscreenIcon') || fullscreenIcon;
    const wIcon = this.player.getCustomPluginIcon(this.name,'windowedIcon') || fullscreenIcon;
    this.icon = fsIcon;
    bindEvent(this.player, Events.FULLSCREEN_CHANGED, (data) => {
      if (data.status) {
        this.icon = wIcon;
      }
      else {
        this.icon = fsIcon;
      }
    });
  }

  async toggleFS() {
    if (this.player.isFullscreen) {
      await this.player.exitFullscreen();
    }
    else {
      await this.player.enterFullscreen();
    }
  }

  toggleFallbackFS() {
    if (this.player.containerElement.classList.contains('paella-fallback-fullscreen')) {
      this.player.containerElement.classList.remove('paella-fallback-fullscreen');
    }
    else {
      this.player.containerElement.classList.add('paella-fallback-fullscreen');
    }
    setTimeout(() => {
      this.player.resize();
    }, 100);
  }

  async action() {
    if (this.player.isFullScreenSupported()) {
      await this.toggleFS();
    }
    else {
      this.toggleFallbackFS();
    }
  }
}
