// #DCE test server
// Run from dce modified module/engage-player-paella/gulpfile.js (after mvn clean install, run 'gulp server')
// Example usage: http://127.0.0.1:3000/engage/player/watch.html?id=ee39049c-05f0-4d2b-94b4-625ce59f1b2b&logLevel=debug
var express = require('express');
var httpProxy = require('http-proxy');
var https = require('https');
var http = require('http');
var fs = require('fs');
var jsonfile = require('jsonfile');

var useHTTPS = false;
var verbose = true;

var dirname = __dirname;
var buildDir = 'build/paella-opencast';

if (process.argv.length > 2 && process.argv[2] === '--use-https') {
  useHTTPS = true;
}

var matterhornProxyURL = 'https://<replace with Opencast engage host>/';
// var matterhornProxyURL = 'http://10.10.10.50/';
var proxyOpts = {
  target: matterhornProxyURL
};

var mostRecentWatchReqUrl;

var cannedEpisode = jsonfile.readFileSync(
  // dirname + '/fixtures/example-episode.json'
  // dirname + '/fixtures/example-live-episode.json'
  // dirname + '/fixtures/example-captions-episode.json'
  // The following works for progressive download MP4
  // dirname + '/fixtures/example-empty-captions-episode.json'
  // The following works for HLS locally served and cloudfront served
  dirname + '/fixtures/hls-cf-episode.json'
  // OPC-497 The following is a mock of HLS Live v1
  // dirname + '/fixtures/example-live-HLS-v1.json'
  // dirname + '/fixtures/example-noAudioPresentation-episode.json'
  // dirname + '/fixtures/example-wideMonostream-episode.json'
  // dirname + '/fixtures/example-16x9Monostream-episode.json'
  // dirname + '/fixtures/example-empty-captions-episode-nocover.json'
);

var cannedSeries = jsonfile.readFileSync(
  dirname + '/fixtures/example-search-series.json'
);

var cannedMe = jsonfile.readFileSync(
  dirname + '/fixtures/example-me.json'
);

var cannedCaptions = fs.readFileSync(
  dirname + '/fixtures/captions.dfxp'
);

var cannedEmptyCaptions = fs.readFileSync(
  dirname + '/fixtures/test-catalogs/emptyWatsonCatalog.xml'
);

var cannedAnnotations = fs.readFileSync(
  dirname + '/fixtures/example-paella-annotations.json'
);

var cannedVisualAnnotations = fs.readFileSync(
  dirname + '/fixtures/example-paella-annotations-visual.json'
);

var cannedTimedComments = fs.readFileSync(
  dirname + '/fixtures/timedCommentsSample2017.json'
);

var cannedComments = fs.readFileSync(
  dirname + '/fixtures/example-paella-annotations-comments.json'
);

var cannedHeartbeatFootprints = fs.readFileSync(
  dirname + '/fixtures/example-paella-footprint.json'
);

// ProxyOps contains target
var proxy = httpProxy.createProxyServer({
  secure: false
});

var app = express();

var router = express.Router();

// Handle login.html requests with a redirect.

router.get('/favicon.ico', swallow);

router.get('/login.html*', skipToContent);
router.get('/info/me.json*', me);

// Serve a canned episode for episode requests.
router.get('/search/episode.json*', episode);

// Serve a canned series for series requests.
router.get('/search/series.json*', series);

// Service canned captions
router.get('/caption-file-test-server/captions.dfxp', captions);

// Serve a canned episode for episode requests.
router.get('/annotation/annotations.json*', annotations);

// Serve a canned episode after an annotation new comment update/write 
router.put('/annotation/', annotations);

// Serve a canned canAnnotate response
router.get('/annotation/canAnnotate*', canannotate);

// Serve a canned username property  response
router.get('/annotation/property*', property);

// Serve a canned episode after an annotation reply update/write 
router.put('/annotation/[0-9]*', annotations);

// Serve a canned footprint for footprint requests.
router.get('/usertracking/footprint.json*', footprint);

// Return true when asked if usertracking is enabled
router.get('/usertracking/detailenabled', function(req, res) {
  res.send('true');
});

// // Quitely consume the usertracking puts
router.get('/usertracking/*', swallow);
router.put('/usertracking/*', swallow);

// // Quitely consume the footprint puts
router.get('/footprint/*', swallow);

// Handle everything else with the proxy back to the Matterhorn server.
//router.get('/*', passToProxy);

// Serve /engage/player/* requests from the local build folder.
app.use('/engage/player', express.static(buildDir));
app.use('/engage/player', express.static(buildDir + '/resources'));
app.use('/engage/player/test_media', express.static(dirname + '/fixtures/test_media'));

if (fs.existsSync('./static', fs.constants.R_OK | fs.constants.W_OK)) {
  app.use('/static', express.static('static'));
  console.log("serving static files from ./static");
}

app.use('/', router);

function skipToContent(req, res, next) {
  log('Skipping to', mostRecentWatchReqUrl);
  if (mostRecentWatchReqUrl) {
    res.redirect(mostRecentWatchReqUrl);
  }
  next();
}

function swallow(req, res, next) {
  log('Swallowing ' + req.url);
  res.end();
}

function episode(req, res) {
  var mpid = req.query.id;
  var cannedAuthFixture = dirname + '/fixtures/test-auth/'+ mpid + '.json';
  if (fs.existsSync(cannedAuthFixture)) {
    log('Serving auth result.');
    var authResult = jsonfile.readFileSync(cannedAuthFixture);
    res.json(authResult);
  } else {
    log('Serving episode.');
    res.json(cannedEpisode);
  }
}

function me(req, res) {
  log('Serving me.json.');
  res.json(cannedMe);
}

function property(req, res) {
  log('Serving property.');
  res.header('Content-Type', 'text/plain');
  res.end("Joesey");
}
function series(req, res) {
  log('Serving search-series.');
  res.json(cannedSeries);
}

function captions(req, res) {
  log('Serving captions.');
  res.header('Content-Type', 'text/xml');
  res.end(cannedCaptions);
  //res.end(cannedEmptyCaptions);
}

function footprint(req, res) {
   log('Serving footprints.');
  res.header('Content-Type', 'application/json');
  res.end(cannedHeartbeatFootprints);
}

function canannotate(req, res) {
  log('Serving canned yes for canAnnotate.');
  res.header('Content-Type', 'text/plain');
  res.end("true");
}

function annotations(req, res) {
  log('Serving annotations, type: ' + req.query.type);
  res.header('Content-Type', 'text/json');
  if (req.query.type == 'paella/visualAnnotations') {
    res.end(cannedVisualAnnotations);
  } else if (req.query.type == 'paella/comments') {
    res.end(cannedComments);
  } else if (req.query.type == 'paella/timedComments') {
    res.end(cannedTimedComments);
  } else {
    // 'paella/annotations' and default all other annotation types
    res.end(cannedAnnotations);
  }

}

function passToProxy(req, res) {
  log('Proxying:', req.url);
  if (req.url.indexOf('/engage/player/watch.html') === 0) {
    mostRecentWatchReqUrl = req.url;
  }
  proxy.web(req, res, proxyOpts);
}

var httpsOpts = {
  key: fs.readFileSync(dirname + '/fixtures/test.key'),
  cert: fs.readFileSync(dirname + '/fixtures/test.crt')
};

var server;
if (useHTTPS) {
  server = https.createServer(httpsOpts, app);
}
else {
  server = http.createServer(app);
}

server.listen(3000);

function log() {
  if (verbose) {
    console.log.apply(console, arguments);
  }
}

log('Listening on port 3000.');

console.log(process.pid);

