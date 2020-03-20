var fs = require('fs');
var path = require('path');
var Pend = require('pend');

exports.extractRequires = extractRequires;
exports.createBundle = createBundle;
exports.renderBundle = renderBundle;

function createBundle(options, cb) {
  var outBundlePath = options.outBundlePath;
  renderBundle(options, function(err, output) {
    if (err) return cb(err);
    fs.writeFile(outBundlePath, output, cb);
  });
}

function renderBundle(options, cb) {
  var entrySourcePath = options.entrySourcePath;
  var standalone = options.standalone;

  // data structure that is filled up with canonical source path as the key,
  // source code as the value.
  var sources = {};

  // describes the dependency graph. key is canonical source path, value is
  // array of canonical source path dependencies
  var deps = {};

  // each file has its own map of how require statements resolve.
  var depMap = {};

  var sourceQueue = [];

  requireResolve(entrySourcePath, process.cwd(), function(err, resolvedPath) {
    if (err) return cb(err);
    sourceQueue.push(resolvedPath);
    collectDependencies(function(err) {
      if (err) return cb(err);
      render(resolvedPath, function(err, output) {
        if (err) return cb(err);
        cb(null, output);
      });
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
      depMap[canonicalSourcePath] = {};

      var pend = new Pend();
      extractRequires(source, function(err, requireList) {
        if (err) return cb(err);
        requireList.forEach(function(requireItem) {
          pend.go(function(cb) {
            requireResolve(requireItem, path.dirname(canonicalSourcePath), function(err, canonicalDepPath) {
              if (err) return cb(err);
              deps[canonicalSourcePath][canonicalDepPath] = true;
              depMap[canonicalSourcePath][requireItem] = canonicalDepPath;
              sourceQueue.push(canonicalDepPath);
              cb();
            });
          });
        });
        pend.wait(function(err) {
          if (err) return cb(err);
          collectDependencies(cb);
        });
      });

    });
  }

  function render(entrySourcePath, cb) {
    var modules = Object.keys(sources);
    var aliases = {};
    modules.forEach(function(canonicalSourcePath, index) {
      aliases[canonicalSourcePath] = index;
    });
    modules.forEach(function(canonicalSourcePath, index) {
      var thisDepMap = depMap[canonicalSourcePath]
      for (var depSourcePath in thisDepMap) {
        thisDepMap[depSourcePath] = aliases[thisDepMap[depSourcePath]];
      }
    });

    var standaloneLine = standalone ?
      "  window." + standalone + " = req(entry);\n" :
      "  req(entry);\n";

    var out =
      "(function(modules, cache, entry) {\n" +
      standaloneLine +
      "  function req(name) {\n" +
      "    if (cache[name]) return cache[name].exports;\n" +
      "    var m = cache[name] = {exports: {}};\n" +
      "    modules[name][0].call(m.exports, modRequire, m, m.exports, window);\n" +
      "    return m.exports;\n" +
      "    function modRequire(alias) {\n" +
      "      var id = modules[name][1][alias];\n" +
      "      if (!id) throw new Error(\"Cannot find module \" + alias);\n" +
      "      return req(id);\n" +
      "    }\n" +
      "  }\n" +
      "})({";

    modules.forEach(function(canonicalSourcePath) {
      var thisDepMap = depMap[canonicalSourcePath];
      out += aliases[canonicalSourcePath] + ": [function(require,module,exports,global){\n";
      if (canonicalSourcePath.match(/\.json$/)) {
        out += "module.exports = ";
      }
      out += sources[canonicalSourcePath];
      out += "\n}, " + JSON.stringify(thisDepMap, Object.keys(thisDepMap).sort()) + "],";
    });

    out += "}, {}, " + aliases[entrySourcePath] + ");\n";

    cb(null, out);
  }
}

function tokenizeSource(source) {
  var tokens = [];
  var inQuote = false;
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
        tokens.push(token);
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
    } else if (c === '}') {
      startComment = false;
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
    } else {
      if (/\W/.test(c)) {
        if (token) tokens.push(token);
        token = "";
      }
      if (/\S/.test(c)) {
        token += c;
      }
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
    } else if (state === STATE_WANT_RPAREN && token !== ')') {
      state = STATE_WANT_REQUIRE;
    }
  }
  cb(null, requiresList);
}

function requireResolve(pkg, basedir, cb) {
  if (/^[.\/]/.test(pkg)) {
    requireResolvePath(path.resolve(basedir, pkg), cb);
  } else {
    requireResolveModule(pkg, basedir, cb);
  }
}

function requireResolveModule(pkg, basedir, cb) {
  var globalSearchPaths = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];

  var localSearchPaths = [];
  var parts = basedir.split(path.sep);
  var it = "/";
  for (var i = 0; i < parts.length; i += 1) {
    it = path.join(it, parts[i]);
    localSearchPaths.unshift(path.join(it, "node_modules"));
  }

  var searchPaths = localSearchPaths.concat(globalSearchPaths);
  var index = 0;

  trySearchPath();

  function trySearchPath() {
    var searchPath = searchPaths[index];
    if (!searchPath) return cb(new Error("module " + pkg + " in " + basedir + " not found"));

    requireResolvePath(path.resolve(searchPath, pkg), function(err, resolvedFilename) {
      if (!err) return cb(null, resolvedFilename);
      index += 1;
      trySearchPath();
    });
  }
}

function requireResolvePath(filename, cb) {
  resolveFile(filename, function(err, resolvedFilename) {
    if (!err) return cb(null, resolvedFilename);
    resolveFile(filename + '.js', function(err, resolvedFilename) {
      if (!err) return cb(null, resolvedFilename);
      resolveFile(filename + '.json', function(err, resolvedFilename) {
        if (!err) return cb(null, resolvedFilename);
        resolveDirectory(filename, cb);
      });
    });
  });
}

function resolveFile(filename, cb) {
  fs.stat(filename, function(err, stat) {
    if (err) return cb(err);
    if (stat.isDirectory()) return cb(new Error("directory"));
    cb(null, filename);
  });
}

function resolveDirectory(dirname, cb) {
  var packageJsonPath = path.resolve(dirname, "package.json");
  fs.readFile(packageJsonPath, {encoding: 'utf8'}, function(err, packageJsonStr) {
    if (!err) {
      var packageJson;
      try {
        packageJson = JSON.parse(packageJsonStr);
      } catch (err) {
        cb(new Error("Invalid package.json: " + packageJsonPath + ": "+ err.message));
        return;
      }
      var filename;
      var browserObject = packageJson.browserify || packageJson.browser;
      if (typeof browserObject === 'string') {
        filename = path.resolve(dirname, browserObject);
        requireResolvePath(filename, tryIndex);
      } else if (packageJson.main) {
        filename = path.resolve(dirname, packageJson.main);
        requireResolvePath(filename, tryIndex);
      } else {
        tryIndex(new Error("no main found in package.json"));
      }
    } else {
      tryIndex(new Error("no package.json found"));
    }


    function tryIndex(err, filename) {
      if (!err) return cb(null, filename);
      filename = path.resolve(dirname, "index.js");
      resolveFile(filename, function(err) {
        if (!err) return cb(null, filename);
        filename = path.resolve(dirname, "index.json");
        resolveFile(filename, cb);
      });
    }
  });
}
