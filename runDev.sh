#! /usr/bin/env bash

#use the node modules built for the docker image
cp -r /app/node_modules /app-dev/node_modules
cd /app-dev
node-dev /app-dev/index.js
