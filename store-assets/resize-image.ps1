<#
.SYNOPSIS
    Fit-within resize for AI-generated images (which are always 1024x1024).
    Maintains aspect ratio by scaling to fit WITHIN the target dimensions,
    centering on a solid background. Nothing gets cropped.

.PARAMETER Source
    Path to the source image file.

.PARAMETER Dest
    Path for the output image. Defaults to source filename with _WxH suffix.

.PARAMETER Width
    Target width in pixels.

.PARAMETER Height
    Target height in pixels.

.PARAMETER BgColor
    Background color as hex (e.g., "#0F0F1A", "#FFFFFF"). Default: "#0F0F1A"

.EXAMPLE
    .\resize-image.ps1 -Source screenshot.png -Width 1280 -Height 800
    .\resize-image.ps1 -Source icon.png -Width 128 -Height 128 -BgColor "#FFFFFF"
    .\resize-image.ps1 -Source promo.png -Dest promo_final.png -Width 440 -Height 280

.EXAMPLE
    # Batch resize all PNGs in a folder to 1280x800
    Get-ChildItem *.png | ForEach-Object { .\resize-image.ps1 -Source $_.Name -Width 1280 -Height 800 }
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Source,

    [string]$Dest,

    [Parameter(Mandatory=$true)]
    [int]$Width,

    [Parameter(Mandatory=$true)]
    [int]$Height,

    [string]$BgColor = "#0F0F1A"
)

Add-Type -AssemblyName System.Drawing

# Resolve full paths
$Source = (Resolve-Path $Source).Path
if (-not $Dest) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($Source)
    $ext = [System.IO.Path]::GetExtension($Source)
    $dir = [System.IO.Path]::GetDirectoryName($Source)
    $Dest = Join-Path $dir "${base}_${Width}x${Height}${ext}"
}

# Load source image
$src = [System.Drawing.Image]::FromFile($Source)
Write-Host "Source: $Source ($($src.Width)x$($src.Height))"

# Create target canvas
$bmp = New-Object System.Drawing.Bitmap($Width, $Height)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# Fill background
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($BgColor))
$graphics.FillRectangle($brush, 0, 0, $Width, $Height)

# Scale to FIT WITHIN target (maintain aspect ratio, pad with background)
$srcAspect = $src.Width / $src.Height
$dstAspect = $Width / $Height

if ($srcAspect -gt $dstAspect) {
    # Source is wider — constrain by width
    $scaledW = $Width
    $scaledH = [int]($Width / $srcAspect)
} else {
    # Source is taller — constrain by height
    $scaledH = $Height
    $scaledW = [int]($Height * $srcAspect)
}

# Center on canvas
$x = [int](($Width - $scaledW) / 2)
$y = [int](($Height - $scaledH) / 2)

$graphics.DrawImage($src, $x, $y, $scaledW, $scaledH)

# Save
$bmp.Save($Dest, [System.Drawing.Imaging.ImageFormat]::Png)

# Cleanup
$brush.Dispose()
$graphics.Dispose()
$bmp.Dispose()
$src.Dispose()

# Verify
$result = [System.Drawing.Image]::FromFile($Dest)
Write-Host "Output: $Dest ($($result.Width)x$($result.Height))" -ForegroundColor Green
$result.Dispose()
