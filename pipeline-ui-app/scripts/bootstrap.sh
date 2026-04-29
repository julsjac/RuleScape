#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CELLO_DIR="${REPO_ROOT}/cello"
ML_DIR="${REPO_ROOT}/dataio/ml"
KNOX_DIR="${REPO_ROOT}/knox"
MIN_NODE_MAJOR=18
NODE_VERSION=24
NVM_VERSION="v0.40.4"
NVM_DIR="${HOME}/.nvm"
MIN_JAVA_MAJOR=17
DEFAULT_PYTHON_CANDIDATES=("python3.10" "python3.11" "python3")
RULESCAPE_PYTHON=""

log() {
  printf '
[%s] %s
' "rulescape-setup" "$1"
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

node_major_version() {
  node -p "process.versions.node.split('.')[0]"
}

java_major_version() {
  java -XshowSettings:properties -version 2>&1     | awk -F'= ' '/java.specification.version/ {print $2; exit}'     | awk -F. '{if ($1 == "1") print $2; else print $1}'
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
    printf '[rulescape-setup] curl is required to install nvm.
' >&2
    exit 1
  fi

  log "Installing nvm ${NVM_VERSION}..."
  curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash

  if ! load_nvm; then
    printf '[rulescape-setup] nvm install completed, but nvm could not be loaded.
' >&2
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
      printf '[rulescape-setup] Unsupported OS: %s
' "$(uname -s)" >&2
      exit 1
      ;;
  esac

  if ! has_command node || ! has_command npm; then
    printf '[rulescape-setup] Node.js/npm install did not complete successfully.
' >&2
    exit 1
  fi

  log "Using Node.js $(node -v) and npm $(npm -v)."
}

select_rulescape_python() {
  local candidate
  for candidate in "${DEFAULT_PYTHON_CANDIDATES[@]}"; do
    if has_command "${candidate}" && python_version_is_supported "${candidate}"; then
      RULESCAPE_PYTHON="${candidate}"
      break
    fi
  done

  if [ -z "${RULESCAPE_PYTHON}" ]; then
    printf '[rulescape-setup] Python 3.10+ is required. Install python3.10 or python3.11 and rerun.
' >&2
    exit 1
  fi

  log "Using ${RULESCAPE_PYTHON} ($(${RULESCAPE_PYTHON} --version 2>&1))."
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

  printf '[rulescape-setup] %s requires elevated privileges, but sudo is unavailable.
' "$1" >&2
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

  if ! has_command java || [ "$(java_major_version 2>/dev/null || echo 0)" -lt "$MIN_JAVA_MAJOR" ]; then
    packages+=("openjdk@17")
  fi

  if ! has_command mvn; then
    packages+=("maven")
  fi

  if [ "${#packages[@]}" -eq 0 ]; then
    return
  fi

  log "Installing system dependencies with Homebrew: ${packages[*]}"
  brew install "${packages[@]}"

  if brew --prefix openjdk@17 >/dev/null 2>&1; then
    local java_prefix="$(brew --prefix openjdk@17)"
    if [ -x "${java_prefix}/bin/java" ]; then
      export PATH="${java_prefix}/bin:${PATH}"
      hash -r
    fi
    if [ -d "${java_prefix}/libexec/openjdk.jdk/Contents/Home" ]; then
      export JAVA_HOME="${java_prefix}/libexec/openjdk.jdk/Contents/Home"
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

  if ! has_command java || [ "$(java_major_version 2>/dev/null || echo 0)" -lt "$MIN_JAVA_MAJOR" ]; then
    packages+=("openjdk-17-jdk")
  fi

  if ! has_command mvn; then
    packages+=("maven")
  fi

  if [ "${#packages[@]}" -eq 0 ]; then
    return
  fi

  log "Installing system dependencies with apt: ${packages[*]}"
  run_with_privilege apt-get update
  run_with_privilege apt-get install -y "${packages[@]}"
}

ensure_system_dependencies() {
  case "$(uname -s)" in
    Darwin)
      if ! has_command brew; then
        printf '[rulescape-setup] Homebrew is required to install RuleScape system dependencies on macOS.
' >&2
        printf '[rulescape-setup] Install Homebrew from https://brew.sh and rerun this script.
' >&2
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
        printf '[rulescape-setup] Install yosys, graphviz, Java 17+, and Maven manually, then rerun this script.
' >&2
        exit 1
      fi
      ;;
    *)
      printf '[rulescape-setup] Unsupported OS for automatic dependency installation: %s
' "$(uname -s)" >&2
      exit 1
      ;;
  esac

  if ! has_command yosys || ! has_command dot || ! has_command java || ! has_command mvn; then
    printf '[rulescape-setup] Missing required system dependency after install attempt.
' >&2
    printf '[rulescape-setup] Required commands: yosys, dot, java, mvn
' >&2
    exit 1
  fi

  if [ "$(java_major_version 2>/dev/null || echo 0)" -lt "$MIN_JAVA_MAJOR" ]; then
    printf '[rulescape-setup] Java 17+ is required for Knox.
' >&2
    exit 1
  fi

  log "Found system dependencies: yosys, dot, Java $(java -version 2>&1 | head -n 1), mvn $(mvn -v | head -n 1)."
}

ensure_pip() {
  if "${RULESCAPE_PYTHON}" -m pip --version >/dev/null 2>&1; then
    return
  fi

  log "Bootstrapping pip for ${RULESCAPE_PYTHON}..."
  "${RULESCAPE_PYTHON}" -m ensurepip --upgrade
}

pip_install_requirements() {
  local requirements_file="$1"
  local label="$2"
  local pip_args=()

  if [ ! -f "${requirements_file}" ]; then
    printf '[rulescape-setup] Missing %s requirements file at %s
' "${label}" "${requirements_file}" >&2
    exit 1
  fi

  if [ -z "${VIRTUAL_ENV:-}" ] && [ "$(id -u)" -ne 0 ]; then
    pip_args+=(--user)
  fi

  ensure_pip
  log "Installing ${label} Python dependencies from ${requirements_file}..."
  "${RULESCAPE_PYTHON}" -m pip install "${pip_args[@]}" --upgrade pip
  "${RULESCAPE_PYTHON}" -m pip install "${pip_args[@]}" -r "${requirements_file}"
}

install_cello_python_dependencies() {
  pip_install_requirements "${CELLO_DIR}/requirements.txt" "Cello"
}

install_ml_python_dependencies() {
  pip_install_requirements "${ML_DIR}/requirements.txt" "ML"
}

main() {
  ensure_node
  select_rulescape_python

  log "Installing frontend dependencies in ${FRONTEND_DIR}..."
  cd "${FRONTEND_DIR}"
  npm install

  ensure_system_dependencies
  install_cello_python_dependencies
  install_ml_python_dependencies

  log "Done."
  printf '
'
  printf 'Frontend:
'
  printf '  cd %s
' "${FRONTEND_DIR}"
  printf '  npm run dev
'
  printf '
'
  printf 'Cello pipeline server:
'
  printf '  cd %s
' "${CELLO_DIR}"
  printf '  %s cello_knox/pipeline_server.py
' "${RULESCAPE_PYTHON}"
  printf '
'
  printf 'ML server:
'
  printf '  cd %s
' "${REPO_ROOT}"
  printf '  %s -m dataio.ml.ml_server
' "${RULESCAPE_PYTHON}"
  printf '
'
  printf 'Knox (source build, still requires Neo4j if you are not using Docker):
'
  printf '  cd %s
' "${KNOX_DIR}"
  printf '  mvn clean install
'
  printf '  mvn spring-boot:run
'
}

main "$@"
