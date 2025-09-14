#!/usr/bin/env python3
"""
Setup script for Context DB Manager
This script helps you set up the environment and download models.
"""

import os
import sys
import subprocess
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors."""
    print(f"\n🔧 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible."""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8+ is required. Current version:", sys.version)
        return False
    print(f"✅ Python version {version.major}.{version.minor} is compatible")
    return True

def install_dependencies():
    """Install Python dependencies."""
    requirements_file = Path(__file__).parent / "requirements.txt"
    if not requirements_file.exists():
        print("❌ requirements.txt not found!")
        return False

    return run_command(
        f"{sys.executable} -m pip install -r {requirements_file}",
        "Installing Python dependencies"
    )

def download_embedding_model():
    """Download the default embedding model."""
    print("\n🤖 Downloading embedding model...")
    print("This may take a few minutes and requires internet connection.")

    try:
        from sentence_transformers import SentenceTransformer

        # Download the default model
        model_name = "all-MiniLM-L6-v2"
        print(f"Downloading {model_name}...")
        model = SentenceTransformer(model_name)
        print(f"✅ Model {model_name} downloaded successfully!")
        print(f"   Vector dimension: {model.get_sentence_embedding_dimension()}")
        return True
    except ImportError:
        print("❌ sentence-transformers not installed. Please install dependencies first.")
        return False
    except Exception as e:
        print(f"❌ Error downloading model: {e}")
        return False

def create_icons():
    """Create extension icons."""
    try:
        from PIL import Image
        print("\n🎨 Creating extension icons...")

        # Import and run the icon creation script
        exec(open("create_icons.py").read())
        return True
    except ImportError:
        print("⚠️  Pillow not installed. Icons will not be created.")
        print("   You can install it with: pip install Pillow")
        return False
    except Exception as e:
        print(f"⚠️  Error creating icons: {e}")
        return False

def create_directories():
    """Create necessary directories."""
    print("\n📁 Creating directories...")
    try:
        directories = ["context_dbs", "icons"]
        for directory in directories:
            Path(directory).mkdir(exist_ok=True)
        print("✅ Directories created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating directories: {e}")
        return False

def test_server():
    """Test if the server can start."""
    print("\n🔍 Testing server startup...")
    print("This will take a moment to load the embedding model...")

    try:
        # Import the server to test if it can load
        import uvicorn
        from fastapi import FastAPI
        print("✅ Server dependencies are working")

        # Test model loading
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
        print("✅ Embedding model loads successfully")
        return True
    except Exception as e:
        print(f"❌ Server test failed: {e}")
        return False

def main():
    """Main setup function."""
    print("🚀 Context DB Manager Setup")
    print("=" * 50)

    success = True

    # Step 1: Check Python version
    if not check_python_version():
        success = False
        return

    # Step 2: Create directories
    if not create_directories():
        success = False

    # Step 3: Install dependencies
    if not install_dependencies():
        success = False
        return

    # Step 4: Download embedding model
    if not download_embedding_model():
        success = False

    # Step 5: Create icons
    create_icons()  # This is optional, so don't fail on errors

    # Step 6: Test server
    if not test_server():
        success = False

    # Final status
    print("\n" + "=" * 50)
    if success:
        print("🎉 Setup completed successfully!")
        print("\n📋 Next steps:")
        print("1. Load the Chrome extension:")
        print("   - Open chrome://extensions/")
        print("   - Enable 'Developer mode'")
        print("   - Click 'Load unpacked' and select this folder")
        print("\n2. Start the server:")
        print("   python server.py")
        print("\n3. Start using the extension!")
        print("   - Click the extension icon to manage databases")
        print("   - Select text on any webpage to save it")
    else:
        print("❌ Setup encountered some issues.")
        print("Please check the errors above and try again.")
        print("\n🆘 Common solutions:")
        print("- Ensure you have Python 3.8+")
        print("- Check your internet connection")
        print("- Try running: pip install --upgrade pip")

if __name__ == "__main__":
    main()
