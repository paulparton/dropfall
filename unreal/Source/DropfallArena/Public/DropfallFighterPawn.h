#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "DropfallFighterPawn.generated.h"

class UStaticMeshComponent;

UCLASS()
class DROPFALLARENA_API ADropfallFighterPawn : public APawn
{
    GENERATED_BODY()

public:
    ADropfallFighterPawn();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    void SetMoveIntent(const FVector2D& Intent);
    void TryBoost();
    void ResetFighter(const FVector& SpawnLocation);
    void SetFighterColor(const FLinearColor& Color);

private:
    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UStaticMeshComponent> Body;

    FVector2D MoveIntent = FVector2D::ZeroVector;
    FVector LastMoveDirection = FVector::ForwardVector;
    float BoostCooldownRemaining = 0.0f;

    static constexpr float MoveAcceleration = 900.0f;
    static constexpr float MaxPlanarSpeed = 780.0f;
    static constexpr float BoostMaxPlanarSpeed = 1280.0f;
    static constexpr float BoostImpulse = 850.0f;
    static constexpr float BoostCooldown = 1.15f;
};
