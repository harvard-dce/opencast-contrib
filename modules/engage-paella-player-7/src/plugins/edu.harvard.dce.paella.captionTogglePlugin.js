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
import { Events, bindEvent, ButtonPlugin } from 'paella-core';

import captionsIconActive from '../icons/closed-captions.svg';
import captionsIcon from '../icons/closed-captions-fill.svg';

export default class CaptionToggleButtonPlugin extends ButtonPlugin {
  getAriaLabel() {
    return 'Toggle closed captions';
  }

  getDescription() {
    return this.getAriaLabel();
  }

  async isEnabled() {
    return await super.isEnabled();
  }

  async load() {
    const ccIcon =
      this.player.getCustomPluginIcon(this.name, 'captionsIcon') ||
      captionsIcon;
    const ccActiveIcon =
      this.player.getCustomPluginIcon(this.name, 'captionsIconActive') ||
      captionsIconActive;
    this.icon = ccIcon;
    this._captionsCanvas = this.player.captionsCanvas;
    this._selected = 'en';  // Default DCE language for now
    this._isDisplayed = false;
    this._button.ariaPressed = false; // #DCE OPC-395 show ariaPressed state

    if (this._captionsCanvas.captions.length == 0) {
      this.disable();
    }

    bindEvent(this.player, Events.CAPTIONS_CHANGED, () => {
      // Toggle is enabled if only one captions language
      // Otherwise use the caption selector menu plugin
      if (this._captionsCanvas.captions.length == 1) {
        this.enable();
      }
    });

    bindEvent(this.player, Events.CAPTIONS_ENABLED, captionsData => {
      this._selected = captionsData.language;
      this.icon = ccActiveIcon;
      this._isDisplayed = true;
      this._button.ariaPressed = true;
    });

    bindEvent(this.player, Events.CAPTIONS_DISABLED, () => {
      this.icon = ccIcon;
      this._isDisplayed = false;
      this._button.ariaPressed = false;
    });
  }

  async action() {
    if (this._isDisplayed) {
      // Toggle off
      this._captionsCanvas.disableCaptions();
    } else {
      // Toggle on
      this._captionsCanvas.enableCaptions({ index: 0 });
    }
  }
}
