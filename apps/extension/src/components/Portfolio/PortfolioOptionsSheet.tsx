import { Box, Icon, Tooltip, type IconProps } from "@chakra-ui/react";
import { AddIcon, InfoOutlineIcon, RepeatIcon, ViewOffIcon } from "@chakra-ui/icons";
import {
  ActionSheet,
  type ActionSheetChoice,
  type ActionSheetProps,
} from "@/components/ui";

interface PortfolioOptionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  finalFocusRef?: ActionSheetProps["finalFocusRef"];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onAddToken: () => void;
  onHideTokens?: () => void;
  unifyBalances: boolean;
  onUnifyBalancesChange: (next: boolean) => void;
  followDappNetwork: boolean;
  onFollowDappNetworkChange: (next: boolean) => void;
}

const UnifyBalancesIcon = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path
      d="M4 6h2.5c4.5 0 4.5 6 9 6H20M4 18h2.5c4.5 0 4.5-6 9-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m17 9 3 3-3 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Icon>
);

const FollowDappNetworkIcon = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="17" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    <path
      d="m8.3 11 7.4-3M8.3 13l7.4 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Icon>
);

function PreferenceLabel({ label, help, firstLine }: { label: string; help: string; firstLine?: string }) {
  return (
    <Box as="span">
      {firstLine && <>{firstLine}<br /></>}
      <Box as="span" display="inline-flex" alignItems="center" whiteSpace="nowrap">
      {label}
      <Tooltip label={help} hasArrow placement="top">
        <Box
          as="span"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          boxSize="24px"
          ml={1}
          verticalAlign="middle"
          color="fg.muted"
          cursor="help"
          tabIndex={0}
          aria-label={`About ${firstLine ? `${firstLine} ` : ""}${label}`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          _focusVisible={{ outline: "2px solid", outlineColor: "border.focus", borderRadius: "sm" }}
        >
          <InfoOutlineIcon boxSize="12px" aria-hidden />
        </Box>
      </Tooltip>
      </Box>
    </Box>
  );
}

export function PortfolioOptionsSheet({
  isOpen,
  onClose,
  finalFocusRef,
  onRefresh,
  isRefreshing,
  onAddToken,
  onHideTokens,
  unifyBalances,
  onUnifyBalancesChange,
  followDappNetwork,
  onFollowDappNetworkChange,
}: PortfolioOptionsSheetProps) {
  const choices: ActionSheetChoice[] = [
    {
      id: "refresh-portfolio",
      label: "Refresh portfolio",
      icon: <RepeatIcon boxSize="18px" />,
      isDisabled: !onRefresh || isRefreshing,
    },
    {
      id: "unify-balances",
      label: <PreferenceLabel label="Unify balances" help="Combine matching tokens across networks into one balance." />,
      icon: <UnifyBalancesIcon boxSize="18px" />,
      isSelected: unifyBalances,
      selectionVariant: "indicator-only",
    },
    {
      id: "follow-dapp-network",
      label: <PreferenceLabel firstLine="Auto filter by" label="dapp's active chain" help="Automatically show assets on the connected dapp’s active network." />,
      icon: <FollowDappNetworkIcon boxSize="18px" />,
      isSelected: followDappNetwork,
      selectionVariant: "indicator-only",
    },
    {
      id: "add-token",
      label: "Add custom token",
      icon: <AddIcon boxSize="16px" />,
    },
    ...(onHideTokens
      ? [{
          id: "hide-tokens",
          label: "Hide tokens",
          icon: <ViewOffIcon boxSize="18px" />,
        }]
      : []),
  ];

  return (
    <ActionSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Portfolio options"
      choices={choices}
      onSelect={(choiceId) => {
        if (choiceId === "refresh-portfolio") {
          onRefresh?.();
        } else if (choiceId === "unify-balances") {
          onUnifyBalancesChange(!unifyBalances);
        } else if (choiceId === "follow-dapp-network") {
          onFollowDappNetworkChange(!followDappNetwork);
        } else if (choiceId === "add-token") onAddToken();
        else if (choiceId === "hide-tokens") onHideTokens?.();
      }}
      finalFocusRef={finalFocusRef}
    />
  );
}
