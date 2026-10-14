# Levanta todo el entorno local de Vrutal: Docker (edge + instancia "lab") y los dos paneles (Vite).
# Uso: doble clic en start-dev.bat, o `./scripts/start-dev.ps1` desde PowerShell.
# Se puede ejecutar varias veces sin problema: lo que ya está arriba no se relanza.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Wait-Docker {
    Write-Host "Comprobando Docker Desktop..."
    $tries = 0
    while ($true) {
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { return }
        $tries++
        if ($tries -eq 1) {
            Write-Host "Docker no responde. Intentando arrancar Docker Desktop..."
            $dockerExe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
            if (Test-Path $dockerExe) {
                Start-Process $dockerExe
            } else {
                Write-Host "No encuentro Docker Desktop en la ruta por defecto. Ábrelo a mano y vuelve a correr este script."
                exit 1
            }
        }
        if ($tries -gt 60) {
            Write-Host "Docker no arrancó tras 2 minutos. Ábrelo a mano y vuelve a correr este script."
            exit 1
        }
        Start-Sleep -Seconds 2
    }
}

function Start-DevServer($name, $path, $port) {
    $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listening) {
        Write-Host "$name ya está en el puerto $port, no se relanza."
        return
    }
    Write-Host "Arrancando $name en el puerto $port..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$path'; npm run dev -- --port $port"
}

Wait-Docker

Write-Host "Levantando edge (Traefik)..."
Push-Location "$root\infra\edge"
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local up -d
Pop-Location

Write-Host "Levantando instancia 'lab' (Activepieces, Postgres, Redis, Qdrant, Postiz)..."
Push-Location "$root\infra\instance"
# Perfil "social" incluido: Postiz y su agente hacen falta para el departamento de Marketing
# (F2 publica por ahi). Postiz arrastra Temporal (depends_on + TEMPORAL_ADDRESS) para programar
# publicaciones, asi que el perfil son 10 contenedores: ~2,6 GB de RAM, medidos el 2026-10-14.
# El nucleo (Activepieces, su Postgres/Redis, Qdrant, memory_postgres) son ~1,1 GB: stack ~3,7 GB.
# Todos los servicios llevan mem_limit en docker-compose.yml desde 2026-10-14: sin cota, un
# contenedor desbocado colgaba el demonio de Docker Desktop en lugar de morir el solo.
docker compose -p lab --env-file clients/lab.env --profile social up -d
Pop-Location

Start-DevServer "VrutalOS (cliente)" "$root\VrutalOS\app" 5173
Start-DevServer "Panel Vrutal1st (staff)" "$root\Panel-Vrutal1st" 5174

Write-Host ""
Write-Host "Listo:"
Write-Host "  Activepieces (staff):     http://localhost:18001"
Write-Host "  VrutalOS (cliente):       http://localhost:5173"
Write-Host "  Panel Vrutal1st (staff):  http://localhost:5174"
