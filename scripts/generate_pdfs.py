#!/usr/bin/env python3

import os
import sys
import subprocess
import argparse
from pathlib import Path

def convert_md_to_pdf(md_file, pdf_file, author):
    """Convert MD to PDF using pandoc, then watermark."""
    os.makedirs(os.path.dirname(pdf_file), exist_ok=True)
    
    # Convert MD to PDF with basic formatting
    temp_pdf = pdf_file.replace('.pdf', '_temp.pdf')
    cmd = [
        'pandoc',
        md_file,
        '--pdf-engine=xelatex',
        '--variable', f'author:{author}',
        '-o', temp_pdf
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error converting {md_file}: {result.stderr}")
        return False
    
    # Watermark and finalize
    if not add_watermark(temp_pdf, pdf_file, author):
        return False
    
    os.remove(temp_pdf)
    print(f"Generated {pdf_file}")
    return True

def add_watermark(input_pdf, output_pdf, author):
    """Call watermark.py to add watermark."""
    cmd = ['python', 'scripts/watermark.py', input_pdf, output_pdf, author]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0

def main():
    parser = argparse.ArgumentParser(description='Generate PDFs from Markdown files')
    parser.add_argument('--files', required=True, help='Comma-separated MD files')
    parser.add_argument('--author', required=True, help='Commit author')
    args = parser.parse_args()
    
    md_files = [f.strip() for f in args.files.split(',') if f.strip()]
    
    success_count = 0
    for md_path in md_files:
        if not os.path.exists(md_path):
            print(f"Warning: {md_path} not found, skipping")
            continue
        
        pdf_path = md_path.replace('documentations/', 'generated-pdfs/').replace('.md', '.pdf')
        if convert_md_to_pdf(md_path, pdf_path, args.author):
            success_count += 1
    
    print(f"Completed: {success_count}/{len(md_files)} PDFs generated")
    sys.exit(0 if success_count == len(md_files) else 1)

if __name__ == '__main__':
    main()
