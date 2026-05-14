# Sticky Notes for AwesomeWM - Development Rules

This document defines the foundational mandates and workflows for this project. All AI agents and contributors must strictly adhere to these standards.

## Development Workflow

1. **Branching Strategy:**
   - NEVER commit directly to `main`.
   - Create a feature branch for every change (e.g., `feature/awesome-feature` or `fix/annoying-bug`).
2. **Pull Requests:**
   - All changes must be submitted via a Pull Request (PR) to the `main` branch.
   - Use the GitHub CLI (`gh pr create`) to open PRs.
   - PRs must be merged using `gh pr merge --merge --delete-branch`.
3. **CI/CD & Releases:**
   - Pushes to `main` trigger a verification build via GitHub Actions.
   - To trigger a production release and update the AppImage, you MUST first increment the version in `package.json`:
     ```bash
     npm version patch  # or minor/major
     ```
   - Then, create and push a version tag matching the new version:
     ```bash
     git tag v1.x.x
     git push origin v1.x.x
     ```
   - Releases are automatically published to the GitHub "Releases" page and distributed via the built-in `electron-updater`.

## Technical Standards

- **Text Rendering:** Use `@chenglou/pretext` for all text measurement and layout. Avoid DOM-based measurements.
- **Styling:** Maintain a monospace aesthetic for the canvas rendering to match the inline editor.
- **Auto-Updates (Lightweight):** The application does NOT use `electron-updater` internally. Instead, updates are managed by a separate lightweight Bash/Zenity script (`scripts/update-manager.sh`). This script handles version checking via GitHub CLI (`gh`), user notification via `zenity`, and binary replacement.
- **Obsidian Compatibility:** Ensure the Markdown parser correctly handles Obsidian-specific syntax like `[[links]]`, `#tags`, and task checkboxes.
- **Environment:** The app is optimized for AwesomeWM on Arch Linux. Maintain frameless, transparent, and floating window properties.

