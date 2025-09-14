# 🚀 Quick Start Guide

Get your Context DB Manager up and running in 5 minutes!

## ✅ Prerequisites

- Python 3.8+
- Chrome browser
- 4GB+ RAM (for embedding models)

## 🏃 Quick Setup (5 Steps)

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Create Extension Icons
```bash
python create_simple_icons.py
```

### 3. Load Chrome Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer Mode" (top right toggle)
3. Click "Load unpacked" → Select this folder
4. Pin the extension to your toolbar

### 4. Start the Server
```bash
python server.py
```
Server will be available at `http://localhost:8000`

### 5. Test Everything Works
```bash
python demo.py
```

## 🎯 How to Use

### Creating Your First Database
1. Click the extension icon
2. Enter a database name (e.g., "Research Notes")
3. Click "Create Database"

### Saving Text from Webpages
**Method 1**: Select text → Modal appears → Save
**Method 2**: Select text → Right-click → "Add to Context DB"

### Searching Your Context
1. Open extension popup
2. Select database or check "Search all databases"
3. Enter your query → Click Search
4. View results with similarity scores

## ⚡ Keyboard Shortcuts

- **Ctrl+K** (Cmd+K): Focus search box
- **Escape**: Clear search
- **Enter**: Submit search/create database

## 🔧 Configuration

**Change Embedding Model**: Edit `EMBEDDING_MODEL` in `server.py`
- `all-MiniLM-L6-v2` (default) - Fast & efficient
- `BAAI/bge-small-en-v1.5` - Better quality
- `all-mpnet-base-v2` - Highest quality (slower)

**Server Settings**: Modify `Config` class in `server.py`

## 🆘 Troubleshooting

**Server won't start?**
- Check Python 3.8+: `python --version`
- Install dependencies: `pip install -r requirements.txt`

**Extension shows "offline"?**
- Start server: `python server.py`
- Check `http://localhost:8000/health` in browser

**Text selection not working?**
- Reload webpage after installing extension
- Check extension permissions in `chrome://extensions/`

## 📊 What You Get

✅ **Local-only**: No data leaves your machine
✅ **Fast search**: Semantic similarity matching
✅ **Rich metadata**: URL, title, tags, timestamps
✅ **Multiple databases**: Organize by topic
✅ **Modern UI**: Clean, intuitive interface
✅ **Context menu**: Right-click integration

## 🎉 You're Ready!

Start selecting text on webpages and building your personal knowledge base!

---

**Need help?** Check the full `README.md` for detailed documentation.
