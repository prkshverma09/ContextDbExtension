#!/usr/bin/env python3
"""
Demo script for Context DB Manager
This script demonstrates how to use the API programmatically.
"""

import asyncio
import json
import time
from pathlib import Path

import httpx

class ContextDBDemo:
    def __init__(self, server_url="http://localhost:8000"):
        self.server_url = server_url
        self.client = httpx.AsyncClient()

    async def check_server_health(self):
        """Check if the server is running."""
        try:
            response = await self.client.get(f"{self.server_url}/health")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Server is online!")
                print(f"   Version: {data.get('version', 'Unknown')}")
                print(f"   Embedding model: {data.get('embedding_model', 'Unknown')}")
                print(f"   Databases: {data.get('databases_count', 0)}")
                return True
            else:
                print(f"❌ Server health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Cannot connect to server: {e}")
            print(f"   Make sure server is running: python server.py")
            return False

    async def create_demo_database(self, db_name="demo_knowledge"):
        """Create a demo database."""
        try:
            response = await self.client.post(
                f"{self.server_url}/databases",
                json={"name": db_name}
            )
            if response.status_code == 200:
                print(f"✅ Created database: {db_name}")
                return True
            else:
                data = response.json()
                if "already exists" in data.get("detail", ""):
                    print(f"ℹ️  Database {db_name} already exists")
                    return True
                else:
                    print(f"❌ Failed to create database: {data.get('detail', 'Unknown error')}")
                    return False
        except Exception as e:
            print(f"❌ Error creating database: {e}")
            return False

    async def add_sample_texts(self, db_name="demo_knowledge"):
        """Add sample texts to demonstrate the system."""
        sample_texts = [
            {
                "text": "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.",
                "metadata": {
                    "title": "What is Machine Learning?",
                    "domain": "ai-learning.com",
                    "url": "https://ai-learning.com/ml-basics",
                    "tags": ["machine-learning", "AI", "education"]
                }
            },
            {
                "text": "QDrant is an open-source vector database written in Rust. It provides fast and scalable vector similarity search with additional payload support.",
                "metadata": {
                    "title": "QDrant Vector Database",
                    "domain": "qdrant.tech",
                    "url": "https://qdrant.tech/documentation",
                    "tags": ["database", "vector-search", "rust"]
                }
            },
            {
                "text": "Chrome extensions are small software programs that customize the browsing experience. They enable users to tailor Chrome functionality and behavior to individual needs or preferences.",
                "metadata": {
                    "title": "Chrome Extensions Overview",
                    "domain": "developer.chrome.com",
                    "url": "https://developer.chrome.com/docs/extensions",
                    "tags": ["chrome", "extensions", "development"]
                }
            },
            {
                "text": "FastAPI is a modern, fast (high-performance), web framework for building APIs with Python 3.7+ based on standard Python type hints.",
                "metadata": {
                    "title": "FastAPI Framework",
                    "domain": "fastapi.tiangolo.com",
                    "url": "https://fastapi.tiangolo.com",
                    "tags": ["python", "api", "web-framework"]
                }
            },
            {
                "text": "Semantic search goes beyond simple keyword matching to understand the intent and contextual meaning of search queries, providing more relevant results.",
                "metadata": {
                    "title": "Understanding Semantic Search",
                    "domain": "search-tech.org",
                    "url": "https://search-tech.org/semantic-search",
                    "tags": ["search", "NLP", "semantic"]
                }
            }
        ]

        print(f"\n📝 Adding {len(sample_texts)} sample texts...")
        added_count = 0

        for i, item in enumerate(sample_texts):
            try:
                response = await self.client.post(
                    f"{self.server_url}/add-text",
                    json={
                        "database_name": db_name,
                        "text": item["text"],
                        "metadata": item["metadata"]
                    }
                )

                if response.status_code == 200:
                    print(f"✅ Added text {i+1}/{len(sample_texts)}")
                    added_count += 1
                else:
                    data = response.json()
                    print(f"❌ Failed to add text {i+1}: {data.get('detail', 'Unknown error')}")

            except Exception as e:
                print(f"❌ Error adding text {i+1}: {e}")

        print(f"✅ Added {added_count} texts successfully")
        return added_count > 0

    async def demo_search(self, db_name="demo_knowledge"):
        """Demonstrate search functionality."""
        search_queries = [
            "What is artificial intelligence?",
            "How do databases work?",
            "Building web applications",
            "Browser development tools"
        ]

        print(f"\n🔍 Running search demonstrations...")

        for query in search_queries:
            print(f"\n📋 Search Query: '{query}'")
            try:
                response = await self.client.post(
                    f"{self.server_url}/search",
                    json={
                        "database_name": db_name,
                        "query": query,
                        "limit": 3
                    }
                )

                if response.status_code == 200:
                    results = response.json()
                    if results:
                        print(f"   Found {len(results)} results:")
                        for i, result in enumerate(results):
                            print(f"   {i+1}. Score: {result['score']:.3f}")
                            print(f"       Text: {result['text'][:100]}...")
                            if result.get('metadata', {}).get('title'):
                                print(f"       From: {result['metadata']['title']}")
                    else:
                        print("   No results found")
                else:
                    data = response.json()
                    print(f"   ❌ Search failed: {data.get('detail', 'Unknown error')}")

            except Exception as e:
                print(f"   ❌ Search error: {e}")

        return True

    async def show_database_stats(self, db_name="demo_knowledge"):
        """Show database statistics."""
        try:
            response = await self.client.get(f"{self.server_url}/databases/{db_name}/stats")
            if response.status_code == 200:
                stats = response.json()
                print(f"\n📊 Database Statistics for '{db_name}':")
                print(f"   Documents: {stats.get('document_count', 0)}")
                print(f"   Vector size: {stats.get('vector_size', 0)}")
                print(f"   Distance metric: {stats.get('distance_metric', 'Unknown')}")
                return True
            else:
                print(f"❌ Failed to get database stats")
                return False
        except Exception as e:
            print(f"❌ Error getting database stats: {e}")
            return False

    async def cleanup_demo(self, db_name="demo_knowledge"):
        """Clean up demo database."""
        try:
            response = await self.client.delete(f"{self.server_url}/databases/{db_name}")
            if response.status_code == 200:
                print(f"\n🧹 Cleaned up demo database: {db_name}")
                return True
            else:
                print(f"⚠️  Could not clean up database (this is okay)")
                return False
        except Exception as e:
            print(f"⚠️  Cleanup error: {e}")
            return False

    async def run_full_demo(self):
        """Run the complete demonstration."""
        print("🚀 Context DB Manager - API Demonstration")
        print("=" * 60)

        # Check server health
        if not await self.check_server_health():
            return False

        db_name = "demo_knowledge"

        # Create demo database
        if not await self.create_demo_database(db_name):
            return False

        # Add sample texts
        if not await self.add_sample_texts(db_name):
            return False

        # Show database stats
        await self.show_database_stats(db_name)

        # Demonstrate search
        await self.demo_search(db_name)

        # Final message
        print("\n" + "=" * 60)
        print("🎉 Demo completed successfully!")
        print("\n💡 What you can do now:")
        print("1. Open the Chrome extension and explore the UI")
        print("2. Select text on any webpage and save it")
        print("3. Search your saved contexts")
        print("4. Create multiple databases for different topics")

        # Ask about cleanup
        print(f"\n🧹 The demo database '{db_name}' has been left intact.")
        print("   You can delete it from the Chrome extension or run:")
        print(f"   curl -X DELETE {self.server_url}/databases/{db_name}")

        return True

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

async def main():
    """Main demo function."""
    demo = ContextDBDemo()
    try:
        success = await demo.run_full_demo()
        if success:
            print("\n✨ Demo completed successfully!")
        else:
            print("\n❌ Demo encountered errors. Please check the output above.")
    finally:
        await demo.close()

if __name__ == "__main__":
    print("Starting Context DB API Demo...")
    print("Make sure the server is running: python server.py\n")

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️  Demo stopped by user")
    except Exception as e:
        print(f"\n💥 Demo crashed: {e}")
        print("Please make sure the server is running and try again.")
