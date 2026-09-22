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
}
