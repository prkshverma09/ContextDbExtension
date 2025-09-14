#!/usr/bin/env python3
"""
Test script for Context DB Manager
This script tests the core functionality of the system.
"""

import time
import asyncio
import sys
from pathlib import Path

def test_imports():
    """Test if all required packages can be imported."""
    print("🧪 Testing imports...")

    try:
        import fastapi
        print(f"✅ FastAPI {fastapi.__version__}")
    except ImportError as e:
        print(f"❌ FastAPI: {e}")
        return False

    try:
        import uvicorn
        print(f"✅ Uvicorn")
    except ImportError as e:
        print(f"❌ Uvicorn: {e}")
        return False

    try:
        from qdrant_client import QdrantClient
        print(f"✅ QDrant Client")
    except ImportError as e:
        print(f"❌ QDrant Client: {e}")
        return False

    try:
        from sentence_transformers import SentenceTransformer
        print(f"✅ Sentence Transformers")
    except ImportError as e:
        print(f"❌ Sentence Transformers: {e}")
        return False

    return True

def test_embedding_model():
    """Test embedding model loading and encoding."""
    print("\n🤖 Testing embedding model...")

    try:
        from sentence_transformers import SentenceTransformer

        print("Loading all-MiniLM-L6-v2...")
        start_time = time.time()
        model = SentenceTransformer('all-MiniLM-L6-v2')
        load_time = time.time() - start_time

        print(f"✅ Model loaded in {load_time:.2f}s")
        print(f"   Dimension: {model.get_sentence_embedding_dimension()}")

        # Test encoding
        test_text = "This is a test sentence for embedding."
        start_time = time.time()
        embedding = model.encode(test_text)
        encode_time = time.time() - start_time

        print(f"✅ Text encoded in {encode_time:.3f}s")
        print(f"   Embedding shape: {embedding.shape}")
        print(f"   First 5 values: {embedding[:5]}")

        return True

    except Exception as e:
        print(f"❌ Embedding model test failed: {e}")
        return False

def test_qdrant():
    """Test QDrant local database."""
    print("\n💾 Testing QDrant...")

    try:
        from qdrant_client import QdrantClient, models
        import tempfile
        import shutil

        # Create temporary directory
        temp_dir = Path(tempfile.mkdtemp())
        print(f"Using temp directory: {temp_dir}")

        # Initialize client
        client = QdrantClient(path=str(temp_dir))
        print("✅ QDrant client created")

        # Create collection
        collection_name = "test_collection"
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=384,  # all-MiniLM-L6-v2 dimension
                distance=models.Distance.COSINE
            )
        )
        print("✅ Collection created")

        # Add test data
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer('all-MiniLM-L6-v2')

        test_texts = [
            "The capital of France is Paris.",
            "Python is a programming language.",
            "Machine learning is fascinating."
        ]

        points = []
        for i, text in enumerate(test_texts):
            vector = model.encode(text).tolist()
            points.append(models.PointStruct(
                id=i,
                vector=vector,
                payload={"text": text}
            ))

        client.upsert(
            collection_name=collection_name,
            points=points,
            wait=True
        )
        print(f"✅ Added {len(test_texts)} documents")

        # Test search
        query = "What is the capital of France?"
        query_vector = model.encode(query).tolist()

        search_results = client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=3
        )

        print(f"✅ Search completed, found {len(search_results)} results")
        for i, result in enumerate(search_results):
            print(f"   {i+1}. Score: {result.score:.3f} | Text: {result.payload['text']}")

        # Cleanup
        shutil.rmtree(temp_dir)
        print("✅ Cleanup completed")

        return True

    except Exception as e:
        print(f"❌ QDrant test failed: {e}")
        return False

def test_server_startup():
    """Test if server can start (without actually starting it)."""
    print("\n🚀 Testing server startup...")

    try:
        # Import server components
        import server

        # Test configuration
        print(f"✅ Server module imported")
        print(f"   Embedding model: {server.Config.EMBEDDING_MODEL}")
        print(f"   Data directory: {server.Config.DATA_DIR}")
        print(f"   Host: {server.Config.HOST}:{server.Config.PORT}")

        # Test if server can be created
        app = server.app
        print("✅ FastAPI app created")

        return True

    except Exception as e:
        print(f"❌ Server startup test failed: {e}")
        return False

def test_extension_files():
    """Test if extension files exist and are valid."""
    print("\n🧩 Testing extension files...")

    required_files = [
        "manifest.json",
        "popup.html",
        "popup.css",
        "popup.js",
        "content.js",
        "content.css",
        "background.js"
    ]

    all_exist = True
    for filename in required_files:
        if Path(filename).exists():
            print(f"✅ {filename}")
        else:
            print(f"❌ {filename} - Missing!")
            all_exist = False

    # Test manifest.json format
    try:
        import json
        with open("manifest.json") as f:
            manifest = json.load(f)
        print("✅ manifest.json is valid JSON")
        print(f"   Extension name: {manifest.get('name', 'Unknown')}")
        print(f"   Version: {manifest.get('version', 'Unknown')}")
    except Exception as e:
        print(f"❌ manifest.json validation failed: {e}")
        all_exist = False

    return all_exist

def main():
    """Run all tests."""
    print("🔬 Context DB Manager System Test")
    print("=" * 50)

    tests = [
        ("Package Imports", test_imports),
        ("Embedding Model", test_embedding_model),
        ("QDrant Database", test_qdrant),
        ("Server Components", test_server_startup),
        ("Extension Files", test_extension_files),
    ]

    results = {}
    total_time = time.time()

    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        start_time = time.time()
        results[test_name] = test_func()
        duration = time.time() - start_time
        print(f"Duration: {duration:.2f}s")

    total_time = time.time() - total_time

    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)

    passed = sum(results.values())
    total = len(results)

    for test_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")

    print(f"\nResults: {passed}/{total} tests passed")
    print(f"Total time: {total_time:.2f}s")

    if passed == total:
        print("\n🎉 All tests passed! Your system is ready to use.")
        print("\n📋 Next steps:")
        print("1. Start the server: python server.py")
        print("2. Load the Chrome extension")
        print("3. Start saving and searching text!")
    else:
        print("\n⚠️  Some tests failed. Please fix the issues above.")
        print("💡 Try running: python setup.py")

if __name__ == "__main__":
    main()
