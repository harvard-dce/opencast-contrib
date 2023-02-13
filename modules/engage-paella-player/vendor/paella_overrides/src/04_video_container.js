/*
	Paella HTML 5 Multistream Player
	Copyright (C) 2017  Universitat Politècnica de València Licensed under the
	Educational Community License, Version 2.0 (the "License"); you may
	not use this file except in compliance with the License. You may
	obtain a copy of the License at

	http://www.osedu.org/licenses/ECL-2.0

	Unless required by applicable law or agreed to in writing,
	software distributed under the License is distributed on an "AS IS"
	BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
	or implied. See the License for the specific language governing
	permissions and limitations under the License.
*/
/* #DCE OPC-374, OPC-357 MATT-2502, override default video
 * rectangle dimensions to fit extra wide live combo
 * Keep: OPC-374, OPC-357 MATT-2502, OPC-428....
 * Removed: OPC-407 seek logs
 * Removed: OPC-454 closest whole second for seek. Now allowing ms seeks.
 */
(() => {

class BackgroundContainer extends paella.DomNode {
	constructor(id,image) {
		super('img',id,{position:'relative',top:'0px',left:'0px',right:'0px',bottom:'0px',zIndex:GlobalParams.background.zIndex});
		this.domElement.setAttribute('src',image);
		this.domElement.setAttribute('alt','');
		this.domElement.setAttribute('width','100%');
		this.domElement.setAttribute('height','100%');
	}

	setImage(image) {
		this.domElement.setAttribute('src',image);
	}
}

paella.BackgroundContainer = BackgroundContainer;

class VideoOverlay extends paella.DomNode {
	get size() {
		if (!this._size) {
			this._size = {w:1280,h:720};
		}
		return this._size;
	}

	constructor() {
		var style = {position:'absolute',left:'0px',right:'0px',top:'0px',bottom:'0px',overflow:'hidden',zIndex:10};
		super('div','overlayContainer',style);
		this.domElement.setAttribute("role", "main");
	}

	_generateId() {
		return Math.ceil(Date.now() * Math.random());
	}

	enableBackgroundMode() {
		this.domElement.className = 'overlayContainer background';
	}

	disableBackgroundMode() {
		this.domElement.className = 'overlayContainer';
	}

	clear() {
		this.domElement.innerText = "";
	}

	getVideoRect(index) {
		return paella.player.videoContainer.getVideoRect(index);
	}

	addText(text,rect,isDebug) {
		var textElem = document.createElement('div');
		textElem.innerText = text;
		textElem.className = "videoOverlayText";
		if (isDebug) textElem.style.backgroundColor = "red";
		return this.addElement(textElem,rect);
	}

	addElement(element,rect) {
		this.domElement.appendChild(element);
		element.style.position = 'absolute';
		element.style.left = this.getHSize(rect.left) + '%';
		element.style.top = this.getVSize(rect.top) + '%';
		element.style.width = this.getHSize(rect.width) + '%';
		element.style.height = this.getVSize(rect.height) + '%';
		return element;
	}

	getLayer(id,zindex) {
		id = id || this._generateId();
		return $(this.domElement).find("#" + id)[0] || this.addLayer(id,zindex);
	}

	addLayer(id,zindex) {
		zindex = zindex || 10;
		var element = document.createElement('div');
		element.className = "row";
		element.id = id || this._generateId();
		return this.addElement(element,{ left:0, top: 0, width:1280, height:720 });
	}

	removeLayer(id) {
		var elem = $(this.domElement).find("#" + id)[0];
		if (elem) {
			this.domElement.removeChild(elem);
		}
	}

	removeElement(element) {
		if (element) {
			try {
				this.domElement.removeChild(element);
			}
			catch (e) {

			}
		}
	}

	getVSize(px) {
		return px*100/this.size.h;
	}

	getHSize(px) {
		return px*100/this.size.w;
	}
}

paella.VideoOverlay = VideoOverlay;

class VideoWrapper extends paella.DomNode {
	constructor(id, left, top, width, height) {
		var relativeSize = new paella.RelativeVideoSize();
		// #DCE give full dimensions of initial video if sizes were not passed
		var percentTop = (relativeSize.percentVSize(top) || 0) + '%';
		var percentLeft = (relativeSize.percentWSize(left) || 0) + '%';
		var percentWidth = (relativeSize.percentWSize(width) || 100) + '%';
		var percentHeight = (relativeSize.percentVSize(height) || 100) + '%';
		var style = {
			top: percentTop,
			left: percentLeft,
			width: percentWidth,
			height: percentHeight,
			position: 'absolute',
			//zIndex: GlobalParams.video.zIndex, //#DCE use from style
			overflow: 'hidden'
		};
		super('div',id,style);
		this._rect = { left:left, top:top, width:width, height:height };
		this.domElement.className = "videoWrapper";
	}

	setRect(rect,animate) {
		this._rect = JSON.parse(JSON.stringify(rect));
		var relativeSize = new paella.RelativeVideoSize();
		// #DCE MATT-2502 override the UPV default relative video container ratio
		// *ONLY* for the extra short and wide "3.55/1" ratio, 16x9+16x9 (32x9), DCE live stream.
		// The override has to be set globally for access by all instances of new paella.RelativeVideoSize().
		if (paella.dce && paella.player.videoContainer.isMonostream && rect.aspectRatio == "3.55/1") {
			// #DCE MH-relative size old style intercept of the paella.RelativeVideoSize()
			// #DCE OPC-357 TODO: hoping RelativeVideoSize.w and h can be overridden in newer Paella
			// [followup] Sadly no, still needed for UPV Paella v6.2.0
			// TODO: Check if relative window size can be overridden in Paella v6.5.5
			paella.dce.relativeVideoSize = paella.dce.relativeVideoSize || {};
			paella.dce.relativeVideoSize.h=rect.height;
			paella.dce.relativeVideoSize.w=rect.width;
		}
		var percentTop = relativeSize.percentVSize(rect.top) + '%';
		var percentLeft = relativeSize.percentWSize(rect.left) + '%';
		var percentWidth = relativeSize.percentWSize(rect.width) + '%';
		var percentHeight = relativeSize.percentVSize(rect.height) + '%';
		var style = {top:percentTop,left:percentLeft,width:percentWidth,height:percentHeight,position:'absolute'};
		if (animate) {
			this.disableClassName();
			var thisClass = this;

			$(this.domElement).animate(style,400,function(){
				thisClass.enableClassName();
				paella.events.trigger(paella.events.setComposition, { video:thisClass });
			});
			this.enableClassNameAfter(400);
		}
		else {
			$(this.domElement).css(style);
			paella.events.trigger(paella.events.setComposition, { video:this });
		}
	}

	getRect() {
		return this._rect;
	}

	disableClassName() {
		this.classNameBackup = this.domElement.className;
		this.domElement.className = "";
	}

	enableClassName() {
		this.domElement.className = this.classNameBackup;
	}

	enableClassNameAfter(millis) {
		setTimeout("$('#" + this.domElement.id + "')[0].className = '" + this.classNameBackup + "'",millis);
	}

	setVisible(visible,animate) {
		if (typeof(visible)=="string") {
			visible = /true/i.test(visible) ? true : false;
		}
		if (visible && animate) {
			// #DCE OPC-552 animate opacity race condition with show,
			// changed to fadeIn alone.
			// TODO: submit patch to UPV
			$(this.domElement).fadeIn(300);
		}
		else if (visible && !animate) {
			$(this.domElement).show();
		}
		else if (!visible && animate) {
			// #DCE OPC-552, see above
			// TODO: submit patch to UPV
			$(this.domElement).fadeOut(300);
		}
		else if (!visible && !animate) {
			$(this.domElement).hide();
		}
	}

	setLayer(layer) {
		this.domElement.style.zIndex = layer;
	}
}

paella.VideoWrapper = VideoWrapper;

paella.SeekType = {
	FULL: 1,
	BACKWARDS_ONLY: 2,
	FORWARD_ONLY: 3,
	DISABLED: 4
};

// This function is used to manage the timer to enable and disable the click and double click events
// interaction with the video container timeout.
function clearClickEventsTimeout() {
	if (this._clickEventsTimeout) {
		clearTimeout(this._clickEventsTimeout);
		this._clickEventsTimeout = null;
	}
}

class VideoContainerBase extends paella.DomNode {

	constructor(id) {
		var style = {position:'absolute',left:'0px',right:'0px',top:'0px',bottom:'0px',overflow:'hidden'};
		super('div',id,style);

		this._trimming = {enabled:false,start:0,end:0};
		this.timeupdateEventTimer = null;
		this.timeupdateInterval = 250;
		this.masterVideoData = null;
		this.slaveVideoData = null;
		this.currentMasterVideoData = null;
		this.currentSlaveVideoData = null;
		this._force = false;
		this._maxSyncDelay = 0.3; // #DCE OPC-401
		this._syncHits = 0;  // #DCE OPC-407
		this._clickEventsEnabled =  true;
		this._seekDisabled =  false;
		this._seekType = paella.SeekType.FULL;
		this._seekTimeLimit = 0;
		this._attenuationEnabled = false;
		this._seekingPlayers = new Set(); //#DCE OPC-407 array of players in seeking state
		this._waitingToPlayPlayers = new Set(); //#DCE OPC-407 array of players in waiting to play state
		// #DCE OPC-401
		setTimeout(function() {
			let repeat = true;
			paella.player.videoContainer.syncVideos(repeat);
		}, this._videoSyncTimeMillis);

		$(this.domElement).dblclick((evt) => {
			if (this._clickEventsEnabled) {
				paella.player.isFullScreen() ? paella.player.exitFullScreen() : paella.player.goFullScreen();
			}
		});

		let dblClickTimer = null;
		$(this.domElement).click((evt) => {
			let doClick = () => {
				if (!this._clickEventsEnabled) return;
				paella.player.videoContainer.paused()
					.then((paused) => {
						// If some player needs mouse events support, the click is ignored
						if (this.streamProvider.videoPlayers.some((p) => p.canvasData.mouseEventsSupport)) {
							return;
						}
						// #DCE OPC-497 only allow play on click for DCE HLS Live v1, not pause
						if (paused || (paella.dce && paella.dce.hlsLiveToggleV1)) {
							paella.player.play();
						}
						else {
							paella.player.pause();
						}
					});
			};

			// the dblClick timer prevents the single click from running when the user double clicks
			if (dblClickTimer) {
				clearTimeout(dblClickTimer);
				dblClickTimer = null;
			}
			else {
				dblClickTimer = setTimeout(() => {
					dblClickTimer = null;
					doClick();
				}, 200);
			}


		});

		this.domElement.addEventListener("touchstart",(event) => {
			if (paella.player.controls) {
				paella.player.controls.restartHideTimer();
			}
		});

		// #DCE OPC-445 an endTimer variation from Paella 6.3, reused for 6.4x, 6.5x
		let endedTimer = null;
		paella.events.bind(paella.events.endVideo,(event) => {
			if (endedTimer) {
				clearTimeout(endedTimer);
				endedTimer = null;
			}
			endedTimer = setTimeout(() => {
				paella.events.trigger(paella.events.ended);
			}, 1000);
		});
		// end #DCE OPC-445
	}

	set attenuationEnabled(att) {
		this._attenuationEnabled = att;

		Array.from(paella.player.videoContainer.container.domElement.children).forEach((ch) => {
			if (ch.id == "overlayContainer") {
				return;
			}
			if (att) {
				$(ch).addClass("dimmed-element");
			}
			else {
				$(ch).removeClass("dimmed-element");
			}
		});
	}

	get attenuationEnabled() {
		return this._attenuationEnabled;
	}

	set seekType(type) {
		switch (type) {
		case paella.SeekType.FULL:
		case paella.SeekType.BACKWARDS_ONLY:
		case paella.SeekType.FORWARD_ONLY:
		case paella.SeekType.DISABLED:
			this._seekType = type;
			paella.events.trigger(paella.events.seekAvailabilityChanged, {
				type: type,
				enabled: type==paella.SeekType.FULL,
				disabled: type!=paella.SeekType.FULL
			});
			break;
		default:
			throw new Error(`Invalid seekType. Allowed seek types:
				paella.SeekType.FULL
				paella.SeekType.BACKWARDS_ONLY
				paella.SeekType.FORWARD_ONLY
				paella.SeekType.DISABLED`);
		}
	}

	get seekType() { return this._seekType; }

	triggerTimeupdate() {
		var paused = 0;
		var duration = 0;
		this.paused()
			.then((p) => {
				paused = p;
				return this.duration();
			})

			.then((d) => {
				duration = d;
				return this.currentTime();
			})

			.then((currentTime) => {
				if (!paused || this._force) {
					this._seekTimeLimit = currentTime>this._seekTimeLimit ? currentTime:this._seekTimeLimit;
					this._force = false;
					paella.events.trigger(paella.events.timeupdate, {
						videoContainer: this,
						currentTime: currentTime,
						duration: duration
					});
				}
			});
	}

	startTimeupdate() {
		this.timeupdateEventTimer = new paella.utils.Timer((timer) => {
			this.triggerTimeupdate();
		}, this.timeupdateInterval);
		this.timeupdateEventTimer.repeat = true;
	}

	stopTimeupdate() {
		if (this.timeupdateEventTimer) {
			this.timeupdateEventTimer.repeat = false;
		}
		this.timeupdateEventTimer = null;
	}

	enablePlayOnClick(timeout = 0) {
		clearClickEventsTimeout.apply(this);
		if (timeout) {
			this._clickEventsTimeout = setTimeout(() => {
				this._clickEventsEnabled = true;
			}, timeout);
		}
		else {
			this._clickEventsEnabled = true;
		}
	}

	disablePlayOnClick() {
		clearClickEventsTimeout.apply(this);
		this._clickEventsEnabled = false;
	}

	isPlayOnClickEnabled() {
		return this._clickEventsEnabled;
	}

	/* #DCE --- start DCE synch ---- */
	play() {
		// #DCE TODO: refactor DCE video toggle to work with upstream synch
		// meanwhile, disabled UPV synch until compatible with DCE video disable toggle feature
		// this.streamProvider.startVideoSync(this.audioPlayer);
		this.startTimeupdate();
		setTimeout(() => paella.events.trigger(paella.events.play), 50)
	}

	pause() {
		paella.events.trigger(paella.events.pause);
		this.stopTimeupdate();
		// #DCE TODO: refactor DCE video toggle to work with upstream synch
		// meanwhile, disabled UPV synch until compatible with DCE video disable toggle feature
		// this.streamProvider.stopVideoSync();
	}

	// #DCE OPC-428
	get seeking() {
		return this._seeking;
	}

	//#DCE OPC-552 NOTE: DCE doesn't use seekType or seekDisabled/seekEnabled flags for seek protection
	// DCE uses a custom video _isSeeking flag (HTML5 video)
	// #DCE OPC-455 return true if any video in container in an active seek
	areAnyVideosInSeek () {
		let seekingCount = this._seekingPlayers.size;
		paella.log.debug(`HTML5: AnySeeking? seeking players: '${seekingCount}'.`);
		this._seekingPlayers.forEach(p => paella.log.debug(`HTML5: AnySeeking? Still seeking '${p.stream.content}'`));
		return seekingCount > 0;
	}

	// #DCE OPC-455 return true if any video in container in an active seek or active wait to play
	areAnyVideosInSeekOrWaitToPlay () {
		let waitingForPlayCount = this._waitingToPlayPlayers.size;
		paella.log.debug(`HTML5: AnyWaitingToPlay? waiting to player players: '${waitingForPlayCount}'.`);
		this._waitingToPlayPlayers.forEach(p => paella.log.debug(`HTML5: AnySeeking? Waiting to Play '${p.stream.content}'`));
		return this.areAnyVideosInSeek() && waitingForPlayCount > 0;
	}

	// #DCE OPC-407 only play if all players are not seeking
	playIfNonAreSeeking (player, callStackId) {
		if (!player || !player.stream) return;
		this._waitingToPlayPlayers.add(player);

		// #DCE OPC-439 account for start trim when setting player time
		let currentTrimmedTimeToSeek = 0;
		if (!this.areAnyVideosInSeek()) {
			this.currentTime().then(currentTrimmedTime => {
				currentTrimmedTimeToSeek = currentTrimmedTime;
				return paella.player.videoContainer.masterVideo().getVideoData();
			}).then(videoData => {
				let mainVideoTime = videoData.currentTime;
				let currentTrimmedTime = currentTrimmedTimeToSeek;
				let doGroupSeekSynch = false;

				this._waitingToPlayPlayers.forEach(p => {
					// #DCE OPC-439 compare player time to the master (actual untrimmed time)
					let timeOffset = Math.abs(p.video.currentTime - mainVideoTime);
					if (timeOffset > 0.5) {
						paella.log.debug(`HTML5: PLAY? no, forcing a group seek to compensate for time offset '${timeOffset}' for '${p.stream.content}' (${p._identifier}) main player time '${mainVideoTime}', callStackId:${callStackId}.`);
						doGroupSeekSynch = true;
					} else {
						p.play();
						paella.log.debug(`HTML5:  PLAY? Yes! Videos only '${timeOffset}' seconds apart. Starting play for '${p.stream.content}' at '${p.video.currentTime}', callStackId:${callStackId}.`);
					}
				});
				// #DCE Reset the waiting player collection because all are either synched or a separate group synch will take place.
				this._waitingToPlayPlayers = new Set();
				// A slave is still out of synch (cannot catch up) with master, synch both together to force the synch.
				if (doGroupSeekSynch) {
						this.seekToTime(currentTrimmedTime);
				}
			});
		} else {
			paella.log.debug(`HTML5: other players are still seeking, '${player.stream.content}' will wait until all finish seeking, callStackId:${callStackId}.`);
		}
	}

	// #DCE OPC-354, OPC-389, OPC-401
	// https://github.com/polimediaupv/paella/issues/447

	repeatSyncVideo(repeat) {
	  repeat = repeat || true;
	  let self = this;
	  if (repeat) {
	    setTimeout(function () {
	      paella.player.videoContainer.syncVideos(true);
	    }, self._videoSyncTimeMillis);
	  }
	}

	syncVideos(repeat) {
	  repeat = repeat || false;
	  let self = this;
	  if (paella.player.videoContainer._seekingPlayers.size > 0) {
	    paella.log.debug(`HTML5: Video Seek is already running, not synching Videos`);
	    this.repeatSyncVideo(repeat);
	    return;
	  }
	  if (paella.utils.userAgent.system.iPhone) { // #DCE only show one video on iPhone, for now, keep hiden one paused
	    paella.log.debug(`HTML5: Video synch disabled for iPhone, because DCE is only showing one video at a time in iPhone at the moment.`);
	    return;
	  }

	  if (!paella.player.videoContainer.masterVideo()) {
	    // #DCE OPC-420
	    paella.log.debug(`There was an existing ERROR loading videos for this mp! At least 1 video should have been found by this point and was not.`);
	    return;
	  }

	  // #DCE OPC-407 synch videos not matching the master, OPC-458 toogle with doing a goup synch for Safari tab-open issue
	  let currentTrimmedTimeToSeek = 0;
	  paella.player.videoContainer.currentTime()
	  .then((currentTrimmedTime) => {
			 currentTrimmedTimeToSeek = currentTrimmedTime;
			 return paella.player.videoContainer.masterVideo().getVideoData();
			})
			.then((videoData) => {
			let mainVideoTime = videoData.currentTime;
			let currentTrimmedTime = currentTrimmedTimeToSeek;
			let streams = paella.player.videoContainer.streamProvider.videoPlayers;
			let promises = [];
			let updated = [];
			let shortbuffer = 0.1;
			let seekTime = shortbuffer;
			let isPaused = videoData.paused;
			let doGroupSynchScrub = false; // OPC-458 Safari new tab open synch fix
			let doGroupSynchToggle = self._syncHits % 2 > 0;
			streams.forEach(v => {
			 if (paella.player.videoContainer.isMonostream || !v.video) {
			   return;
			 }
			 if (v._isSeeking) {
			   paella.log.debug(`HTML5: Not synching video, video '${v._identifier}' (${v._stream.content}) is already seeking`);
			   return;
			 }
			 let thisVideoTime = v.video.currentTime;
			 let diff = Math.abs(thisVideoTime - mainVideoTime);
			 let anyVideosInSeek = paella.player.videoContainer.areAnyVideosInSeek();
			 paella.log.debug(`HTML5-SYNC: About to check sync on '${v._stream.content}' (${v._identifier}) ${v.video.paused?'paused': 'running'}' timediff=${diff} thisVideoTime = ${thisVideoTime} mainVideo=${mainVideoTime} containerTrimTime=${currentTrimmedTime}, AnySeeking? ${anyVideosInSeek}`);
			 if (v !== paella.player.videoContainer.streamProvider.mainAudioPlayer && !v.video.paused && diff > self._maxSyncDelay) {
			   let seekTime = shortbuffer > mainVideoTime ? shortbuffer : parseFloat(mainVideoTime).toFixed(3); // #DCE OPC-439 synch to buffer offset of main video time
			   if (!isPaused) {
			     seekTime += (self._maxSyncDelay - shortbuffer); // add future buffer to catch running audio
			   }
			   if (doGroupSynchToggle) {
			     doGroupSynchScrub = true;
			     paella.log.debug(`HTML5: Will do group sync for '${v._stream.content}' (${v._identifier}) paused=${v.video.paused}, timediff=${diff}, settingToTime=${seekTime}`);
			   } else {
			     paella.log.debug(`HTML5: About to DIRECTLY seek synch video '${v._stream.content}' (${v._identifier}) paused=${v.video.paused}, timediff=${diff}, settingToTime=${seekTime}`);
			     updated.push(v);
			     promises.push(v.setCurrentTime(seekTime));
			   }
			  }
			});
			if (doGroupSynchScrub || promises.length > 0) {
			 self._syncHits++;
			}
			if (doGroupSynchScrub) {  //#DCE OPC-458 for group seek synch
			 self.seekToTime(currentTrimmedTime);
			}

			// #DCE OPC-407 for synch videos not matching the master
			Promise.all(promises).then(function () {
			 if (updated.length > 0) {
			   paella.log.debug(`HTML5: Synced ${updated.length} videos for ${seekTime}, number of times synched = ${self._syncHits}`);
			 }
			 if (repeat) {
			   setTimeout(function () {
			     paella.player.videoContainer.syncVideos(true);
			     }, self._videoSyncTimeMillis);
			   }
			 }).catch(error => {
			   paella.log.debug(`HTML5: Unable to synch video(s) to time '${seekTime}': ${error.message}`);
			 });
		});
	}
		/* #DCE --- end DCE synch ---- */

	seekTo(newPositionPercent) {
		return new Promise((resolve, reject) => {
			let time = 0;
			paella.player.videoContainer.currentTime()
				.then((t) => {
					time = t;
					return paella.player.videoContainer.duration()
				})

				.then((duration) => {
					// #DCE for DCE synch, reject seek when already seeking
					if (this._seekDisabled) {
						reject(new Error("Warning: Seek is currently disabled"));
						return;
					} // #DCE end DCE
					if (this._seekTimeLimit>0 && this._seekType==paella.SeekType.BACKWARDS_ONLY) {
						time = this._seekTimeLimit;
					}
					let currentPercent = time / duration * 100;
					switch (this._seekType) {
					case paella.SeekType.FULL:
						break;
					case paella.SeekType.BACKWARDS_ONLY:
						if (newPositionPercent>currentPercent) {
							reject(new Error("Warning: Seek is disabled"));
							return;
						}
						break;
					case paella.SeekType.FORWARD_ONLY:
						if (newPositionPercent<currentPercent) {
							reject(new Error("Warning: Seek is disabled"));
							return;
						}
						break;
					case paella.SeekType.DISABLED:
						reject(new Error("Warning: Seek is disabled"));
						return;
					}

					this.setCurrentPercent(newPositionPercent)
						.then((timeData) => {
							this._force = true;
							this.triggerTimeupdate();
							paella.events.trigger(paella.events.seekToTime,{ newPosition:timeData.time });
							paella.events.trigger(paella.events.seekTo,{ newPositionPercent:newPositionPercent });
							resolve();
						});
				})
		});
	}

	seekToTime(time) {
		return new Promise((resolve, reject) => {
			paella.player.videoContainer.currentTime()
				.then((currentTime) => {
					// #DCE for DCE synch, reject seek when already seeking
					if (this._seekDisabled) {
						reject(new Error("Warning: Seek is currently disabled"));
						return;
					} // #DCE end DCE
					if (this._seekTimeLimit && this._seekType==paella.SeekType.BACKWARDS_ONLY) {
						currentTime = this._seekTimeLimit;
					}
					switch (this._seekType) {
					case paella.SeekType.FULL:
						break;
					case paella.SeekType.BACKWARDS_ONLY:
						if (time>currentTime) {
							reject(new Error("Warning: Seek is disabled"));
							return;
						}
						break;
					case paella.SeekType.FORWARD_ONLY:
						if (time<currentTime) {
							reject(new Error("Warning: Seek is disabled"));
							return;
						}
						break;
					case paella.SeekType.DISABLED:
						reject(new Error("Warning: Seek is disabled"));
						return;
					}

					this.setCurrentTime(time)
						.then((timeData) => {
							this._force = true;
							this.triggerTimeupdate();
							let percent = timeData.time * 100 / timeData.duration;
							paella.events.trigger(paella.events.seekToTime,{ newPosition:timeData.time });
							paella.events.trigger(paella.events.seekTo,{ newPositionPercent:percent });
						});
				});
		});
	}

	setPlaybackRate(params) {
		paella.events.trigger(paella.events.setPlaybackRate, { rate: params });
	}

	mute() {

	}

	unmute() {

	}

	setVolume(params) {
	}

	volume() {
		return 1;
	}

	trimStart() {
		return new Promise((resolve) => {
			resolve(this._trimming.start);
		});
	}

	trimEnd() {
		return new Promise((resolve) => {
			resolve(this._trimming.end);
		});
	}

	trimEnabled() {
		return new Promise((resolve) => {
			resolve(this._trimming.enabled);
		});
	}

	trimming() {
		return new Promise((resolve) => {
			resolve(this._trimming);
		});
	}

	enableTrimming() {
		this._trimming.enabled = true;
		let cap=paella.captions.getActiveCaptions()
		if(cap!==undefined) paella.plugins.captionsPlugin.buildBodyContent(cap._captions,"list");
		paella.events.trigger(paella.events.setTrim,{trimEnabled:this._trimming.enabled,trimStart:this._trimming.start,trimEnd:this._trimming.end});
	}

	disableTrimming() {
		this._trimming.enabled = false;
		let cap=paella.captions.getActiveCaptions()
		if(cap!==undefined) paella.plugins.captionsPlugin.buildBodyContent(cap._captions,"list");
		paella.events.trigger(paella.events.setTrim,{trimEnabled:this._trimming.enabled,trimStart:this._trimming.start,trimEnd:this._trimming.end});
	}

	setTrimming(start,end) {
		return new Promise((resolve) => {
			let currentTime = 0;

			this.currentTime(true)
				.then((c) => {
					currentTime = c;
					return this.duration();
				})

				.then((duration) => {
					this._trimming.start = Math.floor(start);
					this._trimming.end = Math.floor(end);
					// #DCE OPC-454 prevent trimming end being bigger than video duration
					// #DCE TODO: make into upstream patch?
					if (this._trimming.end > duration) {
						paella.log.warning(`Truncating parameter soft trim 'end' time '${this._trimming.end}' to video duration's closest full second '${Math.floor(duration)}'`);
						this._trimming.end = Math.floor(duration);
					} // #DCE OPC-454 end
					if(this._trimming.enabled){
						if (currentTime<this._trimming.start) {
							this.setCurrentTime(0);
						}
						if (currentTime>this._trimming.end) {
							this.setCurrentTime(duration);
						}

						let cap=paella.captions.getActiveCaptions();
						if(cap!==undefined) paella.plugins.captionsPlugin.buildBodyContent(cap._captions,"list");
					}
					paella.events.trigger(paella.events.setTrim,{trimEnabled:this._trimming.enabled,trimStart:this._trimming.start,trimEnd:this._trimming.end});
					resolve();
				});
		});
	}

	setTrimmingStart(start) {
 		return this.setTrimming(start,this._trimming.end);
	}

	setTrimmingEnd(end) {
		return this.setTrimming(this._trimming.start,end);
	}

	setCurrentPercent(percent) {
		var duration = 0;
		return new Promise((resolve) => {
			this.duration()
				.then((d) => {
					// #DCE OPC-445 trim to closest full second
					duration = Math.floor(d);
					return this.trimming();
				})
				.then((trimming) => {
					var position = 0;
					if (trimming.enabled) {
						var start = trimming.start;
						// #DCE OPC-454 prevent trim end being bigger than duration
						// #DCE TODO: make into upstream pull?
						var end = trimming.end == 0 || (trimming.end - start) > duration ? duration: trimming.end;
						duration = end - start;
						var trimedPosition = percent * duration / 100;
						position = parseFloat(trimedPosition);
					}
					else {
						position = percent * duration / 100;
					}
					return this.setCurrentTime(position);
				})
				.then(function(timeData) {
					resolve(timeData);
				});
		});
	}

	setCurrentTime(time) {
		paella.log.debug("VideoContainerBase.setCurrentTime(" +  time + ")");
	}

	currentTime() {
		paella.log.debug("VideoContainerBase.currentTime()");
		return 0;
	}

	duration() {
		paella.log.debug("VideoContainerBase.duration()");
		return 0;
	}

	paused() {
		paella.log.debug("VideoContainerBase.paused()");
		return true;
	}

	setupVideo(onSuccess) {
		paella.log.debug("VideoContainerBase.setupVide()");
	}

	isReady() {
		paella.log.debug("VideoContainerBase.isReady()");
		return true;
	}

	onresize() { super.onresize(onresize);
	}

	ended() {
		return new Promise((resolve) => {
			let duration = 0;
			this.duration()
				.then((d) => {
					duration = d;
					return this.currentTime();
				})
				.then((currentTime) => {
					resolve(Math.floor(duration) <= Math.ceil(currentTime));
				});
		});
	}
}

paella.VideoContainerBase = VideoContainerBase;

// Profile frame strategies

class ProfileFrameStrategy {
	static Factory() {
		var config = paella.player.config;

		try {
			var strategyClass = config.player.profileFrameStrategy;
			var ClassObject = paella.utils.objectFromString(strategyClass);
			var strategy = new ClassObject();
			if (strategy instanceof paella.ProfileFrameStrategy) {
				return strategy;
			}
		}
		catch (e) {
		}

		return null;
	}

	valid() { return true; }

	adaptFrame(videoDimensions,frameRect) {
		return frameRect;
	}
}

paella.ProfileFrameStrategy = ProfileFrameStrategy;

class LimitedSizeProfileFrameStrategy extends ProfileFrameStrategy {
	adaptFrame(videoDimensions,frameRect) {
		if (videoDimensions.width<frameRect.width|| videoDimensions.height<frameRect.height) {
			var frameRectCopy = JSON.parse(JSON.stringify(frameRect));
			frameRectCopy.width = videoDimensions.width;
			frameRectCopy.height = videoDimensions.height;
			var diff = { w:frameRect.width - videoDimensions.width,
						h:frameRect.height - videoDimensions.height };
			frameRectCopy.top = frameRectCopy.top + diff.h/2;
			frameRectCopy.left = frameRectCopy.left + diff.w/2;
			return frameRectCopy;
		}
		return frameRect;
	}
}

paella.LimitedSizeProfileFrameStrategy = LimitedSizeProfileFrameStrategy;

function updateBuffers() {
	// Initial implementation: use the mainStream buffered property
	let mainBuffered = this.mainPlayer && this.mainPlayer.buffered;
	if (mainBuffered) {
		this._bufferedData = [];

		for (let i = 0; i<mainBuffered.length; ++i) {
			this._bufferedData.push({
				start: mainBuffered.start(i),
				end: mainBuffered.end(i)
			});
		}
	}
}

class StreamProvider {
	constructor(videoData) {
		this._mainStream = null;
		this._videoStreams = [];
		this._audioStreams = [];

		this._mainPlayer = null;
		this._audioPlayer = null;
		this._videoPlayers = [];
		this._audioPlayers = [];
		this._players = [];

		this._autoplay = paella.utils.parameters.get('autoplay')=='true' || this.isLiveStreaming;
		this._startTime = 0;

		this._bufferedData = [];
		let streamProvider = this;
		this._buffered = {
			start: function(index) {
				if (index<0 || index>=streamProvider._bufferedData.length) {
					throw new Error("Buffered index out of bounds.");
				}
				return streamProvider._bufferedData[index].start;
			},

			end: function(index) {
				if (index<0 || index>=streamProvider._bufferedData.length) {
					throw new Error("Buffered index out of bounds.");
				}
				return streamProvider._bufferedData[index].end;
			}
		}

		Object.defineProperty(this._buffered, "length", {
			get: function() {
				return streamProvider._bufferedData.length;
			}
		});
	}

	get buffered() {
		updateBuffers.apply(this);
		return this._buffered;
	}

	init(videoData) {
		if (videoData.length==0) throw Error("Empty video data.");
		this._videoData = videoData;

		if (!this._videoData.some((stream) => { return stream.role=="master"; })) {
			this._videoData[0].role = "master";
		}

		this._videoData.forEach((stream, index) => {
			stream.type = stream.type || 'video';
			if (stream.role=='master') {
				this._mainStream = stream;
			}

			if (stream.type=='video') {
				this._videoStreams.push(stream);
			}
			else if (stream.type=='audio') {
				this._audioStreams.push(stream);
			}
		});

		if (this._videoStreams.length==0) {
			throw new Error("No video streams found. Paella Player requires at least one video stream.");
		}

		// Create video players
		let autoplay = this.autoplay;
		this._videoStreams.forEach((videoStream,index) => {
			let rect = {x:0,y:0,w:1280,h:720};
			let player = paella.videoFactory.getVideoObject(`video_${ index }`, videoStream, rect);
			player.setVideoQualityStrategy(this._qualityStrategy);
			player.setAutoplay(autoplay);

			if (videoStream==this._mainStream) {
				this._mainPlayer = player;
				this._audioPlayer = player;
			}
			else {
				player.setVolume(0);
			}

			this._videoPlayers.push(player);
			this._players.push(player);
		});

		// Create audio player
		this._audioStreams.forEach((audioStream,index) => {
			let player = paella.audioFactory.getAudioObject(`audio_${ index }`,audioStream);
			player.setAutoplay(autoplay);
			if (player) {
				this._audioPlayers.push(player);
				this._players.push(player);
			}
		});
	}

	startVideoSync(syncProviderPlayer) {
		this._syncProviderPlayer = syncProviderPlayer;
		this._audioPlayer = syncProviderPlayer; // The player that provides the synchronization is also used as main audio player.
		this.stopVideoSync();

		console.debug("Start sync to player:");
		console.debug(this._syncProviderPlayer);
		let maxDiff = 0.1;
		let totalTime = 0;
		let numberOfSyncs = 0;
		let syncFrequency = 0;
		let maxSyncFrequency = 0.2;
		let sync = () => {
			this._syncProviderPlayer.currentTime()
				.then((t) => {
					this.players.forEach((player) => {
						if (player!=syncProviderPlayer &&
							player.currentTimeSync!=null &&
							Math.abs(player.currentTimeSync-t)>maxDiff)
						{
							console.debug(`Sync player current time: ${ player.currentTimeSync } to time ${ t }`);
							console.debug(player);
							++numberOfSyncs;
							player.setCurrentTime(t);


							if (syncFrequency>maxSyncFrequency) {
								maxDiff *= 1.5;
								console.log(`Maximum syncrhonization frequency reached. Increasing max difference syncronization time to ${maxDiff}`);
							}
						}
					});

				});

			totalTime += 1000;
			syncFrequency = numberOfSyncs / (totalTime / 1000);
			this._syncTimer = setTimeout(() => sync(), 1000);
		};

		this._syncTimer = setTimeout(() => sync(), 1000);
	}

	stopVideoSync() {
		if (this._syncTimer) {
			console.debug("Stop video sync");
			clearTimeout(this._syncTimer);
			this._syncTimer = null;
		}
	}

	loadVideos() {
		let promises = [];

		this._players.forEach((player) => {
			promises.push(player.load());
		});

		return Promise.all(promises);
	}

	get startTime() {
		return this._startTime;
	}

	set startTime(s) {
		this._startTime = s;
	}

	get isMonostream() {
		return this._videoStreams.length==1;
	}

	get mainStream() {
		return this._mainStream;
	}

	get videoStreams() {
		//return this._videoData;
		return this._videoStreams;
	}


	get audioStreams() {
		return this._audioStreams;
	}

	get streams() {
		return this._videoStreams.concat(this._audioStreams);
	}

	get videoPlayers() {
		return this._videoPlayers;
	}

	get audioPlayers() {
		return this._audioPlayers;
	}

	get players() {
		return this._videoPlayers.concat(this._audioPlayers);
	}

	callPlayerFunction(fnName) {
		let promises = [];
		let functionArguments = [];
		for (let i=1; i<arguments.length; ++i) {
			functionArguments.push(arguments[i]);
		}

		this.players.forEach((player) => {
			promises.push(player[fnName](...functionArguments));
		});

		return new Promise((resolve,reject) => {
			Promise.all(promises)
				.then(() => {
					if (fnName=='play' && !this._firstPlay) {
						this._firstPlay = true;
						if (this._startTime) {
							this.players.forEach((p) => p.setCurrentTime(this._startTime));
						}
					}
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	get mainVideoPlayer() {
		return this._mainPlayer;
	}

	get mainAudioPlayer() {
		return this._audioPlayer;
	}

	get mainPlayer() {
		return this.mainVideoPlayer || this.mainAudioPlayer;
	}

	get isLiveStreaming() {
		return paella.player.isLiveStream();
	}

	set qualityStrategy(strategy) {
		this._qualityStrategy = strategy;
		this._videoPlayers.forEach((player) => {
			player.setVideoQualityStrategy(strategy);
		})
	}

	get qualityStrategy() { return this._qualityStrategy || null; }

	get autoplay() {
		return this.supportAutoplay && this._autoplay;
	}

	set autoplay(ap) {
		if (!this.supportAutoplay || this.isLiveStreaming) return;
		this._autoplay = ap;
		if (this.videoPlayers) {
			this.videoPlayers.forEach((player) => player.setAutoplay(ap));
			this.audioPlayers.forEach((player) => player.setAutoplay(ap));
		}
	}

	get supportAutoplay() {
		return this.videoPlayers.every((player) => player.supportAutoplay());
	}
}

paella.StreamProvider = StreamProvider;

function addVideoWrapper(id,videoPlayer) {
	let wrapper = new paella.VideoWrapper(id);
	wrapper.addNode(videoPlayer);
	this.videoWrappers.push(wrapper);
	this.container.addNode(wrapper);
	return wrapper;
}

class VideoContainer extends paella.VideoContainerBase {

	get streamProvider() { return this._streamProvider; }
	get ready() { return this._ready; }
	get isMonostream() { return this._streamProvider.isMonostream; }
	get trimmingHandler() { return this._trimmingHandler; }
	get videoWrappers() { return this._videoWrappers; }
	get container() { return this._container; }
	get profileFrameStrategy() { return this._profileFrameStrategy; }
	get sourceData() { return this._sourceData; }

	constructor(id) {
		super(id);

		this._streamProvider = new paella.StreamProvider();
		this._ready = false;
		this._videoWrappers = [];

		this._container = new paella.DomNode('div','playerContainer_videoContainer_container',{position:'relative',display:'block',marginLeft:'auto',marginRight:'auto',width:'1024px',height:'567px'});
		this._container.domElement.setAttribute('role','main');
		this.addNode(this._container);

		this.overlayContainer = new paella.VideoOverlay(this.domElement);
		this.container.addNode(this.overlayContainer);

		this.setProfileFrameStrategy(paella.ProfileFrameStrategy.Factory());
		this.setVideoQualityStrategy(paella.VideoQualityStrategy.Factory());

		this._audioTag = paella.player.config.player.defaultAudioTag ||
						 paella.utils.dictionary.currentLanguage();
		this._audioPlayer = null;

		// Initial volume level
		this._volume = paella.utils.cookies.get("volume") ? Number(paella.utils.cookies.get("volume")) : 1;
		if (paella.player.startMuted)
		{
			this._volume = 0;
		}
		this._muted = false;
		this._seeking = false; // #DCE OPC-428
	}

	// Playback and status functions
	play() {
		let thisClass = this; // #DCE Needed for FF seek promise
		return new Promise((resolve,reject) => {
			this.ended()
				.then((ended) => {
					if (ended) {
						// #DCE created UPV pull https://github.com/polimediaupv/paella/pull/572
						// Wait for seek to complete before requesting play, or risk media freeze-up (i.e. FireFox)
						// The readystate patch UPV made for FF and linked to pull above,
						// is a different but related FF issue
						$(document).bind(paella.events.seekToTime, function (event, params) {
							$(document).unbind(paella.events.seekToTime);
							// Now it's safe to call this method again.
							// Ended state evaluates to false because of the seek.
							return thisClass.play();
						});
						this._streamProvider.startTime = 0;
						this.seekToTime(0);
					}
					else {
						this.streamProvider.startTime = this._startTime;
						// Call separately from the ended state handling, or risk media freeze-up.
						return this.streamProvider.callPlayerFunction('play');
					}
					// #DCE end promise update
				})
				.then(() => {
					super.play();
					resolve();
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	pause() {
		return new Promise((resolve,reject) => {
			this.streamProvider.callPlayerFunction('pause')
				.then(() => {
					super.pause();
					resolve();
				})
				.catch((err) => {
					reject(err);
				})
		});
	}

	setCurrentTime(time) {
		return new Promise((resolve,reject) => {
			// TODO: Make UPV patches for following
			// #DCE OPC-454 don't play after trim end
			let wasPlaying, isTrimEnd = false;
			this.trimming()
				.then((trimmingData) => {
					if (trimmingData.enabled) {
						time += trimmingData.start;
						if (time<trimmingData.start) {
							time = trimmingData.start;
						}
						// #DCE TODO: make >= into upstream patch
						if (time >= trimmingData.end) {
							time = trimmingData.end;
							isTrimEnd = true; // #DCE OPC-454
						}
					}
					//#DCE OPC-428 load the load spinner while #DCE OPC-407 pause if not already paused before setting time
					paella.player.loader.seekload();
					this._seeking = true;
					return this.paused();
				})
				.then(paused => {
					if (! paused) {
						wasPlaying = true;
						return this.pause();
					} else {
						return Promise.resolve();
					}
				})
				.then(() => {
					return this.streamProvider.callPlayerFunction('setCurrentTime', time);
				})
				.then(() => {
					return this.duration(true);
				})
				.then((duration) => {
					// #DCE OPC-428 take loader overlay off after seeking to the new time
					paella.player.loader.loadComplete();
					this._seeking = false;
					//#DCE OPC-407 play if was playing before setting time,
					// but not if seeked to end of video
					if (wasPlaying && Math.floor(duration) > time && !isTrimEnd) {
						return this.play();
					} else {
						return Promise.resolve();
					}
				})
				.then(() => {
					return this.duration(false);
				})

				.then((duration) => {
					resolve({ time:time, duration:duration });
				})

				.catch((err) => {
					reject(err);
				})
		})
	}

	currentTime(ignoreTrimming = false) {
		return new Promise((resolve) => {
			let trimmingData = null;
			let p = ignoreTrimming ? Promise.resolve({ enabled:false }) : this.trimming();

			p.then((t) => {
				trimmingData = t
				// #DCE protection from early load plugin logging
				// TODO: make UPV patch
				if (!this.masterVideo()) {
					return 0;
				}
				return this.masterVideo().currentTime();
			})

			.then((time) => {
				if (trimmingData.enabled) {
					time = time - trimmingData.start;
				}
				if (time < 0) time = 0;
				resolve(time)
			});
		});
	}

	setPlaybackRate(rate) {
		this.streamProvider.callPlayerFunction('setPlaybackRate',rate);
		super.setPlaybackRate(rate);
	}

	mute() {
		return new Promise((resolve) => {
			this._muted = true;
			this._audioPlayer.setVolume(0)
				.then(() => {
					paella.events.trigger(paella.events.setVolume, { master: 0 });
					resolve();
				});
		});
	}

	unmute() {
		return new Promise((resolve) => {
			this._muted = false;
			this._audioPlayer.setVolume(this._volume)
				.then(() => {
					paella.events.trigger(paella.events.setVolume, { master: this._volume });
					resolve();
				});
		});
	}

	get muted() {
		return this._muted;
	}

	setVolume(params) {
		if (typeof(params)=='object') {
			console.warn("videoContainer.setVolume(): set parameter as object is deprecated");
			return Promise.resolve();
		}
		else if (params==0) {
			return this.mute();
		}
		else {
			return new Promise((resolve,reject) => {
				paella.utils.cookies.set("volume",params);
				this._volume = params;
				this._audioPlayer.setVolume(params)
					.then(() => {
						paella.events.trigger(paella.events.setVolume, { master:params });
						resolve(params);
					})
					.catch((err) => {
						reject(err);
					});
			});
		}
	}

	volume() {
		return this._audioPlayer.volume();
	}

	duration(ignoreTrimming = false) {
		return new Promise((resolve) => {
			let trimmingData = null;
			let p = ignoreTrimming ? Promise.resolve({ enabled:false }) : this.trimming();

			p.then((t) => {
				trimmingData = t;
				return this.masterVideo().duration();
			})

			.then((duration) => {
				if (trimmingData.enabled) {
					// #DCE OPC-454 prevent trim end/duration being larger than actual video duration
					// #DCE make into upstream patch? (see other instances above)
					let trimDuration = trimmingData.end - trimmingData.start;
					duration = trimDuration == 0 || trimDuration > duration ? duration: trimDuration;
				}
				resolve(duration);
			});
		})
	}

	paused() {
		return this.masterVideo().isPaused();
	}

	// Video quality functions
	getQualities() {
		return this.masterVideo().getQualities();
	}

	setQuality(index) {
		let qualities = [];
		let promises = [];
		this.streamProvider.videoPlayers.forEach((player) => {
			let playerData = {
				player:player,
				promise:player.getQualities()
			};
			qualities.push(playerData);
			promises.push(playerData.promise);
		});

		return new Promise((resolve) => {
			let resultPromises = [];
			Promise.all(promises)
				.then(() => {
					qualities.forEach((data) => {
						data.promise.then((videoQualities) => {
							let videoQuality = videoQualities.length>index ? index:videoQualities.length - 1;
							resultPromises.push(data.player.setQuality(videoQuality));
						});
					});

					return Promise.all(resultPromises);
				})

				.then(() => {
					//setTimeout(() => {
						paella.events.trigger(paella.events.qualityChanged);
						resolve();
					//},10);
				});
		});
	}
	getCurrentQuality() {
		return this.masterVideo().getCurrentQuality();
	}

	// Current audio functions
	get audioTag() {
		return this._audioTag;
	}

	get audioPlayer() {
		return this._audioPlayer;
	}

	getAudioTags() {
		return new Promise((resolve) => {
			let lang = [];
			let p = this.streamProvider.players;
			p.forEach((player) => {
				if (player.stream.audioTag) {
					lang.push(player.stream.audioTag);
				}
			})
			resolve(lang);
		})
	}

	setAudioTag(lang) {
		this.streamProvider.stopVideoSync();
		return new Promise((resolve) => {
			let audioSet = false;
			let firstAudioPlayer = null;
			let promises = [];
			// #DCE OPC-552, it's Ok to let the firstAudioPlayer be different
			// than this._audioPlayer. Since firstAudioPlayer is never referenced
			//  again once the audioSet is set to true on the first find match.
			this.streamProvider.players.forEach((player) => {
				if (!firstAudioPlayer) {
					firstAudioPlayer = player;
				}

				if (!audioSet && player.stream.audioTag==lang) {
					audioSet = true;
					this._audioPlayer = player;
				}
				promises.push(player.setVolume(0));
			});

			// NOTE: The audio only streams must define a valid audio tag
			if (!audioSet && this.streamProvider.mainVideoPlayer) {
				this._audioPlayer = this.streamProvider.mainVideoPlayer;
			}
			else if (!audioSet && firstAudioPlayer) {
				this._audioPlayer = firstAudioPlayer;
			}

			Promise.all(promises).then(() => {
				return this._audioPlayer.setVolume(this._volume);
			})

			.then(() => {
				this._audioTag = this._audioPlayer.stream.audioTag;
				paella.events.trigger(paella.events.audioTagChanged);
				// #DCE, DCE video swapout prevents use of default UPV synch strategy
				// Re-assess if re-writing single video toggle & enable/disabled in multi-toggle
				// this.streamProvider.startVideoSync(this.audioPlayer);
				resolve();
			});
		})
	}

	setProfileFrameStrategy(strategy) {
		this._profileFrameStrategy = strategy;
	}

	setVideoQualityStrategy(strategy) {
		this.streamProvider.qualityStrategy = strategy;
	}

	autoplay() { return this.streamProvider.autoplay; }
	supportAutoplay() { return this.streamProvider.supportAutoplay; }
	setAutoplay(ap=true) {
		this.streamProvider.autoplay = ap;
		return this.streamProvider.supportAutoplay;
	}

	masterVideo() {
		return this.streamProvider.mainVideoPlayer || this.audioPlayer;
	}

	getVideoRect(videoIndex) {
		if (this.videoWrappers.length>videoIndex) {
			return this.videoWrappers[videoIndex].getRect();
		}
		else {
			throw new Error(`Video wrapper with index ${ videoIndex } not found`);
		}
	}

	setStreamData(videoData) {
		var urlParamTime = paella.utils.parameters.get("time");
		var hashParamTime = paella.utils.hashParams.get("time");
		var timeString = hashParamTime ? hashParamTime:urlParamTime ? urlParamTime:"0s";
		var startTime = paella.utils.timeParse.timeToSeconds(timeString);
		if (startTime) {
			this._startTime = startTime;
		}

		videoData.forEach((stream) => {
			for (var type in stream.sources) {
				let source = stream.sources[type];
				source.forEach((item) => {
					if (item.res) {
						item.res.w = Number(item.res.w);
						item.res.h = Number(item.res.h);
					}
				});
			}
		});
		this._sourceData = videoData;
		return new Promise((resolve,reject) => {
			this.streamProvider.init(videoData);

			let streamDataAudioTag = null;
			videoData.forEach((video) => {
				if (video.audioTag && streamDataAudioTag==null) {
					streamDataAudioTag = video.audioTag;
				}

				if (video.audioTag==this._audioTag) {
					streamDataAudioTag = this._audioTag;
				}
			});

			if (streamDataAudioTag!=this._audioTag && streamDataAudioTag!=null) {
				this._audioTag = streamDataAudioTag;
			}

			this.streamProvider.videoPlayers.forEach((player,index) => {
				addVideoWrapper.apply(this,['videoPlayerWrapper_' + index,player]);
				player.setAutoplay(this.autoplay());
			});

			this.streamProvider.loadVideos()
				.catch((err) => {
					reject(err)
				})

				.then(() => {
					return this.setAudioTag(this.audioTag);
				})

				.then(() => {
					let endedTimer = null;
					let setupEndEventTimer = () => {
						this.stopTimeupdate();
						if (endedTimer) {
							clearTimeout(endedTimer);
							endedTimer = null;
						}
						endedTimer = setTimeout(() => {
							paella.events.trigger(paella.events.ended);
						}, 1000);
					}

					let eventBindingObject = this.masterVideo().video || this.masterVideo().audio;
					$(eventBindingObject).bind('timeupdate', (evt) => {
						this.trimming().then((trimmingData) => {
							let current = evt.currentTarget.currentTime;
							let duration = evt.currentTarget.duration;
							if (trimmingData.enabled) {
								current -= trimmingData.start;
								duration = trimmingData.end - trimmingData.start;
							}
							if (current>=duration) {
								this.streamProvider.callPlayerFunction('pause');
								setupEndEventTimer();
							}
						})
					});

					paella.events.bind(paella.events.endVideo,(event) => {
						setupEndEventTimer();
					});

					this._ready = true;
					paella.events.trigger(paella.events.videoReady);
					let profileToUse = paella.utils.parameters.get('profile') ||
										paella.utils.cookies.get('profile') ||
										paella.profiles.getDefaultProfile();

					if (paella.profiles.setProfile(profileToUse, false)) {
						resolve();
					}
					else if (!paella.profiles.setProfile(paella.profiles.getDefaultProfile(), false)) {
						resolve();
					}
				});
		});
	}

	resizePortrait() {
		var width = (paella.player.isFullScreen() == true) ? $(window).width() : $(this.domElement).width();
		var relativeSize = new paella.RelativeVideoSize();
		var height = relativeSize.proportionalHeight(width);
		this.container.domElement.style.width = width + 'px';
		this.container.domElement.style.height = height + 'px';

		var containerHeight = (paella.player.isFullScreen() == true) ? $(window).height() : $(this.domElement).height();
		var newTop = containerHeight / 2 - height / 2;
		this.container.domElement.style.top = newTop + "px";
	}

	resizeLandscape() {
		var height = (paella.player.isFullScreen() == true) ? $(window).height() : $(this.domElement).height();
		if (paella.utils.userAgent.system.iPhone && window) { // #DCE OPC-425 iPhone in landscape with tabs
			height = window.innerHeight;
		}
		var relativeSize = new paella.RelativeVideoSize();
		var width = relativeSize.proportionalWidth(height);
		this.container.domElement.style.width = width + 'px';
		this.container.domElement.style.height = height + 'px';
		this.container.domElement.style.top = '0px';
	}

	onresize() {
		super.onresize();
		var relativeSize = new paella.RelativeVideoSize();
		var aspectRatio = relativeSize.aspectRatio();
		var width = (paella.player.isFullScreen() == true) ? $(window).width() : $(this.domElement).width();
		var height = (paella.player.isFullScreen() == true) ? $(window).height() : $(this.domElement).height();
		if (paella.utils.userAgent.system.iPhone && window) { // #DCE OPC-425 iPhone in landscape with tabs
			width = window.innerWidth;
			height = window.innerHeight;
		}
		var containerAspectRatio = width/height;

		if (containerAspectRatio>aspectRatio) {
			this.resizeLandscape();
		}
		else {
			this.resizePortrait();
		}
		//paella.profiles.setProfile(paella.player.selectedProfile,false)
	}

	// the duration and the current time are returned taking into account the trimming, for example:
	//	trimming: { enabled: true, start: 10, end: 110 }
	//	currentTime: 0,	> the actual time is 10
	//	duration: 100 > the actual duration is (at least) 110
	getVideoData() {
		return new Promise((resolve,reject) => {
			let videoData = {
				currentTime: 0,
				volume: 0,
				muted: this.muted,
				duration: 0,
				paused: false,
				audioTag: this.audioTag,
				trimming: {
					enabled: false,
					start: 0,
					end: 0
				}
			}
			this.currentTime()
				.then((currentTime) => {
					videoData.currentTime = currentTime;
					return this.volume();
				})
				.then((v) => {
					videoData.volume = v;
					return this.duration();
				})
				.then((d) => {
					videoData.duration = d;
					return this.paused();
				})
				.then((p) => {
					videoData.paused = p;
					return this.trimming();
				})
				.then((trimming) => {
					videoData.trimming = trimming;
					resolve(videoData);
				})
				.catch((err) => reject(err));
		});
	}
}

paella.VideoContainer = VideoContainer;

})();
