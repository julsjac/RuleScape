#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CELLO_DIR="${REPO_ROOT}/cello"
MIN_NODE_MAJOR=18
NODE_VERSION=24
NVM_VERSION="v0.40.4"
NVM_DIR="${HOME}/.nvm"
DEFAULT_PYTHON_CANDIDATES=("python3.10" "python3.11" "python3")
CELLO_PYTHON=""

log() {
  printf '\n[%s] %s\n' "rulescape-setup" "$1"
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

node_major_version() {
  node -p "process.versions.node.split('.')[0]"
}

python_version_is_supported() {
  "$1" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'
}

load_nvm() {
  if [ -s "${NVM_DIR}/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR}/nvm.sh"
    return 0
  fi

  return 1
}

ensure_nvm() {
  if load_nvm; then
    log "Found nvm in ${NVM_DIR}."
    return
  fi

  if ! has_command curl; then
    printf '[rulescape-setup] curl is required to install nvm.\n' >&2
    exit 1
  fi

  log "Installing nvm ${NVM_VERSION}..."
  curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash

  if ! load_nvm; then
    printf '[rulescape-setup] nvm install completed, but nvm could not be loaded.\n' >&2
    exit 1
  fi
}

install_node_with_nvm() {
  ensure_nvm
  log "Installing Node.js ${NODE_VERSION} with nvm..."
  nvm install "${NODE_VERSION}"
  nvm use "${NODE_VERSION}"
  hash -r
}

ensure_node() {
  if has_command node && has_command npm; then
    local major
    major="$(node_major_version)"
    if [ "$major" -ge "$MIN_NODE_MAJOR" ]; then
      log "Found Node.js $(node -v) and npm $(npm -v)."
      return
    fi

    log "Found Node.js $(node -v), but version ${MIN_NODE_MAJOR}+ is recommended."
  else
    log "Node.js/npm not found."
  fi

  case "$(uname -s)" in
    Darwin|Linux)
      install_node_with_nvm
      ;;
    *)
      printf '[rulescape-setup] Unsupported OS: %s\n' "$(uname -s)" >&2
      exit 1
      ;;
  esac

  if ! has_command node || ! has_command npm; then
    printf '[rulescape-setup] Node.js/npm install did not complete successfully.\n' >&2
    exit 1
  fi

  log "Using Node.js $(node -v) and npm $(npm -v)."
}

select_cello_python() {
  local candidate
  for candidate in "${DEFAULT_PYTHON_CANDIDATES[@]}"; do
    if has_command "${candidate}" && python_version_is_supported "${candidate}"; then
      CELLO_PYTHON="${candidate}"
      break
    fi
  done

  if [ -z "${CELLO_PYTHON}" ]; then
    printf '[rulescape-setup] Python 3.10+ is required for Cello. Install python3.10 or python3.11 and rerun.\n' >&2
    exit 1
  fi

  log "Using ${CELLO_PYTHON} ($(${CELLO_PYTHON} --version 2>&1)) for Cello."
}

run_with_privilege() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi

  if has_command sudo; then
    sudo "$@"
    return
  fi

  printf '[rulescape-setup] %s requires elevated privileges, but sudo is unavailable.\n' "$1" >&2
  exit 1
}

ensure_homebrew_packages() {
  local packages=()

  if ! has_command yosys; then
    packages+=("yosys")
  fi

  if ! has_command dot; then
    packages+=("graphviz")
  fi

  if ! has_command java; then
    packages+=("openjdk@11")
  fi

  if [ "${#packages[@]}" -eq 0 ]; then
    return
  fi

  log "Installing Cello system dependencies with Homebrew: ${packages[*]}"
  brew install "${packages[@]}"

  if ! has_command java; then
    local java_prefix=""
    if brew --prefix openjdk@11 >/dev/null 2>&1; then
      java_prefix="$(brew --prefix openjdk@11)"
    elif brew --prefix openjdk >/dev/null 2>&1; then
      java_prefix="$(brew --prefix openjdk)"
    fi

    if [ -n "${java_prefix}" ] && [ -x "${java_prefix}/bin/java" ]; then
      export PATH="${java_prefix}/bin:${PATH}"
      hash -r
    fi
  fi
}

ensure_apt_packages() {
  local packages=()

  if ! has_command yosys; then
    packages+=("yosys")
  fi

  if ! has_command dot; then
    packages+=("graphviz")
  fi

  if ! has_command java; then
    packages+=("default-jre")
  fi

  if [ "${#packages[@]}" -eq 0 ]; then
    return
  fi

  log "Installing Cello system dependencies with apt: ${packages[*]}"
  run_with_privilege apt-get update
  run_with_privilege apt-get install -y "${packages[@]}"
}

ensure_cello_system_dependencies() {
  case "$(uname -s)" in
    Darwin)
      if ! has_command brew; then
        printf '[rulescape-setup] Homebrew is required to install Cello system dependencies on macOS.\n' >&2
        printf '[rulescape-setup] Install Homebrew from https://brew.sh and rerun this script.\n' >&2
        exit 1
      fi
      ensure_homebrew_packages
      ;;
    Linux)
      if has_command brew; then
        ensure_homebrew_packages
      elif has_command apt-get; then
        ensure_apt_packages
      else
        printf '[rulescape-setup] Install yosys, graphviz, and a Java runtime manually, then rerun this script.\n' >&2
        exit 1
      fi
      ;;
    *)
      printf '[rulescape-setup] Unsupported OS for automatic Cello dependency installation: %s\n' "$(uname -s)" >&2
      exit 1
      ;;
  esac

  if ! has_command yosys || ! has_command dot || ! has_command java; then
    printf '[rulescape-setup] Missing required Cello system dependency after install attempt.\n' >&2
    printf '[rulescape-setup] Required commands: yosys, dot, java\n' >&2
    exit 1
  fi

  log "Found Cello system dependencies: yosys, dot, java."
}

ensure_pip() {
  if "${CELLO_PYTHON}" -m pip --version >/dev/null 2>&1; then
    return
  fi

  log "Bootstrapping pip for ${CELLO_PYTHON}..."
  "${CELLO_PYTHON}" -m ensurepip --upgrade
}

install_cello_python_dependencies() {
  local pip_args=()

  if [ ! -f "${CELLO_DIR}/requirements.txt" ]; then
    printf '[rulescape-setup] Missing Cello requirements file at %s\n' "${CELLO_DIR}/requirements.txt" >&2
    exit 1
  fi

  if [ -z "${VIRTUAL_ENV:-}" ] && [ "$(id -u)" -ne 0 ]; then
    pip_args+=(--user)
  fi

  ensure_pip
  log "Installing Cello Python dependencies in ${CELLO_DIR}..."
  "${CELLO_PYTHON}" -m pip install "${pip_args[@]}" --upgrade pip
  "${CELLO_PYTHON}" -m pip install "${pip_args[@]}" -r "${CELLO_DIR}/requirements.txt"
}

main() {
  ensure_node
  select_cello_python

  log "Installing frontend dependencies in ${FRONTEND_DIR}..."
  cd "${FRONTEND_DIR}"
  npm install

  ensure_cello_system_dependencies
  install_cello_python_dependencies

  log "Done."
  printf '\n'
  printf 'Frontend:\n'
  printf '  cd %s\n' "${FRONTEND_DIR}"
  printf '  npm run dev\n'
  printf '\n'
  printf 'Cello pipeline server:\n'
  printf '  cd %s\n' "${CELLO_DIR}"
  printf '  %s cello_knox/pipeline_server.py\n' "${CELLO_PYTHON}"
}

main "$@"
