import { useState, useEffect } from "react";
import {
  useUpdateEffect,
  Flex,
  Heading,
  Spacer,
  Container,
  Switch,
  Text,
  HStack,
  Center,
  Image,
  InputGroup,
  Input,
  InputRightElement,
  Box,
  Button,
  Select,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { SettingsIcon } from "@chakra-ui/icons";
import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { isAddress } from "@ethersproject/address";
import Settings from "@/components/Settings";
import { useNetworks } from "@/contexts/NetworksContext";

function App() {
  const { networksInfo, reloadRequired, setReloadRequired } = useNetworks();

  const [isEnabled, setIsEnabled] = useState(true);
  const [isInjected, setIsInjected] = useState(false); // isEnabled can change by toggle, but this tells if actually injected
  const [displayAddress, setDisplayAddress] = useState<string>("");
  const [address, setAddress] = useState<string>();
  const [isAddressValid, setIsAddressValid] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [chainName, setChainName] = useState<string>();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const currentTab = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  };

  const updateAddress = async () => {
    setIsUpdating(true);
    const tab = await currentTab();

    let isValid = false;
    let _address = address;
    if (address) {
      // get mainnet rpc (if exists)
      let mainnetRPC: string | undefined;
      if (networksInfo) {
        for (const chainName of Object.keys(networksInfo)) {
          if (networksInfo[chainName].chainId === 1) {
            mainnetRPC = networksInfo[chainName].rpcUrl;
            break;
          }
        }
      }

      if (!mainnetRPC) {
        // fallback public rpc
        mainnetRPC = "https://rpc.ankr.com/eth";
      }

      // Resolve ENS
      const mainnetProvider = new StaticJsonRpcProvider(mainnetRPC);
      const resolvedAddress = await mainnetProvider.resolveName(address);
      if (resolvedAddress) {
        setAddress(resolvedAddress);
        _address = resolvedAddress;
        isValid = true;
      } else if (isAddress(address)) {
        isValid = true;
      }
    }

    setIsAddressValid(isValid);

    if (isValid) {
      // send msg to content_script (inject.ts)
      chrome.tabs.sendMessage(tab.id!, {
        type: "setAddress",
        msg: { address: _address, displayAddress },
      });

      // save to browser storage
      await chrome.storage.sync.set({
        address: _address,
      });
      await chrome.storage.sync.set({
        displayAddress,
      });
    }

    setIsUpdating(false);
  };

  useEffect(() => {
    const init = async () => {
      let _address: string | undefined = undefined;
      let _displayAddress: string | undefined = undefined;
      let _chainName: string | undefined = undefined;

      const {
        displayAddress: storedDisplayAddress,
        address: storedAddress,
        chainName: storedChainName,
        isEnabled: storedIsEnabled,
      } = (await chrome.storage.sync.get([
        "displayAddress",
        "address",
        "chainName",
        "isEnabled",
      ])) as {
        displayAddress: string | undefined;
        address: string | undefined;
        chainName: string | undefined;
        isEnabled: boolean | undefined;
      };

      if (storedDisplayAddress) {
        _displayAddress = storedDisplayAddress;
      }

      _address =
        storedAddress && storedAddress.length > 0
          ? storedAddress
          : "0x0000000000000000000000000000000000000000";

      if (storedChainName) {
        _chainName = storedChainName;
      }
      setIsEnabled(storedIsEnabled ?? true);

      // fetch `store` from content_script (inject.ts) if provider already injected in this current tab,
      // set address & chain
      const tab = await currentTab();
      chrome.tabs.sendMessage(
        tab.id!,
        {
          type: "getInfo",
        },
        (store: {
          address: string;
          displayAddress: string;
          chainName: string;
        }) => {
          if (store.address && store.address.length > 0) {
            setAddress(store.address);
          } else if (_address) {
            setAddress(_address);
          }

          if (store.displayAddress && store.displayAddress.length > 0) {
            setDisplayAddress(store.displayAddress);
          } else if (_displayAddress) {
            setDisplayAddress(_displayAddress);
          }

          if (store.chainName && store.chainName.length > 0) {
            setChainName(store.chainName);
            setIsInjected(true);
          } else if (_chainName) {
            setChainName(_chainName);
          }
        },
      );
    };

    init();
  }, []);

  useEffect(() => {
    chrome.storage.sync.set({
      isEnabled,
    });
  }, [isEnabled]);

  useUpdateEffect(() => {
    if (isEnabled && chainName && !isInjected) {
      setReloadRequired(true);
    }
  }, [isEnabled]);

  useUpdateEffect(() => {
    const updateChainId = async () => {
      if (networksInfo && chainName) {
        const tab = await currentTab();
        const chainId = networksInfo[chainName].chainId;

        // send msg to content_script (inject.ts)
        chrome.tabs.sendMessage(tab.id!, {
          type: "setChainId",
          msg: { chainName, chainId, rpcUrl: networksInfo[chainName].rpcUrl },
        });

        // save to browser storage
        await chrome.storage.sync.set({
          chainName,
        });
      }
    };

    updateChainId();
  }, [chainName, networksInfo]);

  useUpdateEffect(() => {
    if (reloadRequired && networksInfo) {
      // first chain is added, so set that as the selected network
      setChainName(Object.keys(networksInfo)[0]);
    }
  }, [reloadRequired, networksInfo]);

  return (
    <>
      <Flex
        py="4"
        px={["2", "4", "10", "10"]}
        borderBottom="2px"
        borderBottomColor="gray.400"
      >
        <Spacer flex="1" />
        <Heading maxW={["302px", "4xl", "4xl", "4xl"]}>
          <HStack spacing={4}>
            <Image src="impersonatorLogo.png" w="2.2rem" />
            <Text>BankrWallet</Text>
          </HStack>
        </Heading>
        <Spacer flex="1" />
      </Flex>
      <Container mt="0.4rem" pb="1rem" alignItems={"center"}>
        {!isSettingsOpen ? (
          <>
            <Flex>
              <HStack spacing={5}>
                <Text fontSize="md">Enabled</Text>
                <Switch
                  size="sm"
                  isChecked={isEnabled}
                  onChange={() => setIsEnabled((_isEnabled) => !_isEnabled)}
                />
              </HStack>
              <Spacer />
              <Button
                size="sm"
                onClick={() =>
                  setIsSettingsOpen((_isSettingsOpen) => !_isSettingsOpen)
                }
              >
                <SettingsIcon
                  transition="900ms rotate ease-in-out"
                  transform={isSettingsOpen ? "rotate(33deg)" : "rotate(0deg)"}
                />
              </Button>
            </Flex>
            <Center flexDir={"column"}>
              <Box mt="1.5rem">
                <InputGroup>
                  <Input
                    placeholder="address / ens"
                    aria-label="address"
                    autoComplete="off"
                    minW="20rem"
                    pr="5.2rem"
                    rounded="lg"
                    value={displayAddress}
                    onChange={(e) => {
                      const _displayAddress = e.target.value.trim();
                      setDisplayAddress(_displayAddress);
                      setAddress(_displayAddress);
                      if (isAddressValid) {
                        setIsAddressValid(true); // remove invalid warning when user types again
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updateAddress();
                    }}
                    isInvalid={!isAddressValid}
                  />
                  <InputRightElement w="4.5rem" mr="0.5rem">
                    <Button
                      size="sm"
                      h="1.5rem"
                      onClick={() => updateAddress()}
                      isLoading={isUpdating}
                    >
                      Update
                    </Button>
                  </InputRightElement>
                </InputGroup>
              </Box>
              <Select
                mt="1rem"
                px="0.2rem"
                variant="filled"
                rounded="lg"
                _hover={{ cursor: "pointer" }}
                placeholder={
                  networksInfo && Object.keys(networksInfo).length > 0
                    ? undefined
                    : "Select Network"
                }
                value={chainName}
                onChange={(e) => {
                  if (!chainName) {
                    setReloadRequired(true);
                  }
                  setChainName(e.target.value);
                }}
              >
                {networksInfo &&
                  Object.keys(networksInfo).map((chainName, i) => (
                    <option value={chainName} key={i}>
                      {chainName}
                    </option>
                  ))}
              </Select>
            </Center>
            {reloadRequired && (
              <Alert mt="1.5rem" status="warning" rounded="lg">
                <AlertIcon />
                <AlertTitle fontSize="md">Reload current page</AlertTitle>
                <Spacer />
                <AlertDescription>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const tab = await currentTab();
                      const url = tab.url!;
                      // refresh retains cache and injected doesn't work
                      // so doing like this:
                      chrome.tabs.create({ url });
                      chrome.tabs.remove(tab.id!);
                      setReloadRequired(false);
                    }}
                  >
                    Reload
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <Settings close={() => setIsSettingsOpen(false)} />
        )}
      </Container>
    </>
  );
}

export default App;
