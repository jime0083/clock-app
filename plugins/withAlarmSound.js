const { withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to add custom alarm sound to iOS bundle
 * This enables the app to use a custom sound for push notifications
 */
function withAlarmSound(config) {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const platformProjectRoot = config.modRequest.platformProjectRoot;

    // Source and destination paths
    const soundFileName = 'alarm.caf';
    const sourcePath = path.join(projectRoot, 'assets', 'sounds', soundFileName);
    const destPath = path.join(platformProjectRoot, 'app', soundFileName);

    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[withAlarmSound] Warning: ${sourcePath} not found`);
      return config;
    }

    // Copy the file to the app directory
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(sourcePath, destPath);
    console.log(`[withAlarmSound] Copied ${soundFileName} to ${destPath}`);

    // Add the file to Xcode project
    const groupName = 'app';
    const group = xcodeProject.pbxGroupByName(groupName);

    // Add file to project resources
    try {
      const hasFile = xcodeProject.hasFile(soundFileName);

      if (!hasFile) {
        // Add file to project with proper path
        const filePath = `app/${soundFileName}`;
        xcodeProject.addResourceFile(filePath, {
          target: xcodeProject.getFirstTarget().uuid,
        });
        console.log(`[withAlarmSound] Added ${soundFileName} to Xcode project`);
      } else {
        console.log(`[withAlarmSound] ${soundFileName} already in Xcode project`);
      }
    } catch (error) {
      console.warn(`[withAlarmSound] Could not add ${soundFileName} to Xcode project:`, error.message);
      // Continue anyway - file is copied and may work
    }

    return config;
  });
}

module.exports = withAlarmSound;
