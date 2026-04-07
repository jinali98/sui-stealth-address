import { useState } from "react";
import { useStealthSdk } from "./hooks/useStealthSdk";
import { WalletButton } from "./components/WalletButton";
import { ReceiverTab } from "./components/ReceiverTab";
import { SenderTab } from "./components/SenderTab";
import { ClaimTab } from "./components/ClaimTab";

type Tab = "receiver" | "sender" | "claim";

function App() {
  const { isReady, error: sdkError } = useStealthSdk();
  const [activeTab, setActiveTab] = useState<Tab>("receiver");

  if (sdkError) {
    return <div className="error-screen">Failed to load SDK: {sdkError}</div>;
  }

  if (!isReady) {
    return <div className="loading-screen">Loading Stealth SDK...</div>;
  }

  return (
    <div className="app">
      <header>
        <h1>Sui Shadow : Stealth Address Protocol for Sui</h1>
        <p className="subtitle">Private payments on Sui blockchain</p>
        <WalletButton />
      </header>

      <nav className="tabs">
        <button
          className={activeTab === "receiver" ? "active" : ""}
          onClick={() => setActiveTab("receiver")}
        >
          Receive
        </button>
        <button
          className={activeTab === "sender" ? "active" : ""}
          onClick={() => setActiveTab("sender")}
        >
          Send
        </button>
        <button
          className={activeTab === "claim" ? "active" : ""}
          onClick={() => setActiveTab("claim")}
        >
          Claim
        </button>
      </nav>

      <main>
        {activeTab === "receiver" && <ReceiverTab />}
        {activeTab === "sender" && <SenderTab />}
        {activeTab === "claim" && <ClaimTab />}
      </main>

      <footer>
        <p>Powered by Sui Shadow Stealth Address Protocol</p>
      </footer>
    </div>
  );
}

export default App;
