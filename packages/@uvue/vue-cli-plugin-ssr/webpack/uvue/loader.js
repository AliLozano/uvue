const path = require('path');
const os = require('os');
const mm = require('micromatch');
const { RQuery } = require('@uvue/rquery');
const ApiUtil = require('../../ApiUtil');


/**
 * Simple loader to find and replace code before final compilation
 */
module.exports = async function(content, map, meta) {
  const callback = this.async();

  // Get UVue API
  const { uvue } = this.query.api;
  const mainPath = new ApiUtil(this.query.api).getMainPath();

  if (mm.isMatch(this.resourcePath, '**/@uvue/core/(client|server).js')) {
    // Get absolute path to generated main.js
    const dirPath = path.join(new ApiUtil(this.query.api).getProjectPath(), 'node_modules', '.uvue');
    let mainPath = path.join(dirPath, 'main.js');
    if (os.platform() === 'win32') {
      mainPath = mainPath.replace(/\\/g, '/');
    }

    // Replace import main path to generated file by Webpack plugin
    content = content.replace('./main', mainPath);
  } else if (this.resourcePath === `${mainPath}.js` || this.resourcePath === `${mainPath}.ts`) {
    // Replace new Vue by a simple return object

    // Parse source code
    const doc = RQuery.parse(content);

    // Inject context to export default function arguments
    const exportDefault = doc.find('exportDefault').get(0);

    if (exportDefault) {
      exportDefault.node.declaration.params = [RQuery.createIdentifier('context')];

      // Convert new Vue -> initApp
      const newVue = exportDefault.find('new#Vue').get(0);
      const initFunc = RQuery.parse(`initApp()`)
        .findOne('id#initApp')
        .parent();

      initFunc.node.arguments = [newVue.node.arguments[0], RQuery.createIdentifier('context')];

      newVue.replace(initFunc);

      content = `import initApp from '@uvue/core/lib/initApp';\n${doc.print()}`;
    }
  }

  callback(null, content, map, meta);
};
