#include "DropfallPlayerController.h"

#include "DropfallArenaGameMode.h"
#include "DropfallArenaHUD.h"
#include "InputKeyEventArgs.h"
#include "Kismet/GameplayStatics.h"

bool ADropfallPlayerController::InputKey(const FInputKeyEventArgs& Params)
{
    const bool bHandled = Super::InputKey(Params);
    if (Params.Key == EKeys::LeftMouseButton
        && (Params.Event == IE_Pressed || Params.Event == IE_DoubleClick)
        && this == UGameplayStatics::GetPlayerController(this, 0))
    {
        const ADropfallArenaGameMode* Game = GetWorld()->GetAuthGameMode<ADropfallArenaGameMode>();
        float X = 0.0f, Y = 0.0f;
        if (Game && (Game->GetMatchPhase() == EDropfallMatchPhase::Ready
            || Game->GetMatchPhase() == EDropfallMatchPhase::MatchOver) && GetMousePosition(X, Y))
        {
            if (ADropfallArenaHUD* HUD = Cast<ADropfallArenaHUD>(GetHUD()))
            {
                // Queue the input edge before HUD draw. Menu input must release
                // high-precision capture so these are real viewport coordinates.
                UE_LOG(LogTemp, Verbose, TEXT("Arena menu click: %.1f, %.1f"), X, Y);
                HUD->QueueMenuClick(FVector2D(X, Y));
                return true;
            }
        }
    }
    return bHandled;
}
