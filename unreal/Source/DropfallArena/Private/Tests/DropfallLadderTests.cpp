#if WITH_DEV_AUTOMATION_TESTS

#include "DropfallProgressSave.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallLadderProgressionTest,
    "DropfallArena.Ladder.ProgressionAndRetries",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FDropfallLadderProgressionTest::RunTest(const FString& Parameters)
{
    FDropfallLadderRun Run;
    TestFalse(TEXT("cannot resolve an unstarted run"), Run.ResolveMatch(true, 0));
    Run.Start();
    TestFalse(TEXT("cannot skip Rookie"), Run.Advance());
    Run.Tick(12.5f);
    TestTrue(TEXT("Rookie win accepted"), Run.ResolveMatch(true, 2));
    Run.Tick(99.0f);
    TestEqual(TEXT("results time is excluded"), Run.ActiveSeconds, 12.5f);
    TestFalse(TEXT("duplicate win is rejected"), Run.ResolveMatch(true, 2));
    TestEqual(TEXT("rounds are recorded once"), Run.RoundsConceded, 2);
    TestTrue(TEXT("advance to Rival"), Run.Advance());
    TestFalse(TEXT("double confirm cannot skip Rival"), Run.Advance());
    Run.Tick(20.0f);
    Run.ResolveMatch(true, 1);
    Run.Advance();
    Run.Tick(30.0f);
    Run.ResolveMatch(true, 0);
    TestTrue(TEXT("Ace win completes run"), Run.bCompleted);
    TestFalse(TEXT("completed run stops"), Run.bActive);
    TestEqual(TEXT("all three matches timed"), Run.ActiveSeconds, 62.5f);
    TestEqual(TEXT("conceded rounds accumulated"), Run.RoundsConceded, 3);
    TestFalse(TEXT("cannot finish twice"), Run.ResolveMatch(true, 0));
    Run.Start();
    TestEqual(TEXT("retry begins at Rookie"), Run.Stage, 0);
    TestEqual(TEXT("retry clears timing"), Run.ActiveSeconds, 0.0f);
    TestFalse(TEXT("retry clears completion"), Run.bCompleted);
    Run.Tick(4.0f);
    Run.ResolveMatch(false, 3);
    Run.Tick(10.0f);
    TestFalse(TEXT("loss ends the run"), Run.bActive);
    TestFalse(TEXT("loss cannot advance"), Run.Advance());
    TestFalse(TEXT("loss is not a completion"), Run.bCompleted);
    TestEqual(TEXT("failed run timer stops"), Run.ActiveSeconds, 4.0f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallLadderSaveTest,
    "DropfallArena.Ladder.RankingAndSaveCompatibility",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FDropfallLadderSaveTest::RunTest(const FString& Parameters)
{
    UDropfallProgressSave* Save = NewObject<UDropfallProgressSave>();
    Save->WinsByDifficulty = { 7, 4, 1 };
    Save->EnsureValid();
    TestEqual(TEXT("legacy wins retained"), Save->WinsByDifficulty[0], 7);
    TestEqual(TEXT("new leaderboard starts empty"), Save->LadderRecords.Num(), 0);
    FDropfallLadderRun Run;
    Run.Start();
    Run.Tick(10.0f);
    TestEqual(TEXT("partial runs excluded"), Save->RecordLadderRun(Run), 0);
    Run.ResolveMatch(false, 3);
    TestEqual(TEXT("failed runs excluded"), Save->RecordLadderRun(Run), 0);

    const auto AddRun = [&](int32 Conceded, float Seconds)
    {
        FDropfallLadderRun Completed;
        Completed.Start();
        Completed.Tick(Seconds);
        Completed.ResolveMatch(true, Conceded);
        Completed.Advance();
        Completed.ResolveMatch(true, 0);
        Completed.Advance();
        Completed.ResolveMatch(true, 0);
        return Save->RecordLadderRun(Completed);
    };
    AddRun(3, 50.0f);
    TestEqual(TEXT("fewer conceded beats faster time"), AddRun(1, 100.0f), 1);
    TestEqual(TEXT("time breaks ties"), AddRun(1, 90.0f), 1);
    AddRun(4, 40.0f);
    AddRun(5, 30.0f);
    TestEqual(TEXT("slower sixth entry does not rank"), AddRun(6, 20.0f), 0);
    TestEqual(TEXT("new best enters full board"), AddRun(0, 120.0f), 1);
    TestEqual(TEXT("board stays bounded"), Save->LadderRecords.Num(), 5);
    TestEqual(TEXT("correct best time"), Save->LadderRecords[0].ActiveSeconds, 120.0f);
    TestEqual(TEXT("correct worst score retained"), Save->LadderRecords.Last().RoundsConceded, 4);

    TArray<uint8> Bytes;
    TestTrue(TEXT("save serializes"), UGameplayStatics::SaveGameToMemory(Save, Bytes));
    UDropfallProgressSave* Loaded = Cast<UDropfallProgressSave>(UGameplayStatics::LoadGameFromMemory(Bytes));
    if (!TestNotNull(TEXT("save reloads"), Loaded)) return false;
    Loaded->EnsureValid();
    TestEqual(TEXT("legacy data survives roundtrip"), Loaded->WinsByDifficulty[0], 7);
    TestEqual(TEXT("leaderboard survives roundtrip"), Loaded->LadderRecords.Num(), 5);
    TestEqual(TEXT("rank and time survive roundtrip"), Loaded->LadderRecords[1].ActiveSeconds, 90.0f);
    TestTrue(TEXT("date survives roundtrip"), Loaded->LadderRecords[0].CompletedAt.GetTicks() > 0);
    return true;
}

#endif
