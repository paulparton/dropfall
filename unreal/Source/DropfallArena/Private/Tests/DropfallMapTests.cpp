#if WITH_DEV_AUTOMATION_TESTS

#include "DropfallArenaLayout.h"
#include "DropfallProgressSave.h"
#include "DropfallFighterPawn.h"
#include "Tests/AutomationCommon.h"
#include "GameFramework/WorldSettings.h"
#include "GameFramework/GameModeBase.h"
#include "Engine/World.h"
#include "Components/StaticMeshComponent.h"
#include "Misc/AutomationTest.h"
#include "Kismet/GameplayStatics.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallMapCatalogTest, "DropfallArena.Maps.LayoutAndRampGeometry",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FDropfallMapCatalogTest::RunTest(const FString& Parameters)
{
    double LastArea = 0;
    TSet<FName> Ids;
    for (int32 Index = 0; Index < FDropfallMapDefinition::Count; ++Index)
    {
        const FDropfallMapDefinition Map = FDropfallMapDefinition::Get(Index);
        Ids.Add(Map.Id);
        const FVector2D Half = Map.HalfSize();
        TestTrue(TEXT("maps get progressively larger"), Half.X * Half.Y > LastArea);
        LastArea = Half.X * Half.Y;
        TestTrue(TEXT("larger than original 12 x 8m"), Half.X >= 800 && Half.Y >= 800);
        TestTrue(TEXT("spawn inside floor"), FMath::Abs(Map.Spawn(true).X) + 53 < Half.X);
        int32 Ramps = 0;
        for (const FDropfallObstacleSpec& Spec : Map.Obstacles)
        {
            const FTransform Transform = Spec.Kind == EDropfallObstacle::Ramp ? Map.RampTransform(Spec)
                : FTransform(FRotator(0, Spec.Yaw, 0), Spec.Position, Spec.Size / 100);
            const FBox Bounds = FBox(FVector(-50), FVector(50)).TransformBy(Transform.ToMatrixWithScale());
            TestTrue(TEXT("obstacle fits floor"), Bounds.Min.X >= -Half.X && Bounds.Max.X <= Half.X
                && Bounds.Min.Y >= -Half.Y && Bounds.Max.Y <= Half.Y);
            for (bool bCyan : {true, false})
            {
                const FVector Local = Transform.InverseTransformPosition(Map.Spawn(bCyan));
                const FVector Padding = FVector(60) / Transform.GetScale3D();
                TestFalse(TEXT("spawn not inside obstacle"), FBox(FVector(-50) - Padding, FVector(50) + Padding).IsInside(Local));
            }
            if (Spec.Kind == EDropfallObstacle::Ramp)
            {
                ++Ramps;
                TestTrue(TEXT("ramp entry top is flush"), Transform.TransformPosition(FVector(-50, 0, 50)).Equals(Spec.Position, .01));
                TestTrue(TEXT("launch lip is raised"), Transform.TransformPosition(FVector(50, 0, 50)).Z > 140);
            }
        }
        TestEqual(TEXT("two more ramps on each larger map"), Ramps, 6 + 2 * Index);
        TestEqual(TEXT("stable bounds never shrink"), Map.SafeHalfSize(1000, false), Half);
        TestTrue(TEXT("warning encourages AI inward"), Map.SafeHalfSize(27, true).X < Half.X);
        TestEqual(TEXT("initial drop countdown"), Map.NextDrop(0), 30.0f);
    }
    TestEqual(TEXT("distinct map identities"), Ids.Num(), 3);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallMapCollisionTest, "DropfallArena.Maps.CollisionCollapseAndReset",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FDropfallMapCollisionTest::RunTest(const FString& Parameters)
{
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false);
    ADropfallArenaLayout* Layout = World->SpawnActor<ADropfallArenaLayout>();
    for (int32 Index = 0; Index < FDropfallMapDefinition::Count; ++Index)
    {
        const FDropfallMapDefinition Map = FDropfallMapDefinition::Get(Index);
        Layout->Build(Map);
        const int32 Total = Map.Grid.X * Map.Grid.Y;
        TestEqual(TEXT("all floor tiles created"), Layout->GetSolidFloorCount(), Total);
        const FVector2D Edge = Map.HalfSize() - FVector2D(80, 80);
        const auto HitFloor = [&]()
        {
            FHitResult Hit;
            return World->LineTraceSingleByChannel(Hit, FVector(Edge, 500), FVector(Edge, -100), ECC_Visibility);
        };
        TestTrue(TEXT("floor really collides"), HitFloor());
        Layout->SetRoundTime(1000, false);
        TestEqual(TEXT("stable mode retains every floor tile"), Layout->GetSolidFloorCount(), Total);
        TestTrue(TEXT("stable mode retains collision"), HitFloor());
        Layout->SetRoundTime(29, true);
        TestEqual(TEXT("warning is still solid"), Layout->GetSolidFloorCount(), Total);
        Layout->SetRoundTime(30, true);
        TestEqual(TEXT("outer extensions removed, cross-shaped middle remains"), Layout->GetSolidFloorCount(), 32);
        TestFalse(TEXT("dropped floor no longer collides"), HitFloor());
        Layout->SetRoundTime(100, true);
        TestEqual(TEXT("permanent sixteen-tile combat core survives"), Layout->GetSolidFloorCount(), 16);
        Layout->SetRoundTime(0, true);
        TestEqual(TEXT("rematch restores every tile"), Layout->GetSolidFloorCount(), Total);
        TestTrue(TEXT("rematch restores collision"), HitFloor());

        TArray<UStaticMeshComponent*> Meshes;
        Layout->GetComponents(Meshes);
        for (UStaticMeshComponent* Mesh : Meshes)
        {
            if (!Mesh->ComponentHasTag(TEXT("Ramp"))) continue;
            const FVector Entry = Mesh->GetComponentTransform().TransformPosition(FVector(-40, 0, 50));
            const FVector Lip = Mesh->GetComponentTransform().TransformPosition(FVector(40, 0, 50));
            FHitResult Hit;
            TestTrue(TEXT("ramp upper surface has physical collision"),
                Mesh->LineTraceComponent(Hit, Lip + FVector(0, 0, 300), Lip - FVector(0, 0, 100), FCollisionQueryParams()));
            TestTrue(TEXT("ramp rises in travel direction"), Lip.Z > Entry.Z + 100);
        }
    }
    World->DestroyWorld(false);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallMapBoardsTest, "DropfallArena.Maps.SeparateLeaderboards",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FDropfallMapBoardsTest::RunTest(const FString& Parameters)
{
    UDropfallProgressSave* Save = NewObject<UDropfallProgressSave>();
    FDropfallLadderRun Run; Run.Start(); Run.Tick(50);
    Run.ResolveMatch(true, 0); Run.Advance(); Run.ResolveMatch(true, 0); Run.Advance(); Run.ResolveMatch(true, 0);
    Save->RecordLadderRun(Run); // Old records retain their legacy board.
    for (int32 Map = 0; Map < 3; ++Map) for (bool bFall : {false, true})
    {
        for (int32 i = 0; i < 7; ++i) Save->RecordLadderRun(Run, FDropfallMapDefinition::Get(Map).Id, bFall);
        TestEqual(TEXT("each map/rule independently retains five"), Save->GetBoard(FDropfallMapDefinition::Get(Map).Id, bFall).Num(), 5);
    }
    TestEqual(TEXT("legacy record is preserved"), Save->GetBoard(TEXT("Legacy"), true).Num(), 1);
    TestEqual(TEXT("all boards survive pruning"), Save->LadderRecords.Num(), 31);
    TArray<uint8> Bytes;
    TestTrue(TEXT("boards serialize"), UGameplayStatics::SaveGameToMemory(Save, Bytes));
    const UDropfallProgressSave* Loaded = Cast<UDropfallProgressSave>(UGameplayStatics::LoadGameFromMemory(Bytes));
    if (TestNotNull(TEXT("boards reload"), Loaded))
        TestEqual(TEXT("map and terrain identities survive"), Loaded->GetBoard(FDropfallMapDefinition::Get(2).Id, false).Num(), 5);
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallRampFlightTest, "DropfallArena.Maps.BoostRampFlight",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FDropfallRampFlightTest::RunTest(const FString& Parameters)
{
    FTestWorldWrapper TestWorld;
    if (!TestTrue(TEXT("physics test world created"), TestWorld.CreateTestWorld(EWorldType::Game))) return false;
    UWorld* World = TestWorld.GetTestWorld();
    // No Arena game mode, leaderboard or user save slot participates in this test.
    World->GetWorldSettings()->DefaultGameMode = AGameModeBase::StaticClass();
    World->bShouldSimulatePhysics = true;
    ADropfallArenaLayout* Layout = World->SpawnActor<ADropfallArenaLayout>();
    Layout->Build(FDropfallMapDefinition::Get(0));
    ADropfallFighterPawn* Fighter = World->SpawnActor<ADropfallFighterPawn>(FVector(430, -1020, 56), FRotator::ZeroRotator);
    TestWorld.BeginPlayInTestWorld();
    Fighter->ResetFighter(FVector(430, -1020, 56));
    Fighter->SetMoveIntent(FVector2D(1, 0));
    TestWorld.TickTestWorld(1.0f / 60);
    Fighter->TryBoost();
    bool bAirBeyondLip = false;
    double HighestZ = 0;
    for (int32 Frame = 0; Frame < 90; ++Frame)
    {
        TestWorld.TickTestWorld(1.0f / 60);
        const FVector Position = Fighter->GetActorLocation();
        HighestZ = FMath::Max(HighestZ, Position.Z);
        // Outer launch ramp ends at X=1020, Z=145, with no receiving deck.
        if (Position.X > 1090 && Position.Z > 205) bAirBeyondLip = true;
    }
    AddInfo(FString::Printf(TEXT("Ramp trajectory apex: %.1f cm; final %s"), HighestZ, *Fighter->GetActorLocation().ToString()));
    TestTrue(TEXT("boosted ball becomes airborne beyond physical ramp lip"), bAirBeyondLip);
    TestWorld.ForwardErrorMessages(this);
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallLayerConnectivityTest, "DropfallArena.Maps.LayerConnectivity",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FDropfallLayerConnectivityTest::RunTest(const FString& Parameters)
{
    for (int32 Index = 0; Index < 3; ++Index)
    {
        const FDropfallMapDefinition Map = FDropfallMapDefinition::Get(Index);
        TestEqual(TEXT("no further collapse after middle"), Map.NextDrop(1000), 0.0f);
        TestEqual(TEXT("core bounds remain usable forever"), Map.SafeHalfSize(1000, true), FVector2D(800));
        for (const FDropfallObstacleSpec& Deck : Map.Obstacles)
        {
            if (Deck.Kind != EDropfallObstacle::Deck) continue;
            bool bConnected = false;
            const float Top = Deck.Position.Z + Deck.Size.Z / 2;
            for (const FDropfallObstacleSpec& Ramp : Map.Obstacles)
            {
                if (Ramp.Kind != EDropfallObstacle::Ramp || Ramp.Layer != Deck.Layer) continue;
                const FVector End = Map.RampTransform(Ramp).TransformPosition(FVector(50, 0, 50));
                if (FMath::Abs(End.Z - Top) < .01 && FMath::Abs(End.X - Deck.Position.X) <= Deck.Size.X / 2 + .1
                    && FMath::Abs(End.Y - Deck.Position.Y) <= Deck.Size.Y / 2 + .1) bConnected = true;
            }
            TestTrue(TEXT("every elevated deck has a flush ramp in the same collapse layer"), bConnected);
        }
        const FVector From(-320, -650, 56), Target(-320, 500, 240);
        TestTrue(TEXT("AI approaches surviving core ramp before elevated opponent"),
            Map.RouteToElevation(From, Target, 1000, true).Y < 0);
    }
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallPadTest, "DropfallArena.Maps.LaunchPadPhysicsAndLifecycle",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FDropfallPadTest::RunTest(const FString& Parameters)
{
    FTestWorldWrapper TestWorld;
    if (!TestWorld.CreateTestWorld(EWorldType::Game)) return false;
    UWorld* World = TestWorld.GetTestWorld();
    World->GetWorldSettings()->DefaultGameMode = AGameModeBase::StaticClass();
    World->bShouldSimulatePhysics = true;
    ADropfallArenaLayout* Layout = World->SpawnActor<ADropfallArenaLayout>();
    Layout->Build(FDropfallMapDefinition::Get(0));
    ADropfallFighterPawn* Fighter = World->SpawnActor<ADropfallFighterPawn>(FVector(-600, -420, 56), FRotator::ZeroRotator);
    TestWorld.BeginPlayInTestWorld();
    Fighter->ResetFighter(FVector(-600, -420, 56));
    TestTrue(TEXT("core launch pad activates"), Layout->TryLaunch(Fighter));
    TestFalse(TEXT("launch velocity cannot stack"), Layout->TryLaunch(Fighter));
    double Highest = 0;
    for (int32 Frame = 0; Frame < 90; ++Frame)
    {
        TestWorld.TickTestWorld(1.0f / 60);
        Highest = FMath::Max(Highest, Fighter->GetActorLocation().Z);
    }
    AddInfo(FString::Printf(TEXT("Launch pad apex %.1fcm"), Highest));
    TestTrue(TEXT("pad produces real flight"), Highest > 250);
    Fighter->ResetFighter(FVector(990, 80, 56));
    TestFalse(TEXT("cannot trigger raised pad from underneath"), Layout->TryLaunch(Fighter));
    Fighter->ResetFighter(FVector(990, 80, 296));
    Layout->SetRoundTime(49, true);
    TestTrue(TEXT("warning pad still usable"), Layout->TryLaunch(Fighter));
    Fighter->ResetFighter(FVector(990, 80, 296));
    Layout->SetRoundTime(50, true);
    TestFalse(TEXT("fallen pad disabled"), Layout->TryLaunch(Fighter));
    Fighter->ResetFighter(FVector(-600, -420, 56));
    Layout->SetRoundTime(1000, true);
    TestTrue(TEXT("final core pad survives"), Layout->TryLaunch(Fighter));
    Layout->SetRoundTime(0, false);
    Fighter->ResetFighter(FVector(990, 80, 296));
    TestTrue(TEXT("reset restores raised pad"), Layout->TryLaunch(Fighter));
    TestWorld.ForwardErrorMessages(this);
    return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallTerraceTraversalTest, "DropfallArena.Maps.PermanentTerraceTraversal",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FDropfallTerraceTraversalTest::RunTest(const FString& Parameters)
{
    for (int32 MapIndex = 0; MapIndex < 3; ++MapIndex)
    {
        FTestWorldWrapper TestWorld;
        if (!TestWorld.CreateTestWorld(EWorldType::Game)) return false;
        UWorld* World = TestWorld.GetTestWorld();
        World->GetWorldSettings()->DefaultGameMode = AGameModeBase::StaticClass();
        World->bShouldSimulatePhysics = true;
        ADropfallArenaLayout* Layout = World->SpawnActor<ADropfallArenaLayout>();
        Layout->Build(FDropfallMapDefinition::Get(MapIndex));
        Layout->SetRoundTime(1000, true);
        ADropfallFighterPawn* Fighter = World->SpawnActor<ADropfallFighterPawn>(FVector(-320, -450, 56), FRotator::ZeroRotator);
        TestWorld.BeginPlayInTestWorld();
        Fighter->ResetFighter(FVector(-320, -450, 56));
        Fighter->SetMoveIntent(FVector2D(0, 1));
        bool bReachedDeck = false;
        for (int32 Frame = 0; Frame < 180; ++Frame)
        {
            TestWorld.TickTestWorld(1.0f / 60);
            const FVector P = Fighter->GetActorLocation();
            if (P.Y > 410 && P.Y < 650 && P.Z > (MapIndex == 2 ? 265 : 225))
            { bReachedDeck = true; break; }
        }
        TestTrue(TEXT("ball climbs onto surviving terrace without boost or pad assistance"), bReachedDeck);
        TestWorld.ForwardErrorMessages(this);
    }
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallCosmeticTest, "DropfallArena.Art.SpherePhysicsParity",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FDropfallCosmeticTest::RunTest(const FString& Parameters)
{
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false);
    ADropfallFighterPawn* Fighter = World->SpawnActor<ADropfallFighterPawn>();
    UStaticMeshComponent* Body = Cast<UStaticMeshComponent>(Fighter->GetRootComponent());
    const UStaticMesh* PhysicsMesh = Body->GetStaticMesh();
    for (int32 Theme = 0; Theme < 3; ++Theme)
    {
        Fighter->SetFighterColor(FLinearColor(.02f, .8f, 1));
        Fighter->SetArenaTheme(Theme);
        TestTrue(TEXT("cosmetics never replace physical sphere"), Body->GetStaticMesh() == PhysicsMesh);
        TestEqual(TEXT("unchanged body scale"), Body->GetComponentScale(), FVector(1.05f));
        TArray<UStaticMeshComponent*> Meshes;
        Fighter->GetComponents(Meshes);
        for (UStaticMeshComponent* Mesh : Meshes) if (Mesh != Body)
        {
            TestNotNull(TEXT("themed shell asset loads"), Mesh->GetStaticMesh().Get());
            TestTrue(TEXT("shell visible"), Mesh->IsVisible());
            TestEqual(TEXT("shell never alters collision"), Mesh->GetCollisionEnabled(), ECollisionEnabled::NoCollision);
            TestEqual(TEXT("shell has distinct team and armour slots"), Mesh->GetNumMaterials(), 2);
        }
    }
    World->DestroyWorld(false);
    return true;
}
#endif
