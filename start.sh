#!/bin/bash -eu

export PORT=3033
export DB_HOST=db

cd /var/site/projects/node/chat
[[ -s "$HOME/.nvm/nvm.sh" ]] && . "$HOME/.nvm/nvm.sh"
[[ -s "$HOME/.nvm/nvm.sh" ]] && nvm use v8.14.0
npm run inspect
