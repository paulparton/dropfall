#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "DropfallMonetizationSubsystem.generated.h"

UENUM(BlueprintType)
enum class EDropfallAdContext : uint8
{
    FrontEnd,
    PostMatch,
    ActiveMatch
};

UCLASS()
class DROPFALLARENA_API UDropfallMonetizationSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintPure, Category = "Dropfall|Monetization")
    bool CanShowAd(EDropfallAdContext Context) const;

    UFUNCTION(BlueprintCallable, Category = "Dropfall|Monetization")
    void SetPaidEntitlement(bool bInPaidEntitlement) { bPaidEntitlement = bInPaidEntitlement; }

    UFUNCTION(BlueprintPure, Category = "Dropfall|Monetization")
    bool HasPaidEntitlement() const { return bPaidEntitlement; }

    static bool IsAdPlacementAllowed(bool bHasPaidEntitlement, EDropfallAdContext Context);

private:
    bool bPaidEntitlement = false;
};
