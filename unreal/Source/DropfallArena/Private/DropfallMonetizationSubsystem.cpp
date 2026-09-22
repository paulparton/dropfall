#include "DropfallMonetizationSubsystem.h"

bool UDropfallMonetizationSubsystem::CanShowAd(const EDropfallAdContext Context) const
{
    return IsAdPlacementAllowed(bPaidEntitlement, Context);
}

bool UDropfallMonetizationSubsystem::IsAdPlacementAllowed(
    const bool bHasPaidEntitlement, const EDropfallAdContext Context)
{
    return !bHasPaidEntitlement && Context != EDropfallAdContext::ActiveMatch;
}
