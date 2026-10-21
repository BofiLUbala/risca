const fs = require('fs');
const path = require('path');
const base = require('./app.json');

/**
 * Configuration Expo.
 *
 * `app.json` reste la source de verite. Ce fichier n'ajoute les references aux
 * fichiers Firebase que lorsqu'ils sont reellement presents : declarer
 * `googleServicesFile` vers un fichier absent empeche Expo de lire sa
 * configuration, et l'application ne demarre plus du tout.
 *
 * Deposez `google-services.json` (Android) ou `GoogleService-Info.plist` (iOS)
 * a la racine de `mobile/` et ils seront pris en compte automatiquement.
 */
const config = { ...base.expo };

const androidFile = path.join(__dirname, 'google-services.json');
if (fs.existsSync(androidFile)) {
  config.android = { ...config.android, googleServicesFile: './google-services.json' };
}

const iosFile = path.join(__dirname, 'GoogleService-Info.plist');
if (fs.existsSync(iosFile)) {
  config.ios = { ...config.ios, googleServicesFile: './GoogleService-Info.plist' };
}

module.exports = config;
