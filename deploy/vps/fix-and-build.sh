#!/usr/bin/env bash
# Um unico comando: patches + build (cole no hPanel ou rode apos upload deste arquivo)
set -euo pipefail
cd /var/www/ultra-api
bash deploy/vps/patch-all-build-fixes.sh
bash deploy/vps/deploy-remote.sh
