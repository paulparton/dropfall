#include "DropfallArenaLayout.h"

#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

FDropfallMapDefinition FDropfallMapDefinition::Get(const int32 Index)
{
    FDropfallMapDefinition Map;
    using K = EDropfallObstacle;
    switch (FMath::Clamp(Index, 0, Count - 1))
    {
    case 0:
        Map.Id = TEXT("Foundry_v1"); Map.Name = TEXT("FOUNDRY"); Map.Grid = FIntPoint(4, 4);
        Map.Description = TEXT("16 x 16m / pillars, angled cover, two jump ramps");
        Map.Obstacles = {
            {K::Pillar, {0, 0, 100}, {180, 180, 200}},
            {K::Pillar, {420, 440, 80}, {150, 150, 160}},
            {K::Pillar, {-420, -440, 80}, {150, 150, 160}},
            {K::Block, {-360, 340, 60}, {260, 90, 120}, 35},
            {K::Block, {360, -340, 60}, {260, 90, 120}, 35},
            {K::Ramp, {-420, 60, 0}, {420, 240, 36}, 90},
            {K::Ramp, {420, -60, 0}, {420, 240, 36}, -90}
        };
        break;
    case 1:
        Map.Id = TEXT("Crosswind_v1"); Map.Name = TEXT("CROSSWIND"); Map.Grid = FIntPoint(6, 4);
        Map.Description = TEXT("24 x 16m / long lanes, staggered cover, four ramps");
        Map.Obstacles = {
            {K::Block, {0, 0, 65}, {110, 420, 130}, 25},
            {K::Pillar, {-650, 380, 120}, {180, 180, 240}},
            {K::Pillar, {650, -380, 120}, {180, 180, 240}},
            {K::Block, {-100, -540, 60}, {380, 90, 120}, -25},
            {K::Block, {100, 540, 60}, {380, 90, 120}, -25},
            {K::Ramp, {-680, -350, 0}, {500, 280, 36}, 0},
            {K::Ramp, {680, 350, 0}, {500, 280, 36}, 180},
            {K::Ramp, {-350, 220, 0}, {420, 240, 36}, -90},
            {K::Ramp, {350, -220, 0}, {420, 240, 36}, 90}
        };
        break;
    default:
        Map.Id = TEXT("Skyway_v1"); Map.Name = TEXT("SKYWAY"); Map.Grid = FIntPoint(8, 6);
        Map.Description = TEXT("32 x 24m / wide run-ups, six ramps, obstacle islands");
        Map.Obstacles = {
            {K::Pillar, {0, 0, 110}, {210, 210, 220}},
            {K::Pillar, {-650, 650, 150}, {220, 220, 300}},
            {K::Pillar, {650, -650, 150}, {220, 220, 300}},
            {K::Pillar, {-1050, -750, 80}, {180, 180, 160}},
            {K::Pillar, {1050, 750, 80}, {180, 180, 160}},
            {K::Block, {0, 760, 65}, {500, 100, 130}, 25},
            {K::Block, {0, -760, 65}, {500, 100, 130}, 25},
            {K::Block, {-700, 0, 65}, {360, 90, 130}, 70},
            {K::Block, {700, 0, 65}, {360, 90, 130}, 70},
            {K::Ramp, {-1120, 400, 0}, {600, 320, 40}, 0},
            {K::Ramp, {1120, -400, 0}, {600, 320, 40}, 180},
            {K::Ramp, {-400, -500, 0}, {520, 300, 40}, 90},
            {K::Ramp, {400, 500, 0}, {520, 300, 40}, -90},
            {K::Ramp, {-500, 980, 0}, {500, 260, 36}, 0},
            {K::Ramp, {500, -980, 0}, {500, 260, 36}, 180}
        };
        break;
    }
    return Map;
}

int32 FDropfallMapDefinition::RingAt(const FVector2D Position) const
{
    const FVector2D Cell = (Position + HalfSize()) / TileSize;
    const int32 X = FMath::Clamp(FMath::FloorToInt(Cell.X), 0, Grid.X - 1);
    const int32 Y = FMath::Clamp(FMath::FloorToInt(Cell.Y), 0, Grid.Y - 1);
    return FMath::Min(FMath::Min(X, Grid.X - 1 - X), FMath::Min(Y, Grid.Y - 1 - Y));
}

float FDropfallMapDefinition::DropTime(const FVector2D Position, const FVector2D HalfExtent) const
{
    int32 Ring = RingAt(Position);
    for (int32 X : {-1, 1}) for (int32 Y : {-1, 1})
        Ring = FMath::Min(Ring, RingAt(Position + FVector2D(HalfExtent.X * X, HalfExtent.Y * Y)));
    return FirstDrop + Ring * DropInterval;
}

FVector2D FDropfallMapDefinition::SafeHalfSize(const float Seconds, const bool bFallAway) const
{
    // Steer bots off the warning band before it vanishes.
    const int32 Lost = bFallAway && Seconds >= FirstDrop - WarningSeconds
        ? 1 + FMath::FloorToInt((Seconds - FirstDrop + WarningSeconds) / DropInterval) : 0;
    const FVector2D Size = HalfSize() - FVector2D(Lost * TileSize);
    return FVector2D(FMath::Max(80.0, Size.X), FMath::Max(80.0, Size.Y));
}

float FDropfallMapDefinition::NextDrop(const float Seconds) const
{
    const int32 LastRing = FMath::Min(Grid.X, Grid.Y) / 2 - 1;
    const int32 NextRing = Seconds < FirstDrop ? 0 : 1 + FMath::FloorToInt((Seconds - FirstDrop) / DropInterval);
    return NextRing > LastRing ? 0 : FirstDrop + NextRing * DropInterval - Seconds;
}

FTransform FDropfallMapDefinition::RampTransform(const FDropfallObstacleSpec& Ramp)
{
    const float Angle = FMath::DegreesToRadians(RampPitch);
    FVector Position = Ramp.Position;
    // The low TOP edge is flush with the floor; there is no entry step.
    Position.Z = Ramp.Size.X * 0.5f * FMath::Sin(Angle) - Ramp.Size.Z * 0.5f * FMath::Cos(Angle);
    return FTransform(FRotator(RampPitch, Ramp.Yaw, 0), Position, Ramp.Size / 100);
}

ADropfallArenaLayout::ADropfallArenaLayout()
{
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("LayoutRoot"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    static ConstructorHelpers::FObjectFinder<UMaterialInterface> MaterialAsset(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
    Cube = CubeAsset.Object; Cylinder = CylinderAsset.Object; Material = MaterialAsset.Object;
}

UStaticMeshComponent* ADropfallArenaLayout::AddPiece(UStaticMesh* Shape, const FTransform& Transform,
    const FLinearColor Color, const float DropAt, const bool bCollision, const FName Tag)
{
    UStaticMeshComponent* Mesh = NewObject<UStaticMeshComponent>(this);
    Mesh->SetupAttachment(RootComponent);
    Mesh->SetMobility(EComponentMobility::Movable);
    Mesh->SetStaticMesh(Shape);
    Mesh->SetRelativeTransform(Transform);
    Mesh->SetCollisionProfileName(bCollision ? TEXT("BlockAll") : TEXT("NoCollision"));
    Mesh->ComponentTags.Add(Tag);
    AddInstanceComponent(Mesh);
    Mesh->RegisterComponent();
    UMaterialInstanceDynamic* Tint = UMaterialInstanceDynamic::Create(Material, Mesh);
    Tint->SetVectorParameterValue(TEXT("Color"), Color);
    Mesh->SetMaterial(0, Tint);
    FDropfallArenaPiece& Piece = Pieces.AddDefaulted_GetRef();
    Piece.Mesh = Mesh; Piece.Home = Transform.GetLocation(); Piece.Color = Color;
    Piece.DropAt = DropAt; Piece.bCollision = bCollision;
    return Mesh;
}

void ADropfallArenaLayout::Build(const FDropfallMapDefinition& Map)
{
    for (FDropfallArenaPiece& Piece : Pieces) if (Piece.Mesh)
    {
        RemoveInstanceComponent(Piece.Mesh);
        Piece.Mesh->DestroyComponent();
    }
    Pieces.Reset();
    const FVector2D Half = Map.HalfSize();
    for (int32 X = 0; X < Map.Grid.X; ++X) for (int32 Y = 0; Y < Map.Grid.Y; ++Y)
    {
        const FVector Position((X + 0.5f) * Map.TileSize - Half.X, (Y + 0.5f) * Map.TileSize - Half.Y, -20);
        const float DropAt = Map.DropTime(FVector2D(Position));
        const FLinearColor TileColor = (X + Y) % 2 ? FLinearColor(0.055f, 0.11f, 0.17f) : FLinearColor(0.035f, 0.075f, 0.12f);
        AddPiece(Cube, FTransform(FRotator::ZeroRotator, Position, FVector(4, 4, 0.4f)), TileColor, DropAt, true, TEXT("ArenaFloor"));
        // Thin surface seams are visual only, so rolling never catches a gap.
        AddPiece(Cube, FTransform(FRotator::ZeroRotator, Position + FVector(-199, 0, 21), FVector(0.018f, 4, 0.015f)),
            FLinearColor(0.1f, 0.35f, 0.45f), DropAt, false, TEXT("Trim"));
        AddPiece(Cube, FTransform(FRotator::ZeroRotator, Position + FVector(0, -199, 21), FVector(4, 0.018f, 0.015f)),
            FLinearColor(0.1f, 0.35f, 0.45f), DropAt, false, TEXT("Trim"));
    }
    for (const FDropfallObstacleSpec& Spec : Map.Obstacles)
    {
        const bool bRamp = Spec.Kind == EDropfallObstacle::Ramp;
        const FTransform Transform = bRamp ? Map.RampTransform(Spec)
            : FTransform(FRotator(0, Spec.Yaw, 0), Spec.Position, Spec.Size / 100);
        const FBox Bounds = FBox(FVector(-50), FVector(50)).TransformBy(Transform.ToMatrixWithScale());
        const float DropAt = Map.DropTime(FVector2D(Transform.GetLocation()), FVector2D(Bounds.GetExtent()));
        AddPiece(Spec.Kind == EDropfallObstacle::Pillar ? Cylinder.Get() : Cube.Get(), Transform,
            bRamp ? FLinearColor(0.04f, 0.65f, 0.43f) : Spec.Kind == EDropfallObstacle::Pillar
                ? FLinearColor(0.95f, 0.43f, 0.07f) : FLinearColor(0.15f, 0.5f, 0.85f),
            DropAt, true, bRamp ? TEXT("Ramp") : TEXT("ArenaObstacle"));
        if (bRamp)
        {
            const FVector Lip = Transform.TransformPosition(FVector(46, 0, 52));
            AddPiece(Cube, FTransform(Transform.GetRotation(), Lip, FVector(0.2f, Spec.Size.Y / 100, 0.035f)),
                FLinearColor(1, 0.8f, 0.15f), DropAt, false, TEXT("RampLip"));
        }
    }
    SetRoundTime(0, false);
}

void ADropfallArenaLayout::SetRoundTime(const float Seconds, const bool bFallAway)
{
    for (FDropfallArenaPiece& Piece : Pieces)
    {
        const float Age = bFallAway ? Seconds - Piece.DropAt : -100;
        const bool bDropped = Age >= 0;
        if (Piece.bDropped != bDropped)
        {
            Piece.Mesh->SetCollisionEnabled(!bDropped && Piece.bCollision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
            Piece.bDropped = bDropped;
        }
        Piece.Mesh->SetRelativeLocation(Piece.Home - FVector(0, 0, bDropped ? FMath::Min(5000.0f, 490 * Age * Age) : 0));
        Piece.Mesh->SetVisibility(Age < 3);
        const bool bWarning = bFallAway && Age >= -FDropfallMapDefinition::WarningSeconds && !bDropped;
        if (UMaterialInstanceDynamic* Tint = Cast<UMaterialInstanceDynamic>(Piece.Mesh->GetMaterial(0)))
        {
            Tint->SetVectorParameterValue(TEXT("Color"), bWarning
                ? FMath::Lerp(Piece.Color, FLinearColor(1, 0.06f, 0.025f), 0.6f + 0.3f * FMath::Sin(Seconds * 9))
                : Piece.Color);
        }
    }
}

int32 ADropfallArenaLayout::GetSolidFloorCount() const
{
    int32 Count = 0;
    for (const FDropfallArenaPiece& Piece : Pieces)
        if (Piece.Mesh->ComponentHasTag(TEXT("ArenaFloor")) && !Piece.bDropped) ++Count;
    return Count;
}
