import { HStack, Text, Link } from "@chakra-ui/react";
import Chains from "./Chains";

function Settings({ close }: { close: () => void }) {
  return (
    <>
      <Chains close={close} />
      <HStack>
        <Text>Built by:</Text>
        <Link
          textDecor={"underline"}
          onClick={() => {
            chrome.tabs.create({ url: "https://twitter.com/apoorveth" });
          }}
        >
          Apoorv Lathey
        </Link>
      </HStack>
    </>
  );
}

export default Settings;
