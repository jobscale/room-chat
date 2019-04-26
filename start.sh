#!/bin/bash -eu

export DB_PORT=6379
export DB_HOST=db
#export CLUSTERING=true

check() {
  nc $DB_HOST $DB_PORT -w 1 < /dev/null
  if [ $? -eq 0 ]
  then
    echo -e "\nOK!"
    return 0
  fi
  return 1
}

waiter() {
  while true
  do
    check
    if [ $? -eq 0 ]
    then
      break
    fi
    sleep 60
  done
}
waiter

. /home/jobscale/.nvm/nvm.sh
cd /var/site/projects/node/chat
npm run inspect
