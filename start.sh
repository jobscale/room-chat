#!/bin/bash -eu

export PORT=3033
export DB_HOST=172.16.6.24

cd /var/site/projects/nodejs/chat
npm start
