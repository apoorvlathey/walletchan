import { startProviderContentBridge } from "./provider/contentBridge/bootstrap";
import { startExplorerTransactionInjection } from "./explorerTransaction/injection";

startProviderContentBridge();
startExplorerTransactionInjection();

export {};
