// Setup variables such as the ethereumNodeURL and the batch file
let batchFilePath = process.argv[2];
let tokenSaleAddress = process.argv[3];
let ethereumNodeURL = process.argv[4];

if (ethereumNodeURL == undefined) {
    ethereumNodeURL = 'http://localhost:9545';
}

if (tokenSaleAddress == undefined) {
    console.log('This script needs the BTUTokenSale contract address !');
    process.exit(1);
}

if (batchFilePath == undefined) {
    console.log('This script needs a batch file to assign token to addresses !');
    process.exit(2);
}

const fs = require('fs');
const path = require('path');

let batchFileData = [];

try {
    const BATCH_FILE_PATH = path.resolve(batchFilePath);
    batchFileData = fs.readFileSync(BATCH_FILE_PATH).toString().split('\n').filter(x => x);
    console.log("Num accounts = " + batchFileData.length);
} catch (error) {
    console.error("Could not open file at " + batchFilePath + " [" + error + "]");
    process.exit(3);
}

const BTUTokenSale = require('../build/contracts/BTUTokenSale.json');
const BTU = require('../build/contracts/BTU.json');
const Web3 = require('web3');
web3 = new Web3(new Web3.providers.HttpProvider(ethereumNodeURL));

let btuTokenSale = new web3.eth.Contract(BTUTokenSale.abi, tokenSaleAddress);
console.log("BTUTokenSale address = " + BTUTokenSale.address);

console.log("Accounts: \n" + batchFileData.join('\n'));
let addresses = [];
let amounts = [];
batchFileData.forEach(function(account) {
    let values = account.split(',').filter(x => x);
    if (values.length == 2) {
        addresses.push(values[0]);
        amounts.push(parseInt(values[1]));
    } else {
        console.log("Error parsing batch file !");
        process.exit(4);
    }
});

/* // When using real ethereum account
console.log("Unlocking account ...");
try {
    web3.personal.unlockAccount(web3.eth.accounts[0], password);
} catch(e) {
    console.log(e);
    return;
}
console.log("Unlock OK");
*/

//web3.eth.defaultAccount = web3.eth.accounts[0];

function getBTUToken() {
    return new Promise(function(resolve, reject) {
        btuTokenSale.methods.btuToken().call(function(err, res) {
            if (err) return reject(err);
            resolve(res);
        });
    });
}

web3.eth.getAccounts(function(error, accounts) {
    console.log("Using account: " + accounts[0]);
    let totalAllowance = amounts.reduce((a, b) => a + b, 0);

    getBTUToken().then(function(btuToken) {
        console.log("BTUToken address = " + btuToken);
        let btu = new web3.eth.Contract(BTU.abi, btuToken);
        btu.methods.balanceOf(tokenSaleAddress).call(function(error, result) {
            console.log("TokenSaleAddress Balance = " + result);
        });

        btuTokenSale.methods.assignTokens(addresses, amounts).estimateGas({from: accounts[0]}).then(function(estimatedGas) {
            console.log("Estimated gas = " + estimatedGas);
            // Add 10% to the gas limit
            let gasLimit = estimatedGas + Math.ceil(10 * estimatedGas / 100);
            console.log("GasLimit = " + gasLimit);
            btuTokenSale.methods.assignTokens(addresses, amounts).send({from: accounts[0], gas: gasLimit}, function(err, res) {
                if (err) {
                    console.log("Error assigning tokens: " + err);
                    return err;
                }
                console.log("done");
            });
        });

    }, function(err) {
        console.log(err);
    });
});