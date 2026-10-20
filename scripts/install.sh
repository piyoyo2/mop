#!/bin/sh
set -e

# mop Coding Agent Installer
# Usage: curl -fsSL https://mop.sh/install | sh
#        curl -fsSL https://mop.sh/install | sh -s -- --binary --ref v0.1.0
#
# Options:
#   --source       Install via bun (installs bun if needed)
#   --binary       Always install prebuilt binary
#   --ref <ref>    Install specific tag/commit/branch (source mode); binary
#                  mode takes a release tag (v<version>)
#   -r <ref>       Shorthand for --ref
#
# Prebuilt binaries come from the project's GitHub releases and are checked
# against the published sha256 before install.
#
# Environment overrides:
#   PI_RELEASES_URL       release asset base (default https://github.com/<repo>/releases)
#   PI_RELEASES_API_URL   release metadata base (default https://api.github.com/repos/<repo>/releases)

REPO="soliloquy1/mop"
PACKAGE="@mop/pi-coding-agent"
INSTALL_DIR="${PI_INSTALL_DIR:-$HOME/.local/bin}"
RELEASES_URL="${PI_RELEASES_URL:-https://github.com/${REPO}/releases}"
RELEASES_API_URL="${PI_RELEASES_API_URL:-https://api.github.com/repos/${REPO}/releases}"
while [ "${RELEASES_URL%/}" != "$RELEASES_URL" ]; do
    RELEASES_URL="${RELEASES_URL%/}"
done
while [ "${RELEASES_API_URL%/}" != "$RELEASES_API_URL" ]; do
    RELEASES_API_URL="${RELEASES_API_URL%/}"
done
MIN_BUN_VERSION="1.3.14"

# Parse arguments
MODE=""
REF=""
while [ $# -gt 0 ]; do
    case "$1" in
        --source)
            MODE="source"
            shift
            ;;
        --binary)
            MODE="binary"
            shift
            ;;
        --ref)
            shift
            if [ -z "$1" ]; then
                echo "Missing value for --ref"
                exit 1
            fi
            REF="$1"
            shift
            ;;
        --ref=*)
            REF="${1#*=}"
            if [ -z "$REF" ]; then
                echo "Missing value for --ref"
                exit 1
            fi
            shift
            ;;
        -r)
            shift
            if [ -z "$1" ]; then
                echo "Missing value for -r"
                exit 1
            fi
            REF="$1"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# If a ref is provided, default to source install
if [ -n "$REF" ] && [ -z "$MODE" ]; then
    MODE="source"
fi

# Check if bun is available
has_bun() {
    command -v bun >/dev/null 2>&1
}

# Normalized host architecture (x64|arm64). On macOS this uses
# `sysctl hw.optional.arm64` so it stays correct inside a Rosetta session,
# where `uname -m` reports the translated x86_64.
host_arch() {
    if [ "$(uname -s)" = "Darwin" ]; then
        if [ "$(sysctl -in hw.optional.arm64 2>/dev/null || /usr/sbin/sysctl -in hw.optional.arm64 2>/dev/null)" = "1" ]; then
            echo "arm64"
        else
            echo "x64"
        fi
        return
    fi
    case "$(uname -m)" in
        x86_64|amd64)  echo "x64" ;;
        arm64|aarch64) echo "arm64" ;;
        *)             uname -m ;;
    esac
}

# Bun's own architecture (x64|arm64), or empty when it can't be determined.
bun_arch() {
    bun -e 'process.stdout.write(process.arch)' 2>/dev/null
}

# True when Bun's architecture matches the host. If Bun's arch can't be read,
# assume a match rather than block the install.
bun_arch_matches_host() {
    ba="$(bun_arch)"
    [ -z "$ba" ] && return 0
    [ "$ba" = "$(host_arch)" ]
}

version_ge() {
    current="$1"
    minimum="$2"

    current_major="${current%%.*}"
    current_rest="${current#*.}"
    current_minor="${current_rest%%.*}"
    current_patch="${current_rest#*.}"
    current_patch="${current_patch%%.*}"

    minimum_major="${minimum%%.*}"
    minimum_rest="${minimum#*.}"
    minimum_minor="${minimum_rest%%.*}"
    minimum_patch="${minimum_rest#*.}"
    minimum_patch="${minimum_patch%%.*}"

    if [ "$current_major" -ne "$minimum_major" ]; then
        [ "$current_major" -gt "$minimum_major" ]
        return $?
    fi

    if [ "$current_minor" -ne "$minimum_minor" ]; then
        [ "$current_minor" -gt "$minimum_minor" ]
        return $?
    fi

    [ "$current_patch" -ge "$minimum_patch" ]
}

require_bun_version() {
    version_raw=$(bun --version 2>/dev/null || true)
    if [ -z "$version_raw" ]; then
        echo "Failed to read bun version"
        exit 1
    fi

    version_clean=${version_raw%%-*}
    if ! version_ge "$version_clean" "$MIN_BUN_VERSION"; then
        echo "Bun ${MIN_BUN_VERSION} or newer is required. Current version: ${version_clean}"
        echo "Upgrade Bun at https://bun.sh/docs/installation"
        exit 1
    fi
}

# Check if git is available
has_git() {
    command -v git >/dev/null 2>&1
}

# Install bun
install_bun() {
    echo "Installing bun..."
    if command -v bash >/dev/null 2>&1; then
        curl -fsSL https://bun.sh/install | bash
    else
        echo "bash not found; attempting install with sh..."
        curl -fsSL https://bun.sh/install | sh
    fi
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    require_bun_version
}

# Check if git-lfs is available
has_git_lfs() {
    command -v git-lfs >/dev/null 2>&1
}

# Install via bun
install_via_bun() {
    echo "Installing via bun..."
    if [ -n "$REF" ]; then
        if ! has_git; then
            echo "git is required for --ref when installing from source"
            exit 1
        fi

        TMP_DIR="$(mktemp -d)"
        trap 'rm -rf "$TMP_DIR"' EXIT

        if git clone --depth 1 --branch "$REF" "https://github.com/${REPO}.git" "$TMP_DIR" >/dev/null 2>&1; then
            :
        else
            git clone "https://github.com/${REPO}.git" "$TMP_DIR"
            (cd "$TMP_DIR" && git checkout "$REF")
        fi

        # Pull LFS files
        if has_git_lfs; then
            (cd "$TMP_DIR" && git lfs pull)
        fi

        if [ ! -d "$TMP_DIR/packages/coding-agent" ]; then
            echo "Expected package at ${TMP_DIR}/packages/coding-agent"
            exit 1
        fi

        bun install -g "$TMP_DIR/packages/coding-agent" || {
            echo "Failed to install from source"
            exit 1
        }
    else
        bun install -g "$PACKAGE" || {
            echo "Failed to install $PACKAGE"
            exit 1
        }
    fi
    echo ""
    echo "✓ Installed mop via bun"
    echo "Run 'mop' to get started!"
}

# The string value of field "$1" in the one-line JSON on stdin (last
# occurrence). Escaped quotes inside JSON strings never end in `"<key>"`, so
# string contents cannot fake a key.
json_string() {
    sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"
}

# Hex sha256 of file "$1".
sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | cut -d ' ' -f 1
    else
        shasum -a 256 "$1" | cut -d ' ' -f 1
    fi
}

# Install binary from the build service
install_binary() {
    if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
        echo "sha256sum or shasum is required to verify the downloaded binary"
        exit 1
    fi

    # Detect platform
    OS="$(uname -s)"
    ARCH="$(host_arch)"

    case "$OS" in
        Linux)  PLATFORM="linux" ;;
        Darwin) PLATFORM="macos" ;;
        *)      echo "Unsupported OS: $OS"; exit 1 ;;
    esac

    case "$ARCH" in
        x64)   TARGET_ARCH="x86_64" ;;
        arm64) TARGET_ARCH="arm64" ;;
        *)     echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    if [ "$PLATFORM" = "linux" ]; then
        if [ -f /etc/alpine-release ] || { command -v ldd >/dev/null 2>&1 && ldd --version 2>&1 | grep -qi musl; }; then
            PLATFORM="linux-musl"
        fi
    fi

    TARGET="${PLATFORM}-${TARGET_ARCH}"
    if [ -n "$REF" ]; then
        if ! printf '%s\n' "$REF" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
            echo "Binary installs take a release tag (v<version>) for --ref, got: $REF"
            echo "For branch/commit installs, use --source with --ref."
            exit 1
        fi
        VERSION="${REF#v}"
    else
        echo "Fetching latest release..."
        RELEASE_JSON=$(curl -fsSL --connect-timeout 10 --max-time 60 \
            "${RELEASES_API_URL}/latest") || {
            echo "Failed to resolve the latest mop release from ${REPO}"
            exit 1
        }
        VERSION=$(printf '%s' "$RELEASE_JSON" | json_string tag_name)
        VERSION="${VERSION#v}"
        if [ -z "$VERSION" ]; then
            echo "Unexpected release answer from ${REPO}"
            exit 1
        fi
    fi

    BINARY="mop-${VERSION}-${TARGET}"
    DOWNLOAD_URL="${RELEASES_URL}/download/v${VERSION}/${BINARY}"
    SHA_URL="${DOWNLOAD_URL}.sha256"
    echo "Using version: $VERSION"

    mkdir -p "$INSTALL_DIR"
    # Download next to the destination and move it into place only once the
    # checksum matches, so a bad download never replaces a working mop.
    DOWNLOAD_PATH="${INSTALL_DIR}/.mop.download.$$"
    SHA_PATH="${INSTALL_DIR}/.mop.sha256.$$"
    trap 'rm -f "$DOWNLOAD_PATH" "$SHA_PATH"' EXIT
    echo "Downloading ${BINARY}..."
    curl -fsSL --connect-timeout 10 --speed-limit 1024 --speed-time 30 "$DOWNLOAD_URL" -o "$DOWNLOAD_PATH"
    curl -fsSL --connect-timeout 10 --max-time 60 "$SHA_URL" -o "$SHA_PATH"
    EXPECTED_SHA256=$(awk '{print $1; exit}' "$SHA_PATH")
    if ! printf '%s\n' "$EXPECTED_SHA256" | grep -Eq '^[0-9a-f]{64}$'; then
        echo "Unexpected checksum file at ${SHA_URL}"
        exit 1
    fi
    ACTUAL_SHA256="$(sha256_of "$DOWNLOAD_PATH")"
    if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
        echo "Checksum mismatch for ${BINARY}: expected ${EXPECTED_SHA256}, got ${ACTUAL_SHA256}"
        exit 1
    fi
    chmod +x "$DOWNLOAD_PATH"
    mv -f "$DOWNLOAD_PATH" "${INSTALL_DIR}/mop"

    # Verify the freshly installed binary can actually start before reporting
    # success. Bun's musl-target binaries link libstdc++/libgcc dynamically,
    # which stock Alpine/musl systems do not ship, so the download succeeds while
    # the binary exits 127 with relocation errors. Never claim success for a
    # binary that cannot run.
    if ! SMOKE_OUTPUT="$("${INSTALL_DIR}/mop" --version 2>&1)"; then
        echo ""
        echo "✗ mop was downloaded to ${INSTALL_DIR}/mop but cannot start:"
        echo "$SMOKE_OUTPUT" | sed 's/^/    /'
        if [ "$PLATFORM" = "linux-musl" ]; then
            echo ""
            echo "The musl build links libstdc++/libgcc dynamically. Install them, then re-run 'mop':"
            if command -v apk >/dev/null 2>&1; then
                echo "    apk add libstdc++ libgcc"
            else
                echo "    (install the libstdc++ and libgcc runtime packages for your distro)"
            fi
        fi
        exit 1
    fi

    echo ""
    echo "✓ Installed mop to ${INSTALL_DIR}/mop"

    # Check if in PATH
    case ":$PATH:" in
        *":$INSTALL_DIR:"*) echo "Run 'mop' to get started!" ;;
        *) echo "Add ${INSTALL_DIR} to your PATH, then run 'mop'" ;;
    esac
}

# Main logic
case "$MODE" in
    source)
        if ! has_bun; then
            install_bun
        fi
        require_bun_version
        if ! bun_arch_matches_host; then
            echo "Error: bun reports architecture '$(bun_arch)' but this host is '$(host_arch)'."
            echo "Installing from source with this bun would produce a mismatched binary"
            echo "(e.g. x86_64 under Rosetta on Apple Silicon), causing slow startup and AVX warnings."
            echo "Install a native bun for your architecture, or re-run without --source to fetch the prebuilt $(host_arch) binary."
            exit 1
        fi
        install_via_bun
        ;;
    binary)
        install_binary
        ;;
    *)
        # Default: use bun only when it matches the host architecture, otherwise
        # fall back to the prebuilt binary so Rosetta bun can't force an x86_64 build.
        if has_bun && bun_arch_matches_host; then
            require_bun_version
            install_via_bun
        else
            if has_bun; then
                echo "Detected bun with architecture '$(bun_arch)' on a '$(host_arch)' host; using the prebuilt binary instead."
            fi
            install_binary
        fi
        ;;
esac
