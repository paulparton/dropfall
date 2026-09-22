#include "DropfallSynth.h"

#include "Kismet/GameplayStatics.h"
#include "Sound/SoundWaveProcedural.h"

void FDropfallSynth::PlayTone(UObject* WorldContext, const FVector& Location,
    const float FrequencyHz, const float DurationSeconds, const float Volume)
{
    if (!WorldContext || FrequencyHz <= 0.0f || DurationSeconds <= 0.0f)
    {
        return;
    }

    constexpr int32 SampleRate = 24000;
    const int32 SampleCount = FMath::Max(1, FMath::RoundToInt(DurationSeconds * SampleRate));
    TArray<int16> Samples;
    Samples.SetNumUninitialized(SampleCount);
    for (int32 Index = 0; Index < SampleCount; ++Index)
    {
        const float Time = static_cast<float>(Index) / SampleRate;
        const float Alpha = static_cast<float>(Index) / SampleCount;
        const float Envelope = FMath::Square(1.0f - Alpha);
        const float Fundamental = FMath::Sin(2.0f * PI * FrequencyHz * Time);
        const float Harmonic = 0.28f * FMath::Sin(4.0f * PI * FrequencyHz * Time);
        Samples[Index] = static_cast<int16>(
            FMath::Clamp((Fundamental + Harmonic) * Envelope * 22000.0f, -32767.0f, 32767.0f));
    }

    USoundWaveProcedural* Wave = NewObject<USoundWaveProcedural>(WorldContext);
    Wave->SetSampleRate(SampleRate);
    Wave->NumChannels = 1;
    Wave->Duration = DurationSeconds;
    Wave->SoundGroup = SOUNDGROUP_Effects;
    Wave->QueueAudio(reinterpret_cast<const uint8*>(Samples.GetData()),
        Samples.Num() * sizeof(int16));
    UGameplayStatics::PlaySoundAtLocation(WorldContext, Wave, Location, Volume);
}
