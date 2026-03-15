FQBN   := "Inkplate_Boards:esp32:Inkplate5V2"
PORT   := `ls /dev/cu.usbserial-* 2>/dev/null | head -1`
SKETCH := "inkplate"

# List available recipes
default:
    @just --list

# ── Worker ────────────────────────────────────────────────────────────────────

# Seed local D1 and start dev server
dev:
    npm run dev

# Apply remote migrations and deploy worker
deploy:
    npm run deploy

# Typecheck and dry-run deploy
check:
    npm run check

# Generate Cloudflare Worker types
typegen:
    npm run cf-typegen

# ── Inkplate ──────────────────────────────────────────────────────────────────

# Compile the Arduino sketch
compile:
    arduino-cli compile --fqbn {{FQBN}} {{SKETCH}}

# Compile and flash to connected device
flash: compile
    arduino-cli upload --fqbn "{{FQBN}}:UploadSpeed=115200" --port {{PORT}} {{SKETCH}}

# Open serial monitor (Ctrl-C to exit)
monitor:
    arduino-cli monitor --port {{PORT}} --config baudrate=115200
