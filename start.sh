#!/bin/bash -eu

export PORT=3033
export DB_HOST=db

cd /var/site/projects/node/chat
PATH="$PATH:/var/site/.nvm/versions/node/v8.14.0/bin"
npm run inspect
