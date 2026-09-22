#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "DropfallArenaHUD.generated.h"

UCLASS()
class DROPFALLARENA_API ADropfallArenaHUD : public AHUD
{
    GENERATED_BODY()

public:
    ADropfallArenaHUD();
    virtual void DrawHUD() override;
    virtual void NotifyHitBoxClick(FName BoxName) override;
    void QueueMenuClick(FVector2D Position) { PendingMenuClick = Position; }

private:
    UPROPERTY()
    TObjectPtr<UFont> MenuFont;
    TOptional<FVector2D> PendingMenuClick;
};
