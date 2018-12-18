#!/bin/bash -eu

export PORT=3033
export DB_HOST=db
export CLUSTERING=false

cd /var/site/projects/node/chat
if [[ $(declare -F nvm >& /dev/null; echo $?) -eq '0' ]]
then
  nvm use v8.14.0
else
  PATH="$PATH:/var/site/.nvm/versions/node/v8.14.0/bin"
fi
npm run inspect
