import { HStack, Text, Link } from "@chakra-ui/react";
import Chains from "./Chains";

function Settings({ close }: { close: () => void }) {
  return (
    <>
      <Chains close={close} />
      <HStack>
        <Text>Built by:</Text>
        <Link
          onClick={() => {
            chrome.tabs.create({ url: "https://twitter.com/apoorvlathey" });
          }}
        >
          @apoorvlathey
        </Link>
      </HStack>
    </>
  );
}

export default Settings;
