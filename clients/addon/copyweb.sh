#!/bin/bash

# Copy over UI used by the content part of the addon.
rm -rf data/web
mkdir data/web
mkdir data/web/deps
mkdir data/web/firefox

mkdir data/web/deps/rdctests

# Source Tree Location => jetpack 'data' location

# clients/deps        => web/deps
cp -r ../deps data/web
# clients/firefox     => web/firefox
cp -r ../firefox data/web
# common/lib/rdcommon => web/deps/rdcommon
cp -r ../../common/lib/rdcommon data/web/deps

# common/test         => web/deps/rdctests
cp -r ../../common/test/*.js data/web/deps/rdctests
