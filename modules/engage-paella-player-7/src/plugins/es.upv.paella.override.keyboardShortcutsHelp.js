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
// #DCE OPC-905 Override to make dynamic
import {
  createElementWithHtmlText,
  PopUpButtonPlugin,
  KeyCodes,
} from 'paella-core';

import defaultKeyboardIcon from '../icons/keyboard.svg';
// #DCE OPC-905 updated to match paella-basic-plugins 1.44.0
import '../css/KeyboardShortcutsHelp.css';

export default class KeyboardShortcutsHelpPluginOverride extends PopUpButtonPlugin {
  constructor() {
    super(...arguments);
  }

  get name() {
    return 'es.upv.paella.override.keyboardShortcutsHelp';
  }

  async isEnabled() {
    const enabled = await super.isEnabled();
    return enabled && this.player.getShortcuts().length > 0;
  }

  async load() {
    this.icon = this.player.getCustomPluginIcon(this.name,'keyboardIcon') || defaultKeyboardIcon;
  }

  get popUpType() {
    return 'no-modal';
  }

  getKeyText(sc) {
    let key = this.player.translate(sc.keyCode);
    if (sc.keyModifiers.altKey) {
      key += ' + Alt';
    }
    if (sc.keyModifiers.ctrlKey) {
      key += ' + Ctrl';
    }
    if (sc.keyModifiers.shiftKey) {
      key += ' + Shift';
    }
    return key;
  }

  get menuTitle() {
    return this.config.menuTitle || 'Keyboard shortcuts';
  }

  // #DCE OPC-905 This is the same hard coded button names as in the
  // dynamic onboarding plugin. The button names come from the class
  // name of plugs that implement the feature.
  checkFunctionality = () => {
    this.isFullScreenEnabled = (
      document.querySelector('button[name="es.upv.paella.fullscreenButton"]')
      || document.querySelector('button[name="es.upv.paella.override.fullscreenButton"]')
    ) ? true : false;
    this.isVolumeEnabled = (
      document.querySelector('button[name="es.upv.paella.volumeButtonPlugin"]')
    ) ? true : false;
    this.isCaptionsEnabled = (
      document.querySelector('button[name="edu.harvard.dce.paella.captionTogglePlugin"]')
    ) ? true : false;
  };

  // #DCE OPC-905 Filter out the disabled shortcuts
  filterShortCut = (sc) => {
    let isEnabled;
    switch(sc.keyCode) {
    case KeyCodes.ArrowUp:
    case KeyCodes.ArrowDown:
    case KeyCodes.KeyM: {
      isEnabled = this.isVolumeEnabled;
      break;
    }
    case KeyCodes.KeyF: {
      isEnabled = this.isFullScreenEnabled;
      break;
    }
    case KeyCodes.KeyC: {
      isEnabled = this.isCaptionsEnabled;
      break;
    }
    default:
      isEnabled = true;
    }
    console.log(`Testing ${sc.keyCode} enabled ${isEnabled}`);
    return isEnabled;
  };

  async getContent() {
    const content = createElementWithHtmlText(`
          <div class='keyboardshortcutshelp-plugin'></div>
        `);

    const descriptions = {};
    // #DCE OPC-905
    this.checkFunctionality();

    const shortCuts = this.player.getShortcuts();
    // #DCE OPC-905 dynamic display of keyword shortcuts, filter disabled
    const filteredSC = shortCuts.filter(this.filterShortCut);


    filteredSC.forEach(sc => {
      const description = this.player.translate(sc.description);
      if (!descriptions[description]) {
        descriptions[description] = [sc];
      }
      else {
        descriptions[description].push(sc);
      }
    });

    for (const desc in descriptions) {
      const shortcuts = descriptions[desc];
      let keys = '';
      shortcuts.forEach(sc => {
        if (keys !== '') {
          keys += ' / ';
        }
        keys += this.player.translate(this.getKeyText(sc));
      });

      const item = createElementWithHtmlText(`
      <div class='row'>
        <div class='description'> ${desc} </div>
        <div class='key'> ${keys}</div>
            </div>
      `);
      content.appendChild(item);
    }


    return content;
  }
}
