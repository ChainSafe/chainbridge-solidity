const deploy = require("./deploy");
const bridge = require("./bridge")
const erc20 = require("./erc20");
const erc721 = require("./erc721");
const centrifuge = require("./centrifuge");

module.exports = {
    deploy,
    bridge,
    erc20,
    erc721,
    centrifuge,
}
