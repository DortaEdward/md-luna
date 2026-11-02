#!/usr/bin/env bash
#
# Luna MD installer for macOS and Linux.
#
# Downloads the latest Luna MD release from GitHub, checks it against the
# release's SHA256SUMS.txt, and installs it. Nothing to double-click, nothing
# from anywhere but this project's GitHub Releases page.
#
#   curl -fsSL https://raw.githubusercontent.com/dortaedward/luna-md-desktop/main/install.sh | bash
#
# Options (after "bash -s --" when piping, e.g. "| bash -s -- --uninstall"):
#   --version v0.1.0   install a specific release instead of the latest
#   --uninstall        remove the app (your notes are never touched)
#
set -euo pipefail

# ---------------------------------------------------------------------------
# The GitHub repository releases come from ("owner/name")
# ---------------------------------------------------------------------------
REPO="${LUNA_REPO:-dortaedward/luna-md-desktop}"
APP_NAME="Luna MD"
VERSION="latest"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  BOLD=$'\033[1m'; GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=""; GREEN=""; RED=""; YELLOW=""; RESET=""
fi
step() { printf '\n%s==>%s %s%s%s\n' "$GREEN" "$RESET" "$BOLD" "$1" "$RESET"; }
info() { printf '    %s\n' "$1"; }
warn() { printf '%s!!%s  %s\n' "$YELLOW" "$RESET" "$1"; }
die()  { printf '\n%sError:%s %s\n' "$RED" "$RESET" "$1" >&2; exit 1; }

OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM=mac ;;
  Linux)  PLATFORM=linux ;;
  *) die "This installer is for macOS and Linux. On Windows, use install.ps1." ;;
esac
case "$(uname -m)" in
  arm64|aarch64) ARCH=arm64 ;;
  x86_64|amd64)  ARCH=x64 ;;
  *) die "Unsupported processor: $(uname -m)" ;;
esac
# An Intel build of the shell on Apple Silicon (Rosetta) still gets the native app
if [ "$PLATFORM" = mac ] && [ "$ARCH" = x64 ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = 1 ]; then
  ARCH=arm64
fi

if [ "$PLATFORM" = mac ]; then
  ASSET="Luna-MD-mac-$ARCH.zip"
  if [ -w /Applications ]; then APP_DIR=/Applications; else APP_DIR="$HOME/Applications"; fi
  APP_PATH="$APP_DIR/$APP_NAME.app"
else
  ASSET="Luna-MD-linux-$ARCH.AppImage"
  APP_DIR="$HOME/.local/share/luna-md"
  APP_PATH="$APP_DIR/Luna-MD.AppImage"
  BIN_LINK="$HOME/.local/bin/luna-md"
  DESKTOP_FILE="$HOME/.local/share/applications/luna-md.desktop"
  ICON_FILE="$HOME/.local/share/icons/hicolor/512x512/apps/luna-md.png"
fi

# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------
uninstall() {
  step "Removing $APP_NAME"
  if [ "$PLATFORM" = mac ]; then
    osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 || true
    for p in "/Applications/$APP_NAME.app" "$HOME/Applications/$APP_NAME.app"; do
      if [ -e "$p" ]; then rm -rf "$p"; info "Removed $p"; fi
    done
  else
    rm -f "$APP_PATH" "$BIN_LINK" "$DESKTOP_FILE" "$ICON_FILE"
    rmdir "$APP_DIR" 2>/dev/null || true
    info "Removed the app, its menu entry and the luna-md command"
  fi
  printf '\n%sDone.%s Your notes (Documents/LunaMD by default) and settings were not touched.\n' "$BOLD" "$RESET"
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --uninstall) uninstall ;;
    --version)
      [ $# -ge 2 ] || die "--version needs a value, e.g. --version v0.1.0"
      VERSION="$2"; shift ;;
    -h|--help)
      printf 'Luna MD installer\n\n  install.sh                  install or update to the latest release\n  install.sh --version v0.1.0 install a specific release\n  install.sh --uninstall      remove the app (notes are kept)\n'
      exit 0 ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
  shift
done

if [ -n "${LUNA_DOWNLOAD_URL:-}" ]; then
  BASE_URL="$LUNA_DOWNLOAD_URL" # a mirror, or a local folder for testing
elif [ "$VERSION" = latest ]; then
  BASE_URL="https://github.com/$REPO/releases/latest/download"
else
  BASE_URL="https://github.com/$REPO/releases/download/$VERSION"
fi

command -v curl >/dev/null 2>&1 || die "curl is needed to download the app."

# ---------------------------------------------------------------------------
# 1. Download and check
# ---------------------------------------------------------------------------
printf '%sLuna MD installer%s\n' "$BOLD" "$RESET"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

step "Downloading $ASSET ($VERSION release of $REPO)"
curl -fL --progress-bar -o "$TMP/$ASSET" "$BASE_URL/$ASSET" ||
  die "Couldn't download $BASE_URL/$ASSET. Is there a release with that file?"
curl -fsSL -o "$TMP/SHA256SUMS.txt" "$BASE_URL/SHA256SUMS.txt" ||
  die "Couldn't download the release's SHA256SUMS.txt, so the download can't be checked."

step "Checking the download"
EXPECTED="$(awk -v f="$ASSET" '$2 == f || $2 == "*"f { print $1 }' "$TMP/SHA256SUMS.txt")"
[ -n "$EXPECTED" ] || die "$ASSET isn't listed in SHA256SUMS.txt."
if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL="$(sha256sum "$TMP/$ASSET" | awk '{print $1}')"
else
  ACTUAL="$(shasum -a 256 "$TMP/$ASSET" | awk '{print $1}')"
fi
[ "$ACTUAL" = "$EXPECTED" ] || die "Checksum mismatch: the download is damaged or not the real release. Nothing was installed."
info "SHA-256 matches: $ACTUAL"

# ---------------------------------------------------------------------------
# 2. Install
# ---------------------------------------------------------------------------
step "Installing to $APP_DIR"

if [ "$PLATFORM" = mac ]; then
  ditto -x -k "$TMP/$ASSET" "$TMP/unzipped"
  [ -d "$TMP/unzipped/$APP_NAME.app" ] || die "The download doesn't contain $APP_NAME.app."

  osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 || true
  mkdir -p "$APP_DIR"
  rm -rf "$APP_PATH"
  ditto "$TMP/unzipped/$APP_NAME.app" "$APP_PATH"

  # Releases built without an Apple Developer certificate aren't signed. macOS
  # (Apple Silicon especially) needs at least an ad-hoc signature to run them,
  # and the file came from GitHub via this script, so clear the quarantine flag.
  if ! codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1; then
    codesign --force --deep --sign - "$APP_PATH" >/dev/null 2>&1 || warn "Couldn't sign the app locally; it may not open."
    info "This release isn't signed by a developer, so it was signed locally for this Mac."
  fi
  xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true
  info "Installed $APP_PATH"
else
  mkdir -p "$APP_DIR" "$(dirname "$BIN_LINK")" "$(dirname "$DESKTOP_FILE")" "$(dirname "$ICON_FILE")"
  install -m 755 "$TMP/$ASSET" "$APP_PATH"
  ln -sf "$APP_PATH" "$BIN_LINK"
  curl -fsSL -o "$ICON_FILE" "https://raw.githubusercontent.com/$REPO/main/resources/icon.png" 2>/dev/null ||
    rm -f "$ICON_FILE" # the icon is optional
  cat > "$DESKTOP_FILE" <<DESKTOP
[Desktop Entry]
Type=Application
Name=$APP_NAME
Comment=Markdown notes
Exec=$APP_PATH %U
Icon=luna-md
Terminal=false
Categories=Office;Utility;TextEditor;
StartupWMClass=$APP_NAME
DESKTOP
  command -v update-desktop-database >/dev/null 2>&1 &&
    update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
  info "Installed $APP_PATH"
  info "Added $APP_NAME to your app menu, and the 'luna-md' command"
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) warn "$HOME/.local/bin isn't on your PATH, so the 'luna-md' command won't be found until you add it." ;;
  esac
  if ! ldconfig -p 2>/dev/null | grep -q 'libfuse.so.2'; then
    warn "AppImages need FUSE 2. If the app doesn't start: sudo apt install libfuse2 (or libfuse2t64)"
  fi
fi

printf '\n%s%s✓ %s is installed.%s\n' "$GREEN" "$BOLD" "$APP_NAME" "$RESET"
if [ "$PLATFORM" = mac ]; then
  info "Open it from Launchpad or $APP_DIR."
else
  info "Open it from your app menu, or run: luna-md"
fi
info "Run this installer again any time to update."
