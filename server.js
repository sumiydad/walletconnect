// Required modules
const WalletConnect = require('@walletconnect/node').default;
const QRCode = require('qrcode');
const TronWeb = require('tronweb');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

let walletConnectUri = null;

// Initialize WalletConnect
const connector = new WalletConnect({
  bridge: 'https://bridge.walletconnect.org',
});

// Wait for connection to be created
connector.createSession().then(() => {
  walletConnectUri = connector.uri;

  // Generate QR Code in terminal
  QRCode.toString(walletConnectUri, { type: 'terminal' }, (err, url) => {
    console.log('Scan this QR with Trust Wallet:');
    console.log(url);
  });
});

// Serve QR URI via HTTP
app.get('/walletconnect-uri', (req, res) => {
  if (walletConnectUri) {
    res.send({ uri: walletConnectUri });
  } else {
    res.status(503).send({ error: 'WalletConnect URI not ready yet' });
  }
});

// Approve session request
connector.on('session_request', (error, payload) => {
  if (error) throw error;

  connector.approveSession({
    accounts: ['TRON_ADDRESS'], // Replace with your TRON testnet address
    chainId: 1,
  });
});

// TRON setup
const tronWeb = new TronWeb({
  fullHost: 'https://api.nile.trongrid.io',
  privateKey: 'cf0918609a5e48e56b94db68b088225192478053aabe2b9bda59f0a3e1b7fe74', // Replace with testnet key
});

// TRC20 USDT Contract (Mainnet address shown, ensure testnet contract if needed)
const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// Listen for call requests
connector.on('call_request', async (error, payload) => {
  if (error) throw error;

  if (payload.method === 'tron_sendTransaction') {
    const { to, value } = payload.params;

    const tx = await tronWeb.transactionBuilder.triggerSmartContract(
      USDT_CONTRACT_ADDRESS,
      'transfer(address,uint256)',
      { feeLimit: 100000000 },
      [
        { type: 'address', value: to },
        { type: 'uint256', value: value }
      ],
      tronWeb.address.toHex(tronWeb.defaultAddress.base58)
    );

    const signedTx = await tronWeb.trx.sign(tx.transaction);
    const result = await tronWeb.trx.sendRawTransaction(signedTx);
    console.log('TRC20 Transfer Hash:', result.txid);
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
