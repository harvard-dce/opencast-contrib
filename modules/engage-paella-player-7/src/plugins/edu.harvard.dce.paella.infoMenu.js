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
import {
  // createElementWithHtmlText,
  MenuButtonPlugin
} from 'paella-core';

import ListIcon from '../icons/info.svg';

export default class dceInfoPlugin extends MenuButtonPlugin {
  constructor () {
    super(...arguments);
    this._classHandoutKey = 'Class Handout';
    this._allCourseVideos = 'All Course Videos';
    this._classHandouts = [];
    this._privacyPolicyLink = 'https://www.extension.harvard.edu/privacy-policy';
  }

  async trackButtonClick(buttonAction) {
    const context = this.config.context || 'userTracking';
    const trackingData = {
      event: 'paella:info:select',
      params: buttonAction
    };
    await this.player.data.write(
      context,
      { id: this.player.videoId },
      trackingData
    );
  }

  async load() {
    this.icon = this.player.getCustomPluginIcon(this.name, 'buttonIcon') || ListIcon;
  }

  get menuTitle() {
    return 'Information Links (opens a new tab)';
  }

  async getMenu() {
    // #DCE MATT-2438, The 'All Course Videos' does not shown when the player is directly embedded
    const buttonActions = [ 'About player', 'Report a problem', 'System status',
      'Privacy policy', this._classHandoutKey, this._allCourseVideos];

    const result = buttonActions
      .filter((item) => this.checkItemEnabled(item))
      .map(label => {
        return {
          id: label,
          title: this.player.translate(label)
        };
      });
    return result;
  }

  // OPC-888 avoid asynch header to prevent popup-blocker from being invoked
  itemSelected(itemData) {
    // OPC-228 add usertracking to info option selection, don't await this
    this.trackButtonClick(itemData.id);

    const metadata = this.player?.videoManifest?.metadata;
    switch (itemData.id) {
      case ('About player'): {
        window.open('watchAbout.html?show=vod&timedcomments', 'About Player');
        break;
      }
      case ('Privacy policy'):
        window.open(this._privacyPolicyLink, 'Privacy Policy');
        break;
      case ('Report a problem'): {
        let paramsP = 'ref=' + this.getVideoUrl() + '&server=MH';
        if (metadata) {
          paramsP += metadata?.opencast?.episode?.dcIsPartOf
            ? '&offeringId=' + metadata?.opencast?.episode?.dcIsPartOf
            : '';
          paramsP += metadata?.opencast?.episode?.dcType
            ? '&typeNum=' + metadata?.opencast?.episode?.dcType
            : '';
          paramsP += metadata?.opencast?.episode?.dcContributor
            ? '&ps=' + metadata?.opencast?.episode?.dcContributor
            : '';
          paramsP += metadata?.opencast?.episode?.dcCreated
            ? '&cDate=' + metadata?.opencast?.episode?.dcCreated
            : '';
          paramsP += metadata?.opencast?.episode?.dcSpatial
            ? '&cAgent=' + metadata?.opencast?.episode?.dcSpatial
            : '';
          paramsP += metadata?.opencast?.episode?.id
            ? '&id=' + metadata?.opencast?.episode?.id
            : '';
        }
        window.open('../ui/index.html#/rap?' + paramsP, 'Report A Problem');
        break;
      }
      case ('System status'):
        // System status is on http, as of Aug 2023, that's not a typo
        window.open('http://status.dce.harvard.edu', 'Status Page');
        break;
      case (this._allCourseVideos): {
        if (metadata?.series) {
          const seriesId = metadata?.series;
          // MATT-1373 reference combined pub list page when series looks like the DCE <academicYear><term><crn>
          if (seriesId.toString().match('^[0-9]{11}$')) {
            const academicYear = seriesId.toString().slice(0, 4);
            const academicTerm = seriesId.toString().slice(4, 6);
            const courseCrn = seriesId.toString().slice(6, 11);
            const href = '../ui/index.html#/' + academicYear + '/' + academicTerm + '/' + courseCrn;
            // For consistency, open in a new tab
            window.open(href, 'Course Videos');
          }
        }
        // If not a valid series, do nothing...
        break;
      }
      case (this._classHandoutKey):
        // Only one handout enabled
        if (this._classHandouts.length > 0) {
          window.open(this._classHandouts[0].url, 'Class Handout');
        }
        break;
      default:
        this.player.log.info('Info Menu item id not recognized: ', itemData.id);
    }
  }

  getVideoUrl () {
    return document.location.href;
  }

  checkItemEnabled (item) {
    let itemEnabled;
    /* eslint "indent": [2, 2, {"SwitchCase": 1}] */
    switch (item) {
      case this._classHandoutKey: {
        itemEnabled = this.checkClassHandouts();
        break;
      }
      case this._allCourseVideos: {
        // Disable if not a DCE series or when player is embedded
        const series = this.player?.videoManifest?.metadata?.series;
        const isDceSeries = series && series.toString().match('^[0-9]{11}$');
        itemEnabled = isDceSeries && (window == window.top);
        break;
      }
      default:
        itemEnabled = true;
    }
    return itemEnabled;
  }

  checkClassHandouts () {
    // retrieve any attached handouts (type "attachment/notes")
    var attachments = this.player?.videoManifest?.metadata?.opencast?.episode?.mediapackage.attachments.attachment;
    if (!(attachments instanceof Array)) {
      attachments = [attachments];
    }
    // Checking for multiple handouts, but only enabling one
    for (var i = 0; i < attachments.length;++ i) {
      var attachment = attachments[i];
      if (attachment !== undefined) {
        if (attachment.type == 'attachment/notes') {
          this._classHandouts.push(attachment);
        }
      }
    }
    var isenabled = (this._classHandouts.length > 0);
    return isenabled;
  }
}
