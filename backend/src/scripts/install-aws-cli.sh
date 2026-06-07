#!/bin/bash
# AWS CLI Installation Script for Sandbox Environment
# This script installs AWS CLI v2 in the sandbox environment

set -e

echo "Installing AWS CLI v2..."

# Check if already installed
if command -v aws &> /dev/null; then
    echo "AWS CLI is already installed: $(aws --version)"
    exit 0
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "Cannot detect OS"
    exit 1
fi

echo "Detected OS: $OS"

# Install based on OS
case "$OS" in
    "alpine")
        echo "Installing AWS CLI for Alpine..."
        apk add --no-cache python3 py3-pip groff less
        pip3 install --no-cache-dir awscli
        ;;
    "ubuntu"|"debian")
        echo "Installing AWS CLI for Debian/Ubuntu..."
        apt-get update
        apt-get install -y unzip curl
        curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip -q awscliv2.zip
        ./aws/install
        rm -rf awscliv2.zip aws
        ;;
    "amazon"|"centos"|"rhel"|"fedora")
        echo "Installing AWS CLI for RHEL/CentOS/Fedora..."
        yum install -y unzip curl
        curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip -q awscliv2.zip
        ./aws/install
        rm -rf awscliv2.zip aws
        ;;
    *)
        echo "Unsupported OS: $OS"
        echo "Attempting generic installation..."
        # Try generic installation
        if command -v python3 &> /dev/null; then
            pip3 install awscli
        else
            echo "Python3 not found. Please install AWS CLI manually."
            exit 1
        fi
        ;;
esac

# Verify installation
if command -v aws &> /dev/null; then
    echo "AWS CLI installed successfully: $(aws --version)"
else
    echo "Warning: AWS CLI installation may have failed. Trying to add to PATH..."
    # Try common installation paths
    if [ -f /usr/local/bin/aws ]; then
        echo "AWS CLI found at /usr/local/bin/aws"
        export PATH=$PATH:/usr/local/bin
    elif [ -f /usr/bin/aws ]; then
        echo "AWS CLI found at /usr/bin/aws"
    fi
fi

echo "AWS CLI installation complete!"
