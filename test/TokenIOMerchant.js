var { utils } = require('ethers');
var Promise = require('bluebird')
var TokenIOFeeContract = artifacts.require("./TokenIOFeeContract.sol");
var TokenIOMerchant = artifacts.require("./TokenIOMerchant.sol");
var TokenIOERC20 = artifacts.require("./TokenIOERC20.sol");
var TokenIOCurrencyAuthority = artifacts.require("./TokenIOCurrencyAuthority.sol");

const { mode, development, production } = require('../token.config.js');

const {
  AUTHORITY_DETAILS: { firmName, authorityAddress },
  TOKEN_DETAILS
} = mode == 'production' ? production : development;

const USDx = TOKEN_DETAILS['USDx']


contract("TokenIOFeeContract", function(accounts) {

	const TEST_ACCOUNT_1 = accounts[0]
	const TEST_ACCOUNT_2 = accounts[1]
	const MERCHANT_ACCOUNT = TEST_ACCOUNT_2
	const TEST_ACCOUNT_3 = accounts[2]
	const DEPOSIT_AMOUNT = 10000e2 // 1 million USD; 2 decimal representation
	const TRANSFER_AMOUNT = DEPOSIT_AMOUNT/4
  const SPENDING_LIMIT = DEPOSIT_AMOUNT/2
	const CURRENCY_SYMBOL = 'USDx'
	const MERCHANT_PAYS_FEES = true;

	it("Should transfer an amount of funds to merchant and send the fees to the fee contract", async () => {
		const CA = await TokenIOCurrencyAuthority.deployed()
		const merchant = await TokenIOMerchant.deployed()
		const token = await TokenIOERC20.deployed()
		const feeContract = await TokenIOFeeContract.deployed()

		const APPROVE_ACCOUNT_1_TX = await CA.approveKYC(TEST_ACCOUNT_1, true, SPENDING_LIMIT, "Token, Inc.")
		const APPROVE_ACCOUNT_2_TX = await CA.approveKYC(TEST_ACCOUNT_2, true, SPENDING_LIMIT, "Token, Inc.")
		const APPROVE_ACCOUNT_3_TX = await CA.approveKYC(TEST_ACCOUNT_3, true, SPENDING_LIMIT, "Token, Inc.")

		assert.equal(APPROVE_ACCOUNT_1_TX['receipt']['status'], "0x1", "Transaction should succeed.")
		assert.equal(APPROVE_ACCOUNT_2_TX['receipt']['status'], "0x1", "Transaction should succeed.")

		const DEPOSIT_TX = await CA.deposit(CURRENCY_SYMBOL, TEST_ACCOUNT_1, DEPOSIT_AMOUNT, "Token, Inc.")
		assert.equal(DEPOSIT_TX['receipt']['status'], "0x1", "Transaction should succeed.")

		const TRANSFER_TX = await merchant.pay(CURRENCY_SYMBOL, MERCHANT_ACCOUNT, TRANSFER_AMOUNT, MERCHANT_PAYS_FEES, "0x0")
		assert.equal(TRANSFER_TX['receipt']['status'], "0x1", "Transaction should succeed.")

		const FEE_CONTRACT_BALANCE = +(await token.balanceOf(feeContract.address)).toString();
		const TX_FEES = +(await merchant.calculateFees(TRANSFER_AMOUNT)).toString()
		assert.equal(FEE_CONTRACT_BALANCE, TX_FEES, "Fee contract should have a balance equal to the transaction fees")

		const MERCHANT_ACCOUNT_BALANCE = +(await token.balanceOf(MERCHANT_ACCOUNT)).toString();
		assert.equal(MERCHANT_ACCOUNT_BALANCE, (TRANSFER_AMOUNT-TX_FEES), "Merchant account should have a balance equal to the transaction amount minus fees")

	})

	it("Should allow the fee contract to transfer an amount of tokens", async () => {
		const feeContract = await TokenIOFeeContract.deployed()
		const token = await TokenIOERC20.deployed()

		const TEST_ACCOUNT_3_BALANCE_BEG = +(await token.balanceOf(TEST_ACCOUNT_3)).toString()
		assert.equal(0, TEST_ACCOUNT_3_BALANCE_BEG, "TEST_ACCOUNT_3 should have a starting balance of zero.")

		const FEE_BALANCE = +(await feeContract.getTokenBalance(CURRENCY_SYMBOL)).toString()
		const TRANSFER_COLLECTED_FEES_TX = await feeContract.transferCollectedFees(CURRENCY_SYMBOL, TEST_ACCOUNT_3, FEE_BALANCE, "0x")

		assert.equal(TRANSFER_COLLECTED_FEES_TX['receipt']['status'], "0x1", "Transaction should succeed.")

		const TEST_ACCOUNT_3_BALANCE_END = +(await token.balanceOf(TEST_ACCOUNT_3)).toString()
		assert.equal(FEE_BALANCE, TEST_ACCOUNT_3_BALANCE_END, "TEST_ACCOUNT_3 should have successfully received the amount of the fee balance.")

	})




})
