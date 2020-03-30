PORT?=8545

install-deps:
	@echo " > \033[32mInstalling dependencies... \033[0m "
	./scripts/install_deps.sh

install-cli:
	@echo " > \033[32mInstalling cb-sol-cli... \033[0m "
	npm install --global ./scripts/cli

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

deploy:
	@echo " > \033[32mDeploying evm contracts... \033[0m "
	./scripts/cli/index.js deploy --port=${PORT}

bindings: compile
	@echo " > \033[32mCreating go bindings for ethereum contracts... \033[0m "
	./scripts/create_bindings.sh