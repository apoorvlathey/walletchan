import React, { createContext, useState, useEffect, useContext } from "react";
import { useUpdateEffect } from "@chakra-ui/react";
import { NetworksInfo } from "@/types";
import { DEFAULT_NETWORKS } from "@/constants/networks";

type NetworkContextType = {
  networksInfo: NetworksInfo | undefined;
  setNetworksInfo: React.Dispatch<
    React.SetStateAction<NetworksInfo | undefined>
  >;
  reloadRequired: boolean;
  setReloadRequired: React.Dispatch<React.SetStateAction<boolean>>;
};

export const NetworksContext = createContext<NetworkContextType>({
  networksInfo: undefined,
  setNetworksInfo: () => {},
  reloadRequired: false,
  setReloadRequired: () => {},
});

export const NetworksProvider: React.FunctionComponent<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [networksInfo, setNetworksInfo] = useState<NetworksInfo>();
  const [reloadRequired, setReloadRequired] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { networksInfo: storedNetworksInfo } =
        (await chrome.storage.sync.get("networksInfo")) as {
          networksInfo: NetworksInfo | undefined;
        };

      if (storedNetworksInfo) {
        setNetworksInfo(storedNetworksInfo);
      } else {
        // Initialize with default networks if nothing stored
        setNetworksInfo(DEFAULT_NETWORKS);
      }
    };

    fetch();
  }, []);

  useUpdateEffect(() => {
    const saveToBrowser = async () => {
      await chrome.storage.sync.set({
        networksInfo,
      });
    };

    saveToBrowser();
  }, [networksInfo]);

  return (
    <NetworksContext.Provider
      value={{
        networksInfo,
        setNetworksInfo,
        reloadRequired,
        setReloadRequired,
      }}
    >
      {children}
    </NetworksContext.Provider>
  );
};

export const useNetworks = () => useContext(NetworksContext);
