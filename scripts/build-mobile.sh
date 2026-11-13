#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
sh "$root/scripts/build-mobile-android.sh"
if [ -d /Applications/Xcode.app ]; then
  (cd "$root" && npx cap sync ios)
  xcodebuild \
    -project "$root/mobile/ios/App/App.xcodeproj" \
    -scheme App \
    -configuration Debug \
    -destination "generic/platform=iOS Simulator" \
    CODE_SIGNING_ALLOWED=NO \
    build
else
  echo "Full Xcode is not installed. The iOS project is in mobile/ios. npm run mobile:ios opens it."
fi
