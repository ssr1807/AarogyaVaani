import os

# Define the folder structure
folders = [
    "frontend/app/kiosk",
    "frontend/app/doctor-dashboard",
    "frontend/app/api",
    "frontend/components",
    "frontend/lib",
    "backend/app/api",
    "backend/app/services",
    "backend/app/core",
    "docs"
]

# Define the initial empty files
files = [
    "backend/app/main.py",
    "backend/app/api/chat.py",
    "backend/app/api/ocr.py",
    "backend/app/api/patients.py",
    "backend/app/services/groq_client.py",
    "backend/app/services/ocr_engine.py",
    "backend/app/core/config.py",
    "backend/requirements.txt",
    "backend/.env",
    ".gitignore",
    "README.md"
]

# Create folders
for folder in folders:
    os.makedirs(folder, exist_ok=True)

# Create files
for file in files:
    with open(file, 'w') as f:
        pass # Creates an empty file

print("✅ Project structure successfully generated!")