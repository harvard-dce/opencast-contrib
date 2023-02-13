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

/*global Opencast
         MHAnnotationServiceDefaultDataDelegate
         MHAnnotationServiceTrimmingDataDelegate
         MHFootPrintsDataDelegate
         OpencastTrackCameraDataDelegate
         OpencastToPaellaConverter
         OpencastAccessControl
*/

// #DCE OPC-624 override
// File: engage-paella-player/src/main/paella-opencast/plugins/es.upv.paella.opencast.loader/05_loader.js
// keep patch: MATT-2212 custom DCE auth handling
// keep patch: DCE HLS live & iOS stream toggle
// TODO future: TEST if stream toggling still neeede for iOS and multi to single
//  - related OPC-504	 IPhone Safari single video toggle (of presenter
//    & presentation) audio gets out of synch after a few toggles
// TODO future: convert to Opencast preferred location of paella config

function initPaellaOpencast() {
  if (!paella.opencast) {
    paella.opencast = new Opencast();

    paella.dataDelegates.MHAnnotationServiceDefaultDataDelegate = MHAnnotationServiceDefaultDataDelegate;
    paella.dataDelegates.MHAnnotationServiceTrimmingDataDelegate = MHAnnotationServiceTrimmingDataDelegate;
    paella.dataDelegates.MHFootPrintsDataDelegate = MHFootPrintsDataDelegate;
    paella.dataDelegates.OpencastTrackCameraDataDelegate = OpencastTrackCameraDataDelegate;
    paella.OpencastAccessControl = OpencastAccessControl;
    window.OpencastAccessControl = OpencastAccessControl;
  }
}

function loadOpencastPaella(containerId) {
  initPaellaOpencast();

  var canRead = false;
  var oacl = new OpencastAccessControl();
  oacl.canRead()
  .then(function(c) {
    canRead = c;
    return oacl.userData();
  })
  .then(function(user) {
    if (!canRead) {
      if (user.isAnonymous) {
        window.location.href = oacl.getAuthenticationUrl();
      }
      else {
        var errorMessage = paella.utils.dictionary
          .translate('Error loading video {id}')
          .replace(/\{id\}/g, paella.utils.parameters.get('id') || '');
        paella.messageBox.showError(errorMessage);
        paella.events.trigger(paella.events.error, {error: errorMessage});
      }
    }
    else {
      paella.lazyLoad(containerId, {
        // #DCE OPC-357 revert to original path during migration
        // configUrl:'/ui/config/paella/config.json',
        // configUrl:'/engage/player/config/config.json',
        configUrl: paella.baseUrl + 'config/config.json',
        loadVideo:function() {
          return new Promise((resolve, reject) => {
            paella.opencast.getEpisode()
            .then((episode) => {
              var converter = new OpencastToPaellaConverter();
              var data = converter.convertToDataJson(episode);
              if (data.streams.length < 1) {
                paella.messageBox.showError(paella.utils.dictionary.translate('Error loading video! \
                No video tracks found'));
              }
              else {
                // #DCE start custom data processing ----
                dceCustomLoadProcessing(data);
                // #DCE end ----
                resolve(data);
              }
            })
            // #DCE start custom catch handling -----
            .catch((jsonData)=>{
              var errMsg;
              // #DCE specific DCE auth handling, formally in isHarvardDceAuth() (MATT-2212)
              if (jsonData && jsonData[ 'dce-auth-results']) {
                paella.opencast.doHarvardDceAuthRedirect(jsonData);
                paella.log.debug('Successfully performed DCE auth redirect');
                // #DCE end specific DCE auth handling
              } else if (jsonData == 0) {
                errMsg = paella.utils.dictionary.translate(
                  'No recordings found for episode id {id}'
                )
                .replace(/\{id\}/g, paella.utils.parameters.get('id') || ''
                );
                paella.messageBox.showError(errMsg);
              } else {
                // #DCE OPC-374 Opencast makes user log in if 0 results,
                // DCE has already done auth by this point and knows
                // 0 means 0 to this user.
                errMsg = paella.utils.dictionary.translate(
                  'Error loading video {id}'
                ).replace(/\{id\}/g, paella.utils.parameters.get('id') || '');
                paella.messageBox.showError(errMsg);
              }
            });
            // TODO: finish by re-throwing the reject()?
            // #DCE --- end custom catch ----
          });
        }
      });
    }
  });
}

/**
 * DCE CustomLoadProcessing for toggling sources
 * sets paella.dce config
 * - #DCE OPC-497, DCE HLS live v1, hlsLiveToggleV1
 * - #DCE iOS single video toggle for multiple video pubs
 */
function dceCustomLoadProcessing(data) {
  paella.dce = paella.dce || {};
  paella.dce.sources = [];
  paella.dce.sources.push.apply(paella.dce.sources, data.streams);

  // #DCE OPC-497, DCE HLS live v1, is one HLS live stream, with two
  // unconnected m3u8 HLS manifests, one manifest for each resolution.
  // Because "convertToDataJson()", run above, combines both HLS m3u8
  // masters under the single live video flavor,
  // the hls.js and Safari native player ignore the second master HLS manifest.
  // They can only deal with one m3u8 master per flavor.
  // In order to allow a user to toggle video resolutions for the live HLS
  // Video, the second HLS manifest is extracted from the first (and only)
  // track source, and put into a dummy seconday source.
  // The SingleVideoToggle plugin checks for paella.dce.hlsLiveToggleV1 in
  // order to facilitate video toggle between the first source
  // and the secondary source. The SingleVideoToggle plugin is the control
  // bar UI plugin that allows the user to swith HLS live resolution.
  if (paella.dce.sources.length == 1
      && paella.dce.sources[0].sources
      && paella.dce.sources[0].sources.hls
      && paella.dce.sources[0].sources.hls.length == 2
      && paella.dce.sources[0].sources.hls[0].isLiveStream) {
    // create a dummy second source for single video res toggle
    var firstSource  = data.streams[0];
    var secondSource = JSON.stringify(firstSource);
    secondSource = JSON.parse(secondSource);
    // Move the second hls res to the second source
    var firstHlsRes = firstSource.sources.hls[0];
    var secondHlsRes = firstSource.sources.hls[1];
    firstSource.sources.hls = [];
    firstSource.sources.hls.push(firstHlsRes);
    secondSource.sources.hls = [];
    secondSource.sources.hls.push(secondHlsRes);
    // add the new second HLS live source (the other res) to
    // the paella.dce.sources for access by single video toggle
    paella.dce.sources.push(secondSource);
    paella.dce.hlsLiveToggleV1 = true;
    /* special flag for single video res toggle plugin */
  }

  // #DCE toggle presenter & presentation option when ios (bypass paella5
  // exclusion of presentation video)
  // This is still necessary in Paellav6x: Hide the slave stream from
  // paella if ios, will be used in singleVideoToggle
  // Toggling video players with profiles and hard swap the main
  // Audio player doesn't work. Safari video elements become "suspended"
  if (paella.utils.userAgent.system.iOS) {
    data.streams = [];
    data.streams[0] = paella.dce.sources[0];
  }
}
