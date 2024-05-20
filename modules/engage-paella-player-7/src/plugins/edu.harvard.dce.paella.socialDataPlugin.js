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
import { DataPlugin } from 'paella-core';
import { getUrlFromOpencastServer } from '../js/PaellaOpencast';

/** Comment Example
 * This is the post-processed format passed to the plugin
const commentExample = [
  {
    'commentId': 2245185219,
    'time': 1,
    'length': 10,
    'isPrivate': false,
    'created': '2023-05-30T16:37:13.295Z',
    'displayName': 'Karen H. Dolan',
    'comment': 'The &quot;3 new handouts&quot; are listed on the course webiste.',
    'responses': [
      {
        'responseId': 2245185219,
        'isPrivate': false,
        'created': '2023-05-30T16:52:19.976Z',
        'displayName': 'Karen H. Dolan',
        'comment': 'Thank you for this information!'
      }
    ]
  }
];
*/

function decodeHTMLEntities(text) {
  var textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}
function encodeHTMLEntities(text) {
  var textArea = document.createElement('textarea');
  textArea.innerText = text;
  return textArea.innerHTML;
}

export default class SocialDataPlugin extends DataPlugin {

  async load() {
    this.rawAnnotations = [];
    this.annotationMap = {};
  }

  async read(_context, { videoId, operation, lastRequestTimeStr }) {
    if (operation === 'canComment') {
      return await this.getCanComment(videoId);
    }
    if (operation === 'canChangeDisplayName') {
      return await this.getCanChangeDisplayName(videoId);
    }
    else if (operation === 'getDisplayName') {
      return await this.getDisplayName(videoId);
    }
    else {
      return await this.getComments(videoId, lastRequestTimeStr);
    }
  }

  async write(_context, videoId, data) {
    if (data.operation === 'newComment') {
      return await this.addComment(videoId, data);
    }
    else if (data.operation === 'updateComment') {
      return await this.updateComment(videoId, data);
    }
    else if (data.operation === 'removeComment') {
      return await this.removeComment(videoId, data);
    }
    else if (data.operation === 'setDisplayName') {
      return await this.setDisplayName(videoId, data);
    }
    else {
      this.player.log.warn('SocialDataPlugin: No operation defined in write action.');
    }
  }


  async getCanChangeDisplayName() {
    return true;
  }
  async getDisplayName(videoId) {
    try {
      // eslint-disable-next-line max-len
      const requestUrl = `/annotation/property?mediaPackageId=${videoId}&type=paella/timedComments&propertyName=userName`;
      const response = await fetch(getUrlFromOpencastServer(requestUrl));
      if (response.ok) {
        this._displayName = await response.text();
      }
    }
    catch (e) {
      this.player.log.warn('Error loading users\'s display name');
    }
    return this._displayName || null;
  }

  async setDisplayName(videoId, data) {
    const { name } = data;

    const params = new URLSearchParams({
      mediaPackageId: videoId,
      propertyValue: name,
      type: 'paella/timedComments',
      propertyName: 'userName'
    });

    const response = await fetch('/annotation/property', {
      method: 'POST',
      body: params.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      }
    });

    if (response.ok) {
      this._displayName = name;
      return true;
    }
    // #DCE OPC-928 return a special object containing new location of resource
    else if (response.redirected && response.location) {
      return { success: false,  newLoc: response.location};
    } else if (String(response.status) === '409') {
      // #DCE OPC-950 capture conflict error
      return { success: false,  conflict: true};
    }
    return false;
  }

  async getCanComment(videoId) {
    let canComment = false;
    try {
      const requestUrl = `/annotation/canAnnotate?mediaPackageId=${videoId}&type=paella%2FtimedComments`;
      const response = await fetch(getUrlFromOpencastServer(requestUrl));
      if (response.ok) {
        canComment = JSON.parse(await response.text());
      }
    }
    catch (e) {
      this.player.log.warn('Error loading /annotation/canAnnotate');
    }
    return canComment;
  }

  async getComments(videoId, lastRequestTimeStr) {
    try {
      this.player.log.debug(`
        DCE-TC: About to getComments for ${videoId},
        previous request at ${lastRequestTimeStr}
      `);
      // eslint-disable-next-line max-len
      const requestUrl = `/annotation/annotations.json?limit=30000&ifModifiedSince=${lastRequestTimeStr}&episode=${videoId}&type=paella/timedComments`;
      const response = await fetch(getUrlFromOpencastServer(requestUrl));
      if (response.status == 304) {
        // This string is read in the caller
        return 'No change';
      }
      // #DCE OPC-928 special object containing new location of resource
      else if (response.redirected && response.location) {
        return { success: false,  newLoc: response.location};
      }
      else if (response.ok) {
        const jsonRes = await response.json();

        if (jsonRes.annotations?.annotation) {
          this.rawAnnotations = Array.isArray(jsonRes.annotations?.annotation)
            ? jsonRes.annotations?.annotation
            : [jsonRes.annotations?.annotation];
        }
      } else {
        this.player.log.debug(`
          DCE-TC: Unable to get annotations: ${JSON.stringify(response)}
        `);
        throw Error(response.code);
      }
    }
    catch (e) {
      this.player.log.warn(`Error loading annotations for video ${videoId}`);
    }
    // Converts into hierarchical JSON with relies nested in comments
    const comments = await this.transformCommentsFromAnnotations(this.rawAnnotations);
    let filtered = comments;
    /* apply soft Trimming */
    if (this.player.videoContainer.isTrimEnabled === true) {
      filtered = comments.filter(c => {
        return (this.player.videoContainer.trimStart <= c.time)
          && (c.time <= this.player.videoContainer.trimEnd);
      });
      filtered = filtered.map(c => {
        return {
          ...c,
          time: c.time - this.player.videoContainer.trimStart
        };
      });
    }
    return filtered;
  }

  async transformCommentsFromAnnotations(annotations) {
    annotations = annotations.map(a=>{ return {...a, value: JSON.parse(a.value)};});
    const comments = annotations.filter(ann => ann.value.timedComment.mode == 'comment');
    const replies = annotations.filter(ann => ann.value.timedComment.mode == 'reply');

    this.annotationMap = new Map(comments.map((ann) => [`${ann.annotationId}`, {
      'commentId': `${ann.annotationId}`,
      'time': ann.inpoint,
      'length': ann.length,
      'isPrivate': ann.isPrivate,
      'created': new Date(ann.created),
      'displayName': ann.value.timedComment.userName,
      'comment': decodeHTMLEntities(ann.value.timedComment.value),
      'responses': []
    }]));

    replies.forEach((reply => {
      const parentId = reply.value.timedComment.parent;
      if (!this.annotationMap.has(parentId)) {
        // eslint-disable-next-line max-len
        this.player.log.info(`AnnotationId=${reply.annotationId} with parentId=${parentId}. But parent does not exist!`);
      }
      else {
        const v = this.annotationMap.get(parentId);
        v.responses.push({
          'responseId': reply.annotationId,
          'isPrivate': reply.isPrivate,
          'created': new Date(reply.created),
          'displayName': reply.value.timedComment.userName,
          'comment': decodeHTMLEntities(reply.value.timedComment.value),
        });
      }
    }));

    const response = [...this.annotationMap.values()];
    return response;
  }

  async addComment(videoId, data) {
    /* apply soft trimming */
    let time = data.time;
    if (this.player.videoContainer.isTrimEnabled === true) {
      time = time + this.player.videoContainer.trimStart;
    }

    const value = {
      timedComment: {
        userName: this._displayName,
        mode: (data.parentCommentId) ? 'reply' : 'comment',
        value: encodeHTMLEntities(data.comment),
        parent: data.parentCommentId || undefined
      }
    };
    const annotParams = {
      episode: videoId,
      type: 'paella/timedComments',
      value: JSON.stringify(value),
      'in': time,
      'out': time + 10, // default 10 sec duration
      isPrivate: data.isPrivate
    };

    const params = new URLSearchParams(annotParams);
    const response = await fetch('/annotation/', {
      method: 'PUT',
      body: params.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      }
    });

    // #DCE OPC-928, redirected comes in the fetch response as status 200
    // the location comes in the fetch response as the url attribute
    if (response.redirected && response.url) {
      return { success: false,  newLoc: response.url};
    }

    if (response.ok) {
      return { success: true };
    }

    return { success: false };
  }

  async updateComment(_videoId, _data) {
    // Protected against an empty value
    if (!_data.value?.updatedText || _data.value?.updatedText.trim() === '') {
      return false;
    }
    const annotationId = _data.annotationId;
    const rawAnnotation = this.rawAnnotations.find(a => {
      return (a.annotationId) == Number.parseInt(annotationId);
    });
    let commentToUpdate = rawAnnotation.value;
    // Parse the value field of the raw annotation
    if (commentToUpdate && (typeof commentToUpdate !== 'object')) {
      commentToUpdate = JSON.parse(commentToUpdate);
    }
    // Modify the value field
    commentToUpdate.timedComment.value = _data.value.updatedText;

    const response = await fetch(`/annotation/${annotationId}`, {
      method: 'PUT',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: `value=${JSON.stringify(commentToUpdate)}`
    });
    // #DCE OPC-928, redirected comes in the fetch response as status 200
    // the location comes in the fetch response as the url attribute
    if (response.redirected && response.url) {
      return { success: false,  newLoc: response.url};
    }

    if (response.ok) {
      return { success: true };
    }

    return { success: false };
  }
}
