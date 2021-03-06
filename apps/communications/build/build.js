'use strict';

/* global require, exports */
const utils = require('utils');

const DEBUG = false;

var CommAppBuilder = function() {
};

// set destination directory and application directory
CommAppBuilder.prototype.setOptions = function(options) {
  this.stageDir = utils.getFile(options.STAGE_APP_DIR);
  this.appDir = utils.getFile(options.APP_DIR);

  this.webapp = utils.getWebapp(this.appDir.path, options.GAIA_DOMAIN,
    options.GAIA_SCHEME, options.GAIA_PORT, options.STAGE_DIR);
  this.gaia = utils.gaia.getInstance(options);

  var content = JSON.parse(utils.getFileContent(utils.getFile(this.appDir.path,
    'build', 'communications_services.json')));
  var custom = utils.getDistributionFileContent('communications_services',
    content);
  this.commsServices = JSON.parse(custom);
  this.official = options.OFFICIAL;
};

CommAppBuilder.prototype.generateManifest = function() {
  var manifestObject;
  var manifestContent = utils.getFileContent(this.webapp.manifestFile);
  manifestObject = JSON.parse(manifestContent);

  var redirects = manifestObject.redirects;

  var indexedRedirects = {};
  redirects.forEach(function(aRedirect) {
    indexedRedirects[aRedirect.from] = aRedirect.to;
  });

  var mappingParameters = {
    'facebook': 'redirectURI',
    'live': 'redirectURI',
    'gmail': 'redirectURI',
    'facebook_dialogs': 'redirectMsg',
    'facebook_logout': 'redirectLogout'
  };

  var newRedirects = [];
  redirects.forEach(function(aRedirect) {
    var from = aRedirect.from;
    var service = this.commsServices[from.split('_')[0] || from] ||
      this.commsServices;
    newRedirects.push({
      from: service[mappingParameters[from]],
      to: indexedRedirects[from]
    });
  }, this);

  manifestObject.redirects = newRedirects;

  var file = utils.getFile(this.stageDir.path, 'manifest.webapp');
  var args = DEBUG ? [manifestObject, undefined, 2] : [manifestObject];
  utils.writeContent(file, JSON.stringify.apply(JSON, args));
};

CommAppBuilder.prototype.generateContactsConfig = function() {
  var configFile = utils.getFile(this.stageDir.path, 'contacts', 'config.json');
  var defaultConfig = {
    'defaultContactsOrder': 'givenName',
    'facebookEnabled': true,
    'operationsTimeout': 25000,
    'logLevel': 'DEBUG',
    'facebookSyncPeriod': 24,
    'testToken': ''
  };
  utils.writeContent(configFile,
    utils.getDistributionFileContent('communications', defaultConfig,
    this.gaia.distributionDir));
};

CommAppBuilder.prototype.generateServicesConfig = function() {
  var commsServicesFile = utils.getFile(this.stageDir.path, 'contacts', 'js',
                                        'parameters.js');
  var commsServicesFile2 = utils.getFile(this.stageDir.path, 'shared',
    'pages', 'import', 'js', 'parameters.js');

  // Bug 883344 Only use default facebook app id if is mozilla partner build
  if (this.official === '1') {
    this.commsServices.facebook.applicationId = '395559767228801';
    this.commsServices.live.applicationId = '00000000440F8B08';
  }

  var commsServices =
    utils.getDistributionFileContent('communications_services',
    this.commsServices, this.gaia.distributionDir);

  utils.writeContent(commsServicesFile,
    'var oauthflow = this.oauthflow || {}; oauthflow.params = ' +
    commsServices + ';');

  utils.writeContent(commsServicesFile2,
    'var oauthflow = this.oauthflow || {}; oauthflow.params = ' +
    commsServices + ';');
};

CommAppBuilder.prototype.execute = function(options) {
  this.setOptions(options);
  this.generateManifest();
  this.generateContactsConfig();
  this.generateServicesConfig();
};

exports.execute = function(options) {
  (new CommAppBuilder()).execute(options);
};
