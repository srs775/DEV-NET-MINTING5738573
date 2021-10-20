import { useState, useEffect } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
  SystemProgram,
} from "@solana/web3.js";
import "./styles.css";

type DisplayEncoding = "utf8" | "hex";
type PhantomEvent = "disconnect" | "connect";
type PhantomRequestMethod =
  | "connect"
  | "disconnect"
  | "signTransaction"
  | "signAllTransactions"
  | "signMessage";

interface ConnectOpts {
  onlyIfTrusted: boolean;
}

interface PhantomProvider {
  publicKey: PublicKey | null;
  isConnected: boolean | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  signMessage: (
    message: Uint8Array | string,
    display?: DisplayEncoding
  ) => Promise<any>;
  connect: (opts?: Partial<ConnectOpts>) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: PhantomEvent, handler: (args: any) => void) => void;
  request: (method: PhantomRequestMethod, params: any) => Promise<unknown>;
}

const getProvider = (): PhantomProvider | undefined => {
  if ("solana" in window) {
    const anyWindow: any = window;
    const provider = anyWindow.solana;
    if (provider.isPhantom) {
      return provider;
    }
  }
  window.open("https://phantom.app/", "_blank");
};

const NETWORK = clusterApiUrl("devnet");

export default function App() {
  const provider = getProvider();
  const [logs, setLogs] = useState<string[]>([]);
  const addLog = (log: string) => setLogs([...logs, log]);
  const connection = new Connection(NETWORK);
  const [, setConnected] = useState<boolean>(false);
  useEffect(() => {
    if (provider) {
      provider.on("connect", () => {
        setConnected(true);
        addLog("Connected to wallet " + provider.publicKey?.toBase58());
      });
      provider.on("disconnect", () => {
        setConnected(false);
        addLog("Disconnected from wallet");
      });
      // try to eagerly connect
      provider.connect({ onlyIfTrusted: true });
      return () => {
        provider.disconnect();
      };
    }
  }, [provider]);
  if (!provider) {
    return <h2>Could not find a provider</h2>;
  }

  const createTransferTransaction = async () => {
    if (!provider.publicKey) {
      return;
    }
    console.log("bum");
    let transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: "ETe7iiFy9JAucFifCnkEywG629YvmcQUeJrD6kHGn6SB",
        lamports: 1000000000,
      })
    );
    transaction.feePayer = provider.publicKey;
    addLog("Getting recent blockhash");
    const anyTransaction: any = transaction;
    anyTransaction.recentBlockhash = (
      await connection.getRecentBlockhash()
    ).blockhash;
    return transaction;
  };

  const sendTransaction = async () => {
    const transaction = await createTransferTransaction();
    if (transaction) {
      try {
        let signed = await provider.signTransaction(transaction);
        addLog("Got signature, submitting transaction");
        let signature = await connection.sendRawTransaction(signed.serialize());
        addLog(
          "Submitted transaction " + signature + ", awaiting confirmation"
        );
        await connection.confirmTransaction(signature);
        addLog("Transaction " + signature + " confirmed");
      } catch (err) {
        console.warn(err);
        addLog("Error: " + JSON.stringify(err));
      }
    }
  };
  const signMultipleTransactions = async (onlyFirst: boolean = false) => {
    const [transaction1, transaction2] = await Promise.all([
      createTransferTransaction(),
      createTransferTransaction(),
    ]);
    if (transaction1 && transaction2) {
      let signature;
      try {
        if (onlyFirst) {
          signature = await provider.signAllTransactions([transaction1]);
        } else {
          signature = await provider.signAllTransactions([
            transaction1,
            transaction2,
          ]);
        }
      } catch (err) {
        console.warn(err);
        addLog("Error: " + JSON.stringify(err));
      }
      addLog("Signature " + signature);
    }
  };
  const signMessage = async (message: string) => {
    const data = new TextEncoder().encode(message);
    try {
      await provider.signMessage(data);
    } catch (err) {
      console.warn(err);
      addLog("Error: " + JSON.stringify(err));
    }
    addLog("Message signed");
  };
  return (
    <div className="App">
      <h1>Dev Net Mint Page</h1>
      <main>
        {provider && provider.publicKey ? (
          <>
            <div>Wallet address: {provider.publicKey?.toBase58()}.</div>
            <div>isConnected: {provider.isConnected ? "true" : "false"}.</div>
            <button onClick={sendTransaction}>Mint</button>
            <button
              onClick={async () => {
                try {
                  const res = await provider.disconnect();
                  addLog(JSON.stringify(res));
                } catch (err) {
                  console.warn(err);
                  addLog("Error: " + JSON.stringify(err));
                }
              }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <>
            <button
              onClick={async () => {
                try {
                  const res = await provider.connect();
                  addLog(JSON.stringify(res));
                } catch (err) {
                  console.warn(err);
                  addLog("Error: " + JSON.stringify(err));
                }
              }}
            >
              Connect to Phantom
            </button>
          </>
        )}
        <hr />
      </main>
    </div>
  );
}
