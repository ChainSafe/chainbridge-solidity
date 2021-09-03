#!/usr/bin/env bash
# Copyright 2020 ChainSafe Systems
# SPDX-License-Identifier: LGPL-3.0-only


set -e

base_path="./build/bindings"
BIN_DIR="$base_path/bin"
ABI_DIR="$base_path/abi"
RUNTIME_DIR="$base_path/runtime"
GO_DIR="$base_path/go"

echo "Generating json ABI and associated files..."
./scripts/compileAbiBin.js

# Remove old bin and abi
echo "Removing old builds..."
mkdir $GO_DIR

for file in "$BIN_DIR"/*.bin
do
    base=`basename $file`
    value="${base%.*}"
    echo Compiling file $value from path $file

    # Create the go package directory
    mkdir $GO_DIR/$value

    # Build the go package
    abigen --abi $ABI_DIR/${value}.abi --pkg $value --type $value --bin $BIN_DIR/${value}.bin --out $GO_DIR/$value/$value.go
done