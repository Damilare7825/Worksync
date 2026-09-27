#!/bin/sh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${DIR}/../deploy/nginx/ssl/live"

mkdir -p "${TARGET_DIR}"

if command -v openssl >/dev/null 2>&1; then
  echo "Generating 2048-bit RSA self-signed SSL certificate..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${TARGET_DIR}/privkey.pem" \
    -out "${TARGET_DIR}/fullchain.pem" \
    -subj "/CN=localhost/O=WorkSync/C=US"
  echo "SSL certificates generated in ${TARGET_DIR}"
else
  echo "OpenSSL not found. Please install openssl or copy your certificate and private key to ${TARGET_DIR}"
  exit 1
fi
