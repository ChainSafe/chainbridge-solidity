URL?=http://localhost:8545

install-deps:
	@echo " > \033[32mInstalling dependencies... \033[0m "
	./scripts/install_deps.sh

install-cli: compile
	@echo " > \033[32mInstalling cb-sol-cli... \033[0m "
	npm link ./cli 

install-celo-ganache:
	git clone https://github.com/celo-org/ganache-cli.git
	npm install --prefix ./ganache-cli
	ln -f -s  $PWD/ganache-cli/cli.js  ~/.local/bin/celo-ganache

.PHONY: test
test:
	@echo " > \033[32mTesting contracts... \033[0m "
	npx truffle test

compile:
	@echo " > \033[32mCompiling contracts... \033[0m "
	npx truffle compile

start-ganache:
	@echo " > \033[32mStarting ganache... \033[0m "
	./scripts/start_ganache.sh

start-geth:
	@echo " > \033[32mStarting geth... \033[0m "
	./scripts/geth/start_geth.sh

deploy:
	@echo " > \033[32mDeploying evm contracts... \033[0m "
	./cli/index.js deploy --url=${URL}

bindings: compile
	@echo " > \033[32mCreating go bindings for ethereum contracts... \033[0m "
	./scripts/create_bindings.sh
celo-ganache:
	./scripts/start_celo_ganache.sh
