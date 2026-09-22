#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "DropfallPlayerController.generated.h"

UCLASS()
class DROPFALLARENA_API ADropfallPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    virtual bool InputKey(const FInputKeyEventArgs& Params) override;
};
