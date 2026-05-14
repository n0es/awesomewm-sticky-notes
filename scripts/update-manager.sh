#!/bin/bash

# Sticky Notes Lightweight Update Manager
REPO="n0es/awesomewm-sticky-notes"
BIN_PATH="$HOME/.local/bin/sticky-notes"
VERSION_FILE="$HOME/.config/sticky-notes-version"

# Ensure ~/.config exists
mkdir -p "$HOME/.config"

# Get current version
if [ -f "$VERSION_FILE" ]; then
    CURRENT_VERSION=$(cat "$VERSION_FILE")
else
    CURRENT_VERSION="v0.0.0"
fi

echo "Current version: $CURRENT_VERSION"

# Check for updates (using gh)
LATEST_VERSION=$(gh release view -R "$REPO" --json tagName -q .tagName 2>/dev/null)

if [ -z "$LATEST_VERSION" ]; then
    echo "Could not fetch latest version. Starting app..."
    $BIN_PATH "$@"
    exit 0
fi

echo "Latest version: $LATEST_VERSION"

# Only update if the latest version is actually different (and ideally newer)
if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ]; then
    echo "Updating from $CURRENT_VERSION to $LATEST_VERSION..."
    # Ensure Zenity can find the display
    export DISPLAY="${DISPLAY:-:0}"
    
    # Check if another update is already running (simple lock)
    LOCKFILE="/tmp/sticky-notes-update.lock"
    if [ -f "$LOCKFILE" ]; then
        echo "Update already in progress. Skipping check."
    else
        touch "$LOCKFILE"
        if zenity --question --title="Sticky Notes Update" \
                  --text="A new version ($LATEST_VERSION) is available. Would you like to update now?\n\nCurrent version: $CURRENT_VERSION" \
                  --width=400; then
            # Another screen: progress bar
            (
            echo "10"; echo "# Fetching release info..."
            TMP_FILE=$(mktemp)
            echo "30"; echo "# Downloading $LATEST_VERSION..."

            # Capture gh error
            GH_ERROR=$(gh release download "$LATEST_VERSION" -R "$REPO" -p "StickyNotes-*.AppImage" -O "$TMP_FILE" --clobber 2>&1)
            if [ $? -eq 0 ]; then
                echo "80"; echo "# Installing..."
                mv "$TMP_FILE" "$BIN_PATH"
                chmod +x "$BIN_PATH"
                echo "$LATEST_VERSION" > "$VERSION_FILE"
                echo "100"; echo "# Update complete!"
                sleep 1
            else
                echo "100"; echo "# Update failed."
                zenity --error --text="Update failed.\n\nError: $GH_ERROR"
                rm -f "$TMP_FILE"
                sleep 2
            fi
            ) | zenity --progress --title="Updating Sticky Notes" --auto-close --percentage=0
        fi
        rm -f "$LOCKFILE"
    fi
fi

echo "Launching app: $BIN_PATH"
exec "$BIN_PATH" "$@"
