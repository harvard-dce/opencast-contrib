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
import { DataPlugin} from 'paella-core';
import { getUrlFromOpencastServer } from '../js/PaellaOpencast';

// #DCE Custom Package name: edu.harvard.dce.paella.heartbeatSender
export default class HarvardHeartbeatSender extends DataPlugin {

  async load() {
    this.player.log.debug(`HUDCE HeartBeat timer loading with heartbeat interval: ${this.config.heartBeatTime}ms`);
    var thisClass = this;
    if (this.config.heartBeatTime > 0) {
      thisClass.heartbeatTimer = setInterval(async() => {
        try {
          let currentTime = 0;
          let playing = false;
          // If player is ready, it's safe to request it's current time
          if (thisClass.player.ready) {
            currentTime = await thisClass.player.videoContainer.currentTime();
            playing = !(await thisClass.player.videoContainer.paused());
          }
          thisClass.write('heartbeat', thisClass.player.videoId, {currentTime, playing} );
        } catch (e) {
          window.console.log('HUDCE: heartbeat error, will try next time: ' + e);
        }
      }, thisClass.config.heartBeatTime);
    }
  }
  // --- new -----
  async write(context, id, {currentTime, playing}) {

    this.player.log.debug(`Sending heartbeat event for video id ${ id } at \
          time: ${ currentTime }, playing is ${playing}`);

    const opencastLog = {
      id,
      type: 'FOOTPRINT',
      in: Math.round(currentTime),
      out: Math.round(currentTime),
      playing,
      resource: this.player.opencast.resourceId,
    };

    const params = (new URLSearchParams(opencastLog)).toString();
    const result = await fetch(getUrlFromOpencastServer('/usertracking'), {
      method: 'PUT',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: params,
    });
    if (!result.ok) {
      this.player.log.error('Error in user data log');
    }
    else {
      this.player.log.debug(`Opencast user log event done: '${ opencastLog.type }'`);
    }
  }
}
