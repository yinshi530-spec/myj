#!/bin/bash
set -e
set -u

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "==================== 配置 npm ===================="
npm config set registry https://registry.anpm.alibaba-inc.com
echo "npm registry: $(npm config get registry)"

npm install
npm run dev -- --host ::1 --port 3000
