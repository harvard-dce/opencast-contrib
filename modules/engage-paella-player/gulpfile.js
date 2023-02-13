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

/* global require */

var gulp = require('gulp');
var spawn = require('child_process').spawn;

// For debugging log
var log = require('fancy-log');

// From Opencast upstream 9x with Paella 6.4.3
// From OC upstream with Paella 6.5.6
var request = require('request');
var source = require('vinyl-source-stream');
var gunzip = require('gulp-gunzip');
var untar = require('gulp-untar');

// #DCE specific
var mergeStream = require('merge-stream');
var rename = require('gulp-rename');
var browserify = require('browserify');
var gls = require('gulp-live-server');
var serveStatic = require('serve-static');
var httpProxy = require('http-proxy');
var proxy = httpProxy.createProxyServer({
  secure: false
});

// from Opencast upstream 9x/10x Jan 2022 OPC-624
var PAELLA_VERSION = '6.5.6';
var buildPath = 'target/gulp',
    paellaSrc = 'src/main/paella-opencast',
    paellaBuildPath = buildPath + '/paella-' + PAELLA_VERSION,
    dceExtPath = 'node_modules/dce-paella-extensions',
    dceBuildPath = 'build',
    hlsLibPath = 'node_modules/hls.js/dist/hls.js'; // override if necessary in vendor

// ------  #DCE DCE overrides and extensions -------
// To be copied into build dir after Opencast & Paella resources copied
// -------------------------------------------------

// #DCE: Jim's app router
gulp.task('hudce:app-dist', function () {
  log('About to copy app-index.js to', buildPath);
  return browserify('app-src/index.js')
    .bundle()
    .pipe(source('app-index.js'))
    .pipe(gulp.dest(buildPath + '/paella-opencast/javascript'));
});

// #DCE New or extention plugins - copy after Paella and Opencast artifacts werer copied
gulp.task('hudce:prepare:source.dce-extensions', function () {
  log('About to prepare dce-extensions to', paellaBuildPath);
  // #DCE MATT-2386 include DCE dce-paella-extension plugins, icons, override style, skin
  var s1 = gulp.src(dceExtPath + '/vendor/plugins/**')
    .pipe(gulp.dest(paellaBuildPath + '/plugins'));
  var s2 = gulp.src(dceExtPath + '/vendor/skins/**')
    .pipe(gulp.dest(paellaBuildPath + '/vendor/skins'));
  var s3 = gulp.src(dceExtPath + '/resources/images/paella_icons_light_dce.png')
    .pipe(gulp.dest(paellaBuildPath + '/resources/images'));
  var s4 = gulp.src(dceExtPath + '/resources/style/overrides.less')
    .pipe(gulp.dest(paellaBuildPath + '/resources/style'));
  var s5 = gulp.src('vendor/paella_overrides/style/more_overrides.less')
    .pipe(gulp.dest(paellaBuildPath + '/resources/style'));
  return mergeStream(s1, s2, s3, s4, s5);
});

// #DCE Overrides for OC and Paella code
// Copy after Paella and Opencast artifacts were copied
gulp.task('hudce:prepare:source.dce-overrides', function () {
  log('About to prepare dce-overrides to', paellaBuildPath);
  // #DCE MATT-2386 After Paella player is copied, override with DCE overrides
  var s1 = gulp.src('vendor/paella_overrides/plugins/**')
    .pipe(gulp.dest(paellaBuildPath + '/plugins'));
  var s2 = gulp.src('vendor/paella_overrides/src/**')
    .pipe(gulp.dest(paellaBuildPath + '/src'));
  // Get DCE specific HLS.js version
  // as of July 14, 2020 - v0.14.1,
  // as of July 21, 2020 it's v0.14.5
  // as of April 17, 2022, it's v1.1.5 - non-minified with override on gap controller
  // as of Aug 5, 2022, it's v1.2.0 - release merged gap controller patch
  var s3 = gulp.src(hlsLibPath)
    .pipe(gulp.dest(buildPath + '/paella-opencast/resources/deps'));
  return mergeStream(s1, s2, s3);
});

// #DCE, copy DCE config and HTML page overrides
gulp.task('hudce:copy-dce-dist', function () {
  log('About to copy-dce-dist to', buildPath);
  // #DCE MATT-2386 after all is built, finally, copy DCE config,
  //  profiles (from extensions), htmls, and DCE's opencast style
  var s1 = gulp.src(dceExtPath + '/config/config.json')
    .pipe(gulp.dest(buildPath + '/paella-opencast/config'));
  var s2 = gulp.src(dceExtPath + '/config/profiles/profiles.json')
    .pipe(gulp.dest(buildPath + '/paella-opencast/config/profiles'));
  var s3 = gulp.src('vendor/mh_dce_resources/**')
    .pipe(gulp.dest(buildPath + '/paella-opencast/mh_dce_resources'));
  return mergeStream(s1, s2, s3);
});

// Opencast (ala 9x), Retrieve Paella resources
gulp.task('paella-opencast:download:paella', function() {
  log('About to download:paella', PAELLA_VERSION, 'to', buildPath);
  return (
    request('https://github.com/polimediaupv/paella/archive/' + PAELLA_VERSION + '.tar.gz')
      .pipe(source(PAELLA_VERSION + '.tar.gz'))
      .pipe(gunzip())
      .pipe(untar())
      .pipe(gulp.dest(buildPath))
  );
});

// Opencast (ala 9x), Copy Opencast reources to build directory (after retrieving Paella resources)
gulp.task('paella-opencast:prepare:source', gulp.series('paella-opencast:download:paella', function(){
  log('About to prepare:source plugins in ', paellaBuildPath);
  return gulp.src(paellaSrc + '/plugins/**')
    .pipe(gulp.dest(paellaBuildPath + '/plugins'));
}));

// Opencast (ala 9x), Retrieved npm resources for compile (After copying Opencast & Paella resources)
gulp.task('paella-opencast:prepare.oc', gulp.series('paella-opencast:prepare:source', function(cb){
  var cmd_npm = spawn('npm', ['ci'], {prefix: paellaBuildPath, cwd: paellaBuildPath });
  cmd_npm.on('close', function (code) {
    log('Finisished prepare.oc npm with code ', code);
    cb();
  });
}));

// #DCE, prepare DCE resources (After preparing Paella and OC resources)
gulp.task('paella-opencast:prepare.dce',
  gulp.series(
    'paella-opencast:prepare.oc',
    'hudce:app-dist',
    'hudce:prepare:source.dce-extensions',
    'hudce:prepare:source.dce-overrides'
  )
);

// Opencast (ala 9x), Compile all resources (After retrieving all resources)
gulp.task('paella-opencast:compile.debug', gulp.series('paella-opencast:prepare.dce', function(cb){
  var cmd_npm = spawn('node', ['node_modules/gulp/bin/gulp.js', 'build.debug'], {cwd: paellaBuildPath});
  cmd_npm.on('close', function (code) {
    log('Finished prepare.dce node with code ', code);
    cb();
  });
}));

// Opencast (ala 9x), Copy all compiled finalized resources for jar creation
gulp.task('paella-opencast:build', gulp.series('paella-opencast:compile.debug', function(){
  log('About to Copy all compiled finalized resources to', buildPath);
  return gulp.src([
    paellaBuildPath + '/build/player/**',
    paellaSrc + '/ui/**'
  ]).pipe(gulp.dest(buildPath + '/paella-opencast'));
}));

// ---------  end Opencast -----------

// #DCE copy to the build directory for backwards DCE compabibility
// (Afer building OC, Paella, DCE, and copying DCE config)
// Added log
gulp.task(
  'paella-opencast:build.dce',
  gulp.series('paella-opencast:build','hudce:copy-dce-dist', function(){
    log('Copying all in', buildPath, 'to', dceBuildPath);
    return gulp.src([buildPath + '/paella-opencast/**'])
      .pipe(gulp.dest(dceBuildPath + '/paella-opencast'));
  })
);

// --------start #DCE test server target ----
/// #DCE use DCE Test server and local data fixture files from dce-paella-opencast
// Example usage: http://127.0.0.1:3000/engage/player/watch.html?id=ee39049c-05f0-4d2b-94b4-625ce59f1b2b&logLevel=debug
gulp.task('paella-opencast:serverproxied', function () {
  var server = gls. new ('test-server.js');
  server.start();
});

// TODO -- test OC upstream devserver
gulp.task('paella-opencast:ocupstreamserverproxied', function () {
  var server = gls. new ('devserver.js');
  server.start();
});

// Build tasks for DCE version of OC Paella player
gulp.task('build', gulp.series('paella-opencast:build.dce'));
// Proxy dev server for DCE build and tests files
gulp.task('server', gulp.series('paella-opencast:serverproxied'));

// TODO: try at least one test of OC upstream devserver
gulp.task('upstream-devserver', gulp.series('paella-opencast:ocupstreamserverproxied'));


// -------- end #DCE test server target ----

// #DCE default starts with build.dce
gulp.task('default', gulp.series('paella-opencast:build.dce'));
