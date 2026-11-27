$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcRoot = Join-Path $rootDir "assets\npc"
$outNpc  = Join-Path $rootDir "assets\npc_ready"
$outGear = Join-Path $rootDir "assets\items\fantasy_gear"

if (-not (Test-Path -LiteralPath $srcRoot)) {
    Write-Host "ERROR: Source folder not found: $srcRoot" -ForegroundColor Red
    exit 1
}

if (Test-Path -LiteralPath $outNpc)  { Remove-Item -LiteralPath $outNpc  -Recurse -Force }
if (Test-Path -LiteralPath $outGear) { Remove-Item -LiteralPath $outGear -Recurse -Force }

@(
    "$outNpc\sets",
    "$outNpc\portraits\elves",
    "$outNpc\portraits\humans",
    "$outNpc\portraits\avatars",
    "$outNpc\sprites",
    $outGear
) | ForEach-Object { [System.IO.Directory]::CreateDirectory($_) | Out-Null }

$jpegCodec  = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$jpegParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$jpegParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)

function Save-OptimizedImage {
    param([string]$SrcPath, [string]$DstPath, [int]$MaxSide, [bool]$AsJpeg)
    try {
        $ext = [System.IO.Path]::GetExtension($SrcPath).ToLowerInvariant()
        if ($ext -eq ".webp") {
            Copy-Item -LiteralPath $SrcPath -Destination $DstPath -Force
            return $true
        }
        $bytes = [System.IO.File]::ReadAllBytes($SrcPath)
        $ms = New-Object System.IO.MemoryStream(,$bytes)
        $img = [System.Drawing.Image]::FromStream($ms)
        try {
            $w = $img.Width
            $h = $img.Height
            $scale = [Math]::Min(1.0, $MaxSide / [double][Math]::Max($w, $h))
            $nw = [Math]::Max(1, [int][Math]::Round($w * $scale))
            $nh = [Math]::Max(1, [int][Math]::Round($h * $scale))

            $pixFmt = if ($AsJpeg) { [System.Drawing.Imaging.PixelFormat]::Format24bppRgb } else { [System.Drawing.Imaging.PixelFormat]::Format32bppArgb }
            $bmp = New-Object System.Drawing.Bitmap($nw, $nh, $pixFmt)
            try {
                $g = [System.Drawing.Graphics]::FromImage($bmp)
                try {
                    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                    if ($AsJpeg) { $g.Clear([System.Drawing.Color]::FromArgb(20, 18, 16)) }
                    $g.DrawImage($img, 0, 0, $nw, $nh)
                } finally { $g.Dispose() }

                if ($AsJpeg) {
                    $bmp.Save($DstPath, $jpegCodec, $jpegParams)
                } else {
                    $bmp.Save($DstPath, [System.Drawing.Imaging.ImageFormat]::Png)
                }
            } finally { $bmp.Dispose() }
        } finally {
            $img.Dispose()
            $ms.Dispose()
        }
        return $true
    } catch {
        Write-Host "  [Skip] $(Split-Path -Leaf $SrcPath)" -ForegroundColor Yellow
        return $false
    }
}

function Detect-EmotionSlot {
    param([string]$FileName)
    $n = $FileName.ToLowerInvariant()
    if ($n -match 'neutral|normal|default|calm|idle|base|stand') { return 'neutral' }
    if ($n -match 'happy|smile|joy|laugh|glad|cheer|grin')       { return 'happy' }
    if ($n -match 'angry|mad|rage|fury|annoy|glare|frown')       { return 'angry' }
    if ($n -match 'surpris|shock|amaze|wow|panic|scare|fear')    { return 'surprised' }
    if ($n -match 'sad|cry|tear|sorrow|gloom|hurt|pain|worry')   { return 'sad' }
    if ($n -match 'smug|wink|shy|blush|sly|evil|smirk|tease')    { return 'smug' }
    return ''
}

function Get-GroupPrefix {
    param([string]$RelDir, [string]$BaseName)
    $clean = $BaseName -replace '(?i)[_\-\s]*(neutral|normal|default|calm|idle|happy|smile|joy|laugh|angry|mad|rage|surpris\w*|shock\w*|sad|cry|smug|wink|blush|smirk|open|close|mouth|face|exp\w*|pose\w*)[_\-\s0-9]*$', ''
    $clean = $clean -replace '[_\-\s]*\d+$', ''
    $clean = $clean.Trim('_', '-', ' ')
    if ([string]::IsNullOrWhiteSpace($clean)) { $clean = Split-Path -Leaf $RelDir }
    return "$RelDir::$clean"
}

$has512 = Test-Path -LiteralPath (Join-Path $srcRoot "512x512")

$elvesList   = New-Object System.Collections.ArrayList
$humansList  = New-Object System.Collections.ArrayList
$avatarsList = New-Object System.Collections.ArrayList
$spritesList = New-Object System.Collections.ArrayList
$gearList    = New-Object System.Collections.ArrayList
$setBuckets  = @{}

$allFiles = Get-ChildItem -LiteralPath $srcRoot -Recurse -File | Where-Object {
    $_.Extension -match '^\.(png|jpg|jpeg|webp)$'
} | Sort-Object FullName

Write-Host "Found images: $($allFiles.Count). Sorting and optimizing..." -ForegroundColor Cyan

$cntElf = 0; $cntHum = 0; $cntAv = 0; $cntSpr = 0; $cntGear = 0; $cntSetImg = 0
$processed = 0

foreach ($f in $allFiles) {
    $processed++
    if ($processed % 100 -eq 0) { Write-Host "  Processed $processed / $($allFiles.Count)..." -ForegroundColor Gray }

    $name = $f.Name
    $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
    $relPath = $f.FullName.Substring($srcRoot.Length).TrimStart('\')
    $parts = $relPath -split '\\'
    $topFolder = if ($parts.Length -gt 1) { $parts[0] } else { "" }
    $relDir = if ($parts.Length -gt 1) { ($parts[0..($parts.Length - 2)] -join '/') } else { "" }

    if ($name.StartsWith("_") -or $name -match '(?i)(^screenshot|preview|banner|cover|thumbnail|icon_bg)') { continue }
    if ($has512 -and $topFolder -eq "1024x1024") { continue }

    if ($topFolder -match '(?i)Free-Game-Icons-of-Fantasy') {
        if ($relPath -match '(?i)\\(256|512|PNG|Icons)\\' -or $parts.Length -le 2) {
            $cntGear++
            $dstName = "gear_{0:D3}.png" -f $cntGear
            $dstFull = Join-Path $outGear $dstName
            if (Save-OptimizedImage -SrcPath $f.FullName -DstPath $dstFull -MaxSide 256 -AsJpeg $false) {
                [void]$gearList.Add("assets/items/fantasy_gear/$dstName")
            }
        }
        continue
    }

    if ($name -match '(?i)coraxdigitalart-realistic-elf-heroes') {
        $cntElf++
        $dstName = "elf_{0:D3}.jpg" -f $cntElf
        $dstFull = Join-Path "$outNpc\portraits\elves" $dstName
        if (Save-OptimizedImage -SrcPath $f.FullName -DstPath $dstFull -MaxSide 380 -AsJpeg $true) {
            [void]$elvesList.Add("assets/npc_ready/portraits/elves/$dstName")
        }
        continue
    }
    if ($name -match '(?i)coraxdigitalart-realistic-human-heroes') {
        $cntHum++
        $dstName = "human_{0:D3}.jpg" -f $cntHum
        $dstFull = Join-Path "$outNpc\portraits\humans" $dstName
        if (Save-OptimizedImage -SrcPath $f.FullName -DstPath $dstFull -MaxSide 380 -AsJpeg $true) {
            [void]$humansList.Add("assets/npc_ready/portraits/humans/$dstName")
        }
        continue
    }

    if ($topFolder -eq "" -or $topFolder -match '^(512x512|1024x1024|PNG|Portraits|Facesets)$') {
        $cntAv++
        $dstName = "av_{0:D3}.png" -f $cntAv
        $dstFull = Join-Path "$outNpc\portraits\avatars" $dstName
        if (Save-OptimizedImage -SrcPath $f.FullName -DstPath $dstFull -MaxSide 520 -AsJpeg $false) {
            [void]$avatarsList.Add("assets/npc_ready/portraits/avatars/$dstName")
        }
        continue
    }

    if ($topFolder -match '^(25_full|25_pose|background_char_ready)$') {
        $cntSpr++
        $dstName = "spr_{0:D3}.png" -f $cntSpr
        $dstFull = Join-Path "$outNpc\sprites" $dstName
        if (Save-OptimizedImage -SrcPath $f.FullName -DstPath $dstFull -MaxSide 540 -AsJpeg $false) {
            [void]$spritesList.Add("assets/npc_ready/sprites/$dstName")
        }
        continue
    }

    $gKey = Get-GroupPrefix -RelDir $relDir -BaseName $base
    if (-not $setBuckets.ContainsKey($gKey)) {
        $setBuckets[$gKey] = New-Object System.Collections.ArrayList
    }
    [void]$setBuckets[$gKey].Add($f)
}

$setsList = New-Object System.Collections.ArrayList
$setNum = 0
$emoOrder = @('neutral', 'happy', 'angry', 'surprised', 'sad', 'smug')

foreach ($k in ($setBuckets.Keys | Sort-Object)) {
    $groupFiles = $setBuckets[$k]
    if ($groupFiles.Count -ge 2 -and $groupFiles.Count -le 24) {
        $setNum++
        $setId = "set_{0:D3}" -f $setNum
        $rawLabel = ($k -split '::')[-1]
        $packTag  = ($k -split '/')[0]
        $label = "$packTag - $rawLabel"

        $emotionsMap = @{}
        $allSetUrls = New-Object System.Collections.ArrayList
        $unassigned = New-Object System.Collections.ArrayList
        $imgIdx = 0

        foreach ($gf in $groupFiles) {
            $imgIdx++
            $cntSetImg++
            $dstName = "{0}_{1:D2}.png" -f $setId, $imgIdx
            $dstFull = Join-Path "$outNpc\sets" $dstName
            if (Save-OptimizedImage -SrcPath $gf.FullName -DstPath $dstFull -MaxSide 520 -AsJpeg $false) {
                $url = "assets/npc_ready/sets/$dstName"
                [void]$allSetUrls.Add($url)
                $slot = Detect-EmotionSlot -FileName $gf.Name
                if ($slot -and -not $emotionsMap.ContainsKey($slot)) {
                    $emotionsMap[$slot] = $url
                } else {
                    [void]$unassigned.Add($url)
                }
            }
        }

        foreach ($u in $unassigned) {
            $placed = $false
            foreach ($sl in $emoOrder) {
                if (-not $emotionsMap.ContainsKey($sl)) {
                    $emotionsMap[$sl] = $u
                    $placed = $true
                    break
                }
            }
            if (-not $placed) { break }
        }

        if ($allSetUrls.Count -gt 0) {
            $preview = if ($emotionsMap.ContainsKey('neutral')) { $emotionsMap['neutral'] } else { $allSetUrls[0] }
            [void]$setsList.Add(@{
                id       = $setId
                label    = $label
                pack     = $packTag
                preview  = $preview
                emotions = $emotionsMap
                sprites  = @($allSetUrls.ToArray())
            })
        }
    } else {
        foreach ($gf in $groupFiles) {
            $cntSpr++
            $dstName = "spr_{0:D3}.png" -f $cntSpr
            $dstFull = Join-Path "$outNpc\sprites" $dstName
            if (Save-OptimizedImage -SrcPath $gf.FullName -DstPath $dstFull -MaxSide 520 -AsJpeg $false) {
                [void]$spritesList.Add("assets/npc_ready/sprites/$dstName")
            }
        }
    }
}

$catalog = @{
    sets    = @($setsList.ToArray())
    elves   = @($elvesList.ToArray())
    humans  = @($humansList.ToArray())
    avatars = @($avatarsList.ToArray())
    sprites = @($spritesList.ToArray())
    gear    = @($gearList.ToArray())
}

$json = $catalog | ConvertTo-Json -Depth 6 -Compress
$jsPath = Join-Path $rootDir "npc_assets.js"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($jsPath, "window.NPC_ASSETS = $json;", $utf8NoBom)

Write-Host ""
Write-Host "DONE!" -ForegroundColor Green
Write-Host "  Sets with emotions : $($setsList.Count) (files: $cntSetImg)"
Write-Host "  Elves              : $($elvesList.Count)"
Write-Host "  Humans             : $($humansList.Count)"
Write-Host "  Avatars/Portraits  : $($avatarsList.Count)"
Write-Host "  Sprites/Poses      : $($spritesList.Count)"
Write-Host "  Fantasy gear icons : $($gearList.Count)"
Write-Host "Created: $jsPath" -ForegroundColor Cyan