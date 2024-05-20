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
/* eslint-disable no-alert */
import {
  createElementWithHtmlText,
  PopUpButtonPlugin,
  Events,
  utils
} from 'paella-core';

import { getUrlFromOpencastServer } from '../js/PaellaOpencast';

import ListIcon from '../icons/forum.svg';
import { render } from 'preact/compat';
import { signal } from '@preact/signals';

import '../css/edu.harvard.dce.paella.socialPlugin.css';

// Helper to may a specific date string, without the milliseconds
const makeISODateString = (d) => {
  const pad = (n) => {
    return (n < 10 ? `0${n}` : n);
  };
  const newTimeStr = `
    ${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}
    -${pad(d.getUTCDate())}T${pad(d.getUTCHours())}
    :${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z
  `;
  // remove the white space cause by the lines above
  const newStr = newTimeStr.replace(/\s/g, '' );
  return newStr;
};

export default class SocialPlugin extends PopUpButtonPlugin {
  constructor() {
    super(...arguments);

    this._canChangeDisplayName = signal(false);
    this._displayName = signal(null);
    this._currentTime = signal(0);
    this._comments = signal([]);
    // Avoid unnecessary content rebuild
    this._lastRequestTimeStr = signal('1999-12-31T23:59:59Z');
    // Get user's offset to correctly request server last modify date
    this._userTimeOffsetMs = signal(0);
    this._isAdmin = signal(false);
    this._wasPlaying = signal(false);
    this._stillInHover = signal(false);
    // Pause get new comments when actively adding or editing
    this._pauseGetComments = signal(false);
  }

  get moveable() {
    return true;
  }

  get resizeable() {
    return true;
  }

  get id() {
    return 'edu.harvard.dce.paella.socialPlugin';
  }

  get name() {
    return 'edu.harvard.dce.paella.socialPlugin';
  }

  get closeActions() {
    return {
      clickOutside: false,
      closeButton: true
    };
  }

  get customPopUpClass() {
    return 'social-plugin-popup';
  }

  get menuTitle() {
    return 'Social comments';
  }

  async isEnabled() {
    if (!(await super.isEnabled())) {
      return false;
    }
    // URL param option to turn social off, supports Paella iFrame API embed
    const socialArg = utils.getHashParameter('social') || utils.getUrlParameter('social');
    if (socialArg === 'off') {
      return false;
    }
    // Check if user has rights to access comments
    const canComment = await this.player.data.read('timedComments', {
      videoId: this.player.videoId,
      operation: 'canComment'
    });
    if (canComment) {
      // If user can annotate, get their time offset from the OC server
      const data = await fetch(getUrlFromOpencastServer('/info/me.json'));
      const me = await data.json();
      if (me?.timestamp && me.roles) {
        this._userTimeOffsetMs.value = (new Date()) - me.timestamp;
        // user roles that will facilitate editing. To actually
        // edit, the server validates the user on PUT
        const ADMIN_ROLES = ['ROLE_ADMIN','ROLE_DCE_OC_SOCIAL_ADMIN'];
        this._isAdmin.value = me.roles.some(r => ADMIN_ROLES.includes(r));
      }
    }

    // prevent annots on live stream for now, until test live video inpoints
    const isLiveStream = this.player.videoContainer.isLiveStream;
    // Force annots off with special URL param, social=off
    let disabledByQueryParam = false;
    const queryParam = this.config.queryParamDisable;
    if (queryParam) {
      const url = new URL(window.location.href);
      const q = url.searchParams.get(queryParam);
      if (q) {
        disabledByQueryParam = q.toLowerCase() == 'off'
          || q.toLowerCase() == 'no'
          || q.toLowerCase() == 'false';
      }
    }
    const enabled = canComment && (!isLiveStream) && (!disabledByQueryParam);
    return enabled;
  }

  async load() {
    this.icon = this.player.getCustomPluginIcon(this.name, 'buttonIcon') || ListIcon;

    this.player.bindEvent(Events.TIMEUPDATE, (params) => { this.onTimeUpdate(params); });
    this.player.bindEvent(Events.TRIMMING_CHANGED, () => { this.onTrimmingChanged(); });

    this.reloadComments();
    this.getDisplayName();
    this.canChangeDisplayName();

    if (this.config.timerReloadComments
      && this.config.timerReloadComments > 0
      && !this._pauseGetComments.value  // not in an edit state
    ) {
      // Reload Comments
      setInterval(()=>{
        this.reloadComments();
      }, this.config.timerReloadComments);
    }
  }

  get popUpType() {
    return 'no-modal';
  }

  async getContent() {
    const content = createElementWithHtmlText('<div id="social-plugin-popup"></div>');
    content.addEventListener('click', evt => evt.stopPropagation());
    content.addEventListener('keyup', evt => evt.stopPropagation());
    content.addEventListener('keypress', evt => evt.stopPropagation());
    content.addEventListener('keydown', evt => evt.stopPropagation());
    content.addEventListener('pointerover', async () => {
      // If child briefly took focus, don't do anything
      if (!this._stillInHover.value) {
        // Set the hover value for the first time
        this._stillInHover.value = true;
        // Check if player is currently playing or not
        this._wasPlaying.value = !(await this.player.paused());
        if (this._wasPlaying.value) {
          await this.player.pause();
        }
      }
    });
    content.addEventListener('pointerout', async () => {
      // Test if a child of content took focus, if so, don't do anything
      const contentAndChildren = content.parentNode.querySelectorAll(':hover');
      if (contentAndChildren.length == 0 && document.activeElement !== 'TEXTAREA') {
        if (this._wasPlaying.value) {
          await this.player.play();
        }
        // Really out of focus
        this._stillInHover.value = false;
      }
    });

    // Handle preventing keystrokes propagation in the text area
    const handleTextAreaKeyDown = (event) => {
      if (event.keyCode == 32) {
        // stop space key from playing video
        event.stopPropagation();
        return event;
      }
      return;
    };

    // Handle checking keystrokes in text area
    // The callback is the function that does the submit
    // for the specific type of content
    const handleTextAreaKeyUpSubmit = async (event, callBack) => {
      if (!this._pauseGetComments.value) {
        // Prevent comment refreshing while editing
        this._pauseGetComments.value = true;
      }
      if (event.keyCode == 32) {
        // stop space key from playing video
        event.stopPropagation();
      }
      if (event.keyCode != 13) {
        // Enter key is the only submit key
        return;
      }
      // Remove input focus
      event.target.blur();
      // prevent enter key from doing anything else but submit
      event.preventDefault();
      event.stopPropagation();
      // Get the content and remove the carriage return
      const newContent = event.currentTarget?.value?.replace(/[\r\n]/g, '').trim();
      if (newContent === '') {
        // Cannot be an empty string
        return;
      }
      // Reset to get comment updates
      this._pauseGetComments.value = false;
      // There will always be a callback, it's needed for submit
      if (callBack) {
        await callBack(newContent);
        // reset the text area
        event.target.value = '';
      }
    };

    // eslint-disable-next-line no-unused-vars
    const SocialResponseBlock = ({
      onKeyUpSubmit,
      response
    }) => {
      const responseText = response.comment;
      const responseDisplayName = response.displayName;
      const responseDate = new Intl.DateTimeFormat(navigator.languages, {
        month: 'short', day: '2-digit',
        hour: 'numeric', minute: 'numeric', hour12: false
      }).format(response.created);

      const responseTextEl = this._isAdmin.value ?
        (
          <form class="sp_new_reply_form" role="form" >
            <textarea name="reply" class="sp_comment_textarea"
              aria-label="update existing text" maxlength="256"
              value={responseText}
              onKeyDown={handleTextAreaKeyDown}
              onKeyUp={onKeyUpSubmit}
            ></textarea>
          </form>
        ) : (
          <div class="sp_comment_textarea sp_reply_text">{responseText}</div>
        );

      return (
        <div class="sp_comment sp_reply">
          {responseTextEl}
          <div class="sp_comment_data">
            <span class="user_icon"></span>
            <span class="user_name">{responseDisplayName}</span>, <span class="user_comment_date">{responseDate}</span>
          </div>
        </div>
      );
    };

    // eslint-disable-next-line no-unused-vars
    const SocialCommentBlock = ({ commentBlock, ...props }) => {
      const handleNewReply = async ({
        parentCommentId,
        comment,
        commentTime,
        isPrivate = false
      }) => {
        if (!this._displayName.value) {
          await askAndChangeDisplayName();
        }
        const didWrite = await this.player.data.write('timedComments', this.player.videoId, {
          operation: 'newComment',
          parentCommentId: parentCommentId,
          comment: comment,
          time: Number(commentTime),
          isPrivate: isPrivate
        });
        // #DCE OPC-928 handle 303 mp updated
        if (!didWrite?.success && didWrite.newLoc) {
          this.onHandle303MediapackgeReplaced(comment, didWrite.newLoc);
        } else {
          await this.reloadComments();
          // The system created a default
          if (!this._displayName.value) {
            await this.getDisplayName();
          }
        }
        // No scroll for a reply
      };

      // Helper to update
      const updateComment = async (updatedText, updatedId) => {
        updatedText = updatedText.replace(/[\r\n]/g, '');

        var confirmText = `OK to make update: "${updatedText}" ?`;
        if (confirm(confirmText)) {
          const didWrite = await this.player.data.write('timedComments', this.player.videoId, {
            operation: 'updateComment',
            value: { updatedText, updatedId },
            annotationId: updatedId,
          });
          // #DCE OPC-928 handle 303 mp updated
          if (!didWrite?.success && didWrite.newLoc) {
            this.onHandle303MediapackgeReplaced(updatedText, didWrite.newLoc);
          }
        }
        // OPC-228 add usertracking to info on quality selection
        // player.userTracking.log("paella:social:edit");
        await this.reloadComments();
      };

      const currentTime = this._currentTime.value;
      const commentTime = commentBlock.time;
      const commentLength = commentBlock.length;
      const commentText = commentBlock.comment;
      const commentdisplayName = commentBlock.displayName;
      const commentId = commentBlock.commentId;
      const commentDate = new Intl.DateTimeFormat(navigator.languages, {
        month: 'short', day: '2-digit',
        hour: 'numeric', minute: 'numeric', hour12: false
      }).format(commentBlock.created);
      const commentActive = (commentTime <= currentTime) && (currentTime < commentTime + commentLength);

      // OC Admins can edit existing comments and replies
      const commentTextEl = this._isAdmin.value ?
        (
          <form class="sp_new_reply_form" role="form" >
            <textarea name="comment" class="sp_comment_textarea"
              aria-label="update existing text" maxlength="256"
              value={commentText}
              onKeyDown={handleTextAreaKeyDown}
              onKeyUp={(event) => {
                handleTextAreaKeyUpSubmit(event, (newContent) => {
                  updateComment(newContent, commentId);
                });
              }}
            ></textarea>
          </form>
        ) : (
          <div class="sp_comment_text" >{commentText}</div>
        );

      // OC Admins cannot create new comments or replies
      const newReplyEl = this._isAdmin.value ?
        (
          <div></div>
        ) : (
          <form class="sp_new_reply_form" role="form" >
            <textarea name="comment" class="sp_reply_textarea" aria-label="reply text area"
              placeholder="Type a reply [enter to submit] 256 char"
              maxlength="256"
              onKeyDown={handleTextAreaKeyDown}
              onKeyUp={(event) => {
                // Pass the reply submit function to the handler
                handleTextAreaKeyUpSubmit(event, (newContent) => {
                  event.target.blur();
                  handleNewReply({
                    commentTime:commentTime,
                    parentCommentId: commentBlock.commentId,
                    comment: newContent,
                    isPrivate: false
                  });
                });
              }}
            ></textarea>
          </form>
        );

      return (
        <div class={`sp_timestamp_block ${commentActive && 'active'}`} id={`sp_id_${commentId}`}>
          <div
            class="sp_timestamp"
            role="button"
            aria-label="jump to {commentTime} seconds in the timeline"
            onClick={() => this.player.videoContainer.setCurrentTime(commentTime)}
          >
            {utils.secondsToTime(commentTime)}
          </div>
          <div class="sp_comment_block">
            <div class="sp_comment">
              {commentTextEl}
              <div class="sp_comment_data">
                <div class="user_icon"></div>
                <span class="user_name">{commentdisplayName}</span>
                , <span class="user_comment_date">{commentDate}</span>
              </div>
            </div>
            {
              commentBlock?.responses?.map(r => <SocialResponseBlock
                key={r.responseId}
                response={r}
                onKeyDown={handleTextAreaKeyDown}
                onKeyUpSubmit={(event) => {
                  // Pass the update comment submit function to the handler
                  handleTextAreaKeyUpSubmit(
                    event,
                    (newContent) => {
                      event.target.blur();
                      updateComment(newContent, r.responseId);
                    }
                  );
                }}
              />)
            }
            <div class="sp_comment sp_reply_box">
              {newReplyEl}
            </div>
          </div>
        </div>
      );
    };

    // eslint-disable-next-line no-unused-vars
    const BottomBar = ({ props }) => {
      if (this._isAdmin.value) {
        return (
          <div></div>
        );
      }

      const handleNewComment = async (comment, classHandle) => {
        if (!classHandle._displayName.value) {
          await askAndChangeDisplayName();
        }
        const didWrite = await classHandle.player.data.write('timedComments', classHandle.player.videoId, {
          operation: 'newComment',
          time: classHandle._currentTime.value,
          comment: comment,
          isPrivate: false
        });
        if (!didWrite?.success && didWrite.newLoc) {
          classHandle.onHandle303MediapackgeReplaced(comment, didWrite.newLoc);
        } else {
          await classHandle.reloadComments();
          // Force scroll to view new comment
          classHandle.scrollTimedComments(true);
          if (!classHandle._displayName.value) {
            // The system created a default
            await classHandle.getDisplayName();
          }
        }
      };

      // OC Admins cannot create new comments or replies
      const newCommentEl = (
        <form class="sp_new_comment_form" role="form">
          <div class="sp_comment sp_comment_box">
            <textarea
              name="comment"
              type="textarea"
              class="sp_comment_textarea"
              aria-label="Create a new comment"
              placeholder="Type new comment at the current time [enter to submit] 256 char"
              maxlength="256"
              onKeyDown={handleTextAreaKeyDown}
              onKeyUp={(event) => {
                // Pass the update comment submit function to the handler
                handleTextAreaKeyUpSubmit(
                  event,
                  (newContent) => {
                    handleNewComment(newContent, this);
                  }
                );
              }}
            ></textarea>
          </div>
        </form>
      );

      // The component element
      return (
        <div class="sp_new_comment">
          <div class="sp_timestamp tc_current_timestamp">
            {utils.secondsToTime(this._currentTime.value)}
          </div>
          {newCommentEl}
        </div>
      );
    };

    const askAndChangeDisplayName = async (msg) => {
      const promptText = msg ? msg : this._displayName.value
        ? 'Do you want to change your display name?'
        : 'Do you want to create your display name? Leave blank to use a system assigned default name';
      const newName = prompt(promptText, this._displayName.value || '');

      if (newName && newName.trim() !== '') {
        const trimmed = newName.trim();
        const didWrite = await this.player.data.write('timedComments', this.player.videoId, {
          operation: 'setDisplayName',
          name: trimmed
        });
        // #DCE OPC-928 handle 303 mp updated
        if (!didWrite?.success && didWrite.newLoc) {
          this.onHandle303MediapackgeReplaced(trimmed, didWrite.newLoc);
        }  else if (!didWrite?.success && didWrite.conflict) {
          // show the conflict message
          await askAndChangeDisplayName(
            `Name "${trimmed}" is already in use. Please choose another name.`
          );
        } else {
          this._displayName.value = trimmed;
          return true;
        }
      }
      return false;
    };

    // eslint-disable-next-line no-unused-vars
    const SocialPlugin = ({ props }) => {
      const displayName = this._displayName.value;
      const comments = this._comments.value;

      const handleChangeDisplayName = async () => {
        const changed = await askAndChangeDisplayName();
        if (changed) {
          await this.reloadComments();
        }
      };

      return <>
        <div class="sp_displayName">
          <button onClick={handleChangeDisplayName} disabled={this._canChangeDisplayName.value === false}>
            { displayName
              ? `Welcome ${displayName}`
              : 'Click here to set your display name'
            }
          </button>
        </div>

        <div class="sp_innerAnnotation">
          {comments?.map(c => <SocialCommentBlock key={c.commentId} commentBlock={c}/>)}
        </div>
        <BottomBar />
      </>;
    };

    render(<SocialPlugin />, content);
    return content;
  }

  async onTimeUpdate(params) {
    this._currentTime.value = Math.floor(params.currentTime);
    // Scroll if necessary
    this.scrollTimedComments();
  }

  scrollTimedComments( override = false ) {
    // Test if the plugin is hovered
    const isHovered = document.querySelector('.popup-container.social-plugin-popup:hover');
    // Do not auto scroll when hovered
    if (isHovered && !override) {
      return;
    }
    // Test if the social plugin is rendered
    const scrollContainer = document.querySelector('.popup-container.social-plugin-popup');
    if (!scrollContainer) {
      return;
    }

    // Get a comment that is closest to the current time
    let topComment = this._comments.value.find(c => {
      return  c.time >= Math.ceil(this._currentTime.value) - 10; // in seconds
    });
    if (!topComment) {
      // If there is no close comment, look for last closest earlier comment
      const topDown = this._comments.value.toReversed();
      topComment = topDown.find(c => {
        return c.time <= Math.ceil(this._currentTime.value) + 5; // in seconds
      });
    }
    if (topComment) {
      const commentElem = document.getElementById(`sp_id_${topComment.commentId}`);
      if (commentElem) {
        commentElem.scrollIntoView(true);
      }
    } else {
      // At the end so scroll to the bottom of the comments
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }

  async onTrimmingChanged() {
    this.reloadComments();
  }

  async reloadComments() {
    const newCommentResponse = await this.player.data.read('timedComments', {
      videoId: this.player.videoId,
      lastRequestTimeStr: this._lastRequestTimeStr.value
    });
    // No updated comments
    if (newCommentResponse === 'No change') {
      this.player.log.debug(
        `DCE-social: No change in comment data as of ${this._lastRequestTimeStr.value }`
      );
    }
    // Otherwise set the new data
    else {
      this.player.log.debug('DCE-social: retrieved comments');
      this._comments.value = newCommentResponse;
    }
    // Reset the GET request time, using offset time to the server
    // Keep track of this request date to set the future ifModifiedSinceDate
    const currentServerTime = new Date() - this._userTimeOffsetMs.value;
    this._lastRequestTimeStr.value = makeISODateString(new Date(currentServerTime));
  }

  async getDisplayName() {
    this._displayName.value = await this.player.data.read('timedComments', {
      videoId: this.player.videoId,
      operation: 'getDisplayName'
    });
  }

  async canChangeDisplayName() {
    this._canChangeDisplayName.value = await this.player.data.read('timedComments', {
      videoId: this.player.videoId,
      operation: 'canChangeDisplayName'
    });
  }

  // #DCE OPC-928 a special constructed message to show user that resource has moved
  // This also disables the OC Social plugin to remove the option from the player
  // The player can still play the video, but cannot post to Opencast on this mpId
  onHandle303MediapackgeReplaced(comment, newLoc) {
    createElementWithHtmlText(`
      <div class="error-container video-container-message">
        <div
          class="container center-middle"
          style="background: white; pointer-events: auto; \
            border-radius: 1em; height: fit-content; overflow:scroll;\
            padding: 2em; font-family: sans-serif;"
        >
          <div style="border: red; border-style: double; padding: 1em;">
            <div class="social-error-box-icon"></div>
            <h1 style="color: rgb(232, 59, 70)">
              WARNING: <span> Comment Cannot Be Saved </span>
            </h1>
            <p>
              This recording has been replaced with an updated version of the recording.
            </p>
            <p>
              Please copy and save your comment locally.
            </p>
            <p style="font-style: italic;">
              "${comment}"
            </p>
            <p>
              Then add it to the updated video, located at
              <a href="${newLoc}">
                the new page of the updated recording
              </a>.
            </p>
            <p>A link to the updated video is also on the publication listing page.</p>
          </div>
        </div>
      </div>
      `, document.body);
    // Hide the popup
    const ocSocialButton = document.getElementById(this._name);
    ocSocialButton.click();
    // disabled the button
    this.disable();
    this._enabled = false;
    this.hide();
  }
}
