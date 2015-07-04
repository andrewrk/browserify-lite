# browserify-lite

browserify, minus some of the advanced features and heavy dependencies.

 * No builtin Node.js shims.
 * Naive AST tokenization for require instead of true AST parsing.
   - All require statements are found regardless of if they are in an `if`
     statement or a function body that is never called.
 * Only supports a single entry file and the `--outfile` parameter,
   nothing else.
 * No source maps.
 * Minimal dependencies.

## Usage

```
browserify-lite ./src/app.js --outfile public/app.js
```

./src/app.js can depend on any modules using Node.js's
[module resolution system](http://nodejs.org/docs/latest/api/modules.html#modules_all_together)
and they will be bundled as well.
