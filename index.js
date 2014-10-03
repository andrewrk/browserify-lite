var fs = require('fs');

exports.extractRequires = extractRequires;
exports.createBundle = createBundle;

function createBundle(entrySourcePath, outBundlePath, cb) {
  // data structure that is filled up with canonical source path as the key,
  // source code as the value.
  var sources = {};

  // describes the dependency graph. key is canonical source path, value is
  // array of canonical source path dependencies
  var deps = {};

  var sourceQueue = [require.resolve(entrySourcePath)];

  collectDependencies(function(err) {
    if (err) return cb(err);
    render(function(err, output) {
      if (err) return cb(err);
      fs.writeFile(outBundlePath, output, cb);
    });
  });

  function collectDependencies(cb) {
    var canonicalSourcePath = sourceQueue.shift();
    if (!canonicalSourcePath) return cb();
    if (sources[canonicalSourcePath]) return collectDependencies(cb);

    fs.readFile(canonicalSourcePath, {encoding: 'utf8'}, function(err, source) {
      if (err) return cb(err);
      sources[canonicalSourcePath] = source;
      deps[canonicalSourcePath] = {};

      extractRequires(source, function(err, requireList) {
        if (err) return cb(err);
        requireList.forEach(function(requireItem) {
          var canonicalDepPath = require.resolve(requireItem);
          deps[canonicalSourcePath][canonicalDepPath] = true;
        });
      });

    });
  }

  function render(cb) {

  }
}


function tokenizeSource(source) {
  var tokens = [];
  var inQuote = false;
  var braceCount = 0;
  var quoteType;
  var qEscape = false;
  var token = "";
  var inLineComment = false;
  var inMultiLineComment = false;
  var startComment = false;
  var endComment = false;
  for (var i = 0; i < source.length; i += 1) {
    var c = source[i];
    if (inQuote) {
      if (qEscape) {
        token += c;
        qEscape = false;
      } else if (c === "\\") {
        qEscape = true;
      } else if (c === quoteType) {
        inQuote = false;
        if (braceCount === 0) {
          tokens.push(token);
        }
        token = "";
      } else {
        token += c;
      }
    } else if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
      }
    } else if (inMultiLineComment) {
      if (c === '*') {
        endComment = true;
      } else if (c === '/') {
        if (endComment) {
          inMultiLineComment = false;
          endComment = false;
        }
      } else {
        endComment = false;
      }
    } else if (c === "\"" || c === "'") {
      startComment = false;
      if (token) tokens.push(token);
      token = "";
      inQuote = true;
      quoteType = c;
      qEscape = false;
    } else if (c === '{') {
      startComment = false;
      if (token) tokens.push(token);
      token = "";
      braceCount += 1;
    } else if (c === '}') {
      startComment = false;
      braceCount -= 1;
    } else if (c === '/') {
      if (startComment) {
        if (token) tokens.push(token);
        token = "";
        inLineComment = true;
        startComment = false;
      } else {
        startComment = true;
      }
    } else if (c === '*' && startComment) {
      if (token) tokens.push(token);
      token = "";
      inMultiLineComment = true;
      startComment = false;
    } else if (braceCount === 0) {
      if (/\W/.test(c)) {
        if (token) tokens.push(token);
        token = "";
      }
      if (/\S/.test(c)) {
        token += c;
      }
    } else {
      startComment = false;
    }
  }
  if (token) tokens.push(token);
  return tokens;
}

var stateCount = 0;
var STATE_WANT_REQUIRE = stateCount++;
var STATE_WANT_LPAREN = stateCount++;
var STATE_WANT_STR = stateCount++;
var STATE_WANT_RPAREN = stateCount++;
function extractRequires(source, cb) {
  var tokens = tokenizeSource(source);

  var requiresList = [];
  var state = STATE_WANT_REQUIRE;
  var requireName;

  for (var i = 0; i < tokens.length; i += 1) {
    var token = tokens[i];
    if (state === STATE_WANT_REQUIRE && token === 'require') {
      state = STATE_WANT_LPAREN;
    } else if (state === STATE_WANT_LPAREN && token === '(') {
      state = STATE_WANT_STR;
    } else if (state === STATE_WANT_STR) {
      requireName = token;
      state = STATE_WANT_RPAREN;
    } else if (state === STATE_WANT_RPAREN && token === ')') {
      state = STATE_WANT_REQUIRE;
      requiresList.push(requireName);
    }
  }
  cb(null, requiresList);
}
