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
import { Events, bindEvent, ButtonPlugin, utils } from 'paella-core';

import fullscreenIcon from '../icons/fullscreen-icon.svg';
import DceUtils from '../js/DceUtils';

/*
 * #DCE Override fullscreenButton plugin for checking if window is
 * allowed to go fullscreen prior to requesting to go fullscreen
 * Remove this override when UPV merges (or rewrites) pull linked below.
 */
export default class PauseButtonPlugin extends ButtonPlugin {

  get name() {
    return super.name || 'es.upv.paella.override.fullscreenButton';
  }

  getAriaLabel() {
    return 'Toggle fullscreen';
  }

  getDescription() {
    return this.getAriaLabel();
  }

  async isEnabled() {
    const enabled = await super.isEnabled();
    // For Immersive Classroom, allow disable by URL param "fullscreen=off"
    const fullscreenArg = utils.getHashParameter('fullscreen') || utils.getUrlParameter('fullscreen');
    if (fullscreenArg === 'off') {
      return false;
    }
    // #DCE OPC-892 related to disabling full screen when not supported
    // This is a patch for checking if full screen button is enabled
    // when embedded in an iFrame.
    // Upstream pull https://github.com/polimediaupv/paella-core/pull/320
    // #DCE OPC-910 disable fullscreen for all IOS
    const isIOS = DceUtils.testIfIOS();
    const isFullScreenEnabled = (
      window.document.fullscreenEnabled ||
      window.document.webkitFullscreenEnabled
    );
    return (
      enabled
      && isFullScreenEnabled
      && this.player.isFullScreenSupported()
      && !isIOS
    );
  }

  async load() {
    const fsIcon = this.player.getCustomPluginIcon(this.name, 'fullscreenIcon') || fullscreenIcon;
    const wIcon = this.player.getCustomPluginIcon(this.name, 'windowedIcon') || fullscreenIcon;
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

  async action() {
    if (this.player.isFullscreen) {
      await this.player.exitFullscreen();
    }
    else {
      await this.player.enterFullscreen();
    }
  }
}
