/**
 * Main JS file for project.
 */

/**
 * Define globals that are added through the js.globals in
 * the config.json file, here, mostly so linting won't get triggered
 * and its a good queue of what is available:
 */
/* global $ */

// Dependencies
import Content from '../templates/_index-content.svelte.html';
import utils from './shared/utils.js';
import stats from '../assets/data/stats.json';

// Intialize google analytics
function initializeGa() {
  window.dataLayer = window.dataLayer || [];
  window.gaId = 'UA-114906116-1';

  window.gtag = function() {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', window.gaId);
  return window.gtag;
}
initializeGa();

// Mark page with note about development or staging
utils.environmentNoting();

// Common code to get svelte template loaded on the client and hack-ishly
// handle sharing
$(document).ready(() => {
  // Hack to get share back
  let $share = $('.share-placeholder').size()
    ? $('.share-placeholder')
      .children()
      .detach()
    : undefined;
  let attachShare = !$share
    ? undefined
    : () => {
      $('.share-placeholder').append($share);
    };

  // Get data
  window
    .fetch(
      //'https://static.startribune.com/news/projects-staging/all/201902-vaccination-rates/assets/data/locations.json'
      '../assets/data/locations.json'
    )
    .then(r => r.json())
    .then(locations => {
      console.log(locations);

      // Main component
      const app = new Content({
        target: document.querySelector('.article-lcd-body-content'),
        hydrate: true,
        data: {
          locations,
          stats,
          attachShare
        }
      });
    });
});
