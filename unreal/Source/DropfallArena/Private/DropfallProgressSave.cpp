#include "DropfallProgressSave.h"

namespace
{
constexpr int32 DifficultyCount = 3;

void EnsureArray(TArray<int32>& Values)
{
    const int32 PreviousCount = Values.Num();
    Values.SetNum(DifficultyCount);
    for (int32 Index = PreviousCount; Index < DifficultyCount; ++Index)
    {
        Values[Index] = 0;
    }
}
}

void UDropfallProgressSave::EnsureValid()
{
    EnsureArray(WinsByDifficulty);
    EnsureArray(BestStreakByDifficulty);
    EnsureArray(CurrentStreakByDifficulty);
    LadderRecords.RemoveAll([](const FDropfallLadderRecord& Record)
    {
        return Record.RoundsConceded < 0 || !FMath::IsFinite(Record.ActiveSeconds)
            || Record.ActiveSeconds <= 0.0f;
    });
    LadderRecords.StableSort([](const FDropfallLadderRecord& A, const FDropfallLadderRecord& B)
    {
        return A.RoundsConceded != B.RoundsConceded
            ? A.RoundsConceded < B.RoundsConceded : A.ActiveSeconds < B.ActiveSeconds;
    });
    TMap<FString, int32> BoardCounts;
    LadderRecords.RemoveAll([&](const FDropfallLadderRecord& Record)
    {
        const FString Key = Record.ArenaId.ToString() + (Record.bFallAway ? TEXT("/fall") : TEXT("/stable"));
        return ++BoardCounts.FindOrAdd(Key) > 5;
    });
}

void FDropfallLadderRun::Start()
{
    *this = FDropfallLadderRun();
    bActive = true;
}

void FDropfallLadderRun::Tick(const float Seconds)
{
    if (bActive && !bAwaitingAdvance && FMath::IsFinite(Seconds) && Seconds > 0.0f)
    {
        ActiveSeconds += Seconds;
    }
}

bool FDropfallLadderRun::ResolveMatch(const bool bWon, const int32 OpponentScore)
{
    if (!bActive || bAwaitingAdvance)
    {
        return false;
    }
    RoundsConceded += FMath::Max(0, OpponentScore);
    if (!bWon)
    {
        bActive = false;
    }
    else if (Stage == 2)
    {
        bActive = false;
        bCompleted = true;
    }
    else
    {
        bAwaitingAdvance = true;
    }
    return true;
}

bool FDropfallLadderRun::Advance()
{
    if (!bActive || !bAwaitingAdvance || Stage >= 2)
    {
        return false;
    }
    ++Stage;
    bAwaitingAdvance = false;
    return true;
}

TArray<FDropfallLadderRecord> UDropfallProgressSave::GetBoard(const FName ArenaId, const bool bFallAway) const
{
    return LadderRecords.FilterByPredicate([&](const FDropfallLadderRecord& Record)
    {
        return Record.ArenaId == ArenaId && Record.bFallAway == bFallAway;
    });
}

int32 UDropfallProgressSave::RecordLadderRun(const FDropfallLadderRun& Run, const FName ArenaId, const bool bFallAway)
{
    if (!Run.bCompleted || Run.bActive || Run.Stage != 2
        || Run.RoundsConceded < 0 || !FMath::IsFinite(Run.ActiveSeconds) || Run.ActiveSeconds <= 0.0f)
    {
        return 0;
    }
    EnsureValid();
    FDropfallLadderRecord Record;
    Record.ArenaId = ArenaId;
    Record.bFallAway = bFallAway;
    Record.RoundsConceded = Run.RoundsConceded;
    Record.ActiveSeconds = Run.ActiveSeconds;
    Record.CompletedAt = FDateTime::UtcNow();
    const TArray<FDropfallLadderRecord> Board = GetBoard(ArenaId, bFallAway);
    int32 Index = 0;
    while (Index < Board.Num())
    {
        const FDropfallLadderRecord& Existing = Board[Index];
        if (Record.RoundsConceded < Existing.RoundsConceded
            || (Record.RoundsConceded == Existing.RoundsConceded
                && Record.ActiveSeconds < Existing.ActiveSeconds))
        {
            break;
        }
        ++Index;
    }
    if (Index >= 5)
    {
        return 0;
    }
    LadderRecords.Add(Record);
    EnsureValid();
    return Index + 1;
}
