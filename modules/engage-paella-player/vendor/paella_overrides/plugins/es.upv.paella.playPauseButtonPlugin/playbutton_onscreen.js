/* #DCE Paella 6.5.5 overrides */
/* #DCE Keeping Override OPC-430 replay play event has a shorter timeout than endVideo */
/* #DCE Removed Overrides OPC-497 and OPC-240 associated to live HLS */
paella.addPlugin(function() {
	return class PlayButtonOnScreen extends paella.EventDrivenPlugin {
		constructor() {
			super();
			this.containerId = 'paella_plugin_PlayButtonOnScreen';
			this.container = null;
			this.enabled = true;
			this.isPlaying = false;
			this.showIcon = true;
			this.firstPlay = false;
		}
	
		checkEnabled(onSuccess) {
			this.showOnEnd = true;
			paella.data.read('relatedVideos', {id:paella.player.videoIdentifier}, (data) => {
                this.showOnEnd = !Array.isArray(data) ||  data.length == 0;
			});
			
			onSuccess(true);
		}
	
		getIndex() { return 1010; }
		getName() { return "es.upv.paella.playButtonOnScreenPlugin"; }
	
		setup() {
			this.container = paella.LazyThumbnailContainer.GetIconElement();
			paella.player.videoContainer.domElement.appendChild(this.container);
			$(this.container).click(() =>  this.onPlayButtonClick());
		}
	
		getEvents() {
			return [
				paella.events.ended,
				paella.events.endVideo,
				paella.events.play,
				paella.events.pause,
				paella.events.showEditor,
				paella.events.hideEditor
			];
		}
	
		onEvent(eventType,params) {
			switch (eventType) {
				case paella.events.ended:
				case paella.events.endVideo:
					this.endVideo();
					break;
				case paella.events.play:
					this.play();
					break;
				case paella.events.pause:
					this.pause();
					break;
				case paella.events.showEditor:
					this.showEditor();
					break;
				case paella.events.hideEditor:
					this.hideEditor();
					break;
			}
		}
	
		onPlayButtonClick() {
			this.firstPlay = true;
			this.checkStatus();
		}

		// #DCE OPC-430 separate out the end action for endVideo
		endAction() {
			this.isPlaying = false;
			this.showIcon = this.showOnEnd;
			this.checkStatus();
			paella.log.debug(`BTN ON SCREEN: Showing player icon or changing status: the player has ended.`);
		}
	
		endVideo() {
			// #DCE OPC-430 replay play event has a shorter timeout than endVideo, so double check that video is still ended.
			paella.player.videoContainer.ended()
			.then(ended => {
				// Special case for FF to match special FF end case
				// https://github.com/polimediaupv/paella/blob/6.2.x/src/03_video_nodes.js#L809-L815
				if (!ended && paella.utils.userAgent.browser.Firefox) {
					paella.player.videoContainer.masterVideo().getVideoData()
					.then(data => {
						if (data && data.currentTime == 0 && data.paused) {
							this.endAction();
						}
					});
				} else if (ended) {
					this.endAction();
				} else {
					paella.log.debug(`BTN ON SCREEN: The player has no longer ended! Not showing play icon or changing existing status.`);
				}
			});
		}
	
		play() {
			this.isPlaying = true;
			this.showIcon = false;
			if (!/dimmed/.test(this.container.className)) {
				this.container.className += " dimmed";
			}
			this.checkStatus();
		}
	
		pause() {
			if (paella.player.videoContainer.seeking) {
				paella.log.debug(`BTN ON SCREEN: The player is seeking, not showing play icon or changing existing status.`);
			} else {
				this.isPlaying = false;
				this.showIcon = this.config.showOnPause;
				this.checkStatus();
			}
		}
	
		showEditor() {
			this.enabled = false;
			this.checkStatus();
		}
	
		hideEditor() {
			this.enabled = true;
			this.checkStatus();
		}
		
		checkStatus() {
			if ((this.enabled && this.isPlaying) || !this.enabled || !this.showIcon) {
				$(this.container).hide();
			}
			// Only show play button if none of the video players require mouse events
			else if (!paella.player.videoContainer.streamProvider.videoPlayers.every((p) => p.canvasData.mouseEventsSupport)) {
				$(this.container).show();
			}
		}	
	}
});

