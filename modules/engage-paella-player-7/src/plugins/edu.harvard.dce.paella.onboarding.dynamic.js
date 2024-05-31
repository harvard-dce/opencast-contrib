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
/* eslint-disable max-len */
import { EventLogPlugin, Events } from 'paella-core';

import Shepherd from 'shepherd.js';
import DceUtils from '../js/DceUtils';
import '../css/edu.harvard.dce.paella.onboarding.css';
// Updated Webpack lib to retrieve from node_modules project
import '../../node_modules/shepherd.js/dist/css/shepherd.css';

/* #DCE dynamic version
 * 1. list of plugins that DCE wants to describe along with text
 * 2. Generate the list using the plugins tab order
 * 3. Activate container plugin if the plugin has one
 * 4. Deactivate parent container after items inside have been described
 * or the onboarding help is exited
 * 5. Continue to skip buttons that are not currently enabled
 */
export default class OnboardingPlugin extends EventLogPlugin {

  static PLUGINS_TO_DESCRIBE = [
    {
      plugin: 'es.upv.paella.volumeButtonPlugin',
      title: 'DCE Player: Volume Control',
      text: 'Adjust video volume. <p/>Click the tool to make the audio louder, more quite, or mute.',
      attachTo: {
        element: 'button[name="es.upv.paella.volumeButtonPlugin"]',
        on: 'top'
      }
    },
    {
      plugin: 'es.upv.paella.playPauseButton',
      title: 'DCE Player: Play and Pause Toggle',
      text: 'You can play and pause the video. <p/>Click the tool to alternate playing and pausing the video.',
      attachTo: {
        element: 'button[name="es.upv.paella.playPauseButton"]',
        on: 'top'
      }
    },
    {
      plugin: 'es.upv.paella.override.playPauseButton',
      title: 'DCE Player: Play and Pause Toggle',
      text: 'You can play and pause the video. <p/>Click to alternate playing and pausing the video.',
      attachTo: {
        element: 'button[name="es.upv.paella.override.playPauseButton"]',
        on: 'top'
      }
    },
    {
      plugin: 'es.upv.paella.forwardButtonPlugin',
      title: 'DCE Player: Video Navigation',
      text: 'This control allows you to skip forward.',
      attachTo: {
        element: 'button[name="es.upv.paella.forwardButtonPlugin"]',
        on: 'top'
      }
    },
    {
      plugin: 'es.upv.paella.backwardButtonPlugin',
      title: 'DCE Player: Video Navigation',
      text: 'We also offer skip controls to help you navigate forward or backwards by set amounts. <p/>For instance, to skip back 10 seconds to hear something again that you may have missed.',
      attachTo: {
        element: 'button[name="es.upv.paella.backwardButtonPlugin"]',
        on: 'top'
      }
    },
    {
      plugin: 'es.upv.paella.frameControlButtonPlugin',
      title: 'DCE Player: Video Navigation',
      text: 'You can use the slide tool to skip to a specific part of the video based on what content was being presented. <p/>Click the tool and then click a slide to jump to that section of the video.',
      attachTo: {
        element: 'button[name="es.upv.paella.frameControlButtonPlugin"]',
        on: 'top'
      }
    },
    // Tour: Speeding up / slowing down
    {
      plugin: 'es.upv.paella.playbackRateButton',
      title: 'DCE Player: Speeding Up / Slowing Down Playback',
      text: 'You can increase/decrease the playback speed via the playback speed control. <p/>Click it and you\'ll get a set of choices. Select "1x" to set playback speed back to normal.',
      attachTo: {
        element: 'button[name="es.upv.paella.playbackRateButton"]',
        on: 'top'
      }
    },
    // Tour: The default UPV full screen plugin button
    {
      plugin: 'es.upv.paella.fullscreenButton',
      title: 'DCE Player: Full Screen Mode',
      text: 'Use the "full screen" tool to maximize the size of the videos in your web browser. Press the escape key to exit, or simply click the control again.',
      attachTo: {
        element: 'button[name="es.upv.paella.fullscreenButton"]',
        on: 'top'
      }
    },
    // Tour: "Temporary" full screen override plugin button
    {
      plugin: 'es.upv.paella.override.fullscreenButton',
      title: 'DCE Player: Full Screen Mode',
      text: 'Use the "full screen" tool to maximize the size of the videos in your web browser. Press the escape key to exit, or simply click the control again.',
      attachTo: {
        element: 'button[name="es.upv.paella.override.fullscreenButton"]',
        on: 'top'
      }
    },
    // Tour: Class handouts
    {
      plugin: 'edu.harvard.dce.paella.infoMenu',
      title: 'DCE Player: Class Handouts',
      text: 'A "Class Handout" link appears in the help menu if the publication contains an attached handout. <p/>Click the "Class Handout" link to access the handout. PDF files may open in another window instead of downloading.',
      attachTo: {
        element: 'button[name="edu.harvard.dce.paella.infoMenu"]',
        on: 'top'
      }
    },
    // Tour: Captions - using caption selector as active key to the group
    {
      plugin: 'edu.harvard.dce.paella.captionTogglePlugin',
      title: 'DCE Player: Captions',
      text: 'A closed caption icon (CC) appears on the control bar \
          if the publication contains closed captions. \
          <p/>Click closed caption icon to enable and disable closed caption.',
      attachTo: {
        element: 'button[name="edu.harvard.dce.paella.captionTogglePlugin"]',
        on: 'top'
      }
    },
    // Tour: Layout
    {
      plugin: 'es.upv.paella.layoutSelector',
      title: 'DCE Player: Changing the Layout of the Videos',
      text: 'You can switch between several layouts designed to emphasize the camera or the presentation, depending on the current focus of what\'s happening in the video. <p/>For instance, if the instructor is working on a problem you might want to see the projected chalkboard in as much detail as possible. Switching layouts lets you do this.',
      attachTo: {
        element: 'button[name="es.upv.paella.layoutSelector"]',
        on: 'top'
      }
    },
    // Tour: OC Social Plugin
    {
      plugin: 'edu.harvard.dce.paella.socialPlugin',
      title: 'DCE Player: Social',
      text: 'The Opencast Social button appears \
          when the video allows students to share comments \
          in the context of the video. \
          <p/>Click the OC Social icon to view and create comments.',
      attachTo: {
        element: 'button[id="edu.harvard.dce.paella.socialPlugin"]',
        on: 'top'
      }
    },
    // Tour: Settings - using information links as active key to the group
    {
      plugin: 'org.opencast.paella.toolsGroupPlugin',
      title: 'DCE Player: Settings',
      text: 'The settings group contains a list of options \
            <ul> \
              <li>playback speed</li> \
              <li>video resolution</li> \
              <li>help links</li> \
              <li>information about the player</li> \
            </ul> \
            <p/>Click the settings link to access these options.',
      attachTo: {
        element: 'button[name="org.opencast.paella.toolsGroupPlugin"]',
        on: 'top'
      }
    },
    {
      plugin: 'es.upv.paella.keyboardShortcutsHelp',
      title: 'DCE Player: Keyboard Shortcuts',
      text: 'Some basic functions of the player can be used with \
          the keyboard. <p/>Click keyboard icon to view the keys.',
      attachTo: {
        element: 'button[name="es.upv.paella.keyboardShortcutsHelp"]',
        on: 'top'
      }
    },
    {
      plugin: 'es.upv.paella.override.keyboardShortcutsHelp',
      title: 'DCE Player: Keyboard Shortcuts',
      text: 'Some basic functions of the player can be used with \
          the keyboard. <p/>Click keyboard icon to view the keys.',
      attachTo: {
        element: 'button[name="es.upv.paella.override.keyboardShortcutsHelp"]',
        on: 'top'
      }
    }
  ];

  isEnabled () {
    // #DCE OPC-870 Disable onboarding for iPads
    // #DCE OPC-892 disable onboarding when IC embedded
    const isImmersiveClassroomEmbedded = window.name.startsWith('DCE-iframe-API');
    const isIPad = DceUtils.testIfIPad();
    return !(isIPad || isImmersiveClassroomEmbedded);
  }

  get events() {
    return [
      Events.PLAYER_LOADED
    ];
  }

  // eslint-disable-next-line no-unused-vars
  async onEvent(evt, params) {
    const hideUI = await this.player.preferences.get('onboarding_hideUI', { global: true });
    this.player.log.info(`onboardinghelp hideUI=${hideUI === true}`);

    const tour = await this.buildTour();
    if (hideUI !== true) {
      setTimeout(() => {
        this.player.pause();
        this.player.pauseCaptureShortcuts();
      }, 200);
      tour.start();
    }
  }

  async buildTour() {
    const tour = new Shepherd.Tour({
      tourName: 'paella-onboarding',
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'paella-onboarding',
        scrollTo: true,
        highlightClass: 'paella-onboarding-highlight',
        canClickTarget: true,
        cancelIcon: {
          enabled: true
        },
        buttons: [
          {
            text: 'Back',
            action: function (){ this.back(); }
          },
          {
            text: 'Next',
            action: function() { this.next(); }
          }
        ]
      }
    });

    await this.generateTourWelcomeSteps(tour);
    await this.generateTourSteps(tour);
    await this.generateTourGoodbyeSteps(tour);

    // Extra pause for Safari load
    ['show'].forEach(event => tour.on(event, () => {
      setTimeout(() => {
        this.player.pause();
        this.player.pauseCaptureShortcuts();
      }, 500);
    }));

    // Completion task
    ['complete', 'cancel'].forEach(event => tour.on(event, () => {
      this.player.resumeCaptureShortcuts();
      this.player.play();
    }));

    return tour;
  }

  async generateTourWelcomeSteps(tour) {
    // Tour: Introduction
    tour.addSteps([
      {
        title: 'Welcome to the DCE Video Player Tutorial',
        text: 'This player displays one or more video(s) - along with variable control options on the lower menu bar. <p/>You can begin viewing the lecture by pressing the play button on top of the video window or in the control bar.',
        buttons: [
          {
            text: 'Don\'t show again',
            action: async () => {
              await this.player.preferences.set('onboarding_hideUI', true, { global: true });
              tour.cancel();
            }
          },
          {
            text: 'Next',
            action: tour.next
          }
        ]
      }
    ]);
  }

  async generateTourSteps(tour) {
    // Tour: Video navigation
    tour.addStep({
      title: 'DCE Player: Video navigation',
      text: 'This is the timeline. You can navigate to any time in the video by clicking the timeline.',
      attachTo: {
        element: '.playback-bar .progress-indicator',
        on: 'top'
      }
    });
    // Short hand for player config
    const conf = this.player?.config;
    // Filter out non-active plugins
    const filteredPlugins = OnboardingPlugin.PLUGINS_TO_DESCRIBE.filter((p) => {
      const enabled = conf?.plugins[p.plugin]?.enabled;
      const rendered = document.querySelector(p.attachTo.element);
      return enabled && rendered;
    });
    filteredPlugins.forEach((p) => {
      p.tabIndex = conf?.plugins[p.plugin]?.tabIndex;
      p.tabIndex = p.tabIndex ? p.tabIndex : 9999;
    });
    // Sort by tab index
    filteredPlugins.sort((a,b) => {
      return a.tabIndex - b.tabIndex;
    });
    // Add the plugins to the tour
    filteredPlugins.forEach(p => {
      this.player.log.debug(
        `Onboard step: ${p.plugin}, ${p.tabIndex}, ${p.attachTo.element}`
      );
      tour.addStep({
        title: p.title,
        text: p.text,
        attachTo: p.attachTo
      });
    });
  }

  async generateTourGoodbyeSteps(tour) {
    // Tour: Goodbye
    tour.addSteps([
      {
        title: 'Welcome to DCE Video Player tutorial',
        text: 'Enjoy the Video',
        buttons: [
          {
            text: 'Show again',
            action: () => {
              tour.complete();
              tour.start();
            }
          },
          {
            text: 'Don\'t show again',
            action: async () => {
              await this.player.preferences.set('onboarding_hideUI', true, { global: true });
              tour.complete();
            }
          },
          {
            text: 'Done',
            action: tour.complete
          }
        ]
      }
    ]);
  }
}
