using UnrealBuildTool;

public class DropfallArenaServerTarget : TargetRules
{
    public DropfallArenaServerTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Server;
        DefaultBuildSettings = BuildSettingsVersion.V7;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("DropfallArena");
    }
}
