#!/usr/bin/env python3
"""
Simple script to create basic SVG icons for the Chrome extension.
This version doesn't require PIL and creates simple SVG-based icons.
"""

import os

def create_svg_icon(size, filename):
    """Create a simple SVG icon."""
    svg_content = f'''<svg width="{size}" height="{size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="{size//2}" cy="{size//2}" r="{size//2 - 2}" fill="url(#grad)" stroke="#4f46e5" stroke-width="2"/>

  <!-- Database icon (simplified) -->
  <ellipse cx="{size//2}" cy="{size//2 - size//6}" rx="{size//3}" ry="{size//8}" fill="white" opacity="0.9"/>
  <rect x="{size//2 - size//3}" y="{size//2 - size//6}" width="{size//3 * 2}" height="{size//3}" fill="white" opacity="0.9"/>
  <ellipse cx="{size//2}" cy="{size//2 + size//6}" rx="{size//3}" ry="{size//8}" fill="white" opacity="0.9"/>

  <!-- DB text -->
  <text x="{size//2}" y="{size//2 + 3}" text-anchor="middle" fill="#4f46e5" font-family="Arial, sans-serif" font-size="{max(8, size//5)}" font-weight="bold">DB</text>
</svg>'''

    with open(filename, 'w') as f:
        f.write(svg_content)
    print(f"Created SVG icon: {filename}")

def main():
    """Create all required icon sizes as SVG."""
    icons_dir = "icons"
    os.makedirs(icons_dir, exist_ok=True)

    # Chrome extension requires these icon sizes
    sizes = [16, 32, 48, 128]

    for size in sizes:
        filename = os.path.join(icons_dir, f"icon{size}.svg")
        create_svg_icon(size, filename)

    print("\nSVG icon creation completed!")
    print("Note: Chrome extensions prefer PNG icons. If you have image editing software:")
    print("1. Open each SVG file")
    print("2. Export as PNG at the same dimensions")
    print("3. Replace the SVG files with PNG files")
    print("\nAlternatively, you can:")
    print("1. Install Pillow: pip install Pillow")
    print("2. Run: python create_icons.py")

if __name__ == "__main__":
    main()
