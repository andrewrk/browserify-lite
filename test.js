var assert = require('assert');
var browserifyLite = require('./');

var extractRequiresTests = [
  {
    name: "basic",
    source: "require('./code')",
    output: [
      "./code"
    ],
  },
  {
    name: "multiple",
    source:
"var EventEmitter = require('./event_emitter');\n" +
"var inherits = require('./inherits');\n" +
"var uuid = require('./uuid');\n" +
"var MusicLibraryIndex = require('music-library-index');\n" +
"var keese = require(\"keese\");\n" +
"var curlydiff = require('curlydiff');\n",
    output: [
      "./event_emitter",
      "./inherits",
      "./uuid",
      "music-library-index",
      "keese",
      "curlydiff",
    ],
  },
  {
    name: "trick",
    source: "require('./code');\nvar a = \"require('foo');\";\nrequire(\"../morecode\");",
    output: [
      "./code",
      "../morecode",
    ],
  },
  {
    name: "unescape",
    source: "require('./code');\nvar a = \"require(\\\"foo\\\");\";\nrequire(\"../morecode\");",
    output: [
      "./code",
      "../morecode",
    ],
  },
  {
    name: "spaces",
    source: "var foo = require ( 'derp ' ) ;\n",
    output: [
      "derp ",
    ],
  },
  {
    name: "ignore braces",
    source: "var foo = require('derp'); { require('dont-ignore-this'); } require('this-ok')\n",
    output: [
      "derp",
      "dont-ignore-this",
      "this-ok",
    ],
  },
  {
    name: "ignore comments",
    source: "/* var foo = require('derp');*/ { require('dont-ignore-this'); } require('this-ok') // require('also-ignore-this'); \n require('this-also-ok')",
    output: [
      "dont-ignore-this",
      "this-ok",
      "this-also-ok",
    ],
  }
];

process.stderr.write("extract requires tests:\n");
extractRequiresTests.forEach(function(extractRequiresTest) {
  process.stderr.write(extractRequiresTest.name + "...");
  browserifyLite.extractRequires(extractRequiresTest.source, function(err, requiresList) {
    if (err) throw err;
    assert.deepEqual(extractRequiresTest.output, requiresList);
    process.stderr.write("OK\n");
  });
});
