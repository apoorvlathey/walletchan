import { useEffect, useRef, useState } from "react";
import { isAddress } from "@ethersproject/address";
import { isResolvableName, resolveNameToAddress } from "@/lib/ensUtils";
import { validateAndDeriveAddress } from "@/utils/privateKeyUtils";
import { newPasswordPolicyError } from "@/constants/securityPolicy";
import { startWorkerKeepaliveHeartbeat } from "@/app/uiKeepalive";
import type { LedgerAccountSelection } from "@/components/Ledger/AddLedgerFlow";
import {
  getOrCreateOnboardingOwnerId,
  isArcBrowser,
} from "./onboardingEnvironment";
import { submitOnboardingAccount } from "./onboardingSubmission";
import type { SafeOnboardingSelection } from "./safeOnboarding";
import { ACCOUNT_SETUP_STEPS } from "./onboardingTypes";
import type {
  AccountTypeChoice,
  OnboardingErrors,
  OnboardingStep,
} from "./onboardingTypes";

export function useOnboardingController() {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [createNewWallet, setCreateNewWallet] = useState(false);
  const submittingRef = useRef(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [accountTypeChoice, setAccountTypeChoice] =
    useState<AccountTypeChoice>("seedPhrase");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
  const [pkDisplayName, setPkDisplayName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [bankrDisplayName, setBankrDisplayName] = useState("");
  const [viewOnlyAddress, setViewOnlyAddress] = useState("");
  const [viewOnlyDisplayName, setViewOnlyDisplayName] = useState("");
  const [ledgerSelection, setLedgerSelection] =
    useState<LedgerAccountSelection | null>(null);
  const [safeSelection, setSafeSelection] = useState<SafeOnboardingSelection | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [collectedMnemonic, setCollectedMnemonic] = useState("");
  const [collectedSeedIndices, setCollectedSeedIndices] = useState<number[]>([0]);
  const [seedGroupName, setSeedGroupName] = useState("");
  const [seedAccountDisplayName, setSeedAccountDisplayName] = useState("");
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [setupRecoveryError, setSetupRecoveryError] = useState<string | null>(
    null,
  );
  const keepAlivePortRef = useRef<chrome.runtime.Port | null>(null);
  const stopKeepaliveHeartbeatRef = useRef<(() => void) | null>(null);
  const onboardingOwnerIdRef = useRef(getOrCreateOnboardingOwnerId());

  useEffect(() => {
    let disposed = false;
    const checkExistingSetup = async () => {
      if (isArcBrowser()) {
        console.log(
          "Arc browser detected during onboarding - disabling sidepanel",
        );
        await chrome.storage.sync.set({
          isArcBrowser: true,
          sidePanelMode: false,
        });
      }

      try {
        const setupStatus = await chrome.runtime.sendMessage({
          type: "getOnboardingInitializationStatus",
          initializationId: onboardingOwnerIdRef.current,
        });
        if (setupStatus?.configured) {
          setStep("success");
        } else if (setupStatus?.setupInProgress) {
          setSetupRecoveryError(
            "Wallet setup is already in progress in another tab. Finish or close that setup before trying again.",
          );
        } else if (setupStatus?.recoveryRequired || setupStatus?.error) {
          // Never overwrite unmarked data from an older extension version. It
          // may contain the user's only encrypted key material and requires an
          // explicit reset/recovery decision outside this setup flow.
          setSetupRecoveryError(
            setupStatus?.error ||
              "Incomplete wallet data was found. Open WalletChan settings to reset only if you have safely backed up every key and recovery phrase.",
          );
        }
      } catch {
        setSetupRecoveryError(
          "WalletChan could not verify the current wallet state. Reload the extension before continuing.",
        );
      } finally {
        setIsCheckingSetup(false);
      }

      if (!disposed && !keepAlivePortRef.current) {
        try {
          const port = chrome.runtime.connect({
            name: "onboarding-keepalive",
          });
          keepAlivePortRef.current = port;
          port.onDisconnect.addListener(() => {
            if (keepAlivePortRef.current !== port) return;
            stopKeepaliveHeartbeatRef.current?.();
            stopKeepaliveHeartbeatRef.current = null;
            keepAlivePortRef.current = null;
          });
          stopKeepaliveHeartbeatRef.current =
            startWorkerKeepaliveHeartbeat(port);
        } catch {
          // Ignore connection errors.
        }
      }
    };
    checkExistingSetup();
    return () => {
      disposed = true;
      stopKeepaliveHeartbeatRef.current?.();
      stopKeepaliveHeartbeatRef.current = null;
      const port = keepAlivePortRef.current;
      keepAlivePortRef.current = null;
      try {
        port?.disconnect();
      } catch {
        // The onboarding page or extension context may already be closed.
      }
    };
  }, []);

  const resolveAddress = async (input: string): Promise<string | null> => {
    if (isAddress(input)) return input;
    if (!isResolvableName(input)) return null;
    try {
      return await resolveNameToAddress(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/429|too many/i.test(message)) {
        throw new Error(
          "RPC rate limited (429). Try switching your RPC URL in Settings.",
        );
      }
      throw new Error(
        "Failed to resolve name. Check your RPC URL in Settings.",
      );
    }
  };

  useEffect(() => {
    if (!privateKey) {
      setDerivedAddress(null);
      return;
    }
    const result = validateAndDeriveAddress(privateKey);
    if (result.valid && result.address) {
      setDerivedAddress(result.address);
      setErrors((previous) => ({ ...previous, privateKey: undefined }));
    } else {
      setDerivedAddress(null);
      if (privateKey.length > 10) {
        setErrors((previous) => ({ ...previous, privateKey: result.error }));
      }
    }
  }, [privateKey]);

  const validatePassword = (): boolean => {
    const nextErrors: OnboardingErrors = {};
    const passwordError = newPasswordPolicyError(password, "Password");
    if (passwordError) nextErrors.password = passwordError;
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateBankrSetup = async (): Promise<boolean> => {
    const nextErrors: OnboardingErrors = {};
    if (!apiKey.trim()) nextErrors.apiKey = "API key is required";
    if (!walletAddress.trim()) {
      nextErrors.walletAddress = "Wallet address is required";
    } else {
      setIsResolvingAddress(true);
      try {
        if (!(await resolveAddress(walletAddress.trim()))) {
          nextErrors.walletAddress = "Invalid address or name";
        }
      } catch (error) {
        nextErrors.walletAddress =
          error instanceof Error ? error.message : "Failed to resolve name";
      } finally {
        setIsResolvingAddress(false);
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateViewOnlySetup = async (): Promise<boolean> => {
    const nextErrors: OnboardingErrors = {};
    if (!viewOnlyAddress.trim()) {
      nextErrors.viewOnlyAddress = "Address or name is required";
    } else {
      setIsResolvingAddress(true);
      try {
        if (!(await resolveAddress(viewOnlyAddress.trim()))) {
          nextErrors.viewOnlyAddress = "Invalid address or name";
        }
      } catch (error) {
        nextErrors.viewOnlyAddress =
          error instanceof Error ? error.message : "Failed to resolve name";
      } finally {
        setIsResolvingAddress(false);
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  async function handleContinue() {
    switch (step) {
      case "bankrSetup":
        if (await validateBankrSetup()) setStep("password");
        break;
      case "privateKey": {
        const result = validateAndDeriveAddress(privateKey);
        if (!result.valid) {
          setErrors({ privateKey: result.error || "Invalid private key" });
        } else setStep("password");
        break;
      }
      case "viewOnly":
        if (await validateViewOnlySetup()) setStep("password");
        break;
      case "password":
        if (validatePassword()) await handleSubmit();
        break;
    }
  }

  const handleCreateNew = () => {
    setCreateNewWallet(true);
    setAccountTypeChoice("seedPhrase");
    setErrors({});
    setStep("password");
  };
  const handleChooseExisting = (choice: AccountTypeChoice) => {
    setCreateNewWallet(false);
    setAccountTypeChoice(choice);
    setErrors({});
    setStep(ACCOUNT_SETUP_STEPS[choice]);
  };
  const clearCollectedSecrets = () => {
    setPrivateKey(""); setDerivedAddress(null); setCollectedMnemonic("");
    setCollectedSeedIndices([0]); setSeedGroupName(""); setSeedAccountDisplayName("");
    setApiKey(""); setLedgerSelection(null); setSafeSelection(null); setPassword(""); setConfirmPassword("");
  };
  const handleBack = () => {
    if (submittingRef.current) return;
    setErrors({}); setPassword(""); setConfirmPassword("");
    if (step === "password" && !createNewWallet) {
      setStep(ACCOUNT_SETUP_STEPS[accountTypeChoice]);
    } else {
      clearCollectedSecrets();
      setStep(step === "accountType" || createNewWallet ? "welcome" : "accountType");
    }
  };
  const handleProgressStepClick = (targetStep: number) => {
    if (submittingRef.current) return;
    if (targetStep === 0) {
      clearCollectedSecrets(); setErrors({});
      setStep(createNewWallet ? "welcome" : "accountType");
    } else if (targetStep === 1 && step === "password") handleBack();
  };

  async function handleSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await submitOnboardingAccount({
        createNewWallet,
        initializationOwnerId: onboardingOwnerIdRef.current,
        accountType: accountTypeChoice,
        password,
        apiKey,
        walletAddress,
        bankrDisplayName,
        privateKey,
        privateKeyDisplayName: pkDisplayName,
        viewOnlyAddress,
        viewOnlyDisplayName,
        mnemonic: collectedMnemonic,
        seedIndices: collectedSeedIndices,
        seedGroupName,
        seedAccountDisplayName,
        ledgerSelection,
        safeSelection,
        resolveAddress,
      });
      setApiKey("");
      setPrivateKey("");
      setViewOnlyAddress("");
      setLedgerSelection(null);
      setPassword("");
      setConfirmPassword("");
      setCollectedMnemonic("");
      setCollectedSeedIndices([0]);
      setStep("success");
    } catch (error) {
      setErrors({
        password:
          error instanceof Error
            ? error.message
            : "Failed to save configuration",
      });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return {
    step, setStep, createNewWallet, handleCreateNew, handleChooseExisting, isCheckingSetup, accountTypeChoice, setAccountTypeChoice,
    apiKey, setApiKey, showApiKey, setShowApiKey, privateKey, setPrivateKey,
    derivedAddress, pkDisplayName, setPkDisplayName, walletAddress,
    setWalletAddress, bankrDisplayName, setBankrDisplayName, password,
    viewOnlyAddress, setViewOnlyAddress, viewOnlyDisplayName,
    setViewOnlyDisplayName,
    setPassword, confirmPassword, setConfirmPassword, showPassword,
    setShowPassword, isSubmitting, isResolvingAddress, setCollectedMnemonic,
    setCollectedSeedIndices, setSeedGroupName, setSeedAccountDisplayName,
    ledgerSelection, setLedgerSelection, safeSelection, setSafeSelection,
    errors, setErrors, handleContinue, handleBack, handleProgressStepClick,
    setupRecoveryError,
  };
}
