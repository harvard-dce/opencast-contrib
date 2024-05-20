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
// #DCE OPC-747 aria label enhancements for play-pause button TODO: contribute
import {
  ButtonPlugin,
  Events,
  bindEvent,
} from 'paella-core';

import defaultPlayIcon from '../images/play.svg';
import defaultPauseIcon from '../images/pause.svg';
import defaultReplayIcon from '../images/replay.svg';

import PaellaCoreVideoFormats from '../js/es.upv.paella.override.PaellaCoreVideoFormats';

export default class PlayButtonPlugin extends ButtonPlugin {
  getPluginModuleInstance() {
    // #DCE the PaellaCoreVideoFormats is not exported by paella-core
    // so it is also being overridden
    return PaellaCoreVideoFormats.Get();
  }

  get name() {
    return super.name || 'es.upv.paella.override.playPauseButton';
  }

  async load() {
    const playIcon = this.player.getCustomPluginIcon(this.name,'play') || defaultPlayIcon;
    const pauseIcon = this.player.getCustomPluginIcon(this.name,'pause') || defaultPauseIcon;
    const replayIcon = this.player.getCustomPluginIcon(this.name,'replay') || defaultReplayIcon;
    this.icon = playIcon;
    bindEvent(this.player, Events.PLAY, () => {
      // the play action creates the pause button
      this.icon = pauseIcon;
      this._button.ariaKeyshortcuts = this.config.ariaKeyshortcuts;
      this._button.ariaLabel = this.config.ariaLabelPause;
      this._button.title = this.config.ariaLabelPause;

    });
    bindEvent(this.player, Events.PAUSE, () => {
      // The pause action creates the play button
      this.icon = playIcon;
      this._button.ariaKeyshortcuts = this.config.ariaKeyshortcuts;
      this._button.ariaLabel = this.config.ariaLabelPlay;
      this._button.title = this.config.ariaLabelPlay;
    });
    bindEvent(this.player, Events.ENDED, () => {
      // The ended action creates the play button
      this.icon = replayIcon;
      this._button.ariaKeyshortcuts = this.config.ariaKeyshortcuts;
      this._button.ariaLabel = this.config.ariaLabelPlay;
      this._button.title = this.config.ariaLabelPlay;
    });
    bindEvent(this.player, Events.STOP, () => {
      // The stop action creates the play button
      this.icon = playIcon;
      this._button.ariaKeyshortcuts = this.config.ariaKeyshortcuts;
      this._button.ariaLabel = this.config.ariaLabelPlay;
      this._button.title = this.config.ariaLabelPlay;
    });
  }

  async action() {
    if (await this.player.paused()) {
      await this.player.videoContainer.play();
    }
    else {
      await this.player.videoContainer.pause();
    }
  }
}
