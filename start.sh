#!/bin/bash -eu

export PORT=3033
export DB_HOST=db
export CLUSTERING=false

. /home/jobscale/.nvm/nvm.sh
cd /var/site/projects/node/chat
npm run inspect
