#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "DropfallArenaLayout.generated.h"

class UStaticMesh;
class UStaticMeshComponent;
class UMaterialInterface;

enum class EDropfallObstacle : uint8 { Block, Pillar, Ramp, Deck, LaunchPad };
enum class EDropfallLayer : uint8 { Core, Middle, Outer };

struct FDropfallObstacleSpec
{
    EDropfallObstacle Kind;
    FVector Position;
    FVector Size;
    float Yaw = 0;
    EDropfallLayer Layer = EDropfallLayer::Core;
    float Pitch = 20;
};

/** Authored in centimetres; deterministic geometry shared by both terrain rules. */
struct FDropfallMapDefinition
{
    FName Id;
    FString Name;
    FString Description;
    FIntPoint Grid;
    TArray<FDropfallObstacleSpec> Obstacles;
    int32 Theme = 0;
    FLinearColor FloorColor, AccentColor, StructureColor;
    static constexpr float TileSize = 400;
    static constexpr float FirstDrop = 30;
    static constexpr float DropInterval = 20;
    static constexpr float WarningSeconds = 4;
    static constexpr float RampPitch = 20;

    static FDropfallMapDefinition Get(int32 Index);
    static constexpr int32 Count = 3;
    FVector2D HalfSize() const { return FVector2D(Grid.X, Grid.Y) * TileSize * 0.5f; }
    FVector Spawn(bool bCyan) const { return FVector(bCyan ? 650 : -650, -650, 110); }
    EDropfallLayer LayerAt(FVector2D Position) const;
    static float LayerDropTime(EDropfallLayer Layer);
    float DropTime(FVector2D Position, FVector2D HalfExtent = FVector2D::ZeroVector) const;
    FVector2D SafeHalfSize(float Seconds, bool bFallAway) const;
    float NextDrop(float Seconds) const;
    static FTransform RampTransform(const FDropfallObstacleSpec& Ramp);
    FVector RouteToElevation(FVector From, FVector Target, float Seconds, bool bFallAway) const;
};

USTRUCT()
struct FDropfallArenaPiece
{
    GENERATED_BODY()
    UPROPERTY() TObjectPtr<UStaticMeshComponent> Mesh;
    FVector Home;
    FLinearColor Color;
    float DropAt = 0;
    bool bCollision = true;
    bool bDropped = false;
};

UCLASS()
class DROPFALLARENA_API ADropfallArenaLayout : public AActor
{
    GENERATED_BODY()
public:
    ADropfallArenaLayout();
    void Build(const FDropfallMapDefinition& Map);
    void SetRoundTime(float Seconds, bool bFallAway);
    int32 GetSolidFloorCount() const;
    bool TryLaunch(class ADropfallFighterPawn* Fighter);

private:
    UStaticMeshComponent* AddPiece(UStaticMesh* Shape, const FTransform& Transform,
        FLinearColor Color, float DropAt, bool bCollision, FName Tag);
    UPROPERTY() TObjectPtr<UStaticMesh> Cube;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    UPROPERTY() TObjectPtr<UMaterialInterface> Material;
    UPROPERTY() TArray<FDropfallArenaPiece> Pieces;
    FDropfallMapDefinition Definition;
    float RoundSeconds = 0;
    bool bFalling = false;
};
