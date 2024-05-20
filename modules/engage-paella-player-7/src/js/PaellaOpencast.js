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

/* global OPENCAST_SERVER_URL */
/* global OPENCAST_CONFIG_URL */
/* global OPENCAST_PAELLA_URL */

import { Paella, bindEvent, Events, utils, log } from 'paella-core';
import getBasicPluginContext from 'paella-basic-plugins';
import getSlidePluginContext from 'paella-slide-plugins';
import getZoomPluginContext from 'paella-zoom-plugin';
import getUserTrackingPluginContext from 'paella-user-tracking';
import getVideo360CanvasPluginContext from 'paella-webgl-plugins';

import { loadTrimming, setTrimming } from './TrimmingLoader';
import EpisodeConversor from './EpisodeConversor.js';
import packagePom from '../../pom.xml';

import dictionary from '../default-dictionaries.js';

import OpencastAuth from './OpencastAuth.js';

function getUrlFromBase(base, url) {
  const a = base.endsWith('/') ? base.slice(0, -1) : base;
  const b = url.startsWith('/') ? url.slice(1) : url;
  const fullURL = `${a}/${b}`;
  return fullURL;
}

export function getUrlFromOpencastServer(url) {
  let base = (typeof OPENCAST_SERVER_URL !== 'undefined') ? OPENCAST_SERVER_URL : '/';
  base = utils.getUrlParameter('oc.server') ?? base;

  return getUrlFromBase(base, url);
}

export function getUrlFromOpencastConfig(url) {
  let base = (typeof OPENCAST_CONFIG_URL !== 'undefined') ? OPENCAST_CONFIG_URL : '/ui/config/paella7';
  base = utils.getUrlParameter('oc.config') ?? base;

  return getUrlFromBase(base, url);
}

export function getUrlFromOpencastPaella(url) {
  const base = (typeof OPENCAST_PAELLA_URL !== 'undefined')
    ? OPENCAST_PAELLA_URL
    : getUrlFromOpencastServer('/paella7/ui');

  return getUrlFromBase(base, url);
}


function myWebsiteCheckConsentFunction(type) {
  const cookie_consent_level = utils.getCookie('cookie_consent_level');
  var consent_level = {};
  try {
    consent_level = JSON.parse(cookie_consent_level);
  }
  catch(e) {
    log.debug('Error parsing "cookie_consent_level" cookie');
  }
  return consent_level[type] || false;
}

// #DCE OPC-937 patch to halt code while redirect is in progress
function nonResolvingPromise() {
  return new Promise(() => {});
}

// ------------------------------------------------------------
// #DCE(naomi): start of dce auth addition --------------------
// ------------------------------------------------------------
const isHarvardDceAuthOk = (jsonData, player) => {

  log.debug(`isHarvardDceAuthOk, response: ${JSON.stringify(jsonData)}`);
  // check that search-results are ok
  var resultsAvailable = (jsonData !== undefined) &&
  (jsonData[ 'search-results'] !== undefined) &&
  (jsonData[ 'search-results'].total !== undefined);

  // if search-results not ok, maybe auth-results?
  if (resultsAvailable === false) {
    var authResultsAvailable = (jsonData !== undefined) &&
    (jsonData[ 'dce-auth-results'] !== undefined) &&
    (jsonData[ 'dce-auth-results'].dceReturnStatus !== undefined);

    // auth-results not present, some other error
    if (authResultsAvailable === false) {
      log.debug(`Search failed, response: ${JSON.stringify(jsonData)}`);
      var message = 'Cannot access specified video; authorization failed (' + jsonData + ')';
      // #DCE OPC-621 use common function to show error and send error message
      showLoadErrorMessage(message, player);
    }
    // (MATT-2212) DCE auth redirect is performed within the getEpisode()
    // failure path (via isHarvardDceAuthRedirect below)
    return false;
  } else {
    return true;
  }
};

// This method is used when getEpisode fails in order to determine if
// auth redirect is possible (MATT-2212)
// This function is asynch to enable the redirect timeout
const doHarvardDceAuthRedirect = async (jsonData, player) => {
  // #DCE OPC-621 Special static iframe name used in Immersive Classroom
  // If changed here, must be changed in API plugin and iFrameEmbedApi.js
  const IC_PLAYER_IFRAME_NAME_PREFIX = 'DCE-iframe-API';
  player.log.debug(`HUDCE: jsonData: ${JSON.stringify(jsonData)}`);
  // Parse json data auth results (existing process)
  if (jsonData && jsonData[ 'dce-auth-results']) {
    var authResult = jsonData[ 'dce-auth-results'];
    if (authResult && authResult.dceReturnStatus) {
      var returnStatus = String(authResult.dceReturnStatus);
      player.log.debug(`HUDCE: returnStatus: ${returnStatus}`);
      // #DCE OPC-621 Alert parent of 401 in case it can handle auth
      // outside of the player
      // Rute's note: removed the test for window.parent because it was giving a cors error and
      // windows.parent is always defined afaik.
      // TODO Should we check for window.name too and move the await setTimeout to this block?
      if (['401', '403', '404'].includes(returnStatus) && authResult.dceLocation) {
        const redir = new URL(authResult.dceLocation);
        const authUrl = (
          returnStatus === '401'
            ? redir.origin + redir.pathname  // truncate for 401 redirect
            : authResult.dceLocation  // pass entire link for 403 message
        );
        // Make 404 be a 403 to simplify
        const messageReturnStatus = '404' === returnStatus ? '403' : returnStatus;
        const updateMessage = {
          sender: window.name, // equates to the iFrame name
          name: messageReturnStatus,
          authUrl,
        };
        // Asynch to queue the post request outside this flow
        setTimeout(function(){
          window.parent.postMessage(updateMessage, '*');
        }, 0);
      }
      // #DCE OPC-621 On Immersive Classroom embedded players
      // the parent will do auth for an http 401 on the embedded player.
      if (
        window.name.startsWith(IC_PLAYER_IFRAME_NAME_PREFIX)
        && ['401', '403', '404'].includes(returnStatus)
      ) {
        player.log.warn('HUDCE: Waiting for parent to perform auth redirect or auth error for player iframe '
          + window.name);
        // Give the parent 3 seconds to receive the message and perform the action
        await new Promise(r => setTimeout(r, 3000));
      }
      // #DCE OPC-554-new-auth 404 is returned when the course is not in
      // the auth db or there are no rules defined
      // for the requested resource in the auth db.
      else if (
        ('401' == returnStatus || '403' == returnStatus || '404' == returnStatus)
          &&
          authResult.dceLocation
          &&
          // Cannot perform auth redirect from localhost
          window.location.hostname !== 'localhost'
      ) {
        // Asynch timeout to put the redirect into another process flow
        player.log.debug('HUDCE: setting timeout ');
        // Wrap the redirect in a promise stop load manifest from returning early
        // if it returns early, Paella throws errors reading the manifest

        player.log.debug(`HUDCE: setting window location to ${authResult.dceLocation}`);
        window.location.replace(authResult.dceLocation);
        // #DCE OPC-937 patch to halt code while redirect is in progress
        // and loader a spinner while redirecting.
        // Reference upstream https://github.com/opencast/opencast/pull/5750
        player._loader = new player.initParams.Loader(player);
        player._loader.create();
        await nonResolvingPromise();
      } else {
        var message = `Cannot access specified video; authorization failed (${authResult.dceErrorMessage})`;
        player.log.debug(message);
        // #DCE OPC-621 use common function to show error and send error message
        showLoadErrorMessage(message, player);
      }
    }
  }
};

// -----------------------------------------------------------
/**
 * DCE ApiWrapperSendLoadData
 * - #DCE OPC-621, DCE Wrapper API for Immersive Classroom
 * - #DCE OPC-862, Update for Paella7
 * @param {*} data
 */
function dceApiWrapperSendLoadData(data) {
  // Alert API wrapper the special condition of auth resolved
  // Include metadata in the format of YouTube video resource
  // https://developers.google.com/youtube/v3/docs/videos?hl=en#resource
  const updateMessage = {
    sender: window.name, // equates to the iFrame name
    name: 'onAuthReady',
    metadata: {
      'kind': 'dce-opencast#video',
      'id': data.metadata.UID,
      'snippet': {
        'publishedAt': data.metadata.startDate,
        'title': data.metadata.title,
        'type': data.metadata.type,
        'location': data.metadata.location,
        'description': data.metadata.description,
        'subject': data.metadata.subject,
        'channelTitle': data.metadata.seriestitle,
        'channelId': data.metadata.series,
        'creators': data.metadata.presenters
      },
      'contentDetails': {
        'duration': data.metadata.duration,
      }
    }
  };
  // Async to queue the post request outside of flow
  setTimeout(function(){
    window.parent.postMessage(updateMessage, '*');
  }, 0);
}

// ------------------------------------------------------------
// #DCE(gregLogan): start of get resourceId for usertracking 'logging helper code'
const setHarvardDCEresourceId = (player, result) => {
  if (!player.opencast) {
    player.opencast = {};
  }
  let type, offeringId = '';
  if (result != undefined) {
    if (result.metadata?.series != undefined) {
      offeringId = result.metadata.series.toString();
    }
    if (result.metadata?.type != undefined) {
      type = result.metadata.type.toString();
    }
  }
  if (offeringId && type) {
    player.opencast.resourceId = (
      offeringId.length >= 11
        ? (
          '/' + offeringId.substring(0, 4)
          + '/' + offeringId.substring(4, 6)
          + '/' + offeringId.substring(6, 11)
          + '/'
        )
        : ''
    ) + type;
  } else {
    player.opencast.resourceId = '';
  }
};
// #DCE(greg): end of user tracking param set helper

//#DCE start show not found error
const showLoadErrorMessage = (message, player) => {
  // paella.messageBox.showError(message);
  player.log.warn(message);
  //$(document).trigger(paella.events.error, {
  //  error: message
  //});;
};
//#DCE end show not found error
// ------------------------------------------------------------
// #DCE(naomi): end of dce auth addition ---------------------
// ------------------------------------------------------------

const initParams = {
  customPluginContext: [
    require.context('../plugins', true, /\.js/),
    getBasicPluginContext(),
    getSlidePluginContext(),
    getZoomPluginContext(),
    getUserTrackingPluginContext(),
    getVideo360CanvasPluginContext()
  ],
  getCookieConsentFunction: (type) => {
    return myWebsiteCheckConsentFunction(type);
  },
  configResourcesUrl: getUrlFromOpencastConfig('/'),
  configUrl: getUrlFromOpencastConfig('/config.json'),
  repositoryUrl: getUrlFromOpencastServer('/search/episode.json'),

  getManifestUrl: (repoUrl, videoId) => {
    return `${repoUrl}?id=${videoId}`;
  },

  getManifestFileUrl: (manifestUrl) => {
    return manifestUrl;
  },

  loadVideoManifest: async function (url, config, player) {
    // check cookie consent (if enabled)
    const cookieConsent = config?.opencast?.cookieConsent?.enable ?? true;
    const cookieConsentConfig = config?.opencast?.cookieConsent?.config ?? {
      'notice_banner_type':'headline',
      'consent_type':'express',
      'palette':'dark',
      'language':'en',
      'page_load_consent_levels':['strictly-necessary'],
      'notice_banner_reject_button_hide':false,
      'preferences_center_close_button_hide':false,
      'page_refresh_confirmation_buttons':false,
      'website_name': 'Paella - opencast player'
    };
    if (cookieConsent == true) {
      window.cookieconsent.run(cookieConsentConfig);
    }

    // Load episode
    const loadEpisode = async () => {
      const response = await fetch(url);

      if (response.ok) {
        let data;
        try {
          data = await response.json();
        } catch (e) {
          throw Error('Unable to parse response');
        }
        // ---------------------------------------
        // #DCE AUTH Insert ---- START -----------
        // ---------------------------------------
        // test if result is Harvard auth or episode data
        if (! isHarvardDceAuthOk(data, player)) {
          return data;
        }
        // ---------------------------------------
        // #DCE AUTH Insert ---- END -----------
        // ---------------------------------------
        const conversor = new EpisodeConversor(data, config.opencast || {});
        return conversor.data;
      }
      else {
        throw Error('Invalid manifest url');
      }
    };
    // #DCE rewrite data with mock data after doing the redirect
    let data = await loadEpisode();
    // ---------------------------------------
    // #DCE AUTH Insert ---- START -----------
    // ---------------------------------------
    // #DCE specific DCE auth handling, formally in isHarvardDceAuth() (MATT-2212)
    if (data && data[ 'dce-auth-results']) {
      await doHarvardDceAuthRedirect(data, player);
      // Force a short delay after the redirect to avoid more processing
      await new Promise((resolve) => {
        setTimeout(function(){
          player.log.debug('Successfully performed DCE auth redirect');
          // #DCE Replace data with a mock manifest to mitigate the red error
          // flash during redirect.
          //
          // Rational: Browsers continue the promise chain after this code
          // prior to executing the redirect request. The rest of this
          // promise chain is in paella-core which does loose verification
          // that there is something in the manifest. If it can't determine a
          // valid shape of the manifest, it throws a red error onto the screen
          // which is visible prior to the redirect replacing the screen.
          //
          // Feeding paella-core a mock manifest is
          // less invasive than forking the paella-code repository
          // and maintaining a custom branch of critical core code.
          //
          // Pull? No other school does the DCE style auth redirect via a
          // custom manifest response from Opencast. It is difficult to
          // rationalize why they need to support an unexpected redirect
          // in the middle of a manifest load, instead of throwing an
          // error.
          data = JSON.parse('{"metadata":{"title":"Auth Redirect","opencast":\
          {"episode":{"id":"none","mediapackage":\
          {"media":{"track":[{"id":"none","type":"presenter/delivery",\
          "mimetype":"video/mp4","duration":1,"video":{}}]},"metadata":{}}}},\
          "preview":""},"streams":[{"sources":{"mp4":[{"src":"mock"}]},\
          "content":"presenter","role":"mainAudio"}],"captions":[],\
          "frameList":[]}');
          resolve();
        }, 100);
      });
    }
    // #DCE end auth check
    // ---------------------------------------
    // #DCE AUTH Insert ---- END -----------
    // ---------------------------------------
    // The following happens when no results are found for the mpId
    if (data === null) {
      // #DCE-IC-Paella7 send message with special not-found code to parent
      const VIDEO_NOT_FOUND_CODE = 100;
      const updateMessage = {
        sender: window.name, // equates to the iFrame name
        name: VIDEO_NOT_FOUND_CODE,
        value: `No data for '${url}' was found. The mediapackage might not exist`
      };
      window.parent.postMessage(updateMessage, '*');
      // end #DCE
      player.log.info('Try to load me.json');
      // Check me.json, if the user is not logged in, redirect to login
      const data = await fetch(getUrlFromOpencastServer('/info/me.json'));
      const me = await data.json();

      if (
        me.userRole === 'ROLE_USER_ANONYMOUS'
        &&
        // #DCE Don't attempt auth redirect if doing localhost testing
        // for DCE, the localhost video must be public
        !window.location.href.includes('localhost')
      ) {
        // #DCE OPC-987 the following code is executed when DCE-OC returns 0
        // results for a mpId request. That happens when
        // the mpId is truly unknown regardless of auth of the mpId or user access.
        // TODO: change this when DCE-OC changes to use vanilla OC authentication.
        throw Error('The video does not exist or the user can\'t see it');
        // Vanilla Paella code...
        // player.log.info('Video not found and user is not authenticated. Try to log in.');
        // location.href = getUrlFromOpencastPaella('auth.html?redirect=' + encodeURIComponent(window.location.href));
      }
      else {
        // TODO: the video does not exist or the user can't see it
        throw Error('The video does not exist or the user can\'t see it');
      }
    }

    // Add event title to browser tab
    const videoTitle = data?.metadata?.title ?? 'Unknown video title';
    const seriesTitle = data?.metadata?.seriestitle ?? 'No series';
    document.title = `${videoTitle} - ${seriesTitle} | Opencast`;

    setHarvardDCEresourceId(player, data);
    // #DCE OPC-689 IC support
    dceApiWrapperSendLoadData(data);

    // #DCE adding a dummy second instance to prevent the space bar issue
    // This is a patch for paella-core to remove the initial space bar listener
    // Otherwise, it remains listening and impacts other uses of space bar
    window.__paella_instances__.push({
      PaellaOpencastSpaceHolderPatchDummyStream: 'ref https://github.com/polimediaupv/paella-core/issues/304'
    });
    // Re-add paella-core code suppressed by the above PaellaOpencastSpaceHolderPatchDummyStream
    const loadKeypressHandler = async (evt) => {
      if (/space/i.test(evt.code)) {
        await player.play();
        window.removeEventListener('keypress', loadKeypressHandler, true);
      }
    };
    // Re-Add the listener, so that an initial space bar starts the video
    window.addEventListener('keypress', loadKeypressHandler, true);
    // #DCE Remove the listener on any click that will also start the video
    window.addEventListener('click', async () => {
      window.removeEventListener('keypress', loadKeypressHandler, true);
    });
    // end #DCE "loadKeypressHandler" override to handle removing the initial space bar listener

    return data;
  },

  loadDictionaries: (player) => {
    for (const lang in dictionary) {
      player.addDictionary(lang, dictionary[lang]);
    }
    player.setLanguage(navigator.language.substring(0, 2));
  }
};

export class PaellaOpencast extends Paella {
  get version() {
    const player = packagePom?.project?.parent?.version || packagePom?.project?.version || 'unknown';
    const coreLibrary = super.version;
    const pluginModules = this.pluginModules.map(m => `${ m.moduleName }: ${ m.moduleVersion }`);
    return {
      player,
      coreLibrary,
      pluginModules
    };
  }

  constructor(containerElement) {
    super(containerElement, initParams);
    this._opencastAuth = new OpencastAuth(this);

    const paella = this;
    function humanTimeToSeconds(humanTime) {
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      const hoursRE = /([0-9]+)h/i.exec(humanTime);
      const minRE = /([0-9]+)m/i.exec(humanTime);
      const secRE = /([0-9]+)s/i.exec(humanTime);
      if (hoursRE) {
        hours = parseInt(hoursRE[1]) * 60 * 60;
      }
      if (minRE) {
        minutes = parseInt(minRE[1]) * 60;
      }
      if (secRE) {
        seconds = parseInt(secRE[1]);
      }
      const totalTime =  hours + minutes + seconds;
      return totalTime;
    }

    // #DCE custom binding
    bindEvent(paella, Events.MANIFEST_LOADED, async () => {
      // #DCE OPC-864 accessibility, set initial focus on play button on screen
      // The MANIFEST_LOAD event happens immediately before paella-core
      // creates the preview container, so wait a moment before setting focus.
      // This might not be enough if the preview images takes a long time to fetch.
      setTimeout(function(){
        const previewPlayButtonElem = document.querySelector('.preview-container button');
        if (previewPlayButtonElem) {
          previewPlayButtonElem.focus();
        }
      }, 600);
    });

    bindEvent(paella, Events.PLAYER_LOADED, async () => {
      // Enable trimming
      // Retrieve video duration in case a default trim end time is needed
      const videoDuration = paella.videoManifest?.metadata?.duration;
      // Retrieve trimming data from a data delegate
      let trimmingData = await loadTrimming(paella, paella.videoId);
      // Retrieve trimming data in URL param: ?trimming=1m2s;2m
      const trimming = utils.getHashParameter('trimming') || utils.getUrlParameter('trimming');
      // Retrieve trimming data in URL start-end params in seconds: ?start=12&end=345
      // Allow the 'end' param to overrule the end in trimming data,
      // Allow a 'start' or an 'end' URL parameter to be passed alone
      const startTrimVal = utils.getHashParameter('start') || utils.getUrlParameter('start');
      const endTrimVal = utils.getHashParameter('end') || utils.getUrlParameter('end');
      // #DCE OPC-395 get layout profile override (presenter | presentation)
      const layoutOverride = utils.getHashParameter('layout') || utils.getUrlParameter('layout');
      if (layoutOverride) {
        paella.videoContainer.setLayout(layoutOverride);
      }

      if (trimming || startTrimVal || endTrimVal) {
        let startTrimming = 0;  // default start time
        let endTrimming = videoDuration; // raw video duration;
        if (trimming) {
          const trimmingSplit = trimming.split(';');
          if (trimmingSplit.length == 2) {
            startTrimming = trimmingData.start + humanTimeToSeconds(trimmingSplit[0]);
            endTrimming = (trimmingData.end == 0)
              ? trimmingData.start + humanTimeToSeconds(trimmingSplit[1])
              : Math.min(trimmingData.start + humanTimeToSeconds(trimmingSplit[1]), trimmingData.end);
          }
        } else {
          if (startTrimVal) {
            startTrimming = trimmingData.start + Math.floor(startTrimVal);
          }
          if (endTrimVal) {
            endTrimming = Math.min(trimmingData.start + Math.floor(endTrimVal), videoDuration);
          }
        }
        if (startTrimming < endTrimming && endTrimming > 0 && startTrimming >= 0) {
          trimmingData = {
            start: startTrimming,
            end: endTrimming,
            enabled: true
          };
        }
        paella.log.debug(`Setting trim to ${JSON.stringify(trimmingData)}`);
        await setTrimming(paella, trimmingData);
      }

      // Check time param in URL and seek:  ?time=1m2s
      const timeString = utils.getHashParameter('time') || utils.getUrlParameter('time');
      // Check t param, which is seek time in seconds, to be passed as a query or hash: #t=12002
      const timeStringInSecs = utils.getHashParameter('t') || utils.getUrlParameter('t');

      if (timeString || timeStringInSecs) {
        let totalTime = 0;
        if (timeString) {
          totalTime = humanTimeToSeconds(timeString);
        } else {
          totalTime = Math.floor(timeStringInSecs);
        }
        paella.log.debug(`Setting initial seek to '${totalTime}' seconds`);
        await paella.videoContainer.setCurrentTime(totalTime);
      }

      // Check captions param in URL:  ?captions  / ?captions=<lang>
      const captions = utils.getHashParameter('captions') || utils.getUrlParameter('captions');
      if (captions != null) {
        let captionsIndex = 0;
        if (captions !== '') {
          paella.captionsCanvas.captions.some((c, idx) => {
            if (c.language == captions) {
              captionsIndex = idx;
              return true;
            }
            return false;
          });
        }
        const captionSelected = paella?.captionsCanvas?.captions[captionsIndex];
        if (captionSelected) {
          paella.log.info(`Enabling captions: ${captionSelected?.label} (${captionSelected?.language})`);
          paella.captionsCanvas.enableCaptions({ index: captionsIndex });
        }
      }
    });
  }
  async getEpisode({episodeId}) {
    return fetch(getUrlFromOpencastServer(`/search/episode.json?id=${episodeId}`))
    .then(response => response.json() )
    .then(response => response['search-results']?.result)
    .catch(() => null);
  }

  get opencastAuth() {
    return this._opencastAuth;
  }
}
