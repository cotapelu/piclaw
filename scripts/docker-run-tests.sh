#!/usr/bin/env bash
# Docker test runner for PiClaw
# Usage: ./scripts/docker-run-tests.sh [docker-compose args...]

set -euo pipefail

# Default to docker compose v2
COMPOSE_CMD="docker compose"

# Check if docker-compose (v1) is used instead
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  else
    echo "Error: Neither docker compose (v2) nor docker-compose (v1) found." >&2
    exit 1
  fi
fi

# Build the test image if not present or force rebuild if FORCE_BUILD is set
if [ "${FORCE_BUILD:-0}" = "1" ] || ! $COMPOSE_CMD -f docker-compose.test.yml images | grep -q piclaw-test; then
  echo "Building Docker image 'piclaw-test'..."
  $COMPOSE_CMD -f docker-compose.test.yml build
fi

# Run tests
echo "Running tests in Docker container..."
$COMPOSE_CMD -f docker-compose.test.yml run --rm test-runner "$@"
