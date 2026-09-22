#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "DropfallFighterPawn.generated.h"

class UStaticMeshComponent;
class UPrimitiveComponent;

USTRUCT(BlueprintType)
struct FDropfallFighterTuning
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float MoveAcceleration = 980.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float MaxPlanarSpeed = 800.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float BoostMaxPlanarSpeed = 1320.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float BoostImpulse = 875.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float BoostCooldown = 1.15f;
};

UCLASS()
class DROPFALLARENA_API ADropfallFighterPawn : public APawn
{
    GENERATED_BODY()

public:
    ADropfallFighterPawn();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    void SetMoveIntent(const FVector2D& Intent);
    bool TryBoost();
    void ResetFighter(const FVector& SpawnLocation);
    void SetFighterColor(const FLinearColor& Color);

    float GetBoostReadiness() const;
    float GetPlanarSpeed() const;
    bool IsBoostActive() const;
    const FDropfallFighterTuning& GetTuning() const { return Tuning; }

private:
    UFUNCTION()
    void HandleBodyHit(UPrimitiveComponent* HitComponent, AActor* OtherActor,
        UPrimitiveComponent* OtherComponent, FVector NormalImpulse, const FHitResult& Hit);

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UStaticMeshComponent> Body;

    UPROPERTY(EditAnywhere, Category = "Dropfall|Combat")
    FDropfallFighterTuning Tuning;

    FVector2D MoveIntent = FVector2D::ZeroVector;
    FVector LastMoveDirection = FVector::ForwardVector;
    float BoostCooldownRemaining = 0.0f;
    float ImpactLockoutRemaining = 0.0f;

    static constexpr float BoostSpeedWindow = 0.32f;
    static constexpr float MinimumImpactSpeed = 220.0f;
    static constexpr float ImpactVelocityScale = 0.42f;
    static constexpr float MinimumImpactImpulse = 90.0f;
    static constexpr float MaximumImpactImpulse = 520.0f;
    static constexpr float ImpactLockout = 0.12f;
};
