#include "DropfallArenaLayout.h"
#include "DropfallFighterPawn.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
using K = EDropfallObstacle;
using L = EDropfallLayer;
FDropfallObstacleSpec Connector(FVector Start, FVector End, float Width, L Layer)
{
    const FVector Delta = End - Start;
    return {K::Ramp, Start, FVector(Delta.Size(), Width, 30), Delta.Rotation().Yaw, Layer, Delta.Rotation().Pitch};
}
}

FDropfallMapDefinition FDropfallMapDefinition::Get(const int32 Index)
{
    FDropfallMapDefinition Map;
    Map.Theme = FMath::Clamp(Index, 0, Count - 1);
    Map.Grid = Map.Theme == 0 ? FIntPoint(6, 6) : Map.Theme == 1 ? FIntPoint(8, 6) : FIntPoint(8, 8);
    const TCHAR* Names[] = {TEXT("FOUNDRY"), TEXT("CROSSWIND"), TEXT("SKYWAY")};
    Map.Name = Names[Map.Theme];
    Map.Id = FName(*FString::Printf(TEXT("%s_Layered_v2"), Names[Map.Theme]));
    Map.Description = Map.Theme == 0 ? TEXT("24 x 24m / molten steel / forge terraces")
        : Map.Theme == 1 ? TEXT("32 x 24m / skyport / turbine flight decks")
        : TEXT("32 x 32m / orbital neon / elevated causeways");
    Map.FloorColor = Map.Theme == 0 ? FLinearColor(.12f, .065f, .035f)
        : Map.Theme == 1 ? FLinearColor(.15f, .27f, .30f) : FLinearColor(.055f, .035f, .15f);
    Map.AccentColor = Map.Theme == 0 ? FLinearColor(1, .32f, .015f)
        : Map.Theme == 1 ? FLinearColor(.1f, 1, .7f) : FLinearColor(.65f, .15f, 1);
    Map.StructureColor = Map.Theme == 0 ? FLinearColor(.23f, .27f, .30f)
        : Map.Theme == 1 ? FLinearColor(.35f, .48f, .52f) : FLinearColor(.16f, .12f, .32f);

    // Build backwards from a complete final battleground, not an arbitrary leftover tile.
    const float CoreHeight = Map.Theme == 2 ? 220 : 180;
    Map.Obstacles = {
        {K::Deck, {0, 530, CoreHeight / 2}, {1040, 340, CoreHeight}, 0, L::Core},
        Connector({-320, -240, 0}, {-320, 360, CoreHeight}, 270, L::Core),
        Connector({320, -240, 0}, {320, 360, CoreHeight}, 270, L::Core),
        {K::Pillar, {0, 560, CoreHeight + 70}, {110, 110, 140}, 0, L::Core},
        {K::Block, {0, -400, 55}, {280, 90, 110}, Map.Theme == 1 ? 25.0f : 0.0f, L::Core},
        {K::LaunchPad, {-600, -420, 0}, {190, 190, 12}, 45, L::Core},
        {K::LaunchPad, {600, -420, 0}, {190, 190, 12}, 135, L::Core}
    };
    // Intermediate galleries and their access ramps share a collapse dependency.
    for (int32 Side : {-1, 1})
    {
        const float X = Side * 990.0f;
        const float Height = Map.Theme == 1 ? 280 : 240;
        Map.Obstacles.Add({K::Deck, {X, 250, Height / 2}, {340, 680, Height}, 0, L::Middle});
        Map.Obstacles.Add(Connector({X, -750, 0}, {X, -90, Height}, 300, L::Middle));
        Map.Obstacles.Add({K::Pillar, {X, 460, Height + 80}, {140, 140, 160}, 0, L::Middle});
        Map.Obstacles.Add({K::LaunchPad, {X, 80, Height}, {200, 200, 12}, Side > 0 ? 180.0f : 0.0f, L::Middle});
    }
    // Full starting arena: outer jump slopes, high flight decks and orbital causeways.
    for (int32 Side : {-1, 1})
    {
        Map.Obstacles.Add(Connector({Side * 650.0f, -1020, 0}, {Side * 1020.0f, -1020, 145}, 240, L::Outer));
        if (Map.Theme >= 1)
        {
            const float X = Side * 1380.0f;
            Map.Obstacles.Add({K::Deck, {X, 470, 180}, {340, 500, 360}, 0, L::Outer});
            Map.Obstacles.Add(Connector({X, -740, 0}, {X, 220, 360}, 300, L::Outer));
            Map.Obstacles.Add({K::LaunchPad, {X, 440, 360}, {200, 200, 12}, Side > 0 ? 180.0f : 0.0f, L::Outer});
        }
        if (Map.Theme == 2)
        {
            Map.Obstacles.Add({K::Deck, {Side * 650.0f, 1370, 210}, {620, 300, 420}, 0, L::Outer});
            Map.Obstacles.Add(Connector({Side * 650.0f, 100, 0}, {Side * 650.0f, 1220, 420}, 240, L::Outer));
            Map.Obstacles.Add({K::LaunchPad, {Side * 650.0f, 1360, 420}, {200, 200, 12}, -90, L::Outer});
        }
    }
    return Map;
}

EDropfallLayer FDropfallMapDefinition::LayerAt(FVector2D P) const
{
    if (FMath::Abs(P.X) < 800 && FMath::Abs(P.Y) < 800) return L::Core;
    if ((FMath::Abs(P.X) < 1200 && FMath::Abs(P.Y) < 800)
        || (FMath::Abs(P.X) < 800 && FMath::Abs(P.Y) < 1200)) return L::Middle;
    return L::Outer;
}

float FDropfallMapDefinition::LayerDropTime(L Layer)
{
    return Layer == L::Core ? -1 : Layer == L::Middle ? FirstDrop + DropInterval : FirstDrop;
}

float FDropfallMapDefinition::DropTime(FVector2D P, FVector2D HalfExtent) const
{
    L Layer = LayerAt(P);
    for (int32 X : {-1, 1}) for (int32 Y : {-1, 1})
        Layer = static_cast<L>(FMath::Max(static_cast<int32>(Layer),
            static_cast<int32>(LayerAt(P + FVector2D(HalfExtent.X * X, HalfExtent.Y * Y)))));
    return LayerDropTime(Layer);
}

FVector2D FDropfallMapDefinition::SafeHalfSize(float Seconds, bool bFallAway) const
{
    return bFallAway && Seconds >= FirstDrop - WarningSeconds ? FVector2D(800) : HalfSize();
}

float FDropfallMapDefinition::NextDrop(float Seconds) const
{
    return Seconds < FirstDrop ? FirstDrop - Seconds
        : Seconds < FirstDrop + DropInterval ? FirstDrop + DropInterval - Seconds : 0;
}

FTransform FDropfallMapDefinition::RampTransform(const FDropfallObstacleSpec& Ramp)
{
    const FRotator Rotation(Ramp.Pitch, Ramp.Yaw, 0);
    // Position is the low top edge; thickness extends below the slope, not above the entry.
    return FTransform(Rotation, Ramp.Position + Rotation.RotateVector(FVector(Ramp.Size.X / 2, 0, -Ramp.Size.Z / 2)), Ramp.Size / 100);
}

FVector FDropfallMapDefinition::RouteToElevation(FVector From, FVector Target, float Seconds, bool bFallAway) const
{
    if (Target.Z < From.Z + 95) return Target;
    float Best = TNumericLimits<float>::Max();
    FVector Waypoint = Target;
    for (const FDropfallObstacleSpec& Spec : Obstacles)
    {
        if (Spec.Kind != K::Ramp) continue;
        const float Drop = LayerDropTime(Spec.Layer);
        if (bFallAway && Drop >= 0 && Seconds >= Drop - WarningSeconds) continue;
        const FTransform T = RampTransform(Spec);
        const FVector End = T.TransformPosition(FVector(50, 0, 50));
        if (End.Z < Target.Z - 110) continue;
        const FVector Forward = T.GetRotation().GetForwardVector();
        const FVector Start = Spec.Position - FVector(Forward.X, Forward.Y, 0) * 100;
        const FVector Local = T.InverseTransformPosition(From);
        const bool bOnRamp = Local.X > -60 && Local.X < 65 && FMath::Abs(Local.Y) < 45;
        const float Cost = FVector::Dist2D(From, Start) + FVector::Dist2D(End, Target);
        if (Cost < Best) { Best = Cost; Waypoint = bOnRamp || FVector::Dist2D(From, Start) < 120 ? End : Start; }
    }
    return Waypoint;
}

ADropfallArenaLayout::ADropfallArenaLayout()
{
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("LayoutRoot"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    static ConstructorHelpers::FObjectFinder<UMaterialInterface> MaterialAsset(TEXT("/Game/Arena/Materials/M_ArenaSurface.M_ArenaSurface"));
    Cube = CubeAsset.Object; Cylinder = CylinderAsset.Object; Material = MaterialAsset.Object;
    if (!Material) Material = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
}

UStaticMeshComponent* ADropfallArenaLayout::AddPiece(UStaticMesh* Shape, const FTransform& T,
    FLinearColor Color, float DropAt, bool bCollision, FName Tag)
{
    UStaticMeshComponent* Mesh = NewObject<UStaticMeshComponent>(this);
    Mesh->SetupAttachment(RootComponent);
    Mesh->SetMobility(EComponentMobility::Movable);
    Mesh->SetStaticMesh(Shape);
    Mesh->SetRelativeTransform(T);
    Mesh->SetCollisionProfileName(bCollision ? TEXT("BlockAll") : TEXT("NoCollision"));
    Mesh->ComponentTags.Add(Tag);
    AddInstanceComponent(Mesh); Mesh->RegisterComponent();
    UMaterialInstanceDynamic* Tint = UMaterialInstanceDynamic::Create(Material, Mesh);
    Tint->SetVectorParameterValue(TEXT("Color"), Color);
    const bool bLight = Tag == TEXT("Trim") || Tag == TEXT("RampTrim") || Tag == TEXT("Chevron")
        || Tag == TEXT("PadLight") || Tag == TEXT("PadArrow") || Tag == TEXT("PillarBand")
        || Tag == TEXT("CoreBoundary") || Tag == TEXT("DeckEdge") || Tag == TEXT("Star");
    Tint->SetScalarParameterValue(TEXT("Glow"), bLight ? .7f : 0);
    Mesh->SetMaterial(0, Tint);
    FDropfallArenaPiece& Piece = Pieces.AddDefaulted_GetRef();
    Piece.Mesh = Mesh; Piece.Home = T.GetLocation(); Piece.Color = Color;
    Piece.DropAt = DropAt; Piece.bCollision = bCollision;
    return Mesh;
}

void ADropfallArenaLayout::Build(const FDropfallMapDefinition& Map)
{
    for (FDropfallArenaPiece& Piece : Pieces) if (Piece.Mesh)
    {
        RemoveInstanceComponent(Piece.Mesh); Piece.Mesh->DestroyComponent();
    }
    Pieces.Reset(); Definition = Map;
    const FVector2D Half = Map.HalfSize();
    for (L Layer : {L::Core, L::Middle, L::Outer})
    {
        for (int32 X = 0; X < Map.Grid.X; ++X) for (int32 Y = 0; Y < Map.Grid.Y; ++Y)
        {
            const FVector P((X + .5f) * Map.TileSize - Half.X, (Y + .5f) * Map.TileSize - Half.Y, -30);
            if (Map.LayerAt(FVector2D(P)) != Layer) continue;
            const float Drop = Map.LayerDropTime(Layer);
            AddPiece(Cube, FTransform(FRotator::ZeroRotator, P, FVector(4, 4, .6f)),
                Map.FloorColor * ((X + Y) % 2 ? 1.2f : 1), Drop, true, TEXT("ArenaFloor"));
            for (FVector Edge : {FVector(-197, 0, 31), FVector(0, -197, 31)})
                AddPiece(Cube, FTransform(FRotator::ZeroRotator, P + Edge,
                    Edge.X ? FVector(.035f, 4, .02f) : FVector(4, .035f, .02f)),
                    Map.AccentColor * .35f, Drop, false, TEXT("Trim"));
            if (X == 0 || Y == 0 || X == Map.Grid.X - 1 || Y == Map.Grid.Y - 1)
                AddPiece(Cube, FTransform(FRotator::ZeroRotator, P - FVector(0, 0, 70), FVector(3.75f, 3.75f, .8f)),
                    Map.StructureColor, Drop, false, TEXT("Support"));
        }
        for (const FDropfallObstacleSpec& S : Map.Obstacles)
        {
            if (S.Layer != Layer) continue;
            const float Drop = Map.LayerDropTime(S.Layer);
            const bool bRamp = S.Kind == K::Ramp, bPad = S.Kind == K::LaunchPad;
            FTransform T = bRamp ? Map.RampTransform(S) : FTransform(FRotator(0, S.Yaw, 0), S.Position, S.Size / 100);
            if (bPad) T.AddToTranslation(FVector(0, 0, -5));
            AddPiece(S.Kind == K::Pillar || bPad ? Cylinder.Get() : Cube.Get(), T,
                bPad ? FLinearColor(.035f, .04f, .08f) : bRamp ? Map.StructureColor * 1.4f : Map.StructureColor,
                Drop, !bPad, bRamp ? TEXT("Ramp") : bPad ? TEXT("LaunchPad") : S.Kind == K::Deck ? TEXT("Deck") : TEXT("ArenaObstacle"));
            if (bRamp)
            {
                for (int32 Side : {-1, 1})
                    AddPiece(Cube, FTransform(T.GetRotation(), T.TransformPosition(FVector(0, Side * 46, 52)),
                        FVector(S.Size.X / 100, .045f, .025f)), Map.AccentColor, Drop, false, TEXT("RampTrim"));
                for (float Along : {-28.0f, 0.0f, 28.0f}) for (int32 Side : {-1, 1})
                    AddPiece(Cube, FTransform(T.GetRotation() * FQuat(FVector::UpVector, FMath::DegreesToRadians(Side * 40.0f)),
                        T.TransformPosition(FVector(Along, Side * 10, 52)), FVector(.5f, .045f, .025f)),
                        Map.AccentColor, Drop, false, TEXT("Chevron"));
            }
            else if (bPad)
            {
                for (int32 Segment = 0; Segment < 12; ++Segment)
                {
                    const float A = Segment * PI / 6;
                    AddPiece(Cube, FTransform(FRotator(0, FMath::RadiansToDegrees(A) + 90, 0),
                        S.Position + FVector(FMath::Cos(A) * 82, FMath::Sin(A) * 82, 3), FVector(.32f, .09f, .035f)),
                        Map.AccentColor, Drop, false, TEXT("PadLight"));
                }
                for (int32 Side : {-1, 1})
                    AddPiece(Cube, FTransform(FRotator(0, S.Yaw + Side * 40, 0),
                        S.Position + FRotator(0, S.Yaw, 0).RotateVector(FVector(0, Side * 18, 4)), FVector(.7f, .1f, .025f)),
                        FLinearColor(1, .85f, .18f), Drop, false, TEXT("PadArrow"));
            }
            else
            {
                const float Top = S.Position.Z + S.Size.Z / 2;
                AddPiece(S.Kind == K::Pillar ? Cylinder.Get() : Cube.Get(),
                    FTransform(FRotator(0, S.Yaw, 0), FVector(S.Position.X, S.Position.Y, Top + 1), FVector(S.Size.X / 100, S.Size.Y / 100, .025f)),
                    S.Kind == K::Deck ? Map.FloorColor * 1.7f : Map.AccentColor, Drop, false, TEXT("TopInset"));
                if (S.Kind == K::Deck)
                    for (int32 Side : {-1, 1})
                        AddPiece(Cube, FTransform(FRotator::ZeroRotator, FVector(S.Position.X + Side * (S.Size.X / 2 - 5), S.Position.Y, Top + 3),
                            FVector(.07f, S.Size.Y / 100, .025f)), Map.AccentColor, Drop, false, TEXT("DeckEdge"));
                if (S.Kind == K::Pillar)
                    for (int32 Band = 0; Band < 3; ++Band)
                        AddPiece(Cylinder, FTransform(FRotator::ZeroRotator, S.Position + FVector(0, 0, (Band - 1) * S.Size.Z * .25f),
                            FVector(S.Size.X / 98, S.Size.Y / 98, .07f)), Map.AccentColor, Drop, false, TEXT("PillarBand"));
            }
        }
    }
    for (int32 Side : {-1, 1})
    {
        AddPiece(Cube, FTransform(FRotator::ZeroRotator, FVector(Side * 797, 0, 2), FVector(.06f, 16, .02f)), Map.AccentColor, -1, false, TEXT("CoreBoundary"));
        AddPiece(Cube, FTransform(FRotator::ZeroRotator, FVector(0, Side * 797, 2), FVector(16, .06f, .02f)), Map.AccentColor, -1, false, TEXT("CoreBoundary"));
    }
    // Non-colliding backdrops sit far below the ring-out plane. Crosswind keeps
    // the open sky; Foundry and Skyway have their own distant visual setting.
    if (Map.Theme != 1)
    {
        AddPiece(Cube, FTransform(FRotator::ZeroRotator, FVector(0, 0, -1600), FVector(600, 600, .1f)),
            Map.Theme == 0 ? FLinearColor(.009f, .004f, .002f) : FLinearColor(.003f, .004f, .013f), -1, false, TEXT("Backdrop"));
        if (Map.Theme == 2)
            for (int32 Star = 0; Star < 80; ++Star)
            {
                const float X = ((Star * 1171) % 17000) - 8500;
                const float Y = ((Star * 2377) % 15000) - 7500;
                AddPiece(Cylinder, FTransform(FRotator::ZeroRotator, FVector(X, Y, -1550), FVector(.1f + (Star % 3) * .06f, .1f + (Star % 3) * .06f, .02f)),
                    FLinearColor(.55f, .7f, 1), -1, false, TEXT("Star"));
            }
        else
            for (int32 Side : {-1, 1}) for (int32 Strip = 0; Strip < 5; ++Strip)
                AddPiece(Cube, FTransform(FRotator(0, 15, 0), FVector(Side * (2200 + Strip * 260), 0, -1300), FVector(.3f, 80, .05f)),
                    Map.AccentColor * .45f, -1, false, TEXT("Star"));
    }
    SetRoundTime(0, false);
}

void ADropfallArenaLayout::SetRoundTime(float Seconds, bool bFallAway)
{
    RoundSeconds = Seconds; bFalling = bFallAway;
    for (FDropfallArenaPiece& Piece : Pieces)
    {
        const float Age = bFallAway && Piece.DropAt >= 0 ? Seconds - Piece.DropAt : -100;
        const bool bDropped = Age >= 0;
        if (Piece.bDropped != bDropped)
        {
            Piece.Mesh->SetCollisionEnabled(!bDropped && Piece.bCollision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
            Piece.bDropped = bDropped;
        }
        Piece.Mesh->SetRelativeLocation(Piece.Home - FVector(0, 0, bDropped ? FMath::Min(5000.0f, 490 * Age * Age) : 0));
        Piece.Mesh->SetVisibility(Age < 3);
        const bool bWarning = bFallAway && Piece.DropAt >= 0 && Age >= -FDropfallMapDefinition::WarningSeconds && !bDropped;
        if (UMaterialInstanceDynamic* Tint = Cast<UMaterialInstanceDynamic>(Piece.Mesh->GetMaterial(0)))
            Tint->SetVectorParameterValue(TEXT("Color"), bWarning
                ? FMath::Lerp(Piece.Color, FLinearColor(1, .025f, .015f), .7f + .25f * FMath::Sin(Seconds * 9)) : Piece.Color);
    }
}

bool ADropfallArenaLayout::TryLaunch(ADropfallFighterPawn* Fighter)
{
    if (!Fighter) return false;
    for (const FDropfallObstacleSpec& Pad : Definition.Obstacles)
    {
        if (Pad.Kind != K::LaunchPad) continue;
        const float Drop = Definition.LayerDropTime(Pad.Layer);
        if (bFalling && Drop >= 0 && RoundSeconds >= Drop) continue;
        const FVector Delta = Fighter->GetActorLocation() - Pad.Position;
        // A ball below a deck or flying over it cannot activate its pad.
        if (Delta.SizeSquared2D() <= FMath::Square(80.0f) && Delta.Z >= 30 && Delta.Z <= 85)
            if (Fighter->LaunchFromPad(FRotator(0, Pad.Yaw, 0).Vector())) return true;
    }
    return false;
}

int32 ADropfallArenaLayout::GetSolidFloorCount() const
{
    int32 Count = 0;
    for (const FDropfallArenaPiece& Piece : Pieces)
        if (Piece.Mesh->ComponentHasTag(TEXT("ArenaFloor")) && !Piece.bDropped) ++Count;
    return Count;
}
