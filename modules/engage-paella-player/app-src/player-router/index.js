function initPlayerRouter(opts) {
  var seekParamName;
  var seekResponder;

  if (opts) {
    if (opts.seeking) {
      seekParamName = opts.seeking.seekParamName;
      seekResponder = opts.seeking.seekResponder;
    }
  }

  window.onhashchange = route;

  function route() {
    var segments = window.location.hash.slice(1).split('/');
    if (segments.length > 0) {
      var lastSegment = segments[segments.length - 1];
      var paramAndValue = lastSegment.split('=');

      if (paramAndValue.length === 2 && paramAndValue[0] === seekParamName) {
        var rangeValue = parseRangeValue(paramAndValue[1]);
        if (rangeValue.length > 0) {
          seekResponder.apply(seekResponder, rangeValue);
        }
      }
    }

    // If more traditional routing was needed, this is where we would pass the
    // hash off to Director or another routing module.
  }

  return {
    route: route
  };
}

function parseRangeValue(s) {
  var value = [];
  var startAndEnd = s.split('-');
  if (startAndEnd.length > 0) {
    var start = parseInt(startAndEnd[0], 10);
    if (!isNaN(start)) {
      value.push(start);

      if (startAndEnd.length > 1) {
        var end = parseInt(startAndEnd[1], 10);
        if (!isNaN(end) && end > start) {
          value.push(end);
        }
      }
    }
  }
  return value;
}

module.exports = initPlayerRouter;
