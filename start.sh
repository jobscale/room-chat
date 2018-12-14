#!/bin/bash -eu

export PORT=3033
export DB_HOST=db

cd /var/site/projects/node/chat
[[ -s "/var/site/.nvm/nvm.sh" ]] && . "/var/site/.nvm/nvm.sh"
[[ -s "/var/site/.nvm/nvm.sh" ]] && nvm use v8.14.0
npm run inspect
