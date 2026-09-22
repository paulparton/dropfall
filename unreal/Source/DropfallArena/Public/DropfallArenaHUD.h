#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "DropfallArenaHUD.generated.h"

UCLASS()
class DROPFALLARENA_API ADropfallArenaHUD : public AHUD
{
    GENERATED_BODY()

public:
    virtual void DrawHUD() override;
};
