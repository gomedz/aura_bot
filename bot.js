require('dotenv').config();
const { ethers } = require('ethers');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pelindung agar proses Node.js tidak mati jika RPC Caldera mendadak 502
process.on('unhandledRejection', (reason) => {
  console.log('⚠️ [Warning] RPC timeout/502 tertangkap oleh guard (bot tetap berjalan):', reason?.message || reason);
});

// Fungsi untuk jeda acak (dalam detik)
function getRandomDelay(minSec, maxSec) {
  const min = Math.ceil(minSec);
  const max = Math.floor(maxSec);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Wrapper retry untuk pemanggilan RPC biasa
async function sendWithRetry(fn, maxRetries = 5, delay = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.log(`⚠️ RPC hiccup (${err.shortMessage || err.message || '502/timeout'}). Retry [${attempt}/${maxRetries}] dalam ${delay/1000}s...`);
      await sleep(delay);
    }
  }
}

// Fungsi polling konfirmasi mandiri (ANTI-CRASH)
async function waitForReceipt(provider, txHash, maxAttempts = 25, intervalMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
    } catch (err) {
      // Abaikan jika RPC 502 saat mengecek status receipt, tunggu interval berikutnya
    }
    await sleep(intervalMs);
  }
  return null; // Jika jaringan sangat lambat
}

async function main() {
  const rpcUrl = process.env.RPC_URL || "https://liteforge.rpc.caldera.xyz/http";
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.LAUNCHPAD_CONTRACT || "0xC623189CbA3ec0b5B46A0eBf593064a83b05F6d4";
  const amountZkLtc = process.env.AMOUNT_PER_TX || "0.0001";
  const totalTx = parseInt(process.env.TOTAL_TRANSACTIONS || "10", 10);
  
  const minDelay = parseInt(process.env.MIN_DELAY_SEC || "5", 10);
  const maxDelay = parseInt(process.env.MAX_DELAY_SEC || "15", 10);

  const CALLDATA = process.env.CALLDATA || "0xa6f2ae3a";
  const GAS_LIMIT = parseInt(process.env.GAS_LIMIT || "180000", 10);

  if (!privateKey) {
    console.error("❌ [Error] PRIVATE_KEY belum disetel di file .env!");
    console.error("👉 Silakan salin .env.example menjadi .env lalu masukkan PRIVATE_KEY Anda.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const userAddress = await wallet.getAddress();

  console.log("==================================================");
  console.log("🚀 AuraLaunch Presale Bot (LitVM LiteForge)");
  console.log(`👤 Wallet Address : ${userAddress}`);
  console.log(`🎯 Target Pool    : ${contractAddress}`);
  console.log(`⚡ Method Data    : ${CALLDATA}`);
  console.log(`💰 Pembelian/Tx   : ${amountZkLtc} zkLTC`);
  console.log(`🔁 Total Transaksi: ${totalTx} kali`);
  console.log(`🎲 Rentang Jeda   : ${minDelay} - ${maxDelay} detik (Acak)`);
  console.log("==================================================");

  const balance = await sendWithRetry(() => provider.getBalance(userAddress));
  console.log(`💳 Saldo Saat Ini : ${ethers.formatEther(balance)} zkLTC`);

  const amountInWei = ethers.parseEther(amountZkLtc);

  for (let i = 1; i <= totalTx; i++) {
    console.log(`\n⏳ [Tx ${i}/${totalTx}] Mengirim transaksi...`);

    try {
      // Ambil gasPrice dan nonce terbaru
      const feeData = await sendWithRetry(() => provider.getFeeData());
      const nonce = await sendWithRetry(() => provider.getTransactionCount(userAddress, "pending"));

      const tx = await sendWithRetry(() => wallet.sendTransaction({
        to: contractAddress,
        value: amountInWei,
        data: CALLDATA,
        gasLimit: GAS_LIMIT,
        nonce: nonce,
        gasPrice: feeData.gasPrice ? (feeData.gasPrice * 115n) / 100n : undefined
      }));

      console.log(`🚀 Tx Terkirim! Hash: ${tx.hash}`);
      console.log(`⏳ Menunggu konfirmasi...`);

      // Menggunakan fungsi waitForReceipt anti-crash
      const receipt = await waitForReceipt(provider, tx.hash);

      if (receipt) {
        if (receipt.status === 1) {
          console.log(`✅ [Tx ${i}/${totalTx}] Sukses! Block: ${receipt.blockNumber}`);
        } else {
          console.log(`⚠️ [Tx ${i}/${totalTx}] Reverted on-chain.`);
        }
      } else {
        console.log(`ℹ️ [Tx ${i}/${totalTx}] Tx sudah broadcast tapi konfirmasi lambat, lanjut ke tx berikutnya.`);
      }

    } catch (error) {
      console.error(`❌ Gagal pada transaksi ke-${i}:`, error.shortMessage || error.message || error);
    }

    // Jeda acak
    if (i < totalTx) {
      const randomSeconds = getRandomDelay(minDelay, maxDelay);
      console.log(`🎲 Jeda acak: Menunggu ${randomSeconds} detik sebelum transaksi berikutnya...`);
      await sleep(randomSeconds * 1000);
    }
  }

  console.log("\n🎉 Seluruh proses selesai!");
}

main().catch(console.error);