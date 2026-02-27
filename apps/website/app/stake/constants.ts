import {
  MIGRATE_STAKING_ZAP_ADDRESSES,
  DRIP_ADDRESSES,
} from "@walletchan/contract-addresses";

export const STAKE_CHAIN_ID = 8453;

const migrate = MIGRATE_STAKING_ZAP_ADDRESSES[STAKE_CHAIN_ID];
const drip = DRIP_ADDRESSES[STAKE_CHAIN_ID];

export const WCHAN_VAULT_ADDR = drip.wchanVault as `0x${string}`;
export const WCHAN_TOKEN_ADDR = drip.wchan as `0x${string}`;
export const OLD_VAULT_ADDR = migrate.oldVault as `0x${string}`;
export const OLD_TOKEN_ADDR = migrate.oldToken as `0x${string}`;
export const MIGRATE_ZAP_ADDR = migrate.migrateZap as `0x${string}`;
