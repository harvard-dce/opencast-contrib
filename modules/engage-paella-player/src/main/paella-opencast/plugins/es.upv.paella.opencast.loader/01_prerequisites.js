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

// #DCE OPC-624 override
// File: engage-paella-player/src/main/paella-opencast/plugins/es.upv.paella.opencast.loader/01_prerequisites.js
// Override for DCE auth and getting series from engage search (vs series remote)

class Opencast {

  constructor() {
    this._me = undefined,
    this._episode = undefined,
    this._series = undefined,
    this._acl = undefined;
  }

  getUserInfo() {
    var self = this;
    return new Promise((resolve, reject)=>{
      if (self._me) {
        resolve(self._me);
      }
      else {
        paella.utils.ajax.get({url:'/info/me.json'},
          function(data,contentType,code) {
            self._me = data;
            resolve(data);
          },
          function(data,contentType,code) { reject(); }
        );
      }
    });
  }

  getEpisode() {
    var self = this;
    return new Promise((resolve, reject)=>{
      if (self._episode) {
        resolve(self._episode);
      }
      else {
        var episodeId = paella.utils.parameters.get('id');
        paella.utils.ajax.get({url:'/search/episode.json', params:{'id': episodeId}},
          function(data, contentType, code) {
            // START #DCE insert  ---- 1 ----
            //#DCE auth result check
            var jsonData = data;
            if (typeof (jsonData) == 'string') jsonData = JSON.parse(jsonData);
            // test if result is Harvard auth or episode data
            if (! self.isHarvardDceAuthOk(jsonData)) {
              reject(jsonData);
              return;
              // #DCE no more action here the redirect in the reject path reloads page
            }
            // #DCE end auth check
            // #DCE verify that results returned at least one episode
            var totalItems = parseInt(data[ 'search-results'].total);
            if (totalItems === 0) {
              // #DCE OPC-374 allow catch to show the message to user
              //self.showLoadErrorMessage(paella.utils.dictionary.translate("No
              // recordings found for episode id") + ": \"" + episodeId + "\"");
              // #DCE OPC-374 passing magic number 0 for no results found
              reject(totalItems);
            }
            // #DCE end total check
            if (data[ 'search-results'].result) {
              self._episode = data[ 'search-results'].result;
              // #DCE set logger helper
              self.setHarvardDCEresourceId(self._episode);
              resolve(self._episode);
              // END #DCE insert ---- 1 ----
            } else {
              reject();
            }
          },
          function(data, contentType, code) {
            reject();
          }
        );
      }
    });
  }

  getSeries() {
    var self = this;
    return this.getEpisode()
    .then(function(episode) {
      return new Promise((resolve, reject)=>{
        if (self._series) {
          resolve(self.series);
        }
        else {
          var serie = episode.mediapackage.series;
          if (serie != undefined) {
            paella.utils.ajax.get({url:'/search/series.json', params:{'id': serie}},
              function(data, contentType, code) {
                if (data['search-results'].result) {
                  self._series = data['search-results'].result;
                  resolve(self._series);
                }
                else {
                  reject();
                }
              },
              function(data, contentType, code) {
                reject();
              }
            );
          }
          else {
            reject();
          }
        }
      });
    });
  }

  getACL() {
    var self = this;
    return this.getEpisode()
    .then(function(episode) {
      return new Promise((resolve, reject)=>{
        var serie = episode.mediapackage.series;
        if (serie != undefined) {
          paella.utils.ajax.get({url:'/series/' + serie + '/acl.json'},
            function(data,contentType,code) {
              self._acl = data;
              resolve(self._acl);
            },
            function(data,contentType,code) {
              reject();
            }
          );
        }
        else {
          reject();
        }
      });
    });
  }

  // ------------------------------------------------------------
  // #DCE(naomi): start of dce auth addition
  isHarvardDceAuthOk(jsonData) {

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
        paella.debug.log('Seach failed, response:  ' + jsonData);
        var message = 'Cannot access specified video; authorization failed (' + jsonData + ')';
        paella.messageBox.showError(message);
        $(document).trigger(paella.events.error, {
          error: message
        });
      }
      // (MATT-2212) DCE auth redirect is performed within the getEpisode()
      // failure path (via isHarvardDceAuthRedirect below)
      return false;
    } else {
      return true;
    }
  }

  // This method is used when getEpisode fails in order to determine if
  // auth redirect is possible (MATT-2212)
  doHarvardDceAuthRedirect(jsonData) {
    if (jsonData && jsonData[ 'dce-auth-results']) {
      var authResult = jsonData[ 'dce-auth-results'];
      if (authResult && authResult.dceReturnStatus) {
        var returnStatus = authResult.dceReturnStatus;
        // #DCE OPC-554-new-auth 404 is returned when the course is not in
        // the auth db or there are no rules defined
        // for the requested resource in the auth db.
        if (('401' == returnStatus || '403' == returnStatus || '404' == returnStatus) && authResult.dceLocation) {
          window.location.replace(authResult.dceLocation);
        } else {
          var message = 'Cannot access specified video; authorization failed (' + authResult.dceErrorMessage + ')';
          paella.debug.log(message);
          paella.messageBox.showError(message);
          $(document).trigger(paella.events.error, {
            error: message
          });
        }
      }
    }
  }

  // #DCE(naomi): end of dce auth addition
  // ------------------------------------------------------------
  // #DCE(gregLogan): start of get resourceId for usertracking 'logging helper code'
  setHarvardDCEresourceId(result) {
    var type, offeringId = '';
    if (result != undefined) {
      if (result.dcIsPartOf != undefined) {
        offeringId = result.dcIsPartOf.toString();
      }
      if (result.dcType != undefined) {
        type = result.dcType.toString();
      }
    }
    if (offeringId && type) {
      paella.opencast.resourceId = (
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
      paella.opencast.resourceId = '';
    }
  }

  // #DCE(greg): end of usertracking param set helper
  // ------------------------------------------------------------
  // ------------------------------------------------------------
  //#DCE start show not found error
  showLoadErrorMessage(message) {
    paella.messageBox.showError(message);
    $(document).trigger(paella.events.error, {
      error: message
    });
  }
  //#DCE end show not found error
  // -----------------------------------------------------------
}

// Patch to work with MH jetty server.
paella.utils.ajax.send = function(type,params,onSuccess,onFail) {
  this.assertParams(params);

  var ajaxObj = jQuery.ajax({
    url:params.url,
    data:params.params,
    cache:false,
    type:type
  });

  if (typeof(onSuccess) == 'function') {
    ajaxObj.done(function(data,textStatus,jqXHR) {
      var contentType = jqXHR.getResponseHeader('content-type');
      onSuccess(data,contentType,jqXHR.status,jqXHR.responseText);
    });
  }

  if (typeof(onFail) == 'function') {
    ajaxObj.fail(function(jqXHR,textStatus,error) {
      var data = jqXHR.responseText;
      var contentType = jqXHR.getResponseHeader('content-type');
      if ( (jqXHR.status == 200) && (typeof(jqXHR.responseText) == 'string') ) {
        try {
          data = JSON.parse(jqXHR.responseText);
        }
        catch (e) {
          onFail(textStatus + ' : ' + error,'text/plain',jqXHR.status,jqXHR.responseText);
        }
        onSuccess(data,contentType,jqXHR.status,jqXHR.responseText);
      }
      else{
        onFail(textStatus + ' : ' + error,'text/plain',jqXHR.status,jqXHR.responseText);
      }
    });
  }
};
