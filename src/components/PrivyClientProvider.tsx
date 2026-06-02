"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function PrivyClientProvider({ children }: { children: ReactNode }) {
  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["google"],
        appearance: {
          theme: "light",
          accentColor: "#FEDB02",
          logo: "/favicon.ico",
          walletList: ["detected_ethereum_wallets", "detected_solana_wallets", "metamask", "phantom"],
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
