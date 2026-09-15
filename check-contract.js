require('dotenv').config();
const { ethers } = require('ethers');

async function check() {
  const rpcUrl = process.env.RPC_URL || "https://liteforge.rpc.caldera.xyz/http";
  const contractAddress = process.env.LAUNCHPAD_CONTRACT || "0xC623189CbA3ec0b5B46A0eBf593064a83b05F6d4";

  console.log("🔍 Memeriksa Smart Contract di LitVM LiteForge...");
  console.log(`🌐 RPC URL : ${rpcUrl}`);
  console.log(`🎯 Target  : ${contractAddress}`);

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const code = await provider.getCode(contractAddress);
    
    if (code === "0x") {
      console.log("❌ Alamat tersebut bukan Smart Contract atau belum terdeploy di RPC ini!");
    } else {
      console.log("✅ Smart Contract ditemukan di jaringan!");
      console.log(`📦 Ukuran Bytecode: ${(code.length - 2) / 2} bytes`);
    }
  } catch (error) {
    console.error("❌ Gagal menghubungi RPC:", error.message || error);
  }
}

check();