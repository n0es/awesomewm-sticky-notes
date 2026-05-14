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
LATEST_VERSION=$(gh release list -R "$REPO" --limit 1 | awk '{print $1}')

if [ -z "$LATEST_VERSION" ]; then
    echo "Could not fetch latest version. Starting app..."
    $BIN_PATH "$@"
    exit 0
fi

echo "Latest version: $LATEST_VERSION"

if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ]; then
    # Another screen: zenity question
    zenity --question --title="Sticky Notes Update" \
           --text="A new version ($LATEST_VERSION) is available. Would you like to update now?\n\nCurrent version: $CURRENT_VERSION" \
           --width=300

    if [ $? -eq 0 ]; then
        # Another screen: progress bar
        (
        echo "10"; echo "# Fetching release info..."
        # Download new AppImage to a temp file
        TMP_FILE=$(mktemp)
        echo "30"; echo "# Downloading $LATEST_VERSION..."
        gh release download "$LATEST_VERSION" -R "$REPO" -p "*.AppImage" -O "$TMP_FILE"
        
        if [ $? -eq 0 ]; then
            echo "80"; echo "# Installing..."
            mv "$TMP_FILE" "$BIN_PATH"
            chmod +x "$BIN_PATH"
            echo "$LATEST_VERSION" > "$VERSION_FILE"
            echo "100"; echo "# Update complete!"
            sleep 1
        else
            echo "100"; echo "# Update failed."
            zenity --error --text="Update failed. Please check your internet connection."
            sleep 2
        fi
        ) | zenity --progress --title="Updating Sticky Notes" --auto-close --percentage=0
    fi
fi

# Launch the app
exec "$BIN_PATH" "$@"
