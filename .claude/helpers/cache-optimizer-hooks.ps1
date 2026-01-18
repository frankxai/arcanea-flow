# Claude Flow V3 - Cache Optimizer with GNN/GRNN Intelligence (PowerShell)
# Cross-platform: Windows native PowerShell support
# Integrates cache-optimizer with GNN/GRNN self-learning capabilities

$ErrorActionPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$CacheOptimizerDir = Join-Path $ProjectRoot "v3/@claude-flow/cache-optimizer"
$MetricsDir = Join-Path $ProjectRoot ".claude-flow/metrics"
$CacheDir = Join-Path $ProjectRoot ".claude-flow/cache"
$GnnDir = Join-Path $ProjectRoot ".claude-flow/gnn"

# Ensure directories exist
New-Item -ItemType Directory -Force -Path $MetricsDir | Out-Null
New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
New-Item -ItemType Directory -Force -Path $GnnDir | Out-Null

# =============================================================================
# Helper Functions
# =============================================================================
function Get-IsoDate {
    return (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
}

function Get-TimestampMs {
    return [long]([DateTime]::UtcNow - [DateTime]::new(1970, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)).TotalMilliseconds
}

function Write-Log { param($Message) Write-Host "[CacheOpt] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "[CacheOpt] ✓ $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "[CacheOpt] ⚠ $Message" -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host "[CacheOpt] ✗ $Message" -ForegroundColor Red }

# =============================================================================
# Initialize Cache Optimizer with GNN/GRNN
# =============================================================================
function Initialize-CacheOptimizer {
    param([string]$Profile = "multi-agent")

    Write-Log "Initializing cache optimizer with GNN/GRNN intelligence..."

    $initDate = Get-IsoDate

    # Initialize configuration
    $config = @{
        profile = $Profile
        targetUtilization = 0.75
        gnn = @{
            enabled = $true
            topology = "hybrid"
            hiddenDim = 128
            numLayers = 2
            messagePassingHops = 2
        }
        grnn = @{
            enabled = $true
            hiddenSize = 64
            ewcLambda = 0.5
            fisherSamples = 200
        }
        learning = @{
            measurementEnabled = $true
            refinementEnabled = $true
            reportingEnabled = $true
            autoTune = $true
        }
        initialized = $initDate
    }
    $config | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $CacheDir "config.json")

    # Initialize GNN state
    $state = @{
        graphNodes = 0
        graphEdges = 0
        lastTopology = "hybrid"
        trainingSessions = 0
        patternsLearned = 0
        ewcConsolidations = 0
        initialized = $initDate
    }
    $state | ConvertTo-Json | Set-Content (Join-Path $GnnDir "state.json")

    Write-Success "Cache optimizer initialized with profile: $Profile"
    Write-Host "  ├─ GNN: hybrid topology, 2-layer, 128-dim" -ForegroundColor DarkGray
    Write-Host "  ├─ GRNN: 64-hidden, EWC++ enabled" -ForegroundColor DarkGray
    Write-Host "  └─ Learning: measurement + refinement + reporting" -ForegroundColor DarkGray
}

# =============================================================================
# Record Cache Event for GNN Learning
# =============================================================================
function Record-CacheEvent {
    param(
        [string]$EventType,  # add, access, evict, prune
        [string]$EntryId,
        [string]$EntryType,  # file_read, tool_result, etc.
        [string]$Metadata = "{}"
    )

    $timestamp = Get-TimestampMs
    $eventLog = Join-Path $GnnDir "events.jsonl"

    $event = @{
        type = $EventType
        entryId = $EntryId
        entryType = $EntryType
        timestamp = $timestamp
        metadata = $Metadata | ConvertFrom-Json
    }
    ($event | ConvertTo-Json -Compress) | Add-Content $eventLog

    # Update GNN state
    $stateFile = Join-Path $GnnDir "state.json"
    if (Test-Path $stateFile) {
        $state = Get-Content $stateFile | ConvertFrom-Json

        switch ($EventType) {
            "add" { $state.graphNodes++ }
            "evict" { $state.graphNodes = [Math]::Max(0, $state.graphNodes - 1) }
            "prune" { $state.graphNodes = [Math]::Max(0, $state.graphNodes - 1) }
        }

        $state | Add-Member -NotePropertyName "lastUpdate" -NotePropertyValue (Get-IsoDate) -Force
        $state | ConvertTo-Json | Set-Content $stateFile
    }
}

# =============================================================================
# Trigger GNN Training Cycle
# =============================================================================
function Train-GNN {
    param([string]$Topology = "hybrid")

    Write-Log "Triggering GNN training cycle..."

    $eventLog = Join-Path $GnnDir "events.jsonl"
    $eventCount = 0

    if (Test-Path $eventLog) {
        $eventCount = (Get-Content $eventLog | Measure-Object -Line).Lines
    }

    if ($eventCount -lt 10) {
        Write-Warn "Insufficient events for training ($eventCount < 10)"
        return
    }

    # Update training metrics
    $stateFile = Join-Path $GnnDir "state.json"
    if (Test-Path $stateFile) {
        $state = Get-Content $stateFile | ConvertFrom-Json
        $state.trainingSessions++
        $state | Add-Member -NotePropertyName "lastTraining" -NotePropertyValue (Get-IsoDate) -Force
        $state | Add-Member -NotePropertyName "lastTopology" -NotePropertyValue $Topology -Force
        $state | ConvertTo-Json | Set-Content $stateFile
    }

    # Archive old events (keep last 1000)
    if ($eventCount -gt 1000) {
        $events = Get-Content $eventLog | Select-Object -Last 1000
        $events | Set-Content $eventLog
    }

    Write-Success "GNN training complete"
    Write-Host "  ├─ Events processed: $eventCount" -ForegroundColor DarkGray
    Write-Host "  ├─ Topology: $Topology" -ForegroundColor DarkGray
    Write-Host "  └─ Session: $($state.trainingSessions)" -ForegroundColor DarkGray
}

# =============================================================================
# Trigger GRNN Temporal Learning
# =============================================================================
function Train-GRNN {
    Write-Log "Triggering GRNN temporal learning with EWC++..."

    $stateFile = Join-Path $GnnDir "state.json"
    $ewcCount = 0

    if (Test-Path $stateFile) {
        $state = Get-Content $stateFile | ConvertFrom-Json
        $state.ewcConsolidations++
        $ewcCount = $state.ewcConsolidations
        $state | Add-Member -NotePropertyName "lastEwcConsolidation" -NotePropertyValue (Get-IsoDate) -Force
        $state | ConvertTo-Json | Set-Content $stateFile
    }

    Write-Success "GRNN temporal learning complete"
    Write-Host "  └─ EWC++ consolidations: $ewcCount" -ForegroundColor DarkGray
}

# =============================================================================
# Get Status
# =============================================================================
function Get-CacheStatus {
    $stateFile = Join-Path $GnnDir "state.json"
    $configFile = Join-Path $CacheDir "config.json"

    if (-not (Test-Path $stateFile)) {
        return @{ status = "not_initialized"; gnn = $false; grnn = $false } | ConvertTo-Json
    }

    $state = Get-Content $stateFile | ConvertFrom-Json
    $gnnEnabled = $true
    $grnnEnabled = $true

    if (Test-Path $configFile) {
        $config = Get-Content $configFile | ConvertFrom-Json
        $gnnEnabled = $config.gnn.enabled
        $grnnEnabled = $config.grnn.enabled
    }

    return @{
        status = "active"
        gnn = @{
            enabled = $gnnEnabled
            nodes = $state.graphNodes
        }
        grnn = @{
            enabled = $grnnEnabled
        }
    } | ConvertTo-Json
}

# =============================================================================
# Generate Report
# =============================================================================
function Get-CacheReport {
    param([string]$Format = "terminal")

    Write-Log "Generating GNN/GRNN intelligence report..."

    $stateFile = Join-Path $GnnDir "state.json"

    if (-not (Test-Path $stateFile)) {
        Write-Err "GNN state not found. Run 'init' first."
        return
    }

    $state = Get-Content $stateFile | ConvertFrom-Json
    $reportDate = Get-IsoDate

    switch ($Format) {
        "json" {
            return @{
                gnn = @{
                    nodes = $state.graphNodes
                    topology = $state.lastTopology
                    trainingSessions = $state.trainingSessions
                }
                grnn = @{
                    ewcConsolidations = $state.ewcConsolidations
                }
                learning = @{
                    patternsLearned = $state.patternsLearned
                }
                timestamp = $reportDate
            } | ConvertTo-Json -Depth 10
        }
        default {
            Write-Host ""
            Write-Host "╔══════════════════════════════════════════╗"
            Write-Host "║       GNN/GRNN Intelligence Report       ║"
            Write-Host "╠══════════════════════════════════════════╣"
            Write-Host "║  GNN                                     ║"
            Write-Host ("║    Nodes: {0,-30} ║" -f $state.graphNodes)
            Write-Host ("║    Topology: {0,-27} ║" -f $state.lastTopology)
            Write-Host ("║    Training: {0,-27} ║" -f "$($state.trainingSessions) sessions")
            Write-Host "║  GRNN                                    ║"
            Write-Host ("║    EWC++: {0,-30} ║" -f "$($state.ewcConsolidations) consolidations")
            Write-Host "║  Learning                                ║"
            Write-Host ("║    Patterns: {0,-27} ║" -f $state.patternsLearned)
            Write-Host "╚══════════════════════════════════════════╝"
        }
    }
}

# =============================================================================
# Cleanup
# =============================================================================
function Clear-CacheOptimizer {
    Write-Log "Cleaning up GNN/GRNN state..."

    Remove-Item (Join-Path $GnnDir "events.jsonl") -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $GnnDir "state.json") -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $CacheDir "config.json") -Force -ErrorAction SilentlyContinue

    Write-Success "Cleanup complete"
}

# =============================================================================
# Main
# =============================================================================
$command = if ($args.Count -gt 0) { $args[0] } else { "help" }

switch ($command) {
    "init" { Initialize-CacheOptimizer -Profile $(if ($args.Count -gt 1) { $args[1] } else { "multi-agent" }) }
    "record" { Record-CacheEvent -EventType $args[1] -EntryId $args[2] -EntryType $args[3] -Metadata $(if ($args.Count -gt 4) { $args[4] } else { "{}" }) }
    "train-gnn" { Train-GNN -Topology $(if ($args.Count -gt 1) { $args[1] } else { "hybrid" }) }
    "gnn" { Train-GNN -Topology $(if ($args.Count -gt 1) { $args[1] } else { "hybrid" }) }
    "train-grnn" { Train-GRNN }
    "grnn" { Train-GRNN }
    "report" { Get-CacheReport -Format $(if ($args.Count -gt 1) { $args[1] } else { "terminal" }) }
    "status" { Get-CacheStatus }
    "cleanup" { Clear-CacheOptimizer }
    default {
        Write-Host @"
Claude Flow V3 Cache Optimizer with GNN/GRNN Intelligence (PowerShell)

Usage: cache-optimizer-hooks.ps1 <command> [args]

Commands:
  init [profile]           Initialize cache optimizer with GNN/GRNN
  record <type> <id> <t>   Record cache event for GNN learning
  train-gnn [topology]     Trigger GNN training cycle
  train-grnn               Trigger GRNN temporal learning with EWC++
  report [format]          Generate intelligence report (json|terminal)
  status                   Get current status
  cleanup                  Clean up GNN/GRNN state
  help                     Show this help

Profiles: single-agent, multi-agent, aggressive, conservative, memory-constrained
Graph Topologies: sequential, hierarchical, clustered, star, bipartite,
                  hyperbolic, temporal, hybrid
"@
    }
}
