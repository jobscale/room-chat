#!/bin/bash -eu

export PORT=3033
export DB_HOST=db
export CLUSTERING=false

PATH="$PATH:/var/site/.nvm/versions/node/v10.14.1/bin"
cd /var/site/projects/node/chat
npm run inspect
