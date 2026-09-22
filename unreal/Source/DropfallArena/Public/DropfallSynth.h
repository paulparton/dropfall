#pragma once

#include "CoreMinimal.h"

class FDropfallSynth
{
public:
    static void PlayTone(UObject* WorldContext, const FVector& Location,
        float FrequencyHz, float DurationSeconds, float Volume = 0.15f);
};
