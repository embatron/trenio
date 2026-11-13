#!/bin/sh
set -eu
cd "$(dirname "$0")/../mobile/android"
task=assembleDebug
if [ "${1:-}" = "release" ]; then
  task=bundleRelease
fi
if [ ! -x ./gradlew ]; then
  echo "Gradle wrapper is missing from mobile/android."
  exit 1
fi
if ! command -v java >/dev/null 2>&1; then
  echo "JDK 17 is not installed. The TWA project is in mobile/android."
  exit 0
fi
if [ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ] && [ ! -d "${HOME}/Library/Android/sdk" ] && [ ! -d "${HOME}/Android/Sdk" ]; then
  echo "Android SDK is not installed. The TWA project is in mobile/android."
  exit 0
fi
if [ "$task" = "bundleRelease" ] && [ ! -f signing.properties ]; then
  echo "Release needs mobile/android/signing.properties. Copy signing.properties.example and point it at the upload keystore."
  exit 0
fi
./gradlew "$task"
