#!/usr/bin/env python3
"""
Simple script to create placeholder icons for the Chrome extension.
You can replace these with your own custom icons later.
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create a simple icon with the given size."""
    # Create a new image with a gradient background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw a circular background with gradient effect
    for i in range(size // 2):
        color = (103, 126, 234, 255 - i * 2)  # Purple gradient
        draw.ellipse([i, i, size-i, size-i], fill=color)

    # Draw the "DB" text
    try:
        # Try to use a system font
        font_size = max(8, size // 3)
        font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()

    # Get text dimensions
    text = "DB"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Center the text
    x = (size - text_width) // 2
    y = (size - text_height) // 2

    # Draw the text with shadow effect
    draw.text((x+1, y+1), text, fill=(0, 0, 0, 100), font=font)  # Shadow
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)  # Main text

    # Save the image
    img.save(filename, 'PNG')
    print(f"Created icon: {filename}")

def main():
    """Create all required icon sizes."""
    icons_dir = "icons"
    os.makedirs(icons_dir, exist_ok=True)

    # Chrome extension requires these icon sizes
    sizes = [16, 32, 48, 128]

    for size in sizes:
        filename = os.path.join(icons_dir, f"icon{size}.png")
        create_icon(size, filename)

    print("\nIcon creation completed!")
    print("You can replace these placeholder icons with your own custom designs.")

if __name__ == "__main__":
    main()
