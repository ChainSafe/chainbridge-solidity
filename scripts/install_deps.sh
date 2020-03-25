#!/usr/bin/env bash
# Copyright 2020 ChainSafe Systems
# SPDX-License-Identifier: LGPL-3.0-only


set -e

(set -x; npm install)

if [ -x "$(command -v truffle)" ]
then
  echo "truffle found, skipping install"
else
  (set -x; npm install --global truffle)
fi

if [ -x "$(command -v ganache-cli)" ]
then
  echo "ganache-cli found, skipping install"
else
  (set -x; npm install --global ganache-cli)
fi

if [ -x "$(command -v abigen)" ]
then
  echo "abigen found, skipping install"
else
  unameOut="$(uname -s)"
  case "${unameOut}" in
      Linux*)
        echo "Found linux machine, will try using apt to install"
        ( set -x; sudo add-apt-repository -y ppa:ethereum/ethereum &&
        sudo apt-get update &&
        sudo apt-get install ethereum )
        ;;
      Darwin*)
        echo "Found macOS machine, will try using brew to install"
        ( set -x; brew tap ethereum/ethereum &&
        brew install ethereum )
        ;;
      *)
        echo "Operating system not supported, please manually install: https://geth.ethereum.org/docs/install-and-build/installing-geth"
  esac
fi

