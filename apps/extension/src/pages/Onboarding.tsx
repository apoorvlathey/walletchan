import { SafeOnboardingStep } from "./onboarding/SafeOnboardingStep";
import { WelcomeStep } from "./onboarding/WelcomeStep";
import { AccountTypeStep } from "./onboarding/AccountTypeStep";
import { BankrSetupStep } from "./onboarding/BankrSetupStep";
import {
  OnboardingLoading,
  OnboardingRecoveryError,
  SuccessStep,
} from "./onboarding/OnboardingIntroSteps";
import { PasswordStep } from "./onboarding/PasswordStep";
import { PrivateKeySetupStep } from "./onboarding/PrivateKeySetupStep";
import { LedgerOnboardingStep } from "./onboarding/LedgerOnboardingStep";
import { SeedPhraseOnboardingStep } from "./onboarding/SeedPhraseOnboardingStep";
import { useOnboardingController } from "./onboarding/useOnboardingController";
import { ViewOnlySetupStep } from "./onboarding/ViewOnlySetupStep";
import { LayoutGroup } from "framer-motion";
import { useId, type ComponentType, type PropsWithChildren } from "react";

// Match the React 18 renderer at the Framer/React 19 declaration boundary.
const OnboardingLayoutGroup = LayoutGroup as unknown as ComponentType<PropsWithChildren<{ id: string }>>;

function Onboarding() {
  const {
    step,
    setStep,
    isCheckingSetup,
    createNewWallet,
    handleCreateNew,
    handleChooseExisting,
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
    privateKey,
    setPrivateKey,
    derivedAddress,
    pkDisplayName,
    setPkDisplayName,
    walletAddress,
    setWalletAddress,
    bankrDisplayName,
    setBankrDisplayName,
    viewOnlyAddress,
    setViewOnlyAddress,
    viewOnlyDisplayName,
    setViewOnlyDisplayName,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    isSubmitting,
    isResolvingAddress,
    setCollectedMnemonic,
    setCollectedSeedIndices,
    setSeedGroupName,
    setSeedAccountDisplayName,
    setLedgerSelection, safeSelection, setSafeSelection,
    errors,
    setErrors,
    handleContinue,
    handleBack,
    handleProgressStepClick,
    setupRecoveryError,
  } = useOnboardingController();

  if (isCheckingSetup) return <OnboardingLoading />;
  if (setupRecoveryError) {
    return <OnboardingRecoveryError message={setupRecoveryError} />;
  }
  if (step === "success") return <SuccessStep />;

  if (step === "welcome") return <WelcomeStep onCreate={handleCreateNew} onImport={() => setStep("accountType")} />;
  if (step === "accountType") return <AccountTypeStep onChoose={handleChooseExisting} onBack={handleBack} />;

  if (step === "bankrSetup") {
    return (
      <BankrSetupStep
        apiKey={apiKey}
        showApiKey={showApiKey}
        walletAddress={walletAddress}
        displayName={bankrDisplayName}
        errors={errors}
        isResolvingAddress={isResolvingAddress}
        onApiKeyChange={(value) => {
          setApiKey(value);
          if (errors.apiKey) {
            setErrors((previous) => ({ ...previous, apiKey: undefined }));
          }
        }}
        onToggleApiKey={() => setShowApiKey((visible) => !visible)}
        onWalletAddressChange={(value) => {
          setWalletAddress(value);
          if (errors.walletAddress) {
            setErrors((previous) => ({
              ...previous,
              walletAddress: undefined,
            }));
          }
        }}
        onDisplayNameChange={setBankrDisplayName}
        onBack={handleBack}
        onProgressStepClick={handleProgressStepClick}
        onContinue={handleContinue}
      />
    );
  }

  if (step === "viewOnly") {
    return (
      <ViewOnlySetupStep
        address={viewOnlyAddress}
        displayName={viewOnlyDisplayName}
        error={errors.viewOnlyAddress}
        isResolvingAddress={isResolvingAddress}
        onAddressChange={(value) => {
          setViewOnlyAddress(value);
          if (errors.viewOnlyAddress) {
            setErrors((previous) => ({
              ...previous,
              viewOnlyAddress: undefined,
            }));
          }
        }}
        onDisplayNameChange={setViewOnlyDisplayName}
        onBack={handleBack}
        onProgressStepClick={handleProgressStepClick}
        onContinue={handleContinue}
      />
    );
  }

  if (step === "safe") return <SafeOnboardingStep selection={safeSelection} onBack={handleBack} onProgressStepClick={handleProgressStepClick} onCollect={(selection) => { setSafeSelection(selection); setStep("password"); }} />;

  if (step === "ledger") {
    return (
      <LedgerOnboardingStep
        onBack={handleBack}
        onProgressStepClick={handleProgressStepClick}
        onCollect={async (selection) => {
          setLedgerSelection(selection);
          setStep("password");
        }}
      />
    );
  }

  if (step === "privateKey") {
    return (
      <PrivateKeySetupStep
        privateKey={privateKey}
        derivedAddress={derivedAddress}
        displayName={pkDisplayName}
        error={errors.privateKey}
        onPrivateKeyChange={setPrivateKey}
        onDisplayNameChange={setPkDisplayName}
        onClearError={() => setErrors({})}
        onBack={handleBack}
        onProgressStepClick={handleProgressStepClick}
        onContinue={handleContinue}
      />
    );
  }

  if (step === "seedPhrase") {
    return (
      <SeedPhraseOnboardingStep
        onBack={handleBack}
        onProgressStepClick={handleProgressStepClick}
        onCollect={(mnemonic, indices, groupName, accountDisplayName) => {
          setCollectedMnemonic(mnemonic);
          setCollectedSeedIndices(indices.length > 0 ? indices : [0]);
          setSeedGroupName(groupName || "");
          setSeedAccountDisplayName(accountDisplayName || "");
          setStep("password");
        }}
      />
    );
  }

  return (
    <PasswordStep
      createNewWallet={createNewWallet}
      password={password}
      confirmPassword={confirmPassword}
      showPassword={showPassword}
      errors={errors}
      isSubmitting={isSubmitting}
      onPasswordChange={(value) => {
        setPassword(value);
        if (errors.password) setErrors({});
      }}
      onConfirmPasswordChange={(value) => {
        setConfirmPassword(value);
        if (errors.confirmPassword) setErrors({});
      }}
      onTogglePassword={() => setShowPassword((visible) => !visible)}
      onBack={handleBack}
      onProgressStepClick={handleProgressStepClick}
      onContinue={handleContinue}
    />
  );
}

export default function OnboardingPage() {
  const layoutId = useId();
  return <OnboardingLayoutGroup id={layoutId}><Onboarding /></OnboardingLayoutGroup>;
}
